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
  { icon: '🎰', title: 'スロットの高額ベット解放', desc: '1ライン 10,000 / 50,000 / 100,000 G まで' },
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
  FULL_SCOPE: {
    key: 'FULL_SCOPE', icon: '🔍', name: '能力スコープ', price: 20000, vipOnly: true,
    desc: '選んだ1頭の スピード・体力・オッズ・スキル をまとめて開示します。',
    short: '1頭の全情報を開示',
  },
  CHARM: {
    key: 'CHARM', icon: '🍀', name: '幸運のお守り', price: 8000, vipOnly: true,
    desc: 'そのレースのあいだ、コインでの情報開示が 半額 になります。',
    short: '情報開示が半額',
  },
};
export const ITEM_LIST = Object.values(ITEMS);
