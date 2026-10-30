"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "./api";

/** A successful write already supplies the cache, so navigating never repeats it. */
export function useCachedApi<T, R = T>(path: string, value: T | undefined, setValue: Dispatch<SetStateAction<T | undefined>>, version: number, enabled = true, select?: (response: R) => T) {
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const key = `${version}:${attempt}`;
  const error = failure?.key === key ? failure.message : null;
  useEffect(() => {
    if (!enabled || value !== undefined) return;
    const controller = new AbortController();
    api<R>(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setValue(select ? select(result) : result as unknown as T); setFailure(null); }
    }).catch(caught => {
      if (!controller.signal.aborted) setFailure({ key, message: caught instanceof Error ? caught.message : "Could not load this workspace." });
    });
    return () => controller.abort();
  }, [path, enabled, value, setValue, key, select]);
  return { loading: enabled && value === undefined && !error, error, retry: () => setAttempt(current => current + 1) };
}
