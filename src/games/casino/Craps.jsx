import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trash2, Volume2, VolumeX, Dices, Info, Crown, CircleDot } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, Chip, playSfx } from '../../shared/ui.jsx';

/* ==========================================================
   CRAPS（クラップス）
   ・カムアウトロール → ポイント確立 → セブンアウト の状態遷移を実装。
   ・パスライン／ドントパス／フィールド／カム／プレース(4,5,6,8,9,10)。
   ・いま何を待っているのかを常に1行の日本語で案内する。
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

/* ---------- 配当（賭け金を含む総額の倍率） ---------- */
export const FIELD_MULT = { 2: 3, 3: 2, 4: 2, 9: 2, 10: 2, 11: 2, 12: 3.5 };
export const PLACE_MULT = { 4: 2.85, 5: 2.38, 6: 2.09, 8: 2.09, 9: 2.38, 10: 2.85 };
export const PLACE_PROFIT = { 4: 1.85, 5: 1.38, 6: 1.09, 8: 1.09, 9: 1.38, 10: 1.85 };
export const PLACE_NUMS = [4, 5, 6, 8, 9, 10];
export const LINE_MULT = 2;

const pay = (amount, mult) => Math.round(amount * mult);

export function emptyTable() {
  return { pass: 0, dontPass: 0, come: 0, comePts: {}, place: {}, field: 0 };
}

/**
 * 1投ぶんの解決（純粋関数）。
 * table.field / table.come は「この1投のために置かれた新しい賭け」。
 * 返り値の payout は「口座に戻す総額」。プレースは利益だけを払い、賭け金は卓に残る。
 */
export function crapsRoll(point, table, d1, d2) {
  const t = d1 + d2;
  const next = {
    pass: table.pass || 0,
    dontPass: table.dontPass || 0,
    come: 0,
    comePts: { ...(table.comePts || {}) },
    place: { ...(table.place || {}) },
    field: 0,
  };
  let payout = 0;
  const events = [];

  /* 1) フィールド（1投限り） */
  if (table.field > 0) {
    const m = FIELD_MULT[t] || 0;
    if (m > 0) { payout += pay(table.field, m); events.push(`フィールド ${t} 的中（×${m}）`); }
    else events.push(`フィールド ${t} はハズレ`);
  }

  /* 2) カム */
  if (t === 7) {
    for (const k of Object.keys(next.comePts)) {
      if (next.comePts[k] > 0) events.push(`カム ${k} は 7 で負け`);
      delete next.comePts[k];
    }
  } else if (next.comePts[t] > 0) {
    payout += next.comePts[t] * LINE_MULT;
    events.push(`カム ${t} 的中（×2）`);
    delete next.comePts[t];
  }
  if (table.come > 0) {
    if (t === 7 || t === 11) { payout += table.come * LINE_MULT; events.push('カム：7/11 で勝ち（×2）'); }
    else if (t === 2 || t === 3 || t === 12) events.push('カム：クラップスで負け');
    else { next.comePts[t] = (next.comePts[t] || 0) + table.come; events.push(`カムポイント ${t} を確立`); }
  }

  /* 3) プレース（ポイント確立中のみ有効） */
  if (point !== null) {
    if (t === 7) {
      for (const k of Object.keys(next.place)) {
        if (next.place[k] > 0) events.push(`プレース ${k} は 7 で負け`);
        next.place[k] = 0;
      }
    } else if (next.place[t] > 0) {
      payout += pay(next.place[t], PLACE_PROFIT[t]);
      events.push(`プレース ${t} 的中（×${PLACE_MULT[t]}／賭け金は据え置き）`);
    }
  }

  /* 4) パスライン／ドントパス */
  let newPoint = point;
  if (point === null) {
    if (t === 7 || t === 11) {
      if (next.pass > 0) { payout += next.pass * LINE_MULT; events.push('パスライン：ナチュラルで勝ち（×2）'); next.pass = 0; }
      if (next.dontPass > 0) { events.push('ドントパス：7/11 で負け'); next.dontPass = 0; }
    } else if (t === 2 || t === 3) {
      if (next.pass > 0) { events.push('パスライン：クラップスで負け'); next.pass = 0; }
      if (next.dontPass > 0) { payout += next.dontPass * LINE_MULT; events.push('ドントパス：2/3 で勝ち（×2）'); next.dontPass = 0; }
    } else if (t === 12) {
      if (next.pass > 0) { events.push('パスライン：12 で負け'); next.pass = 0; }
      if (next.dontPass > 0) events.push('ドントパス：12 はプッシュ（賭け金はそのまま）');
    } else {
      newPoint = t;
      events.push(`ポイント ${t} を確立`);
    }
  } else if (t === point) {
    if (next.pass > 0) { payout += next.pass * LINE_MULT; events.push(`パスライン：ポイント ${point} 的中（×2）`); next.pass = 0; }
    if (next.dontPass > 0) { events.push('ドントパス：ポイント成立で負け'); next.dontPass = 0; }
    newPoint = null;
  } else if (t === 7) {
    if (next.pass > 0) { events.push('パスライン：セブンアウトで負け'); next.pass = 0; }
    if (next.dontPass > 0) { payout += next.dontPass * LINE_MULT; events.push('ドントパス：セブンアウトで勝ち（×2）'); next.dontPass = 0; }
    newPoint = null;
    events.push('セブンアウト — シューター交代');
  }

  return { point: newPoint, table: next, payout, events, total: t, dice: [d1, d2] };
}

/** 卓に残っている賭け金の合計（表示用） */
export function tableTotal(tb) {
  let s = (tb.pass || 0) + (tb.dontPass || 0) + (tb.come || 0) + (tb.field || 0);
  for (const k of Object.keys(tb.comePts || {})) s += tb.comePts[k] || 0;
  for (const k of Object.keys(tb.place || {})) s += tb.place[k] || 0;
  return s;
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

function Die({ n, size = 54, className = '' }) {
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
            background: 'radial-gradient(circle at 34% 30%, #7f1d1d, #3f0a0a)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
          }}
        />
      ))}
    </div>
  );
}

function Puck({ on }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border-2 select-none"
      style={{
        background: on ? 'radial-gradient(circle at 35% 30%, #f8fafc, #cbd5e1 60%, #94a3b8)' : 'radial-gradient(circle at 35% 30%, #4b5563, #1f2937 60%, #0b0f14)',
        borderColor: on ? '#fefce8' : '#475569',
        color: on ? '#14532d' : '#e5e7eb',
        boxShadow: '0 4px 10px rgba(0,0,0,0.6)',
      }}
    >
      {on ? 'ON' : 'OFF'}
    </div>
  );
}

function CrapsCell({ id, onPlace, onRemove, disabled, committed = 0, pending = 0, hot, children, className = '', style }) {
  return (
    <button
      onClick={() => onPlace(id)}
      onContextMenu={(e) => { e.preventDefault(); onRemove(id); }}
      disabled={disabled}
      className={`relative select-none font-black text-white border-2 rounded-xl transition hover:brightness-125 active:scale-95 disabled:opacity-45 disabled:active:scale-100 ${hot ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-white/20'} ${className}`}
      style={style}
    >
      {children}
      {committed > 0 && (
        <span className="absolute -top-2 -left-2 z-10"><Chip value={chipLabel(committed)} color="#eab308" size={22} /></span>
      )}
      {pending > 0 && (
        <span className="absolute -top-2 -right-2 z-10"><Chip value={chipLabel(pending)} color="#0891b2" size={22} /></span>
      )}
    </button>
  );
}

function PayTable() {
  const rows = [
    ['パスライン', '×2.00', '98.6%'],
    ['ドントパス（12はプッシュ）', '×2.00', '98.6%'],
    ['カム', '×2.00', '98.6%'],
    ['フィールド（3,4,9,10,11）', '×2.00', '95.8%'],
    ['フィールド 2', '×3.00', '—'],
    ['フィールド 12', '×3.50', '—'],
    ['プレース 4 / 10', '×2.85', '95.0%'],
    ['プレース 5 / 9', '×2.38', '95.2%'],
    ['プレース 6 / 8', '×2.09', '95.0%'],
  ];
  return (
    <div className="text-[11px]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
        <div className="font-black text-amber-300/80">賭け方</div>
        <div className="font-black text-amber-300/80 text-right">配当（賭け金込み）</div>
        <div className="font-black text-amber-300/80 text-right">還元率</div>
        {rows.map((r) => (
          <React.Fragment key={r[0]}>
            <div className="text-gray-300">{r[0]}</div>
            <div className="text-white font-mono text-right">{r[1]}</div>
            <div className="text-emerald-300/90 font-mono text-right">{r[2]}</div>
          </React.Fragment>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
        プレースは<span className="text-amber-200 font-bold">ポイント確立中だけ有効</span>（カムアウトでは休止）。当たっても賭け金は卓に残ります。
        パスライン／ドントパスはカムアウトのみ、カムはポイント確立中のみ置けます。
        全賭け目を均等に使った場合の卓全体の還元率は <span className="text-emerald-300 font-bold">約96.7%</span>、控除率は 1.4〜5.0% です。
      </p>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function Craps({
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
  const [pending, setPending] = useState({});
  const [table, setTable] = useState(emptyTable);
  const [point, setPoint] = useState(null);
  const [dice, setDice] = useState([1, 1]);
  const [phase, setPhase] = useState('BET');   // BET | ROLL | RESULT
  const [lastPayout, setLastPayout] = useState(0);
  const [events, setEvents] = useState([]);
  const [rollLog, setRollLog] = useState([]);
  const [sound, setSound] = useState(true);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const soundRef = useRef(true);
  const rndRef = useRef(null);
  if (rndRef.current === null) rndRef.current = mulberry32((Date.now() ^ 0x27d4eb2f) >>> 0);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const pendingTotal = useMemo(() => Object.values(pending).reduce((a, b) => a + b, 0), [pending]);
  const committedTotal = useMemo(() => tableTotal(table), [table]);
  const comeOut = point === null;
  const rolling = phase === 'ROLL';

  const canPlaceId = useCallback((id) => {
    if (id === 'PASS' || id === 'DONTPASS') return comeOut;
    if (id === 'COME') return !comeOut;
    return true;
  }, [comeOut]);

  const place = useCallback((id) => {
    if (busyRef.current || rolling) return;
    if (!canPlaceId(id)) {
      if (id === 'COME') showToast('カムはポイント確立中だけ置けます。', 'warning');
      else showToast('パスライン／ドントパスはカムアウトロールの前だけ置けます。', 'warning');
      return;
    }
    setPending((prev) => {
      const cur = Object.values(prev).reduce((a, b) => a + b, 0);
      if (cur + chip > MAX_BET) { showToast(`この卓のベット上限は ${MAX_BET.toLocaleString()} Y です。`, 'warning'); return prev; }
      if (cur + chip > balance) { showToast('所持金を超えるベットはできません。', 'error'); return prev; }
      return { ...prev, [id]: (prev[id] || 0) + chip };
    });
    playSfx('click', soundRef.current);
  }, [rolling, canPlaceId, chip, balance, MAX_BET, showToast]);

  const removeSpot = useCallback((id) => {
    if (busyRef.current || rolling) return;
    setPending((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, [rolling]);

  const clearPending = useCallback(() => {
    if (busyRef.current || rolling) return;
    setPending({});
    playSfx('click', soundRef.current);
  }, [rolling]);

  const maxBet = useCallback(() => {
    if (busyRef.current || rolling) return;
    const target = comeOut ? 'PASS' : 'FIELD';
    const cap = Math.min(MAX_BET, balance);
    const room = Math.floor((cap - pendingTotal) / 100) * 100;
    if (room <= 0) { showToast('これ以上は賭けられません。', 'warning'); return; }
    setPending((prev) => ({ ...prev, [target]: (prev[target] || 0) + room }));
    playSfx('coin', soundRef.current);
  }, [rolling, comeOut, MAX_BET, balance, pendingTotal, showToast]);

  /** カムアウト中だけ、卓に残したプレースを下ろせる */
  const takeDownPlace = useCallback(async () => {
    if (busyRef.current || rolling || !comeOut) return;
    let refund = 0;
    for (const n of PLACE_NUMS) refund += table.place[n] || 0;
    if (refund <= 0) { showToast('下ろせるプレースがありません。', 'warning'); return; }
    busyRef.current = true;
    try { await updateBalance(refund); } catch (e) { /* noop */ }
    if (mountedRef.current) {
      setTable((tb) => ({ ...tb, place: {} }));
      showToast(`プレースを下ろしました（+${refund.toLocaleString()} Y）`, 'info');
    }
    busyRef.current = false;
  }, [rolling, comeOut, table, updateBalance, showToast]);

  const finish = useCallback(async (res, stakeThisRoll) => {
    if (res.payout > 0) { try { await updateBalance(res.payout); } catch (e) { /* noop */ } }
    if (!mountedRef.current) { busyRef.current = false; return; }
    setPoint(res.point);
    setTable(res.table);
    setLastPayout(res.payout);
    setEvents(res.events);
    setPhase('RESULT');
    setRollLog((l) => [{ total: res.total, dice: res.dice, payout: res.payout }, ...l].slice(0, 12));
    if (res.payout > 0) {
      playSfx(res.payout >= stakeThisRoll * 8 ? 'big' : 'win', soundRef.current);
      showToast(`${res.dice[0]} + ${res.dice[1]} = ${res.total}  +${res.payout.toLocaleString()} Y`, 'success');
    } else {
      playSfx('lose', soundRef.current);
      showToast(`${res.dice[0]} + ${res.dice[1]} = ${res.total}`, res.total === 7 && res.point === null ? 'error' : 'info');
    }
    if (stakeThisRoll > 0 && res.payout >= stakeThisRoll * 20 && res.payout >= 100000) {
      emitNews(`🎲 ${playerName} がクラップスで ${res.payout.toLocaleString()} Y を的中！`, 'jackpot');
    }
    busyRef.current = false;
  }, [updateBalance, showToast, emitNews, playerName]);

  const roll = useCallback(async () => {
    if (busyRef.current || rolling) return;
    const stake = pendingTotal;
    if (stake <= 0 && committedTotal <= 0) { showToast('まずチップを置いてください。', 'error'); return; }
    if (stake > balance) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;

    if (stake > 0) {
      try {
        await updateBalance(-stake);
      } catch (e) {
        busyRef.current = false;
        showToast('所持金が足りません。', 'error');
        return;
      }
    }

    // 新しいチップを卓に乗せる。
    // PASS / DONTPASS はカムアウトのときしか、COME はポイント中しか置けないよう
    // place() 側で止めているので、ここでは必ず全額を卓に反映する（取りこぼし防止）。
    const tb = {
      pass: (table.pass || 0) + (pending.PASS || 0),
      dontPass: (table.dontPass || 0) + (pending.DONTPASS || 0),
      come: pending.COME || 0,
      comePts: { ...table.comePts },
      place: { ...table.place },
      field: pending.FIELD || 0,
    };
    for (const n of PLACE_NUMS) {
      const add = pending['PLACE' + n] || 0;
      if (add > 0) tb.place[n] = (tb.place[n] || 0) + add;
    }

    // ===== ここで出目を確定（以降は演出だけ） =====
    const rnd = rndRef.current;
    const d1 = 1 + Math.floor(rnd() * 6);
    const d2 = 1 + Math.floor(rnd() * 6);
    const res = crapsRoll(point, tb, d1, d2);

    if (!mountedRef.current) { busyRef.current = false; return; }
    setPending({});
    setTable(tb);
    setDice([d1, d2]);
    setPhase('ROLL');
    setEvents([]);
    playSfx('stop', soundRef.current);
    for (let i = 0; i < 4; i++) {
      timersRef.current.push(setTimeout(() => playSfx('tick', soundRef.current), 140 + i * 180));
    }
    timersRef.current.push(setTimeout(() => finish(res, stake), 1020));
  }, [rolling, pendingTotal, committedTotal, balance, updateBalance, showToast, table, pending, comeOut, point, finish]);

  const guide = useMemo(() => {
    if (rolling) return 'ダイスが転がっています…';
    if (comeOut) {
      if (committedTotal === 0 && pendingTotal === 0) return 'いまはカムアウトロールの前です。まずパスラインかドントパスにチップを置いてください。';
      return 'カムアウトロールを待っています。7・11 ならパスの勝ち、2・3・12 ならパスの負け、それ以外の目がポイントになります。';
    }
    return `ポイントは ${point} です。7 より先に ${point} が出ればパスの勝ち、先に 7 が出たらセブンアウトで負けです。`;
  }, [rolling, comeOut, point, committedTotal, pendingTotal]);

  const feltStyle = highRoller
    ? { background: 'radial-gradient(ellipse at 50% 0%, #5c1022 0%, #2b0711 68%, #140409 100%)' }
    : { background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #06271a 82%)' };

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto">
      <style>{`
        @keyframes crTumble {
          0% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(140deg) translateY(-10px); }
          55% { transform: rotate(250deg) translateY(6px); }
          80% { transform: rotate(330deg) translateY(-4px); }
          100% { transform: rotate(360deg) translateY(0); }
        }
        @keyframes crPop {
          0% { transform: scale(0.6) rotate(-14deg); opacity: 0.3; }
          70% { transform: scale(1.12) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .cr-tumble { animation: crTumble 0.34s linear infinite; }
        .cr-pop { animation: crPop 0.35s cubic-bezier(.2,.9,.3,1.4) both; }
      `}</style>

      <TopBar
        onBack={onBack}
        balance={balance}
        locked={rolling}
        sound={sound}
        onSound={() => setSound((s) => !s)}
        vip={vip}
        highRoller={highRoller}
      />

      <SectionTitle
        icon={<Dices size={22} />}
        title="クラップス"
        sub={highRoller ? 'ハイローラー卓 — 上限 10,000,000 Y' : 'カムアウト → ポイント → セブンアウト'}
      />

      {/* 状態表示 */}
      <Panel gold className="p-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Puck on={!comeOut} />
          <div className="min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
              {comeOut ? 'COME OUT' : `POINT ${point}`}
            </div>
            <div className="text-[11px] text-amber-200/70 font-bold">
              {comeOut ? 'カムアウトロール' : `ポイント ${point} を狙っています`}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dice.map((n, i) => (
              <div key={i} className={rolling ? 'cr-tumble' : 'cr-pop'} style={{ animationDelay: (i * 70) + 'ms' }}>
                <Die n={n} size={46} />
              </div>
            ))}
            <div className="font-mono text-2xl font-black text-amber-300 w-8 text-center">
              {rolling ? '?' : dice[0] + dice[1]}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-start gap-1.5 bg-black/40 border border-white/10 rounded-xl px-2.5 py-2">
          <CircleDot size={13} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-100/80 font-bold leading-snug">{guide}</p>
        </div>
      </Panel>

      <div className="flex flex-col lg:flex-row gap-3">
        {/* ===== 卓 ===== */}
        <div className="lg:w-[60%] space-y-3">
          <Panel className="p-2.5">
            <div className="rounded-2xl border-2 border-amber-900/50 p-2" style={feltStyle}>
              {/* ナンバー（プレース／カムポイント） */}
              <div className="text-[9px] font-black text-amber-200/60 tracking-widest mb-1">
                プレース（ポイント確立中のみ有効）
              </div>
              <div className="grid grid-cols-6 gap-1">
                {PLACE_NUMS.map((n) => (
                  <div key={n} className="relative">
                    {point === n && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 scale-[0.62] origin-bottom"><Puck on /></div>
                    )}
                    <CrapsCell
                      id={'PLACE' + n}
                      onPlace={place}
                      onRemove={removeSpot}
                      disabled={rolling}
                      committed={table.place[n] || 0}
                      pending={pending['PLACE' + n] || 0}
                      hot={phase === 'RESULT' && dice[0] + dice[1] === n}
                      className="w-full h-12 pt-1 bg-emerald-900/70"
                    >
                      <span className="text-base leading-none">{n}</span>
                      <span className="block text-[9px] font-bold opacity-65">×{PLACE_MULT[n]}</span>
                    </CrapsCell>
                    {(table.comePts[n] || 0) > 0 && (
                      <div className="mt-0.5 text-center text-[9px] font-black text-cyan-300 bg-cyan-950/60 border border-cyan-400/30 rounded">
                        カム {chipLabel(table.comePts[n])}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* カム */}
              <div className="mt-1.5">
                <CrapsCell
                  id="COME"
                  onPlace={place}
                  onRemove={removeSpot}
                  disabled={rolling || comeOut}
                  committed={0}
                  pending={pending.COME || 0}
                  className="w-full h-11 text-sm bg-emerald-800/70"
                >
                  カム（COME） ×2.00
                  <span className="block text-[9px] font-bold opacity-65">ポイント確立中のみ／次の投がカムアウト扱い</span>
                </CrapsCell>
              </div>

              {/* フィールド */}
              <div className="mt-1.5">
                <CrapsCell
                  id="FIELD"
                  onPlace={place}
                  onRemove={removeSpot}
                  disabled={rolling}
                  committed={0}
                  pending={pending.FIELD || 0}
                  hot={phase === 'RESULT' && !!FIELD_MULT[dice[0] + dice[1]]}
                  className="w-full py-2 bg-sky-900/60"
                >
                  <div className="text-[11px]">フィールド（1投限り）</div>
                  <div className="flex justify-center gap-1 mt-1 flex-wrap">
                    {[2, 3, 4, 9, 10, 11, 12].map((n) => (
                      <span
                        key={n}
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${n === 2 || n === 12 ? 'border-amber-300/70 text-amber-200' : 'border-white/25 text-white/80'}`}
                      >
                        {n}{n === 2 ? '(×3)' : n === 12 ? '(×3.5)' : ''}
                      </span>
                    ))}
                  </div>
                </CrapsCell>
              </div>

              {/* パスライン / ドントパス */}
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <CrapsCell
                  id="PASS"
                  onPlace={place}
                  onRemove={removeSpot}
                  disabled={rolling || !comeOut}
                  committed={table.pass || 0}
                  pending={pending.PASS || 0}
                  className="h-14 text-sm bg-emerald-700/70"
                >
                  パスライン ×2.00
                  <span className="block text-[9px] font-bold opacity-65">カムアウトのみ</span>
                </CrapsCell>
                <CrapsCell
                  id="DONTPASS"
                  onPlace={place}
                  onRemove={removeSpot}
                  disabled={rolling || !comeOut}
                  committed={table.dontPass || 0}
                  pending={pending.DONTPASS || 0}
                  className="h-14 text-sm bg-rose-900/70"
                >
                  ドントパス ×2.00
                  <span className="block text-[9px] font-bold opacity-65">12 はプッシュ</span>
                </CrapsCell>
              </div>

              <div className="flex items-center justify-between mt-1.5 text-[9px] text-white/50 font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />卓に残っている賭け金</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />この投で新しく置くチップ</span>
              </div>
            </div>
          </Panel>

          {/* 直前の結果 */}
          {phase === 'RESULT' && (
            <Panel className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-black text-white">この投の結果</h3>
                <div className={`font-mono text-lg font-black ${lastPayout > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {lastPayout > 0 ? '+' + lastPayout.toLocaleString() + ' G' : '払い戻しなし'}
                </div>
              </div>
              <ul className="space-y-0.5">
                {events.length === 0
                  ? <li className="text-[11px] text-gray-500">賭けの決着はありませんでした。</li>
                  : events.map((e, i) => (
                    <li key={i} className="text-[11px] text-gray-300 flex gap-1.5">
                      <span className="text-amber-400">・</span>{e}
                    </li>
                  ))}
              </ul>
            </Panel>
          )}

          {rollLog.length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black text-gray-500 tracking-[0.25em] mb-1.5">出目の履歴</div>
              <div className="flex flex-wrap gap-1">
                {rollLog.map((r, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded text-[10px] font-black border text-white"
                    style={{
                      background: r.total === 7 ? 'rgba(244,63,94,0.22)' : r.payout > 0 ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.07)',
                      borderColor: r.total === 7 ? 'rgba(244,63,94,0.5)' : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    {r.dice[0]}+{r.dice[1]}=<span className="text-amber-300">{r.total}</span>
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ===== 操作 ===== */}
        <div className="lg:w-[40%] space-y-3">
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

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <div className="text-[10px] text-gray-400 font-bold">この投で置くチップ</div>
                <div className="font-mono text-lg font-black text-cyan-300">{pendingTotal.toLocaleString()} Y</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-bold">卓に残っている賭け金</div>
                <div className="font-mono text-lg font-black text-amber-300">{committedTotal.toLocaleString()} Y</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button onClick={maxBet} disabled={rolling}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                最大
              </button>
              <button onClick={clearPending} disabled={rolling || pendingTotal === 0}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                <Trash2 size={13} /> クリア
              </button>
              <button onClick={takeDownPlace} disabled={rolling || !comeOut}
                className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-2 px-2.5 rounded-xl transition disabled:opacity-30 text-[11px]">
                プレースを下ろす
              </button>
            </div>

            <GoldButton onClick={roll} disabled={rolling || (pendingTotal <= 0 && committedTotal <= 0)} className="w-full mt-2 py-3 text-base">
              {rolling ? '振っています…' : 'ダイスを振る'}
            </GoldButton>
            <p className="text-[10px] text-gray-500 mt-1.5">
              「最大」は{comeOut ? 'パスライン' : 'フィールド'}へ上限（{MAX_BET.toLocaleString()} Y）まで積みます。
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
