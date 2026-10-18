// Thin helpers around sn-plugin-lib's loosely typed APIResponse objects.
import {log, fmt} from './log';

export interface APIResponse<T> {
  success: boolean;
  result?: T;
  error?: {code: number; message: string};
}

export class SdkError extends Error {
  constructor(public readonly api: string, public readonly code: number | undefined, message: string) {
    super(`${api} failed${code !== undefined ? ` (${code})` : ''}: ${message}`);
  }
}

/** Await an SDK call, log the raw response, and unwrap `result` or throw. */
export async function call<T>(api: string, pending: Promise<unknown>): Promise<T> {
  const res = (await pending) as APIResponse<T> | null | undefined;
  log(`${api} → ${fmt(res)}`);
  if (!res || !res.success) {
    throw new SdkError(api, res?.error?.code, res?.error?.message ?? 'no response');
  }
  return res.result as T;
}

export const FILE_READ = 'plugin.permission.FILE:READ';
export const FILE_WRITE = 'plugin.permission.FILE:WRITE';
