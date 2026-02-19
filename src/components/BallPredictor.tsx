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
    target: "",
    batsman_score: 35
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
          target: form.innings === 2 && form.target ? parseInt(form.target) : null,
          batsman_score: typeof form.batsman_score === 'string' ? parseInt(form.batsman_score) || 0 : form.batsman_score
        };

        const res = await fetch(getApiUrl('/predict_ball'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload) // No model param sent
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
        target: form.innings === 2 && form.target ? parseInt(form.target) : null,
        batsman_score: typeof form.batsman_score === 'string' ? parseInt(form.batsman_score) || 0 : form.batsman_score
      };

      const promises = models.map(async (model) => {
        try {
          const res = await fetch(getApiUrl('/predict_ball'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, model: model.id })
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
    "0": "bg-slate-500",
    "1": "bg-blue-500",
    "2": "bg-cyan-500",
    "3": "bg-teal-500",
    "4": "bg-emerald-500",
    "6": "bg-purple-500",
    "Wicket": "bg-rose-500"
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

      <div className="grid md:grid-cols-12 gap-8 w-full">
        {/* Input Section */}
        <div className="md:col-span-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6 h-fit sticky top-6">
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
          
          <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Batsman Score</label>
              <input 
                type="number" 
                value={form.batsman_score} 
                onChange={(e) => handleChange('batsman_score', e.target.value === '' ? '' : parseInt(e.target.value))} 
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
        <div className="md:col-span-8 flex flex-col gap-6">
          {results.length > 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden w-full">
               <div className="p-6 border-b border-slate-800 bg-slate-800/50">
                 <h2 className="font-bold text-white flex items-center gap-2">
                   <BarChart2 className="w-4 h-4 text-emerald-400" /> 
                   Model Comparison
                 </h2>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-950/50 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
                       <th className="p-4 rounded-tl-lg font-mono">Model</th>
                       {["0", "1", "2", "3", "4", "6", "Wicket"].map(o => (
                           <th key={o} className={`p-4 text-center font-bold ${o === 'Wicket' ? 'text-rose-500' : o === '6' || o === '4' ? 'text-emerald-500' : ''}`}>
                               {o === 'Wicket' ? 'W' : o}
                           </th>
                       ))}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                     {results.map((res, idx) => (
                       <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                         <td className="p-4 font-bold text-slate-200 border-r border-slate-800/50 whitespace-nowrap bg-slate-900/50 group-hover:bg-slate-800/50 sticky left-0 z-10 min-w-[140px]">
                           {res.modelName}
                         </td>
                         {["0", "1", "2", "3", "4", "6", "Wicket"].map((outcome) => {
                             // Assuming res.data.distribution has keys "0", "1", ...
                             const prob = res.data.distribution[outcome] || 0;
                             const percentage = (prob * 100).toFixed(1);
                             
                             // Visual scaling - amplify low probabilities slightly for visibility
                             // Max possible prob is 1.0
                             const opacity = Math.min(1, prob * 2.5); 
                             
                             let colorBase = "bg-slate-500";
                             if (outcome === "0") colorBase = outcomeColors["0"];
                             if (outcome === "1") colorBase = outcomeColors["1"];
                             if (outcome === "2") colorBase = outcomeColors["2"];
                             if (outcome === "3") colorBase = outcomeColors["3"];
                             if (outcome === "4") colorBase = outcomeColors["4"];
                             if (outcome === "6") colorBase = outcomeColors["6"];
                             if (outcome === "Wicket") colorBase = outcomeColors["Wicket"];

                             const textColor = prob > 0.3 ? "text-white font-bold" : "text-slate-400";
                             
                             return (
                               <td key={outcome} className="p-2 text-center relative h-12">
                                  {/* Background Heatmap Cell */}
                                  <div 
                                    className={`absolute inset-1 rounded transition-all duration-300 ${colorBase}`}
                                    style={{ 
                                      opacity: opacity * 0.4 + 0.05, // Minimum visibility
                                    }}
                                  ></div>
                                  
                                  <span className={`relative z-10 text-xs font-mono font-medium ${textColor}`}>
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
            <div className="h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/30 rounded-2xl border border-slate-800/50 border-dashed min-h-[400px]">
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
