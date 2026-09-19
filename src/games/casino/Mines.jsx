import React, { useState, useRef, useMemo } from 'react';
import { Panel, GoldButton, playSfx } from '../../shared/ui.jsx';
import { TableHead, BetPad, PayTable, fmt, mulberry32, hash32, maxBetOf } from './bits.jsx';

/* ==========================================================
   マイン
   盤面に地雷を仕掛け、1マスずつ開けていく。
   ・地雷の位置はベットを確定した瞬間に決まる（開けながら決めない）
   ・倍率は「その手順まで無事だった確率」の逆数から公正に計算し、控除率4%を引く
   ========================================================== */

const HOUSE = 0.04;
const SIZES = [{ n: 5, label: '5×5' }, { n: 7, label: '7×7' }];

/** k マス開けたときの公正な倍率 */
export function multiplierFor(cells, mines, k) {
  if (k <= 0) return 1;
  const safe = cells - mines;
  if (k > safe) return 0;
  let p = 1;
  for (let i = 0; i < k; i++) p *= (safe - i) / (cells - i);   // k マス連続で安全な確率
  if (p <= 0) return 0;
  return Math.floor(((1 - HOUSE) / p) * 100) / 100;
}

export default function Mines({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  vip = false, highRoller = false,
}) {
  const [size, setSize] = useState(5);
  const [mines, setMines] = useState(3);
  const [bet, setBet] = useState(1000);
  const [board, setBoard] = useState(null);       // { bombs:Set, opened:[], dead:bool }
  const [msg, setMsg] = useState(null);
  const busyRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 1e9));

  const cells = size * size;
  const maxMines = cells - 1;
  const opened = board?.opened?.length || 0;
  const mult = useMemo(() => multiplierFor(cells, board?.mines ?? mines, opened), [cells, board, mines, opened]);
  const nextMult = useMemo(() => multiplierFor(cells, board?.mines ?? mines, opened + 1), [cells, board, mines, opened]);
  const cashout = Math.floor((board?.bet || bet) * mult);

  const start = async () => {
    if (busyRef.current || board) return;
    if (bet < 100) { showToast('100 Y 以上を賭けてください。', 'warning'); return; }
    if (balance < bet) { showToast('所持金が足りません。', 'error'); return; }
    if (mines < 1 || mines > maxMines) { showToast('地雷の数が正しくありません。', 'warning'); return; }
    busyRef.current = true;
    try { await updateBalance(-bet); }
    catch (e) { busyRef.current = false; return; }
    busyRef.current = false;

    // 地雷はここで決まる。開けながら決めるようなことはしない
    seedRef.current++;
    const rnd = mulberry32(hash32(`${playerName}|mines|${seedRef.current}|${size}|${mines}`));
    const idx = Array.from({ length: cells }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    setBoard({ bombs: new Set(idx.slice(0, mines)), opened: [], dead: false, bet, mines, size });
    setMsg(null);
    playSfx('gate');
  };

  const open = async (i) => {
    if (!board || board.dead || busyRef.current) return;
    if (board.opened.includes(i)) return;
    if (board.bombs.has(i)) {
      setBoard(b => ({ ...b, dead: true }));
      setMsg({ ok: false, text: '💥 地雷でした。' });
      playSfx('lose');
      return;
    }
    const nOpened = [...board.opened, i];
    playSfx('tick');
    const safe = cells - board.mines;
    if (nOpened.length >= safe) {
      // 全部開けきった：自動で回収
      const m = multiplierFor(cells, board.mines, nOpened.length);
      const win = Math.floor(board.bet * m);
      busyRef.current = true;
      try { await updateBalance(win); } catch (e) { /* noop */ }
      busyRef.current = false;
      setBoard(b => ({ ...b, opened: nOpened, dead: true, cleared: true }));
      setMsg({ ok: true, text: `🎉 全部開けました！ +${fmt(win)} Y（${m}×）` });
      playSfx('big');
      if (emitNews && win >= board.bet * 20 && win >= 100000) {
        emitNews(`💣 ${playerName} がマインで盤面を完全制覇（${fmt(win)} Y）！`, 'jackpot');
      }
      return;
    }
    setBoard(b => ({ ...b, opened: nOpened }));
  };

  const take = async () => {
    if (!board || board.dead || opened === 0 || busyRef.current) return;
    busyRef.current = true;
    const win = cashout;
    try { await updateBalance(win); } catch (e) { /* noop */ }
    busyRef.current = false;
    setBoard(b => ({ ...b, dead: true, took: true }));
    setMsg({ ok: true, text: `✅ ${mult}× で回収しました（+${fmt(win)} Y）` });
    playSfx('win');
    if (emitNews && win >= board.bet * 20 && win >= 100000) {
      emitNews(`💣 ${playerName} がマインで ${mult}倍（${fmt(win)} Y）を回収！`, 'jackpot');
    }
  };

  const reset = () => { setBoard(null); setMsg(null); };
  const cap = Math.min(maxBetOf(highRoller), Math.floor(balance));
  const heat = Math.min(1, opened / Math.max(1, cells - (board?.mines ?? mines)));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <TableHead onBack={onBack} balance={balance} title="マイン" sub={`${size}×${size}・地雷 ${board?.mines ?? mines} 個`} icon="💣" highRoller={highRoller} />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Panel className="p-4" >
          <div className="mx-auto" style={{ maxWidth: size === 5 ? 380 : 480 }}>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}>
              {Array.from({ length: cells }, (_, i) => {
                const isOpen = board?.opened?.includes(i);
                const isBomb = board?.bombs?.has(i);
                const showBomb = board?.dead && isBomb;
                return (
                  <button key={i} onClick={() => open(i)} disabled={!board || board.dead || isOpen}
                    className={`aspect-square rounded-xl border text-xl font-black transition-all
                      ${showBomb ? 'bg-red-500/30 border-red-400/70 text-red-200'
                        : isOpen ? 'border-emerald-400/60 text-emerald-200 scale-[0.97]'
                          : board && !board.dead ? 'bg-black/50 border-white/15 hover:border-amber-400/60 hover:-translate-y-0.5'
                            : 'bg-black/30 border-white/10'}`}
                    style={isOpen && !showBomb ? {
                      background: `rgba(52,211,153,${0.10 + heat * 0.25})`,
                      boxShadow: `0 0 ${6 + heat * 18}px rgba(52,211,153,${0.15 + heat * 0.4})`,
                    } : undefined}>
                    {showBomb ? '💥' : isOpen ? '💎' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {board && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-black/40 rounded-xl p-2 border border-white/10 text-center">
                <div className="text-[9px] text-gray-500 font-bold tracking-widest">開けた</div>
                <div className="font-mono font-black text-sky-300">{opened}</div>
              </div>
              <div className="bg-black/40 rounded-xl p-2 border border-white/10 text-center">
                <div className="text-[9px] text-gray-500 font-bold tracking-widest">いまの倍率</div>
                <div className="font-mono font-black text-amber-300">{mult}×</div>
              </div>
              <div className="bg-black/40 rounded-xl p-2 border border-white/10 text-center">
                <div className="text-[9px] text-gray-500 font-bold tracking-widest">次に開けると</div>
                <div className="font-mono font-black text-emerald-300">{nextMult || '—'}×</div>
              </div>
            </div>
          )}

          {msg && (
            <div className={`mt-3 p-3 rounded-2xl border text-center font-black
              ${msg.ok ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-red-400/40 bg-red-500/10 text-red-200'}`}>
              {msg.text}
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          {!board ? (
            <>
              <Panel className="p-3">
                <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">盤面</div>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {SIZES.map(s => (
                    <button key={s.n} onClick={() => { setSize(s.n); setMines(m => Math.min(m, s.n * s.n - 1)); }}
                      className={`py-2 rounded-xl text-[12px] font-black border transition
                        ${size === s.n ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">地雷の数</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMines(m => Math.max(1, m - 1))}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black">−</button>
                  <div className="flex-1 text-center font-mono font-black text-2xl text-amber-300">{mines}</div>
                  <button onClick={() => setMines(m => Math.min(maxMines, m + 1))}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black">＋</button>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {[1, 3, 5, 10].filter(n => n <= maxMines).map(n => (
                    <button key={n} onClick={() => setMines(n)}
                      className="py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] font-black text-gray-300 hover:border-amber-400/50">{n}</button>
                  ))}
                </div>
              </Panel>
              <BetPad bet={bet} setBet={setBet} balance={balance} highRoller={highRoller} />
              <GoldButton onClick={start} disabled={bet > cap || bet < 100} className="w-full py-3.5 text-lg">
                はじめる（{fmt(bet)} Y）
              </GoldButton>
            </>
          ) : board.dead ? (
            <GoldButton onClick={reset} className="w-full py-3.5 text-lg">もう一度</GoldButton>
          ) : (
            <>
              <Panel gold className="p-3 text-center">
                <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">いま回収すると</div>
                <div className="font-mono font-black text-3xl text-amber-300">+{fmt(cashout)} Y</div>
                <div className="text-[11px] text-gray-500">賭け金 {fmt(board.bet)} Y ／ {mult}×</div>
              </Panel>
              <GoldButton onClick={take} disabled={opened === 0} className="w-full py-3.5 text-lg">
                回収する
              </GoldButton>
              <p className="text-[11px] text-gray-500 text-center">
                地雷は開ける前から決まっています。あと {cells - board.mines - opened} マスで盤面制覇。
              </p>
            </>
          )}

          <PayTable
            house={`${((1 - HOUSE) * 100).toFixed(0)}%`}
            rows={[1, 2, 3, 5, 8].filter(k => k <= cells - (board?.mines ?? mines))
              .map(k => [`${k} マス開けたら`, `${multiplierFor(cells, board?.mines ?? mines, k)}×`])}
            note="倍率は残りマスの組み合わせから公正に計算し、控除率 4% を引いた値です。" />
        </div>
      </div>
    </div>
  );
}
