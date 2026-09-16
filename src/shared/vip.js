/* ==========================================================
   VIP 会員
   ========================================================== */

/** VIP券（買い切り）の価格 */
export const VIP_PRICE = 100000;

/** ニュースに書き込めるのは5分に1回 */
export const VIP_NEWS_COOLDOWN = 5 * 60 * 1000;
export const VIP_NEWS_MAX_LEN = 80;

/** VIP限定のスロット高額ベット */
export const VIP_SLOT_BETS = [10000, 50000, 100000];

export const VIP_PERKS = [
  { icon: '👑', title: '背景がゴージャスに', desc: 'ロイヤルゴールドの内装にアップグレード' },
  { icon: '🏅', title: '名前の横に金色のVIP', desc: 'ランキング・ニュース・送金履歴すべてに表示' },
  { icon: '📰', title: 'カジノニュースに直接投稿', desc: '5分に1回、好きな一言を全員のニュース欄へ' },
  { icon: '🎰', title: 'スロットの高額ベット解放', desc: '1ライン 10,000 / 50,000 / 100,000 G まで' },
  { icon: '📊', title: 'みんなの損益を詳しく', desc: '所持金・銀行・ローン・信用度・通算収支まで閲覧' },
  { icon: '🃏', title: 'ブラックジャック解放', desc: 'VIPルームのブラックジャックで遊べる' },
];

/** 定期購入（今は準備中） */
export const VIP_SUBSCRIPTION = {
  price: 20000,
  period: '30日',
  available: false,
};

export const isVip = (v) => v === true;

/** ニュース投稿までの残り時間(ms) */
export function newsCooldownLeft(lastAt) {
  if (!lastAt) return 0;
  return Math.max(0, VIP_NEWS_COOLDOWN - (Date.now() - lastAt));
}
