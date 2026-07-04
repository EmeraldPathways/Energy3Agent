import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import { config } from '../config.js';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey() });
  }
  return client;
}

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 2;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

export interface StructuredOutputParams {
  prompt: string;
  model?: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
}

export async function generateStructuredOutput(params: StructuredOutputParams): Promise<string> {
  const genai = getClient();
  const model = params.model ?? config.gemini.standardModel();

  const genConfig: GenerateContentConfig = {
    temperature: params.temperature ?? 0.7,
  };

  if (params.responseSchema) {
    genConfig.responseMimeType = 'application/json';
    genConfig.responseSchema = params.responseSchema;
  }

  return withRetry(async () => {
    const response = await genai.models.generateContent({
      model,
      contents: params.prompt,
      config: genConfig,
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned empty response');
    }
    return text;
  });
}

export interface GoogleSearchParams {
  prompt: string;
  model?: string;
}

export async function generateWithGoogleSearch(params: GoogleSearchParams): Promise<string> {
  const genai = getClient();
  const model = params.model ?? config.gemini.standardModel();

  return withRetry(async () => {
    const response = await genai.models.generateContent({
      model,
      contents: params.prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned empty response with Google Search');
    }
    return text;
  });
}