import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const c = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const r = await c.models.list({ pageSize: 100 });
  for (const m of r.page ?? []) {
    if (m.name?.includes('imagen') || m.name?.includes('image') || m.displayName?.includes('Imagen')) {
      console.log(`${m.name}  |  displayName: ${m.displayName}  |  actions: ${m.supportedActions?.join(',')}`);
    }
  }
}
main().catch(console.error);