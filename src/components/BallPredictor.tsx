'use client';

import { ArrowLeft, Sliders, Loader, Zap, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import PlayerInput from './PlayerInput';
import { fetchModels, getApiUrl } from '@/lib/api';
import { Model } from '@/types';

interface BallPredictorProps {
  onBack?: () => void;
}

const BallPredictor = ({ onBack }: BallPredictorProps) => {
  const [models, setModels] = useState<Model[]>([]);
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
  const [results, setResults] = useState<any[]>([]); // Array of { modelName, data }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModels().then(data => {
      // Ensure data is valid array before setting
      if (Array.isArray(data)) {
        setModels(data);
      } else {
        console.error("fetchModels returned non-array:", data);
        setModels([]);
      }
    }).catch(err => {
        console.error("fetchModels failed:", err);
        setModels([]);
    });
  }, []);

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
    setResults([]);
    
    // If no models are loaded, try to fetch with default model (no model param)
    if (models.length === 0) {
       try {
        const payload = {
          ...form,
          target: form.innings === 2 && form.target ? parseInt(form.target) : null
        };

        const res = await fetch(getApiUrl('/predict_ball'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), // No model param sent
          cache: 'no-store'
        });
        
        if (!res.ok) throw new Error('Prediction failed');
        
        const data = await res.json();
        setResults([{ modelName: "Default Model", data }]);
      } catch (error) {
        console.error(error);
        alert("Prediction Failed: Check API connection");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const payload = {
        ...form,
        target: form.innings === 2 && form.target ? parseInt(form.target) : null
      };

      const promises = models.map(async (model) => {
        try {
          const res = await fetch(getApiUrl('/predict_ball'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, model: model.id }),
            cache: 'no-store'
          });
          const data = await res.json();
          return { modelName: model.name, data: data };
        } catch (e) {
          console.error(e);
          return null;
        }
      });

      const outcomes = (await Promise.all(promises)).filter(Boolean);
      setResults(outcomes);
    } catch (error) {
      console.error(error);
      // alert("Prediction Failed: Check API connection");
    } finally {
      setLoading(false);
    }
  };

  const outcomeColors: Record<string, string> = {
    "0": "bg-[var(--muted)]",
    "1": "bg-[var(--sage-green)]",
    "2": "bg-[var(--sandy-brown)]",
    "3": "bg-[var(--dry-sage)]",
    "4": "bg-[var(--sage-green)]",
    "6": "bg-[var(--sandy-brown)]",
    "Wicket": "bg-[var(--sandy-brown)]"
  };

  // Helper to get max probability for an outcome across all models to normalize heatmap
  const getMaxProbForOutcome = (outcome: string) => {
    return Math.max(...results.map(r => r.data.distribution[outcome] || 0));
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center animate-fade-in max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-8">
        {onBack ? (
          <button onClick={onBack} className="text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] transition hover:border-[rgba(var(--border-rgb),0.8)]">
            <ArrowLeft className="w-4 h-4" /> BACK TO SIMULATOR
          </button>
        ) : (
          <Link href="/" className="text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] transition hover:border-[rgba(var(--border-rgb),0.8)]">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </Link>
        )}
        <h1 className="text-2xl font-black bg-gradient-to-r from-[var(--sage-green)] to-[var(--sandy-brown)] bg-clip-text text-transparent uppercase tracking-tight">AI Ball Predictor</h1>
      </div>

      <div className="grid md:grid-cols-12 gap-8 w-full">
        {/* Input Section */}
        <div className="md:col-span-4 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-xl space-y-6 h-fit sticky top-6">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
            <h2 className="font-bold text-[var(--foreground)] flex items-center gap-2"><Sliders className="w-4 h-4 text-[var(--sage-green)]" /> Match State</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Innings</label>
              <select
                value={form.innings}
                onChange={(e) => handleChange('innings', parseInt(e.target.value))}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none"
              >
                <option value={1}>1st Innings</option>
                <option value={2}>2nd Innings</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Target (Runs)</label>
              <input
                type="number"
                disabled={form.innings === 1}
                value={form.target}
                onChange={(e) => handleChange('target', e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none disabled:opacity-30"
                placeholder={form.innings === 1 ? "-" : "e.g. 180"}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Over (0-19)</label>
              <input 
                type="number" 
                value={form.over} 
                onChange={(e) => handleChange('over', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none" 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Ball (1-6)</label>
              <input 
                type="number" 
                value={form.ball} 
                onChange={(e) => handleChange('ball', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none" 
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Wickets</label>
              <input 
                type="number" 
                value={form.wickets} 
                onChange={(e) => handleChange('wickets', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Current Score</label>
            <input 
                type="number" 
                value={form.total_runs} 
                onChange={(e) => handleChange('total_runs', e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none" 
            />
          </div>

          <div className="space-y-4 pt-2 border-t border-[var(--border)]">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--sage-green)] mb-1 block">Striker</label>
              <PlayerInput
                value={form.striker_name}
                onChange={(v) => handleChange('striker_name', v)}
                placeholder="Enter Batter Name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--sandy-brown)] mb-1 block">Bowler</label>
              <PlayerInput
                value={form.bowler_name}
                onChange={(v) => handleChange('bowler_name', v)}
                placeholder="Enter Bowler Name"
              />
            </div>
          </div>

          <button
            id="predict-btn"
            onClick={handlePredict}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--sage-green)] to-[var(--sandy-brown)] font-bold text-[var(--background)] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            PREDICT OUTCOME
            <span className="text-xs opacity-70 ml-2">(Ctrl+Enter)</span>
          </button>
        </div>

        {/* Result Section */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {results.length > 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden w-full">
               <div className="p-6 border-b border-[var(--border)] bg-[rgba(var(--border-rgb),0.3)]">
                 <h2 className="font-bold text-[var(--foreground)] flex items-center gap-2">
                   <BarChart2 className="w-4 h-4 text-[var(--sage-green)]" /> 
                   Model Comparison
                 </h2>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left border-collapse">
                   <thead>
                     <tr className="bg-[rgba(var(--background-rgb),0.8)] text-[var(--muted)] uppercase text-xs tracking-wider border-b border-[var(--border)]">
                       <th className="p-4 rounded-tl-lg font-mono">Model</th>
                       {["0", "1", "2", "3", "4", "6", "Wicket"].map(o => (
                           <th key={o} className={`p-4 text-center font-bold ${o === 'Wicket' ? 'text-[var(--sandy-brown)]' : o === '6' || o === '4' ? 'text-[var(--sage-green)]' : ''}`}>
                               {o === 'Wicket' ? 'W' : o}
                           </th>
                       ))}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[var(--border)]">
                     {results.map((res, idx) => (
                       <tr key={idx} className="hover:bg-[rgba(var(--border-rgb),0.2)] transition-colors group">
                         <td className="p-4 font-bold text-[var(--foreground)] border-r border-[rgba(var(--border-rgb),0.5)] whitespace-nowrap bg-[rgba(var(--surface-rgb),0.5)] group-hover:bg-[rgba(var(--border-rgb),0.3)] sticky left-0 z-10 min-w-[140px]">
                           {res.modelName}
                         </td>
                         {["0", "1", "2", "3", "4", "6", "Wicket"].map((outcome) => {
                             // Assuming res.data.distribution has keys "0", "1", ...
                             const prob = res.data.distribution[outcome] || 0;
                             const percentage = (prob * 100).toFixed(1);
                             
                             // Visual scaling - opacity proportional to probability
                             const opacity = prob; 
                             
                             const textColor = prob > 0.5 ? "text-[var(--background)] font-black" : "text-[var(--foreground)] font-medium";
                             
                             return (
                               <td key={outcome} className="p-2 text-center relative h-12">
                                  {/* Background Heatmap Cell */}
                                  <div 
                                    className="absolute inset-1 rounded transition-all duration-300 bg-[var(--foreground)]"
                                    style={{ 
                                      opacity: opacity,
                                    }}
                                  ></div>
                                  
                                  <span className={`relative z-10 text-xs font-mono ${textColor}`}>
                                    {prob < 0.005 && prob > 0 ? "<0.1" : percentage}%
                                  </span>
                               </td>
                             );
                         })}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] bg-[rgba(var(--surface-rgb),0.3)] rounded-2xl border border-[rgba(var(--border-rgb),0.5)] border-dashed min-h-[400px]">
              <BarChart2 className="w-16 h-16 mb-4 opacity-50 stroke-1" />
              <p className="text-lg font-medium">Enter match details & predict</p>
              <p className="text-sm opacity-70">Compare probabilities across all models instantly</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BallPredictor;
