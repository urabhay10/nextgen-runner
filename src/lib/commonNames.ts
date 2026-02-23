/**
 * lib/commonNames.ts
 * ──────────────────
 * Bulk-fetch common/display names for a list of engine (pool) names.
 *
 * Usage:
 *   const cn = useCommonNames(pool.map(p => p.name));
 *   cn.get("RG Sharma")   // → "Rohit Sharma"
 *   cn.get("unknownName") // → undefined (fall back to original)
 *
 * Rule: NEVER pass values from the returned map back to the server.
 *       They are display-only.
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from './api';

/** Async helper: fetch common names for the given engine name list. */
export async function fetchCommonNames(names: string[]): Promise<Map<string, string>> {
  if (!names.length) return new Map();
  try {
    const res = await fetch(getApiUrl('/common_names'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
      cache: 'no-store',
    });
    if (!res.ok) return new Map();
    const data: Record<string, string> = await res.json();
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

/**
 * React hook that returns a stable Map<engineName → displayName>.
 * Re-fetches only when the sorted, joined list of names changes.
 */
export function useCommonNames(names: string[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  // Build a stable cache key from the sorted name list
  const key = [...names].sort().join('|');

  useEffect(() => {
    if (!names.length) return;
    fetchCommonNames(names).then(setMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}

/** Convenience: resolve a single name to its display name. */
export function dn(engineName: string, map: Map<string, string>): string {
  return map.get(engineName) ?? engineName;
}
