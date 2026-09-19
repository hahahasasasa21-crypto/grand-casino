import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Panel, GoldButton, playSfx } from '../../shared/ui.jsx';
import { TableHead, BetPad, PayTable, fmt, mulberry32, hash32, maxBetOf } from './bits.jsx';

/* ==========================================================
   ケノ
   1〜80 から 1〜10 個を選び、80 個から 20 個が抽選される。
   ・的中数ごとの配当は超幾何分布から計算し、
     選んだ個数ごとに還元率が 95〜96% になるよう正規化している
   ========================================================== */

const POOL = 80, DRAW = 20, MAX_PICK = 10;
const RTP = 0.955;

function logFact(n, cache = logFact._c || (logFact._c = [0])) {
  for (let i = cache.length; i <= n; i++) cache[i] = cache[i - 1] + Math.log(i);
  return cache[n];
}
const logC = (n, k) => (k < 0 || k > n ? -Infinity : logFact(n) - logFact(k) - logFact(n - k));

/** 超幾何分布：p 個選んで h 個当たる確率 */
export function hyper(p, h) {
  const l = logC(DRAW, h) + logC(POOL - DRAW, p - h) - logC(POOL, p);
  return Number.isFinite(l) ? Math.exp(l) : 0;
}

/** 選んだ個数ごとの配当表。当たりが多いほど跳ねる形にして、期待値を RTP にそろえる */
export function payTable(p) {
  const probs = [];
  for (let h = 0; h <= p; h++) probs.push(hyper(p, h));
  // 何個から配当がつくか（多く選ぶほど、当たりも多く要る）
  const start = p <= 2 ? p : p <= 4 ? p - 1 : p <= 7 ? p - 2 : p - 3;
  const shape = [];
  for (let h = 0; h <= p; h++) shape.push(h < start ? 0 : Math.pow(2.35, h - start) * (h === p ? 2.6 : 1));
  const ev = shape.reduce((a, s, h) => a + s * probs[h], 0);
  const scale = ev > 0 ? RTP / ev : 0;
  const round = (v) => (v === 0 ? 0 : v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  let out = shape.map(s => round(s * scale));
  const ev2 = out.reduce((a, m, h) => a + m * probs[h], 0);
  if (ev2 > 0) out = out.map(m => round(m * (RTP / ev2)));
  return out;
}
export const rtpOf = (p) => {
  const t = payTable(p);
  let s = 0;
  for (let h = 0; h <= p; h++) s += hyper(p, h) * t[h];
  return s;
};

export default function Keno({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  vip = false, highRoller = false,
}) {
  const [bet, setBet] = useState(1000);
  const [picks, setPicks] = useState([]);
  const [drawn, setDrawn] = useState([]);
  const [revealed, setRevealed] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const seedRef = useRef(Math.floor(Math.random() * 1e9));

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const table = useMemo(() => (picks.length ? payTable(picks.length) : []), [picks.length]);
  const rtp = useMemo(() => (picks.length ? rtpOf(picks.length) : 0), [picks.length]);

  const toggle = (n) => {
    if (busyRef.current) return;
    setResult(null);
    setPicks(ps => ps.includes(n) ? ps.filter(x => x !== n) : ps.length >= MAX_PICK ? ps : [...ps, n]);
    playSfx('click');
  };
  const quickPick = () => {
    if (busyRef.current) return;
    const rnd = mulberry32(hash32(`${playerName}|qp|${Date.now()}`));
    const all = Array.from({ length: POOL }, (_, i) => i + 1);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const n = picks.length || 6;
    setPicks(all.slice(0, n).sort((a, b) => a - b));
    setResult(null);
    playSfx('coin');
  };

  const play = async () => {
    if (busyRef.current) return;
    if (!picks.length) { showToast('番号を 1〜10 個 選んでください。', 'warning'); return; }
    if (bet < 100) { showToast('100 Y 以上を賭けてください。', 'warning'); return; }
    if (balance < bet) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    setResult(null); setRevealed(0); setDrawn([]);
    try { await updateBalance(-bet); }
    catch (e) { busyRef.current = false; return; }

    // 抽選はここで確定する（あとから変わらない）
    seedRef.current++;
    const rnd = mulberry32(hash32(`${playerName}|keno|${seedRef.current}`));
    const all = Array.from({ length: POOL }, (_, i) => i + 1);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const balls = all.slice(0, DRAW);
    setDrawn(balls);

    const t = payTable(picks.length);
    const hits = balls.filter(b => picks.includes(b)).length;
    const win = Math.floor(bet * t[hits]);

    let i = 0;
    timerRef.current = setInterval(async () => {
      i++;
      setRevealed(i);
      playSfx(picks.includes(balls[i - 1]) ? 'coin' : 'tick');
      if (i >= DRAW) {
        clearInterval(timerRef.current); timerRef.current = null;
        if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
        setResult({ hits, mult: t[hits], win });
        setHistory(h => [{ hits, picks: picks.length, win }, ...h].slice(0, 10));
        playSfx(win > bet ? 'win' : 'lose');
        if (win >= bet * 20 && win >= 100000 && emitNews) {
          emitNews(`🔢 ${playerName} がケノで ${picks.length}個中 ${hits}個 的中（${fmt(win)} Y）！`, 'jackpot');
        }
        busyRef.current = false;
      }
    }, 110);
  };

  const shown = drawn.slice(0, revealed);
  const cap = Math.min(maxBetOf(highRoller), Math.floor(balance));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <TableHead onBack={onBack} balance={balance} title="ケノ" sub={`80個から20個・${picks.length || 0} 個選択中`} icon="🔢" highRoller={highRoller} />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-3">
          {/* 盤面 */}
          <Panel className="p-3">
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: POOL }, (_, i) => i + 1).map(n => {
                const picked = picks.includes(n);
                const hit = picked && shown.includes(n);
                const out = !picked && shown.includes(n);
                return (
                  <button key={n} onClick={() => toggle(n)} disabled={busyRef.current}
                    className={`aspect-square rounded-lg text-[11px] font-black border transition
                      ${hit ? 'bg-amber-400 text-black border-amber-200 scale-105 shadow-lg shadow-amber-500/40'
                        : picked ? 'bg-sky-500/25 text-sky-200 border-sky-400/60'
                          : out ? 'bg-white/10 text-gray-300 border-white/25'
                            : 'bg-black/40 text-gray-500 border-white/10 hover:border-white/30'}`}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={quickPick} disabled={busyRef.current}
                className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-black disabled:opacity-30">おまかせ</button>
              <button onClick={() => { setPicks([]); setResult(null); }} disabled={busyRef.current}
                className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-black disabled:opacity-30">全消し</button>
            </div>
          </Panel>

          {/* 抽選の玉 */}
          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">抽選（{revealed} / {DRAW}）</div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
              {shown.map((n, i) => {
                const hit = picks.includes(n);
                return (
                  <span key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border
                      ${hit ? 'bg-amber-400 text-black border-amber-200' : 'bg-black/50 text-gray-300 border-white/15'}`}
                    style={hit ? { boxShadow: '0 0 10px rgba(251,191,36,0.6)' } : undefined}>
                    {n}
                  </span>
                );
              })}
              {revealed === 0 && <span className="text-[11px] text-gray-600 self-center">番号を選んで「抽選する」</span>}
            </div>
            {result && (
              <div className="mt-3 p-3 rounded-2xl border text-center"
                style={{ borderColor: result.win > 0 ? '#fbbf2455' : '#ffffff18', background: result.win > 0 ? '#fbbf2412' : '#00000040' }}>
                <div className="text-[11px] text-gray-400 font-bold">{picks.length} 個中 <span className="text-amber-300 font-black">{result.hits}</span> 個 的中</div>
                <div className="text-3xl font-black" style={{ color: result.win > 0 ? '#fbbf24' : '#f87171' }}>
                  {result.win > 0 ? `+${fmt(result.win)} Y` : 'はずれ'}
                </div>
                <div className="text-[11px] text-gray-500">配当 {result.mult}×</div>
              </div>
            )}
          </Panel>
        </div>

        {/* 操作 */}
        <div className="space-y-3">
          <BetPad bet={bet} setBet={setBet} balance={balance} highRoller={highRoller} disabled={busyRef.current} />
          <GoldButton onClick={play} disabled={!picks.length || bet > cap || bet < 100} className="w-full py-3.5 text-lg">
            抽選する（{fmt(bet)} Y）
          </GoldButton>

          {picks.length > 0 && (
            <PayTable
              house={`${(rtp * 100).toFixed(2)}%`}
              rows={table.map((m, h) => [`${h} 個 的中`, m > 0 ? `${m}×` : '—']).filter((_, h) => table[h] > 0 || h === picks.length)}
              note={`${picks.length} 個選んだときの表です。配当は超幾何分布から計算しています。`} />
          )}

          {history.length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">これまで</div>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div key={i} className="flex justify-between text-[11px] px-2 py-1 rounded-lg bg-black/40 border border-white/10">
                    <span className="text-gray-400">{h.picks}個中 {h.hits}個</span>
                    <span className={h.win > 0 ? 'font-mono font-black text-emerald-300' : 'text-gray-600'}>
                      {h.win > 0 ? `+${fmt(h.win)}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
