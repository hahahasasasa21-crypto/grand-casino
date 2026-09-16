import { buildDeck, shuffle, evaluateHand, estimateEquity } from '../shared/cards.js';

/* ==========================================================
   テキサスホールデム（6人テーブル）エンジン
   ・SB/BB・ディーラーボタン移動・サイドポットに対応した本式ルール
   ========================================================== */

export const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
export const STREET_LABEL = { PREFLOP: 'プリフロップ', FLOP: 'フロップ', TURN: 'ターン', RIVER: 'リバー', SHOWDOWN: 'ショーダウン' };

export const STAKES = [
  { sb: 25, bb: 50, label: '25/50', buyin: 5000 },
  { sb: 50, bb: 100, label: '50/100', buyin: 10000 },
  { sb: 250, bb: 500, label: '250/500', buyin: 50000 },
  { sb: 1000, bb: 2000, label: '1K/2K', buyin: 200000 },
];

/** CPUの性格 */
export const PERSONAS = [
  { key: 'ROCK', name: '岩田', tag: 'タイト', callTh: 0.52, raiseTh: 0.74, bluff: 0.03, aggr: 0.8, avatar: '🗿' },
  { key: 'SHARK', name: 'シャーク', tag: '堅実', callTh: 0.45, raiseTh: 0.63, bluff: 0.10, aggr: 1.0, avatar: '🦈' },
  { key: 'MANIAC', name: 'マニアック', tag: '超攻撃', callTh: 0.33, raiseTh: 0.50, bluff: 0.30, aggr: 1.5, avatar: '🔥' },
  { key: 'FISH', name: 'カモ田', tag: 'ルース', callTh: 0.30, raiseTh: 0.70, bluff: 0.08, aggr: 0.7, avatar: '🐟' },
  { key: 'PRO', name: 'プロ', tag: 'バランス', callTh: 0.43, raiseTh: 0.60, bluff: 0.16, aggr: 1.15, avatar: '🎩' },
  { key: 'GRINDER', name: 'グラインダー', tag: '粘着', callTh: 0.40, raiseTh: 0.66, bluff: 0.12, aggr: 0.95, avatar: '☕' },
];

export function createTable(humanName, seatCount, stake, humanStack) {
  const personas = shuffle(PERSONAS).slice(0, seatCount - 1);
  const players = [{
    id: 0, name: humanName || 'YOU', isHuman: true, avatar: '🧑',
    stack: humanStack, bet: 0, totalBet: 0, folded: false, allIn: false,
    hole: [], acted: false, lastAction: '', sitting: true, persona: null,
  }];
  personas.forEach((p, i) => {
    players.push({
      id: i + 1, name: p.name, isHuman: false, avatar: p.avatar,
      stack: stake.buyin, bet: 0, totalBet: 0, folded: false, allIn: false,
      hole: [], acted: false, lastAction: '', sitting: true, persona: p,
    });
  });
  return { players, dealer: Math.floor(Math.random() * players.length), stake, handNo: 0 };
}

const nextIdx = (players, from) => {
  let i = from;
  for (let k = 0; k < players.length; k++) {
    i = (i + 1) % players.length;
    if (players[i].sitting && players[i].stack > 0) return i;
  }
  return from;
};
const nextActive = (players, from) => {
  let i = from;
  for (let k = 0; k < players.length; k++) {
    i = (i + 1) % players.length;
    const p = players[i];
    if (p.sitting && !p.folded && !p.allIn) return i;
  }
  return -1;
};

/** 新しいハンドを配る */
export function startHand(table) {
  const players = table.players.map(p => ({
    ...p,
    bet: 0, totalBet: 0, folded: !p.sitting || p.stack <= 0, allIn: false,
    hole: [], acted: false, lastAction: '', handRank: null,
  }));
  const live = players.filter(p => p.sitting && p.stack > 0);
  if (live.length < 2) return null;

  const dealer = nextIdx(players, table.dealer);
  const { sb, bb } = table.stake;
  const sbIdx = live.length === 2 ? dealer : nextIdx(players, dealer);
  const bbIdx = nextIdx(players, sbIdx);

  const deck = shuffle(buildDeck());
  players.forEach(p => { if (!p.folded) p.hole = [deck.pop(), deck.pop()]; });

  const post = (i, amount) => {
    const p = players[i];
    const a = Math.min(amount, p.stack);
    p.stack -= a; p.bet += a; p.totalBet += a;
    if (p.stack === 0) p.allIn = true;
    return a;
  };
  post(sbIdx, sb);
  post(bbIdx, bb);
  players[sbIdx].lastAction = 'SB';
  players[bbIdx].lastAction = 'BB';

  const first = live.length === 2 ? sbIdx : nextActive(players, bbIdx);

  return {
    stake: table.stake,
    players, deck, board: [], street: 'PREFLOP',
    pot: 0, currentBet: bb, minRaise: bb, lastAggressor: bbIdx,
    dealer, sbIdx, bbIdx, toAct: first,
    log: [`--- ハンド #${table.handNo + 1} 開始（SB ${sb} / BB ${bb}）---`],
    finished: false, pots: null, winners: [], reveal: false,
  };
}

const liveCount = (st) => st.players.filter(p => !p.folded).length;
const canActCount = (st) => st.players.filter(p => !p.folded && !p.allIn).length;

/** ベッティングラウンドが終わったか */
function roundComplete(st) {
  const actives = st.players.filter(p => !p.folded && !p.allIn);
  if (actives.length === 0) return true;
  return actives.every(p => p.acted && p.bet === st.currentBet);
}

/** サイドポットを組む */
export function buildPots(players) {
  const levels = [...new Set(players.filter(p => p.totalBet > 0).map(p => p.totalBet))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const lv of levels) {
    const contributors = players.filter(p => p.totalBet >= lv);
    const amount = (lv - prev) * contributors.length;
    const eligible = contributors.filter(p => !p.folded).map(p => p.id);
    if (amount > 0) pots.push({ amount, eligible });
    prev = lv;
  }
  // 同じ参加者のポットはまとめる
  const merged = [];
  for (const p of pots) {
    const last = merged[merged.length - 1];
    if (last && last.eligible.join() === p.eligible.join()) last.amount += p.amount;
    else merged.push({ ...p });
  }
  return merged;
}

export function totalPot(st) {
  return st.players.reduce((a, p) => a + p.totalBet, 0);
}

function dealStreet(st) {
  const next = { ...st, players: st.players.map(p => ({ ...p, bet: 0, acted: false, lastAction: '' })) };
  const deck = [...st.deck];
  let board = [...st.board];
  const idx = STREETS.indexOf(st.street);
  if (idx === 0) { deck.pop(); board = [deck.pop(), deck.pop(), deck.pop()]; }
  else { deck.pop(); board = [...board, deck.pop()]; }
  next.deck = deck; next.board = board;
  next.street = STREETS[idx + 1];
  next.currentBet = 0;
  next.minRaise = st.stake.bb;
  next.lastAggressor = -1;
  next.log = [...st.log, `${STREET_LABEL[next.street]}：${board.map(c => c.r).length}枚オープン`];
  // ディーラーの次から
  next.toAct = nextActive(next.players, next.dealer);
  return next;
}

/** 決着処理（ポット分配） */
export function resolve(st) {
  const players = st.players.map(p => ({ ...p }));
  const pots = buildPots(players);
  const winners = [];

  if (liveCount(st) === 1) {
    const w = players.find(p => !p.folded);
    const amount = pots.reduce((a, p) => a + p.amount, 0);
    w.stack += amount;
    winners.push({ id: w.id, amount, name: w.name, hand: null });
    return { ...st, players, finished: true, pots, winners, reveal: false, street: 'SHOWDOWN' };
  }

  let board = [...st.board];
  const deck = [...st.deck];
  while (board.length < 5) { deck.pop(); board.push(deck.pop()); }

  players.forEach(p => { if (!p.folded) p.handRank = evaluateHand([...p.hole, ...board]); });

  pots.forEach(pot => {
    const cands = players.filter(p => pot.eligible.includes(p.id) && !p.folded);
    if (!cands.length) return;
    const best = Math.max(...cands.map(p => p.handRank.value));
    const ws = cands.filter(p => p.handRank.value === best);
    const share = Math.floor(pot.amount / ws.length);
    let rest = pot.amount - share * ws.length;
    ws.forEach((w, i) => {
      const add = share + (i < rest ? 1 : 0);
      w.stack += add;
      const ex = winners.find(x => x.id === w.id);
      if (ex) ex.amount += add;
      else winners.push({ id: w.id, amount: add, name: w.name, hand: w.handRank });
    });
  });

  return { ...st, players, board, deck, finished: true, pots, winners, reveal: true, street: 'SHOWDOWN' };
}

/** 次に進める。人間の番になったら止まる。 */
export function advance(st) {
  if (st.finished) return st;

  if (liveCount(st) === 1) return resolve(st);

  if (roundComplete(st)) {
    if (st.street === 'RIVER' || canActCount(st) <= 1) return resolve(st);
    return dealStreet(st);
  }

  // toAct がすでに行動可能ならそのまま
  const cur = st.players[st.toAct];
  if (cur && !cur.folded && !cur.allIn && !(cur.acted && cur.bet === st.currentBet)) return st;
  const n = nextActive(st.players, st.toAct);
  if (n < 0) return resolve(st);
  return { ...st, toAct: n };
}

/** プレイヤーの行動を適用 */
export function applyAction(st, playerId, action, amount = 0) {
  const players = st.players.map(p => ({ ...p }));
  const p = players.find(x => x.id === playerId);
  if (!p || p.folded || p.allIn) return st;
  const idx = players.indexOf(p);
  let { currentBet, minRaise, lastAggressor } = st;
  const log = [...st.log];

  const put = (a) => {
    const v = Math.min(a, p.stack);
    p.stack -= v; p.bet += v; p.totalBet += v;
    if (p.stack === 0) p.allIn = true;
    return v;
  };

  if (action === 'FOLD') {
    p.folded = true; p.lastAction = 'フォールド';
    log.push(`${p.name}：フォールド`);
  } else if (action === 'CHECK') {
    p.lastAction = 'チェック';
    log.push(`${p.name}：チェック`);
  } else if (action === 'CALL') {
    const need = currentBet - p.bet;
    const v = put(need);
    p.lastAction = p.allIn ? `オールイン ${v}` : `コール ${v}`;
    log.push(`${p.name}：${p.lastAction}`);
  } else if (action === 'BET' || action === 'RAISE' || action === 'ALLIN') {
    const target = action === 'ALLIN' ? p.bet + p.stack : Math.max(amount, currentBet + minRaise);
    const need = Math.min(target - p.bet, p.stack);
    put(need);
    const raiseBy = p.bet - currentBet;
    if (p.bet > currentBet) {
      if (raiseBy >= minRaise) minRaise = raiseBy;
      currentBet = p.bet;
      lastAggressor = idx;
      players.forEach(x => { if (x.id !== p.id && !x.folded && !x.allIn) x.acted = false; });
      p.lastAction = p.allIn ? `オールイン ${p.bet}` : (action === 'BET' ? `ベット ${p.bet}` : `レイズ ${p.bet}`);
    } else {
      p.lastAction = `オールイン ${p.bet}`;
    }
    log.push(`${p.name}：${p.lastAction}`);
  }
  p.acted = true;

  let next = { ...st, players, currentBet, minRaise, lastAggressor, log };
  if (liveCount(next) === 1) return resolve(next);
  if (roundComplete(next)) {
    if (next.street === 'RIVER' || canActCount(next) <= 1) return resolve(next);
    return dealStreet(next);
  }
  const n = nextActive(players, idx);
  if (n < 0) return resolve(next);
  return { ...next, toAct: n };
}

/** CPUの意思決定 */
export function cpuDecide(st, playerId) {
  const p = st.players.find(x => x.id === playerId);
  const persona = p.persona || PERSONAS[0];
  const opponents = Math.max(1, st.players.filter(x => !x.folded && x.id !== p.id).length);
  const used = [...p.hole, ...st.board];
  const remaining = buildDeck().filter(c => !used.some(u => u.r === c.r && u.s === c.s));
  const trials = st.board.length >= 4 ? 220 : st.board.length >= 3 ? 170 : 130;
  let eq = estimateEquity(p.hole, st.board, remaining, trials, Math.min(3, opponents));

  const pot = totalPot(st);
  const toCall = st.currentBet - p.bet;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const r = Math.random();

  // ブラフ
  const bluffing = r < persona.bluff && st.board.length >= 3;
  if (bluffing) eq = Math.max(eq, persona.raiseTh + 0.05);

  const potBet = Math.max(st.stake.bb, Math.round(pot * (0.55 + 0.25 * persona.aggr)));

  if (toCall <= 0) {
    if (eq > persona.raiseTh && p.stack > 0) {
      const size = Math.min(p.stack + p.bet, Math.max(st.currentBet + Math.max(st.minRaise, st.stake.bb), potBet));
      return { action: 'BET', amount: size };
    }
    return { action: 'CHECK' };
  }

  // コールに必要なオッズと勝率を比較
  const need = potOdds * (1 + (persona.callTh - 0.4));
  if (eq < need - 0.04) {
    if (toCall <= st.stake.bb && eq > 0.3) return { action: 'CALL' };
    return { action: 'FOLD' };
  }
  if (eq > persona.raiseTh && p.stack > toCall) {
    const size = Math.min(p.stack + p.bet, Math.max(st.currentBet + Math.max(st.minRaise, st.stake.bb), potBet));
    if (size > st.currentBet) return { action: 'RAISE', amount: size };
  }
  if (toCall >= p.stack) return { action: 'CALL' };
  return { action: 'CALL' };
}
