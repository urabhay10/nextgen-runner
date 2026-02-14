'use client';

import Link from 'next/link';
import { BrainCircuit, Play } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8">
      <div className="max-w-4xl text-center space-y-8">
        <h1 className="text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent tracking-tighter drop-shadow-lg">
          NEXTGEN CRICKET
        </h1>
        <p className="text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
          Advanced AI-powered cricket simulation engine. Run ball-by-ball T20I match simulations or predict outcomes for any match scenario instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center mt-12 w-full">
          <Link href="/simulate" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-1 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <div className="relative h-full bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-4 transition-colors group-hover:bg-slate-900/80">
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
                <Play className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Series Simulator</h2>
              <p className="text-sm text-slate-400 max-w-xs">Simulate full multi-match series with realistic ball-by-ball outcomes and live scorecards.</p>
              <span className="mt-4 text-emerald-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                Launch Simulator <span className="text-lg">→</span>
              </span>
            </div>
          </Link>

          <Link href="/predict" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 p-1 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]">
            <div className="relative h-full bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-4 transition-colors group-hover:bg-slate-900/80">
              <div className="p-4 rounded-full bg-purple-500/10 text-purple-400 mb-2">
                <BrainCircuit className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">AI Ball Predictor</h2>
              <p className="text-sm text-slate-400 max-w-xs">Predict the probability of every ball outcome (0-6 runs, Wicket) for any specific match situation.</p>
              <span className="mt-4 text-purple-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                Open Predictor <span className="text-lg">→</span>
              </span>
            </div>
          </Link>
        </div>
      </div>
      
      <footer className="absolute bottom-8 text-slate-600 text-xs font-mono">
        Powered by Transformer Neural Networks & Next.js
      </footer>
    </div>
  );
}
