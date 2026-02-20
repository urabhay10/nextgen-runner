'use client';

import { useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface PlayerLinkProps {
  name: string;
  id?: string | number;  // if known, links directly to /player/{id}; otherwise searches by name
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps any player name with a hover tooltip linking to /player/[id].
 */
export default function PlayerLink({ name, id, children, className }: PlayerLinkProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setShow(true); };
  const close = () => { timeoutRef.current = setTimeout(() => setShow(false), 120); };

  const href = id != null ? `/player/${id}` : null;

  return (
    <span className={`relative inline-block ${className ?? ''}`} onMouseEnter={open} onMouseLeave={close}>
      {children}
      {show && href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={open}
          onMouseLeave={close}
          onClick={e => e.stopPropagation()}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap
                     flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                     bg-slate-800 border border-slate-600 shadow-xl shadow-black/60
                     text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
        >
          Stats <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </span>
  );
}
