function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),

  gemini: {
    apiKey: () => requiredEnv('GEMINI_API_KEY'),
    fastModel: () => optionalEnv('GEMINI_FAST_MODEL', 'gemini-2.5-flash-lite'),
    standardModel: () => optionalEnv('GEMINI_STANDARD_MODEL', 'gemini-2.5-flash'),
    reasoningModel: () => optionalEnv('GEMINI_REASONING_MODEL', 'gemini-2.5-pro'),
    imageModel: () => optionalEnv('GEMINI_IMAGE_MODEL', 'imagen-4.0-generate-001'),
    enableGoogleSearchGrounding: () =>
      optionalEnv('ENABLE_GOOGLE_SEARCH_GROUNDING', 'false') === 'true',
  },

  conceptImages: {
    maxCount: () => parseInt(optionalEnv('CONCEPT_IMAGE_MAX_COUNT', '2'), 10),
  },
};