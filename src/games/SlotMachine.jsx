import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Panel, GoldButton, playSfx } from '../shared/ui';
import {
  REEL_STRIPS, STRIP_LEN, SLOT_SYMBOLS, SLOT_LINES, LINE_PAYS, TWO_PAYS,
  MIX_PREMIUM_PAY, SCATTER_PAYS, gridFromStops, evaluateGrid, SYM,
} from './slotModel';

/* ==========================================================
   3D スロットマシン
   ・リールは 24 面の円柱（CSS 3D）。面 i は rotateX(i*STEP) translateZ(R)
     に置き、円柱を rotateX(-p*STEP) 回すと p コマ目が正面に来る。
   ・毎フレームの更新は ref で DOM に直接書き込み（再レンダーしない）
     ので、回転中に React が落ちて白画面…という事故が起きない。
   ========================================================== */

const FACE_H = 104;                                   // 1コマの高さ(px)
const STEP = 360 / STRIP_LEN;                         // 1コマ分の角度(15°)
const PITCH = 0.86;                                   // 円柱の詰まり具合（1.0で正接、小さいほど3行が収まる）
const RADIUS = (FACE_H * PITCH / 2) / Math.tan(Math.PI / STRIP_LEN); // 円柱半径

const VMAX = 26;        // 最高回転速度(コマ/秒)
const ACC_T = 0.28;     // 加速にかける秒数
const DECEL_T = 0.78;   // 減速にかける秒数
const SPIN_BASE = 1.25; // 1リール目が止まるまでの秒数
const REEL_GAP = 0.55;  // リール間の停止間隔

const BET_STEPS = [10, 50, 100, 500, 1000, 5000];
const PREMIUM_SET = new Set([SYM.SEVEN, SYM.BAR, SYM.DIAMOND]);

const easeOutBack = (t) => {
  const c1 = 0.72, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/* ---------- シンボル描画 ---------- */
function SlotSymbol({ idx, size = 1 }) {
  const s = SLOT_SYMBOLS[idx];
  if (!s) return null;
  if (s.kind === 'seven') {
    return (
      <span
        className="font-black leading-none select-none"
        style={{
          fontSize: 62 * size,
          fontFamily: 'Georgia, "Times New Roman", serif',
          background: 'linear-gradient(180deg,#fff3b0 0%,#ef4444 32%,#991b1b 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          WebkitTextStroke: `${1.6 * size}px #7c2d12`,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))',
        }}
      >7</span>
    );
  }
  if (s.kind === 'bar') {
    return (
      <span
        className="font-black tracking-tighter leading-none select-none px-2.5 py-1 rounded"
        style={{
          fontSize: 25 * size,
          color: '#0b1220',
          background: 'linear-gradient(180deg,#ffffff 0%,#cbd5e1 45%,#94a3b8 55%,#e2e8f0 100%)',
          boxShadow: 'inset 0 0 0 2px #475569, 0 2px 3px rgba(0,0,0,0.35)',
        }}
      >BAR</span>
    );
  }
  return (
    <span
      className="leading-none select-none"
      style={{ fontSize: 54 * size, filter: s.kind === 'gem' ? 'drop-shadow(0 0 10px rgba(56,189,248,0.8))' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))' }}
    >{s.glyph}</span>
  );
}

/* ---------- 1リール（円柱） ---------- */
const Reel = React.forwardRef(function Reel({ col, blur }, ref) {
  const strip = REEL_STRIPS[col];
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        height: FACE_H * 3,
        perspective: 2200,
        perspectiveOrigin: '50% 50%',
        background: 'linear-gradient(180deg,#59606c 0%,#c7ccd4 10%,#f2f4f8 26%,#ffffff 50%,#f2f4f8 74%,#c7ccd4 90%,#59606c 100%)',
        boxShadow: 'inset 0 0 26px rgba(0,0,0,0.75)',
      }}
    >
      <div
        ref={ref}
        className="absolute left-0 right-0"
        style={{ top: '50%', height: 0, transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        {strip.map((symIdx, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{
              height: FACE_H, marginTop: -FACE_H / 2,
              transform: `rotateX(${i * STEP}deg) translateZ(${RADIUS}px)`,
              backfaceVisibility: 'hidden',
            }}
          >
            <SlotSymbol idx={symIdx} />
          </div>
        ))}
      </div>

      {/* ガラスの映り込み */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'linear-gradient(105deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.10) 84%, rgba(255,255,255,0.02) 100%)',
      }} />
      {/* 上下の暗がり（円柱の陰影） */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 14%, rgba(0,0,0,0.02) 32%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.02) 68%, rgba(0,0,0,0.18) 86%, rgba(0,0,0,0.55) 100%)',
      }} />
      {blur && (
        <div className="pointer-events-none absolute inset-0" style={{
          backdropFilter: 'blur(1.6px)', WebkitBackdropFilter: 'blur(1.6px)',
        }} />
      )}
    </div>
  );
});

/* ---------- 本体 ---------- */
export default function SlotMachine({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [lineBet, setLineBet] = useState(100);
  const [status, setStatus] = useState('IDLE');       // IDLE | SPINNING | RESULT
  const [spinning, setSpinning] = useState([false, false, false]);
  const [stops, setStops] = useState([0, 5, 10]);
  const [result, setResult] = useState(null);         // { hits, totalMult, win, ... }
  const [autoSpin, setAutoSpin] = useState(false);
  const [sound, setSound] = useState(true);
  const [netWin, setNetWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [reach, setReach] = useState(false);
  const [leverDown, setLeverDown] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [winMeter, setWinMeter] = useState(0);

  const totalBet = lineBet * 5;

  const reelRefs = [useRef(null), useRef(null), useRef(null)];
  const rafRef = useRef(null);
  const posRef = useRef([0, 5, 10]);
  const statusRef = useRef('IDLE');
  const autoRef = useRef(false);
  const soundRef = useRef(true);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const lossStreakRef = useRef(0);
  const startSpinRef = useRef(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  // 初期位置を描画
  const paint = useCallback(() => {
    for (let i = 0; i < 3; i++) {
      const el = reelRefs[i].current;
      if (el) el.style.transform = `rotateX(${-posRef.current[i] * STEP}deg)`;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { paint(); }, [paint]);

  const grid = useMemo(() => gridFromStops(stops), [stops]);

  const finishSpin = useCallback(async (finalStops) => {
    if (!mountedRef.current) return;
    setStops(finalStops);
    setReach(false);
    const g = gridFromStops(finalStops);
    const evalRes = evaluateGrid(g);
    const win = lineBet * evalRes.totalMult;
    statusRef.current = 'RESULT'; setStatus('RESULT');
    setResult({ ...evalRes, win, grid: g });

    if (win > 0) {
      setNetWin(v => v + win - totalBet);
      lossStreakRef.current = 0;
      playSfx(evalRes.totalMult >= 200 ? 'big' : 'win', soundRef.current);
      try { await updateBalance(win); } catch (e) { /* noop */ }
      if (win >= 100000) emitNews(`🎰 ${playerName} がスロットで大当たり！ ${win.toLocaleString()} G 獲得！！`, 'jackpot');
      // 払い出しメーターのカウントアップ
      const steps = 24;
      let n = 0;
      const iv = setInterval(() => {
        n++;
        if (!mountedRef.current) { clearInterval(iv); return; }
        setWinMeter(Math.floor(win * n / steps));
        if (n >= steps) clearInterval(iv);
      }, 28);
    } else {
      setNetWin(v => v - totalBet);
      lossStreakRef.current += totalBet;
      playSfx('lose', soundRef.current);
      if (lossStreakRef.current >= 100000) {
        emitNews(`💸 ${playerName} がスロットで ${lossStreakRef.current.toLocaleString()} G の大負け...`, 'loss');
        lossStreakRef.current = 0;
      }
    }

    const delay = win > 0 ? (evalRes.totalMult >= 200 ? 3200 : 1800) : (autoRef.current ? 700 : 1100);
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      statusRef.current = 'IDLE'; setStatus('IDLE');
      setResult(null); setWinMeter(0);
      if (autoRef.current) startSpinRef.current && startSpinRef.current();
    }, delay);
  }, [lineBet, totalBet, updateBalance, emitNews, playerName]);

  /* ------- スピン ------- */
  const startSpin = useCallback(async () => {
    if (statusRef.current !== 'IDLE') return;
    if (balance < totalBet) {
      showToast('残高が足りません！', 'error');
      autoRef.current = false; setAutoSpin(false);
      return;
    }
    statusRef.current = 'SPINNING'; setStatus('SPINNING');
    setResult(null); setReach(false); setWinMeter(0);
    setLeverDown(true);
    setTimeout(() => mountedRef.current && setLeverDown(false), 320);
    playSfx('click', soundRef.current);

    try {
      await updateBalance(-totalBet);
    } catch (e) {
      statusRef.current = 'IDLE'; setStatus('IDLE');
      autoRef.current = false; setAutoSpin(false);
      return;
    }
    if (!mountedRef.current) return;
    setSpinCount(c => c + 1);

    // --- 抽選：各リールの停止コマを決める（見た目＝判定） ---
    const forced = (typeof window !== 'undefined' && window.__slotForceStops) || null;
    const finalStops = forced ? forced.slice(0, 3) : [0, 1, 2].map(() => Math.floor(Math.random() * STRIP_LEN));

    // リーチ演出：左2リールの中段が揃っていたら3リール目を引っ張る
    const c0 = REEL_STRIPS[0][finalStops[0]];
    const c1 = REEL_STRIPS[1][finalStops[1]];
    const isReach = c0 === c1 && (PREMIUM_SET.has(c0) || c0 === SYM.MELON || c0 === SYM.BELL);
    const extra = isReach ? 2.0 : 0;

    const plan = [0, 1, 2].map(i => {
      const dur = SPIN_BASE + i * REEL_GAP + (i === 2 ? extra : 0);
      return { dur, decelStart: dur - DECEL_T, base: posRef.current[i], lastP: posRef.current[i], from: 0, to: 0, ready: false };
    });

    setSpinning([true, true, true]);
    const t0 = performance.now();
    let stoppedCount = 0;
    const stoppedFlags = [false, false, false];

    const tick = (now) => {
      if (!mountedRef.current) return;
      const t = (now - t0) / 1000;
      for (let i = 0; i < 3; i++) {
        if (stoppedFlags[i]) continue;
        const pl = plan[i];
        let p;
        if (t < pl.decelStart) {
          // 加速 → 等速
          const ta = Math.min(t, ACC_T);
          const accelDist = VMAX * ta * ta / (2 * ACC_T);
          const cruiseDist = t > ACC_T ? VMAX * (t - ACC_T) : 0;
          p = pl.base + accelDist + cruiseDist;
          pl.lastP = p;
        } else {
          if (!pl.ready) {
            pl.ready = true;
            pl.from = pl.lastP;
            // 目標：finalStops[i] と mod L で一致する、十分先の位置
            const minAdvance = VMAX * DECEL_T * 0.5;
            let target = Math.ceil(pl.from + minAdvance);
            const L = STRIP_LEN;
            const want = ((finalStops[i] % L) + L) % L;
            const cur = ((target % L) + L) % L;
            target += ((want - cur) % L + L) % L;
            pl.to = target;
          }
          const k = Math.min((t - pl.decelStart) / DECEL_T, 1);
          p = pl.from + (pl.to - pl.from) * easeOutBack(k);
          if (k >= 1) {
            p = pl.to;
            stoppedFlags[i] = true;
            stoppedCount++;
            playSfx('stop', soundRef.current);
            setSpinning(prev => { const n = [...prev]; n[i] = false; return n; });
            if (i === 1 && isReach) setReach(true);
          }
        }
        posRef.current[i] = p;
        const el = reelRefs[i].current;
        if (el) el.style.transform = `rotateX(${-p * STEP}deg)`;
      }

      if (stoppedCount < 3) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        finishSpin(finalStops);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [balance, totalBet, updateBalance, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  startSpinRef.current = startSpin;

  const toggleAuto = () => {
    const n = !autoSpin;
    autoRef.current = n; setAutoSpin(n);
    if (n && statusRef.current === 'IDLE') startSpin();
  };

  const isIdle = status === 'IDLE';
  const hitCells = useMemo(() => {
    const set = new Set();
    (result?.hits || []).forEach(h => h.cells.forEach(c => set.add(c)));
    if (result?.scatterMult > 0) grid.forEach((s, i) => { if (s === SYM.DIAMOND) set.add(i); });
    return set;
  }, [result, grid]);

  const big = (result?.totalMult || 0) >= 200;

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto flex flex-col items-center">
      {/* ヘッダー */}
      <div className="w-full flex flex-wrap gap-3 justify-between items-center mb-4">
        <button onClick={() => { autoRef.current = false; setAutoSpin(false); onBack(); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-3">
          <button onClick={() => setSound(s => !s)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition">
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <div className="text-center"><div className="text-[10px] text-gray-500 font-bold">SPINS</div><div className="font-mono text-amber-300 font-bold">{spinCount}</div></div>
          <div className="text-center"><div className="text-[10px] text-gray-500 font-bold">NET</div>
            <div className={`font-mono font-bold ${netWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netWin >= 0 ? '+' : ''}{netWin.toLocaleString()}</div></div>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg md:text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      {/* 大当たり演出 */}
      {big && result && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-amber-400/10 animate-pulse" />
          {[...Array(24)].map((_, i) => (
            <div key={i} className="absolute text-3xl animate-bounce"
              style={{ left: `${(i * 41) % 95}%`, top: `${(i * 37) % 90}%`, animationDelay: `${(i % 6) * 0.1}s` }}>
              {i % 3 === 0 ? '💰' : i % 3 === 1 ? '⭐' : '🎉'}
            </div>
          ))}
        </div>
      )}

      {/* ===== 筐体 ===== */}
      <div className="relative w-full" style={{ maxWidth: 720 }}>
        <div className="relative rounded-[2.5rem] p-3 md:p-5"
          style={{
            background: 'linear-gradient(175deg,#d8a13a 0%,#8a5a12 18%,#3a2708 40%,#241806 70%,#120c03 100%)',
            boxShadow: '0 30px 70px rgba(0,0,0,0.75), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -3px 12px rgba(0,0,0,0.8)',
            border: '2px solid rgba(255,214,120,0.45)',
          }}>

          {/* マーキー */}
          <div className="relative mx-auto -mt-1 mb-3 w-fit">
            <div className="flex items-center gap-1.5 px-6 py-2 rounded-2xl"
              style={{ background: 'linear-gradient(180deg,#2a1c05,#0d0903)', boxShadow: 'inset 0 0 0 2px rgba(255,205,100,0.55), 0 6px 20px rgba(0,0,0,0.6)' }}>
              {[...Array(4)].map((_, i) => (
                <span key={'l' + i} className="w-2 h-2 rounded-full" style={{
                  background: '#ffd76a', boxShadow: '0 0 8px #ffbe2e',
                  animation: `slotbulb 1s ${i * 0.12}s infinite`,
                }} />
              ))}
              <span className="mx-2 font-black tracking-[0.35em] text-transparent bg-clip-text text-base md:text-xl"
                style={{ backgroundImage: 'linear-gradient(180deg,#fff6c9,#ffce4d 45%,#b97f12)' }}>GRAND SLOT</span>
              {[...Array(4)].map((_, i) => (
                <span key={'r' + i} className="w-2 h-2 rounded-full" style={{
                  background: '#ffd76a', boxShadow: '0 0 8px #ffbe2e',
                  animation: `slotbulb 1s ${0.5 + i * 0.12}s infinite`,
                }} />
              ))}
            </div>
          </div>

          {/* リール窓 + レバー */}
          <div className="flex items-stretch gap-3">
            <div className="flex-1 relative rounded-2xl p-3"
              style={{ background: 'linear-gradient(180deg,#14100a,#070503)', boxShadow: 'inset 0 0 0 3px rgba(255,205,100,0.35), inset 0 6px 24px rgba(0,0,0,0.9)' }}>

              <div className="relative grid grid-cols-3 gap-2">
                {[0, 1, 2].map(col => (
                  <Reel key={col} col={col} ref={reelRefs[col]} blur={spinning[col]} />
                ))}

                {/* ペイライン枠（中段） */}
                <div className="pointer-events-none absolute left-0 right-0" style={{
                  top: FACE_H, height: FACE_H,
                  boxShadow: 'inset 0 0 0 2px rgba(251,191,36,0.35)',
                  borderRadius: 8,
                }} />

                {/* 当たりライン */}
                {result && result.hits.length > 0 && (
                  <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 300 312" preserveAspectRatio="none">
                    {result.hits.map((h, i) => {
                      const pts = h.cells.map(c => {
                        const row = Math.floor(c / 3), col = c % 3;
                        return `${col * 100 + 50},${row * 104 + 52}`;
                      }).join(' ');
                      return (
                        <polyline key={i} points={pts} fill="none" stroke={h.color} strokeWidth="5"
                          strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
                          style={{ filter: `drop-shadow(0 0 6px ${h.color})`, animation: 'slotline 0.9s ease-in-out infinite alternate' }} />
                      );
                    })}
                  </svg>
                )}

                {/* 当たりセルの光 */}
                {result && [...hitCells].map(c => {
                  const row = Math.floor(c / 3), col = c % 3;
                  return (
                    <div key={c} className="pointer-events-none absolute rounded-lg"
                      style={{
                        left: `calc(${col} * (100% + 8px) / 3)`, width: `calc((100% - 16px) / 3)`,
                        top: row * FACE_H, height: FACE_H,
                        boxShadow: 'inset 0 0 0 4px rgba(255,205,60,0.95), 0 0 22px rgba(255,205,60,0.5)',
                        background: 'radial-gradient(ellipse at center, rgba(255,205,60,0.35), rgba(255,205,60,0.05) 72%)',
                        borderRadius: 10,
                        animation: 'slotline 0.7s ease-in-out infinite alternate',
                      }} />
                  );
                })}
              </div>

              {/* 「リーチ！」演出 */}
              {reach && status === 'SPINNING' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="px-6 py-2 rounded-2xl bg-red-600/90 text-white text-2xl md:text-4xl font-black tracking-widest animate-pulse border-2 border-yellow-300">リーチ！</div>
                </div>
              )}

              {/* 結果表示 */}
              {result && (
                <div className="absolute inset-x-0 -top-3 flex justify-center pointer-events-none z-30">
                  <div className={`px-5 py-1 rounded-full text-sm md:text-lg font-black shadow-lg ${result.win > 0 ? 'bg-amber-400 text-black' : 'bg-black/85 text-gray-400 border border-white/10'}`}>
                    {result.win > 0
                      ? <>WIN +{winMeter.toLocaleString()} G <span className="text-[11px] font-bold opacity-70">×{result.totalMult}</span></>
                      : 'LOSE'}
                  </div>
                </div>
              )}
            </div>

            {/* レバー */}
            <div className="hidden sm:flex w-16 flex-col items-center justify-center">
              <button
                onClick={startSpin} disabled={!isIdle || balance < totalBet}
                aria-label="レバーを引く"
                className="relative h-full w-full disabled:opacity-40"
                style={{ perspective: 600 }}>
                <span className="absolute left-1/2 -translate-x-1/2 bottom-6 w-6 h-6 rounded-full"
                  style={{ background: 'radial-gradient(circle at 35% 30%,#fff,#94a3b8 45%,#334155)', boxShadow: '0 4px 10px rgba(0,0,0,0.6)' }} />
                <span className="absolute left-1/2 -translate-x-1/2 origin-bottom transition-transform duration-200"
                  style={{
                    bottom: 26, width: 9, height: 118, borderRadius: 6,
                    background: 'linear-gradient(90deg,#64748b,#f1f5f9 40%,#94a3b8 70%,#334155)',
                    transform: `rotateX(${leverDown ? 62 : 0}deg)`,
                    boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
                  }} />
                <span className="absolute left-1/2 -translate-x-1/2 transition-all duration-200"
                  style={{
                    bottom: leverDown ? 78 : 132, width: 30, height: 30, borderRadius: '50%',
                    background: 'radial-gradient(circle at 34% 28%,#fff0f0,#ef4444 42%,#7f1d1d)',
                    boxShadow: '0 6px 14px rgba(0,0,0,0.7), inset 0 -3px 6px rgba(0,0,0,0.4)',
                  }} />
              </button>
            </div>
          </div>

          {/* 表示パネル */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: 'CREDIT', v: balance.toLocaleString(), c: '#7dd3fc' },
              { k: 'BET', v: totalBet.toLocaleString(), c: '#fbbf24' },
              { k: 'WIN', v: (result?.win ? winMeter : 0).toLocaleString(), c: '#4ade80' },
            ].map(d => (
              <div key={d.k} className="rounded-xl px-3 py-2 text-center"
                style={{ background: 'linear-gradient(180deg,#05070a,#0d1117)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08)' }}>
                <div className="text-[9px] tracking-[0.25em] text-gray-500 font-black">{d.k}</div>
                <div className="font-mono font-black text-base md:text-xl truncate" style={{ color: d.c, textShadow: `0 0 10px ${d.c}80` }}>{d.v}</div>
              </div>
            ))}
          </div>

          {/* 操作パネル */}
          <div className="mt-3 rounded-2xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between"
            style={{ background: 'linear-gradient(180deg,#1a1206,#0a0703)', boxShadow: 'inset 0 0 0 2px rgba(255,205,100,0.22)' }}>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-[11px] text-amber-200/70 font-black tracking-widest">BET / LINE</span>
              {BET_STEPS.map(v => (
                <button key={v} onClick={() => isIdle && setLineBet(v)} disabled={!isIdle}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black border transition disabled:opacity-50 ${lineBet === v ? 'bg-amber-400 text-black border-amber-200' : 'bg-black/50 text-gray-300 border-white/10 hover:bg-white/10'}`}>
                  {v.toLocaleString()}
                </button>
              ))}
              <span className="text-[11px] text-gray-400 font-bold ml-1">× 5ライン = <span className="text-amber-300">{totalBet.toLocaleString()} G</span></span>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={toggleAuto}
                className={`px-4 py-3 rounded-xl font-black text-sm border transition active:scale-95 ${autoSpin ? 'bg-orange-600 border-orange-300 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                {autoSpin ? '🔄 AUTO' : 'AUTO'}
              </button>
              <GoldButton onClick={startSpin} disabled={!isIdle || balance < totalBet} className="py-3 px-8 md:px-12 rounded-full text-lg">
                {status === 'SPINNING'
                  ? <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPIN</span>
                  : 'SPIN'}
              </GoldButton>
            </div>
          </div>
        </div>

        {/* 台座 */}
        <div className="mx-auto h-4 rounded-b-3xl" style={{ width: '86%', background: 'linear-gradient(180deg,#160f04,#000)' }} />
      </div>

      {/* ペイテーブル */}
      <Panel className="mt-5 p-4 w-full max-w-[720px]">
        <button onClick={() => setShowPaytable(s => !s)} className="w-full flex items-center justify-between text-left">
          <div>
            <h3 className="text-sm font-black text-amber-200 tracking-[0.2em]">PAYTABLE</h3>
            <p className="text-[11px] text-gray-500">配当は「1ラインのベット額」×倍率。5ライン（上段/中段/下段/斜め2本）判定。</p>
          </div>
          <span className="text-gray-400 text-xs">{showPaytable ? '閉じる ▲' : '開く ▼'}</span>
        </button>
        {showPaytable && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SLOT_SYMBOLS.slice().reverse().map(s => (
                <div key={s.key} className="bg-black/50 rounded-xl p-2 text-center border border-white/10">
                  <div className="flex justify-center items-center h-10"><SlotSymbol idx={SLOT_SYMBOLS.findIndex(x => x.key === s.key)} size={0.5} /></div>
                  <div className="text-[10px] text-gray-500">×3</div>
                  <div className="font-black text-amber-300 text-sm">×{LINE_PAYS[s.key].toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                <div className="text-white font-bold mb-1">プレミアムミックス</div>
                <div className="text-gray-400">7 / BAR / 💎 が混ざって3つ揃い → <span className="text-amber-300 font-black">×{MIX_PREMIUM_PAY}</span></div>
              </div>
              <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                <div className="text-white font-bold mb-1">2つ揃い（左から）</div>
                <div className="text-gray-400">🍒🍒 / 🍋🍋 → <span className="text-amber-300 font-black">×{TWO_PAYS.CHERRY}</span></div>
              </div>
              <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                <div className="text-white font-bold mb-1">💎 スキャッター（ライン不問）</div>
                <div className="text-gray-400">3個 ×{SCATTER_PAYS[3]} ／ 4個 ×{SCATTER_PAYS[4]} ／ 5個 ×{SCATTER_PAYS[5]}</div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              各リールは24コマの固定ストリップ（チェリー5・レモン5・オレンジ4・ぶどう3・ベル2・メロン2・ダイヤ1・BAR1・セブン1）。
              理論還元率 <span className="text-emerald-300 font-bold">約96.2%</span>／当選率 <span className="text-emerald-300 font-bold">約37.8%</span>。
            </p>
          </div>
        )}
      </Panel>

      <style>{`
        @keyframes slotbulb { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes slotline { from { opacity: 0.45; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
