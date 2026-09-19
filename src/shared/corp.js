/* ==========================================================
   起業 — 会社のデータと計算
   ・設立に資格が必要な業種がある
   ・売上は「経過した期」ごとに決まる。乱数は会社IDと期番号から作るので
     誰が計算しても同じ値になり、リロードで引き直すズルができない
   ・売上の一部は法人税として YUTAPON-BANK に入る
   ・投資家は株を買って、会社が育つと株価が上がる（売値は 8% 低い）
   ========================================================== */

export const CORP_INTERVAL = 20 * 60 * 1000;   // 決算の間隔
export const CORP_MAX_PERIODS = 6;             // まとめて計算できる上限
export const CORP_TAX = 0.12;                  // 法人税
export const BASE_SHARES = 1000;               // 創業者ぶんの株数
export const SELL_SPREAD = 0.92;               // 売却は買値の92%
export const MAX_LEVEL = 10;

export const CORP_TYPES = [
  {
    eduReq: 0, key: 'RETAIL', name: '小売チェーン', icon: '🏪', req: [], cost: 80000, base: 4200, risk: 0.35,
    desc: '安定した日銭。最初の一歩に向く。', site: '',
  },
  {
    eduReq: 0, key: 'LOGI', name: '物流会社', icon: '🚚', req: [], cost: 140000, base: 6800, risk: 0.4,
    desc: '荷物が増えるほど儲かる。景気に左右される。', site: '',
  },
  {
    eduReq: 1, key: 'CRAM', name: '学習塾', icon: '🏫', req: ['TEACH'], cost: 180000, base: 8600, risk: 0.3,
    desc: '教員免許が要る。堅実で波が小さい。', site: '',
  },
  {
    eduReq: 2, key: 'FOOD', name: 'レストラン', icon: '🍽️', req: ['COOK'], cost: 200000, base: 9800, risk: 0.5,
    desc: '当たれば大きいが、外すと痛い。', site: '',
  },
  {
    eduReq: 3, key: 'CONST', name: '建設会社', icon: '🏗️', req: ['ARCH'], cost: 320000, base: 15000, risk: 0.45,
    desc: '大型案件で一気に伸びる。', site: '',
  },
  {
    eduReq: 3, key: 'IT', name: 'IT企業', icon: '💻', req: ['IT'], cost: 300000, base: 14200, risk: 0.55,
    desc: '伸びしろが大きい。ボラティリティも大きい。',
    site: 'サイトのサーバー運用を請け負う。全プレイヤーの取引が増えるほど売上も増える。',
  },
  {
    eduReq: 3, key: 'CLINIC', name: '医療法人', icon: '🏥', req: ['DOC'], cost: 520000, base: 24000, risk: 0.25,
    desc: '医師免許が必要。景気に強い。', site: '',
  },
  {
    eduReq: 3, key: 'LAWFIRM', name: '法律事務所', icon: '⚖️', req: ['LAW'], cost: 480000, base: 22000, risk: 0.3,
    desc: '弁護士資格が必要。',
    site: '延滞プレイヤーの債権回収を YUTAPON-BANK から受託する。',
  },
  {
    eduReq: 3, key: 'AIR', name: '航空会社', icon: '✈️', req: ['PILOT'], cost: 600000, base: 27000, risk: 0.6,
    desc: '巨額の設備投資。当たれば莫大。', site: '',
  },
  {
    eduReq: 3, key: 'LAB', name: '研究所', icon: '🔬', req: ['PHD'], cost: 700000, base: 31000, risk: 0.5,
    desc: '博士号が必要。長期で化ける。', site: '',
  },
  {
    eduReq: 2, key: 'CASINO', name: 'カジノ運営会社', icon: '🎰', req: ['DEALER', 'SEC'], cost: 800000, base: 34000, risk: 0.7,
    desc: 'ディーラー資格と証券外務員が必要。当たり外れが激しい。',
    site: 'YUTAPON-CASINO の運営を分担する。カジノの収支に連動して売上が動く。',
  },
  {
    eduReq: 3, key: 'BANK', name: '銀行', icon: '🏦', req: ['BOOK', 'SEC'], cost: 1200000, base: 26000, risk: 0.2,
    desc: '簿記2級と証券外務員が必要。預金を集めて利息を払う、本物の銀行業。',
    site: '自分の銀行を開けます。金利を決めて預金を集め、集めたお金は預かり金として守られます。',
    isBank: true,
  },
];
export const corpTypeOf = (k) => CORP_TYPES.find(c => c.key === k) || null;

/* ---------- 決まった乱数（会社ID＋期番号） ---------- */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rand01(id, period) {
  let t = (hash32(String(id)) + period * 0x9E3779B9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 会社の規模。資本が増えるほど大きくなる（レベルで売上が伸びる） */
export function levelOf(company) {
  const t = corpTypeOf(company?.type);
  if (!t) return 1;
  const cap = Math.max(0, (company.capital || 0) - (company.deposits || 0));
  return Math.max(1, Math.min(MAX_LEVEL, 1 + Math.floor(cap / Math.max(1, t.cost))));
}

/** 1期ぶんの売上（税引き前）。marketMood は全プレイヤーの景気 -1〜+1 */
export function periodRevenue(company, period, marketMood = 0) {
  const t = corpTypeOf(company?.type);
  if (!t) return 0;
  const r = rand01(company.id || company.key || 'x', period);
  const swing = 1 + (r * 2 - 1) * t.risk;
  const mood = 1 + Math.max(-0.5, Math.min(0.5, marketMood)) * 0.35;
  return Math.max(0, Math.round(t.base * levelOf(company) * swing * mood));
}

/** いま何期ぶん未計算か */
export function duePeriods(company, now = Date.now()) {
  const last = company?.lastPayoutAt || company?.createdAt || now;
  return Math.max(0, Math.min(CORP_MAX_PERIODS, Math.floor((now - last) / CORP_INTERVAL)));
}

/** 未計算ぶんをまとめて精算した結果（書き込みはしない） */
export function settleCompany(company, marketMood = 0, now = Date.now()) {
  const n = duePeriods(company, now);
  if (n <= 0) return null;
  const startPeriod = Math.floor((company.lastPayoutAt || company.createdAt || now) / CORP_INTERVAL);
  let gross = 0;
  const sim = { ...company };
  for (let i = 0; i < n; i++) {
    const rev = periodRevenue(sim, startPeriod + i, marketMood);
    gross += rev;
    sim.capital = (sim.capital || 0) + Math.round(rev * (1 - CORP_TAX));
  }
  const tax = Math.round(gross * CORP_TAX);
  const net = gross - tax;
  return {
    periods: n, gross, tax, net,
    lastPayoutAt: (company.lastPayoutAt || company.createdAt || now) + n * CORP_INTERVAL,
  };
}

/* ---------- 株 ---------- */
export function sharePrice(company) {
  const equity = Math.max(0, (company?.capital || 0) - (company?.deposits || 0));
  const shares = BASE_SHARES + (company?.sharesOut || 0);
  return Math.max(10, Math.round(equity / shares));
}
export const sellPrice = (company) => Math.max(1, Math.floor(sharePrice(company) * SELL_SPREAD));

/** オーナーが引き出せる額（預かり金と投資家のぶんは触れない） */
export function ownerEquity(company) {
  const equity = Math.max(0, (company?.capital || 0) - (company?.deposits || 0));
  const shares = BASE_SHARES + (company?.sharesOut || 0);
  return Math.floor(equity * (BASE_SHARES / shares));
}

/** 銀行会社が払える利息の上限（預かり金には手を付けない） */
export function bankPayable(company) {
  return Math.max(0, (company?.capital || 0) - (company?.deposits || 0));
}

export const MIN_BANK_RATE = 0.0005;
export const MAX_BANK_RATE = 0.0040;

export const EDU_REQ_LABEL = ['学歴不問', '高卒以上', '専門卒以上', '大卒以上'];

export function canFound(type, licenses, eduLevel = 0) {
  if ((type.eduReq || 0) > (eduLevel || 0)) {
    return { ok: false, miss: [], edu: true, reason: `${EDU_REQ_LABEL[type.eduReq]} が必要です` };
  }
  const miss = (type.req || []).filter(r => !licenses.includes(r));
  if (miss.length) return { ok: false, miss, reason: '資格が足りません' };
  return { ok: true, miss: [], reason: '' };
}

export const corpTotal = (c) => Math.round((c?.capital || 0));

/* ==========================================================
   求人 — 会社が出す仕事。給料は会社の資産から出る
   ========================================================== */
export const POSTING_GAMES = ['CALC', 'TYPING', 'MEMORY', 'SORT', 'INSPECT', 'WORD', 'CHOICE'];
export const MAX_POSTINGS = 2;            // 1社につき2件まで
export const POST_FEE = 20000;            // 掲載料（会社の資産から）

export const POST_KINDS = {
  PART: { key: 'PART', name: 'アルバイト求人', icon: '🧑‍🍳', cool: 45000, min: 300, max: 8000 },
  FULL: { key: 'FULL', name: '社員求人', icon: '🧑‍💼', cool: 300000, min: 5000, max: 120000 },
};
export const postKindOf = (k) => POST_KINDS[k] || POST_KINDS.PART;

/** 会社が1回の勤務で実際に払える額 */
export function postingPayable(company, pay) {
  return Math.max(0, Math.min(pay, bankPayable(company)));
}

export function validPosting(p) {
  if (!p || !p.name || p.name.length < 2 || p.name.length > 14) return '仕事名は2〜14文字で入力してください';
  const k = postKindOf(p.kind);
  const pay = Math.floor(Number(p.pay) || 0);
  if (pay < k.min || pay > k.max) return `報酬は ${k.min.toLocaleString()}〜${k.max.toLocaleString()} G で設定してください`;
  if (!POSTING_GAMES.includes(p.game)) return '仕事の内容を選んでください';
  return '';
}
