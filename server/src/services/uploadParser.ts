import fs from 'node:fs/promises';

type SupportedExt = '.txt' | '.pdf' | '.docx' | '.png' | '.jpg' | '.jpeg' | '.webp' | '.svg';

const TEXT_EXTS: SupportedExt[] = ['.txt', '.pdf', '.docx'];
const IMAGE_EXTS: SupportedExt[] = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

export function isTextFile(ext: string): boolean {
  return TEXT_EXTS.includes(ext.toLowerCase() as SupportedExt);
}

export function isImageFile(ext: string): boolean {
  return IMAGE_EXTS.includes(ext.toLowerCase() as SupportedExt);
}

export function getFileCategory(
  originalName: string,
  fieldName?: string,
): 'meeting_notes' | 'brand_guide' | 'project_brief' | 'logo' | 'product_image' | 'campaign_imagery' | 'other' {
  if (fieldName === 'meetingNotes') return 'meeting_notes';
  if (fieldName === 'projectBrief') return 'project_brief';
  if (fieldName === 'brandGuide') return 'brand_guide';
  if (fieldName === 'logo') return 'logo';
  if (fieldName === 'productImages') return 'product_image';
  if (fieldName === 'campaignImagery') return 'campaign_imagery';

  const lower = originalName.toLowerCase();
  if (lower.includes('meeting') || lower.includes('notes')) return 'meeting_notes';
  if (lower.includes('brand') || lower.includes('guide')) return 'brand_guide';
  if (lower.includes('logo')) return 'logo';
  return 'other';
}

export async function extractText(filePath: string, ext: string): Promise<string> {
  const lower = ext.toLowerCase();

  if (lower === '.txt') {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.slice(0, 100000);
  }

  if (lower === '.pdf') {
    try {
      // dynamic import works in ESM + tsx; module has default export at runtime
      const pdfParseMod = await import('pdf-parse');
      const pdfParse = (pdfParseMod as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default ?? pdfParseMod;
      const buffer = await fs.readFile(filePath);
      const data = await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buffer);
      return data.text.slice(0, 100000);
    } catch {
      throw new Error('Failed to parse PDF. File may be image-based or corrupted.');
    }
  }

  if (lower === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, 100000);
    } catch {
      throw new Error('Failed to parse DOCX file.');
    }
  }

  throw new Error(`Unsupported file type for text extraction: ${ext}`);
}