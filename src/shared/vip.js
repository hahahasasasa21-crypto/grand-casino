/* ==========================================================
   VIP会員・ショップ・相場まわりの定数
   ========================================================== */

/* ---------- VIP ---------- */
export const VIP_PRICE = 100000;               // 買い切り
export const VIP_SUB_PRICE = 20000;            // 定期購入（30日ごと）
export const VIP_SUB_DAYS = 30;
export const VIP_SUB_MS = VIP_SUB_DAYS * 24 * 3600 * 1000;

export const VIP_NEWS_COOLDOWN = 5 * 60 * 1000;
export const VIP_NEWS_MAX_LEN = 80;
export const VIP_SLOT_BETS = [10000, 50000, 100000];

export const VIP_PERKS = [
  { icon: '👑', title: '背景がゴージャスに', desc: 'ロイヤルゴールドの内装にアップグレード' },
  { icon: '🏅', title: '名前の横に金色のVIP', desc: 'ランキング・ニュース・ポーカーの席札に表示' },
  { icon: '📰', title: 'カジノニュースに直接投稿', desc: '5分に1回、好きな一言を全員のニュース欄へ' },
  { icon: '🎰', title: 'スロットの高額ベット解放', desc: '1ライン 10,000 / 50,000 / 100,000 Y まで' },
  { icon: '📊', title: 'みんなの損益を詳しく', desc: '所持金・銀行・ローン・信用度・通算収支まで閲覧' },
  { icon: '🃏', title: 'ブラックジャック解放', desc: 'VIPルームのブラックジャックで遊べる' },
  { icon: '🛍️', title: 'VIP限定アイテム', desc: 'ショップに会員専用の道具が並ぶ' },
];

/* ---------- ローン延滞 ---------- */
/** 借入からこの時間を過ぎても完済しないと「延滞」 */
export const DELINQUENT_MS = 6 * 3600 * 1000;   // 6時間

export function loanState(loanBalance, loanStartAt) {
  if (!loanBalance || loanBalance <= 0 || !loanStartAt) {
    return { delinquent: false, left: 0, elapsed: 0 };
  }
  const elapsed = Date.now() - loanStartAt;
  return { delinquent: elapsed >= DELINQUENT_MS, left: Math.max(0, DELINQUENT_MS - elapsed), elapsed };
}

/** 実際にVIP特典が使えるか（延滞中は一時停止） */
export function effectiveVip({ vip, vipSubUntil, delinquent }) {
  const owned = vip === true;
  const subbed = !!vipSubUntil && Date.now() < vipSubUntil;
  return (owned || subbed) && !delinquent;
}
export function hasVipPlan({ vip, vipSubUntil }) {
  return vip === true || (!!vipSubUntil && Date.now() < vipSubUntil);
}

/* ---------- 金（ゴールド）相場 ---------- */
export const GOLD_BASE = 10000;          // 基準価格
const GOLD_SCALE = 1000000;              // 総利益がこれだけ動くと 1.0 変動
const GOLD_MIN_MUL = 0.4, GOLD_MAX_MUL = 4.0;
export const GOLD_SELL_RATE = 0.97;      // 売値は買値の97%

/** プレイヤー全員の通算利益の合計から金の相場を決める */
export function goldPrice(totalProfit) {
  const mul = Math.max(GOLD_MIN_MUL, Math.min(GOLD_MAX_MUL, 1 + (totalProfit || 0) / GOLD_SCALE));
  return Math.max(100, Math.round(GOLD_BASE * mul / 10) * 10);
}
export const goldSellPrice = (p) => Math.floor(p * GOLD_SELL_RATE);

/* ---------- 消耗アイテム ---------- */
export const ITEMS = {
  ODDS_TICKET: {
    key: 'ODDS_TICKET', icon: '🎫', name: 'オッズ一括開示券', price: 5000, vipOnly: false,
    desc: '競馬で 全頭のオッズ と人気順を一度に開示します（1レースにつき1枚）。',
    short: '全頭のオッズを開示',
  },
  SKILL_BOOK: {
    key: 'SKILL_BOOK', icon: '📜', name: 'スキル名鑑', price: 15000, vipOnly: true,
    desc: '競馬で 全頭のスキル をまとめて開示します（1レースにつき1枚）。',
    short: '全頭のスキルを開示',
  },
  /* ---- 受験まわり ---- */
  AKAHON: {
    key: 'AKAHON', icon: '📕', name: '大学受験 赤本', price: 30000, vipOnly: false, cat: 'STUDY',
    desc: '使うと 4科目ぶんの「出そうな問題」 を読み込めます。必ず出るとは限りません。',
    short: '予想問題を4科目ぶん',
  },
  AKAHON_PRO: {
    key: 'AKAHON_PRO', icon: '📙', name: '最難関大 予想問題集', price: 120000, vipOnly: false, cat: 'STUDY',
    desc: '使うと 全科目ぶんの「出そうな問題」 を読み込めます。YUTAPON大学の受験生御用達。',
    short: '予想問題を全科目ぶん',
  },
  LUCKY_CHARM: {
    key: 'LUCKY_CHARM', icon: '⛩️', name: '合格祈願のお守り', price: 400000, vipOnly: true, cat: 'STUDY',
    passive: true, unique: true,
    desc: 'VIP限定・買い切り。持っているあいだ 偏差値 +4。ただし入試を1回でも受けると（受かっても落ちても）効果が切れて無くなります。同時に持てるのは1つだけ。',
    short: '偏差値+4／入試1回で消える',
  },
  LAUNDER_HS: {
    key: 'LAUNDER_HS', icon: '🧼', name: '学歴ロンダリング（高校）', price: 3000000, vipOnly: false, cat: 'STUDY',
    desc: '高校の学歴を消します。もう一度ちがう高校を受け直したいときに。とても高価です。',
    short: '高校の学歴を消す',
  },
  LAUNDER_UNI: {
    key: 'LAUNDER_UNI', icon: '🧽', name: '学歴ロンダリング（大学）', price: 12000000, vipOnly: false, cat: 'STUDY',
    desc: '大学の学歴を消します。上の大学に入り直したいときに。桁違いに高価です。',
    short: '大学の学歴を消す',
  },
  AGENT: {
    key: 'AGENT', icon: '🤝', name: '転職エージェント', price: 180000, vipOnly: false, cat: 'WORK',
    desc: '使った次の採用試験では、転職を繰り返したことによる不利がなくなります。',
    short: '転職の不利を打ち消す',
  },
};

/* ---------- 買えるタグ ---------- */
export const TAG_ITEMS = [
  {
    key: 'RICH_LORD', icon: '🎩', name: '「大富豪」の称号', price: 3000000000, vipOnly: true,
    label: '🎩大富豪', color: '#fde68a',
    desc: 'VIP限定。名前の横に付けられる最上級の称号。値段も最上級。',
  },
];
export const tagItemOf = (k) => TAG_ITEMS.find(t => t.key === k) || null;

/* ---------- プロフィールのアイコン ---------- */
export const ICONS = [
  { key: 'FREE_1', icon: '🙂', name: 'ふつう', price: 0 },
  { key: 'FREE_2', icon: '😎', name: 'サングラス', price: 0 },
  { key: 'FREE_3', icon: '🐱', name: 'ねこ', price: 0 },
  { key: 'COIN', icon: '🪙', name: 'コイン', price: 3000 },
  { key: 'CARD', icon: '🃏', name: 'ジョーカー', price: 8000 },
  { key: 'HORSE', icon: '🐎', name: 'サラブレッド', price: 12000 },
  { key: 'DIAMOND', icon: '💎', name: 'ダイヤ', price: 30000 },
  { key: 'ROCKET', icon: '🚀', name: 'ロケット', price: 45000 },
  { key: 'GRAD', icon: '🎓', name: '学士帽', price: 60000 },
  { key: 'BANKICON', icon: '🏦', name: '銀行家', price: 90000 },
  { key: 'CROWN', icon: '👑', name: '王冠', price: 200000 },
  { key: 'DRAGON', icon: '🐉', name: '龍', price: 500000 },
  { key: 'YUTA', icon: '🌟', name: 'YUTAPON', price: 1500000 },
];
export const iconOf = (k) => ICONS.find(i => i.key === k) || ICONS[0];
export const ITEM_LIST = Object.values(ITEMS);
