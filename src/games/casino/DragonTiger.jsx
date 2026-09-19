import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trash2, Undo2, Volume2, VolumeX, Swords, Info, Crown, Repeat } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, Chip, PlayingCard, playSfx } from '../../shared/ui.jsx';
import { CARD_SUITS, CARD_RANK_LABEL } from '../../shared/cards.js';

/* ==========================================================
   DRAGON TIGER（ドラゴンタイガー）
   ・ドラゴンと タイガー に1枚ずつ。強い方が勝ち（A が最弱、K が最強）。
   ・引き分けはドラゴン／タイガー／スートの賭けが「半額没収」。
   ・1ゲームが速いので「オート10回」を用意。
   ・6デッキ・シュー式。ベット確定と同時に結果も確定する。
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

export const DT_DECKS = 6;

export function buildShoe(rnd, decks = DT_DECKS) {
  const a = [];
  for (let d = 0; d < decks; d++) {
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) a.push({ r, s });
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** A を 1（最弱）、K を 13（最強）として扱う */
export const dtValue = (c) => (c.r === 14 ? 1 : c.r);

export function dtWinner(d, t) {
  const dv = dtValue(d), tv = dtValue(t);
  return dv > tv ? 'D' : tv > dv ? 'T' : 'TIE';
}

/* ---------- 配当（賭け金を含む総額の倍率） ---------- */
export const DT_PAYOUTS = {
  MAIN: 2,   // 1:1（引き分けは半額没収 → 0.5 返却）
  TIE: 13,   // 12:1
  SUIT: 4,   // 3:1（引き分けは半額没収）
};

export function settleDT(bets, d, t) {
  const w = dtWinner(d, t);
  let win = 0;
  if (bets.DRAGON) win += w === 'D' ? bets.DRAGON * DT_PAYOUTS.MAIN : w === 'TIE' ? Math.floor(bets.DRAGON * 0.5) : 0;
  if (bets.TIGER) win += w === 'T' ? bets.TIGER * DT_PAYOUTS.MAIN : w === 'TIE' ? Math.floor(bets.TIGER * 0.5) : 0;
  if (bets.TIE) win += w === 'TIE' ? bets.TIE * DT_PAYOUTS.TIE : 0;
  for (let s = 0; s < 4; s++) {
    const k = 'SUIT' + s;
    const amount = bets[k];
    if (!amount) continue;
    if (w === 'TIE') win += Math.floor(amount * 0.5);
    else {
      const winner = w === 'D' ? d : t;
      if (winner.s === s) win += amount * DT_PAYOUTS.SUIT;
    }
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

function SideBox({ side, card, revealed, winner, amount, onPlace, onRemove, disabled }) {
  const isDragon = side === 'DRAGON';
  const won = revealed && winner === (isDragon ? 'D' : 'T');
  const tie = revealed && winner === 'TIE';
  return (
    <div
      className={`flex-1 rounded-2xl border-2 p-2.5 text-center transition ${won ? 'dt-glow border-amber-300' : tie ? 'border-white/25' : isDragon ? 'border-emerald-400/30' : 'border-orange-400/30'}`}
      style={{
        background: isDragon
          ? 'linear-gradient(180deg, rgba(6,78,59,0.65) 0%, rgba(3,25,20,0.9) 100%)'
          : 'linear-gradient(180deg, rgba(124,45,18,0.55) 0%, rgba(30,10,4,0.9) 100%)',
      }}
    >
      <div className="text-2xl leading-none">{isDragon ? '🐉' : '🐅'}</div>
      <div
        className="text-xs font-black tracking-[0.25em] mt-0.5"
        style={{ color: isDragon ? '#6ee7b7' : '#fdba74' }}
      >
        {isDragon ? 'DRAGON' : 'TIGER'}
      </div>
      <div className="text-[10px] font-bold text-white/50">{isDragon ? '龍' : '虎'}</div>

      <div className="flex justify-center my-2 min-h-[6rem] items-center">
        {card ? <div className={revealed ? 'dt-flip' : ''}><PlayingCard card={revealed ? card : null} hidden={!revealed} /></div> : <PlayingCard hidden />}
      </div>

      <div className="font-mono text-lg font-black text-white h-6">
        {revealed && card ? dtValue(card) : '-'}
      </div>

      <button
        onClick={() => onPlace(side)}
        onContextMenu={(e) => { e.preventDefault(); onRemove(side); }}
        disabled={disabled}
        className="relative w-full mt-1.5 py-2 rounded-xl border-2 font-black text-white text-sm transition hover:brightness-125 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        style={{
          borderColor: isDragon ? 'rgba(52,211,153,0.6)' : 'rgba(251,146,60,0.6)',
          background: isDragon ? 'rgba(6,95,70,0.55)' : 'rgba(154,52,18,0.55)',
        }}
      >
        ×2.00 に賭ける
        {amount > 0 && (
          <span className="absolute -top-2 -right-2 z-10"><Chip value={chipLabel(amount)} color="#eab308" size={24} /></span>
        )}
      </button>
    </div>
  );
}

function PayTable() {
  const rows = [
    ['ドラゴン／タイガー', '×2.00（1:1）', '3.70%'],
    ['タイ（引き分け）', '×13.00（12:1）', '3.86%'],
    ['スート指定', '×4.00（3:1）', '3.70%'],
  ];
  return (
    <div className="text-[11px]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
        <div className="font-black text-amber-300/80">賭け方</div>
        <div className="font-black text-amber-300/80 text-right">配当（賭け金込み）</div>
        <div className="font-black text-amber-300/80 text-right">控除率</div>
        {rows.map((r) => (
          <React.Fragment key={r[0]}>
            <div className="text-gray-300">{r[0]}</div>
            <div className="text-white font-mono text-right">{r[1]}</div>
            <div className="text-rose-300/90 font-mono text-right">{r[2]}</div>
          </React.Fragment>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
        引き分けのとき、ドラゴン／タイガー／スートへの賭けは<span className="text-amber-200 font-bold">半額没収</span>（半分だけ返却）です。
        A が最弱、K が最強。6デッキ・シュー式。スート指定は「勝った側のカードのスート」を当てる賭けです。
        卓全体の還元率は <span className="text-emerald-300 font-bold">約96.3%</span>。
      </p>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function DragonTiger({
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
  const [lastSpot, setLastSpot] = useState('DRAGON');
  const [phase, setPhase] = useState('BET');    // BET | DEAL | RESULT
  const [dragon, setDragon] = useState(null);
  const [tiger, setTiger] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [payout, setPayout] = useState(0);
  const [staked, setStaked] = useState(0);
  const [history, setHistory] = useState([]);
  const [autoLeft, setAutoLeft] = useState(0);
  const [shoeLeft, setShoeLeft] = useState(DT_DECKS * 52);
  const [sound, setSound] = useState(true);

  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const soundRef = useRef(true);
  const rndRef = useRef(null);
  const shoeRef = useRef(null);

  if (rndRef.current === null) {
    rndRef.current = mulberry32((Date.now() ^ 0xc2b2ae35) >>> 0);
    shoeRef.current = { cards: buildShoe(rndRef.current), idx: 0 };
  }

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const totalBet = useMemo(() => Object.values(bets).reduce((a, b) => a + b, 0), [bets]);
  const winner = revealed && dragon && tiger ? dtWinner(dragon, tiger) : null;

  const sleep = useCallback((ms) => new Promise((res) => {
    timersRef.current.push(setTimeout(res, ms));
  }), []);

  const place = useCallback((id) => {
    if (busyRef.current || phase === 'DEAL') return;
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
    if (busyRef.current || phase === 'DEAL') return;
    setBets((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, [phase]);

  const clearBets = useCallback(() => {
    if (busyRef.current) return;
    setBets({});
    playSfx('click', soundRef.current);
  }, []);

  const maxBet = useCallback(() => {
    if (busyRef.current) return;
    const cap = Math.min(MAX_BET, balance);
    const room = Math.floor((cap - totalBet) / 100) * 100;
    if (room <= 0) { showToast('これ以上は賭けられません。', 'warning'); return; }
    setBets((prev) => ({ ...prev, [lastSpot]: (prev[lastSpot] || 0) + room }));
    playSfx('coin', soundRef.current);
  }, [MAX_BET, balance, totalBet, lastSpot, showToast]);

  const repeatBets = useCallback(() => {
    if (busyRef.current || !lastBets) return;
    const s = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (s > balance) { showToast('所持金が足りません。', 'error'); return; }
    setBets({ ...lastBets });
    playSfx('click', soundRef.current);
  }, [lastBets, balance, showToast]);

  /** 1ゲームぶんを最後まで進める。成功したら true */
  const playOne = useCallback(async (snapshot, announce) => {
    const stake = Object.values(snapshot).reduce((a, b) => a + b, 0);
    try {
      await updateBalance(-stake);
    } catch (e) {
      showToast('所持金が足りません。', 'error');
      return false;
    }

    // ===== 結果をここで確定（以降は演出だけ） =====
    let sh = shoeRef.current;
    if (sh.idx > sh.cards.length - 10) {
      sh = { cards: buildShoe(rndRef.current), idx: 0 };
      shoeRef.current = sh;
      if (mountedRef.current) showToast('シューをシャッフルしました。', 'info');
    }
    const d = sh.cards[sh.idx];
    const t = sh.cards[sh.idx + 1];
    sh.idx += 2;

    if (!mountedRef.current) return false;
    setShoeLeft(sh.cards.length - sh.idx);
    setStaked(stake);
    setDragon(d);
    setTiger(t);
    setRevealed(false);
    setPayout(0);
    setPhase('DEAL');
    playSfx('gate', soundRef.current);

    await sleep(460);
    if (!mountedRef.current) return false;
    setRevealed(true);
    playSfx('stop', soundRef.current);
    await sleep(420);
    if (!mountedRef.current) return false;

    const win = settleDT(snapshot, d, t);
    if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
    if (!mountedRef.current) return false;

    const w = dtWinner(d, t);
    setPayout(win);
    setPhase('RESULT');
    setHistory((h) => [{ w, d, t }, ...h].slice(0, 24));

    if (announce) {
      if (win > stake) {
        playSfx(win >= stake * 8 ? 'big' : 'win', soundRef.current);
        showToast(`${w === 'D' ? '🐉 ドラゴン' : w === 'T' ? '🐅 タイガー' : '引き分け'}の勝ち  +${win.toLocaleString()} Y`, 'success');
      } else if (win > 0) {
        playSfx('coin', soundRef.current);
        showToast(`${w === 'TIE' ? '引き分け（半額没収）' : 'ハズレ'}  +${win.toLocaleString()} Y`, 'warning');
      } else {
        playSfx('lose', soundRef.current);
        showToast(`${w === 'D' ? '🐉 ドラゴン' : w === 'T' ? '🐅 タイガー' : '引き分け'}  -${stake.toLocaleString()} Y`, 'error');
      }
    }
    if (win >= stake * 20 && win >= 100000) {
      emitNews(`🐉 ${playerName} がドラゴンタイガーで ${win.toLocaleString()} Y を的中！`, 'jackpot');
    }
    return true;
  }, [updateBalance, showToast, emitNews, playerName, sleep]);

  const dealOnce = useCallback(async () => {
    if (busyRef.current) return;
    if (totalBet <= 0) { showToast('チップを置いてください。', 'error'); return; }
    if (totalBet > balance) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    const snapshot = { ...bets };
    setLastBets(snapshot);
    await playOne(snapshot, true);
    busyRef.current = false;
  }, [totalBet, balance, bets, showToast, playOne]);

  const runAuto = useCallback(async () => {
    if (busyRef.current) return;
    if (totalBet <= 0) { showToast('チップを置いてください。', 'error'); return; }
    if (totalBet > balance) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    autoRef.current = true;
    const snapshot = { ...bets };
    setLastBets(snapshot);
    let done = 0;
    for (let i = 0; i < 10; i++) {
      if (!autoRef.current || !mountedRef.current) break;
      setAutoLeft(10 - i);
      const ok = await playOne(snapshot, false);
      if (!ok) break;
      done += 1;
      await sleep(620);
    }
    if (mountedRef.current) {
      setAutoLeft(0);
      showToast(`オート ${done} 回を実行しました。`, 'info');
    }
    autoRef.current = false;
    busyRef.current = false;
  }, [totalBet, balance, bets, showToast, playOne, sleep]);

  const stopAuto = useCallback(() => { autoRef.current = false; }, []);

  const nextGame = useCallback(() => {
    if (busyRef.current) return;
    setPhase('BET');
    setRevealed(false);
    setDragon(null);
    setTiger(null);
    setPayout(0);
  }, []);

  const feltStyle = highRoller
    ? { background: 'radial-gradient(ellipse at 50% 0%, #5c1022 0%, #2b0711 68%, #140409 100%)' }
    : { background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 82%)' };
  const locked = phase === 'DEAL' || autoLeft > 0;

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto">
      <style>{`
        @keyframes dtFlip {
          0% { transform: rotateY(90deg) scale(0.86); opacity: 0.2; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        .dt-flip { animation: dtFlip 0.42s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes dtGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.0); }
          50% { box-shadow: 0 0 26px 6px rgba(251,191,36,0.5); }
        }
        .dt-glow { animation: dtGlow 1.3s ease-in-out infinite; }
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
        icon={<Swords size={22} />}
        title="ドラゴンタイガー"
        sub={highRoller ? 'ハイローラー卓 — 上限 10,000,000 Y' : '1枚勝負・A が最弱、K が最強'}
      />

      <div className="flex flex-col lg:flex-row gap-3">
        {/* ===== 卓 ===== */}
        <div className="lg:w-[58%] space-y-3">
          <Panel gold className="p-3">
            <div className="rounded-2xl border-2 border-amber-600/40 p-2.5" style={feltStyle}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">DRAGON ✦ TIGER</span>
                <span className="text-[10px] text-gray-400 font-bold">シュー残り {shoeLeft} 枚</span>
              </div>

              <div className="flex items-stretch gap-2">
                <SideBox
                  side="DRAGON" card={dragon} revealed={revealed} winner={winner}
                  amount={bets.DRAGON} onPlace={place} onRemove={removeSpot} disabled={locked}
                />

                {/* 中央：タイ */}
                <div className="w-[26%] sm:w-[22%] flex flex-col items-center justify-center gap-2">
                  <div className="text-[10px] font-black tracking-widest text-amber-200/60">VS</div>
                  <button
                    onClick={() => place('TIE')}
                    onContextMenu={(e) => { e.preventDefault(); removeSpot('TIE'); }}
                    disabled={locked}
                    className={`relative w-full py-3 rounded-xl border-2 font-black text-white text-xs transition hover:brightness-125 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${revealed && winner === 'TIE' ? 'dt-glow border-amber-300' : 'border-amber-400/40'}`}
                    style={{ background: 'linear-gradient(180deg, rgba(120,53,15,0.7), rgba(41,17,3,0.85))' }}
                  >
                    タイ
                    <span className="block text-[10px] opacity-70">×13.00</span>
                    {bets.TIE > 0 && (
                      <span className="absolute -top-2 -right-2 z-10"><Chip value={chipLabel(bets.TIE)} color="#eab308" size={24} /></span>
                    )}
                  </button>
                  {revealed && (
                    <div className="text-[11px] font-black text-center leading-tight">
                      {winner === 'D' && <span className="text-emerald-300">龍の勝ち</span>}
                      {winner === 'T' && <span className="text-orange-300">虎の勝ち</span>}
                      {winner === 'TIE' && <span className="text-amber-200">引き分け</span>}
                    </div>
                  )}
                </div>

                <SideBox
                  side="TIGER" card={tiger} revealed={revealed} winner={winner}
                  amount={bets.TIGER} onPlace={place} onRemove={removeSpot} disabled={locked}
                />
              </div>

              {/* スート指定 */}
              <div className="mt-2">
                <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">スート指定（勝った側のスート）×4.00</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CARD_SUITS.map((su, i) => (
                    <button
                      key={i}
                      onClick={() => place('SUIT' + i)}
                      onContextMenu={(e) => { e.preventDefault(); removeSpot('SUIT' + i); }}
                      disabled={locked}
                      className={`relative py-2 rounded-lg border-2 font-black text-lg transition hover:brightness-125 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${revealed && winner !== 'TIE' && winner && ((winner === 'D' ? dragon : tiger).s === i) ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-white/20'}`}
                      style={{ background: 'rgba(0,0,0,0.45)', color: su.red ? '#fb7185' : '#e5e7eb' }}
                    >
                      {su.s}
                      {bets['SUIT' + i] > 0 && (
                        <span className="absolute -top-2 -right-2 z-10"><Chip value={chipLabel(bets['SUIT' + i])} color="#eab308" size={20} /></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {phase === 'DEAL' && (
                <div className="mt-2 text-center">
                  <span className="px-3 py-1 rounded-full bg-black/70 text-amber-300 text-[11px] font-black border border-amber-400/30">NO MORE BETS</span>
                </div>
              )}
            </div>

            {phase === 'RESULT' && (
              <div className={`mt-3 p-3 rounded-2xl border-2 ${payout > staked ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-white">
                    {dragon && tiger && (
                      <>🐉 {CARD_RANK_LABEL[dragon.r]}{CARD_SUITS[dragon.s].s} <span className="text-white/40">vs</span> {CARD_RANK_LABEL[tiger.r]}{CARD_SUITS[tiger.s].s} 🐅</>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${payout > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {payout > 0 ? '+' + payout.toLocaleString() : '0'} Y
                    </div>
                    <div className={`text-[11px] font-bold ${payout - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      収支 {payout - staked >= 0 ? '+' : ''}{(payout - staked).toLocaleString()} Y
                    </div>
                  </div>
                </div>
                {autoLeft === 0 && <GoldButton onClick={nextGame} className="w-full mt-2 py-2.5">次のゲームへ</GoldButton>}
              </div>
            )}
          </Panel>

          {/* 履歴 */}
          <Panel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">履歴</h3>
              <span className="text-[10px] text-gray-500">直近24回（新しい順）</span>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-2 min-h-[2.5rem]">
              {history.length === 0
                ? <div className="text-[11px] text-gray-500 py-2 text-center">まだ記録がありません</div>
                : (
                  <div className="flex flex-wrap gap-1">
                    {history.map((h, i) => (
                      <span
                        key={i}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border"
                        style={{
                          background: h.w === 'D' ? 'rgba(16,185,129,0.22)' : h.w === 'T' ? 'rgba(249,115,22,0.22)' : 'rgba(251,191,36,0.22)',
                          borderColor: h.w === 'D' ? 'rgba(52,211,153,0.6)' : h.w === 'T' ? 'rgba(251,146,60,0.6)' : 'rgba(251,191,36,0.6)',
                          color: '#fff',
                        }}
                      >
                        {h.w === 'D' ? '龍' : h.w === 'T' ? '虎' : '和'}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </Panel>
        </div>

        {/* ===== 操作 ===== */}
        <div className="lg:w-[42%] space-y-3">
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

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex-1 min-w-[110px]">
                <div className="text-[10px] text-gray-400 font-bold">合計ベット</div>
                <div className="font-mono text-xl font-black text-amber-300">{totalBet.toLocaleString()} Y</div>
              </div>
              <button onClick={repeatBets} disabled={locked || !lastBets}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Undo2 size={13} /> 同じ賭け
              </button>
              <button onClick={maxBet} disabled={locked}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                最大
              </button>
              <button onClick={clearBets} disabled={locked || totalBet === 0}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Trash2 size={13} /> クリア
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <GoldButton onClick={dealOnce} disabled={locked || totalBet <= 0} className="py-3 text-base">
                {phase === 'DEAL' ? '配っています…' : '勝負する'}
              </GoldButton>
              {autoLeft > 0 ? (
                <button onClick={stopAuto}
                  className="py-3 rounded-xl font-black text-sm bg-rose-700/80 border border-rose-300/50 text-white hover:brightness-110 active:scale-95 transition">
                  オート停止（残り {autoLeft}）
                </button>
              ) : (
                <button onClick={runAuto} disabled={locked || totalBet <= 0}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-black text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95 transition disabled:opacity-30">
                  <Repeat size={15} /> オート10回
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              オートは同じベットを10回くり返します。所持金が足りなくなったら自動で止まります。上限 {MAX_BET.toLocaleString()} Y。
            </p>
          </Panel>

          <Panel className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Info size={14} className="text-amber-300" />
              <h3 className="text-sm font-black text-white">配当表と控除率</h3>
            </div>
            <PayTable />
          </Panel>
        </div>
      </div>
    </div>
  );
}
