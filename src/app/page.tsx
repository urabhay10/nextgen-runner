'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Settings2, Check } from 'lucide-react';
import duelIcon    from '@/images/duel_icon.png';
import simIcon     from '@/images/sim_icon_3.png';
import ballPred    from '@/images/ball_pred.png';
import modelComp   from '@/images/model_comp.png';
import playerStats from '@/images/player_stats.png';

const CARD_W_DESKTOP = 320;
const GAP = 24;

// ─── Theme cheat-code palettes ───────────────────────────────────────────────
type Palette = {
	name: string;
	vars: Record<string, string>;
};

const PALETTES: Palette[] = [
	{
		name: 'Ocean',
		vars: {
			'--background': '#0D1419', '--background-rgb': '13, 20, 25',
			'--surface':    '#121E26', '--surface-rgb':    '18, 30, 38',
			'--surface-2':  '#192A35', '--surface-2-rgb':  '25, 42, 53',
			'--border':     '#1F3A47', '--border-rgb':     '31, 58, 71',
			'--foreground': '#D8EDF5', '--foreground-rgb': '216, 237, 245',
			'--muted':      '#6A9EB5', '--muted-rgb':      '106, 158, 181',
			'--palm-leaf':      '#5B8FA8', '--palm-leaf-rgb':      '91, 143, 168',
			'--sage-green':     '#3EB8C8', '--sage-green-rgb':     '62, 184, 200',
			'--muted-olive':    '#5BC8B5', '--muted-olive-rgb':    '91, 200, 181',
			'--dry-sage':       '#A8D8E8', '--dry-sage-rgb':       '168, 216, 232',
			'--sandy-brown':    '#F5A040', '--sandy-brown-rgb':    '245, 160, 64',
		},
	},
	{
		name: 'Crimson',
		vars: {
			'--background': '#140D0D', '--background-rgb': '20, 13, 13',
			'--surface':    '#1E1212', '--surface-rgb':    '30, 18, 18',
			'--surface-2':  '#28191A', '--surface-2-rgb':  '40, 25, 26',
			'--border':     '#3A1E20', '--border-rgb':     '58, 30, 32',
			'--foreground': '#F5E0E0', '--foreground-rgb': '245, 224, 224',
			'--muted':      '#A07070', '--muted-rgb':      '160, 112, 112',
			'--palm-leaf':      '#A06060', '--palm-leaf-rgb':      '160, 96, 96',
			'--sage-green':     '#D44F4F', '--sage-green-rgb':     '212, 79, 79',
			'--muted-olive':    '#C07070', '--muted-olive-rgb':    '192, 112, 112',
			'--dry-sage':       '#E8A0A0', '--dry-sage-rgb':       '232, 160, 160',
			'--sandy-brown':    '#F0B440', '--sandy-brown-rgb':    '240, 180, 64',
		},
	},
	{
		name: 'Dusk',
		vars: {
			'--background': '#10101A', '--background-rgb': '16, 16, 26',
			'--surface':    '#161624', '--surface-rgb':    '22, 22, 36',
			'--surface-2':  '#1E1E30', '--surface-2-rgb':  '30, 30, 48',
			'--border':     '#2A2A45', '--border-rgb':     '42, 42, 69',
			'--foreground': '#E0E0F5', '--foreground-rgb': '224, 224, 245',
			'--muted':      '#7070A8', '--muted-rgb':      '112, 112, 168',
			'--palm-leaf':      '#7060A8', '--palm-leaf-rgb':      '112, 96, 168',
			'--sage-green':     '#9060D8', '--sage-green-rgb':     '144, 96, 216',
			'--muted-olive':    '#8070C0', '--muted-olive-rgb':    '128, 112, 192',
			'--dry-sage':       '#B0A0E8', '--dry-sage-rgb':       '176, 160, 232',
			'--sandy-brown':    '#F5A040', '--sandy-brown-rgb':    '245, 160, 64',
		},
	},
	{
		name: 'Midnight Gold',
		vars: {
			'--background': '#14120A', '--background-rgb': '20, 18, 10',
			'--surface':    '#1E1A0E', '--surface-rgb':    '30, 26, 14',
			'--surface-2':  '#28241A', '--surface-2-rgb':  '40, 36, 26',
			'--border':     '#403820', '--border-rgb':     '64, 56, 32',
			'--foreground': '#F5EDD0', '--foreground-rgb': '245, 237, 208',
			'--muted':      '#A08850', '--muted-rgb':      '160, 136, 80',
			'--palm-leaf':      '#908040', '--palm-leaf-rgb':      '144, 128, 64',
			'--sage-green':     '#D4A830', '--sage-green-rgb':     '212, 168, 48',
			'--muted-olive':    '#C0A060', '--muted-olive-rgb':    '192, 160, 96',
			'--dry-sage':       '#E8D080', '--dry-sage-rgb':       '232, 208, 128',
			'--sandy-brown':    '#F07830', '--sandy-brown-rgb':    '240, 120, 48',
		},
	},
	{
		name: 'Steel',
		vars: {
			'--background': '#0C0F14', '--background-rgb': '12, 15, 20',
			'--surface':    '#121620', '--surface-rgb':    '18, 22, 32',
			'--surface-2':  '#1A2030', '--surface-2-rgb':  '26, 32, 48',
			'--border':     '#20304A', '--border-rgb':     '32, 48, 74',
			'--foreground': '#D0DCF0', '--foreground-rgb': '208, 220, 240',
			'--muted':      '#5080A8', '--muted-rgb':      '80, 128, 168',
			'--palm-leaf':      '#4870A0', '--palm-leaf-rgb':      '72, 112, 160',
			'--sage-green':     '#2890D8', '--sage-green-rgb':     '40, 144, 216',
			'--muted-olive':    '#3898C0', '--muted-olive-rgb':    '56, 152, 192',
			'--dry-sage':       '#80C0E8', '--dry-sage-rgb':       '128, 192, 232',
			'--sandy-brown':    '#F04060', '--sandy-brown-rgb':    '240, 64, 96',
		},
	},
	{
		name: 'Emerald',
		vars: {
			'--background': '#081210', '--background-rgb': '8, 18, 16',
			'--surface':    '#0E1E1A', '--surface-rgb':    '14, 30, 26',
			'--surface-2':  '#142820', '--surface-2-rgb':  '20, 40, 32',
			'--border':     '#1C3A2E', '--border-rgb':     '28, 58, 46',
			'--foreground': '#C8F0E0', '--foreground-rgb': '200, 240, 224',
			'--muted':      '#48907A', '--muted-rgb':      '72, 144, 122',
			'--palm-leaf':      '#3A8068', '--palm-leaf-rgb':      '58, 128, 104',
			'--sage-green':     '#28C880', '--sage-green-rgb':     '40, 200, 128',
			'--muted-olive':    '#38B870', '--muted-olive-rgb':    '56, 184, 112',
			'--dry-sage':       '#78E0B0', '--dry-sage-rgb':       '120, 224, 176',
			'--sandy-brown':    '#F0C040', '--sandy-brown-rgb':    '240, 192, 64',
		},
	},
	{
		name: 'Neon',
		vars: {
			'--background': '#08080F', '--background-rgb': '8, 8, 15',
			'--surface':    '#0E0E1A', '--surface-rgb':    '14, 14, 26',
			'--surface-2':  '#141428', '--surface-2-rgb':  '20, 20, 40',
			'--border':     '#202040', '--border-rgb':     '32, 32, 64',
			'--foreground': '#E8E8FF', '--foreground-rgb': '232, 232, 255',
			'--muted':      '#6060A0', '--muted-rgb':      '96, 96, 160',
			'--palm-leaf':      '#5050A8', '--palm-leaf-rgb':      '80, 80, 168',
			'--sage-green':     '#00F0A0', '--sage-green-rgb':     '0, 240, 160',
			'--muted-olive':    '#00C0D8', '--muted-olive-rgb':    '0, 192, 216',
			'--dry-sage':       '#80F0D0', '--dry-sage-rgb':       '128, 240, 208',
			'--sandy-brown':    '#F000C0', '--sandy-brown-rgb':    '240, 0, 192',
		},
	},
	{
		name: 'Rust',
		vars: {
			'--background': '#14100A', '--background-rgb': '20, 16, 10',
			'--surface':    '#1E1610', '--surface-rgb':    '30, 22, 16',
			'--surface-2':  '#281E18', '--surface-2-rgb':  '40, 30, 24',
			'--border':     '#402A18', '--border-rgb':     '64, 42, 24',
			'--foreground': '#F5E8D0', '--foreground-rgb': '245, 232, 208',
			'--muted':      '#A07050', '--muted-rgb':      '160, 112, 80',
			'--palm-leaf':      '#906040', '--palm-leaf-rgb':      '144, 96, 64',
			'--sage-green':     '#D06030', '--sage-green-rgb':     '208, 96, 48',
			'--muted-olive':    '#C07850', '--muted-olive-rgb':    '192, 120, 80',
			'--dry-sage':       '#E8B080', '--dry-sage-rgb':       '232, 176, 128',
			'--sandy-brown':    '#60C060', '--sandy-brown-rgb':    '96, 192, 96',
		},
	},
	{
		name: 'Arctic',
		vars: {
			'--background': '#09101A', '--background-rgb': '9, 16, 26',
			'--surface':    '#101828', '--surface-rgb':    '16, 24, 40',
			'--surface-2':  '#182030', '--surface-2-rgb':  '24, 32, 48',
			'--border':     '#203050', '--border-rgb':     '32, 48, 80',
			'--foreground': '#D0E8FF', '--foreground-rgb': '208, 232, 255',
			'--muted':      '#4878A8', '--muted-rgb':      '72, 120, 168',
			'--palm-leaf':      '#4070A0', '--palm-leaf-rgb':      '64, 112, 160',
			'--sage-green':     '#40C8E0', '--sage-green-rgb':     '64, 200, 224',
			'--muted-olive':    '#50B0D8', '--muted-olive-rgb':    '80, 176, 216',
			'--dry-sage':       '#A0D8F0', '--dry-sage-rgb':       '160, 216, 240',
			'--sandy-brown':    '#F08020', '--sandy-brown-rgb':    '240, 128, 32',
		},
	},
];

// Default palette (cricket green) — used to restore after cycling back
const DEFAULT_PALETTE: Palette = {
	name: 'Cricket',
	vars: {
		'--background': '#12140E', '--background-rgb': '18, 20, 14',
		'--surface':    '#1A1D14', '--surface-rgb':    '26, 29, 20',
		'--surface-2':  '#22261A', '--surface-2-rgb':  '34, 38, 26',
		'--border':     '#2E3222', '--border-rgb':     '46, 50, 34',
		'--foreground': '#E8EDD8', '--foreground-rgb': '232, 237, 216',
		'--muted':      '#8B9474', '--muted-rgb':      '139, 148, 116',
		'--palm-leaf':      '#8B9474', '--palm-leaf-rgb':      '139, 148, 116',
		'--sage-green':     '#6CAE75', '--sage-green-rgb':     '108, 174, 117',
		'--muted-olive':    '#8BBD8B', '--muted-olive-rgb':    '139, 189, 139',
		'--dry-sage':       '#C1CC99', '--dry-sage-rgb':       '193, 204, 153',
		'--sandy-brown':    '#F5A65B', '--sandy-brown-rgb':    '245, 166, 91',
	},
};

const ALL_PALETTES = [DEFAULT_PALETTE, ...PALETTES];

function applyPalette(palette: Palette) {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(palette.vars)) {
		root.style.setProperty(key, value);
	}
}
// ─────────────────────────────────────────────────────────────────────────────

const CARDS = [
	{
		href: '/duel',
		img: duelIcon,
		tag: '01',
		title: '1v1 Duel',
		subtitle: 'Draft 11 real T20I players, set your lineup, and let the AI engine decide the winner.',
		cta: 'Enter Duel',
	},
	{
		href: '/simulate',
		img: simIcon,
		tag: '02',
		title: 'Series Simulator',
		subtitle: 'Ball-by-ball T20I simulation with venue context and AI models.',
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

const N = CARDS.length;

function cardAt(pos: number) {
	return CARDS[((pos % N) + N) % N];
}

export default function Home() {
	const [center, setCenter] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const startXRef = useRef(0);
	const router = useRouter();

	const [cardW, setCardW] = useState(CARD_W_DESKTOP);
	const [stepW, setStepW] = useState(CARD_W_DESKTOP + GAP);
	useEffect(() => {
		const update = () => {
			const vw = window.innerWidth;
			const w = vw < 560 ? Math.min(vw - 104, CARD_W_DESKTOP) : CARD_W_DESKTOP;
			setCardW(w);
			setStepW(w + GAP);
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	// ── Theme cheat-code ──────────────────────────────────────────────────────
	const [themeToast, setThemeToast] = useState('');
	const themeIndexRef = useRef(0);
	const typedRef = useRef('');
	const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		const SEQUENCE = 'theme';
		const handleThemeKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName ?? '';
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key.length !== 1) return;
			typedRef.current = (typedRef.current + e.key.toLowerCase()).slice(-SEQUENCE.length);
			if (typedRef.current === SEQUENCE) {
				typedRef.current = '';
				// Pick next palette (cycling through all, including default)
				themeIndexRef.current = (themeIndexRef.current + 1) % ALL_PALETTES.length;
				const palette = ALL_PALETTES[themeIndexRef.current];
				applyPalette(palette);
				// Show toast
				if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
				setThemeToast(palette.name);
				toastTimerRef.current = setTimeout(() => setThemeToast(''), 2200);
			}
		};
		window.addEventListener('keydown', handleThemeKey);
		return () => {
			window.removeEventListener('keydown', handleThemeKey);
			if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		};
	}, []);
	// ─────────────────────────────────────────────────────────────────────────

	// ── Settings panel (theme picker) ─────────────────────────────────────────
	const [settingsOpen, setSettingsOpen] = useState(false);
	const settingsPanelRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
				setSettingsOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	const applyThemeByIndex = (idx: number) => {
		themeIndexRef.current = idx;
		applyPalette(ALL_PALETTES[idx]);
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		setThemeToast(ALL_PALETTES[idx].name);
		toastTimerRef.current = setTimeout(() => setThemeToast(''), 2200);
	};
	// ─────────────────────────────────────────────────────────────────────────

	const prev = useCallback(() => setCenter(c => c - 1), []);
	const next = useCallback(() => setCenter(c => c + 1), []);

	const centerRef = useRef(center);
	centerRef.current = center;

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

	const slots = Array.from({ length: 5 }, (_, i) => center - 2 + i);

	return (
		<div
			className="h-screen flex flex-col overflow-hidden"
			style={{ background: 'var(--background)', color: 'var(--foreground)' }}
		>
			{/* Theme cheat-code toast */}
			{themeToast && (
				<div
					className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.25em] pointer-events-none"
					style={{
						background: 'var(--surface-2)',
						border: '1px solid var(--sage-green)',
						color: 'var(--sage-green)',
						boxShadow: '0 0 24px rgba(var(--sage-green-rgb),0.3)',
						animation: 'themeToastIn 0.25s ease',
					}}
				>
					🎨 {themeToast} theme
				</div>
			)}

			{/* Settings button + theme picker */}
			<div className="fixed top-4 left-4 z-50" ref={settingsPanelRef}>
				<button
					onClick={() => setSettingsOpen(o => !o)}
					className="w-9 h-9 rounded-xl flex items-center justify-center border transition hover:scale-105"
					style={{
						background: settingsOpen ? 'var(--surface-2)' : 'var(--surface)',
						borderColor: settingsOpen ? 'var(--sage-green)' : 'var(--border)',
						color: settingsOpen ? 'var(--sage-green)' : 'var(--muted)',
					}}
					title="Settings"
				>
					<Settings2 className="w-4 h-4" />
				</button>

				{settingsOpen && (
					<div
						className="absolute top-11 left-0 w-52 rounded-2xl border shadow-2xl overflow-hidden"
						style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
					>
						<div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
							<span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Theme</span>
						</div>
						<div className="flex flex-col py-1">
							{ALL_PALETTES.map((palette, idx) => {
								const isActive = themeIndexRef.current === idx;
								return (
									<button
										key={palette.name}
										onClick={() => { applyThemeByIndex(idx); setSettingsOpen(false); }}
										className="flex items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--surface-2)]"
									>
										{/* Colour swatch */}
										<span
											className="w-4 h-4 rounded-full flex-shrink-0 border"
											style={{
												background: palette.vars['--sage-green'],
												borderColor: isActive ? palette.vars['--sage-green'] : 'transparent',
												boxShadow: isActive ? `0 0 6px ${palette.vars['--sage-green']}` : 'none',
											}}
										/>
										<span className="flex-1 text-xs font-bold" style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}>
											{palette.name}
										</span>
										{isActive && <Check className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--sage-green)' }} />}
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>

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
