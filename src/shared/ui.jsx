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
/* 国ごとの内装。本国は緑のフェルト、ギャンブル大国は深紅、仕事国は鋼色 */
const COUNTRY_SKIN = {
  HOME: { base: '#07100c', glow: 'rgba(21,94,60,0.45)', a: 'bg-amber-500/10', b: 'bg-emerald-500/10' },
  GAMBLE: { base: '#14060a', glow: 'rgba(150,20,48,0.42)', a: 'bg-amber-400/12', b: 'bg-rose-500/12' },
  WORK: { base: '#080d14', glow: 'rgba(30,64,120,0.42)', a: 'bg-sky-400/10', b: 'bg-slate-400/10' },
};

export function FeltBackdrop({ vip = false, country = 'HOME' }) {
  if (vip) return <RoyalBackdrop />;
  const sk = COUNTRY_SKIN[country] || COUNTRY_SKIN.HOME;
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 transition-colors duration-700" style={{ background: sk.base }} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${sk.glow} 0%, rgba(0,0,0,0) 60%)`
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 7px)'
      }} />
      <div className={`absolute -top-24 left-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl ${sk.a}`} />
      <div className={`absolute bottom-0 right-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl ${sk.b}`} />
    </div>
  );
}

/** VIP専用のゴージャスな内装 */
export function RoyalBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1a0f04 0%,#160c06 45%,#0b0602 100%)' }} />
      {/* 天井のシャンデリア光 */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255,196,84,0.30) 0%, rgba(255,170,40,0.08) 38%, rgba(0,0,0,0) 66%)'
      }} />
      {/* 金のダマスク柄 */}
      <div className="absolute inset-0 opacity-[0.10]" style={{
        backgroundImage:
          'radial-gradient(circle at 24px 24px, rgba(255,205,110,0.9) 0 2.5px, rgba(0,0,0,0) 3px),' +
          'radial-gradient(circle at 72px 72px, rgba(255,205,110,0.7) 0 2px, rgba(0,0,0,0) 2.5px),' +
          'repeating-linear-gradient(45deg, rgba(255,205,110,0.35) 0 1px, rgba(0,0,0,0) 1px 26px),' +
          'repeating-linear-gradient(-45deg, rgba(255,205,110,0.35) 0 1px, rgba(0,0,0,0) 1px 26px)',
        backgroundSize: '96px 96px, 96px 96px, 96px 96px, 96px 96px',
      }} />
      {/* ベルベットのカーテン */}
      <div className="absolute inset-y-0 left-0 w-28 md:w-44" style={{
        background: 'linear-gradient(90deg, rgba(90,10,18,0.95) 0%, rgba(120,16,26,0.55) 55%, rgba(0,0,0,0) 100%)',
        maskImage: 'linear-gradient(90deg,#000 60%,transparent)',
      }}>
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 6px, rgba(255,255,255,0.06) 6px 14px)' }} />
      </div>
      <div className="absolute inset-y-0 right-0 w-28 md:w-44" style={{
        background: 'linear-gradient(270deg, rgba(90,10,18,0.95) 0%, rgba(120,16,26,0.55) 55%, rgba(0,0,0,0) 100%)',
      }}>
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 6px, rgba(255,255,255,0.06) 6px 14px)' }} />
      </div>
      {/* 光の粒 */}
      {[...Array(14)].map((_, i) => (
        <span key={i} className="absolute rounded-full" style={{
          left: `${(i * 37 + 8) % 96}%`, top: `${(i * 53 + 12) % 92}%`,
          width: 3 + (i % 3), height: 3 + (i % 3),
          background: 'radial-gradient(circle,#ffe9a8,rgba(255,200,80,0))',
          animation: `vipTwinkle ${2.6 + (i % 5) * 0.5}s ${(i % 7) * 0.4}s ease-in-out infinite`,
        }} />
      ))}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] rounded-full blur-3xl" style={{ background: 'rgba(255,190,70,0.10)' }} />
      <style>{`@keyframes vipTwinkle { 0%,100% { opacity: 0.15; transform: scale(0.8);} 50% { opacity: 1; transform: scale(1.5);} }`}</style>
    </div>
  );
}

/** 名前の横につく金色のVIPバッジ */
export function VipBadge({ size = 'sm', className = '' }) {
  const s = size === 'xs' ? 'text-[8px] px-1 py-0' : size === 'lg' ? 'text-sm px-2.5 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-md font-black tracking-widest align-middle ${s} ${className}`}
      style={{
        background: 'linear-gradient(180deg,#fff3c4 0%,#f5c542 38%,#b8860b 100%)',
        color: '#3b2506',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.7)',
        textShadow: '0 1px 0 rgba(255,255,255,0.35)',
      }}>VIP</span>
  );
}

/** 長者番付1位のバッジ */
export function TopBadge({ size = 'sm', className = '' }) {
  const s = size === 'xs' ? 'text-[8px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md font-black tracking-wider align-middle ${s} ${className}`}
      style={{
        background: 'linear-gradient(180deg,#fffbe8 0%,#ffd75e 40%,#c98a05 100%)',
        color: '#4a2f00',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}>👑1位</span>
  );
}

/** 名前＋VIPバッジ */
export function PlayerName({ name, vip, size = 'sm', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={vip ? 'text-amber-200' : ''}>{name}</span>
      {vip && <VipBadge size={size === 'lg' ? 'sm' : 'xs'} />}
    </span>
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
