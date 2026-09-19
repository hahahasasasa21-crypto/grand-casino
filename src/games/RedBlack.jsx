import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Volume2, VolumeX, Undo2, Trash2 } from 'lucide-react';
import { Panel, GoldButton, Chip, playSfx, TAU } from '../shared/ui';

/* ==========================================================
   RED & BLACK — 3Dヨーロピアンルーレット
   ・ホイールは傾けた円盤（CSS 3D）。玉はホイールとは逆回りに
     外周トラックを回り、減速 → 内側へ落ちる → フレットで跳ねる →
     ポケットに収まる、という実機と同じ流れで動く。
   ・当選番号は先に抽選し、最後の「落ち着く」区間で
     玉とホイールの相対角度を目標ポケットへ寄せるので、
     見た目と結果が絶対にズレない。
   ========================================================== */

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// 本物のヨーロピアンホイールの並び（時計回り）
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const numColor = (n) => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');

const CHIP_DENOMS = [
  { v: 100, color: '#dc2626' },
  { v: 500, color: '#2563eb' },
  { v: 1000, color: '#16a34a' },
  { v: 5000, color: '#7c3aed' },
  { v: 10000, color: '#b45309' },
  { v: 50000, color: '#0f172a' },
];

/** 払戻は「賭け金を含む総額の倍率」 */
const OUTSIDE_BETS = [
  { id: 'LOW', label: '1-18', mult: 2, test: n => n >= 1 && n <= 18 },
  { id: 'EVEN', label: 'EVEN', mult: 2, test: n => n !== 0 && n % 2 === 0 },
  { id: 'RED', label: '赤', mult: 2, test: n => numColor(n) === 'red' },
  { id: 'BLACK', label: '黒', mult: 2, test: n => numColor(n) === 'black' },
  { id: 'ODD', label: 'ODD', mult: 2, test: n => n % 2 === 1 },
  { id: 'HIGH', label: '19-36', mult: 2, test: n => n >= 19 && n <= 36 },
];
const DOZENS = [
  { id: 'D1', label: '1st 12', mult: 3, test: n => n >= 1 && n <= 12 },
  { id: 'D2', label: '2nd 12', mult: 3, test: n => n >= 13 && n <= 24 },
  { id: 'D3', label: '3rd 12', mult: 3, test: n => n >= 25 && n <= 36 },
];
const COLUMNS = [
  { id: 'C3', label: '2:1', mult: 3, test: n => n > 0 && n % 3 === 0 },
  { id: 'C2', label: '2:1', mult: 3, test: n => n > 0 && n % 3 === 2 },
  { id: 'C1', label: '2:1', mult: 3, test: n => n > 0 && n % 3 === 1 },
];
const ALL_BETS = [...OUTSIDE_BETS, ...DOZENS, ...COLUMNS];
const STRAIGHT_MULT = 36;

const SLICE = TAU / WHEEL_ORDER.length;
const TILT = 58;          // ホイールの傾き(deg)
const R_TRACK = 214;      // 玉が回る外周トラック半径
const R_POCKET = 158;     // ポケットの半径
const DISC = 480;         // 円盤の描画サイズ(px)

/* ---------- ホイールの絵（SVY） ---------- */
const WheelFace = React.memo(function WheelFace({ highlight }) {
  const C = 200, R = 196;
  const sectors = WHEEL_ORDER.map((n, i) => {
    const a0 = i * SLICE - Math.PI / 2 - SLICE / 2;
    const a1 = a0 + SLICE;
    const rOut = R, rIn = R * 0.60;
    const p = (r, a) => `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
    const d = `M${p(rIn, a0)} L${p(rOut, a0)} A${rOut},${rOut} 0 0 1 ${p(rOut, a1)} L${p(rIn, a1)} A${rIn},${rIn} 0 0 0 ${p(rIn, a0)} Z`;
    const c = numColor(n);
    const fill = c === 'green' ? '#0b7a45' : c === 'red' ? '#b3161b' : '#131313';
    const mid = a0 + SLICE / 2;
    const tr = R * 0.79;
    return (
      <g key={n}>
        <path d={d} fill={fill} stroke={highlight === n ? '#fde047' : 'rgba(212,175,55,0.55)'} strokeWidth={highlight === n ? 3 : 0.9} />
        <text
          x={C + tr * Math.cos(mid)} y={C + tr * Math.sin(mid)}
          fill="#fff" fontSize="15" fontWeight="900" textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(${(mid * 180 / Math.PI) + 90}, ${C + tr * Math.cos(mid)}, ${C + tr * Math.sin(mid)})`}
        >{n}</text>
      </g>
    );
  });
  return (
    <svg viewBox="0 0 400 400" width={DISC} height={DISC} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="rlHub" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#f6d98a" />
          <stop offset="45%" stopColor="#b9862b" />
          <stop offset="100%" stopColor="#3a2708" />
        </radialGradient>
        <radialGradient id="rlCone" cx="40%" cy="30%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="60%" stopColor="#c8952f" />
          <stop offset="100%" stopColor="#6b4712" />
        </radialGradient>
      </defs>
      {/* ポケット外周のリング */}
      <circle cx={C} cy={C} r={R + 2} fill="#1b1206" stroke="#d4af37" strokeWidth="4" />
      {sectors}
      {/* 仕切り(フレット) */}
      {WHEEL_ORDER.map((n, i) => {
        const a = i * SLICE - Math.PI / 2 - SLICE / 2;
        return <line key={'f' + n} x1={C + R * 0.60 * Math.cos(a)} y1={C + R * 0.60 * Math.sin(a)}
          x2={C + R * Math.cos(a)} y2={C + R * Math.sin(a)} stroke="#e8d9a8" strokeWidth="1.6" opacity="0.85" />;
      })}
      {/* 中央のハブとタレット */}
      <circle cx={C} cy={C} r={R * 0.60} fill="url(#rlHub)" stroke="#8a6416" strokeWidth="2" />
      <circle cx={C} cy={C} r={R * 0.40} fill="url(#rlCone)" stroke="#6b4712" strokeWidth="1.5" />
      {[0, 1, 2, 3].map(i => {
        const a = i * Math.PI / 2 + Math.PI / 4;
        return <ellipse key={i} cx={C + R * 0.5 * Math.cos(a)} cy={C + R * 0.5 * Math.sin(a)} rx="7" ry="16"
          transform={`rotate(${a * 180 / Math.PI + 90}, ${C + R * 0.5 * Math.cos(a)}, ${C + R * 0.5 * Math.sin(a)})`}
          fill="#e8c874" opacity="0.65" />;
      })}
      <circle cx={C} cy={C} r={R * 0.14} fill="#2b1d06" stroke="#d4af37" strokeWidth="2" />
    </svg>
  );
});

/* ---------- 3Dホイール ---------- */
function Wheel3D({ wheelRef, ballRef, highlight }) {
  return (
    <div className="relative mx-auto" style={{ width: DISC, height: DISC * 0.78, perspective: 1100, maxWidth: '100%' }}>
      <div className="absolute left-1/2 top-1/2" style={{
        transform: `translate(-50%,-50%) rotateX(${TILT}deg)`,
        transformStyle: 'preserve-3d',
        width: DISC, height: DISC,
      }}>
        {/* 木製ボウル（固定） */}
        <div className="absolute left-1/2 top-1/2 rounded-full" style={{
          width: DISC * 1.16, height: DISC * 1.16, transform: 'translate(-50%,-50%) translateZ(-16px)',
          background: 'radial-gradient(circle at 36% 28%, #7b4f22 0%, #4a2d11 45%, #2a1808 72%, #150c04 100%)',
          boxShadow: '0 0 0 6px #2b1a09, 0 26px 60px rgba(0,0,0,0.75)',
        }} />
        {/* 玉が走るトラック */}
        <div className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{
          width: R_TRACK * 2 + 34, height: R_TRACK * 2 + 34, transform: 'translate(-50%,-50%) translateZ(-4px)',
          background: 'radial-gradient(circle, rgba(0,0,0,0) 0 46%, rgba(255,235,190,0.10) 47%, rgba(0,0,0,0.35) 52%, rgba(0,0,0,0) 60%)',
          boxShadow: 'inset 0 0 26px rgba(0,0,0,0.6)',
        }} />
        {/* デフレクター（ひし形の障害） */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
          const a = (i / 8) * TAU + 0.2;
          const r = R_TRACK - 32;
          return (
            <div key={i} className="absolute left-1/2 top-1/2" style={{
              width: 14, height: 14, marginLeft: -7, marginTop: -7,
              transform: `translate(${(r * Math.cos(a)).toFixed(1)}px, ${(r * Math.sin(a)).toFixed(1)}px) translateZ(5px) rotate(45deg)`,
              background: 'linear-gradient(135deg,#f5e7bd,#b98f35)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }} />
          );
        })}

        {/* 回転する円盤 */}
        <div ref={wheelRef} className="absolute left-1/2 top-1/2" style={{
          width: DISC, height: DISC, marginLeft: -DISC / 2, marginTop: -DISC / 2,
          willChange: 'transform', transformStyle: 'preserve-3d',
        }}>
          <WheelFace highlight={highlight} />
        </div>

        {/* 玉 */}
        <div ref={ballRef} className="absolute left-1/2 top-1/2 pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
          <div style={{
            width: 20, height: 20, marginLeft: -10, marginTop: -10, borderRadius: '50%',
            transform: `rotateX(${-TILT}deg)`,
            background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e8eaef 40%, #9aa1ac 75%, #5b626d 100%)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.65), inset -2px -3px 5px rgba(0,0,0,0.25)',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- テーブルのマス ---------- */
function Cell({ onPlace, onRemove, amount, children, className = '', style }) {
  return (
    <button
      onClick={onPlace}
      onContextMenu={e => { e.preventDefault(); onRemove(); }}
      className={`relative select-none font-black text-white border border-white/30 hover:brightness-125 active:scale-95 transition ${className}`}
      style={style}>
      {children}
      {amount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 z-10">
          <Chip value={amount >= 1000 ? Math.round(amount / 1000) + 'K' : amount} color="#eab308" size={22} />
        </span>
      )}
    </button>
  );
}

/* ---------- 本体 ---------- */
export default function RedBlackView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState({});
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState('BETTING');   // BETTING | SPINNING | RESULT
  const [result, setResult] = useState(null);
  const [payout, setPayout] = useState(0);
  const [staked, setStaked] = useState(0);
  const [sound, setSound] = useState(true);
  const [lastBets, setLastBets] = useState(null);

  const wheelRef = useRef(null);
  const ballRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef('BETTING');
  const mountedRef = useRef(true);
  const soundRef = useRef(true);
  const restRef = useRef({ wheel: 0, phi: 0 });   // 静止中の角度

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const totalBet = useMemo(() => Object.values(bets).reduce((a, b) => a + b, 0), [bets]);

  /* --- 描画 --- */
  const draw = useCallback((wheelAngle, phi, r, z) => {
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${(wheelAngle * 180 / Math.PI).toFixed(2)}deg)`;
    if (ballRef.current) {
      const a = wheelAngle + phi;
      const x = r * Math.cos(a), y = r * Math.sin(a);
      ballRef.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateZ(${(10 + z).toFixed(1)}px)`;
    }
  }, []);

  // 初期表示（静止状態）
  useEffect(() => { draw(restRef.current.wheel, restRef.current.phi, R_POCKET, 0); }, [draw]);

  /* --- ベット操作 --- */
  const place = (key) => {
    if (phaseRef.current !== 'BETTING') return;
    if (totalBet + chip > balance) { showToast('所持金を超えるベットはできません。', 'error'); return; }
    setBets(prev => ({ ...prev, [key]: (prev[key] || 0) + chip }));
    playSfx('click', soundRef.current);
  };
  const remove = (key) => {
    if (phaseRef.current !== 'BETTING') return;
    setBets(prev => { const n = { ...prev }; delete n[key]; return n; });
  };
  const clearAll = () => { if (phaseRef.current === 'BETTING') setBets({}); };
  const repeatBets = () => {
    if (phaseRef.current !== 'BETTING' || !lastBets) return;
    const sum = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (sum > balance) { showToast('所持金が足りません。', 'error'); return; }
    setBets({ ...lastBets });
  };

  /* --- スピン --- */
  const spin = async () => {
    if (phaseRef.current !== 'BETTING') return;
    if (totalBet <= 0) { showToast('チップを置いてください。', 'error'); return; }
    if (totalBet > balance) { showToast('残高が足りません。', 'error'); return; }
    const snapshot = { ...bets };
    try { await updateBalance(-totalBet); } catch (e) { return; }
    setLastBets(snapshot);
    setStaked(totalBet);
    setPhase('SPINNING'); phaseRef.current = 'SPINNING';
    setResult(null); setPayout(0);
    playSfx('stop', soundRef.current);

    // 抽選
    const idx = Math.floor(Math.random() * WHEEL_ORDER.length);
    const number = WHEEL_ORDER[idx];
    // ポケット i の中心は、円盤ローカル角 (i*SLICE - π/2)。
    // 玉はホイールに対して phiTarget の位置で止まればよい。
    const phiTarget = idx * SLICE - Math.PI / 2;

    let wheel = restRef.current.wheel;
    let phi = restRef.current.phi;
    let wOmega = 1.9 + Math.random() * 0.5;            // ホイール（時計回り）
    let bOmega = -(9.5 + Math.random() * 2.0);         // 玉（逆回り）
    const T_SPIN = 3.9 + Math.random() * 0.7;
    const T_DROP = 1.35;
    const T_SET = 1.15;
    const total = T_SPIN + T_DROP + T_SET;

    let locked = false, phiAtLock = 0, delta = 0, dropPhi = 0, dropW = 0;
    let lastTick = 0;
    const t0 = performance.now();

    const loop = (now) => {
      if (!mountedRef.current) return;
      const t = (now - t0) / 1000;
      const dt = 1 / 60;

      // ホイールはゆっくり減速
      wOmega = Math.max(0.55, wOmega - 0.09 * dt * 6);
      wheel += wOmega * dt;

      let r = R_TRACK, z = 0;
      if (t < T_SPIN) {
        bOmega = Math.min(-1.6, bOmega + 2.05 * dt * (t > T_SPIN * 0.45 ? 1.8 : 1));
        phi += (bOmega - wOmega) * dt;
        r = R_TRACK;
        z = 2;
        if (t - lastTick > 0.10 + t * 0.03) { lastTick = t; playSfx('tick', soundRef.current); }
      } else if (t < T_SPIN + T_DROP) {
        // 内側へ落ちる＋フレットで跳ねる
        const k = (t - T_SPIN) / T_DROP;
        bOmega = Math.min(-0.8, bOmega + 1.5 * dt);
        phi += (bOmega - wOmega) * dt;
        r = R_TRACK + (R_POCKET - R_TRACK) * (k * k * (3 - 2 * k));
        z = Math.abs(Math.sin(k * Math.PI * 3.2)) * 13 * (1 - k);
        if (t - lastTick > 0.16) { lastTick = t; playSfx('tick', soundRef.current); }
        dropPhi = phi; dropW = wheel;
      } else if (t < total) {
        if (!locked) {
          locked = true;
          phiAtLock = dropPhi;
          // 目標へ「少し戻る」形で寄せる（実機と同じく玉が落ち着く動き）
          let d = (phiTarget - phiAtLock) % TAU;
          if (d > 0) d -= TAU;
          if (d < -TAU) d += TAU;
          delta = d;
        }
        const k = Math.min(1, (t - (T_SPIN + T_DROP)) / T_SET);
        const e = 1 - Math.pow(1 - k, 3);
        phi = phiAtLock + delta * e;
        r = R_POCKET;
        z = Math.abs(Math.sin(k * Math.PI * 2)) * 5 * (1 - k);
      } else {
        phi = phiTarget;
        r = R_POCKET; z = 0;
        restRef.current = { wheel, phi };
        draw(wheel, phi, r, z);
        finish(number, snapshot);
        return;
      }
      draw(wheel, phi, r, z);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const finish = async (number, snapshot) => {
    let win = 0;
    ALL_BETS.forEach(b => { if (snapshot[b.id] && b.test(number)) win += snapshot[b.id] * b.mult; });
    const sk = 'N' + number;
    if (snapshot[sk]) win += snapshot[sk] * STRAIGHT_MULT;

    if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
    if (!mountedRef.current) return;
    setResult(number); setPayout(win);
    setPhase('RESULT'); phaseRef.current = 'RESULT';
    setHistory(prev => [number, ...prev].slice(0, 16));
    const stakedNow = Object.values(snapshot).reduce((a, b) => a + b, 0);
    if (win > 0) {
      playSfx(win - stakedNow >= stakedNow * 8 ? 'big' : 'win', soundRef.current);
      showToast(`🎯 ${number}（${numColor(number) === 'red' ? '赤' : numColor(number) === 'black' ? '黒' : '緑'}）！ +${win.toLocaleString()} Y`, 'success');
      if (win - stakedNow >= 50000) emitNews(`🔴 ${playerName} がルーレットで ${number} を的中！ +${(win - stakedNow).toLocaleString()} Y！`, 'jackpot');
    } else {
      playSfx('lose', soundRef.current);
      showToast(`😢 ${number} …ハズレ`, 'error');
    }
  };

  const nextGame = () => { setPhase('BETTING'); phaseRef.current = 'BETTING'; setResult(null); setBets({}); };

  const numColorBg = (n) => (numColor(n) === 'red' ? '#b3161b' : numColor(n) === 'black' ? '#141414' : '#0b7a45');

  /* ---------- テーブル ---------- */
  const rows = [3, 2, 1].map(off => Array.from({ length: 12 }, (_, i) => i * 3 + off));

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto">
      <div className="w-full flex justify-between items-center mb-4">
        <button onClick={onBack} disabled={phase === 'SPINNING'}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-3">
          <button onClick={() => setSound(s => !s)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition">
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{balance.toLocaleString()} Y</div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* ===== ホイール ===== */}
        <div className="xl:w-[46%]">
          <Panel gold className="p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-black text-white tracking-wide">EUROPEAN ROULETTE</h2>
              <span className="text-[10px] text-gray-500 font-bold">シングルゼロ・37ポケット</span>
            </div>

            <div className="relative -mx-2">
              <Wheel3D wheelRef={wheelRef} ballRef={ballRef} highlight={phase === 'RESULT' ? result : null} />
              {phase === 'SPINNING' && (
                <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
                  <span className="px-4 py-1 rounded-full bg-black/70 text-amber-300 text-xs font-black border border-amber-400/30">NO MORE BETS</span>
                </div>
              )}
            </div>

            {phase === 'RESULT' && result !== null && (
              <div className={`mt-2 p-3 rounded-2xl border-2 ${payout > 0 ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white border-2 border-white/30"
                    style={{ background: numColorBg(result) }}>{result}</div>
                  <div className="text-left">
                    {payout > 0
                      ? <>
                        <div className="text-2xl font-black text-emerald-400">+{payout.toLocaleString()} Y</div>
                        <div className={`text-xs font-bold ${payout - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          収支 {payout - staked >= 0 ? '+' : ''}{(payout - staked).toLocaleString()} Y
                        </div>
                      </>
                      : <>
                        <div className="text-2xl font-black text-red-400">ハズレ</div>
                        <div className="text-red-400/80 text-xs">-{staked.toLocaleString()} Y</div>
                      </>}
                  </div>
                </div>
                <GoldButton onClick={nextGame} className="w-full mt-3 py-2.5">次のゲームへ</GoldButton>
              </div>
            )}

            {history.length > 0 && (
              <div className="mt-3 bg-black/40 border border-white/10 rounded-2xl p-2.5">
                <div className="text-[10px] font-black text-gray-500 tracking-[0.25em] mb-1.5">RECENT</div>
                <div className="flex flex-wrap gap-1">
                  {history.map((n, i) => (
                    <div key={i} className="w-7 h-7 rounded-full text-[11px] flex items-center justify-center font-black text-white border border-white/15"
                      style={{ background: numColorBg(n) }}>{n}</div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ===== テーブル ===== */}
        <div className="xl:w-[54%] space-y-3">
          <Panel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">チップを選ぶ</h3>
              <span className="text-[10px] text-gray-500">クリックで配置／右クリックで取消</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHIP_DENOMS.map(c => (
                <button key={c.v} onClick={() => setChip(c.v)}
                  className={`rounded-full transition ${chip === c.v ? 'scale-110 ring-4 ring-amber-300' : 'opacity-75 hover:opacity-100'}`}>
                  <Chip value={c.v >= 1000 ? c.v / 1000 + 'K' : c.v} color={c.color} size={42} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="rounded-2xl p-2.5 border-2 border-amber-900/50"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 80%)' }}>

              <div className="flex gap-1">
                {/* 0 */}
                <Cell onPlace={() => place('N0')} onRemove={() => remove('N0')} amount={bets.N0}
                  className="w-9 rounded-l-lg text-sm" style={{ background: '#0b7a45', minHeight: 120 }}>
                  <span style={{ writingMode: 'vertical-rl' }}>0</span>
                </Cell>

                {/* 1-36 */}
                <div className="flex-1 grid grid-rows-3 gap-1">
                  {rows.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-12 gap-1">
                      {row.map(n => (
                        <Cell key={n} onPlace={() => place('N' + n)} onRemove={() => remove('N' + n)} amount={bets['N' + n]}
                          className="h-9 rounded text-[12px]" style={{ background: numColorBg(n) }}>
                          {n}
                        </Cell>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 2:1 列 */}
                <div className="grid grid-rows-3 gap-1 w-11">
                  {COLUMNS.map(c => (
                    <Cell key={c.id} onPlace={() => place(c.id)} onRemove={() => remove(c.id)} amount={bets[c.id]}
                      className="h-9 rounded text-[11px] bg-emerald-800/80">{c.label}</Cell>
                  ))}
                </div>
              </div>

              {/* ダズン */}
              <div className="grid grid-cols-3 gap-1 mt-1 ml-10 mr-12">
                {DOZENS.map(d => (
                  <Cell key={d.id} onPlace={() => place(d.id)} onRemove={() => remove(d.id)} amount={bets[d.id]}
                    className="h-8 rounded text-[11px] bg-emerald-800/80">{d.label}</Cell>
                ))}
              </div>

              {/* アウトサイド */}
              <div className="grid grid-cols-6 gap-1 mt-1 ml-10 mr-12">
                {OUTSIDE_BETS.map(b => (
                  <Cell key={b.id} onPlace={() => place(b.id)} onRemove={() => remove(b.id)} amount={bets[b.id]}
                    className="h-8 rounded text-[11px]"
                    style={{ background: b.id === 'RED' ? '#b3161b' : b.id === 'BLACK' ? '#141414' : 'rgba(6,78,59,0.8)' }}>
                    {b.label}
                  </Cell>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex-1 min-w-[120px]">
                <div className="text-[10px] text-gray-400 font-bold">合計ベット</div>
                <div className="font-mono text-2xl font-black text-amber-300">{totalBet.toLocaleString()} Y</div>
              </div>
              <button onClick={repeatBets} disabled={phase !== 'BETTING' || !lastBets}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2.5 px-3 rounded-xl transition disabled:opacity-30 text-xs">
                <Undo2 size={14} /> 同じ賭け
              </button>
              <button onClick={clearAll} disabled={phase !== 'BETTING' || totalBet === 0}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2.5 px-3 rounded-xl transition disabled:opacity-30 text-xs">
                <Trash2 size={14} /> 全撤去
              </button>
              <GoldButton onClick={spin} disabled={phase !== 'BETTING' || totalBet <= 0} className="py-2.5 px-6 text-base">
                {phase === 'SPINNING'
                  ? <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> SPIN</span>
                  : 'ボールを投げる'}
              </GoldButton>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              配当（賭け金込みの総額）：ストレート ×36／赤・黒・偶奇・1-18・19-36 ×2／ダズン・2:1列 ×3。0 が出た場合、アウトサイドはすべてハズレです。
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
