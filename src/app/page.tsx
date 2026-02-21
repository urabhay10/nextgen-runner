'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Play, BrainCircuit, Settings2, Users, ChevronLeft, ChevronRight } from 'lucide-react';

const CARD_W = 320;
const GAP    = 24;
const STEP   = CARD_W + GAP; // 344px per slot

const CARDS = [
	{
		href: '/simulate',
		icon: Play,
		tag: '01',
		title: 'Series Simulator',
		subtitle: 'Ball-by-ball T20I simulation engine with live scorecards.',
		cta: 'Launch Simulator',
	},
	{
		href: '/predict',
		icon: BrainCircuit,
		tag: '02',
		title: 'AI Ball Predictor',
		subtitle: 'Probability distribution for every ball outcome in any situation.',
		cta: 'Open Predictor',
	},
	{
		href: '/compare',
		icon: Settings2,
		tag: '03',
		title: 'Model Comparison',
		subtitle: 'Parallel simulations across all AI models to compare strategies.',
		cta: 'Compare Models',
	},
	{
		href: '/players',
		icon: Users,
		tag: '04',
		title: 'Player Stats',
		subtitle: 'Leaderboards, player search, and full career stat breakdowns.',
		cta: 'Explore Players',
	},
];

const N = CARDS.length; // 4

// Resolve card from any integer position (wraps around)
function cardAt(pos: number) {
	return CARDS[((pos % N) + N) % N];
}

export default function Home() {
	// `center` is an unbounded integer — no wrapping, ever.
	// This means each card DOM node is always at a stable absolute position,
	// so CSS transitions fire correctly on every navigation including entries.
	const [center, setCenter] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const startXRef = useRef(0);

	const prev = useCallback(() => setCenter(c => c - 1), []);
	const next = useCallback(() => setCenter(c => c + 1), []);

	const wheelCooldown = useRef(false);
	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		if (wheelCooldown.current) return;
		wheelCooldown.current = true;
		if (e.deltaY > 0 || e.deltaX > 0) next(); else prev();
		setTimeout(() => { wheelCooldown.current = false; }, 500);
	}, [next, prev]);

	const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
		setIsDragging(true);
		startXRef.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
	};
	const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
		if (!isDragging) return;
		setIsDragging(false);
		const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
		const diff = startXRef.current - endX;
		if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
	};

	// Render a window of 5 absolute positions: center-2 … center+2.
	// Key = absolute position → DOM node persists as window shifts.
	// When clicking next (center+1), the node at center+2 had offset=+2,
	// now gets offset=+1 → its transform transitions naturally from right. ✓
	const slots = Array.from({ length: 5 }, (_, i) => center - 2 + i);

	return (
		<div
			className="h-screen flex flex-col overflow-hidden"
			style={{ background: 'var(--background)', color: 'var(--foreground)' }}
		>
			<div className="flex-1 flex flex-col items-center justify-center px-6 py-8 w-full overflow-hidden">
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

					{/* Viewport */}
					<div
						className="mx-14 h-[400px] relative overflow-hidden cursor-grab active:cursor-grabbing"
						onTouchStart={handleDragStart}
						onTouchEnd={handleDragEnd}
						onMouseDown={handleDragStart}
						onMouseUp={handleDragEnd}
						onMouseLeave={handleDragEnd}
						onWheel={handleWheel}
					>
						{slots.map(absPos => {
							const offset   = absPos - center;   // -2, -1, 0, +1, +2
							const isActive = offset === 0;
							const visible  = Math.abs(offset) <= 1;
							const card     = cardAt(absPos);
							const Icon     = card.icon;

							return (
								<Link
									key={absPos}
									href={isActive ? card.href : '#'}
									onClick={e => { if (!isActive) { e.preventDefault(); setCenter(absPos); } }}
									className="absolute rounded-2xl overflow-hidden flex flex-col select-none"
									style={{
										width: CARD_W,
										height: '88%',
										top: '50%',
										left: '50%',
										// All movement — including entries — uses the same smooth transition.
										// Because keys are stable absolute positions, the browser always has
										// a previous transform to animate FROM, so entries slide in naturally.
										transform: `translate(calc(-50% + ${offset * STEP}px), -50%) scale(${isActive ? 1.04 : 0.91})`,
										transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, box-shadow 0.5s, border-color 0.5s',
										background: 'var(--surface)',
										border: `1px solid ${isActive ? 'var(--sandy-brown)' : visible ? 'rgba(var(--sage-green-rgb),0.4)' : 'var(--border)'}`,
										boxShadow: isActive ? '0 0 48px rgba(var(--sandy-brown-rgb),0.3), 0 8px 32px rgba(0,0,0,0.4)' : 'none',
										opacity: isActive ? 1 : visible ? 0.42 : 0,
										pointerEvents: visible ? 'auto' : 'none',
										zIndex: isActive ? 10 : 5 - Math.abs(offset),
									}}
								>
									{/* Accent bar */}
									<div
										className="h-1.5 w-full flex-none"
										style={{ background: isActive ? 'linear-gradient(to right,var(--sandy-brown),transparent)' : 'linear-gradient(to right,var(--sage-green),transparent)' }}
									/>

									<div className="p-8 flex flex-col gap-5 flex-1">
										<div className="flex items-start justify-between">
											<span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--palm-leaf)' }}>
												{card.tag}
											</span>
											<div
												className="w-12 h-12 rounded-xl flex items-center justify-center"
												style={isActive
													? { background: 'rgba(var(--sandy-brown-rgb),0.15)', border: '1px solid rgba(var(--sandy-brown-rgb),0.4)' }
													: { background: 'rgba(var(--sage-green-rgb),0.1)',   border: '1px solid rgba(var(--sage-green-rgb),0.25)' }
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
