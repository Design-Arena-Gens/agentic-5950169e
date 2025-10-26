import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Arena, BattleConfig, createDefaultBattle } from '@/sim/arena';
import { BettingPanel } from '@/components/ui/BettingPanel';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [arena, setArena] = useState<Arena | null>(null);
  const [config] = useState<BattleConfig>(() => createDefaultBattle());
  const [tick, setTick] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    const a = new Arena(config);
    setArena(a);
  }, [config]);

  useEffect(() => {
    if (!arena || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let req = 0;
    const loop = () => {
      arena.update(1 / 60);
      arena.render(ctx);
      const w = arena.getWinner();
      if (w && !winner) setWinner(w.name);
      setTick((t) => t + 1);
      req = requestAnimationFrame(loop);
    };
    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  }, [arena]);

  const reset = () => {
    setWinner(null);
    const a = new Arena(createDefaultBattle());
    setArena(a);
  };

  return (
    <>
      <Head>
        <title>Autopilot Arena</title>
      </Head>
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-6xl mx-auto p-4 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <h1 className="text-2xl font-bold">Autopilot Arena</h1>
            <canvas ref={canvasRef} width={960} height={600} className="w-full rounded border border-slate-800 bg-slate-900" />
            <div className="flex items-center gap-3">
              <button onClick={reset} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium">Start New Round</button>
              {winner && <div className="text-green-400">Winner: {winner}</div>}
            </div>
          </div>
          <div>
            <BettingPanel arena={arena} onNewRound={reset} />
          </div>
        </div>
      </main>
    </>
  );
}
