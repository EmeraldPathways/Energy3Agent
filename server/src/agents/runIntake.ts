import { generateStructuredOutput } from '../services/geminiClient.js';
import { config } from '../config.js';
import { MEETING_NOTES_INTAKE_PROMPT } from './prompts/meeting-notes.js';
import { BRAND_GUIDE_INTAKE_PROMPT } from './prompts/brand-guide.js';
import { ASSET_REVIEW_PROMPT } from './prompts/asset-review.js';
import { INTAKE_SUMMARY_PROMPT } from './prompts/intake-summary.js';
import type {
  MeetingNotesIntake,
  BrandGuideIntake,
  AssetReviewIntake,
  IntakeSummary,
} from '@ai-campaign/shared';

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

export async function runMeetingNotesIntake(text: string): Promise<MeetingNotesIntake> {
  const raw = await generateStructuredOutput({
    prompt: MEETING_NOTES_INTAKE_PROMPT + text,
    model: MODEL,
    temperature: 0.3,
  });
  return safeParseJson<MeetingNotesIntake>(raw, 'Meeting Notes Intake');
}

export async function runBrandGuideIntake(text: string): Promise<BrandGuideIntake> {
  const raw = await generateStructuredOutput({
    prompt: BRAND_GUIDE_INTAKE_PROMPT + text,
    model: MODEL,
    temperature: 0.3,
  });
  return safeParseJson<BrandGuideIntake>(raw, 'Brand Guide Intake');
}

export async function runAssetReview(fileList: string): Promise<AssetReviewIntake> {
  const raw = await generateStructuredOutput({
    prompt: ASSET_REVIEW_PROMPT + fileList,
    model: MODEL,
    temperature: 0.3,
  });
  return safeParseJson<AssetReviewIntake>(raw, 'Asset Review');
}

export async function runIntakeSummary(
  meetingNotes: MeetingNotesIntake,
  brandGuide: BrandGuideIntake,
  assetReview: AssetReviewIntake,
): Promise<IntakeSummary> {
  const prompt = INTAKE_SUMMARY_PROMPT
    .replace('{MEETING_NOTES_INTAKE}', JSON.stringify(meetingNotes, null, 2))
    .replace('{BRAND_GUIDE_INTAKE}', JSON.stringify(brandGuide, null, 2))
    .replace('{ASSET_REVIEW}', JSON.stringify(assetReview, null, 2));

  const raw = await generateStructuredOutput({ prompt, model: MODEL, temperature: 0.3 });
  return safeParseJson<IntakeSummary>(raw, 'Intake Summary');
}