import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Panel, GoldButton, playSfx } from '../../shared/ui.jsx';
import { TableHead, BetPad, PayTable, fmt, mulberry32, hash32, maxBetOf } from './bits.jsx';

/* ==========================================================
   プリンコ
   玉を落として釘に当たりながら下のマスへ。
   ・各段で左右 50%。着地は二項分布になる
   ・配当は二項分布から計算して、還元率がちょうど 96% になるよう正規化する
     （ハードコードではなく毎回計算している）
   ========================================================== */

const RTP = 0.96;
const ROWS = [8, 12, 16];
const RISKS = [
  { key: 'LOW', name: '低リスク', icon: '🟢', pow: 1.35, color: '#34d399' },
  { key: 'MID', name: '中リスク', icon: '🟡', pow: 2.4, color: '#fbbf24' },
  { key: 'HIGH', name: '高リスク', icon: '🔴', pow: 4.2, color: '#f87171' },
];

/** nCk（大きな数でも壊れないよう対数で計算する） */
function logC(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}
/** 二項分布（各マスに入る確率） */
function binom(rows) {
  const out = [];
  for (let k = 0; k <= rows; k++) out.push(Math.exp(logC(rows, k) - rows * Math.LN2));
  return out;
}

/** 配当表。中央を薄く、端を厚くした「形」を作り、期待値が RTP になるよう定数倍する */
export function payouts(rows, riskKey) {
  const risk = RISKS.find(r => r.key === riskKey) || RISKS[1];
  const pr = binom(rows);
  const mid = rows / 2;
  // 形：中央からの距離の累乗
  const shape = pr.map((_, k) => {
    const d = Math.abs(k - mid) / mid;               // 0（中央）〜1（端）
    return Math.pow(0.12 + d, risk.pow) + 0.02;
  });
  const ev = shape.reduce((a, s, k) => a + s * pr[k], 0);
  const scale = RTP / ev;
  // 見やすい桁に丸めてから、丸めで生じたズレをもう一度ならす
  let raw = shape.map(s => s * scale);
  const round = (v) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  let out = raw.map(round);
  const ev2 = out.reduce((a, m, k) => a + m * pr[k], 0);
  if (ev2 > 0) out = out.map(m => round(m * (RTP / ev2)));
  return out;
}
/** 実際の還元率（画面に出すため、丸めたあとの値で計算する） */
export function actualRtp(rows, riskKey) {
  const pr = binom(rows);
  const mult = payouts(rows, riskKey);
  return pr.reduce((a, p, k) => a + p * mult[k], 0);
}

const slotColor = (k, rows) => {
  const d = Math.abs(k - rows / 2) / (rows / 2);
  if (d > 0.82) return '#f87171';
  if (d > 0.6) return '#fb923c';
  if (d > 0.35) return '#fbbf24';
  if (d > 0.15) return '#a3e635';
  return '#38bdf8';
};

export default function Plinko({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  vip = false, highRoller = false,
}) {
  const [bet, setBet] = useState(1000);
  const [rows, setRows] = useState(12);
  const [risk, setRisk] = useState('MID');
  const [history, setHistory] = useState([]);
  const [lit, setLit] = useState(null);
  const [dropping, setDropping] = useState(0);
  const busyRef = useRef(false);
  const boardRef = useRef(null);
  const seedRef = useRef(Math.floor(Math.random() * 1e9));
  const liveRef = useRef([]);
  const rafRef = useRef(0);

  const mult = useMemo(() => payouts(rows, risk), [rows, risk]);
  const rtp = useMemo(() => actualRtp(rows, risk), [rows, risk]);

  /* 盤面の座標（釘とマス） */
  const W = 520, H = 30 + rows * 30 + 46;
  const pegXY = (r, i) => {
    const y = 34 + r * 30;
    const span = (r + 1) * 30;
    const x = W / 2 - span / 2 + i * 30 + 15;
    return [x, y];
  };
  const slotX = (k) => W / 2 - ((rows + 1) * 30) / 2 + k * 30 + 15;

  /* ---- 玉のアニメーション（rAF で DOM に直接書く） ---- */
  const tick = useCallback(() => {
    const now = performance.now();
    const board = boardRef.current;
    if (!board) return;
    liveRef.current = liveRef.current.filter(ball => {
      const el = board.querySelector(`[data-ball="${ball.id}"]`);
      if (!el) return false;
      const t = (now - ball.t0) / 95;            // 1段 = 95ms
      const step = Math.floor(t);
      if (step >= rows) {
        el.style.opacity = '0';
        return false;
      }
      const f = t - step;
      const [x0, y0] = step === 0 ? [W / 2, 8] : pegXY(step - 1, ball.path.slice(0, step).reduce((a, b) => a + b, 0));
      const nextI = ball.path.slice(0, step + 1).reduce((a, b) => a + b, 0);
      const [x1, y1] = pegXY(step, nextI);
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f + Math.sin(f * Math.PI) * -5;
      el.style.transform = `translate(${x - 7}px, ${y - 7}px)`;
      return true;
    });
    if (liveRef.current.length) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const drop = async (count = 1) => {
    if (busyRef.current) return;
    const total = bet * count;
    if (bet < 100) { showToast('100 Y 以上を賭けてください。', 'warning'); return; }
    if (balance < total) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    try { await updateBalance(-total); }
    catch (e) { busyRef.current = false; return; }

    const results = [];
    for (let n = 0; n < count; n++) {
      seedRef.current++;
      const rnd = mulberry32(hash32(`${playerName}|${seedRef.current}|${rows}|${risk}`));
      const path = [];
      let k = 0;
      for (let r = 0; r < rows; r++) { const right = rnd() < 0.5 ? 0 : 1; path.push(right); k += right; }
      results.push({ k, path, id: `${seedRef.current}-${n}` });
    }
    setDropping(d => d + count);
    const t0 = performance.now();
    results.forEach((r, i) => {
      liveRef.current.push({ id: r.id, path: r.path, t0: t0 + i * 130 });
    });
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);

    // 着地にあわせて払い戻し
    const flightMs = rows * 95;
    results.forEach((r, i) => {
      setTimeout(async () => {
        const win = Math.floor(bet * mult[r.k]);
        setLit(r.k);
        playSfx(mult[r.k] >= 5 ? 'win' : 'tick');
        if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
        setHistory(h => [{ k: r.k, m: mult[r.k], win }, ...h].slice(0, 16));
        setDropping(d => Math.max(0, d - 1));
        if (win >= bet * 20 && win >= 100000 && emitNews) {
          emitNews(`🎯 ${playerName} がプリンコで ${mult[r.k]}倍（${fmt(win)} Y）！`, 'jackpot');
        }
        if (i === results.length - 1) busyRef.current = false;
      }, flightMs + i * 130 + 60);
    });
  };

  const cap = Math.min(maxBetOf(highRoller), Math.floor(balance));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <TableHead onBack={onBack} balance={balance} title="プリンコ" sub={`${rows} 段・${RISKS.find(r => r.key === risk).name}`} icon="🎯" highRoller={highRoller} />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* ---- 盤面 ---- */}
        <Panel className="p-3 overflow-hidden">
          <div ref={boardRef} className="relative mx-auto" style={{ width: W, maxWidth: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
              <defs>
                <radialGradient id="pk-peg" cx="35%" cy="30%">
                  <stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#64748b" />
                </radialGradient>
              </defs>
              {Array.from({ length: rows }).map((_, r) =>
                Array.from({ length: r + 1 }).map((__, i) => {
                  const [x, y] = pegXY(r, i);
                  return <circle key={`${r}-${i}`} cx={x} cy={y} r="4" fill="url(#pk-peg)" opacity="0.85" />;
                })
              )}
              {mult.map((m, k) => {
                const x = slotX(k);
                const c = slotColor(k, rows);
                const on = lit === k;
                return (
                  <g key={k}>
                    <rect x={x - 14} y={H - 42} width="28" height="30" rx="7"
                      fill={on ? c : `${c}33`} stroke={c} strokeWidth={on ? 2 : 1} opacity={on ? 1 : 0.85} />
                    <text x={x} y={H - 22} textAnchor="middle"
                      fontSize={m >= 100 ? 9 : 10} fontWeight="900"
                      fill={on ? '#0b1512' : c}>{m >= 100 ? Math.round(m) : m}</text>
                  </g>
                );
              })}
            </svg>
            {/* 玉 */}
            {liveRef.current.map(b => (
              <div key={b.id} data-ball={b.id}
                className="absolute top-0 left-0 rounded-full pointer-events-none"
                style={{
                  width: 14, height: 14,
                  background: 'radial-gradient(circle at 34% 30%, #fff7cc, #f59e0b 60%, #b45309)',
                  boxShadow: '0 0 10px rgba(251,191,36,0.75)',
                  transform: `translate(${W / 2 - 7}px, 1px)`,
                }} />
            ))}
          </div>

          {/* 履歴 */}
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {history.map((h, i) => (
              <span key={i} className="text-[10px] font-black px-1.5 py-0.5 rounded-md border"
                style={{ color: slotColor(h.k, rows), borderColor: slotColor(h.k, rows) + '55', background: slotColor(h.k, rows) + '15' }}>
                {h.m}×
              </span>
            ))}
          </div>
        </Panel>

        {/* ---- 操作 ---- */}
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">段数</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {ROWS.map(r => (
                <button key={r} onClick={() => setRows(r)}
                  className={`py-2 rounded-xl text-[12px] font-black border transition
                    ${rows === r ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                  {r} 段
                </button>
              ))}
            </div>
            <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/60 mb-2">リスク</div>
            <div className="grid grid-cols-3 gap-1.5">
              {RISKS.map(r => (
                <button key={r.key} onClick={() => setRisk(r.key)}
                  className={`py-2 rounded-xl text-[11px] font-black border transition
                    ${risk === r.key ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                  {r.icon}<span className="block text-[9px]">{r.name}</span>
                </button>
              ))}
            </div>
          </Panel>

          <BetPad bet={bet} setBet={setBet} balance={balance} highRoller={highRoller} disabled={dropping > 3} />

          <div className="grid grid-cols-2 gap-2">
            <GoldButton onClick={() => drop(1)} disabled={bet > cap || bet < 100} className="py-3">
              1球 落とす
            </GoldButton>
            <GoldButton onClick={() => drop(10)} disabled={bet * 10 > cap || bet < 100} className="py-3">
              オート10球
            </GoldButton>
          </div>

          <PayTable
            house={`${(rtp * 100).toFixed(2)}%`}
            rows={[
              ['最高倍率（両端）', `${mult[0]}×`],
              ['中央', `${mult[Math.floor(rows / 2)]}×`],
              ['段数', `${rows} 段（${rows + 1} マス）`],
              ['控除率', `${((1 - rtp) * 100).toFixed(2)}%`],
            ]}
            note="配当は二項分布から計算しています。各段は左右ちょうど 50% で、結果は玉を落とした瞬間に決まります。" />
        </div>
      </div>
    </div>
  );
}
