// src/lib/api.ts

import { Model } from '@/types';

// Use Next.js environment storage or fallback
const API_Base = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';

export async function fetchModels(): Promise<Model[]> {
  try {
    const res = await fetch(`${API_Base}/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    
    // The API returns { default: string, models: string[] }
    // We need to transform this into Model[]
    const data = await res.json();
    
    // Check if data.models exists and is an array
    if (data && Array.isArray(data.models)) {
      return data.models.map((filename: string) => ({
        id: filename,
        name: filename.replace('.h5', '').replace(/_/g, ' '),
        version: '1.0',
        description: 'AI Model'
      }));
    }
    
    // Fallback if the API changes or returns something else
    return [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export function getApiUrl(path: string): string {
  // Ensure path starts with / but API_Base doesn't end with /
  const baseUrl = API_Base.endsWith('/') ? API_Base.slice(0, -1) : API_Base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
