// src/lib/api.ts

import { Model, BattingOrderItem } from '@/types';

// Use Next.js environment storage or fallback
const API_Base = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';

export async function fetchModels(): Promise<Model[]> {
  try {
    const res = await fetch(`${API_Base}/models`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch models');

    const data = await res.json();

    // New API shape: { default, models: [{filename, display_name}] }
    if (data && Array.isArray(data.models) && data.models[0]?.filename) {
      return data.models.map((m: { filename: string; display_name: string }) => ({
        id: m.filename,
        name: m.display_name,
        version: '1.0',
        description: 'AI Model',
      }));
    }

    // Legacy fallback: models was a plain string[]
    if (data && Array.isArray(data.models)) {
      return (data.models as string[]).map((filename: string) => {
        const match = filename.match(/^model_\d+_(.+)\.h5$/);
        return {
          id: filename,
          name: match ? match[1].replace(/_/g, ' ') : filename.replace('.h5', '').replace(/_/g, ' '),
          version: '1.0',
          description: 'AI Model',
        };
      });
    }

    return [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export async function generateBattingOrder(players: string[]): Promise<BattingOrderItem[]> {
  const res = await fetch(`${API_Base}/generate_batting_order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players }),
  });
  if (!res.ok) throw new Error('Failed to generate batting order');
  const data = await res.json();
  return data.batting_order as BattingOrderItem[];
}

export function getApiUrl(path: string): string {
  // Ensure path starts with / but API_Base doesn't end with /
  const baseUrl = API_Base.endsWith('/') ? API_Base.slice(0, -1) : API_Base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
