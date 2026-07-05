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

export interface GenerateImageParams {
  prompt: string;
  model?: string;
}

export async function generateImage(params: GenerateImageParams): Promise<Buffer> {
  const genai = getClient();
  const model = params.model ?? config.gemini.imageModel();

  const isImagenModel = model.startsWith('imagen');

  return withRetry(async () => {
    if (isImagenModel) {
      const apiKey = config.gemini.apiKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
      const fetchBody = JSON.stringify({
        instances: [{ prompt: params.prompt }],
      });

      const httpRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fetchBody,
      });

      if (!httpRes.ok) {
        const errBody = await httpRes.text();
        throw new Error(`Imagen predict failed (${httpRes.status}): ${errBody}`);
      }

      const json = await httpRes.json() as { predictions?: { mimeType?: string; bytesBase64Encoded?: string }[] };
      if (!json.predictions?.length) {
        throw new Error('Imagen returned no predictions');
      }

      const pred = json.predictions[0];
      if (pred.bytesBase64Encoded) {
        return Buffer.from(pred.bytesBase64Encoded, 'base64');
      }

      throw new Error('Imagen returned no image data');
    }

    const response = await genai.models.generateContent({
      model,
      contents: { parts: [{ text: params.prompt }] },
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    if (!response.candidates?.length) {
      throw new Error('Gemini image generation returned no candidates');
    }

    const parts = response.candidates[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    throw new Error('Gemini image generation returned no image data');
  });
}
