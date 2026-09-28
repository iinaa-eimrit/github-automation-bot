import { log } from "@/lib/logger";

export interface RetryOptions {
  maxAttempts: number;
  isRetryable: (err: unknown) => boolean;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let attempt = 0;
  while (attempt < opts.maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (!opts.isRetryable(error) || attempt >= opts.maxAttempts) {
        throw error;
      }

      const delayMs = 300 * 3 ** (attempt - 1);
      log("warn", "Retrying failed downstream action", {
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: opts.maxAttempts,
        delayMs,
        error: messageFor(error),
      });
      await wait(delayMs);
    }
  }

  throw new Error("Retry operation ended without a result.");
}
