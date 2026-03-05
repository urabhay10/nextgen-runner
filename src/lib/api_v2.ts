// src/lib/api_v2.ts
// All API calls for the v2 higher-context model (endpoints under /v2/)

import { Model, BattingOrderItem } from '@/types';

const API_Base = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';

function v2Url(path: string): string {
  const base = API_Base.endsWith('/') ? API_Base.slice(0, -1) : API_Base;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}/v2${clean}`;
}

export function getV2ApiUrl(path: string): string {
  return v2Url(path);
}

export async function fetchV2Models(): Promise<Model[]> {
  try {
    const res = await fetch(v2Url('/models'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch v2 models');
    const data = await res.json();

    if (data && Array.isArray(data.models) && data.models[0]?.filename) {
      return data.models.map((m: { filename: string; display_name: string }) => ({
        id: m.filename,
        name: m.display_name,
        version: '2.0',
        description: 'v2 Higher-Context AI Model',
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching v2 models:', error);
    return [];
  }
}

export async function fetchV2Venues(query: string = ''): Promise<{ name: string; id: number }[]> {
  try {
    const url = v2Url(`/venues${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch venues');
    return await res.json();
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
}

export async function resolveV2Venue(name: string): Promise<{ resolved_id: number; resolved_name: string }> {
  const res = await fetch(v2Url('/venues/resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to resolve venue');
  return res.json();
}

export async function generateV2BattingOrder(players: string[]): Promise<BattingOrderItem[]> {
  const res = await fetch(v2Url('/generate_batting_order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players }),
  });
  if (!res.ok) throw new Error('Failed to generate batting order');
  const data = await res.json();
  return data.batting_order as BattingOrderItem[];
}
