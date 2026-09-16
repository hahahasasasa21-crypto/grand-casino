import React from 'react';
import { CARD_SUITS, CARD_RANK_LABEL } from './cards';

export const TAU = Math.PI * 2;

/* ==========================================================
   ErrorBoundary
   どこかで例外が出ても「真っ白な画面」にせず、
   原因を表示して復帰できるようにする。
   ========================================================== */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[GrandCasino] UI crash:', error, info);
    this.setState({ info });
  }
  reset = () => {
    this.setState({ error: null, info: null });
    if (this.props.onReset) {
      try { this.props.onReset(); } catch (e) { /* noop */ }
    }
  };
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || this.state.error);
    const stack = String(this.state.info?.componentStack || this.state.error?.stack || '').split('\n').slice(0, 8).join('\n');
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-red-500/40 bg-[#1a0b0b]/95 p-6 shadow-2xl">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-xl font-black text-red-300 mb-2">{this.props.title || '画面の描画でエラーが発生しました'}</h2>
          <p className="text-sm text-gray-300 mb-4">
            アプリは動いています。下のボタンで元の画面に戻れます。<br />
            同じエラーが続く場合は、下のメッセージをそのまま伝えてください。
          </p>
          <pre className="text-[11px] text-red-200/80 bg-black/60 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all border border-white/10">{msg}{'\n'}{stack}</pre>
          <div className="flex gap-2 mt-4">
            <button onClick={this.reset} className="flex-1 py-3 rounded-xl font-black bg-amber-400 text-black hover:brightness-110 active:scale-95 transition">メニューに戻る</button>
            <button onClick={() => window.location.reload()} className="px-5 py-3 rounded-xl font-black bg-white/10 text-white hover:bg-white/20 transition">再読み込み</button>
          </div>
        </div>
      </div>
    );
  }
}

/* ==========================================================
   共通UIパーツ（カジノ調）
   ========================================================== */
export function FeltBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[#07100c]" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(21,94,60,0.45) 0%, rgba(7,16,12,0) 60%)'
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 7px)'
      }} />
      <div className="absolute -top-24 left-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl bg-amber-500/10" />
      <div className="absolute bottom-0 right-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl bg-emerald-500/10" />
    </div>
  );
}

export function Panel({ children, className = '', gold = false }) {
  return (
    <div className={`relative rounded-3xl border ${gold ? 'border-amber-500/40' : 'border-white/10'} bg-[#0b1512]/90 backdrop-blur-sm shadow-2xl shadow-black/60 ${className}`}>
      {gold && <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-amber-300/10" />}
      {children}
    </div>
  );
}

export function GoldButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-[#241a04] font-black rounded-xl shadow-lg shadow-amber-900/40 border border-amber-200/60 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 ${className}`}
    >
      {children}
    </button>
  );
}

/** 立体的なカジノチップ */
export function Chip({ value, color = '#b91c1c', size = 40 }) {
  return (
    <div
      className="relative rounded-full flex items-center justify-center font-black text-white select-none"
      style={{
        width: size, height: size, fontSize: size * 0.28,
        background: `radial-gradient(circle at 35% 28%, ${color}ee 0%, ${color} 42%, rgba(0,0,0,0.45) 100%)`,
        boxShadow: `0 ${size * 0.08}px ${size * 0.16}px rgba(0,0,0,0.55), inset 0 0 0 ${Math.max(2, size * 0.08)}px rgba(255,255,255,0.85), inset 0 0 0 ${Math.max(3, size * 0.11)}px ${color}`,
      }}
    >
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `repeating-conic-gradient(from 0deg, rgba(255,255,255,0.9) 0deg 9deg, transparent 9deg 30deg)`,
          WebkitMask: `radial-gradient(circle, transparent ${size * 0.33}px, #000 ${size * 0.34}px)`,
          mask: `radial-gradient(circle, transparent ${size * 0.33}px, #000 ${size * 0.34}px)`,
          opacity: 0.55,
        }}
      />
      <span
        className="absolute rounded-full"
        style={{ inset: size * 0.16, background: `radial-gradient(circle at 38% 30%, rgba(255,255,255,0.22), rgba(0,0,0,0.25))`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)' }}
      />
      <span className="relative z-10 drop-shadow">{value}</span>
    </div>
  );
}

export function SectionTitle({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
      <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20">{icon}</div>
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h2>
        {sub && <p className="text-xs md:text-sm text-amber-200/60 font-semibold">{sub}</p>}
      </div>
    </div>
  );
}

export function PlayingCard({ card, hidden = false, small = false, dim = false, tiny = false, style }) {
  const w = tiny ? 'w-8 h-12 text-[11px]' : small ? 'w-11 h-16 text-base' : 'w-16 h-24 text-2xl md:w-20 md:h-28';
  if (hidden || !card) {
    return (
      <div style={style} className={`${w} rounded-lg border-2 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-xl`}>
        <div className="w-[70%] h-[80%] rounded border border-amber-400/30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(251,191,36,0.18) 0 4px, transparent 4px 8px)'
        }} />
      </div>
    );
  }
  const suit = CARD_SUITS[card.s];
  return (
    <div style={style} className={`${w} relative rounded-lg bg-gradient-to-b from-white to-slate-100 border border-slate-300 shadow-xl flex flex-col items-center justify-center font-black ${dim ? 'opacity-50' : ''} ${suit.red ? 'text-red-600' : 'text-slate-900'}`}>
      <span className="leading-none">{CARD_RANK_LABEL[card.r]}</span>
      <span className="leading-none">{suit.s}</span>
      {!tiny && <span className="absolute top-0.5 left-1 text-[9px] leading-none opacity-70">{CARD_RANK_LABEL[card.r]}{suit.s}</span>}
    </div>
  );
}

/* ==========================================================
   簡易サウンド（外部ファイル不要・WebAudioで合成）
   ========================================================== */
let _ctx = null;
export function audioCtx() {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch (e) { return null; }
}

/** 短いトーン。type: 'click' | 'stop' | 'win' | 'big' | 'tick' | 'bell' */
export function playSfx(kind, enabled = true) {
  if (!enabled) return;
  const ctx = audioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const mk = (freq, dur, type = 'square', gain = 0.05, slideTo = null) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(now); o.stop(now + dur + 0.02);
  };
  try {
    switch (kind) {
      case 'click': mk(220, 0.06, 'square', 0.04); break;
      case 'tick': mk(1400, 0.02, 'square', 0.015); break;
      case 'stop': mk(150, 0.12, 'triangle', 0.07, 80); break;
      case 'coin': mk(1200, 0.07, 'square', 0.04); setTimeout(() => mk(1800, 0.08, 'square', 0.035), 55); break;
      case 'win':
        [523, 659, 784].forEach((f, i) => setTimeout(() => mk(f, 0.16, 'triangle', 0.06), i * 90));
        break;
      case 'big':
        [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => mk(f, 0.22, 'sawtooth', 0.05), i * 100));
        break;
      case 'lose': mk(200, 0.25, 'sine', 0.04, 110); break;
      case 'bell': mk(880, 0.35, 'sine', 0.05); mk(1320, 0.3, 'sine', 0.03); break;
      case 'gate': mk(700, 0.1, 'square', 0.05); setTimeout(() => mk(900, 0.25, 'square', 0.05), 120); break;
      case 'hoof': mk(90 + Math.random() * 40, 0.05, 'triangle', 0.02); break;
      default: mk(440, 0.08);
    }
  } catch (e) { /* noop */ }
}
