/* ==========================================================
   SLOT MODEL — 実機と同じ「リールストリップ方式」
   各リールは 24 コマの物理ストリップ。停止コマ(中段)が決まれば
   上段・下段は自動的に決まるので「見た目と判定」が絶対にズレない。
   ========================================================== */

export const SYM = {
  CHERRY: 0, LEMON: 1, ORANGE: 2, GRAPE: 3, BELL: 4, MELON: 5, DIAMOND: 6, BAR: 7, SEVEN: 8,
};

export const SLOT_SYMBOLS = [
  { key: 'CHERRY', label: 'チェリー', kind: 'emoji', glyph: '🍒', tint: '#f43f5e' },
  { key: 'LEMON', label: 'レモン', kind: 'emoji', glyph: '🍋', tint: '#facc15' },
  { key: 'ORANGE', label: 'オレンジ', kind: 'emoji', glyph: '🍊', tint: '#fb923c' },
  { key: 'GRAPE', label: 'ぶどう', kind: 'emoji', glyph: '🍇', tint: '#c084fc' },
  { key: 'BELL', label: 'ベル', kind: 'emoji', glyph: '🔔', tint: '#fbbf24' },
  { key: 'MELON', label: 'メロン', kind: 'emoji', glyph: '🍉', tint: '#4ade80' },
  { key: 'DIAMOND', label: 'ダイヤ', kind: 'gem', glyph: '💎', tint: '#38bdf8' },
  { key: 'BAR', label: 'バー', kind: 'bar', glyph: 'BAR', tint: '#e5e7eb' },
  { key: 'SEVEN', label: 'セブン', kind: 'seven', glyph: '7', tint: '#ef4444' },
];

/* 1リール24コマ。構成は3リールとも同一（チェリー5/レモン5/オレンジ4/ぶどう3/
   ベル2/メロン2/ダイヤ1/BAR1/セブン1）、並び順だけ違う（実機同様）。 */

// 同じ絵柄が隣り合いすぎないように、決め打ちの並びを3種類用意
export const REEL_STRIPS = [
  [8, 0, 1, 2, 0, 3, 1, 4, 0, 2, 1, 6, 0, 3, 1, 5, 2, 0, 1, 7, 2, 3, 5, 4],
  [0, 1, 7, 2, 3, 0, 1, 5, 2, 4, 0, 1, 6, 3, 2, 0, 1, 4, 5, 8, 0, 2, 3, 1],
  [1, 0, 2, 4, 3, 1, 0, 5, 2, 6, 1, 0, 3, 2, 8, 1, 0, 4, 5, 2, 7, 3, 1, 0],
];
export const STRIP_LEN = REEL_STRIPS[0].length; // 24

/** 3×3のセル番号: row*3 + col （row0=上段） */
export const SLOT_LINES = [
  { id: 'TOP', name: '上段', cells: [0, 1, 2], color: '#38bdf8' },
  { id: 'MID', name: '中段', cells: [3, 4, 5], color: '#fbbf24' },
  { id: 'BOT', name: '下段', cells: [6, 7, 8], color: '#34d399' },
  { id: 'DOWN', name: '右下がり', cells: [0, 4, 8], color: '#f472b6' },
  { id: 'UP', name: '右上がり', cells: [2, 4, 6], color: '#a78bfa' },
];

/**
 * 配当はすべて「1ライン当たりのベット額(ラインベット)」に対する倍率。
 * 合計ベット = ラインベット × 5ライン。
 */
export const LINE_PAYS = {
  SEVEN: 3000,
  BAR: 1200,
  DIAMOND: 600,
  MELON: 110,
  BELL: 90,
  GRAPE: 30,
  ORANGE: 12,
  LEMON: 6,
  CHERRY: 5,
};
/** 左2リールが同じ（3つ目は不一致）の小役 */
export const TWO_PAYS = { CHERRY: 2, LEMON: 2 };
/** 7・BAR・ダイヤの混在3つ揃い（プレミアムミックス） */
export const MIX_PREMIUM_PAY = 40;
/** 画面内の💎の数によるスキャッター配当（ライン不問・ラインベットに対する倍率） */
export const SCATTER_PAYS = { 3: 200, 4: 600, 5: 1500, 6: 4000, 7: 10000, 8: 25000, 9: 60000 };

const PREMIUM = new Set([SYM.SEVEN, SYM.BAR, SYM.DIAMOND]);

/** 停止コマ(中段)から 3×3 の絵柄グリッドを作る */
export function gridFromStops(stops) {
  const g = new Array(9);
  for (let col = 0; col < 3; col++) {
    const strip = REEL_STRIPS[col];
    const L = strip.length;
    const s = ((stops[col] % L) + L) % L;
    // 上段 = s+1, 中段 = s, 下段 = s-1（リールは下方向に回るため）
    g[0 * 3 + col] = strip[(s + 1) % L];
    g[1 * 3 + col] = strip[s];
    g[2 * 3 + col] = strip[(s - 1 + L) % L];
  }
  return g;
}

/** グリッドを判定して当たりライン・合計倍率を返す */
export function evaluateGrid(grid) {
  const hits = [];
  let totalMult = 0;

  SLOT_LINES.forEach(line => {
    const [a, b, c] = line.cells.map(i => grid[i]);
    let mult = 0, label = '', key = null, cells = line.cells;
    if (a === b && b === c) {
      key = SLOT_SYMBOLS[a].key;
      mult = LINE_PAYS[key] || 0;
      label = key === 'SEVEN' ? 'JACKPOT!!!' : key === 'BAR' ? 'BIG BONUS!!' : key === 'DIAMOND' ? 'MEGA WIN!' : 'WIN!';
    } else if (PREMIUM.has(a) && PREMIUM.has(b) && PREMIUM.has(c)) {
      mult = MIX_PREMIUM_PAY; label = 'PREMIUM MIX'; key = 'MIX_PREMIUM';
    } else if (a === b && TWO_PAYS[SLOT_SYMBOLS[a].key]) {
      key = SLOT_SYMBOLS[a].key;
      mult = TWO_PAYS[key];
      label = '2つ揃い';
      cells = line.cells.slice(0, 2);
    }
    if (mult > 0) {
      totalMult += mult;
      hits.push({ ...line, cells, mult, label, key });
    }
  });

  const scatterCount = grid.filter(s => s === SYM.DIAMOND).length;
  const scatterMult = SCATTER_PAYS[scatterCount] || 0;
  if (scatterMult > 0) totalMult += scatterMult;

  return { hits, scatterCount, scatterMult, totalMult };
}

/** 全 24^3 = 13,824 通りを全列挙して理論還元率(RTP)を厳密計算 */
export function computeRTP() {
  const L = STRIP_LEN;
  let sum = 0;
  const dist = {};
  for (let a = 0; a < L; a++) {
    for (let b = 0; b < L; b++) {
      for (let c = 0; c < L; c++) {
        const { totalMult } = evaluateGrid(gridFromStops([a, b, c]));
        sum += totalMult;
        const bucket = totalMult === 0 ? '0' : totalMult < 2 ? '<2' : totalMult < 10 ? '2-10' : totalMult < 50 ? '10-50' : totalMult < 200 ? '50-200' : '200+';
        dist[bucket] = (dist[bucket] || 0) + 1;
      }
    }
  }
  const total = L * L * L;
  return { rtp: sum / total, total, dist };
}
