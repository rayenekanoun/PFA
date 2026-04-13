import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  MQTT_SERVERS: z.string().default('localhost:1883,localhost:2883,localhost:3883'),
  MQTT_CLIENT_ID: z.string().default('diagnostic-backend'),
  MQTT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SUPPORTED_PID_STALE_HOURS: z.coerce.number().int().positive().default(24),
  SWAGGER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== 'false'),
  DEV_DISABLE_OWNERSHIP_FILTER: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['stub', 'openai-compatible', 'gemini', 'vertex']).default('stub'),
  AI_ALLOW_STUB_FALLBACK: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4.1-mini'),
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().default('us-central1'),
  VERTEX_MODEL: z.string().default('gemini-2.5-flash'),
  VERTEX_SERVICE_ACCOUNT_JSON: z.string().optional(),
  VERTEX_SERVICE_ACCOUNT_PATH: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return envSchema.parse(config);
}
