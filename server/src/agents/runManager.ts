import { generateStructuredOutput } from '../services/geminiClient.js';
import { config } from '../config.js';
import { MANAGER_AGENT_PROMPT } from './prompts/manager-agent.js';
import type { ManagerBrief } from '@ai-campaign/shared';

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

export async function runManagerBrief(
  meetingNotesIntake: Record<string, unknown>,
  brandGuideIntake: Record<string, unknown>,
  assetReview: Record<string, unknown>,
  intakeSummary: Record<string, unknown>,
): Promise<ManagerBrief> {
  const prompt = MANAGER_AGENT_PROMPT
    .replace('{MEETING_NOTES_INTAKE}', JSON.stringify(meetingNotesIntake, null, 2))
    .replace('{BRAND_GUIDE_INTAKE}', JSON.stringify(brandGuideIntake, null, 2))
    .replace('{ASSET_REVIEW}', JSON.stringify(assetReview, null, 2))
    .replace('{INTAKE_SUMMARY}', JSON.stringify(intakeSummary, null, 2));

  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.3 });
  return safeParseJson<ManagerBrief>(raw, 'Manager Brief');
}
