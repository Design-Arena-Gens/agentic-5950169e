import { useEffect, useMemo, useState } from 'react';
import { Arena } from '@/sim/arena';

export function BettingPanel({ arena, onNewRound }: { arena: Arena | null, onNewRound: () => void }) {
  const [balance, setBalance] = useState<number>(1000);
  const [selected, setSelected] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(50);
  const [result, setResult] = useState<string | null>(null);

  const fighters = useMemo(() => arena?.fighters ?? [], [arena?.fighters]);
  const aliveCount = fighters.filter(f => f.alive).length;

  useEffect(() => {
    if (!arena) return;
    const id = setInterval(() => {
      const winner = arena.getWinner();
      if (winner) {
        setResult(winner.name);
        if (selected) {
          const odds = arena.getOddsFor(winner.name);
          if (selected === winner.name) {
            setBalance((b) => b + Math.round(betAmount * odds));
          } else {
            setBalance((b) => b - betAmount);
          }
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [arena, selected, betAmount]);

  const placeBet = () => {
    if (!selected) return;
    setResult(null);
  };

  const newRound = () => {
    setSelected(null);
    setResult(null);
    onNewRound();
  };

  return (
    <div className="p-4 rounded border border-slate-800 bg-slate-900">
      <div className="text-lg font-semibold mb-2">Betting</div>
      <div className="mb-3 text-sm text-slate-300">Balance: ${balance}</div>
      <div className="space-y-2 mb-4">
        {fighters.map((f) => (
          <div key={f.name} className={`flex items-center justify-between p-2 rounded ${f.alive ? 'bg-slate-800' : 'bg-slate-900/40'} ${selected===f.name?'ring-2 ring-indigo-500':''}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: f.color }} />
              <div className="font-medium">{f.name}</div>
            </div>
            <div className="text-xs text-slate-300">HP {Math.max(0, Math.round(f.hp))}</div>
            <div className="text-sm">x{arena?.getOddsFor(f.name).toFixed(2)}</div>
            <button onClick={() => setSelected(f.name)} className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500">Select</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input type="number" value={betAmount} onChange={e=>setBetAmount(parseInt(e.target.value)||0)} className="w-24 px-2 py-1 bg-slate-800 rounded" />
        <button onClick={placeBet} disabled={!selected || aliveCount<2} className="px-3 py-2 rounded bg-green-600 disabled:opacity-50">Place Bet</button>
      </div>
      {result && selected && (
        <div className="text-sm">
          {selected === result ? <span className="text-green-400">You won!</span> : <span className="text-red-400">You lost.</span>}
        </div>
      )}
      <button onClick={newRound} className="mt-3 w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded">New Round</button>
    </div>
  );
}
