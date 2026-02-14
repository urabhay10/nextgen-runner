'use client';

import { ScorecardData } from '@/types';

interface DetailedScorecardProps {
  teamName: string;
  data: ScorecardData;
}

const DetailedScorecard = ({ teamName, data }: DetailedScorecardProps) => {
  if (!data) return null;

  return (
    <div className="mb-8 last:mb-0">
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center rounded-t-xl">
        <div className="flex items-center gap-3">
          <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
          <span className="font-black text-xl text-white tracking-tight">{teamName}</span>
        </div>
        <span className="font-mono font-bold text-2xl text-emerald-400">{data.score}</span>
      </div>

      <div className="bg-slate-900 border border-t-0 border-slate-800 rounded-b-xl overflow-hidden p-4">
        {/* Batting Table */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Batting</h4>
          <div className="overflow-x-auto">
            <table className="score-table">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="text-l w-[40%]">Batter</th>
                  <th className="text-r w-[10%]">R</th>
                  <th className="text-r w-[10%]">B</th>
                  <th className="text-c w-[10%]">4s</th>
                  <th className="text-c w-[10%]">6s</th>
                  <th className="text-r w-[20%]">SR</th>
                </tr>
              </thead>
              <tbody>
                {data.batting && data.batting.map((b, i) => {
                  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0";
                  // Server does not strictly track 4s/6s in the player_stats dict yet, defaults to "-"
                  const fours = b.fours ?? "-";
                  const sixes = b.sixes ?? "-";
                  const didBat = b.balls > 0 || b.out;

                  return (
                    <tr key={i} className={!b.out && b.balls > 0 ? "bg-emerald-900/10" : ""}>
                      <td className="text-l">
                        <div className="flex flex-col">
                          <span className={`${b.out ? 'text-slate-400' : (didBat ? 'text-emerald-400 font-bold' : 'text-slate-500')}`}>
                            {b.name} {!b.out && didBat ? '*' : ''}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal lowercase">
                             {b.out ? (b.out_by ? `out by ${b.out_by}` : 'out') : (didBat ? 'not out' : '')}
                          </span>
                        </div>
                      </td>
                      <td className="text-r font-bold text-white">{b.runs}</td>
                      <td className="text-r text-slate-400">{b.balls}</td>
                      <td className="text-c text-slate-500">{fours}</td>
                      <td className="text-c text-slate-500">{sixes}</td>
                      <td className="text-r text-slate-400 font-mono text-xs">{sr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bowling Table */}
        {data.bowling && data.bowling.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">Bowling</h4>
            <div className="overflow-x-auto">
              <table className="score-table">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="text-l w-[40%]">Bowler</th>
                    <th className="text-c w-[10%]">O</th>
                    <th className="text-c w-[10%]">M</th>
                    <th className="text-c w-[10%]">R</th>
                    <th className="text-c w-[10%]">W</th>
                    <th className="text-r w-[20%]">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bowling.map((b, i) => {
                    // Handle server data mapping: 'runs_given' is the key in server's bowler_stats
                    const runs = b.runs_given ?? b.runs ?? 0;
                    const wickets = b.wickets ?? 0;
                    const maidens = b.maidens ?? 0;
                    const balls = b.balls ?? 0;

                    // Calculate Overs string (e.g. 3.2) from balls instead of using integer 'overs'
                    const oversDisplay = `${Math.floor(balls / 6)}.${balls % 6}`;

                    // Calculate Economy based on actual ball count
                    const oversFloat = balls / 6;
                    const econ = oversFloat > 0 ? (runs / oversFloat).toFixed(2) : "0.00";

                    return (
                      <tr key={i}>
                        <td className="text-l text-rose-300 font-medium">{b.name}</td>
                        <td className="text-c text-slate-300">{oversDisplay}</td>
                        <td className="text-c text-slate-500">{maidens}</td>
                        <td className="text-c text-slate-300">{runs}</td>
                        <td className="text-c font-bold text-white">{wickets}</td>
                        <td className="text-r text-slate-400 font-mono text-xs">{econ}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedScorecard;
