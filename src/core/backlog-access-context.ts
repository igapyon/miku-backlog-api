import { AsyncLocalStorage } from "node:async_hooks";
import type { BacklogRateLimitMetadata } from "./contracts.js";

export interface BacklogResponseMetadata {
  httpStatus?: number;
  rateLimit?: BacklogRateLimitMetadata;
}

interface BacklogAccessContext {
  response?: BacklogResponseMetadata;
}

const accessContext = new AsyncLocalStorage<BacklogAccessContext>();

export function createBacklogAccessContext(): BacklogAccessContext {
  return {};
}

export function runWithBacklogAccessContext<T>(
  context: BacklogAccessContext,
  callback: () => Promise<T>
): Promise<T> {
  return accessContext.run(context, callback);
}

export function capturedBacklogResponse(
  context: BacklogAccessContext
): BacklogResponseMetadata | undefined {
  return context.response;
}

export function createBacklogCapturingFetch(
  baseFetch: typeof globalThis.fetch = globalThis.fetch
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const context = accessContext.getStore();
    if (context !== undefined) {
      context.response = extractBacklogResponseMetadata(response);
    }
    return response;
  };
}

export function extractBacklogResponseMetadata(
  response: Pick<Response, "status" | "headers">
): BacklogResponseMetadata {
  const limit = nonNegativeInteger(response.headers.get("X-RateLimit-Limit"));
  const remaining = nonNegativeInteger(response.headers.get("X-RateLimit-Remaining"));
  const resetAt = resetDate(response.headers.get("X-RateLimit-Reset"));
  const rateLimit = compactRateLimit({
    ...(limit === undefined ? {} : { limit }),
    ...(remaining === undefined ? {} : { remaining }),
    ...(resetAt === undefined ? {} : { resetAt })
  });
  return {
    ...(httpStatus(response.status) === undefined ? {} : { httpStatus: response.status }),
    ...(rateLimit === undefined ? {} : { rateLimit })
  };
}

function compactRateLimit(
  metadata: BacklogRateLimitMetadata
): BacklogRateLimitMetadata | undefined {
  return Object.values(metadata).some((value) => value !== undefined)
    ? metadata
    : undefined;
}

function nonNegativeInteger(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function resetDate(value: string | null): string | undefined {
  const seconds = nonNegativeInteger(value);
  if (seconds === undefined) {
    return undefined;
  }
  const milliseconds = seconds * 1000;
  if (!Number.isFinite(milliseconds)) {
    return undefined;
  }
  try {
    return new Date(milliseconds).toISOString();
  } catch {
    return undefined;
  }
}

function httpStatus(value: number): number | undefined {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined;
}
