import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'generated-images', 'manual-test');

// Bounded to 2 prompts
const prompts = [
  {
    label: 'LinkedIn_Carousel_Social_Graphic',
    prompt:
      'Close-up, high-detail photograph of a Microsoft Surface Pro screen showcasing a Copilot+ PC feature (e.g., a generative AI interface assisting with a business report, a complex data visualization being simplified by AI, or a real-time language translation). A professional hands, in smart business attire, are visible in the foreground, either typing on the Type Cover keyboard or gently interacting with the touch screen. The lighting is soft and even, highlighting the screen clarity and the device premium finish. The overall impression is one of advanced, AI-enhanced productivity. Ensure the UI is clean and professional, avoiding any alterations to official Microsoft UI elements.',
  },
  {
    label: 'Display_Ad_Website_Section',
    prompt:
      'Dynamic, professional photograph of an Irish sales professional, male, 40s, dressed in a sharp suit, confidently presenting to a client in a contemporary meeting room. The Microsoft Surface Pro is positioned on the table in kickstand mode, connected via a Surface Dock (subtly visible, with sold separately note) to a large wall-mounted screen displaying a clear, professional business presentation. The professional is gesturing towards the screen, engaging with the client (partially visible, blurred in background). Emphasize the Surface Pro role as a reliable presentation tool and its professional integration into a business meeting. Clean composition, focus on interaction and professionalism.',
  },
];

async function main() {
  // Dynamic import so tsx can resolve TypeScript
  const { generateImage } = await import('../server/src/services/geminiClient.js');
  const { config } = await import('../server/src/config.js');

  const model = config.gemini.imageModel();
  console.log(`Image model: ${model}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { label, prompt } of prompts) {
    const filename = `${label}.png`;
    const filePath = path.join(OUT_DIR, filename);
    console.log(`Generating "${label}"...`);

    try {
      const buffer = await generateImage({ prompt, model });
      fs.writeFileSync(filePath, buffer);
      console.log(`  OK  saved ${filePath} (${buffer.length} bytes)`);
    } catch (err) {
      console.error(`  FAIL ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});