import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
  NEXT_PUBLIC_ENABLE_SYSTEM_STATUS: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Validates browser-visible configuration. NEXT_PUBLIC_* variables must be referenced
 * literally so Next.js can inline them into the client bundle.
 */
export function parsePublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_SYSTEM_STATUS: process.env.NEXT_PUBLIC_ENABLE_SYSTEM_STATUS,
  },
): PublicEnv {
  const defined = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = publicEnvSchema.safeParse(defined);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid frontend environment configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return result.data;
}

export function isSystemStatusEnabled(env: PublicEnv = parsePublicEnv()): boolean {
  return process.env.NODE_ENV !== 'production' || env.NEXT_PUBLIC_ENABLE_SYSTEM_STATUS;
}
