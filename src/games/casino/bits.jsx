import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Panel, Chip } from '../../shared/ui.jsx';

/* ==========================================================
   新しいカジノ卓で使う共通のパーツ
   （既存の卓には影響しません）
   ========================================================== */

export const fmt = (n) => Math.round(n || 0).toLocaleString();

/* ---------- シード付き乱数（結果はベット確定と同時に決まる） ---------- */
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 卓の上のヘッダー ---------- */
export function TableHead({ onBack, balance, title, sub, icon, highRoller }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-3">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white font-bold transition">
          <ArrowLeft size={18} /> もどる
        </button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">
          {fmt(balance)} Y
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-3xl leading-none">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-white tracking-tight truncate">{title}</h2>
          <p className="text-[11px] text-amber-200/60 font-semibold">{sub}</p>
        </div>
        {highRoller && (
          <span className="ml-auto shrink-0 bg-amber-400 text-black text-[10px] font-black px-2 py-1 rounded-full">
            ハイローラー ×100
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- チップでベット額を積む ---------- */
const BASE_CHIPS = [
  { v: 100, c: '#64748b' },
  { v: 500, c: '#b91c1c' },
  { v: 1000, c: '#1d4ed8' },
  { v: 5000, c: '#15803d' },
  { v: 10000, c: '#7c3aed' },
];

export function chipsFor(highRoller) {
  return highRoller
    ? [...BASE_CHIPS, { v: 100000, c: '#a16207' }, { v: 1000000, c: '#be123c' }]
    : BASE_CHIPS;
}
export const maxBetOf = (highRoller) => (highRoller ? 10000000 : 100000);

export function BetPad({ bet, setBet, balance, highRoller, disabled, min = 100 }) {
  const chips = chipsFor(highRoller);
  const cap = Math.min(maxBetOf(highRoller), Math.floor(balance));
  const add = (v) => setBet(b => Math.max(min, Math.min(cap, (b || 0) + v)));
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/60">BET</span>
        <span className="font-mono font-black text-xl text-amber-300">{fmt(bet)} Y</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mb-2">
        {chips.map(c => (
          <button key={c.v} onClick={() => add(c.v)} disabled={disabled}
            className="transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-30">
            <Chip value={c.v >= 1000000 ? `${c.v / 1000000}M` : c.v >= 1000 ? `${c.v / 1000}k` : c.v} color={c.c} size={44} />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={() => setBet(min)} disabled={disabled}
          className="py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black disabled:opacity-30">クリア</button>
        <button onClick={() => setBet(b => Math.max(min, Math.min(cap, Math.floor((b || 0) / 2))))} disabled={disabled}
          className="py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black disabled:opacity-30">半分</button>
        <button onClick={() => setBet(cap)} disabled={disabled}
          className="py-1.5 rounded-xl bg-amber-400/80 hover:bg-amber-400 text-black text-[11px] font-black disabled:opacity-30">最大</button>
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5 text-center">
        上限 {fmt(maxBetOf(highRoller))} Y{highRoller ? '（ハイローラー卓）' : ''}
      </p>
    </Panel>
  );
}

/* ---------- 配当表と控除率の掲示 ---------- */
export function PayTable({ rows, house, note }) {
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/60">PAY TABLE</span>
        <span className="text-[10px] font-black text-emerald-300">還元率 {house}</span>
      </div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between items-center px-2.5 py-1 rounded-lg bg-black/40 border border-white/10">
            <span className="text-[11px] text-gray-300 font-bold">{r[0]}</span>
            <span className="text-[11px] font-mono font-black text-amber-300">{r[1]}</span>
          </div>
        ))}
      </div>
      {note && <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">{note}</p>}
    </Panel>
  );
}
