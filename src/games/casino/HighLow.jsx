import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trash2, Volume2, VolumeX, TrendingUp, TrendingDown, Info, Crown, Flame, Shuffle } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, Chip, PlayingCard, playSfx } from '../../shared/ui.jsx';
import { CARD_RANK_LABEL } from '../../shared/cards.js';

/* ==========================================================
   HIGH & LOW（ハイ＆ロー）
   ・1枚めくって、次がハイかローかを当てる。当たるたびに倍率が上がる。
   ・倍率は「残りカードの実際の枚数」から公正に計算する。
     控除率4%は 1回のベットにつき最初の1手だけで、2手目以降は公正倍率。
     → どこで降りても期待還元率はきっちり 96%。
   ・同じ数字は引き分け。引き分けたカードは捨てて、もう1枚引き直す。
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

export const HOUSE_EDGE = 0.04;       // 1回のベットにつき一度だけ引く控除率
export const RESHUFFLE_AT = 8;        // 残りがこれ未満になったら新しい山札に替える

export function buildDeck(rnd) {
  const a = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) a.push({ r, s });
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 残りの山札を、いまのカードより上／同じ／下 に数える */
export function countRemaining(deck, cur) {
  let hi = 0, lo = 0, eq = 0;
  if (!cur) return { hi, lo, eq };
  for (let i = 0; i < deck.length; i++) {
    const r = deck[i].r;
    if (r > cur.r) hi += 1;
    else if (r < cur.r) lo += 1;
    else eq += 1;
  }
  return { hi, lo, eq };
}

/** 引き分けを除いた勝率。ハイ／ローどちらを選んでも公正に計算する */
export function winChance(counts, dir) {
  const n = counts.hi + counts.lo;
  if (n === 0) return 0;
  return (dir === 'HIGH' ? counts.hi : counts.lo) / n;
}

/** 当たったときの新しい累計倍率。控除率は最初の1手だけ */
export function nextMultiplier(cum, streak, p) {
  if (p <= 0) return 0;
  const factor = streak === 0 ? 1 - HOUSE_EDGE : 1;
  return (cum * factor) / p;
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

function ChoiceButton({ dir, chance, amount, disabled, onClick }) {
  const isHigh = dir === 'HIGH';
  return (
    <button
      onClick={() => onClick(dir)}
      disabled={disabled}
      className={`flex-1 rounded-2xl border-2 py-3 px-2 text-center transition hover:brightness-125 active:scale-95 disabled:opacity-35 disabled:active:scale-100 ${isHigh ? 'border-emerald-300/60' : 'border-sky-300/60'}`}
      style={{
        background: isHigh
          ? 'linear-gradient(180deg, rgba(5,150,105,0.55), rgba(3,45,32,0.9))'
          : 'linear-gradient(180deg, rgba(2,132,199,0.55), rgba(3,30,52,0.9))',
      }}
    >
      <div className="flex items-center justify-center gap-1.5 text-white font-black text-base">
        {isHigh ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        {isHigh ? 'ハイ' : 'ロー'}
      </div>
      <div className="text-[10px] font-bold text-white/60 mt-0.5">勝率 {(chance * 100).toFixed(1)}%</div>
      <div className="font-mono text-sm font-black text-amber-300 mt-1">
        {amount > 0 ? amount.toLocaleString() + ' G' : '—'}
      </div>
    </button>
  );
}

function HowItWorks() {
  return (
    <div className="text-[11px] space-y-1.5">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <div className="text-amber-300/80 font-black">倍率</div>
        <div className="text-gray-300">残りカードの枚数から <span className="font-mono text-white">1 ÷ 勝率</span> で計算（引き分けは除外）</div>
        <div className="text-amber-300/80 font-black">控除率</div>
        <div className="text-gray-300">1回のベットにつき <span className="text-rose-300 font-bold">4.0%</span> を最初の1手だけ差し引き</div>
        <div className="text-amber-300/80 font-black">還元率</div>
        <div className="text-gray-300">どこで降りても <span className="text-emerald-300 font-bold">96.0%</span>（何連勝しても変わりません）</div>
        <div className="text-amber-300/80 font-black">引き分け</div>
        <div className="text-gray-300">同じ数字が出たら、そのカードは捨てて引き直し（倍率も連勝もそのまま）</div>
        <div className="text-amber-300/80 font-black">強さ</div>
        <div className="text-gray-300">2 が最弱、A が最強。スートは関係ありません</div>
      </div>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        山札は52枚。残りが {RESHUFFLE_AT} 枚を切ったら新しい山札に替えます（画面でお知らせします）。
        倍率はいつでも「そのとき卓に残っているカード」から計算しているので、数えれば有利な手が分かります。
      </p>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function HighLow({
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
  const [wager, setWager] = useState(0);        // ベット入力中の額
  const [stake, setStake] = useState(0);        // 実際に賭けた額
  const [deck, setDeck] = useState([]);
  const [current, setCurrent] = useState(null);
  const [drawn, setDrawn] = useState(null);     // めくり中のカード
  const [pushCard, setPushCard] = useState(null);
  const [cum, setCum] = useState(1);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState('BET');    // BET | PLAY | REVEAL | BUST
  const [trail, setTrail] = useState([]);
  const [sound, setSound] = useState(true);
  const [bestStreak, setBestStreak] = useState(0);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const soundRef = useRef(true);
  const rndRef = useRef(null);
  if (rndRef.current === null) rndRef.current = mulberry32((Date.now() ^ 0x165667b1) >>> 0);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const sleep = useCallback((ms) => new Promise((res) => {
    timersRef.current.push(setTimeout(res, ms));
  }), []);

  const counts = useMemo(() => countRemaining(deck, current), [deck, current]);
  const pHigh = winChance(counts, 'HIGH');
  const pLow = winChance(counts, 'LOW');
  const cumHigh = nextMultiplier(cum, streak, pHigh);
  const cumLow = nextMultiplier(cum, streak, pLow);
  const potNow = Math.floor(stake * cum);

  /* --- ベット入力 --- */
  const addChip = useCallback(() => {
    if (busyRef.current || phase !== 'BET') return;
    setWager((w) => {
      if (w + chip > MAX_BET) { showToast(`この卓のベット上限は ${MAX_BET.toLocaleString()} Y です。`, 'warning'); return w; }
      if (w + chip > balance) { showToast('所持金を超えるベットはできません。', 'error'); return w; }
      return w + chip;
    });
    playSfx('click', soundRef.current);
  }, [phase, chip, balance, MAX_BET, showToast]);

  const clearWager = useCallback(() => {
    if (busyRef.current || phase !== 'BET') return;
    setWager(0);
    playSfx('click', soundRef.current);
  }, [phase]);

  const maxWager = useCallback(() => {
    if (busyRef.current || phase !== 'BET') return;
    const cap = Math.floor(Math.min(MAX_BET, balance) / 100) * 100;
    if (cap <= 0) { showToast('所持金が足りません。', 'error'); return; }
    setWager(cap);
    playSfx('coin', soundRef.current);
  }, [phase, MAX_BET, balance, showToast]);

  /* --- ゲーム開始 --- */
  const start = useCallback(async () => {
    if (busyRef.current || phase !== 'BET') return;
    if (wager <= 0) { showToast('チップを積んでください。', 'error'); return; }
    if (wager > balance) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    try {
      await updateBalance(-wager);
    } catch (e) {
      busyRef.current = false;
      showToast('所持金が足りません。', 'error');
      return;
    }
    // ===== 山札はこの時点で確定済み（以降の引き直しは不可） =====
    let d = deck.length < RESHUFFLE_AT ? buildDeck(rndRef.current) : deck;
    const first = d[0];
    d = d.slice(1);
    if (!mountedRef.current) { busyRef.current = false; return; }
    setDeck(d);
    setCurrent(first);
    setDrawn(null);
    setPushCard(null);
    setCum(1);
    setStreak(0);
    setStake(wager);
    setTrail([first]);
    setPhase('PLAY');
    playSfx('gate', soundRef.current);
    busyRef.current = false;
  }, [phase, wager, balance, deck, updateBalance, showToast]);

  /* --- ハイ／ローを選ぶ --- */
  const guess = useCallback(async (dir) => {
    if (busyRef.current || phase !== 'PLAY' || !current) return;
    const p = dir === 'HIGH' ? pHigh : pLow;
    if (p <= 0) { showToast('その方向はもう出ません。', 'warning'); return; }
    busyRef.current = true;

    const newCum = nextMultiplier(cum, streak, p);

    // 山札の先頭から、同じ数字（引き分け）を捨てながら決着のカードを探す
    const d = deck.slice();
    const pushes = [];
    let decided = null;
    while (d.length > 0) {
      const c = d.shift();
      if (c.r === current.r) { pushes.push(c); continue; }
      decided = c;
      break;
    }
    if (!decided) {
      busyRef.current = false;
      showToast('山札が尽きました。もう一度お試しください。', 'error');
      return;
    }

    setPhase('REVEAL');
    for (let i = 0; i < pushes.length; i++) {
      if (!mountedRef.current) { busyRef.current = false; return; }
      setPushCard(pushes[i]);
      playSfx('tick', soundRef.current);
      showToast('引き分け！ カードを捨ててもう1枚。', 'info');
      await sleep(620);
    }
    if (!mountedRef.current) { busyRef.current = false; return; }
    setPushCard(null);
    setDrawn(decided);
    playSfx('stop', soundRef.current);
    await sleep(520);
    if (!mountedRef.current) { busyRef.current = false; return; }

    const won = dir === 'HIGH' ? decided.r > current.r : decided.r < current.r;
    let nextDeck = d;
    let reshuffled = false;
    if (nextDeck.length < RESHUFFLE_AT) { nextDeck = buildDeck(rndRef.current); reshuffled = true; }

    setDeck(nextDeck);
    setDrawn(null);
    setTrail((t) => [...t, decided].slice(-14));

    if (won) {
      const ns = streak + 1;
      setCurrent(decided);
      setCum(newCum);
      setStreak(ns);
      setBestStreak((b) => (ns > b ? ns : b));
      setPhase('PLAY');
      playSfx(ns >= 5 ? 'big' : 'win', soundRef.current);
      showToast(`的中！ ${ns} 連勝  ×${newCum.toFixed(2)}（${Math.floor(stake * newCum).toLocaleString()} Y）`, 'success');
    } else {
      setStreak(0);
      setCum(1);
      setCurrent(decided);
      setPhase('BUST');
      playSfx('lose', soundRef.current);
      showToast(`はずれ… ${stake.toLocaleString()} Y を失いました。`, 'error');
    }
    if (reshuffled) showToast('山札を新しいものに替えました。', 'info');
    busyRef.current = false;
  }, [phase, current, pHigh, pLow, cum, streak, deck, stake, showToast, sleep]);

  /* --- 降りる --- */
  const cashOut = useCallback(async () => {
    if (busyRef.current || phase !== 'PLAY' || streak < 1) return;
    busyRef.current = true;
    const amount = Math.floor(stake * cum);
    try { await updateBalance(amount); } catch (e) { /* noop */ }
    if (!mountedRef.current) { busyRef.current = false; return; }
    playSfx('coin', soundRef.current);
    showToast(`${streak} 連勝で降りました。 +${amount.toLocaleString()} Y`, 'success');
    if (streak >= 10 || (amount >= stake * 20 && amount >= 100000)) {
      emitNews(`🎴 ${playerName} がハイ＆ローで ${streak} 連勝！ ${amount.toLocaleString()} Y を獲得！`, 'jackpot');
    }
    setPhase('BET');
    setStreak(0);
    setCum(1);
    setStake(0);
    busyRef.current = false;
  }, [phase, streak, stake, cum, updateBalance, showToast, emitNews, playerName]);

  const backToBet = useCallback(() => {
    if (busyRef.current) return;
    setPhase('BET');
    setStreak(0);
    setCum(1);
    setStake(0);
    setDrawn(null);
    setPushCard(null);
  }, []);

  const locked = phase === 'REVEAL';
  const glow = Math.min(streak, 12);
  const tableStyle = {
    background: highRoller
      ? 'radial-gradient(ellipse at 50% 0%, #5c1022 0%, #2b0711 68%, #140409 100%)'
      : 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 82%)',
    boxShadow: streak > 0
      ? `0 0 ${10 + glow * 5}px ${glow * 1.6}px rgba(251,191,36,${0.10 + glow * 0.045}), inset 0 0 ${glow * 8}px rgba(251,191,36,${glow * 0.02})`
      : 'none',
  };

  return (
    <div className="p-2 sm:p-4 max-w-4xl mx-auto">
      <style>{`
        @keyframes hlFlip {
          0% { transform: rotateY(90deg) scale(0.86); opacity: 0.2; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .hl-flip { animation: hlFlip 0.4s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes hlPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        .hl-pulse { animation: hlPulse 1.1s ease-in-out infinite; }
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
        icon={<Flame size={22} />}
        title="ハイ＆ロー"
        sub={highRoller ? 'ハイローラー卓 — 上限 10,000,000 Y' : '連勝するほど倍率が伸びる・いつでも降りられる'}
      />

      <div className="flex flex-col lg:flex-row gap-3">
        {/* ===== 卓 ===== */}
        <div className="lg:w-[58%] space-y-3">
          <Panel gold={streak >= 5} className="p-3">
            <div className="rounded-2xl border-2 border-amber-900/50 p-3 transition-shadow duration-500" style={tableStyle}>
              {/* 連勝と倍率 */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">STREAK</span>
                  <span className={`font-mono text-2xl font-black ${streak >= 10 ? 'text-amber-300' : streak >= 5 ? 'text-amber-200' : 'text-white'}`}>
                    {streak}
                  </span>
                  {streak >= 10 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-300/50 text-amber-200 hl-pulse">HOT!</span>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black tracking-widest text-amber-200/70">現在の配当</div>
                  <div className="font-mono text-xl font-black text-amber-300">
                    {phase === 'BET' ? '—' : `${potNow.toLocaleString()} Y`}
                    {phase !== 'BET' && <span className="text-[11px] text-white/50 ml-1">×{cum.toFixed(2)}</span>}
                  </div>
                </div>
              </div>

              {/* カード */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 py-2 min-h-[8rem]">
                <div className="text-center">
                  <div className="text-[10px] font-black text-white/50 tracking-widest mb-1">いまのカード</div>
                  {current ? <PlayingCard card={current} /> : <PlayingCard hidden />}
                </div>
                <div className="text-2xl font-black text-amber-300/60">→</div>
                <div className="text-center">
                  <div className="text-[10px] font-black text-white/50 tracking-widest mb-1">次のカード</div>
                  {pushCard
                    ? <div className="hl-flip"><PlayingCard card={pushCard} dim /></div>
                    : drawn
                      ? <div className="hl-flip"><PlayingCard card={drawn} /></div>
                      : <PlayingCard hidden />}
                </div>
              </div>

              {pushCard && (
                <div className="text-center text-[11px] font-black text-amber-200">引き分け！ 捨ててもう1枚めくります</div>
              )}

              {/* 残り枚数 */}
              {phase !== 'BET' && current && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  <div className="bg-black/40 border border-white/10 rounded-lg py-1">
                    <div className="text-[9px] text-gray-400 font-bold">山札</div>
                    <div className="font-mono text-sm font-black text-white">{deck.length}</div>
                  </div>
                  <div className="bg-emerald-950/50 border border-emerald-400/20 rounded-lg py-1">
                    <div className="text-[9px] text-emerald-300/70 font-bold">上（ハイ）</div>
                    <div className="font-mono text-sm font-black text-emerald-300">{counts.hi}</div>
                  </div>
                  <div className="bg-amber-950/50 border border-amber-400/20 rounded-lg py-1">
                    <div className="text-[9px] text-amber-300/70 font-bold">同じ</div>
                    <div className="font-mono text-sm font-black text-amber-300">{counts.eq}</div>
                  </div>
                  <div className="bg-sky-950/50 border border-sky-400/20 rounded-lg py-1">
                    <div className="text-[9px] text-sky-300/70 font-bold">下（ロー）</div>
                    <div className="font-mono text-sm font-black text-sky-300">{counts.lo}</div>
                  </div>
                </div>
              )}
            </div>

            {/* 操作 */}
            {(phase === 'PLAY' || phase === 'REVEAL') && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <ChoiceButton dir="HIGH" chance={pHigh} amount={Math.floor(stake * cumHigh)} disabled={locked || pHigh <= 0} onClick={guess} />
                  <ChoiceButton dir="LOW" chance={pLow} amount={Math.floor(stake * cumLow)} disabled={locked || pLow <= 0} onClick={guess} />
                </div>
                <GoldButton onClick={cashOut} disabled={locked || streak < 1} className="w-full py-3 text-base">
                  {streak < 1 ? '1手めは必ず勝負します' : `降りる（+${potNow.toLocaleString()} Y）`}
                </GoldButton>
                <p className="text-[10px] text-gray-500 text-center">
                  いまのカードは <span className="text-white font-bold">{current ? CARD_RANK_LABEL[current.r] : '-'}</span>。
                  2 が最弱、A が最強です。
                </p>
              </div>
            )}

            {phase === 'BUST' && (
              <div className="mt-3 p-3 rounded-2xl border-2 border-red-500/40 bg-black/50 text-center">
                <div className="text-xl font-black text-red-400">はずれ</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  賭け金 {stake.toLocaleString()} Y を失いました（最高連勝 {bestStreak}）
                </div>
                <GoldButton onClick={backToBet} className="w-full mt-3 py-2.5">もう一度</GoldButton>
              </div>
            )}
          </Panel>

          {trail.length > 1 && (
            <Panel className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-black text-gray-500 tracking-[0.25em]">めくったカード</div>
                <div className="text-[10px] text-gray-500 font-bold">最高連勝 {bestStreak}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {trail.map((c, i) => <PlayingCard key={i} card={c} tiny />)}
              </div>
            </Panel>
          )}
        </div>

        {/* ===== ベット・説明 ===== */}
        <div className="lg:w-[42%] space-y-3">
          <Panel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">チップを積む</h3>
              <span className="text-[10px] text-gray-500">上限 {MAX_BET.toLocaleString()} Y</span>
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

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex-1 min-w-[110px]">
                <div className="text-[10px] text-gray-400 font-bold">ベット額</div>
                <div className="font-mono text-xl font-black text-amber-300">{wager.toLocaleString()} Y</div>
              </div>
              <button onClick={addChip} disabled={phase !== 'BET'}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-3 rounded-xl transition disabled:opacity-30 text-[11px]">
                ＋ 積む
              </button>
              <button onClick={maxWager} disabled={phase !== 'BET'}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                最大
              </button>
              <button onClick={clearWager} disabled={phase !== 'BET' || wager === 0}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Trash2 size={13} /> クリア
              </button>
            </div>

            <GoldButton onClick={start} disabled={phase !== 'BET' || wager <= 0} className="w-full mt-2 py-3 text-base">
              勝負を始める
            </GoldButton>
            {phase !== 'BET' && (
              <p className="text-[10px] text-amber-200/70 mt-1.5 flex items-center gap-1">
                <Shuffle size={11} /> 勝負中はベットを変えられません。降りると次の勝負に進めます。
              </p>
            )}
          </Panel>

          <Panel className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Info size={14} className="text-amber-300" />
              <h3 className="text-sm font-black text-white">倍率の決まり方と控除率</h3>
            </div>
            <HowItWorks />
          </Panel>
        </div>
      </div>
    </div>
  );
}
