/* ==========================================================
   トランプ共通（ポーカー用）
   ========================================================== */
export const CARD_SUITS = [
  { s: '♠', red: false }, { s: '♥', red: true }, { s: '♦', red: true }, { s: '♣', red: false },
];
export const CARD_RANK_LABEL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function buildDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const HAND_NAMES = ['ハイカード', 'ワンペア', 'ツーペア', 'スリーカード', 'ストレート', 'フラッシュ', 'フルハウス', 'フォーカード', 'ストレートフラッシュ', 'ロイヤルフラッシュ'];

// 7枚から最強の5枚役を評価。数値が大きいほど強い。
export function evaluateHand(cards) {
  const rankCount = {};
  const suitCount = [0, 0, 0, 0];
  cards.forEach(c => {
    rankCount[c.r] = (rankCount[c.r] || 0) + 1;
    suitCount[c.s]++;
  });
  const flushSuit = suitCount.findIndex(n => n >= 5);

  const straightTop = (ranksSet) => {
    const uniq = [...new Set(ranksSet)].sort((a, b) => b - a);
    if (uniq.includes(14)) uniq.push(1); // A-2-3-4-5
    let run = 1;
    for (let i = 1; i < uniq.length; i++) {
      if (uniq[i] === uniq[i - 1] - 1) {
        run++;
        if (run >= 5) return uniq[i] + 4;
      } else run = 1;
    }
    return 0;
  };

  let category = 0, tiebreak = [];

  if (flushSuit >= 0) {
    const fRanks = cards.filter(c => c.s === flushSuit).map(c => c.r);
    const sfTop = straightTop(fRanks);
    if (sfTop >= 5) {
      category = sfTop === 14 ? 9 : 8;
      return { category, value: category * 1e10 + sfTop * 1e8, name: HAND_NAMES[category] };
    }
  }

  const groups = Object.keys(rankCount)
    .map(Number)
    .sort((a, b) => (rankCount[b] - rankCount[a]) || (b - a));
  const counts = groups.map(r => rankCount[r]);

  if (counts[0] === 4) { category = 7; tiebreak = [groups[0], groups[1]]; }
  else if (counts[0] === 3 && counts[1] >= 2) { category = 6; tiebreak = [groups[0], groups[1]]; }
  else if (flushSuit >= 0) {
    category = 5;
    tiebreak = cards.filter(c => c.s === flushSuit).map(c => c.r).sort((a, b) => b - a).slice(0, 5);
  } else {
    const sTop = straightTop(cards.map(c => c.r));
    if (sTop >= 5) { category = 4; tiebreak = [sTop]; }
    else if (counts[0] === 3) { category = 3; tiebreak = [groups[0], groups[1], groups[2]]; }
    else if (counts[0] === 2 && counts[1] === 2) { category = 2; tiebreak = [groups[0], groups[1], groups[2]]; }
    else if (counts[0] === 2) { category = 1; tiebreak = [groups[0], groups[1], groups[2], groups[3]]; }
    else { category = 0; tiebreak = groups.slice(0, 5); }
  }

  let value = category * 1e10;
  tiebreak.slice(0, 5).forEach((r, i) => { value += r * Math.pow(15, 4 - i) * 100; });
  return { category, value, name: HAND_NAMES[category] };
}

// CPU用：残りデッキからランダムに埋めて勝率を概算
export function estimateEquity(hole, board, deck, trials = 140, opponents = 1) {
  let score = 0;
  for (let t = 0; t < trials; t++) {
    const d = shuffle(deck);
    let idx = 0;
    const fullBoard = [...board];
    while (fullBoard.length < 5) fullBoard.push(d[idx++]);
    const me = evaluateHand([...hole, ...fullBoard]).value;
    let best = -1, ties = 0;
    for (let o = 0; o < opponents; o++) {
      const oppHole = [d[idx++], d[idx++]];
      const op = evaluateHand([...oppHole, ...fullBoard]).value;
      if (op > best) { best = op; ties = 0; }
      else if (op === best) ties++;
    }
    if (me > best) score += 1;
    else if (me === best) score += 0.5;
  }
  return score / trials;
}
