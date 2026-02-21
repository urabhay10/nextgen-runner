'use client';

import { ScorecardData } from '@/types';
import PlayerLink from './PlayerLink';

interface DetailedScorecardProps {
  teamName: string;
  data: ScorecardData;
  playerIdMap?: Record<string, string | number>;
}

const DetailedScorecard = ({ teamName, data, playerIdMap }: DetailedScorecardProps) => {
  if (!data) return null;

  return (
    <div className="mb-8 last:mb-0">
      <div className="bg-[rgba(var(--surface-2-rgb),0.8)] px-4 py-3 border-b border-[var(--border)] flex justify-between items-center rounded-t-xl">
        <div className="flex items-center gap-3">
          <span className="w-2 h-6 bg-[var(--sage-green)] rounded-sm"></span>
          <span className="font-black text-xl text-[var(--foreground)] tracking-tight">{teamName}</span>
        </div>
        <span className="font-mono font-bold text-2xl text-[var(--sage-green)]">{data.score}</span>
      </div>

      <div className="bg-[var(--surface)] border border-t-0 border-[var(--border)] rounded-b-xl overflow-hidden p-4">
        {/* Batting Table */}
        <div className="mb-8">
          <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-2 px-2">Batting</h4>
          <div className="overflow-x-auto">
            <table className="score-table">
              <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
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
                    <tr key={i} className={!b.out && b.balls > 0 ? "bg-[rgba(var(--sage-green-rgb),0.1)]" : ""}>
                      <td className="text-l">
                        <div className="flex flex-col">
                          <PlayerLink name={b.name} id={playerIdMap?.[b.name]}>
                            <span className={`cursor-default ${b.out ? 'text-[var(--muted)]' : (didBat ? 'text-[var(--sage-green)] font-bold' : 'text-[var(--muted)]')}`}>
                              {b.name} {!b.out && didBat ? '*' : ''}
                            </span>
                          </PlayerLink>
                          <span className="text-[10px] text-[var(--muted)] font-normal lowercase">
                             {b.out ? (b.out_by ? `out by ${b.out_by}` : 'out') : (didBat ? 'not out' : '')}
                          </span>
                        </div>
                      </td>
                      <td className="text-r font-bold text-[var(--foreground)]">{b.runs}</td>
                      <td className="text-r text-[var(--muted)]">{b.balls}</td>
                      <td className="text-c text-[var(--muted)]">{fours}</td>
                      <td className="text-c text-[var(--muted)]">{sixes}</td>
                      <td className="text-r text-[var(--muted)] font-mono text-xs">{sr}</td>
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
            <h4 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-2 px-2">Bowling</h4>
            <div className="overflow-x-auto">
              <table className="score-table">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
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
                        <td className="text-l text-[var(--sandy-brown)] font-medium">
                          <PlayerLink name={b.name} id={playerIdMap?.[b.name]}>
                            <span className="cursor-default">{b.name}</span>
                          </PlayerLink>
                        </td>
                        <td className="text-c text-[var(--foreground)]">{oversDisplay}</td>
                        <td className="text-c text-[var(--muted)]">{maidens}</td>
                        <td className="text-c text-[var(--foreground)]">{runs}</td>
                        <td className="text-c font-bold text-[var(--foreground)]">{wickets}</td>
                        <td className="text-r text-[var(--muted)] font-mono text-xs">{econ}</td>
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
