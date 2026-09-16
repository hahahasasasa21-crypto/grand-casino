/* ==========================================================
   オンライン人生ゲーム — 盤面とルール
   ・全員が同じ盤面を進み、マスのイベントで所持金や家族が変わる
   ・ゴール時の「最終資産」の順位で参加費のプールを山分け
   ========================================================== */

export const START_CASH = 100000;
export const ENTRY_FEES = [1000, 5000, 20000, 100000];
export const KID_VALUE = 25000;
export const SPOUSE_VALUE = 20000;
export const TURN_MS = 45000;

export const CAREERS = [
  { key: 'OFFICE', name: '会社員', salary: 30000, icon: '💼', desc: '安定。毎回きっちり給料がもらえる。' },
  { key: 'DOCTOR', name: '医者', salary: 45000, icon: '🩺', desc: '高給。ただし税金のマスで支払いが1.5倍。', taxMul: 1.5 },
  { key: 'STARTUP', name: '起業家', salary: 12000, icon: '🚀', desc: '給料は少ないが、給料日ごとに1/3の確率で +80,000。', jackpot: 80000, jackpotP: 1 / 3 },
  { key: 'ARTIST', name: 'アーティスト', salary: 20000, icon: '🎨', desc: 'イベントマスの効果が1.6倍（良いことも悪いことも）。', eventMul: 1.6 },
];
export const careerOf = (k) => CAREERS.find(c => c.key === k) || null;

/* ---------- マスの種類 ---------- */
export const SPACE_STYLE = {
  START: { bg: '#334155', label: 'スタート', icon: '🏁' },
  GOAL: { bg: '#b45309', label: 'ゴール', icon: '🏆' },
  PAY: { bg: '#15803d', label: '給料日', icon: '💰' },
  PLUS: { bg: '#0e7490', label: '収入', icon: '＋' },
  MINUS: { bg: '#9f1239', label: '支出', icon: '−' },
  EVENT: { bg: '#6d28d9', label: 'イベント', icon: '❓' },
  CAREER: { bg: '#b91c1c', label: '職業選択', icon: '🧭' },
  MARRY: { bg: '#db2777', label: '結婚', icon: '💒' },
  BABY: { bg: '#ea580c', label: '出産', icon: '👶' },
  TAX: { bg: '#4b5563', label: '税金', icon: '🏛️' },
  GAMBLE: { bg: '#a16207', label: '勝負', icon: '🎲' },
  STOCK: { bg: '#0f766e', label: '株', icon: '📈' },
  MOVE: { bg: '#1d4ed8', label: '移動', icon: '➡️' },
  COLLECT: { bg: '#7c2d12', label: '集金', icon: '🤝' },
  TREAT: { bg: '#78350f', label: 'おごり', icon: '🍻' },
};

/** 盤面（48マス） */
export const BOARD = [
  { t: 'START', text: '人生のスタート！' },
  { t: 'PAY', text: '初任給をもらった' },
  { t: 'EVENT' },
  { t: 'PLUS', v: 12000, text: '宝くじが少し当たった' },
  { t: 'CAREER', text: '職業を決めよう' },
  { t: 'PAY' },
  { t: 'MINUS', v: 8000, text: 'スマホを落として画面が割れた' },
  { t: 'EVENT' },
  { t: 'MOVE', v: 2, text: '追い風！2マス進む' },
  { t: 'PAY' },
  { t: 'MARRY', text: '結婚！全員からご祝儀' },
  { t: 'PLUS', v: 20000, text: '新婚旅行のキャッシュバック' },
  { t: 'EVENT' },
  { t: 'TAX', v: 0.05, text: '住民税' },
  { t: 'PAY' },
  { t: 'BABY', text: '子どもが生まれた！' },
  { t: 'MINUS', v: 15000, text: '車をこすった' },
  { t: 'GAMBLE', text: '一か八かの勝負' },
  { t: 'PAY' },
  { t: 'EVENT' },
  { t: 'PLUS', v: 40000, text: '副業が当たった' },
  { t: 'MOVE', v: -3, text: '寝坊して3マス戻る' },
  { t: 'PAY' },
  { t: 'STOCK', text: '株を買うチャンス' },
  { t: 'EVENT' },
  { t: 'MINUS', v: 25000, text: '引っ越し費用' },
  { t: 'PAY' },
  { t: 'BABY', text: '第二子が生まれた！' },
  { t: 'COLLECT', v: 10000, text: '同窓会の幹事。全員から集める' },
  { t: 'EVENT' },
  { t: 'PAY' },
  { t: 'TAX', v: 0.08, text: '所得税の追徴' },
  { t: 'PLUS', v: 60000, text: '昇進した！' },
  { t: 'EVENT' },
  { t: 'PAY' },
  { t: 'GAMBLE', text: '人生二度目の勝負' },
  { t: 'MINUS', v: 30000, text: '急な入院' },
  { t: 'PAY' },
  { t: 'EVENT' },
  { t: 'BABY', text: '第三子が生まれた！' },
  { t: 'PLUS', v: 80000, text: '大きな契約がまとまった' },
  { t: 'PAY' },
  { t: 'TREAT', v: 12000, text: '全員におごる' },
  { t: 'EVENT' },
  { t: 'PLUS', v: 50000, text: '退職金' },
  { t: 'PAY' },
  { t: 'EVENT' },
  { t: 'GOAL', text: 'ゴール！おつかれさま' },
];
export const GOAL_INDEX = BOARD.length - 1;

/** イベントマスの中身 */
export const EVENTS = [
  { v: 30000, text: '道でお金を拾った' },
  { v: -12000, text: '財布を落とした' },
  { v: 18000, text: 'フリマで大量に売れた' },
  { v: -20000, text: '家電が壊れて買い替え' },
  { v: 25000, text: '懸賞に当たった' },
  { v: -9000, text: '飲み会の幹事になった' },
  { v: 45000, text: '土地の値段が上がった' },
  { v: -35000, text: '自転車を盗まれた' },
  { v: 15000, text: '友だちに貸したお金が返ってきた' },
  { v: -16000, text: 'ペットが病気になった' },
  { v: 60000, text: '書いた記事がバズって広告収入' },
  { v: -50000, text: 'サブスクを解約し忘れていた' },
  { v: 22000, text: '株主優待が届いた' },
  { v: -14000, text: '傘を3本なくした' },
  { v: 35000, text: '親戚からのおこづかい' },
  { v: -28000, text: 'スマホを新しくした' },
  { v: 70000, text: '福引で一等が当たった' },
  { v: -40000, text: '確定申告を間違えた' },
  { v: 10000, text: 'ポイントが大量に貯まっていた' },
  { v: -22000, text: '歯の治療費' },
];

/* ---------- 乱数（部屋のシードから） ---------- */
export function rng32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 賞金の分配率 ---------- */
export function prizeSplit(n) {
  const table = {
    2: [0.70, 0.30],
    3: [0.55, 0.30, 0.15],
    4: [0.45, 0.28, 0.17, 0.10],
    5: [0.40, 0.25, 0.17, 0.11, 0.07],
    6: [0.36, 0.24, 0.16, 0.11, 0.08, 0.05],
  };
  return table[n] || table[6].slice(0, n);
}

export const newPlayer = (name, vip) => ({
  name, vip: !!vip, pos: 0, cash: START_CASH, career: null,
  spouse: false, kids: 0, stocks: 0, finished: false, finishOrder: 0,
});

/* ==========================================================
   1ターンの処理
   spin(1..10) → 進む → 通過した給料日を精算 → 着地マスを処理
   choice が必要なマスでは pending を返し、選択後に続きを解決する
   ========================================================== */

const clone = (st) => JSON.parse(JSON.stringify(st));
const salaryOf = (p) => (careerOf(p.career)?.salary ?? 15000);

function payday(st, idx, rand, log, times = 1) {
  const p = st.players[idx];
  const c = careerOf(p.career);
  for (let i = 0; i < times; i++) {
    let amount = salaryOf(p);
    p.cash += amount;
    let extra = '';
    if (c?.jackpot && rand() < c.jackpotP) { p.cash += c.jackpot; extra = `＋大口案件 ${c.jackpot.toLocaleString()}`; }
    log.push(`${p.name}：給料日 +${amount.toLocaleString()}${extra ? '（' + extra + '）' : ''}`);
  }
}

/** マスに着地したときの処理。選択が必要なら pending を返す */
function land(st, idx, rand, log) {
  const p = st.players[idx];
  const sp = BOARD[p.pos];
  const c = careerOf(p.career);

  switch (sp.t) {
    case 'PAY':
      payday(st, idx, rand, log);
      return null;
    case 'PLUS':
      p.cash += sp.v; log.push(`${p.name}：${sp.text} +${sp.v.toLocaleString()}`);
      return null;
    case 'MINUS':
      p.cash -= sp.v; log.push(`${p.name}：${sp.text} -${sp.v.toLocaleString()}`);
      return null;
    case 'EVENT': {
      const ev = EVENTS[Math.floor(rand() * EVENTS.length)];
      const mul = c?.eventMul || 1;
      const v = Math.round(ev.v * mul);
      p.cash += v;
      log.push(`${p.name}：${ev.text} ${v >= 0 ? '+' : ''}${v.toLocaleString()}`);
      return null;
    }
    case 'CAREER':
      return { kind: 'CAREER', player: idx, options: CAREERS.map(x => x.key) };
    case 'MARRY': {
      if (p.spouse) { p.cash += 30000; log.push(`${p.name}：記念日のお祝い +30,000`); return null; }
      p.spouse = true;
      let got = 0;
      st.players.forEach((o, i) => { if (i !== idx && !o.finished) { o.cash -= 15000; got += 15000; } });
      p.cash += got;
      log.push(`${p.name}：💒 結婚！ みんなからご祝儀 +${got.toLocaleString()}`);
      return null;
    }
    case 'BABY':
      p.kids += 1;
      log.push(`${p.name}：👶 子どもが生まれた（${p.kids}人目）`);
      return null;
    case 'TAX': {
      const rate = sp.v * (c?.taxMul || 1);
      const amount = Math.max(0, Math.floor(Math.max(0, p.cash) * rate));
      p.cash -= amount;
      log.push(`${p.name}：${sp.text} -${amount.toLocaleString()}`);
      return null;
    }
    case 'GAMBLE':
      return { kind: 'GAMBLE', player: idx };
    case 'STOCK':
      return { kind: 'STOCK', player: idx };
    case 'MOVE': {
      p.pos = Math.max(0, Math.min(GOAL_INDEX, p.pos + sp.v));
      log.push(`${p.name}：${sp.text}`);
      const again = land(st, idx, rand, log);
      return again;
    }
    case 'COLLECT': {
      let got = 0;
      st.players.forEach((o, i) => { if (i !== idx && !o.finished) { o.cash -= sp.v; got += sp.v; } });
      p.cash += got;
      log.push(`${p.name}：${sp.text} +${got.toLocaleString()}`);
      return null;
    }
    case 'TREAT': {
      let paid = 0;
      st.players.forEach((o, i) => { if (i !== idx && !o.finished) { o.cash += sp.v; paid += sp.v; } });
      p.cash -= paid;
      log.push(`${p.name}：${sp.text} -${paid.toLocaleString()}`);
      return null;
    }
    case 'GOAL':
      return null;
    default:
      return null;
  }
}

/** さいころ（ルーレット）を回して進む */
export function applySpin(state, idx, value) {
  const st = clone(state);
  const log = [];
  const rand = rng32((st.seed || 1) + st.turnNo * 7919 + idx * 131);
  const p = st.players[idx];
  if (!p || p.finished) return { state: st, pending: null };

  const from = p.pos;
  const to = Math.min(GOAL_INDEX, from + value);
  p.pos = to;
  log.push(`${p.name}：ルーレット ${value} → ${to === GOAL_INDEX ? 'ゴール！' : `${to + 1}マス目`}`);

  // 通過した給料日
  let passed = 0;
  for (let i = from + 1; i < to; i++) if (BOARD[i].t === 'PAY') passed++;
  if (passed > 0) payday(st, idx, rand, log, passed);

  let pending = null;
  if (to >= GOAL_INDEX) {
    p.finished = true;
    st.finishedCount = (st.finishedCount || 0) + 1;
    p.finishOrder = st.finishedCount;
    p.cash += 50000;
    log.push(`${p.name}：🏆 ゴール！ ゴール賞金 +50,000`);
  } else {
    pending = land(st, idx, rand, log);
  }

  st.log = [...(st.log || []), ...log].slice(-60);
  st.pending = pending;
  st.lastSpin = { player: idx, value, at: Date.now() };
  if (!pending) advanceTurn(st);
  return { state: st, pending };
}

/** 選択マスの決着 */
export function applyChoice(state, idx, choice) {
  const st = clone(state);
  const log = [];
  const rand = rng32((st.seed || 1) + st.turnNo * 104729 + idx * 31 + 7);
  const p = st.players[idx];
  const pending = st.pending;
  if (!pending || pending.player !== idx) return st;

  if (pending.kind === 'CAREER') {
    const c = careerOf(choice) || CAREERS[0];
    p.career = c.key;
    log.push(`${p.name}：${c.icon} ${c.name} になった（給料 ${c.salary.toLocaleString()}）`);
  } else if (pending.kind === 'GAMBLE') {
    if (choice === 'YES') {
      const stake = Math.max(10000, Math.floor(Math.max(0, p.cash) * 0.3));
      if (rand() < 0.5) { p.cash += stake; log.push(`${p.name}：🎲 勝負に勝った！ +${stake.toLocaleString()}`); }
      else { p.cash -= stake; log.push(`${p.name}：🎲 勝負に負けた… -${stake.toLocaleString()}`); }
    } else {
      p.cash += 5000;
      log.push(`${p.name}：勝負を見送った（参加賞 +5,000）`);
    }
  } else if (pending.kind === 'STOCK') {
    const n = Math.max(0, Math.min(3, Number(choice) || 0));
    const cost = n * 20000;
    if (cost > 0 && p.cash >= cost) {
      p.cash -= cost; p.stocks += n;
      log.push(`${p.name}：📈 株を ${n} 口購入（-${cost.toLocaleString()}）`);
    } else if (n > 0) {
      log.push(`${p.name}：お金が足りず株を買えなかった`);
    } else {
      log.push(`${p.name}：株は買わなかった`);
    }
  }

  st.log = [...(st.log || []), ...log].slice(-60);
  st.pending = null;
  advanceTurn(st);
  return st;
}

function advanceTurn(st) {
  const n = st.players.length;
  st.turnNo = (st.turnNo || 0) + 1;
  if (st.players.every(p => p.finished)) { st.status = 'DONE'; st.finishedAt = Date.now(); return; }
  let t = st.turn;
  for (let k = 0; k < n; k++) {
    t = (t + 1) % n;
    if (!st.players[t].finished) break;
  }
  st.turn = t;
  st.turnDeadline = Date.now() + TURN_MS;
}

/** 最終資産を計算して順位をつける */
export function settle(state) {
  const st = clone(state);
  const rand = rng32((st.seed || 1) + 999983);
  const stockValue = 10000 + Math.floor(rand() * 25000);   // 1口あたり 10,000〜35,000
  st.stockValue = stockValue;
  const rows = st.players.map((p, i) => {
    const assets = Math.round(p.cash + p.kids * KID_VALUE + (p.spouse ? SPOUSE_VALUE : 0) + p.stocks * stockValue);
    return { i, name: p.name, vip: p.vip, cash: p.cash, kids: p.kids, spouse: p.spouse, stocks: p.stocks, assets };
  });
  rows.sort((a, b) => b.assets - a.assets);
  const split = prizeSplit(rows.length);
  const pot = st.pot || 0;
  rows.forEach((r, k) => { r.rank = k + 1; r.prize = Math.floor(pot * (split[k] || 0)); });
  st.results = rows;
  st.status = 'DONE';
  return st;
}

/** 盤面を蛇行レイアウトに並べるための座標 */
export function boardLayout(cols = 8) {
  return BOARD.map((sp, i) => {
    const row = Math.floor(i / cols);
    const col = row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    return { i, sp, row, col };
  });
}
