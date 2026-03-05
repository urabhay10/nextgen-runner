'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X, ChevronDown } from 'lucide-react';
import { fetchV2Venues } from '@/lib/api_v2';

interface Venue {
  name: string;
  id: number;
}

interface VenueSelectorProps {
  value: Venue | null;
  onChange: (venue: Venue | null) => void;
  placeholder?: string;
  className?: string;
}

export default function VenueSelector({ value, onChange, placeholder = 'Select venue (optional)', className = '' }: VenueSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadVenues = useCallback((q: string) => {
    setLoading(true);
    fetchV2Venues(q)
      .then(v => { setVenues(v); setHighlightedIndex(-1); })
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, []);

  // Load initial list on mount
  useEffect(() => { loadVenues(''); }, [loadVenues]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadVenues(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, loadVenues]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelectorAll<HTMLButtonElement>('[data-venue-item]')[highlightedIndex];
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleOpen = () => {
    setOpen(true);
    setHighlightedIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (v: Venue) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, venues.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlightedIndex >= 0 ? venues[highlightedIndex] : venues[0];
      if (target) handleSelect(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors overflow-hidden"
        style={{
          background: 'rgba(var(--sage-green-rgb), 0.06)',
          border: '1px solid rgba(var(--sage-green-rgb), 0.25)',
          color: 'var(--foreground)',
          minWidth: 0,
        }}
      >
        <MapPin size={14} style={{ color: 'var(--sage-green)', flexShrink: 0 }} />
        <span className="flex-1 text-left truncate min-w-0" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground, #888)' }}>
          {value ? value.name : placeholder}
        </span>
        {value ? (
          <X size={14} onClick={handleClear} style={{ color: 'var(--muted-foreground, #888)', flexShrink: 0 }} className="hover:text-red-400 transition-colors" />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--muted-foreground, #888)', flexShrink: 0 }} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ background: 'var(--card-bg, #1a1a1a)', border: '1px solid rgba(var(--sage-green-rgb), 0.25)', minWidth: '220px' }}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: '1px solid rgba(var(--sage-green-rgb), 0.15)' }}>
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Search size={13} style={{ color: 'var(--muted-foreground, #888)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search venues…  ↑↓ navigate · Enter select"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--foreground)' }}
              />
              {loading && (
                <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--sage-green)' }} />
              )}
            </div>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-60 overflow-y-auto">
            {venues.length === 0 && !loading && (
              <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--muted-foreground, #888)' }}>
                No venues found
              </div>
            )}
            {venues.map((v, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = value?.id === v.id;
              return (
                <button
                  key={v.id}
                  data-venue-item
                  type="button"
                  onClick={() => handleSelect(v)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                  style={{
                    background: isHighlighted ? 'rgba(var(--sage-green-rgb), 0.12)' : 'transparent',
                    color: isSelected ? 'var(--sage-green)' : 'var(--foreground)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <MapPin size={12} style={{ color: 'var(--sage-green)', opacity: 0.7, flexShrink: 0 }} />
                  <span className="truncate">{v.name}</span>
                  {isSelected && <span className="ml-auto text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
