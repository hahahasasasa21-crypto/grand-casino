import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trash2, Undo2, Volume2, VolumeX, Sparkles, Info, Crown } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, Chip, PlayingCard, playSfx } from '../../shared/ui.jsx';

/* ==========================================================
   BACCARAT — 本格バカラ（8デッキ・シュー式）
   ・第3カードのルール（バンカーの引き条件表）を正式に実装。
   ・ベットを押した瞬間にシューから結果を確定させ、
     そのあと「絞り」の演出で1枚ずつ開く（引き直しは不可）。
   ・過去20回の出目を罫線（大路 / Big Road）風に並べる。
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

export const BACCARAT_DECKS = 8;

/** 8デッキ分のシューを作ってシャッフル */
export function buildShoe(rnd, decks = BACCARAT_DECKS) {
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

/** バカラのカード価値：A=1、10/J/Q/K=0、それ以外は数字どおり */
export const bacValue = (c) => (c.r >= 10 && c.r <= 13 ? 0 : c.r === 14 ? 1 : c.r);
export const handTotal = (cards) => cards.reduce((a, c) => a + bacValue(c), 0) % 10;

/**
 * 1ゲーム（クー）を配る純粋関数。
 * 配り順は プレイヤー → バンカー → プレイヤー → バンカー。
 */
export function playCoup(shoe, start) {
  let i = start;
  const p = [shoe[i++]];
  const b = [shoe[i++]];
  p.push(shoe[i++]);
  b.push(shoe[i++]);

  const pPair = p[0].r === p[1].r;
  const bPair = b[0].r === b[1].r;

  let pt = handTotal(p);
  let bt = handTotal(b);
  const natural = pt >= 8 || bt >= 8;

  if (!natural) {
    // プレイヤーは 0〜5 でヒット、6〜7 でスタンド
    let pThird = null;
    if (pt <= 5) { pThird = shoe[i++]; p.push(pThird); pt = handTotal(p); }

    // バンカーの引き条件表
    let bDraw;
    if (pThird === null) {
      bDraw = bt <= 5;
    } else {
      const v = bacValue(pThird);
      if (bt <= 2) bDraw = true;
      else if (bt === 3) bDraw = v !== 8;
      else if (bt === 4) bDraw = v >= 2 && v <= 7;
      else if (bt === 5) bDraw = v >= 4 && v <= 7;
      else if (bt === 6) bDraw = v === 6 || v === 7;
      else bDraw = false;
    }
    if (bDraw) { b.push(shoe[i++]); bt = handTotal(b); }
  }

  const outcome = pt > bt ? 'P' : bt > pt ? 'B' : 'T';
  return { p, b, pt, bt, pPair, bPair, outcome, natural, next: i };
}

/* ---------- 配当（賭け金を含む総額の倍率） ---------- */
export const BACCARAT_PAYOUTS = {
  PLAYER: 2,     // 1:1
  BANKER: 1.95,  // 1:0.95（5%コミッション）
  TIE: 9,        // 8:1
  PPAIR: 12,     // 11:1
  BPAIR: 12,     // 11:1
};

/** 賭けたぶんの払い戻し総額（タイのときプレイヤー／バンカーは返却＝プッシュ） */
export function settleBaccarat(bets, coup) {
  const o = coup.outcome;
  let win = 0;
  if (bets.PLAYER) win += o === 'P' ? bets.PLAYER * BACCARAT_PAYOUTS.PLAYER : o === 'T' ? bets.PLAYER : 0;
  if (bets.BANKER) win += o === 'B' ? Math.round(bets.BANKER * BACCARAT_PAYOUTS.BANKER) : o === 'T' ? bets.BANKER : 0;
  if (bets.TIE) win += o === 'T' ? bets.TIE * BACCARAT_PAYOUTS.TIE : 0;
  if (bets.PPAIR) win += coup.pPair ? bets.PPAIR * BACCARAT_PAYOUTS.PPAIR : 0;
  if (bets.BPAIR) win += coup.bPair ? bets.BPAIR * BACCARAT_PAYOUTS.BPAIR : 0;
  return win;
}

/* ---------- 罫線（大路 / Big Road） ---------- */
export function buildBigRoad(history, rows = 6) {
  const grid = {};
  let maxCol = -1;
  let lastO = null, col = -1, row = 0, lastCell = null;
  for (const h of history) {
    if (h.o === 'T') { if (lastCell) lastCell.ties += 1; continue; }
    if (h.o !== lastO) {
      col = maxCol + 1; row = 0; lastO = h.o;
    } else if (row + 1 < rows && !grid[col + ',' + (row + 1)]) {
      row += 1;
    } else {
      let c = col + 1;
      while (grid[c + ',' + row]) c += 1;
      col = c;
    }
    const cell = { o: h.o, ties: 0 };
    grid[col + ',' + row] = cell;
    lastCell = cell;
    if (col > maxCol) maxCol = col;
  }
  return { grid, cols: maxCol + 1 };
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
        <button
          onClick={onSound}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition shrink-0"
        >
          {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <div className="bg-black/60 px-3 py-1.5 rounded-full border border-amber-500/30 font-mono text-sm sm:text-base text-amber-300 font-bold truncate">
          {balance.toLocaleString()} Y
        </div>
      </div>
    </div>
  );
}

function BetSpot({ id, label, sub, amount, onPlace, onRemove, disabled, tone, className = '' }) {
  const toneCls =
    tone === 'player' ? 'from-sky-700/80 to-sky-900/80 border-sky-300/50'
      : tone === 'banker' ? 'from-rose-800/80 to-rose-950/80 border-rose-300/50'
        : tone === 'tie' ? 'from-emerald-700/80 to-emerald-950/80 border-emerald-300/50'
          : 'from-amber-800/60 to-amber-950/70 border-amber-300/40';
  return (
    <button
      onClick={() => onPlace(id)}
      onContextMenu={(e) => { e.preventDefault(); onRemove(id); }}
      disabled={disabled}
      className={`relative select-none rounded-2xl border-2 bg-gradient-to-b ${toneCls} px-2 py-3 text-center transition hover:brightness-125 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      <div className="text-sm sm:text-base font-black text-white leading-tight">{label}</div>
      <div className="text-[10px] font-bold text-white/60 mt-0.5">{sub}</div>
      {amount > 0 && (
        <span className="absolute -top-2 -right-2 z-10">
          <Chip value={chipLabel(amount)} color="#eab308" size={26} />
        </span>
      )}
    </button>
  );
}

function BigRoad({ history }) {
  const road = useMemo(() => buildBigRoad(history), [history]);
  const cols = Math.max(road.cols, 12);
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, 18px)`, gridTemplateRows: 'repeat(6, 18px)', gridAutoFlow: 'column' }}
      >
        {Array.from({ length: cols * 6 }, (_, n) => {
          const c = Math.floor(n / 6);
          const r = n % 6;
          const cell = road.grid[c + ',' + r];
          return (
            <div key={n} className="w-[18px] h-[18px] flex items-center justify-center">
              {cell && (
                <span
                  className="relative w-[15px] h-[15px] rounded-full border-2 block"
                  style={{
                    borderColor: cell.o === 'B' ? '#e11d48' : '#38bdf8',
                    background: cell.o === 'B' ? 'rgba(225,29,72,0.18)' : 'rgba(56,189,248,0.18)',
                  }}
                >
                  {cell.ties > 0 && (
                    <span
                      className="absolute inset-0 block"
                      style={{ background: 'linear-gradient(45deg, transparent 44%, #22c55e 44%, #22c55e 56%, transparent 56%)' }}
                    />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PayTable() {
  const rows = [
    ['プレイヤー', '×2.00（1:1）', '1.24%'],
    ['バンカー', '×1.95（1:0.95）', '1.06%'],
    ['タイ', '×9.00（8:1）', '14.36%'],
    ['プレイヤーペア', '×12.00（11:1）', '10.36%'],
    ['バンカーペア', '×12.00（11:1）', '10.36%'],
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
        タイのとき、プレイヤー／バンカーへの賭けは返却（プッシュ）されます。8デッキ・シュー式。
        メイン70%・サイド30%の標準的なベット構成での卓全体の還元率は <span className="text-emerald-300 font-bold">約95.7%</span> です。
      </p>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function Baccarat({
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
  const [lastSpot, setLastSpot] = useState('PLAYER');
  const [phase, setPhase] = useState('BET');       // BET | DEAL | RESULT
  const [coup, setCoup] = useState(null);
  const [shownP, setShownP] = useState(0);
  const [shownB, setShownB] = useState(0);
  const [payout, setPayout] = useState(0);
  const [staked, setStaked] = useState(0);
  const [history, setHistory] = useState([]);
  const [shoeLeft, setShoeLeft] = useState(BACCARAT_DECKS * 52);
  const [sound, setSound] = useState(true);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const soundRef = useRef(true);
  const rndRef = useRef(null);
  const shoeRef = useRef(null);

  if (rndRef.current === null) {
    rndRef.current = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    shoeRef.current = { cards: buildShoe(rndRef.current), idx: 0 };
  }

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
    const sum = Object.values(lastBets).reduce((a, b) => a + b, 0);
    if (sum > balance) { showToast('所持金が足りません。', 'error'); return; }
    setBets({ ...lastBets });
    playSfx('click', soundRef.current);
  }, [phase, lastBets, balance, showToast]);

  /* --- 決着（演出の最後に呼ばれる） --- */
  const settle = useCallback(async (c, snapshot) => {
    const win = settleBaccarat(snapshot, c);
    const stake = Object.values(snapshot).reduce((a, b) => a + b, 0);
    if (win > 0) { try { await updateBalance(win); } catch (e) { /* noop */ } }
    if (!mountedRef.current) { busyRef.current = false; return; }
    setPayout(win);
    setPhase('RESULT');
    setHistory((h) => [...h, { o: c.outcome, pPair: c.pPair, bPair: c.bPair }].slice(-20));
    const net = win - stake;
    if (win > 0) {
      playSfx(win >= stake * 8 ? 'big' : 'win', soundRef.current);
      const side = c.outcome === 'P' ? 'プレイヤー' : c.outcome === 'B' ? 'バンカー' : 'タイ';
      showToast(`${side}の勝ち（${c.pt} 対 ${c.bt}）  +${win.toLocaleString()} Y`, net >= 0 ? 'success' : 'info');
    } else {
      playSfx('lose', soundRef.current);
      showToast(`ハズレ（プレイヤー ${c.pt} / バンカー ${c.bt}）  -${stake.toLocaleString()} Y`, 'error');
    }
    if (win >= stake * 20 && win >= 100000) {
      emitNews(`🃏 ${playerName} がバカラで ${win.toLocaleString()} Y の大勝ち！`, 'jackpot');
    }
    busyRef.current = false;
  }, [updateBalance, showToast, emitNews, playerName]);

  /* --- 絞りの演出（1枚ずつ開く） --- */
  const runReveal = useCallback((c, snapshot) => {
    const seq = [['p', 1], ['b', 1], ['p', 2], ['b', 2]];
    if (c.p.length > 2) seq.push(['p', 3]);
    if (c.b.length > 2) seq.push(['b', 3]);
    let i = 0;
    const step = () => {
      if (!mountedRef.current) return;
      if (i >= seq.length) {
        timersRef.current.push(setTimeout(() => settle(c, snapshot), 720));
        return;
      }
      const item = seq[i];
      i += 1;
      if (item[0] === 'p') setShownP(item[1]); else setShownB(item[1]);
      playSfx('tick', soundRef.current);
      timersRef.current.push(setTimeout(step, i <= 4 ? 520 : 880));
    };
    timersRef.current.push(setTimeout(step, 280));
  }, [settle]);

  /* --- 配る --- */
  const deal = useCallback(async () => {
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

    // ===== ここで結果を確定させる（以降は演出だけ） =====
    let sh = shoeRef.current;
    let reshuffled = false;
    if (sh.idx > sh.cards.length - 20) {
      sh = { cards: buildShoe(rndRef.current), idx: 0 };
      shoeRef.current = sh;
      reshuffled = true;
    }
    const c = playCoup(sh.cards, sh.idx);
    sh.idx = c.next;

    if (!mountedRef.current) { busyRef.current = false; return; }
    if (reshuffled) showToast('シューをシャッフルしました。', 'info');
    setShoeLeft(sh.cards.length - sh.idx);
    setLastBets(snapshot);
    setStaked(totalBet);
    setCoup(c);
    setShownP(0);
    setShownB(0);
    setPayout(0);
    setPhase('DEAL');
    playSfx('gate', soundRef.current);
    runReveal(c, snapshot);
  }, [phase, totalBet, balance, bets, updateBalance, showToast, runReveal]);

  const nextGame = useCallback(() => {
    if (busyRef.current) return;
    setPhase('BET');
    setCoup(null);
    setBets({});
    setShownP(0);
    setShownB(0);
    setPayout(0);
  }, []);

  const locked = phase === 'DEAL';
  const feltStyle = highRoller
    ? { background: 'radial-gradient(ellipse at 50% 0%, #5c1022 0%, #2b0711 68%, #140409 100%)' }
    : { background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 82%)' };

  const shownPlayer = coup ? coup.p.slice(0, shownP) : [];
  const shownBanker = coup ? coup.b.slice(0, shownB) : [];
  const ptShown = handTotal(shownPlayer);
  const btShown = handTotal(shownBanker);

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto">
      <style>{`
        @keyframes bacSqueeze {
          0%   { transform: translateY(-28px) rotate(-14deg) scale(0.82); opacity: 0; }
          60%  { transform: translateY(3px) rotate(3deg) scale(1.04); opacity: 1; }
          100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        .bac-squeeze { animation: bacSqueeze 0.45s cubic-bezier(.2,.9,.3,1.3) both; }
        @keyframes bacGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); } 50% { box-shadow: 0 0 22px 4px rgba(251,191,36,0.45); } }
        .bac-glow { animation: bacGlow 1.4s ease-in-out infinite; }
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
        icon={<Sparkles size={22} />}
        title="バカラ"
        sub={highRoller ? 'ハイローラー卓 — 上限 10,000,000 Y' : '8デッキ・シュー式／第3カードルール採用'}
      />

      <div className="flex flex-col lg:flex-row gap-3">
        {/* ===== 卓 ===== */}
        <div className="lg:w-[56%] space-y-3">
          <Panel gold={highRoller} className="p-3">
            <div className="rounded-2xl border-2 border-amber-900/50 p-3" style={feltStyle}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">BACCARAT</span>
                <span className="text-[10px] text-gray-400 font-bold">シュー残り {shoeLeft} 枚</span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                {/* プレイヤー */}
                <div className={`flex-1 rounded-xl border-2 p-2 ${phase === 'RESULT' && coup && coup.outcome === 'P' ? 'border-sky-300 bac-glow' : 'border-sky-400/25'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-sky-300 tracking-widest">PLAYER</span>
                    <span className="text-xl font-black text-white font-mono">{shownPlayer.length ? ptShown : '-'}</span>
                  </div>
                  <div className="flex gap-1.5 min-h-[6rem] items-center">
                    {shownPlayer.map((c, i) => (
                      <div key={i} className="bac-squeeze"><PlayingCard card={c} /></div>
                    ))}
                    {phase !== 'BET' && coup && shownPlayer.length < coup.p.length && <PlayingCard hidden />}
                    {phase === 'BET' && <span className="text-[11px] text-white/30 font-bold">ベットを待っています</span>}
                  </div>
                  {coup && shownP >= 2 && coup.pPair && (
                    <span className="inline-block mt-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/40">ペア！</span>
                  )}
                </div>

                {/* バンカー */}
                <div className={`flex-1 rounded-xl border-2 p-2 ${phase === 'RESULT' && coup && coup.outcome === 'B' ? 'border-rose-300 bac-glow' : 'border-rose-400/25'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-rose-300 tracking-widest">BANKER</span>
                    <span className="text-xl font-black text-white font-mono">{shownBanker.length ? btShown : '-'}</span>
                  </div>
                  <div className="flex gap-1.5 min-h-[6rem] items-center">
                    {shownBanker.map((c, i) => (
                      <div key={i} className="bac-squeeze"><PlayingCard card={c} /></div>
                    ))}
                    {phase !== 'BET' && coup && shownBanker.length < coup.b.length && <PlayingCard hidden />}
                  </div>
                  {coup && shownB >= 2 && coup.bPair && (
                    <span className="inline-block mt-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/40">ペア！</span>
                  )}
                </div>
              </div>

              {phase === 'DEAL' && (
                <div className="mt-2 text-center">
                  <span className="px-3 py-1 rounded-full bg-black/70 text-amber-300 text-[11px] font-black border border-amber-400/30">
                    NO MORE BETS — 絞り中…
                  </span>
                </div>
              )}
            </div>

            {phase === 'RESULT' && coup && (
              <div className={`mt-3 p-3 rounded-2xl border-2 ${payout > staked ? 'border-amber-400 bg-amber-500/10' : payout === staked ? 'border-white/20 bg-black/40' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">
                      {coup.outcome === 'P' ? 'プレイヤーの勝ち' : coup.outcome === 'B' ? 'バンカーの勝ち' : 'タイ（引き分け）'}
                      {coup.natural && <span className="ml-2 text-[10px] text-amber-300 font-black">ナチュラル</span>}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">プレイヤー {coup.pt} 対 バンカー {coup.bt}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${payout > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {payout > 0 ? '+' + payout.toLocaleString() : '0'} Y
                    </div>
                    <div className={`text-[11px] font-bold ${payout - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      収支 {payout - staked >= 0 ? '+' : ''}{(payout - staked).toLocaleString()} Y
                    </div>
                  </div>
                </div>
                <GoldButton onClick={nextGame} className="w-full mt-3 py-2.5">次のゲームへ</GoldButton>
              </div>
            )}
          </Panel>

          {/* 罫線（大路） */}
          <Panel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-white">罫線（大路）</h3>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500" />バンカー</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400" />プレイヤー</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 bg-emerald-500 rotate-45" />タイ</span>
              </div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-2">
              {history.length === 0
                ? <div className="text-[11px] text-gray-500 py-4 text-center">まだ記録がありません（直近20回を表示します）</div>
                : <BigRoad history={history} />}
            </div>
          </Panel>
        </div>

        {/* ===== ベット ===== */}
        <div className="lg:w-[44%] space-y-3">
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

          <Panel className="p-3">
            <div className="rounded-2xl border-2 border-amber-900/50 p-2.5" style={feltStyle}>
              <div className="grid grid-cols-3 gap-2">
                <BetSpot id="PLAYER" label="プレイヤー" sub="×2.00" tone="player" amount={bets.PLAYER} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} />
                <BetSpot id="TIE" label="タイ" sub="×9.00" tone="tie" amount={bets.TIE} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} />
                <BetSpot id="BANKER" label="バンカー" sub="×1.95" tone="banker" amount={bets.BANKER} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <BetSpot id="PPAIR" label="P ペア" sub="×12.00" tone="pair" amount={bets.PPAIR} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} />
                <BetSpot id="BPAIR" label="B ペア" sub="×12.00" tone="pair" amount={bets.BPAIR} onPlace={place} onRemove={removeSpot} disabled={phase !== 'BET'} />
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
            </div>
            <GoldButton onClick={deal} disabled={phase !== 'BET' || totalBet <= 0} className="w-full mt-2 py-3 text-base">
              {phase === 'DEAL' ? '配っています…' : 'カードを配る'}
            </GoldButton>
            <p className="text-[10px] text-gray-500 mt-1.5">
              「最大」は最後に触れた枠へ、上限（{MAX_BET.toLocaleString()} Y）まで積みます。
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
