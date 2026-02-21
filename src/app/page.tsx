'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Play, BrainCircuit, Settings2, Users, ChevronLeft, ChevronRight } from 'lucide-react';

const CARD_W = 320;
const GAP    = 24;
const STEP   = CARD_W + GAP; // 344

const CARDS = [
	{
		href: '/simulate',
		icon: Play,
		tag: '01',
		title: 'Series Simulator',
		subtitle: 'Ball-by-ball T20I simulation engine with live scorecards.',
		cta: 'Launch Simulator',
		accent: 'var(--sage-green)',
		accentRgb: 'var(--sage-green-rgb)',
		glow: 'rgba(var(--sage-green-rgb), 0.25)',
		bar: 'from-[var(--sage-green)] to-[var(--muted-olive)]',
	},
	{
		href: '/predict',
		icon: BrainCircuit,
		tag: '02',
		title: 'AI Ball Predictor',
		subtitle: 'Probability distribution for every ball outcome in any situation.',
		cta: 'Open Predictor',
		accent: 'var(--sandy-brown)',
		accentRgb: 'var(--sandy-brown-rgb)',
		glow: 'rgba(var(--sandy-brown-rgb), 0.25)',
		bar: 'from-[var(--sandy-brown)] to-[var(--dry-sage)]',
	},
	{
		href: '/compare',
		icon: Settings2,
		tag: '03',
		title: 'Model Comparison',
		subtitle: 'Parallel simulations across all AI models to compare strategies.',
		cta: 'Compare Models',
		accent: 'var(--dry-sage)',
		accentRgb: 'var(--dry-sage-rgb)',
		glow: 'rgba(var(--dry-sage-rgb), 0.25)',
		bar: 'from-[var(--dry-sage)] to-[var(--palm-leaf)]',
	},
	{
		href: '/players',
		icon: Users,
		tag: '04',
		title: 'Player Stats',
		subtitle: 'Leaderboards, player search, and full career stat breakdowns.',
		cta: 'Explore Players',
		accent: 'var(--palm-leaf)',
		accentRgb: 'var(--palm-leaf-rgb)',
		glow: 'rgba(var(--palm-leaf-rgb), 0.25)',
		bar: 'from-[var(--palm-leaf)] to-[var(--sage-green)]',
	},
];

export default function Home() {
	const [active, setActive] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [startX, setStartX] = useState(0);

	const prev = () => setActive((i) => (i > 0 ? i - 1 : CARDS.length - 1));
	const next = () => setActive((i) => (i < CARDS.length - 1 ? i + 1 : 0));

	// Track previous active to detect wrapping jumps and disable transition for them
	const prevActiveRef = useRef(active);
	useEffect(() => { prevActiveRef.current = active; }, [active]);

	// Throttle wheel events so one scroll tick = one card
	const wheelCooldown = useRef(false);
	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		if (wheelCooldown.current) return;
		wheelCooldown.current = true;
		if (e.deltaY > 0 || e.deltaX > 0) next(); else prev();
		setTimeout(() => { wheelCooldown.current = false; }, 500);
	}, []);

	const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
		setIsDragging(true);
		setStartX('touches' in e ? e.touches[0].clientX : e.clientX);
	};

	const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
		if (!isDragging) return;
		setIsDragging(false);
		const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
		const diff = startX - endX;
		if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
	};

	return (
		<div
			className="h-screen flex flex-col overflow-hidden"
			style={{ background: 'var(--background)', color: 'var(--foreground)' }}
		>
			{/* Hero */}
			<div className="flex-1 flex flex-col items-center justify-center px-6 py-8 w-full overflow-hidden">
				{/* Label */}
				<p className="text-xs font-black uppercase tracking-[0.4em] mb-6" style={{ color: 'var(--palm-leaf)' }}>
					AI-Powered Cricket Engine
				</p>

				<h1 className="text-5xl md:text-7xl font-black tracking-tighter text-center leading-none mb-4 text-[var(--foreground)]">
					NEXTGEN<br />CRICKET
				</h1>
				<p className="text-center text-sm max-w-md mb-16" style={{ color: 'var(--muted)' }}>
					Transformer-based neural network simulation. Ball-by-ball T20I predictions and full match analytics.
				</p>

				{/* Carousel */}
				<div className="w-full max-w-[1200px] mx-auto relative">
					{/* Arrow: left */}
					<button
						onClick={prev}
						className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border z-20 transition hover:scale-110"
						style={{ background: 'var(--surface-2)', borderColor: 'var(--sage-green)', color: 'var(--sage-green)' }}
					>
						<ChevronLeft className="w-5 h-5" />
					</button>

					{/* Card viewport — cards are absolutely positioned relative to center */}
					<div
						className="mx-14 h-[400px] relative overflow-hidden cursor-grab active:cursor-grabbing"
						onTouchStart={handleDragStart}
						onTouchEnd={handleDragEnd}
						onMouseDown={handleDragStart}
						onMouseUp={handleDragEnd}
						onMouseLeave={handleDragEnd}
						onWheel={handleWheel}
					>
						{CARDS.map((card, i) => {
							const Icon = card.icon;
							const isActive = i === active;
							// Wrap offset so the carousel loops (e.g. card 3 appears to the left of card 0)
							let offset = i - active;
							const half = Math.floor(CARDS.length / 2);
							if (offset > half) offset -= CARDS.length;
							else if (offset < -half) offset += CARDS.length;
							const visible = Math.abs(offset) <= 1;

							// Compute previous offset to detect wrapping jumps.
							// If a card moves more than 1 step (e.g. wraps from +2 to -1),
							// disable the CSS transition so it snaps silently.
							let prevOffset = i - prevActiveRef.current;
							if (prevOffset > half) prevOffset -= CARDS.length;
							else if (prevOffset < -half) prevOffset += CARDS.length;
							const isJumping = Math.abs(offset - prevOffset) > 1;
							const cardTransition = isJumping
								? 'none'
								: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s, box-shadow 0.5s, border-color 0.5s';
							return (
								<Link
									key={card.href}
									href={isActive ? card.href : '#'}
									onClick={e => { if (!isActive) { e.preventDefault(); setActive(i); } }}
									className="absolute rounded-2xl overflow-hidden flex flex-col select-none"
									style={{
										width: CARD_W,
										height: '88%',
										top: '50%',
										left: '50%',
										transform: `translate(calc(-50% + ${offset * STEP}px), -50%) scale(${isActive ? 1.04 : 0.91})`,
										transition: cardTransition,
										background: 'var(--surface)',
										border: `1px solid ${isActive ? 'var(--sandy-brown)' : visible ? 'rgba(var(--sage-green-rgb), 0.4)' : 'var(--border)'}`,
										boxShadow: isActive ? `0 0 48px rgba(var(--sandy-brown-rgb), 0.3), 0 8px 32px rgba(0,0,0,0.4)` : 'none',
										opacity: isActive ? 1 : visible ? 0.42 : 0,
										pointerEvents: visible ? 'auto' : 'none',
										zIndex: isActive ? 10 : 5 - Math.abs(offset),
									}}
								>
									{/* Accent bar */}
									<div className="h-1.5 w-full flex-none" style={{ background: isActive ? `linear-gradient(to right, var(--sandy-brown), transparent)` : `linear-gradient(to right, var(--sage-green), transparent)` }} />

									<div className="p-8 flex flex-col gap-5 flex-1">
										<div className="flex items-start justify-between">
											<span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--palm-leaf)' }}>
												{card.tag}
											</span>
											<div
												className="w-12 h-12 rounded-xl flex items-center justify-center"
												style={isActive
													? { background: 'rgba(var(--sandy-brown-rgb), 0.15)', border: '1px solid rgba(var(--sandy-brown-rgb), 0.4)' }
													: { background: 'rgba(var(--sage-green-rgb), 0.1)', border: '1px solid rgba(var(--sage-green-rgb), 0.25)' }
												}
											>
												<Icon className="w-6 h-6" style={{ color: isActive ? 'var(--sandy-brown)' : 'var(--sage-green)' }} />
											</div>
										</div>

										<div>
											<h2 className="text-2xl font-black tracking-tight mb-2">{card.title}</h2>
											<p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{card.subtitle}</p>
										</div>

										<div
											className="flex items-center gap-2 text-xs font-black uppercase tracking-widest mt-auto"
											style={{ color: isActive ? 'var(--sandy-brown)' : 'var(--sage-green)' }}
										>
											{card.cta} <span>→</span>
										</div>
									</div>
								</Link>
							);
						})}
					</div>

					{/* Arrow: right */}
					<button
						onClick={next}
						className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border z-20 transition hover:scale-110"
						style={{ background: 'var(--surface-2)', borderColor: 'var(--sage-green)', color: 'var(--sage-green)' }}
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>
			</div>
		</div>
	);
}
