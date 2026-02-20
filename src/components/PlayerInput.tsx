'use client';

import { useState, useRef, KeyboardEvent, useCallback } from 'react';
import { Player } from '@/types';
import { getApiUrl } from '@/lib/api';

interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  onBulkPaste?: (values: string[]) => void;
  placeholder?: string;
  index?: number;
}

const PlayerInput = ({ value, onChange, onBulkPaste, placeholder, index }: PlayerInputProps) => {
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [show, setShow] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mouseInListRef = useRef(false);

  const fetchSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) { setSuggestions([]); setShow(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(getApiUrl(`/players/search?q=${encodeURIComponent(text)}`));
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
      const res = await fetch(getApiUrl(`/players/search?q=${encodeURIComponent(name.trim())}`));
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
      // Auto-match all lines against backend in parallel
      const matched = await Promise.all(lines.map(autoMatch));
      onBulkPaste(matched);
    }
    // Single line paste: let it fall through naturally
  };

  const handleSelect = (player: Player) => {
    onChange(player.name);
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
      // Tab accepts first suggestion
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
    <div className="relative w-full group">
      {/* Input Row */}
      <div className={`flex items-center gap-0 border transition-all duration-200 ${show ? 'border-cyan-500/60 bg-slate-800/80' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'} rounded-lg overflow-hidden`}>
        {num !== undefined && (
          <span className="flex-shrink-0 w-8 text-center text-[10px] font-black text-slate-600 border-r border-slate-700/60 py-2.5 select-none bg-slate-900/40">
            {num}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none font-mono tracking-wide"
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
            <span className="block w-3 h-3 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
          </span>
        )}
      </div>

      {/* Dropdown */}
      {show && suggestions.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl shadow-black/60 border border-slate-700/80"
          onMouseEnter={() => { mouseInListRef.current = true; }}
          onMouseLeave={() => { mouseInListRef.current = false; }}
        >
          {/* Geometric top accent */}
          <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
          <ul className="bg-slate-900 max-h-56 overflow-y-auto scrollbar-hide">
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-slate-800/80 last:border-0 transition-colors ${i === selectedIndex ? 'bg-slate-700/80' : 'hover:bg-slate-800/60'}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {/* Order number */}
                <span className="text-[10px] font-black text-slate-600 w-4 text-center flex-shrink-0">{i + 1}</span>
                {/* Name */}
                <span className="flex-1 text-sm text-white font-mono tracking-wide truncate">{s.name}</span>
                {/* Stats */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.matches != null && (
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">{s.matches}m</span>
                  )}
                  {s.can_bowl && (
                    <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 uppercase">
                      Bowl
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="px-3 py-1 bg-slate-900/90 border-t border-slate-800 flex justify-between items-center">
            <span className="text-[9px] text-slate-600 font-mono">↑↓ navigate · Enter/Tab select · Esc close</span>
            <span className="text-[9px] text-slate-600 font-mono">{suggestions.length} results</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerInput;
