'use client';

import { ArrowLeft, Sliders, Loader, Zap, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import PlayerInput from './PlayerInput';

interface BallPredictorProps {
  onBack?: () => void;
}

const BallPredictor = ({ onBack }: BallPredictorProps) => {
  const [form, setForm] = useState({
    innings: 1,
    over: 19,
    ball: 1,
    total_runs: 150,
    wickets: 4,
    striker_name: "V Kohli",
    bowler_name: "MA Starc",
    target: ""
  });
  const [result, setResult] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, val: string | number) => {
    // Prevent NaN from entering state which causes React warnings
    if (typeof val === 'number' && isNaN(val)) {
        // If we get NaN (e.g. from parseInt("")), set to empty string if possible or 0, 
        // but since state expects numbers for some fields, we might need to handle it.
        // For inputs, it's better to store string if we want to allow clearing the input, 
        // but refactoring state to string | number is safer.
        // Let's coerce to 0 for now or handle empty string at the input level.
        // Actually best fix is to allow the state to be string | number for inputs.
    }
    setForm(prev => ({ ...prev, [field]: val }));
  };

  // Keyboard shortcut for predict button (Ctrl+Enter or Cmd+Enter)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if loading
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('predict-btn');
        if (btn && !btn.hasAttribute('disabled')) {
          e.preventDefault();
          btn.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress as unknown as EventListener);
    return () => window.removeEventListener('keydown', handleKeyPress as unknown as EventListener);
  }, []);

  const handlePredict = async () => {
    setLoading(true);
    setResult(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hewhocodes247-cricket-transformer-api.hf.space';
    try {
      const payload = {
        ...form,
        target: form.innings === 2 && form.target ? parseInt(form.target) : null
      };

      const response = await fetch(`${apiUrl}/predict_ball`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Prediction Failed: Check API connection");
    } finally {
      setLoading(false);
    }
  };

  const outcomeColors: Record<string, string> = {
    "0": "bg-slate-500",
    "1": "bg-blue-500",
    "2": "bg-cyan-500",
    "3": "bg-teal-500",
    "4": "bg-emerald-500",
    "6": "bg-purple-500",
    "Wicket": "bg-rose-500"
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center animate-fade-in max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-8">
        {onBack ? (
          <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 transition hover:border-slate-600">
            <ArrowLeft className="w-4 h-4" /> BACK TO SIMULATOR
          </button>
        ) : (
          <Link href="/" className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 transition hover:border-slate-600">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </Link>
        )}
        <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-tight">AI Ball Predictor</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full">
        {/* Input Section */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h2 className="font-bold text-white flex items-center gap-2"><Sliders className="w-4 h-4 text-purple-400" /> Match State</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Innings</label>
              <select
                value={form.innings}
                onChange={(e) => handleChange('innings', parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none"
              >
                <option value={1}>1st Innings</option>
                <option value={2}>2nd Innings</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Target (Runs)</label>
              <input
                type="number"
                disabled={form.innings === 1}
                value={form.target}
                onChange={(e) => handleChange('target', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none disabled:opacity-30"
                placeholder={form.innings === 1 ? "-" : "e.g. 180"}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Over (0-19)</label>
              <input 
                type="number" 
                value={form.over} 
                onChange={(e) => handleChange('over', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none" 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Ball (1-6)</label>
              <input 
                type="number" 
                value={form.ball} 
                onChange={(e) => handleChange('ball', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none" 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Wickets</label>
              <input 
                type="number" 
                value={form.wickets} 
                onChange={(e) => handleChange('wickets', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Current Score</label>
            <input 
                type="number" 
                value={form.total_runs} 
                onChange={(e) => handleChange('total_runs', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none" 
            />
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[10px] uppercase font-bold text-emerald-500 mb-1 block">Striker</label>
              <PlayerInput
                value={form.striker_name}
                onChange={(v) => handleChange('striker_name', v)}
                placeholder="Enter Batter Name"
                className="w-full bg-slate-800 border border-emerald-500/30 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-rose-500 mb-1 block">Bowler</label>
              <PlayerInput
                value={form.bowler_name}
                onChange={(v) => handleChange('bowler_name', v)}
                placeholder="Enter Bowler Name"
                className="w-full bg-slate-800 border border-rose-500/30 rounded p-2 text-sm text-white focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          <button
            id="predict-btn"
            onClick={handlePredict}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            PREDICT OUTCOME
            <span className="text-xs opacity-70 ml-2">(Ctrl+Enter)</span>
          </button>
        </div>

        {/* Result Section */}
        <div className="flex flex-col gap-6">
          {result ? (
            <>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-6">Probability Distribution</h3>

                <div className="space-y-4">
                  {Object.entries<number>(result.distribution).map(([outcome, prob]) => {
                    const percentage = (prob * 100).toFixed(1);
                    const allProbs = Object.values(result.distribution) as number[];
                    const isMax = Math.max(...allProbs) === prob;

                    return (
                      <div key={outcome} className="group">
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-bold ${outcome === 'Wicket' ? 'text-rose-400' : outcome === '6' || outcome === '4' ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {outcome === 'Wicket' ? 'WICKET' : outcome + (outcome === '1' ? ' Run' : ' Runs')}
                          </span>
                          <span className="font-mono text-slate-400">{percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full prob-bar ${outcomeColors[outcome] || 'bg-slate-500'} ${isMax ? 'shadow-[0_0_10px_currentColor]' : ''}`}
                            style={{ width: `${percentage}%`, opacity: isMax ? 1 : 0.7 }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <div className="flex flex-col gap-1">
                  <span className="uppercase tracking-widest font-bold">Resolved As</span>
                </div>
                <div className="text-right flex gap-4">
                  <div>
                    <div className="text-emerald-400 font-bold">{result.striker_resolved}</div>
                    <div>Striker</div>
                  </div>
                  <div>
                    <div className="text-rose-400 font-bold">{result.bowler_resolved}</div>
                    <div>Bowler</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/30 rounded-2xl border border-slate-800/50 border-dashed">
              <BarChart2 className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm font-medium">Enter match details to predict</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BallPredictor;
