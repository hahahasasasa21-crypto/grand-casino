import React, { useRef, useEffect } from 'react';
import { PHASE_LABEL, phaseOf, RUNNING_STYLES } from './engine';

/* ==========================================================
   競馬中継ビュー
   ・奥行きのある芝コース（スタンド／並木／ラチ／芝目）を
     カメラが先頭馬を追いかける形で描画する。
   ・毎フレームの位置更新は ref で DOM に直接書き込む。
   ========================================================== */

const PX_PER_M = 5.0;     // 1mあたりの画面ピクセル（最前列基準）
const CAM_OFFSET = 52;    // カメラは先頭馬の何m後ろを映すか

/** 描画用の位置（シミュレーションの刻みの間を補間した値） */
const rp = (h) => (h.renderPos !== undefined ? h.renderPos : h.pos);
export { rp as renderPosOf };

/* ---------- 馬（SVGシルエット） ---------- */
export function HorseSprite({ silk, num, size = 1, running = true, phase = 0, boosted = false }) {
  const W = 132 * size, H = 84 * size;
  const legA = running ? `horsegallop 0.32s ${phase}s steps(1,end) infinite alternate` : 'none';
  const bobA = running ? `horsebob 0.32s ${phase}s ease-in-out infinite` : 'none';
  return (
    <svg width={W} height={H} viewBox="0 0 132 84" style={{ overflow: 'visible', filter: boosted ? 'drop-shadow(0 0 8px rgba(255,190,60,0.95))' : 'drop-shadow(0 6px 5px rgba(0,0,0,0.35))' }}>
      <defs>
        <linearGradient id={`hb${num}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4a2f" />
          <stop offset="60%" stopColor="#4a3220" />
          <stop offset="100%" stopColor="#2f1f13" />
        </linearGradient>
      </defs>
      <g style={{ animation: bobA }}>
        {/* 後ろ脚 */}
        <g style={{ animation: legA, transformOrigin: '38px 48px' }}>
          <path d="M40 46 l-6 16 l-5 10 l5 2 l7 -11 l5 -14 z" fill="#2a1c11" />
          <path d="M31 46 l-9 14 l-7 9 l5 3 l10 -10 l6 -13 z" fill="#241708" />
        </g>
        {/* 尻尾 */}
        <path d="M24 34 C14 32 8 40 4 50 C12 44 16 42 24 42 z" fill="#241708" />
        {/* 胴体 */}
        <path d="M26 42 C24 30 38 24 56 24 C74 24 86 27 93 31 C98 34 101 35 104 34 L104 44 C96 48 84 50 66 50 C44 50 30 50 26 42 z" fill={`url(#hb${num})`} />
        {/* 首・頭 */}
        <path d="M90 32 C96 24 104 16 112 12 C118 9 124 10 126 14 C128 18 124 22 120 24 L112 30 C108 34 104 36 100 37 z" fill="#4a3220" />
        <path d="M120 12 l6 -6 l1 6 z" fill="#2f1f13" />
        <circle cx="118" cy="18" r="1.6" fill="#0f0a06" />
        {/* たてがみ */}
        <path d="M92 28 C98 20 106 14 112 11 L110 17 C104 20 98 26 95 32 z" fill="#1c1208" />
        {/* 前脚 */}
        <g style={{ animation: running ? `horsegallop 0.32s ${phase + 0.16}s steps(1,end) infinite alternate-reverse` : 'none', transformOrigin: '88px 48px' }}>
          <path d="M86 46 l4 15 l2 11 l-6 1 l-5 -12 l-2 -14 z" fill="#2a1c11" />
          <path d="M95 45 l8 13 l7 8 l-5 4 l-9 -9 l-6 -13 z" fill="#241708" />
        </g>
        {/* 騎手 */}
        <g>
          <path d="M48 26 C50 16 60 10 68 12 C76 14 78 22 74 28 C68 32 54 32 48 26 z" fill={silk.bg} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
          <path d="M52 27 l-6 6 l4 4 l7 -6 z" fill={silk.bg} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
          <circle cx="74" cy="10" r="7" fill={silk.bg} stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <path d="M67 9 q7 -7 14 0 z" fill={silk.fg} opacity="0.8" />
          <text x="60" y="26" textAnchor="middle" fontSize="11" fontWeight="900" fill={silk.fg}>{num}</text>
        </g>
      </g>
    </svg>
  );
}

/* ---------- コースの俯瞰マップ（オーバル） ---------- */
export function OvalMap({ horses, dist, picks = [], turnDir = '左', size = 150 }) {
  const w = size * 1.5, h = size;
  const pad = 14;
  const rx = (w - pad * 2) / 2, ry = (h - pad * 2) / 2;
  const cx = w / 2, cy = h / 2;
  const straight = Math.max(10, rx - ry);
  const arc = Math.PI * ry;
  const total = 2 * straight + 2 * arc;

  // 進捗 p(0..1) → 楕円トラック上の座標。ゴールは下側直線の中央。
  const pointAt = (p) => {
    let d = ((p % 1) + 1) % 1 * total;
    const dir = turnDir === '左' ? 1 : -1;
    let x, y;
    if (d < straight) { x = cx - straight / 2 + d; y = cy + ry; }
    else if (d < straight + arc) {
      const a = (d - straight) / arc * Math.PI;
      x = cx + straight / 2 + Math.sin(a) * ry;
      y = cy + Math.cos(a) * ry;
    } else if (d < 2 * straight + arc) {
      x = cx + straight / 2 - (d - straight - arc); y = cy - ry;
    } else {
      const a = (d - 2 * straight - arc) / arc * Math.PI;
      x = cx - straight / 2 - Math.sin(a) * ry;
      y = cy - Math.cos(a) * ry;
    }
    if (dir === -1) x = 2 * cx - x;
    return { x, y };
  };

  const path = [];
  for (let i = 0; i <= 96; i++) {
    const { x, y } = pointAt(i / 96);
    path.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg width={w} height={h} className="select-none">
      <path d={path.join(' ')} fill="none" stroke="#0f3d26" strokeWidth={ry * 0.46} strokeLinecap="round" />
      <path d={path.join(' ')} fill="none" stroke="#1b7a44" strokeWidth={ry * 0.38} strokeLinecap="round" />
      <path d={path.join(' ')} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 5" />
      {/* ゴール板 */}
      {(() => { const g = pointAt(0); return <rect x={g.x - 1.5} y={g.y - ry * 0.24} width="3" height={ry * 0.48} fill="#fff" />; })()}
      {horses.map(h => {
        const { x, y } = pointAt(rp(h) / dist);
        const mine = picks.includes(h.id);
        return (
          <g key={h.id}>
            {mine && <circle cx={x} cy={y} r="6" fill="none" stroke="#fbbf24" strokeWidth="1.6" />}
            <circle cx={x} cy={y} r="4" fill={h.silk.bg} stroke="rgba(0,0,0,0.55)" strokeWidth="1" />
            <text x={x} y={y + 2.6} textAnchor="middle" fontSize="5.5" fontWeight="900" fill={h.silk.fg}>{h.num}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- メインの中継画面 ---------- */
export function Track3D({ simRef, card, picks, running, height = 380, speedLabel }) {
  const rootRef = useRef(null);
  const turfRef = useRef(null);
  const railRef = useRef(null);
  const treeRef = useRef(null);
  const standRef = useRef(null);
  const markerRef = useRef(null);
  const horseRefs = useRef({});
  const popupRefs = useRef({});
  const rafRef = useRef(null);

  const n = card.entries.length;
  const skyA = card.weather.sky[0], skyB = card.weather.sky[1];
  const horizonY = Math.round(height * 0.40);
  const groundH = height - horizonY;
  const standTop = Math.round(horizonY * 0.30);
  const standH = horizonY - standTop - 10;


  useEffect(() => {
    const paint = () => {
      const sim = simRef.current;
      const root = rootRef.current;
      if (sim && root) {
        const W = root.clientWidth || 800;
        const horses = sim.horses;
        let lead = horses[0];
        for (const h of horses) if (rp(h) > rp(lead)) lead = h;
        const camPos = Math.max(0, rp(lead) - CAM_OFFSET);

        // 背景のパララックス
        const bg = camPos * PX_PER_M;
        if (standRef.current) standRef.current.style.backgroundPositionX = `${-bg * 0.06}px`;
        if (treeRef.current) treeRef.current.style.backgroundPositionX = `${-bg * 0.16}px`;
        if (railRef.current) railRef.current.style.backgroundPositionX = `${-bg * 0.62}px`;
        if (turfRef.current) turfRef.current.style.backgroundPositionX = `${-bg}px`;

        // 残り距離マーカー
        if (markerRef.current) {
          const left = Math.max(0, card.distance - rp(lead));
          markerRef.current.textContent = left <= 0 ? 'GOAL!' : `残り ${Math.round(left / 10) * 10} m`;
        }

        for (let i = 0; i < n; i++) {
          const h = horses[i];
          const el = horseRefs.current[h.id];
          if (!el) continue;
          // 奥行き：内ラチ側(レーン0)ほど遠い
          const t = n > 1 ? (n - 1 - h.lane) / (n - 1) : 0;   // 0=最外(手前) 1=最内(奥)
          const depth = 1 + t * 0.85;
          const scale = 1 / depth;
          const x = W * 0.26 + (rp(h) - camPos) * PX_PER_M * scale;
          const y = horizonY + 14 + (groundH - 30) * (1 - t) ** 1.25;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.zIndex = String(10 + Math.round(h.lane));
          el.style.opacity = x < -140 || x > W + 140 ? '0' : '1';

          // スキル発動ポップ
          const pop = popupRefs.current[h.id];
          if (pop) {
            const a = h.lastActivation;
            if (a && sim.state.t - a.t < 1.6) {
              pop.textContent = a.name;
              pop.style.opacity = '1';
              pop.style.background = a.bad ? 'rgba(100,116,139,0.95)' : 'rgba(251,191,36,0.96)';
              pop.style.color = a.bad ? '#fff' : '#1a1205';
              pop.style.transform = `translateY(${-8 - (sim.state.t - a.t) * 10}px)`;
            } else {
              pop.style.opacity = '0';
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(paint);
    };
    rafRef.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(rafRef.current);
  }, [simRef, card.distance, n, horizonY, groundH]);

  return (
    <div ref={rootRef} className="relative overflow-hidden rounded-2xl select-none"
      style={{ height, border: '6px solid #1d1205', boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>

      {/* 空 */}
      <div className="absolute inset-x-0 top-0" style={{ height: horizonY + 6, background: `linear-gradient(180deg, ${skyA} 0%, ${skyB} 100%)` }} />
      {/* 雲 */}
      <div className="absolute inset-x-0" style={{
        top: 4, height: standTop - 2, opacity: 0.55,
        backgroundImage: 'radial-gradient(ellipse 60px 16px at 50% 60%, #fff 0%, rgba(255,255,255,0) 70%)',
        backgroundSize: '260px 100%', backgroundRepeat: 'repeat-x',
      }} />

      {/* スタンド（屋根＋観客席） */}
      <div ref={standRef} className="absolute" style={{
        left: 0, right: 0, top: standTop, height: standH,
        backgroundRepeat: 'repeat-x', backgroundSize: '320px 100%',
        backgroundImage:
          // 支柱
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.13) 0 3px, transparent 3px 26px),' +
          // 建物本体
          'linear-gradient(180deg, #8d97a5 0%, #6b7683 26%, #566170 60%, #3f4854 100%)',
      }}>
        {/* 屋根 */}
        <div className="absolute inset-x-0 top-0" style={{
          height: Math.max(6, standH * 0.22),
          background: 'linear-gradient(180deg,#f1f5f9 0%,#cbd5e1 55%,#94a3b8 100%)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.45)',
        }} />
        {/* 観客 */}
        <div className="absolute inset-x-0" style={{
          top: standH * 0.34, height: standH * 0.5,
          backgroundImage:
            'repeating-linear-gradient(90deg, #cbd5e1 0 3px, #94a3b8 3px 6px, #e2e8f0 6px 9px, #a3b2c4 9px 12px, #d7dee7 12px 15px),' +
            'repeating-linear-gradient(180deg, rgba(0,0,0,0.4) 0 1px, transparent 1px 5px)',
          opacity: 0.5,
        }} />
        {/* 最前列の手すり */}
        <div className="absolute inset-x-0 bottom-0" style={{ height: 3, background: 'rgba(255,255,255,0.6)' }} />
      </div>

      {/* 生垣・並木 */}
      <div ref={treeRef} className="absolute" style={{
        left: 0, right: 0, top: horizonY - 22, height: 24,
        backgroundImage:
          'radial-gradient(circle at 50% 100%, #166534 0 12px, rgba(22,101,52,0) 13px),' +
          'radial-gradient(circle at 50% 100%, #14532d 0 9px, rgba(20,83,45,0) 10px)',
        backgroundSize: '38px 24px, 22px 16px',
        backgroundPosition: '0 0, 11px 8px',
        backgroundRepeat: 'repeat-x',
      }} />

      {/* 外ラチ（白い柵） */}
      <div ref={railRef} className="absolute" style={{
        left: 0, right: 0, top: horizonY - 3, height: 9,
        backgroundImage: 'repeating-linear-gradient(90deg, #f8fafc 0 3px, transparent 3px 30px)',
        backgroundRepeat: 'repeat-x',
        borderTop: '2px solid #eef2f7', borderBottom: '1px solid rgba(255,255,255,0.4)',
      }} />

      {/* 芝 */}
      <div className="absolute inset-x-0" style={{ top: horizonY + 6, bottom: 0, overflow: 'hidden', perspective: 520 }}>
        <div ref={turfRef} className="absolute inset-0" style={{
          transform: 'rotateX(60deg) scale(1.35, 2.6)', transformOrigin: 'center top',
          background:
            `repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 64px, rgba(0,0,0,0.035) 64px 128px),` +
            `linear-gradient(180deg, #2f9757 0%, #268049 40%, #1d6a3c 100%)`,
          backgroundRepeat: 'repeat', backgroundSize: '128px 100%, 100% 100%',
        }} />
        {/* 遠近の空気感 */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(180,220,190,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.28) 100%)',
        }} />
      </div>

      {/* 内ラチ（芝の一番奥） */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: horizonY + 8, height: 4,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.9) 0 3px, rgba(255,255,255,0.22) 3px 22px)',
      }} />

      {card.weather.name.includes('雨') && (
        <div className="absolute inset-0 pointer-events-none opacity-35" style={{
          backgroundImage: 'repeating-linear-gradient(105deg, rgba(255,255,255,0.45) 0 1px, transparent 1px 7px)',
          animation: 'rainfall 0.45s linear infinite',
        }} />
      )}

      {/* 馬 */}
      {card.entries.map((e, i) => (
        <div key={e.id} ref={el => { horseRefs.current[e.id] = el; }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ transform: 'translate3d(-999px,0,0)', transformOrigin: 'left bottom' }}>
          <div className="relative" style={{ marginLeft: -54, marginTop: -64 }}>
            <div ref={el => { popupRefs.current[e.id] = el; }}
              className="absolute left-1/2 -translate-x-1/2 -top-2 px-2 py-0.5 rounded-full text-[11px] font-black whitespace-nowrap pointer-events-none transition-opacity"
              style={{ opacity: 0 }} />
            {picks.includes(e.id) && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-8 text-amber-300 text-lg font-black drop-shadow">▼</div>
            )}
            <HorseSprite silk={e.silk} num={e.num} running={running} phase={(i % 5) * 0.06} size={0.82} />
          </div>
        </div>
      ))}

      {/* ゴール板（先頭がゴール付近のときだけ意味を持つ簡易表示） */}
      <div className="absolute top-2 left-2 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-black border border-white/15">
          {card.course.label}
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-black/60 text-emerald-300 text-[11px] font-black border border-white/15">
          {card.weather.icon} {card.weather.name}・馬場{card.turf}
        </span>
        {speedLabel && <span className="px-2.5 py-1 rounded-lg bg-black/60 text-amber-300 text-[11px] font-black border border-white/15">{speedLabel}</span>}
      </div>
      <div ref={markerRef} className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-black/70 text-amber-300 text-sm font-black border border-amber-400/30 font-mono" />

      <style>{`
        @keyframes horsebob { 0%,100% { transform: translateY(0) rotate(-1deg);} 50% { transform: translateY(-5px) rotate(1.5deg);} }
        @keyframes horsegallop { 0% { transform: rotate(-22deg);} 100% { transform: rotate(20deg);} }
        @keyframes rainfall { from { background-position: 0 0; } to { background-position: -24px 90px; } }
      `}</style>
    </div>
  );
}

/* ---------- 着順ボード ---------- */
export function OrderBoard({ simRef, card, picks, compact = false }) {
  const rowsRef = useRef({});
  const rafRef = useRef(null);

  useEffect(() => {
    const rowH = compact ? 26 : 32;
    const paint = () => {
      const sim = simRef.current;
      if (sim) {
        const horses = sim.horses;
        const lead = horses.reduce((a, b) => (rp(b) > rp(a) ? b : a), horses[0]);
        for (const h of horses) {
          const r = rowsRef.current[h.id];
          if (!r) continue;
          r.root.style.transform = `translateY(${(h.rank - 1) * rowH}px)`;
          r.rank.textContent = h.rank;
          const st = Math.max(0, Math.min(100, (h.stamina / h.maxStamina) * 100));
          r.bar.style.width = `${st}%`;
          r.bar.style.background = st > 55 ? '#22c55e' : st > 25 ? '#eab308' : '#ef4444';
          if (h.finishTime !== null) {
            const w = horses.reduce((a, b) => (b.finishTime !== null && (a.finishTime === null || b.finishTime < a.finishTime) ? b : a), horses[0]);
            const d = h.finishTime - (w.finishTime || 0);
            r.gap.textContent = h.rank === 1 ? `${h.finishTime.toFixed(1)}s` : `+${d.toFixed(2)}s`;
          } else {
            const gap = (rp(lead) - rp(h)) / 2.4;
            r.gap.textContent = h.rank === 1 ? '先頭' : `${gap < 0.15 ? 'ハナ' : gap.toFixed(1) + '馬身'}`;
          }
        }
      }
      rafRef.current = requestAnimationFrame(paint);
    };
    rafRef.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(rafRef.current);
  }, [simRef, compact]);

  const rowH = compact ? 26 : 32;
  return (
    <div className="relative" style={{ height: card.entries.length * rowH }}>
      {card.entries.map(e => (
        <div key={e.id}
          ref={el => {
            if (!el) return;
            rowsRef.current[e.id] = {
              root: el,
              rank: el.querySelector('[data-rank]'),
              bar: el.querySelector('[data-bar]'),
              gap: el.querySelector('[data-gap]'),
            };
          }}
          className="absolute inset-x-0 flex items-center gap-1.5 px-1.5 rounded-md transition-transform duration-150 ease-out"
          style={{ height: rowH - 3, background: picks.includes(e.id) ? 'rgba(251,191,36,0.16)' : 'rgba(0,0,0,0.35)' }}>
          <span data-rank className="w-4 text-center text-[11px] font-black text-amber-300" />
          <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0"
            style={{ background: e.silk.bg, color: e.silk.fg }}>{e.num}</span>
          <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-white">{e.name}</span>
          <span className="w-12 shrink-0 h-1.5 bg-black/50 rounded-full overflow-hidden">
            <span data-bar className="block h-full rounded-full" style={{ width: '100%', background: '#22c55e' }} />
          </span>
          <span data-gap className="w-12 shrink-0 text-right text-[10px] text-gray-400 font-mono" />
        </div>
      ))}
    </div>
  );
}

export { PHASE_LABEL, phaseOf, RUNNING_STYLES };
