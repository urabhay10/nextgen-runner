'use client';

import { ArrowLeft, Sliders, Loader, Zap, BarChart2, MapPin, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import PlayerInput from '@/components/PlayerInput';
import VenueSelector from '@/components/VenueSelector';
import { fetchV2Models, getV2ApiUrl } from '@/lib/api_v2';
import { Model } from '@/types';

interface Venue { name: string; id: number; }

const BallPredictorV2 = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [form, setForm] = useState({
    innings: 1,
    over: 19,
    ball: 1,
    total_runs: 150,
    wickets: 4,
    striker_name: 'Virat Kohli',
    bowler_name: 'Mitchell Starc',
    target: '',
    batsman_runs: 0,
  });
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchV2Models()
      .then(data => {
        if (Array.isArray(data)) setModels(data);
        else setModels([]);
      })
      .catch(() => setModels([]));
  }, []);

  const handleChange = (field: keyof typeof form, val: string | number) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('predict-btn-v2');
        if (btn && !btn.hasAttribute('disabled')) { e.preventDefault(); btn.click(); }
      }
    };
    window.addEventListener('keydown', handleKeyPress as unknown as EventListener);
    return () => window.removeEventListener('keydown', handleKeyPress as unknown as EventListener);
  }, []);

  const handlePredict = async () => {
    setLoading(true);
    setResults([]);

    const payload = {
      ...form,
      target: form.innings === 2 && form.target ? parseInt(form.target) : null,
      venue_id: selectedVenue?.id ?? 0,
      venue_name: selectedVenue?.name ?? null,
    };

    if (models.length === 0) {
      try {
        const res = await fetch(getV2ApiUrl('/predict_ball'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Prediction failed');
        const data = await res.json();
        setResults([{ modelName: 'Default v2 Model', data }]);
      } catch (error) {
        console.error(error);
        alert('Prediction Failed: Check API connection');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const promises = models.map(async model => {
        try {
          const res = await fetch(getV2ApiUrl('/predict_ball'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, model: model.id }),
            cache: 'no-store',
          });
          const data = await res.json();
          return { modelName: model.name, data };
        } catch { return null; }
      });
      const outcomes = (await Promise.all(promises)).filter(Boolean);
      setResults(outcomes);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-6 flex flex-col items-center animate-fade-in max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-2 sm:gap-0">
        <Link
          href="/"
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] transition"
        >
          <ArrowLeft className="w-4 h-4" /> BACK TO V2 HOME
        </Link>
        <div className="flex flex-col items-end gap-1">
          <h1 className="text-lg sm:text-2xl font-black bg-gradient-to-r from-[var(--sage-green)] to-[var(--sandy-brown)] bg-clip-text text-transparent uppercase tracking-tight">
            AI Ball Predictor
          </h1>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--sage-green-rgb),0.12)', color: 'var(--sage-green)', border: '1px solid rgba(var(--sage-green-rgb),0.3)' }}>
            v2 · Venue + Batsman Context
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-4 sm:gap-8 w-full min-w-0 overflow-hidden">
        {/* Input Panel */}
        <div className="md:col-span-4 bg-[var(--surface)] p-4 sm:p-6 rounded-2xl border border-[var(--border)] shadow-xl space-y-4 sm:space-y-6 h-fit md:sticky md:top-6">
          <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
            <h2 className="font-bold text-[var(--foreground)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--sage-green)]" /> Match State
            </h2>
          </div>

          {/* Venue */}
          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--sage-green)] mb-1 block flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Venue
            </label>
            <VenueSelector value={selectedVenue} onChange={setSelectedVenue} />
          </div>

          {/* Innings / Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Innings</label>
              <select
                value={form.innings}
                onChange={e => handleChange('innings', parseInt(e.target.value))}
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
                onChange={e => handleChange('target', e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none disabled:opacity-30"
                placeholder={form.innings === 1 ? '-' : 'e.g. 180'}
              />
            </div>
          </div>

          {/* Over / Ball / Wickets */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Over (0-19)</label>
              <input
                type="number"
                value={form.over}
                onChange={e => handleChange('over', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Ball (1-6)</label>
              <input
                type="number"
                value={form.ball}
                onChange={e => handleChange('ball', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Wickets</label>
              <input
                type="number"
                value={form.wickets}
                onChange={e => handleChange('wickets', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none"
              />
            </div>
          </div>

          {/* Current Score */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1 block">Team Score</label>
              <input
                type="number"
                value={form.total_runs}
                onChange={e => handleChange('total_runs', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded p-2 text-sm text-[var(--foreground)] focus:border-[var(--sage-green)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--sage-green)] mb-1 block flex items-center gap-1">
                <User className="w-3 h-3" /> Batsman Runs
              </label>
              <input
                type="number"
                value={form.batsman_runs}
                onChange={e => handleChange('batsman_runs', e.target.value === '' ? 0 : parseInt(e.target.value))}
                className="w-full bg-[var(--background)] rounded p-2 text-sm text-[var(--foreground)] focus:outline-none outline-none"
                style={{ border: '1px solid rgba(var(--sage-green-rgb), 0.5)' }}
                placeholder="0"
                title="Batsman's current score (v2 context)"
              />
            </div>
          </div>

          {/* Players */}
          <div className="space-y-4 pt-2 border-t border-[var(--border)]">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--sage-green)] mb-1 block">Striker</label>
              <PlayerInput
                value={form.striker_name}
                onChange={v => handleChange('striker_name', v)}
                placeholder="Enter Batter Name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--sandy-brown)] mb-1 block">Bowler</label>
              <PlayerInput
                value={form.bowler_name}
                onChange={v => handleChange('bowler_name', v)}
                placeholder="Enter Bowler Name"
              />
            </div>
          </div>

          <button
            id="predict-btn-v2"
            onClick={handlePredict}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--sage-green)] to-[var(--sandy-brown)] font-bold text-[var(--background)] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            PREDICT OUTCOME
            <span className="text-xs opacity-70 ml-2 hidden sm:inline">(Ctrl+Enter)</span>
          </button>
        </div>

        {/* Result Panel */}
        <div className="md:col-span-8 flex flex-col gap-6 min-w-0">
          {results.length > 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden w-full min-w-0">
              <div className="p-6 border-b border-[var(--border)] bg-[rgba(var(--border-rgb),0.3)]">
                <h2 className="font-bold text-[var(--foreground)] flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[var(--sage-green)]" /> Model Comparison
                </h2>
                {selectedVenue && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                    <MapPin className="w-3 h-3 text-[var(--sage-green)]" />
                    {selectedVenue.name}
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-[rgba(var(--background-rgb),0.8)] text-[var(--muted)] uppercase text-xs tracking-wider border-b border-[var(--border)]">
                      <th
                        className="p-4 rounded-tl-lg font-mono sticky left-0 z-20"
                        style={{ background: '#1A1D14', boxShadow: '1px 0 0 rgba(100,100,80,0.4)' }}
                      >
                        Model
                      </th>
                      {['0', '1', '2', '3', '4', '6', 'Wicket'].map(o => (
                        <th
                          key={o}
                          className={`p-4 text-center font-bold ${o === 'Wicket' ? 'text-[var(--sandy-brown)]' : o === '6' || o === '4' ? 'text-[var(--sage-green)]' : ''}`}
                        >
                          {o === 'Wicket' ? 'W' : o}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {results.map((res, idx) => (
                      <tr key={idx} className="hover:bg-[rgba(var(--border-rgb),0.2)] transition-colors">
                        <td
                          className="p-4 font-bold text-[var(--foreground)] whitespace-nowrap sticky left-0 z-10 min-w-[140px] transition-colors"
                          style={{ background: '#1A1D14', boxShadow: '1px 0 0 rgba(100,100,80,0.4)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#22261A')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#1A1D14')}
                        >
                          {res.modelName}
                        </td>
                        {['0', '1', '2', '3', '4', '6', 'Wicket'].map(outcome => {
                          const prob = res.data.distribution?.[outcome] ?? 0;
                          const percentage = (prob * 100).toFixed(1);
                          const textColor = prob > 0.5 ? 'text-[var(--background)] font-black' : 'text-[var(--foreground)] font-medium';
                          return (
                            <td key={outcome} className="p-2 text-center relative h-12">
                              <div
                                className="absolute inset-1 rounded transition-all duration-300 bg-[var(--foreground)]"
                                style={{ opacity: prob }}
                              />
                              <span className={`relative z-10 text-xs font-mono ${textColor}`}>
                                {prob < 0.005 && prob > 0 ? '<0.1' : percentage}%
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
            <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] bg-[rgba(var(--surface-rgb),0.3)] rounded-2xl border border-[rgba(var(--border-rgb),0.5)] border-dashed min-h-[200px] sm:min-h-[400px]">
              <BarChart2 className="w-16 h-16 mb-4 opacity-50 stroke-1" />
              <p className="text-lg font-medium">Enter match details &amp; predict</p>
              <p className="text-sm opacity-70">Compare probabilities across all v2 models instantly</p>
              <p className="text-xs mt-2 opacity-50">Venue &amp; batsman score provide extra context</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function PredictV2Page() {
  return <BallPredictorV2 />;
}
