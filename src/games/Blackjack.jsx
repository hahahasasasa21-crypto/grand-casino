import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, RefreshCw, Layers } from 'lucide-react';
import { Panel, GoldButton, Chip, PlayingCard, VipBadge, playSfx } from '../shared/ui';
import { buildDeck, shuffle } from '../shared/cards';

/* ==========================================================
   BLACKJACK（VIPルーム）
   ・6デッキシュー／ブラックジャック 3:2／ディーラーはソフト17でスタンド
   ・ヒット・スタンド・ダブルダウン・スプリット（最大4ハンド）
     ・サレンダー・インシュランスに対応した本式ルール
   ========================================================== */

const DECKS = 6;
const RESHUFFLE_AT = 0.28;      // シューの残りがこれを切ったらシャッフル
const CHIP_DENOMS = [
  { v: 500, color: '#2563eb' },
  { v: 1000, color: '#16a34a' },
  { v: 5000, color: '#7c3aed' },
  { v: 25000, color: '#b45309' },
  { v: 100000, color: '#0f172a' },
];
const MAX_HANDS = 4;
const fmt = (n) => (n || 0).toLocaleString();

function buildShoe() {
  let cards = [];
  for (let i = 0; i < DECKS; i++) cards = cards.concat(buildDeck());
  return shuffle(cards);
}

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 14) { total += 11; aces++; }
    else total += Math.min(10, c.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 && total <= 21 };
}
const isBlackjack = (h) => h.cards.length === 2 && !h.fromSplit && handValue(h.cards).total === 21;
/** スプリット判定用のランクキー（AとT系を混同しないように） */
const rankKey = (c) => (c.r === 14 ? 'A' : c.r >= 10 ? 'T' : String(c.r));

/* ---------- カードを並べて表示 ---------- */
function HandRow({ cards, hideIndex = -1, small, highlight }) {
  return (
    <div className={`flex ${small ? '-space-x-5' : '-space-x-6'} items-end`}>
      {cards.map((c, i) => (
        <div key={i} style={{ animation: `bjDeal 0.32s ${i * 0.05}s both`, zIndex: i }}>
          <PlayingCard card={c} hidden={i === hideIndex} small={small}
            style={highlight ? { boxShadow: '0 0 0 2px rgba(251,191,36,0.9), 0 8px 16px rgba(0,0,0,0.5)' } : undefined} />
        </div>
      ))}
    </div>
  );
}

function ValueTag({ cards, label }) {
  if (!cards.length) return null;
  const { total, soft } = handValue(cards);
  const bust = total > 21;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${bust ? 'bg-red-600/80 border-red-300 text-white' : 'bg-black/70 border-white/20 text-amber-200'}`}>
      {label ? label + ' ' : ''}{soft && !bust ? `${total - 10}/${total}` : total}{bust ? ' BUST' : ''}
    </span>
  );
}

/* ---------- 本体 ---------- */
export default function Blackjack({ balance, updateBalance, onBack, showToast, playerName, emitNews, vip }) {
  const [shoe, setShoe] = useState(() => buildShoe());
  const [shoeStart, setShoeStart] = useState(DECKS * 52);
  const [bet, setBet] = useState(1000);
  const [chip, setChip] = useState(1000);
  const [phase, setPhase] = useState('BET');       // BET | INSURANCE | PLAYER | DEALER | RESULT
  const [dealer, setDealer] = useState([]);
  const [hands, setHands] = useState([]);
  const [active, setActive] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [results, setResults] = useState(null);
  const [sound, setSound] = useState(true);
  const [sessionNet, setSessionNet] = useState(0);
  const [message, setMessage] = useState('チップを置いて「配る」を押してください。');
  const [showRules, setShowRules] = useState(false);

  const soundRef = useRef(true);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const shoeRef = useRef(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimeout(timerRef.current); };
  }, []);
  shoeRef.current = shoe;

  const totalStaked = hands.reduce((a, h) => a + h.bet, 0) + insurance;
  const penetration = shoe.length / shoeStart;

  /* --- シューから引く（配列を直接操作して同期ズレを防ぐ） --- */
  const draw = useCallback((n = 1) => {
    const s = [...shoeRef.current];
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!s.length) { const fresh = buildShoe(); s.push(...fresh); }
      out.push(s.pop());
    }
    shoeRef.current = s;
    return out;
  }, []);

  /* ---------- 配る ---------- */
  const deal = async () => {
    if (phase !== 'BET') return;
    const amount = Math.floor(Number(bet) || 0);
    if (amount < 500) { showToast('500G以上を賭けてください。', 'error'); return; }
    if (balance < amount) { showToast('残高が足りません。', 'error'); return; }
    try { await updateBalance(-amount); } catch (e) { return; }
    if (!mountedRef.current) return;

    if (penetration < RESHUFFLE_AT) {
      shoeRef.current = buildShoe();
      setShoeStart(DECKS * 52);
      showToast('🔀 シューをシャッフルしました。', 'info');
    }

    const [p1, d1, p2, d2] = draw(4);
    const playerHand = { cards: [p1, p2], bet: amount, done: false, doubled: false, surrendered: false, fromSplit: false };
    setShoe(shoeRef.current);
    setDealer([d1, d2]);
    setHands([playerHand]);
    setActive(0);
    setInsurance(0);
    setResults(null);
    playSfx('click', soundRef.current);

    const dealerUpAce = d1.r === 14;
    const playerBJ = isBlackjack(playerHand);

    if (dealerUpAce && balance - amount >= Math.floor(amount / 2)) {
      setPhase('INSURANCE');
      setMessage('ディーラーのアップカードはA。インシュランスを賭けますか？');
      return;
    }
    if (playerBJ) {
      setMessage('ブラックジャック！');
      finishDealer([d1, d2], [playerHand], 0, true);
      return;
    }
    setPhase('PLAYER');
    setMessage('あなたの番です。');
  };

  /* ---------- インシュランス ---------- */
  const takeInsurance = async (yes) => {
    const h = hands[0];
    if (yes) {
      const ins = Math.floor(h.bet / 2);
      if (balance < ins) { showToast('インシュランス分の残高が足りません。', 'error'); return; }
      try { await updateBalance(-ins); } catch (e) { return; }
      setInsurance(ins);
      playSfx('coin', soundRef.current);
    }
    const dv = handValue(dealer).total;
    if (dv === 21) {
      finishDealer(dealer, hands, yes ? Math.floor(h.bet / 2) : 0, isBlackjack(h));
      return;
    }
    if (isBlackjack(h)) { finishDealer(dealer, hands, yes ? Math.floor(h.bet / 2) : 0, true); return; }
    setPhase('PLAYER');
    setMessage(yes ? 'インシュランスを賭けました。あなたの番です。' : 'あなたの番です。');
  };

  /* ---------- プレイヤーのアクション ---------- */
  const nextHand = (newHands, from) => {
    let i = from;
    while (i < newHands.length && newHands[i].done) i++;
    if (i >= newHands.length) {
      setHands(newHands);
      setPhase('DEALER');
      setMessage('ディーラーの番です…');
      timerRef.current = setTimeout(() => { if (mountedRef.current) dealerPlay(newHands); }, 600);
    } else {
      setHands(newHands);
      setActive(i);
      setMessage(newHands.length > 1 ? `${i + 1}つ目のハンドの番です。` : 'あなたの番です。');
    }
  };

  const hit = () => {
    if (phase !== 'PLAYER') return;
    const [c] = draw(1);
    setShoe(shoeRef.current);
    const nh = hands.map((h, i) => (i === active ? { ...h, cards: [...h.cards, c] } : h));
    playSfx('click', soundRef.current);
    const v = handValue(nh[active].cards).total;
    if (v >= 21) {
      nh[active] = { ...nh[active], done: true };
      nextHand(nh, active + 1);
    } else {
      setHands(nh);
    }
  };

  const stand = () => {
    if (phase !== 'PLAYER') return;
    const nh = hands.map((h, i) => (i === active ? { ...h, done: true } : h));
    nextHand(nh, active + 1);
  };

  const canDouble = phase === 'PLAYER' && hands[active] && hands[active].cards.length === 2
    && !hands[active].doubled && balance >= hands[active].bet;
  const doubleDown = async () => {
    if (!canDouble) return;
    const h = hands[active];
    try { await updateBalance(-h.bet); } catch (e) { return; }
    const [c] = draw(1);
    setShoe(shoeRef.current);
    const nh = hands.map((x, i) => (i === active
      ? { ...x, cards: [...x.cards, c], bet: x.bet * 2, doubled: true, done: true } : x));
    playSfx('coin', soundRef.current);
    nextHand(nh, active + 1);
  };

  const canSplit = phase === 'PLAYER' && hands[active] && hands.length < MAX_HANDS
    && hands[active].cards.length === 2
    && rankKey(hands[active].cards[0]) === rankKey(hands[active].cards[1])
    && balance >= hands[active].bet;
  const split = async () => {
    if (!canSplit) return;
    const h = hands[active];
    try { await updateBalance(-h.bet); } catch (e) { return; }
    const isAces = h.cards[0].r === 14;
    const [c1, c2] = draw(2);
    setShoe(shoeRef.current);
    const a = { ...h, cards: [h.cards[0], c1], fromSplit: true, done: isAces };
    const b = { ...h, cards: [h.cards[1], c2], fromSplit: true, done: isAces };
    const nh = [...hands.slice(0, active), a, b, ...hands.slice(active + 1)];
    playSfx('coin', soundRef.current);
    if (isAces) { nextHand(nh, active + 2); }
    else { setHands(nh); setMessage('スプリットしました。'); }
  };

  const canSurrender = phase === 'PLAYER' && hands.length === 1
    && hands[0].cards.length === 2 && !hands[0].fromSplit;
  const surrender = async () => {
    if (!canSurrender) return;
    const h = hands[0];
    const back = Math.floor(h.bet / 2);
    try { await updateBalance(back); } catch (e) { /* noop */ }
    const nh = [{ ...h, done: true, surrendered: true }];
    setHands(nh);
    settle(dealer, nh, insurance, false, true);
  };

  /* ---------- ディーラー ---------- */
  const dealerPlay = (finalHands) => {
    const allBustOrSurrender = finalHands.every(h => h.surrendered || handValue(h.cards).total > 21);
    let d = [...dealer];
    if (!allBustOrSurrender) {
      while (true) {
        const { total } = handValue(d);
        // S17：17以上（ソフト17を含む）でスタンド
        if (total < 17) { const [c] = draw(1); d.push(c); }
        else break;
        if (d.length > 12) break;
      }
      setShoe(shoeRef.current);
    }
    setDealer(d);
    finishDealer(d, finalHands, insurance, false);
  };

  const finishDealer = (d, finalHands, ins, playerBJ) => {
    setDealer(d);
    setPhase('DEALER');
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      settle(d, finalHands, ins, playerBJ, false);
    }, 450);
  };

  /* ---------- 精算 ---------- */
  const settle = async (d, finalHands, ins, playerBJ, surrendered) => {
    const dv = handValue(d).total;
    const dealerBJ = d.length === 2 && dv === 21;
    let payout = 0;
    const rows = finalHands.map(h => {
      const pv = handValue(h.cards).total;
      if (h.surrendered) return { ...h, result: 'SURRENDER', gain: 0, label: 'サレンダー' };
      const bj = isBlackjack(h);
      if (bj && !dealerBJ) { const g = Math.floor(h.bet * 2.5); payout += g; return { ...h, result: 'BJ', gain: g, label: 'ブラックジャック 3:2' }; }
      if (pv > 21) return { ...h, result: 'BUST', gain: 0, label: 'バスト' };
      if (dealerBJ && !bj) return { ...h, result: 'LOSE', gain: 0, label: 'ディーラーBJ' };
      if (dv > 21) { const g = h.bet * 2; payout += g; return { ...h, result: 'WIN', gain: g, label: 'ディーラーバスト' }; }
      if (pv > dv) { const g = h.bet * 2; payout += g; return { ...h, result: 'WIN', gain: g, label: '勝ち' }; }
      if (pv === dv) { payout += h.bet; return { ...h, result: 'PUSH', gain: h.bet, label: 'プッシュ' }; }
      return { ...h, result: 'LOSE', gain: 0, label: '負け' };
    });

    let insGain = 0;
    if (ins > 0 && dealerBJ) { insGain = ins * 3; payout += insGain; }

    if (payout > 0) { try { await updateBalance(payout); } catch (e) { /* noop */ } }
    if (!mountedRef.current) return;

    const staked = finalHands.reduce((a, h) => a + h.bet, 0) + ins;
    const net = payout - staked + (surrendered ? Math.floor(finalHands[0].bet / 2) : 0);
    setSessionNet(v => v + net);
    setResults({ rows, insGain, payout, staked, net, dealerBJ });
    setPhase('RESULT');
    setMessage(net > 0 ? `🎉 +${fmt(net)} G の勝ち！` : net === 0 ? 'プッシュ（引き分け）' : `😢 ${fmt(net)} G`);
    playSfx(net > 0 ? (net >= staked * 2 ? 'big' : 'win') : net === 0 ? 'click' : 'lose', soundRef.current);
    if (net >= 100000) emitNews(`🃏 ${playerName} がVIPルームのブラックジャックで +${fmt(net)} G！`, 'jackpot');
  };

  const newRound = () => {
    setPhase('BET'); setDealer([]); setHands([]); setResults(null);
    setInsurance(0); setActive(0);
    setMessage('チップを置いて「配る」を押してください。');
  };

  const addChip = (v) => { if (phase === 'BET') setBet(b => Math.min(balance, (Number(b) || 0) + v)); };

  const dealerHide = phase === 'PLAYER' || phase === 'INSURANCE';
  const dealerCards = dealer;

  if (!vip) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"><ArrowLeft size={20} /> 戻る</button>
        <Panel gold className="p-8 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-black text-white mb-2">ここは VIP ルームです</h2>
          <p className="text-sm text-gray-400">ブラックジャックは <VipBadge size="sm" /> 会員限定です。ショップでVIP券を購入すると入室できます。</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto">
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-4">
        <button onClick={onBack} disabled={phase !== 'BET' && phase !== 'RESULT'}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-2">
          <button onClick={() => setSound(s => !s)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10">
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">SHOE</div>
            <div className="font-mono text-xs text-white font-bold flex items-center gap-1"><Layers size={11} />{Math.round(penetration * 100)}%</div>
          </div>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">収支</div>
            <div className={`font-mono text-xs font-bold ${sessionNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sessionNet >= 0 ? '+' : ''}{fmt(sessionNet)}</div>
          </div>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} G</div>
        </div>
      </div>

      {/* ===== テーブル ===== */}
      <div className="relative rounded-[2rem] p-4 md:p-6 mb-4"
        style={{
          background: 'radial-gradient(ellipse at 50% 12%, #1b6b47 0%, #0e4a30 48%, #06281a 100%)',
          border: '10px solid #3a2410',
          boxShadow: '0 26px 60px rgba(0,0,0,0.75), inset 0 0 70px rgba(0,0,0,0.55)',
        }}>
        <div className="absolute inset-3 rounded-[1.6rem] border border-amber-200/12 pointer-events-none" />

        {/* ディーラー */}
        <div className="flex flex-col items-center gap-2 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.35em] text-amber-200/60 font-black">DEALER</span>
            {dealerCards.length > 0 && !dealerHide && <ValueTag cards={dealerCards} />}
          </div>
          <div className="min-h-[7rem] flex items-center">
            {dealerCards.length ? <HandRow cards={dealerCards} hideIndex={dealerHide ? 1 : -1} /> : <span className="text-white/20 text-sm">—</span>}
          </div>
          <p className="text-[11px] text-emerald-100/50 font-bold">BLACKJACK PAYS 3 TO 2 ／ DEALER STANDS ON ALL 17</p>
        </div>

        {/* メッセージ */}
        <div className="flex justify-center mb-4">
          <span className="px-4 py-1.5 rounded-full bg-black/60 border border-amber-300/25 text-sm font-black text-amber-100">{message}</span>
        </div>

        {/* プレイヤーのハンド */}
        <div className={`flex flex-wrap justify-center gap-5`}>
          {hands.length === 0 && <div className="min-h-[7rem] flex items-center text-white/20 text-sm">—</div>}
          {hands.map((h, i) => {
            const res = results?.rows[i];
            const isActive = phase === 'PLAYER' && i === active;
            return (
              <div key={i} className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all ${isActive ? 'bg-amber-400/10 ring-2 ring-amber-300/60' : ''}`}>
                <HandRow cards={h.cards} small={hands.length > 2} highlight={res?.result === 'WIN' || res?.result === 'BJ'} />
                <div className="flex items-center gap-1.5">
                  <ValueTag cards={h.cards} />
                  {h.doubled && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-600 text-white">DOUBLE</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Chip value={h.bet >= 1000 ? Math.round(h.bet / 1000) + 'K' : h.bet} color="#b45309" size={22} />
                  <span className="text-[11px] font-mono font-black text-amber-200">{fmt(h.bet)}</span>
                </div>
                {res && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${res.result === 'WIN' || res.result === 'BJ' ? 'bg-amber-400 text-black'
                    : res.result === 'PUSH' ? 'bg-white/20 text-white' : 'bg-red-700/80 text-white'}`}>
                    {res.label}{res.gain > 0 ? ` +${fmt(res.gain)}` : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {insurance > 0 && (
          <div className="flex justify-center mt-3">
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-sky-600/70 text-white">インシュランス {fmt(insurance)} G{results ? (results.insGain ? ` → +${fmt(results.insGain)}` : ' → 没収') : ''}</span>
          </div>
        )}
      </div>

      {/* ===== 操作 ===== */}
      <Panel className="p-4">
        {phase === 'BET' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-gray-400 tracking-widest">CHIPS</span>
              {CHIP_DENOMS.map(c => (
                <button key={c.v} onClick={() => { setChip(c.v); addChip(c.v); }}
                  className={`rounded-full transition ${chip === c.v ? 'scale-110 ring-4 ring-amber-300' : 'opacity-80 hover:opacity-100'}`}>
                  <Chip value={c.v >= 1000 ? c.v / 1000 + 'K' : c.v} color={c.color} size={42} />
                </button>
              ))}
              <button onClick={() => setBet(0)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-black border border-white/10">クリア</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <div className="text-[10px] text-gray-400 font-bold">ベット額</div>
                <input type="number" min="500" step="500" value={bet} onChange={e => setBet(e.target.value)}
                  className="w-full bg-black/60 text-amber-300 font-mono text-xl font-black p-2.5 rounded-lg border border-white/10 focus:border-amber-400 outline-none" />
              </div>
              <GoldButton onClick={deal} disabled={balance < Number(bet) || Number(bet) < 500} className="py-3.5 px-10 text-lg">配る</GoldButton>
            </div>
          </div>
        )}

        {phase === 'INSURANCE' && (
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <span className="text-sm font-bold text-white">インシュランス（{fmt(Math.floor(hands[0]?.bet / 2))} G）を賭けますか？</span>
            <GoldButton onClick={() => takeInsurance(true)} className="py-2.5 px-6">賭ける</GoldButton>
            <button onClick={() => takeInsurance(false)} className="py-2.5 px-6 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white">いらない</button>
          </div>
        )}

        {phase === 'PLAYER' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <button onClick={hit} className="py-3.5 rounded-xl font-black bg-emerald-700 hover:bg-emerald-600 text-white transition active:scale-95">ヒット</button>
            <button onClick={stand} className="py-3.5 rounded-xl font-black bg-red-700 hover:bg-red-600 text-white transition active:scale-95">スタンド</button>
            <button onClick={doubleDown} disabled={!canDouble}
              className="py-3.5 rounded-xl font-black bg-sky-700 hover:bg-sky-600 text-white transition active:scale-95 disabled:opacity-30">ダブル</button>
            <button onClick={split} disabled={!canSplit}
              className="py-3.5 rounded-xl font-black bg-purple-700 hover:bg-purple-600 text-white transition active:scale-95 disabled:opacity-30">スプリット</button>
            <button onClick={surrender} disabled={!canSurrender}
              className="py-3.5 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white transition active:scale-95 disabled:opacity-30">サレンダー</button>
          </div>
        )}

        {phase === 'DEALER' && (
          <div className="flex items-center justify-center gap-3 py-4 text-gray-400">
            <RefreshCw size={16} className="animate-spin" /><span className="text-sm font-bold">ディーラーがカードを引いています…</span>
          </div>
        )}

        {phase === 'RESULT' && results && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[160px]">
              <div className="text-[10px] text-gray-400 font-bold">このラウンドの収支</div>
              <div className={`font-mono text-2xl font-black ${results.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {results.net >= 0 ? '+' : ''}{fmt(results.net)} G
              </div>
            </div>
            <GoldButton onClick={newRound} className="py-3.5 px-10 text-lg">次のラウンド</GoldButton>
          </div>
        )}

        <button onClick={() => setShowRules(s => !s)} className="mt-3 text-[11px] text-gray-500 hover:text-gray-300 font-bold">
          {showRules ? 'ルールを閉じる ▲' : 'ルールを見る ▼'}
        </button>
        {showRules && (
          <ul className="mt-2 text-[11px] text-gray-400 space-y-1 list-disc list-inside">
            <li>6デッキシュー。残り28%を切ると自動でシャッフルします。</li>
            <li>ブラックジャック（最初の2枚で21）は 3:2 の配当。スプリット後の21はブラックジャック扱いになりません。</li>
            <li>ディーラーは17以上でスタンド（ソフト17もスタンド）。</li>
            <li>ダブルダウンは最初の2枚のとき、スプリット後も可能。スプリットは最大4ハンドまで、Aのスプリットは1枚ずつで打ち止め。</li>
            <li>サレンダーは最初の2枚・スプリット前のみ。賭け金の半分が戻ります。</li>
            <li>ディーラーのアップカードがAのときインシュランス（賭け金の半分／配当2:1）を選べます。</li>
          </ul>
        )}
      </Panel>

      <style>{`@keyframes bjDeal { from { opacity: 0; transform: translate(40px,-60px) rotate(12deg); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
