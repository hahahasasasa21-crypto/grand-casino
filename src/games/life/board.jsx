import React, { useEffect, useMemo, useRef } from 'react';
import { BOARD, SPACE_STYLE, REGIONS } from './engine.js';
import { VIEW_W, VIEW_H, ROAD_D, ROAD_PTS, tileAt, offsetFrom } from './track.js';

/* ==========================================================
   人生ゲーム — 盤面・ルーレット・イベントカード（見た目まわり）
   ========================================================== */

const N = BOARD.length;
const TW = 62, TH = 54;          // マスの大きさ
const TOKEN_PERP = 39;           // 道からコマを離す距離
const TOKEN_ALONG = 24;          // 同じ側のコマ同士の間隔

/* ---------- 風景の配置（毎回同じになるよう固定シード） ---------- */
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BANDS = [
  { y0: 4, y1: 206, kinds: ['tree', 'tree', 'tree', 'flower', 'flower', 'school'] },
  { y0: 200, y1: 372, kinds: ['bldg', 'bldg', 'bldg', 'bldg', 'church', 'station'] },
  { y0: 366, y1: 546, kinds: ['house', 'house', 'house', 'field', 'pond', 'tree'] },
  { y0: 540, y1: 732, kinds: ['mount', 'pine', 'pine', 'pine', 'house', 'lake'] },
];

const SCENERY = (() => {
  const rnd = mulberry(20260917);
  const out = [];
  const clearOf = (x, y, min) => {
    const m2 = min * min;
    for (let i = 0; i < ROAD_PTS.length; i += 2) {
      const dx = ROAD_PTS[i][0] - x, dy = ROAD_PTS[i][1] - y;
      if (dx * dx + dy * dy < m2) return false;
    }
    for (const p of out) {
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy < 46 * 46) return false;
    }
    return true;
  };
  for (let attempt = 0; attempt < 1400 && out.length < 120; attempt++) {
    const x = 34 + rnd() * (VIEW_W - 68);
    const y = 8 + rnd() * (VIEW_H - 16);
    const band = BANDS.find(b => y >= b.y0 && y <= b.y1) || BANDS[0];
    const kind = band.kinds[Math.floor(rnd() * band.kinds.length)];
    const big = kind === 'mount' || kind === 'school' || kind === 'church' || kind === 'lake';
    if (!clearOf(x, y, big ? 92 : 62)) continue;
    out.push({ x, y, kind, s: 0.82 + rnd() * 0.45, f: rnd() });
  }
  return out.sort((a, b) => a.y - b.y);
})();

/* ---------- 風景パーツ ---------- */
function Prop({ p }) {
  const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.s.toFixed(2)})`;
  switch (p.kind) {
    case 'tree':
      return (
        <g transform={t}>
          <ellipse cx="2" cy="12" rx="15" ry="4" fill="rgba(0,0,0,.25)" />
          <rect x="-2.5" y="-2" width="5" height="14" rx="2" fill="#5b3a1f" />
          <circle cx="0" cy="-8" r="13" fill="#2f7d4f" />
          <circle cx="-7" cy="-3" r="9" fill="#276a44" />
          <circle cx="8" cy="-4" r="9" fill="#3a9160" />
          <circle cx="-2" cy="-13" r="8" fill="#48a86f" />
        </g>
      );
    case 'pine':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="13" rx="13" ry="4" fill="rgba(0,0,0,.25)" />
          <rect x="-2" y="4" width="4" height="10" rx="1.5" fill="#4a3018" />
          <path d="M0 -20 L11 2 L-11 2 Z" fill="#1f6b46" />
          <path d="M0 -13 L14 8 L-14 8 Z" fill="#2a8354" />
        </g>
      );
    case 'flower':
      return (
        <g transform={t} opacity=".9">
          {[0, 1, 2, 3, 4].map(k => (
            <circle key={k} cx={(k * 7) - 14 + (p.f * 5)} cy={(k % 2 ? 4 : -3)} r="2.6"
              fill={['#f9a8d4', '#fde68a', '#fca5a5', '#c4b5fd', '#fbcfe8'][k]} />
          ))}
        </g>
      );
    case 'house':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="13" rx="20" ry="5" fill="rgba(0,0,0,.25)" />
          <rect x="-15" y="-4" width="30" height="16" rx="2" fill="#f3e6cf" />
          <path d="M-19 -4 L0 -19 L19 -4 Z" fill={p.f > 0.5 ? '#c0503f' : '#4a6fa5'} />
          <rect x="-4" y="2" width="8" height="10" fill="#8a6a45" />
          <rect x="-12" y="-1" width="6" height="6" fill="#9ed0f0" />
          <rect x="6" y="-1" width="6" height="6" fill="#9ed0f0" />
        </g>
      );
    case 'bldg': {
      const h = 34 + p.f * 34;
      return (
        <g transform={t}>
          <ellipse cx="0" cy="14" rx="18" ry="5" fill="rgba(0,0,0,.3)" />
          <rect x="-14" y={-h + 12} width="28" height={h} rx="2" fill={p.f > 0.5 ? '#54657f' : '#46566e'} />
          <rect x="-14" y={-h + 12} width="28" height="5" fill="rgba(255,255,255,.14)" />
          {Array.from({ length: Math.floor(h / 11) }).map((_, r) => (
            [0, 1, 2].map(c => (
              <rect key={`${r}-${c}`} x={-10 + c * 7} y={-h + 20 + r * 11} width="4.5" height="6" rx="1"
                fill={((r * 3 + c + Math.floor(p.f * 7)) % 3 === 0) ? '#ffe9a8' : 'rgba(180,215,240,.45)'} />
            ))
          ))}
        </g>
      );
    }
    case 'church':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="18" rx="26" ry="6" fill="rgba(0,0,0,.28)" />
          <rect x="-20" y="-6" width="40" height="23" rx="3" fill="#f6ecd9" />
          <path d="M-24 -6 L0 -24 L24 -6 Z" fill="#b4574a" />
          <rect x="-4" y="-46" width="8" height="24" fill="#f6ecd9" />
          <path d="M-8 -44 L0 -58 L8 -44 Z" fill="#b4574a" />
          <rect x="-1.2" y="-68" width="2.4" height="11" fill="#e9c877" />
          <rect x="-5" y="-64.5" width="10" height="2.4" fill="#e9c877" />
          <path d="M-5 17 L-5 3 Q0 -3 5 3 L5 17 Z" fill="#8a6a45" />
        </g>
      );
    case 'school':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="18" rx="34" ry="6" fill="rgba(0,0,0,.28)" />
          <rect x="-32" y="-14" width="64" height="31" rx="3" fill="#efe2c8" />
          <rect x="-32" y="-14" width="64" height="6" fill="#8d6b4a" />
          <rect x="-9" y="-28" width="18" height="15" rx="2" fill="#efe2c8" />
          <path d="M-12 -28 L0 -38 L12 -28 Z" fill="#7a99b8" />
          <circle cx="0" cy="-21" r="5" fill="#fff" stroke="#6b6b6b" strokeWidth="1.2" />
          <line x1="0" y1="-21" x2="0" y2="-24.5" stroke="#333" strokeWidth="1" />
          <line x1="0" y1="-21" x2="2.6" y2="-19.5" stroke="#333" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5].map(k => (
            <rect key={k} x={-27 + k * 9.5} y="-4" width="6.5" height="8" rx="1" fill="#9ed0f0" />
          ))}
          <rect x="-4" y="6" width="8" height="11" fill="#8a6a45" />
        </g>
      );
    case 'station':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="16" rx="34" ry="6" fill="rgba(0,0,0,.28)" />
          <rect x="-34" y="6" width="68" height="9" fill="#5a5f6a" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(k => (
            <rect key={k} x={-32 + k * 9} y="6" width="3" height="9" fill="#3d424b" />
          ))}
          <rect x="-26" y="-14" width="52" height="20" rx="3" fill="#dfd3bc" />
          <path d="M-30 -14 L0 -26 L30 -14 Z" fill="#7a6a58" />
          <rect x="-18" y="-9" width="10" height="9" rx="1" fill="#9ed0f0" />
          <rect x="8" y="-9" width="10" height="9" rx="1" fill="#9ed0f0" />
        </g>
      );
    case 'field':
      return (
        <g transform={`${t} rotate(${(p.f * 40 - 20).toFixed(1)})`} opacity=".85">
          <rect x="-34" y="-17" width="68" height="34" rx="4" fill="#8d7a3f" />
          {[0, 1, 2, 3, 4, 5].map(k => (
            <rect key={k} x="-31" y={-14 + k * 5.2} width="62" height="2.4" rx="1.2" fill="#b9a45c" />
          ))}
        </g>
      );
    case 'pond':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0" rx="30" ry="17" fill="#2d6b86" />
          <ellipse cx="0" cy="-2" rx="27" ry="14" fill="#3e8ba8" />
          <ellipse cx="-8" cy="-5" rx="9" ry="3" fill="rgba(255,255,255,.3)" />
        </g>
      );
    case 'lake':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0" rx="46" ry="22" fill="#1f4f6b" />
          <ellipse cx="0" cy="-2" rx="42" ry="19" fill="#2d7291" />
          <ellipse cx="-12" cy="-7" rx="14" ry="4" fill="rgba(255,255,255,.26)" />
          <ellipse cx="13" cy="4" rx="10" ry="3" fill="rgba(255,255,255,.18)" />
        </g>
      );
    case 'mount':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="22" rx="46" ry="7" fill="rgba(0,0,0,.28)" />
          <path d="M-48 22 L-12 -30 L10 4 L24 -12 L48 22 Z" fill="#5c6b7d" />
          <path d="M-12 -30 L-24 -12 L0 -12 Z" fill="#e8eef5" />
          <path d="M24 -12 L17 -2 L31 -2 Z" fill="#e8eef5" />
          <path d="M-48 22 L-12 -30 L-4 -18 L-30 22 Z" fill="#6d7d90" />
        </g>
      );
    default:
      return null;
  }
}

/* ---------- 盤面 ---------- */
/** ステージ名は道の隙間（帯の境目）に置く */
const REGION_MARKS = [
  { i: 0, x: 608, y: 44, w: 126 },
  { i: 1, x: 680, y: 204, w: 150 },
  { i: 2, x: 608, y: 372, w: 126 },
  { i: 3, x: 608, y: 547, w: 126 },
];

export function LifeBoard({ players, myIdx, turnIdx, colors, focusIdx }) {
  const tiles = useMemo(() => BOARD.map((sp, i) => ({ i, sp, pt: tileAt(i, N) })), []);
  const scroller = useRef(null);

  // 画面が狭いときは盤面を横スクロールにして、自分のコマが見える位置へ寄せる
  useEffect(() => {
    const el = scroller.current;
    if (!el || focusIdx == null) return;
    const id = setTimeout(() => {
      if (el.scrollWidth <= el.clientWidth + 4) return;
      const x = (tileAt(focusIdx, N).x / VIEW_W) * el.scrollWidth;
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
    }, 260);
    return () => clearTimeout(id);
  }, [focusIdx]);

  return (
    <div ref={scroller} className="relative w-full overflow-x-auto overflow-y-hidden rounded-2xl" style={{ background: '#16301f' }}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block" style={{ width: '100%', minWidth: 560 }}>
        <defs>
          <linearGradient id="lgLand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4d7f52" />
            <stop offset="28%" stopColor="#3f6f57" />
            <stop offset="52%" stopColor="#4a6a63" />
            <stop offset="76%" stopColor="#59684f" />
            <stop offset="100%" stopColor="#33526b" />
          </linearGradient>
          <radialGradient id="lgVig" cx="50%" cy="46%" r="72%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,.45)" />
          </radialGradient>
          <linearGradient id="lgRoad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3e8cd" />
            <stop offset="100%" stopColor="#ddcba6" />
          </linearGradient>
          <filter id="lgTileShadow" x="-40%" y="-40%" width="180%" height="190%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#000" floodOpacity=".45" />
          </filter>
          <filter id="lgGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {Object.entries(SPACE_STYLE).map(([k, s]) => (
            <linearGradient key={k} id={`lgT-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.bg} />
              <stop offset="100%" stopColor={s.bg2} />
            </linearGradient>
          ))}
        </defs>

        {/* 大地 */}
        <rect width={VIEW_W} height={VIEW_H} fill="url(#lgLand)" />
        {/* 地形のむら */}
        <g opacity=".22">
          <path d="M0 150 Q220 108 430 152 T900 140 T1200 168 L1200 0 L0 0 Z" fill="#6c9a63" />
          <path d="M0 356 Q260 318 520 358 T1000 344 T1200 372 L1200 200 L0 200 Z" fill="#4e6f78" />
          <path d="M0 560 Q240 522 500 562 T980 548 T1200 578 L1200 420 L0 420 Z" fill="#7a8557" />
          <path d="M0 736 L1200 736 L1200 620 Q950 654 700 618 T240 642 T0 612 Z" fill="#2b4a63" />
        </g>

        {/* 風景 */}
        <g>{SCENERY.map((p, k) => <Prop key={k} p={p} />)}</g>

        {/* ステージ名（道の隙間に配置） */}
        {REGION_MARKS.map(m => {
          const r = REGIONS[m.i];
          return (
            <g key={r.name} transform={`translate(${m.x} ${m.y})`}>
              <rect x={-m.w / 2} y="-20" width={m.w} height="40" rx="20"
                fill="rgba(6,14,11,.52)" stroke={r.color} strokeWidth="1" strokeOpacity=".35" />
              <text textAnchor="middle" y="-2" fontSize="18" fontWeight="900" fill={r.color} opacity=".95"
                style={{ letterSpacing: '.16em' }}>{r.name}</text>
              <text textAnchor="middle" y="12" fontSize="8" fontWeight="800" fill="rgba(255,255,255,.72)"
                style={{ letterSpacing: '.26em' }}>{r.sub}</text>
            </g>
          );
        })}

        {/* 道 */}
        <path d={ROAD_D} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="96" strokeLinecap="round" />
        <path d={ROAD_D} fill="none" stroke="#9a8560" strokeWidth="90" strokeLinecap="round" />
        <path d={ROAD_D} fill="none" stroke="url(#lgRoad)" strokeWidth="80" strokeLinecap="round" />
        <path d={ROAD_D} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3" strokeDasharray="16 18" strokeLinecap="round" />

        {/* マス */}
        {tiles.map(({ i, sp, pt }) => {
          const st = SPACE_STYLE[sp.t] || SPACE_STYLE.EVENT;
          const big = sp.t === 'START' || sp.t === 'GOAL';
          const w = big ? TW + 12 : TW, h = big ? TH + 8 : TH;
          const focus = focusIdx === i;
          return (
            <g key={i} transform={`translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${pt.ang.toFixed(1)})`}>
              {focus && (
                <rect x={-w / 2 - 7} y={-h / 2 - 7} width={w + 14} height={h + 14} rx="18"
                  fill="none" stroke="#fff" strokeWidth="3" opacity=".9" filter="url(#lgGlow)">
                  <animate attributeName="opacity" values=".95;.3;.95" dur="1.4s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={-w / 2} y={-h / 2 + 5} width={w} height={h} rx="14" fill={st.edge} filter="url(#lgTileShadow)" />
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="14" fill={`url(#lgT-${sp.t})`}
                stroke="rgba(255,255,255,.5)" strokeWidth="1.6" />
              <rect x={-w / 2 + 4} y={-h / 2 + 3} width={w - 8} height={h * 0.38} rx="9" fill="rgba(255,255,255,.22)" />
              {/* 逆走区間ではアイコンと数字だけ 180° 戻して、いつでも正立させる */}
              <g transform={Math.cos(pt.rad) < 0 ? 'scale(-1,-1)' : undefined}>
                <text textAnchor="middle" y={big ? 4 : 2} fontSize={big ? 30 : 26}
                  style={{ userSelect: 'none' }}>{st.icon}</text>
                <text textAnchor="middle" y={h / 2 - 5} fontSize="10" fontWeight="900" fill="rgba(0,0,0,.55)">{i + 1}</text>
              </g>
            </g>
          );
        })}

        {/* スタート＆ゴールの飾り */}
        <StartGoalArt />

        {/* コマ */}
        <Tokens players={players} myIdx={myIdx} turnIdx={turnIdx} colors={colors} />

        <rect width={VIEW_W} height={VIEW_H} fill="url(#lgVig)" pointerEvents="none" />
      </svg>
    </div>
  );
}

function StartGoalArt() {
  const s = tileAt(0, N), g = tileAt(N - 1, N);
  const sp = offsetFrom(s, -84, -26), gp = offsetFrom(g, -62, -18);
  return (
    <g>
      <g transform={`translate(${sp.x.toFixed(0)} ${sp.y.toFixed(0)})`}>
        <rect x="-2" y="-34" width="4" height="40" rx="1.5" fill="#6b5b45" />
        <g>
          {Array.from({ length: 4 }).map((_, r) => Array.from({ length: 6 }).map((_, c) => (
            <rect key={`${r}-${c}`} x={2 + c * 6} y={-34 + r * 6} width="6" height="6"
              fill={(r + c) % 2 ? '#141414' : '#f5f5f5'} />
          )))}
        </g>
        <text x="20" y="20" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff"
          style={{ letterSpacing: '.14em', paintOrder: 'stroke', stroke: 'rgba(0,0,0,.6)', strokeWidth: 4 }}>START</text>
      </g>
      <g transform={`translate(${gp.x.toFixed(0)} ${gp.y.toFixed(0)})`}>
        <path d="M-32 6 Q-32 -30 0 -30 Q32 -30 32 6" fill="none" stroke="#c8991f" strokeWidth="8" strokeLinecap="round" />
        <path d="M-32 6 Q-32 -26 0 -26 Q32 -26 32 6" fill="none" stroke="#f5d271" strokeWidth="3.5" strokeLinecap="round" />
        <text y="-4" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff8e1"
          style={{ letterSpacing: '.18em', paintOrder: 'stroke', stroke: 'rgba(0,0,0,.6)', strokeWidth: 4 }}>GOAL</text>
        <text y="22" textAnchor="middle" fontSize="24">🏆</text>
      </g>
    </g>
  );
}

/* ---------- コマ（車） ---------- */
function Car({ color, mine }) {
  const dark = shade(color, -0.35);
  return (
    <g>
      <ellipse cx="0" cy="8" rx="19" ry="5" fill="rgba(0,0,0,.35)" />
      <path d="M-18 4 L-18 -1 Q-18 -4.4 -14.5 -5 L-9 -5.6 L-5 -10.6 Q-3.4 -12.6 -0.6 -12.6 L6 -12.6 Q9.2 -12.6 10.8 -10.4 L14 -5.4 L17 -4.2 Q19.4 -3.2 19.4 -0.4 L19.4 4 Z"
        fill={color} stroke={dark} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M-3.6 -6 L-0.6 -10.4 Q0 -11.2 1.2 -11.2 L5.6 -11.2 Q7.4 -11.2 8.4 -9.8 L10.6 -6 Z" fill="rgba(255,255,255,.66)" />
      <rect x="-17" y="-2.6" width="6" height="2.6" rx="1.3" fill="rgba(255,255,255,.55)" />
      <circle cx="-9.5" cy="4.6" r="4.4" fill="#1b1b1f" />
      <circle cx="-9.5" cy="4.6" r="1.9" fill="#c9ced6" />
      <circle cx="11" cy="4.6" r="4.4" fill="#1b1b1f" />
      <circle cx="11" cy="4.6" r="1.9" fill="#c9ced6" />
      {mine && <circle cx="0" cy="-19" r="3.4" fill="#fff" opacity=".95" />}
    </g>
  );
}

function shade(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('')}`;
}

function Tokens({ players, myIdx, turnIdx, colors }) {
  const nodes = useRef([]);
  const anim = useRef([]);

  // 位置が変わったらアニメーションを仕込む
  useEffect(() => {
    players.forEach((p, k) => {
      const a = anim.current[k] || (anim.current[k] = { cur: p.pos, target: p.pos, from: p.pos, t0: 0, dur: 0 });
      if (a.target !== p.pos) {
        a.from = a.cur;
        a.target = p.pos;
        a.t0 = performance.now();
        a.dur = Math.min(1700, 260 + Math.abs(p.pos - a.from) * 130);
      }
    });
    anim.current.length = players.length;
  }, [players]);

  // 毎フレーム DOM に直接書き込む（再レンダーを起こさない）
  useEffect(() => {
    let raf = 0;
    const loop = (t) => {
      for (let k = 0; k < anim.current.length; k++) {
        const a = anim.current[k];
        const node = nodes.current[k];
        if (!a || !node) continue;
        let hop = 0;
        if (a.dur > 0) {
          const e = Math.min(1, (t - a.t0) / a.dur);
          const ease = 1 - Math.pow(1 - e, 3);
          a.cur = a.from + (a.target - a.from) * ease;
          const steps = Math.max(1, Math.abs(a.target - a.from));
          hop = Math.abs(Math.sin(e * Math.PI * steps)) * 11 * (1 - e * 0.35);
          if (e >= 1) { a.cur = a.target; a.dur = 0; }
        }
        const pt = tileAt(a.cur, N);
        const side = k % 2 ? 1 : -1;
        const slot = Math.floor(k / 2) - 1;
        const o = offsetFrom(pt, side * TOKEN_PERP - hop * side, slot * TOKEN_ALONG);
        const flip = Math.cos(pt.rad) < 0 ? ' scale(1,-1)' : '';
        node.setAttribute('transform',
          `translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${pt.ang.toFixed(1)})${flip} scale(1.12)`);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <g>
      {players.map((p, k) => (
        <g key={p.name} ref={el => { nodes.current[k] = el; }}>
          <title>{p.name}</title>
          {turnIdx === k && (
            <circle cx="0" cy="0" r="25" fill="none" stroke="#fde68a" strokeWidth="2.5" opacity=".9">
              <animate attributeName="r" values="20;27;20" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".9;.15;.9" dur="1.5s" repeatCount="indefinite" />
            </circle>
          )}
          <Car color={colors[k % colors.length]} mine={k === myIdx} />
        </g>
      ))}
    </g>
  );
}

/* ==========================================================
   ルーレット（人生ゲームのあの円盤）
   ========================================================== */
const SECTORS = 10;
const SEC_DEG = 360 / SECTORS;

function sectorPath(k, r0, r1) {
  const a0 = (k * SEC_DEG - 90) * Math.PI / 180;
  const a1 = ((k + 1) * SEC_DEG - 90) * Math.PI / 180;
  const p = (r, a) => `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

export function Spinner({ value, spinKey, onSettle, size = 208 }) {
  const wheel = useRef(null);
  const rot = useRef(-18);
  const first = useRef(true);

  useEffect(() => {
    if (!spinKey || !value) return;
    if (first.current) { first.current = false; rot.current = -((value - 1) * SEC_DEG) - SEC_DEY / 2; apply(); return; }
    const from = rot.current;
    let target = -((value - 1) * SEC_DEG) - SEC_DEY / 2;
    while (target < from + 360 * 4) target += 360;
    const dur = 2300;
    const t0 = performance.now();
    let raf = 0;
    const step = (t) => {
      const e = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - e, 4);
      const wobble = e > 0.86 ? Math.sin((e - 0.86) / 0.14 * Math.PI * 2) * 2.4 * (1 - e) / 0.14 : 0;
      rot.current = from + (target - from) * ease + wobble;
      apply();
      if (e < 1) raf = requestAnimationFrame(step);
      else { rot.current = target; apply(); onSettle && onSettle(); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    function apply() { if (wheel.current) wheel.current.setAttribute('transform', `rotate(${rot.current.toFixed(2)} 100 100)`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="mx-auto block select-none">
      <defs>
        <radialGradient id="lgHub" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff2c4" />
          <stop offset="55%" stopColor="#e3b344" />
          <stop offset="100%" stopColor="#8a6212" />
        </radialGradient>
        <linearGradient id="lgRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7dd9a" />
          <stop offset="45%" stopColor="#c99a2e" />
          <stop offset="100%" stopColor="#7b5a13" />
        </linearGradient>
        <filter id="lgSpinShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity=".55" />
        </filter>
      </defs>

      <circle cx="100" cy="100" r="94" fill="url(#lgRim)" filter="url(#lgSpinShadow)" />
      <circle cx="100" cy="100" r="86" fill="#1b140a" />

      <g ref={wheel} transform="rotate(-18 100 100)">
        {Array.from({ length: SECTORS }).map((_, k) => (
          <g key={k}>
            <path d={sectorPath(k, 16, 84)} fill={k % 2 ? '#f4ead2' : '#a62a2a'} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
            <text
              transform={`rotate(${k * SEC_DEG + SEC_DEY / 2} 100 100)`}
              x="100" y="38" textAnchor="middle" fontSize="20" fontWeight="900"
              fill={k % 2 ? '#7a1a1a' : '#ffeec2'}>{k + 1}</text>
          </g>
        ))}
        <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="2" />
      </g>

      <circle cx="100" cy="100" r="17" fill="url(#lgHub)" stroke="#5c4310" strokeWidth="2" />
      <circle cx="94" cy="94" r="4.5" fill="rgba(255,255,255,.65)" />

      {/* 針 */}
      <g>
        <path d="M100 26 L109 6 L91 6 Z" fill="#2a1b08" opacity=".55" transform="translate(0,3)" />
        <path d="M100 26 L109 6 L91 6 Z" fill="url(#lgRim)" stroke="#5c4310" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/* ==========================================================
   できごとカード
   ========================================================== */
export function EventCard({ data }) {
  if (!data) return null;
  const { icon, label, title, lines, color, spin, player, region } = data;
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center pointer-events-none p-2 sm:p-3">
      <div key={data.key} className="lg-pop w-full max-w-[15.5rem] sm:max-w-[19rem] rounded-2xl overflow-hidden border shadow-[0_18px_40px_rgba(0,0,0,.65)]"
        style={{ borderColor: 'rgba(255,255,255,.3)', background: '#0e141c' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: color }}>
          <span className="text-xl leading-none">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black tracking-[.2em] text-black/55 leading-none">{region}</div>
            <div className="text-[13px] font-black text-black/90 leading-tight truncate">{label}</div>
          </div>
          {spin ? (
            <div className="shrink-0 w-8 h-8 rounded-full bg-black/80 border border-black/40 flex items-center justify-center">
              <span className="font-mono font-black text-sm text-amber-200">{spin}</span>
            </div>
          ) : null}
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] font-black text-amber-200/70 tracking-widest leading-none mb-1">{player}</div>
          <p className="text-[13px] text-white font-bold leading-snug mb-1.5">{title}</p>
          <div className="space-y-0.5">
            {lines.map((l, i) => <MoneyLine key={i} text={l} />)}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes lgPop {
          0%   { opacity: 0; transform: translateY(26px) scale(.92); }
          10%  { opacity: 1; transform: translateY(-3px) scale(1.01); }
          16%  { transform: translateY(0) scale(1); }
          92%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(10px) scale(.98); }
        }
        .lg-pop { animation: lgPop 3.5s cubic-bezier(.2,.9,.25,1) forwards; }
      `}</style>
    </div>
  );
}

function MoneyLine({ text }) {
  const parts = String(text).split(/([+-][\d,]+)/g);
  return (
    <div className="text-[12px] text-gray-300 leading-snug">
      {parts.map((p, i) => {
        if (/^\+[\d,]+$/.test(p)) return <span key={i} className="font-mono font-black text-emerald-300">{p}</span>;
        if (/^-[\d,]+$/.test(p)) return <span key={i} className="font-mono font-black text-rose-300">{p}</span>;
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}
