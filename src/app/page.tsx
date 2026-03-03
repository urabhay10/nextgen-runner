'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import duelIcon    from '@/images/duel_icon.png';
import simIcon     from '@/images/sim_icon_3.png';
import ballPred    from '@/images/ball_pred.png';
import modelComp   from '@/images/model_comp.png';
import playerStats from '@/images/player_stats.png';

const CARD_W_DESKTOP = 320;
const GAP    = 24;

const CARDS = [
	{
		href: '/duel',
		img: duelIcon,
		tag: '01',
		title: '1v1 Duel',
		subtitle: 'Draft a team, set your order, and battle a friend in a live T20.',
		cta: 'Start a Duel',
	},
	{
		href: '/simulate',
		img: simIcon,
		tag: '02',
		title: 'Series Simulator',
		subtitle: 'Ball-by-ball T20I simulation engine with live scorecards.',
		cta: 'Launch Simulator',
	},
	{
		href: '/predict',
		img: ballPred,
		tag: '03',
		title: 'AI Ball Predictor',
		subtitle: 'Probability distribution for every ball outcome in any situation.',
		cta: 'Open Predictor',
	},
	{
		href: '/compare',
		img: modelComp,
		tag: '04',
		title: 'Model Comparison',
		subtitle: 'Parallel simulations across all AI models to compare strategies.',
		cta: 'Compare Models',
	},
	{
		href: '/players',
		img: playerStats,
		tag: '05',
		title: 'Player Stats',
		subtitle: 'Leaderboards, player search, and full career stat breakdowns.',
		cta: 'Explore Players',
	},
];

const N = CARDS.length; // 5

// Resolve card from any integer position (wraps around)
function cardAt(pos: number) {
	return CARDS[((pos % N) + N) % N];
}

export default function Home() {
	// `center` is an unbounded integer — no wrapping, ever.
	const [center, setCenter] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const startXRef = useRef(0);
	const router = useRouter();

	// Responsive card width: full-ish on mobile, fixed on desktop
	const [cardW, setCardW] = useState(CARD_W_DESKTOP);
	const [stepW, setStepW] = useState(CARD_W_DESKTOP + GAP);
	useEffect(() => {
		const update = () => {
			const vw = window.innerWidth;
			// On small screens use viewport width minus arrow buttons (40px each + margins)
			// Subtract a bit extra so the 1.04 scale on the active card never clips against overflow
			const w = vw < 560 ? Math.min(vw - 104, CARD_W_DESKTOP) : CARD_W_DESKTOP;
			setCardW(w);
			setStepW(w + GAP);
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	const prev = useCallback(() => setCenter(c => c - 1), []);
	const next = useCallback(() => setCenter(c => c + 1), []);

	// Mirror center into a ref so the key handler always reads the latest value
	// without needing `center` in the effect deps (which would change the array size
	// on hot-reload and trigger a React warning).
	const centerRef = useRef(center);
	centerRef.current = center;

	// Arrow key navigation — stable deps, reads center via ref
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
			else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
			else if (e.key === 'Enter') { e.preventDefault(); router.push(cardAt(centerRef.current).href); }
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [prev, next, router]);

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
			<div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-8 px-4 sm:px-6 w-full overflow-hidden">
				<p className="text-xs font-black uppercase tracking-[0.4em] mb-2 sm:mb-6" style={{ color: 'var(--palm-leaf)' }}>
					AI-Powered Cricket Engine
				</p>
				<h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter text-center leading-none mb-1 sm:mb-4 text-[var(--foreground)]">
					NEXTGEN<br />CRICKET
				</h1>
				<p className="text-center text-xs sm:text-sm max-w-md mb-4 sm:mb-10 md:mb-16" style={{ color: 'var(--muted)' }}>
					Transformer-based neural network simulation. Ball-by-ball T20I predictions and full match analytics.
				</p>

				{/* Carousel */}
				<div className="w-full max-w-[1200px] mx-auto relative">
					{/* Arrow: left */}
					<button
						onClick={prev}
						className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border z-20 transition hover:scale-110"
						style={{ background: 'var(--surface-2)', borderColor: 'var(--sage-green)', color: 'var(--sage-green)' }}
					>
						<ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
					</button>

					{/* Viewport — no overflow-hidden so active card's glow/border is fully visible */}
					<div
						className="mx-10 sm:mx-14 h-[310px] sm:h-[360px] md:h-[420px] relative cursor-grab active:cursor-grabbing"
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
							// On narrow screens hide ±1 cards entirely so they don't bleed out
							const isMobileHidden = Math.abs(offset) >= 1 && cardW < CARD_W_DESKTOP;
							const visible  = Math.abs(offset) <= 1 && !isMobileHidden;
							const hidden   = !visible; // fully hide via visibility so they can't affect layout/overflow
							const card     = cardAt(absPos);

							return (
								<Link
									key={absPos}
									href={isActive ? card.href : '#'}
									onClick={e => { if (!isActive) { e.preventDefault(); setCenter(absPos); } }}
									className="absolute rounded-2xl overflow-hidden flex flex-col select-none"
									style={{
										width: cardW,
										height: '88%',
										top: '50%',
										left: '50%',
										transform: `translate(calc(-50% + ${offset * stepW}px), -50%) scale(${isActive ? 1.04 : 0.91})`,
										transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, box-shadow 0.5s, border-color 0.5s',
										background: 'var(--surface)',
										border: `1px solid ${isActive ? 'var(--sandy-brown)' : visible ? 'rgba(var(--sage-green-rgb),0.4)' : 'var(--border)'}`,
										boxShadow: isActive ? '0 0 48px rgba(var(--sandy-brown-rgb),0.3), 0 8px 32px rgba(0,0,0,0.4)' : 'none',
										opacity: isActive ? 1 : visible ? 0.42 : 0,
										visibility: hidden ? 'hidden' : 'visible',
										pointerEvents: (isActive || visible) ? 'auto' : 'none',
										zIndex: isActive ? 10 : 5 - Math.abs(offset),
									}}
								>
									{/* Accent bar */}
									<div
										className="h-1.5 w-full flex-none"
										style={{ background: isActive ? 'linear-gradient(to right,var(--sandy-brown),transparent)' : 'linear-gradient(to right,var(--sage-green),transparent)' }}
									/>

									<div className="p-5 sm:p-8 flex flex-col gap-3 sm:gap-4 flex-1">
										{/* Number tag */}
										<span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--palm-leaf)' }}>
											{card.tag}
										</span>

										{/* Big icon */}
										<Image
											src={card.img}
											alt={card.title}
											width={100}
											height={100}
											className="object-contain sm:w-[120px] sm:h-[120px]"
											style={{ filter: isActive ? 'none' : 'grayscale(20%) opacity(0.75)' }}
										/>

										{/* Title + subtitle */}
										<div>
											<h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2 flex items-center gap-2 flex-wrap">
												{card.title}
												{card.href === '/duel' && (
													<span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded align-middle"
														style={{ background: 'rgba(245,166,91,0.15)', color: 'var(--sandy-brown)', border: '1px solid rgba(245,166,91,0.35)', verticalAlign: 'middle' }}>
														beta
													</span>
												)}
											</h2>
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
						className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border z-20 transition hover:scale-110"
						style={{ background: 'var(--surface-2)', borderColor: 'var(--sage-green)', color: 'var(--sage-green)' }}
					>
						<ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
					</button>
				</div>
			</div>
		</div>
	);
}
