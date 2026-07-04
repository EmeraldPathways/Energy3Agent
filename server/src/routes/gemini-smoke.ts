import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateStructuredOutput } from '../services/geminiClient.js';
import { config } from '../config.js';

const router = Router();

const SmokeRequestSchema = z.object({
  topic: z.string().min(1).max(200).optional().default('marketing'),
});

const SmokeResponseSchema = z.object({
  data: z.object({
    model: z.string(),
    topic: z.string(),
    taglines: z.array(z.string()),
    generatedAt: z.string(),
  }),
});

/**
 * POST /api/gemini-smoke
 *
 * Internal validation route. Proves the Gemini API key is loaded server-side,
 * the configured model is used from centralized config, and a structured
 * response is returned.
 */
router.post('/', async (req: Request, res: Response) => {
  const parsed = SmokeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { topic } = parsed.data;
  const model = config.gemini.standardModel();

  try {
    const prompt = `Generate 3 short, creative marketing taglines for a product or service related to: "${topic}". Return ONLY valid JSON in this exact shape: {"taglines": ["tagline 1", "tagline 2", "tagline 3"]}. No other text.`;

    const schema = {
      type: 'object',
      properties: {
        taglines: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ['taglines'],
    };

    const rawJson = await generateStructuredOutput({
      prompt,
      model,
      responseSchema: schema as Record<string, unknown>,
      temperature: 0.9,
    });

    const result = JSON.parse(rawJson) as { taglines: string[] };

    const response = {
      data: {
        model,
        topic: topic,
        taglines: result.taglines,
        generatedAt: new Date().toISOString(),
      },
    };

    const validated = SmokeResponseSchema.safeParse(response);
    if (!validated.success) {
      res.status(500).json({ error: 'Response validation failed', details: validated.error.flatten() });
      return;
    }

    res.json(validated.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini smoke test failed';
    console.error('[gemini-smoke]', message);
    res.status(500).json({ error: message });
  }
});

export default router;