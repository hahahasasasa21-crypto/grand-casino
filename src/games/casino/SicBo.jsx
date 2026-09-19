import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trash2, Undo2, Volume2, VolumeX, Dices, Info, Crown } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, Chip, playSfx } from '../../shared/ui.jsx';

/* ==========================================================
   SIC BO（大小・シックボー）
   ・サイコロ3つ。カップの中で転がしてから開ける。
   ・ベットを押した瞬間に目を確定させ、演出は後から見せる。
   ・配当は還元率 95〜97% になるように設計（配当表を画面に掲示）。
   ========================================================== */

/* ---------- シード付き乱数（mulberry32） ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 配当（すべて「賭け金を含む総額の倍率」） ---------- */
export const SUM_MULT = {
  4: 69, 17: 69,
  5: 34.5, 16: 34.5,
  6: 20.7, 15: 20.7,
  7: 13.8, 14: 13.8,
  8: 9.8, 13: 9.8,
  9: 8.3, 12: 8.3,
  10: 7.7, 11: 7.7,
};
export const BIGSMALL_MULT = 2;      // 1:1
export const ANY_TRIPLE_MULT = 34.5; // 33.5:1
export const SPEC_TRIPLE_MULT = 207; // 206:1
export const COMBO_MULT = 7;         // 6:1
export const SINGLE_MULT = { 1: 2, 2: 3, 3: 13 }; // 1個=1:1 / 2個=2:1 / 3個=12:1

export const COMBO_PAIRS = (() => {
  const out = [];
  for (let a = 1; a <= 6; a++) for (let b = a + 1; b <= 6; b++) out.push([a, b]);
  return out;
})();

/** 賭け目 id と出目から「賭け金に掛ける総額倍率」を返す（0 ならハズレ） */
export function resolveSicBo(id, dice) {
  const a = dice[0], b = dice[1], c = dice[2];
  const sum = a + b + c;
  const triple = a === b && b === c;

  if (id === 'BIG') return !triple && sum >= 11 && sum <= 17 ? BIGSMALL_MULT : 0;
  if (id === 'SMALL') return !triple && sum >= 4 && sum <= 10 ? BIGSMALL_MULT : 0;
  if (id === 'ANYTRIPLE') return triple ? ANY_TRIPLE_MULT : 0;
  if (id.startsWith('TRIPLE')) {
    const n = Number(id.slice(6));
    return triple && a === n ? SPEC_TRIPLE_MULT : 0;
  }
  if (id.startsWith('SUM')) {
    const n = Number(id.slice(3));
    return sum === n ? (SUM_MULT[n] || 0) : 0;
  }
  if (id.startsWith('SINGLE')) {
    const n = Number(id.slice(6));
    const k = dice.filter((d) => d === n).length;
    return k === 0 ? 0 : SINGLE_MULT[k];
  }
  if (id.startsWith('COMBO')) {
    const p = id.slice(5);
    const x = Number(p[0]);
    const y = Number(p[1]);
    return dice.includes(x) && dice.includes(y) ? COMBO_MULT : 0;
  }
  return 0;
}

/** その出目で当たりになる賭け目 id をすべて集める（卓のハイライト用） */
export function winningIds(dice) {
  const s = new Set();
  const push = (id) => { if (resolveSicBo(id, dice) > 0) s.add(id); };
  push('BIG'); push('SMALL'); push('ANYTRIPLE');
  for (let n = 1; n <= 6; n++) { push('TRIPLE' + n); push('SINGLE' + n); }
  for (let n = 4; n <= 17; n++) push('SUM' + n);
  COMBO_PAIRS.forEach(([x, y]) => push('COMBO' + x + y));
  return s;
}

export function settleSicBo(bets, dice) {
  let win = 0;
  for (const id of Object.keys(bets)) {
    const amount = bets[id];
    if (!amount) continue;
    const m = resolveSicBo(id, dice);
    if (m > 0) win += Math.round(amount * m);
  }
  return win;
}

/* ---------- チップ ---------- */
const BASE_CHIPS = [
  { v: 100, c: '#dc2626' },
  { v: 500, c: '#2563eb' },
  { v: 1000, c: '#16a34a' },
  { v: 5000, c: '#7c3aed' },
  { v: 10000, c: '#b45309' },
];
const HR_CHIPS = [
  { v: 50000, c: '#0f172a' },
  { v: 100000, c: '#be185d' },
  { v: 500000, c: '#0e7490' },
  { v: 1000000, c: '#a16207' },
];
const chipLabel = (v) => (v >= 1000000 ? v / 1000000 + 'M' : v >= 1000 ? v / 1000 + 'K' : String(v));

/* ---------- 画面部品（render の外で定義） ---------- */
function TopBar({ onBack, balance, locked, sound, onSound, vip, highRoller }) {
  return (
    <div className="w-full flex justify-between items-center gap-2 mb-3">
      <button
        onClick={onBack}
        disabled={locked}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white transition disabled:opacity-40 text-sm font-bold shrink-0"
      >
        <ArrowLeft size={18} /> メニューに戻る
      </button>
      <div className="flex items-center gap-2 min-w-0">
        {vip && <VipBadge size="xs" />}
        {highRoller && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-900/60 border border-amber-400/40 text-amber-200">
            <Crown size={11} /> 高レート卓
          </span>
        )}
        <button onClick={onSound} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition shrink-0">
          {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <div className="bg-black/60 px-3 py-1.5 rounded-full border border-amber-500/30 font-mono text-sm sm:text-base text-amber-300 font-bold truncate">
          {balance.toLocaleString()} Y
        </div>
      </div>
    </div>
  );
}

const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function Die({ n, size = 56, className = '' }) {
  const pips = PIPS[n] || [];
  const pad = size * 0.16;
  const step = (size - pad * 2) / 2;
  const r = size * 0.1;
  return (
    <div
      className={`relative rounded-xl border border-white/40 shrink-0 ${className}`}
      style={{
        width: size, height: size,
        background: 'linear-gradient(145deg,#fffdf5 0%,#f2ece0 55%,#d9d1bf 100%)',
        boxShadow: '0 6px 14px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.9)',
      }}
    >
      {pips.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            width: r * 2, height: r * 2,
            left: pad + p[0] * step - r,
            top: pad + p[1] * step - r,
            background: 'radial-gradient(circle at 34% 30%, #4b4b4b, #111)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35)',
          }}
        />
      ))}
    </div>
  );
}

function SbCell({ id, amount, onPlace, onRemove, disabled, win, children, className = '', style }) {
  return (
    <button
      onClick={() => onPlace(id)}
      onContextMenu={(e) => { e.preventDefault(); onRemove(id); }}
      disabled={disabled}
      className={`relative select-none font-black text-white border rounded-md transition hover:brightness-125 active:scale-95 disabled:opacity-60 disabled:active:scale-100 ${win ? 'border-amber-300 ring-2 ring-amber-300/70' : 'border-white/25'} ${className}`}
      style={style}
    >
      {children}
      {amount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 z-10">
          <Chip value={chipLabel(amount)} color="#eab308" size={20} />
        </span>
      )}
    </button>
  );
}

function PayTable() {
  const sums = [
    ['4 / 17', '×69.0', '95.8%'],
    ['5 / 16', '×34.5', '95.8%'],
    ['6 / 15', '×20.7', '95.8%'],
    ['7 / 14', '×13.8', '95.8%'],
    ['8 / 13', '×9.8', '95.3%'],
    ['9 / 12', '×8.3', '96.1%'],
    ['10 / 11', '×7.7', '96.3%'],
  ];
  const main = [
    ['大（11〜17）／小（4〜10）', '×2.00', '97.2%'],
    ['ゾロ目（any triple）', '×34.5', '95.8%'],
    ['指定ゾロ目', '×207.0', '95.8%'],
    ['1個賭け（1個／2個／3個）', '×2 / ×3 / ×13', '96.3%'],
    ['二個組み合わせ', '×7.00', '97.2%'],
  ];
  return (
    <div className="text-[11px] space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
        <div className="font-black text-amber-300/80">賭け方</div>
        <div className="font-black text-amber-300/80 text-right">配当（賭け金込み）</div>
        <div className="font-black text-amber-300/80 text-right">還元率</div>
        {main.map((r) => (
          <React.Fragment key={r[0]}>
            <div className="text-gray-300">{r[0]}</div>
            <div className="text-white font-mono text-right">{r[1]}</div>
            <div className="text-emerald-300/90 font-mono text-right">{r[2]}</div>
          </React.Fragment>
        ))}
      </div>
      <div className="pt-1 border-t border-white/10">
        <div className="font-black text-amber-300/80 mb-1">合計（3つの目の和）</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-0.5">
          {sums.map((r) => (
            <React.Fragment key={r[0]}>
              <div className="text-gray-300">{r[0]}</div>
              <div className="text-white font-mono text-right">{r[1]}</div>
              <div className="text-emerald-300/90 font-mono text-right">{r[2]}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        大・小はゾロ目が出た場合すべてハズレです。控除率は <span className="text-rose-300 font-bold">2.8〜4.7%</span>、
        卓全体の還元率は <span className="text-emerald-300 font-bold">約96.4%</span>（全賭け目を均等に賭けた場合）。
      </p>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function SicBo({
  balance,
  updateBalance,
  onBack,
  showToast,
  playerName,
  emitNews,
  vip = false,
  highRoller = false,
}) {
  const MAX_BET = highRoller ? 10000000 : 100000;
  const chips = useMemo(() => (highRoller ? [...BASE_CHIPS, ...HR_CHIPS] : BASE_CHIPS), [highRoller]);

  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState({});
  const [lastBets, setLastBets] = useState(null);
  const [lastSpot, setLastSpot] = useState('BIG');
  const [phase, setPhase] = useState('BET');   // BET | SHAKE | RESULT
  const [lift, setLift] = useState(false);
  const [dice, setDice] = useState([1, 1, 1]);
  const [payout, setPayout] = useState(0);
  const [staked, setStaked] = useState(0);
  const [history, setHistory] = useState([]);
  const [sound, setSound] = useState(true);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const soundRef = useRef(true);
  const rndRef = useRef(null);
  if (rndRef.current === null) rndRef.current = mulberry32((Date.now() ^ 0x85ebca6b) >>> 0);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const totalBet = useMemo(() => Object.values(bets).reduce((a, b) => a + b, 0), [bets]);
  const wins = useMemo(() => (phase === 'RESULT' ? winningIds(dice) : new Set()), [phase, dice]);
  const sum = dice[0] + dice[1] + dice[2];

  const place = useCallback((id) => {
    if (busyRef.current || phase !== 'BET') return;
    setLastSpot(id);
    setBets((prev) => {
      const cur = Object.values(prev).reduce((a, b) => a + b, 0);
      if (cur + chip > MAX_BET) { showToast(`この卓のベット上限は ${MAX_BET.toLocaleString()} Y です。`, 'warning'); return prev; }
      if (cur + chip > balance) { showToast('所持金を超えるベットはできません。', 'error'); return prev; }
      return { ...prev, [id]: (prev[id] || 0) + chip };
    });
    playSfx('click', soundRef.current);
  }, [phase, chip, balance, MAX_BET, showToast]);

  const removeSpot = useCallback((id) => {
    if (busyRef.current || phase !== 'BET') return;
    setBets((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, [phase]);

  const clearBets = useCallback(() => {
    if (busyRef.current || phase !== 'BET') return;
    setBets({});
    playSfx('click', soundRef.current);
  }, [phase]);

  const maxBet = useCallback(() => {
    if (busyRef.current || phase !== 'BET') return;
    const cap = Math.min(MAX_BET, balance);
    const room = Math.floor((cap - totalBet) / 100) * 100;
    if (room <= 0) { showToast('これ以上は賭けられません。', 'warning'); return; }
    setBets((prev) => ({ ...prev, [lastSpot]: (prev[lastSpot] || 0) + room }));
    playSfx('coin', soundRef.current);
  }, [phase, MAX_BET, balance, totalBet, lastSpot, showToast]);

  const repeatBets = useCallback(() => {
    if (busyRef.current || phase !== 'BET' || !lastBets) return;
    const s = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (s > balance) { showToast('所持金が足りません。', 'error'); return; }
    setBets({ ...lastBets });
    playSfx('click', soundRef.current);
  }, [phase, lastBets, balance, showToast]);

  const finish = useCallback(async (d, snapshot) => {
    const win = settleSicBo(snapshot, d);
    const stake = Object.values(snapshot).reduce((a, b) => a + b, 0);
    if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
    if (!mountedRef.current) { busyRef.current = false; return; }
    setPayout(win);
    setPhase('RESULT');
    setHistory((h) => [{ d, s: d[0] + d[1] + d[2] }, ...h].slice(0, 18));
    const s = d[0] + d[1] + d[2];
    if (win > 0) {
      playSfx(win >= stake * 8 ? 'big' : 'win', soundRef.current);
      showToast(`${d.join(' - ')}（合計 ${s}）  +${win.toLocaleString()} Y`, 'success');
    } else {
      playSfx('lose', soundRef.current);
      showToast(`${d.join(' - ')}（合計 ${s}）  -${stake.toLocaleString()} Y`, 'error');
    }
    if (win >= stake * 20 && win >= 100000) {
      emitNews(`🎲 ${playerName} が大小で ${win.toLocaleString()} Y を的中！`, 'jackpot');
    }
    busyRef.current = false;
  }, [updateBalance, showToast, emitNews, playerName]);

  const roll = useCallback(async () => {
    if (busyRef.current || phase !== 'BET') return;
    if (totalBet <= 0) { showToast('チップを置いてください。', 'error'); return; }
    if (totalBet > balance) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;

    const snapshot = { ...bets };
    try {
      await updateBalance(-totalBet);
    } catch (e) {
      busyRef.current = false;
      showToast('所持金が足りません。', 'error');
      return;
    }

    // ===== ここで出目を確定（以降は演出だけ） =====
    const rnd = rndRef.current;
    const d = [
      1 + Math.floor(rnd() * 6),
      1 + Math.floor(rnd() * 6),
      1 + Math.floor(rnd() * 6),
    ];

    if (!mountedRef.current) { busyRef.current = false; return; }
    setLastBets(snapshot);
    setStaked(totalBet);
    setDice(d);
    setPayout(0);
    setLift(false);
    setPhase('SHAKE');
    playSfx('stop', soundRef.current);

    for (let i = 0; i < 6; i++) {
      timersRef.current.push(setTimeout(() => playSfx('tick', soundRef.current), 180 + i * 190));
    }
    timersRef.current.push(setTimeout(() => { if (mountedRef.current) setLift(true); }, 1380));
    timersRef.current.push(setTimeout(() => { if (mountedRef.current) playSfx('bell', soundRef.current); }, 1420));
    timersRef.current.push(setTimeout(() => finish(d, snapshot), 2150));
  }, [phase, totalBet, balance, bets, updateBalance, showToast, finish]);

  const nextGame = useCallback(() => {
    if (busyRef.current) return;
    setPhase('BET');
    setBets({});
    setPayout(0);
    setLift(false);
  }, []);

  const feltStyle = highRoller
    ? { background: 'radial-gradient(ellipse at 50% 0%, #5c1022 0%, #2b0711 68%, #140409 100%)' }
    : { background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 82%)' };
  const cellBase = 'h-9 text-[11px] bg-emerald-900/70';
  const locked = phase === 'SHAKE';

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto">
      <style>{`
        @keyframes sbShake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          12% { transform: translate(-8px,-4px) rotate(-7deg); }
          26% { transform: translate(7px,-6px) rotate(6deg); }
          41% { transform: translate(-6px,3px) rotate(-5deg); }
          58% { transform: translate(8px,-3px) rotate(7deg); }
          77% { transform: translate(-5px,-5px) rotate(-4deg); }
        }
        @keyframes sbLift {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-150px) scale(1.08) rotate(-9deg); opacity: 0; }
        }
        @keyframes sbTumble {
          0% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(120deg) translateY(-7px); }
          50% { transform: rotate(210deg) translateY(4px); }
          75% { transform: rotate(320deg) translateY(-5px); }
          100% { transform: rotate(360deg) translateY(0); }
        }
        @keyframes sbPop {
          0% { transform: scale(0.55) rotate(-16deg); opacity: 0; }
          65% { transform: scale(1.14) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .sb-shake { animation: sbShake 0.42s linear infinite; }
        .sb-lift { animation: sbLift 0.55s cubic-bezier(.3,.1,.2,1) forwards; }
        .sb-tumble { animation: sbTumble 0.5s linear infinite; }
        .sb-pop { animation: sbPop 0.4s cubic-bezier(.2,.9,.3,1.4) both; }
      `}</style>

      <TopBar
        onBack={onBack}
        balance={balance}
        locked={locked}
        sound={sound}
        onSound={() => setSound((s) => !s)}
        vip={vip}
        highRoller={highRoller}
      />

      <SectionTitle
        icon={<Dices size={22} />}
        title="大小（シックボー）"
        sub={highRoller ? 'ハイローラー卓 — 上限 10,000,000 Y' : 'サイコロ3つ・本格レイアウト'}
      />

      <div className="flex flex-col lg:flex-row gap-3">
        {/* ===== ダイス ===== */}
        <div className="lg:w-[38%] space-y-3">
          <Panel gold={highRoller} className="p-3">
            <div className="rounded-2xl border-2 border-amber-900/50 p-3" style={feltStyle}>
              <div className="relative flex items-center justify-center" style={{ height: 150 }}>
                <div className={`flex gap-2 sm:gap-3 ${phase === 'SHAKE' && !lift ? 'sb-tumble' : ''}`}>
                  {dice.map((n, i) => (
                    <div key={i} className={phase === 'RESULT' || lift ? 'sb-pop' : ''} style={{ animationDelay: (i * 90) + 'ms' }}>
                      <Die n={n} size={54} />
                    </div>
                  ))}
                </div>

                {phase !== 'BET' && (
                  <div
                    className={`absolute inset-x-0 mx-auto ${lift ? 'sb-lift' : 'sb-shake'}`}
                    style={{ width: 200, height: 118, bottom: 8, pointerEvents: 'none' }}
                  >
                    <div
                      className="w-full h-full rounded-b-[6rem] rounded-t-2xl border-2 border-amber-300/60"
                      style={{
                        background: 'linear-gradient(170deg,#3a2408 0%,#6b4712 40%,#2a1806 100%)',
                        boxShadow: '0 12px 28px rgba(0,0,0,0.7), inset 0 6px 14px rgba(255,220,150,0.18)',
                      }}
                    >
                      <div className="w-full h-3 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#f6d98a,#b9862b,#f6d98a)' }} />
                      <div className="text-center text-amber-200/70 text-[10px] font-black tracking-[0.3em] mt-7">SIC BO</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 text-center">
                {phase === 'BET' && <span className="text-[11px] text-white/40 font-bold">チップを置いて「振る」を押してください</span>}
                {phase === 'SHAKE' && <span className="px-3 py-1 rounded-full bg-black/70 text-amber-300 text-[11px] font-black border border-amber-400/30">NO MORE BETS</span>}
                {phase === 'RESULT' && (
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="font-mono text-2xl font-black text-white">合計 {sum}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${dice[0] === dice[1] && dice[1] === dice[2]
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                      : sum >= 11 ? 'bg-rose-600/25 text-rose-200 border-rose-400/40' : 'bg-sky-600/25 text-sky-200 border-sky-400/40'}`}>
                      {dice[0] === dice[1] && dice[1] === dice[2] ? 'ゾロ目' : sum >= 11 ? '大' : '小'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {phase === 'RESULT' && (
              <div className={`mt-3 p-3 rounded-2xl border-2 ${payout > 0 ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-between">
                  <div className={`text-2xl font-black ${payout > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {payout > 0 ? '+' + payout.toLocaleString() + ' G' : 'ハズレ'}
                  </div>
                  <div className={`text-xs font-bold ${payout - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    収支 {payout - staked >= 0 ? '+' : ''}{(payout - staked).toLocaleString()} Y
                  </div>
                </div>
                <GoldButton onClick={nextGame} className="w-full mt-2 py-2.5">次のゲームへ</GoldButton>
              </div>
            )}

            {history.length > 0 && (
              <div className="mt-3 bg-black/40 border border-white/10 rounded-xl p-2">
                <div className="text-[10px] font-black text-gray-500 tracking-[0.25em] mb-1.5">履歴</div>
                <div className="flex flex-wrap gap-1">
                  {history.map((h, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded text-[10px] font-black border"
                      style={{
                        background: h.d[0] === h.d[1] && h.d[1] === h.d[2] ? 'rgba(245,158,11,0.25)' : h.s >= 11 ? 'rgba(225,29,72,0.22)' : 'rgba(56,189,248,0.22)',
                        borderColor: h.d[0] === h.d[1] && h.d[1] === h.d[2] ? 'rgba(245,158,11,0.6)' : h.s >= 11 ? 'rgba(244,63,94,0.5)' : 'rgba(56,189,248,0.5)',
                        color: '#fff',
                      }}
                    >
                      {h.d.join('')}<span className="opacity-60">/{h.s}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Info size={14} className="text-amber-300" />
              <h3 className="text-sm font-black text-white">配当表と控除率</h3>
            </div>
            <PayTable />
          </Panel>
        </div>

        {/* ===== 卓 ===== */}
        <div className="lg:w-[62%] space-y-3">
          <Panel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">チップを選ぶ</h3>
              <span className="text-[10px] text-gray-500">枠を押して配置／右クリックで取消</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.v}
                  onClick={() => { setChip(c.v); playSfx('click', soundRef.current); }}
                  className={`rounded-full transition ${chip === c.v ? 'scale-110 ring-4 ring-amber-300' : 'opacity-75 hover:opacity-100'}`}
                >
                  <Chip value={chipLabel(c.v)} color={c.c} size={38} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-2.5">
            <div className="rounded-2xl border-2 border-amber-900/50 p-2" style={feltStyle}>
              {/* 小 / ゾロ目 / 大 */}
              <div className="grid grid-cols-4 gap-1">
                <SbCell id="SMALL" amount={bets.SMALL} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} win={wins.has('SMALL')}
                  className="h-12 text-sm bg-sky-800/80">
                  小<span className="block text-[9px] font-bold opacity-70">4-10 ×2.0</span>
                </SbCell>
                <SbCell id="ANYTRIPLE" amount={bets.ANYTRIPLE} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} win={wins.has('ANYTRIPLE')}
                  className="h-12 text-[11px] col-span-2 bg-amber-900/70">
                  ゾロ目（any）<span className="block text-[9px] font-bold opacity-70">×34.5</span>
                </SbCell>
                <SbCell id="BIG" amount={bets.BIG} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} win={wins.has('BIG')}
                  className="h-12 text-sm bg-rose-800/80">
                  大<span className="block text-[9px] font-bold opacity-70">11-17 ×2.0</span>
                </SbCell>
              </div>

              {/* 指定ゾロ目 */}
              <div className="mt-1.5">
                <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">指定ゾロ目 ×207</div>
                <div className="grid grid-cols-6 gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SbCell key={n} id={'TRIPLE' + n} amount={bets['TRIPLE' + n]} onPlace={place} onRemove={removeSpot}
                      disabled={phase !== 'BET'} win={wins.has('TRIPLE' + n)} className="h-10 text-[10px] bg-amber-950/80">
                      <span className="flex items-center justify-center gap-[1px]">
                        <Die n={n} size={11} /><Die n={n} size={11} /><Die n={n} size={11} />
                      </span>
                    </SbCell>
                  ))}
                </div>
              </div>

              {/* 合計 */}
              <div className="mt-1.5">
                <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">合計（4〜17）</div>
                <div className="grid grid-cols-7 gap-1">
                  {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((n) => (
                    <SbCell key={n} id={'SUM' + n} amount={bets['SUM' + n]} onPlace={place} onRemove={removeSpot}
                      disabled={phase !== 'BET'} win={wins.has('SUM' + n)} className={cellBase}>
                      {n}<span className="block text-[8px] font-bold opacity-65">×{SUM_MULT[n]}</span>
                    </SbCell>
                  ))}
                </div>
              </div>

              {/* 二個組み合わせ */}
              <div className="mt-1.5">
                <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">二個組み合わせ ×7</div>
                <div className="grid grid-cols-5 gap-1">
                  {COMBO_PAIRS.map(([x, y]) => (
                    <SbCell key={'' + x + y} id={'COMBO' + x + y} amount={bets['COMBO' + x + y]} onPlace={place} onRemove={removeSpot}
                      disabled={phase !== 'BET'} win={wins.has('COMBO' + x + y)} className="h-8 bg-emerald-800/70">
                      <span className="flex items-center justify-center gap-0.5">
                        <Die n={x} size={13} /><Die n={y} size={13} />
                      </span>
                    </SbCell>
                  ))}
                </div>
              </div>

              {/* 1個賭け */}
              <div className="mt-1.5">
                <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">1個賭け（出た個数で ×2 / ×3 / ×13）</div>
                <div className="grid grid-cols-6 gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SbCell key={n} id={'SINGLE' + n} amount={bets['SINGLE' + n]} onPlace={place} onRemove={removeSpot}
                      disabled={phase !== 'BET'} win={wins.has('SINGLE' + n)} className="h-10 bg-emerald-800/70">
                      <span className="flex items-center justify-center"><Die n={n} size={22} /></span>
                    </SbCell>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex-1 min-w-[110px]">
                <div className="text-[10px] text-gray-400 font-bold">合計ベット</div>
                <div className="font-mono text-xl font-black text-amber-300">{totalBet.toLocaleString()} Y</div>
              </div>
              <button onClick={repeatBets} disabled={phase !== 'BET' || !lastBets}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Undo2 size={13} /> 同じ賭け
              </button>
              <button onClick={maxBet} disabled={phase !== 'BET'}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                最大
              </button>
              <button onClick={clearBets} disabled={phase !== 'BET' || totalBet === 0}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Trash2 size={13} /> クリア
              </button>
              <GoldButton onClick={roll} disabled={phase !== 'BET' || totalBet <= 0} className="py-2.5 px-5 text-base">
                {phase === 'SHAKE' ? '振っています…' : 'サイコロを振る'}
              </GoldButton>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              「最大」は最後に触れた枠へ、上限（{MAX_BET.toLocaleString()} Y）まで積みます。
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
