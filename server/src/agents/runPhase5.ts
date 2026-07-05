import { generateStructuredOutput, generateImage } from '../services/geminiClient.js';
import { config } from '../config.js';
import { CREATOR_AGENT_PROMPT } from './prompts/creator-agent.js';
import { TEXT_CONTENT_AGENT_PROMPT } from './prompts/text-content-agent.js';
import { IMAGERY_CREATIVE_AGENT_PROMPT } from './prompts/imagery-creative-agent.js';
import { MARKET_RESEARCH_AGENT_PROMPT } from './prompts/market-research-agent.js';
import { getConceptImagesDir } from '../db.js';
import type {
  CreatorProductionPlan,
  TextContentOutput,
  ImageryCreativeOutput,
  MarketResearchOutput,
  GeneratedConceptImage,
} from '@ai-campaign/shared';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MODEL = config.gemini.standardModel();

async function safeParseJson<T>(raw: string, label: string): Promise<T> {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as T;
      } catch {
        throw new Error(`${label}: Failed to parse JSON even after repair`);
      }
    }
    throw new Error(`${label}: Invalid JSON output from Gemini`);
  }
}

export async function runCreatorPlan(brief: Record<string, unknown>): Promise<CreatorProductionPlan> {
  const prompt = CREATOR_AGENT_PROMPT.replace('{BRIEF}', JSON.stringify(brief, null, 2));
  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.3 });
  return safeParseJson<CreatorProductionPlan>(raw, 'Creator Plan');
}

export async function runTextContent(
  brief: Record<string, unknown>,
  creatorPlan: Record<string, unknown>,
): Promise<TextContentOutput> {
  const prompt = TEXT_CONTENT_AGENT_PROMPT
    .replace('{BRIEF}', JSON.stringify(brief, null, 2))
    .replace('{CREATOR_PLAN}', JSON.stringify(creatorPlan, null, 2));
  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.5 });
  const result = await safeParseJson<TextContentOutput>(raw, 'Text Content');
  result.model = MODEL;
  result.generatedAt = new Date().toISOString();
  return result;
}

export async function runImageryCreative(
  brief: Record<string, unknown>,
  creatorPlan: Record<string, unknown>,
): Promise<ImageryCreativeOutput> {
  const prompt = IMAGERY_CREATIVE_AGENT_PROMPT
    .replace('{BRIEF}', JSON.stringify(brief, null, 2))
    .replace('{CREATOR_PLAN}', JSON.stringify(creatorPlan, null, 2));
  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.5 });
  const result = await safeParseJson<ImageryCreativeOutput>(raw, 'Imagery Creative');
  result.model = MODEL;
  result.generatedAt = new Date().toISOString();
  return result;
}

export async function runMarketResearch(
  brief: Record<string, unknown>,
  creatorPlan: Record<string, unknown>,
): Promise<MarketResearchOutput> {
  const prompt = MARKET_RESEARCH_AGENT_PROMPT
    .replace('{BRIEF}', JSON.stringify(brief, null, 2))
    .replace('{CREATOR_PLAN}', JSON.stringify(creatorPlan, null, 2));
  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.5 });
  const result = await safeParseJson<MarketResearchOutput>(raw, 'Market Research');
  result.model = MODEL;
  result.generatedAt = new Date().toISOString();
  return result;
}

export async function generateConceptImages(
  imageryCreative: ImageryCreativeOutput,
  projectId: string,
): Promise<GeneratedConceptImage[]> {
  const prompts = imageryCreative.image_prompts ?? [];
  if (prompts.length === 0) return [];

  const maxCount = config.conceptImages.maxCount();
  const selected = prompts.slice(0, maxCount);
  const imageModel = config.gemini.imageModel();
  console.log(`[conceptImages] Using image model: ${imageModel}`);
  const dir = getConceptImagesDir();

  await fs.mkdir(path.join(dir, projectId), { recursive: true });

  const results: GeneratedConceptImage[] = [];

  for (const entry of selected) {
    const imagePrompt = `${entry.prompt} --format ${entry.format}`;
    try {
      const imageBuffer = await generateImage({ prompt: imagePrompt, model: imageModel });
      const filename = `${randomUUID()}.png`;
      const filePath = path.join(dir, projectId, filename);
      await fs.writeFile(filePath, imageBuffer);

      results.push({
        id: randomUUID(),
        label: entry.format,
        prompt: imagePrompt,
        imagePath: `generated-images/${projectId}/${filename}`,
        stage: 'creator',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[conceptImages] Failed to generate image for prompt "${entry.prompt.substring(0, 80)}...":`, (err as Error).message);
    }
  }

  return results;
}
