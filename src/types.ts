export interface RetryInfo {
  /** 1-based number of the attempt that just failed. */
  attempt: number;
  /** Delay in milliseconds before the next attempt. */
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  /** Retries after the first attempt. Default 3. */
  retries?: number;
  /** Delay before the first retry. Default 100. */
  minDelayMs?: number;
  /** Upper bound for any single delay. Default 5000. */
  maxDelayMs?: number;
  /** Exponential growth factor. Default 2. */
  factor?: number;
  /** Apply full jitter to each delay. Default true. */
  jitter?: boolean;
  /** Cancels waiting and prevents further attempts. */
  signal?: AbortSignal;
  /** Return false to rethrow the original error immediately. Default retries everything. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Logging hook invoked before each wait. Exceptions thrown here are ignored. */
  onRetry?: (info: RetryInfo) => void;
}
