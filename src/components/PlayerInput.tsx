'use client';

import { useState, useRef, KeyboardEvent, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { Player } from '@/types';
import { getApiUrl } from '@/lib/api';

interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPlayer?: (name: string, id?: string | number) => void;
  onBulkPaste?: (values: string[]) => void;
  placeholder?: string;
  index?: number;
}

const PlayerInput = ({ value, onChange, onSelectPlayer, onBulkPaste, placeholder, index }: PlayerInputProps) => {
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [show, setShow] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mouseInListRef = useRef(false);

  // Derive can_bowl from either new or legacy backend shape
  const canBowl = (p: Player) => {
    if (p.can_bowl !== undefined) return p.can_bowl;
    return p.role?.toLowerCase().includes('bowl') ?? false;
  };

  const fetchSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) { setSuggestions([]); setShow(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(getApiUrl(`/players/search?q=${encodeURIComponent(text)}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('Search failed');
        const data: Player[] = await res.json();
        setSuggestions(data);
        setShow(data.length > 0);
        setSelectedIndex(-1);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 180);
  }, []);

  const autoMatch = useCallback(async (name: string): Promise<string> => {
    if (!name.trim()) return '';
    try {
      const res = await fetch(getApiUrl(`/players/search?q=${encodeURIComponent(name.trim())}`), { cache: 'no-store' });
      if (!res.ok) return '';
      const data: Player[] = await res.json();
      return data.length > 0 ? data[0].name : '';
    } catch { return ''; }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    fetchSuggestions(text);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const lines = pasted.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && onBulkPaste) {
      e.preventDefault();
      inputRef.current?.blur();
      const matched = await Promise.all(lines.map(autoMatch));
      onBulkPaste(matched);
    }
  };

  const handleSelect = (player: Player) => {
    onChange(player.name);
    onSelectPlayer?.(player.name, player.id);
    setShow(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!show || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) handleSelect(suggestions[selectedIndex]);
      else if (suggestions.length > 0) handleSelect(suggestions[0]);
    } else if (e.key === 'Tab') {
      if (suggestions.length > 0) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex >= 0 ? selectedIndex : 0]);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  const num = index !== undefined ? index + 1 : undefined;

  return (
    <div className="relative w-full">
      <div className={`flex items-center border transition-all duration-150 ${show ? 'border-[rgba(var(--sage-green-rgb),0.6)] bg-[rgba(var(--surface-rgb),0.8)]' : 'border-[rgba(var(--border-rgb),0.5)] bg-[rgba(var(--background-rgb),0.5)] hover:border-[var(--border)]'} rounded-lg overflow-hidden`}>
        {num !== undefined && (
          <span className="flex-shrink-0 w-7 text-center text-[10px] font-black text-[var(--muted)] border-r border-[rgba(var(--border-rgb),0.5)] py-2.5 select-none">
            {num}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none font-mono"
          placeholder={placeholder || 'Player name...'}
          value={value}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (value.length >= 1 && suggestions.length > 0) setShow(true); }}
          onBlur={() => { if (!mouseInListRef.current) setShow(false); }}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="flex-shrink-0 pr-3">
            <span className="block w-2.5 h-2.5 border-2 border-[rgba(var(--sage-green-rgb),0.3)] border-t-[var(--sage-green)] rounded-full animate-spin" />
          </span>
        )}
      </div>

      {show && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl shadow-black/70 border border-[rgba(var(--border-rgb),0.7)]"
          onMouseEnter={() => { mouseInListRef.current = true; }}
          onMouseLeave={() => { mouseInListRef.current = false; }}
        >
          <div className="h-px bg-gradient-to-r from-[var(--sage-green)] via-[var(--sandy-brown)] to-[var(--dry-sage)]" />
          <ul className="max-h-52 overflow-y-auto" style={{ background: 'var(--surface)' }}>
            {suggestions.map((s, i) => (
              <li
                key={String(s.id)}
                className={`flex items-center px-3 py-2 cursor-pointer border-b border-[rgba(var(--border-rgb),0.6)] last:border-0 transition-colors ${i === selectedIndex ? 'bg-[var(--border)]' : 'hover:bg-[rgba(var(--border-rgb),0.5)]'}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {/* Name + match count inline */}
                <span className="flex-1 text-sm text-[var(--foreground)] font-mono truncate">
                  {s.name}
                  {s.matches != null && (
                    <span className="text-[var(--muted)] text-[11px] ml-2">{s.matches}</span>
                  )}
                </span>
                {/* Bowl tag only if can bowl */}
                {canBowl(s) && (
                  <span className="mx-2 flex-shrink-0 text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-[rgba(var(--sandy-brown-rgb),0.1)] text-[var(--sandy-brown)] border border-[rgba(var(--sandy-brown-rgb),0.2)] uppercase">
                    Bowl
                  </span>
                )}
                {/* Stats link */}
                <a
                  href={s.id != null ? `/player/${s.id}` : `/player/search?name=${encodeURIComponent(s.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 p-1 rounded text-[var(--muted)] hover:text-[var(--sage-green)] transition-colors"
                  title="View stats"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PlayerInput;
