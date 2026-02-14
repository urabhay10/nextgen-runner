'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Player } from '@/types';

interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const PlayerInput = ({ value, onChange, placeholder, className }: PlayerInputProps) => {
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [show, setShow] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    if (text.length >= 1) {
      fetch(`https://hewhocodes247-cricket-transformer-api.hf.space/players/search?q=${text}`)
        .then(res => res.json())
        .then(data => {
          setSuggestions(data);
          setShow(true);
          setSelectedIndex(-1);
        })
        .catch(err => console.error(err));
    } else {
      setSuggestions([]);
      setShow(false);
    }
  };

  const handleSelect = (player: Player) => {
    if (!player) return;
    onChange(player.name);
    setShow(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!show || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setShow(false);
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        className={className || "w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-emerald-500 focus:outline-none transition-colors text-white"}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShow(false), 200)}
      />
      {show && suggestions.length > 0 && (
        <ul ref={listRef} className="absolute z-50 w-full bg-slate-800 border border-slate-700 mt-1 rounded max-h-48 overflow-y-auto shadow-xl scrollbar-hide">
          {suggestions.map((s, i) => (
            <li key={i}
              className={`p-2 hover:bg-slate-700 cursor-pointer text-sm border-b border-slate-700/50 flex justify-between transition-colors ${i === selectedIndex ? 'suggestion-active bg-slate-700' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => handleSelect(s)}>
              <span className="text-white">{s.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded h-fit ${s.role === 'Bowler' ? 'bg-rose-900/50 text-rose-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                {s.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerInput;
