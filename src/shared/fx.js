import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, appId } from './firebase.js';

/* ==========================================================
   通貨と為替
   ・国ごとに紙幣がちがう
       YUTAPON-GROUP … Y（ユタ）       ＝ 基軸通貨
       ギャンブル大国 … BC（ベットチップ）
       スポーツ大国   … SP（スポルト）
       仕事国         … WD（ワークダラー）
   ・レートは「その国がどれだけ儲かっているか」で動く。
     カジノが儲ければ BC が上がり、会社が儲ければ WD が上がる。
   ・両替には手数料（スプレッド）がかかる。VIP は半額。
   ・レートは誰が見ても同じ数字になるよう、金庫と会社の数字から計算する
     （ランダムな値は使わない）。
   ========================================================== */

export const BASE_CURRENCY = 'Y';

export const CURRENCIES = [
  {
    code: 'Y', name: 'ユタ', country: 'HOME', icon: '🪙', symbol: 'Y',
    color: '#fbbf24', base: 1,
    desc: 'YUTAPON-GROUP の通貨。世界の基軸通貨で、レートの基準になる。',
  },
  {
    code: 'BC', name: 'ベットチップ', country: 'GAMBLE', icon: '🎟️', symbol: 'BC',
    color: '#f472b6', base: 2.5,
    desc: 'ギャンブル大国の紙幣。カジノが儲かるほど強くなる。もともと高い。',
  },
  {
    code: 'SP', name: 'スポルト', country: 'SPORT', icon: '🏅', symbol: 'SP',
    color: '#fb7185', base: 1.4,
    desc: 'スポーツ大国の紙幣。競技場の賞金が動くほど強くなる。',
  },
  {
    code: 'WD', name: 'ワークダラー', country: 'WORK', icon: '💵', symbol: 'WD',
    color: '#38bdf8', base: 0.6,
    desc: '仕事国の紙幣。会社の売上と法人税が増えるほど強くなる。安いぶん貯めやすい。',
  },
];

export const currencyOf = (code) => CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
export const currencyOfCountry = (country) => CURRENCIES.find(c => c.country === country) || CURRENCIES[0];
export const FOREIGN = CURRENCIES.filter(c => c.code !== BASE_CURRENCY);

/* ---------- 為替手数料 ---------- */
export const SPREAD = 0.02;        // 片道 2%
export const VIP_SPREAD = 0.01;    // VIP は 1%
export const spreadOf = (vip) => (vip ? VIP_SPREAD : SPREAD);

/* ---------- 国ごとの景気 ----------
   house … YUTAPON グループの金庫（bankAssets / casinoTake / corpTax / shopTake）
   companies … プレイヤーが作った会社の一覧
   fly … YUTAPON-FLY の会計
   arena … スポーツ大国の競技場の会計
   数字はどれも「ゲームの中で実際に動いたお金」なので、
   誰かが大負けしたり、会社が伸びたりすると、そのまま為替に出る。 */
export function economyOf({ house, companies = [], fly, arena } = {}) {
  const h = house || {};
  const corpCapital = companies.reduce((a, c) => a + (c.capital || 0), 0);
  const corpRevenue = companies.reduce((a, c) => a + (c.revenue || 0), 0);
  return {
    // 本国：金庫の増減とショップ売上（＋ YUTAPON-FLY の資産）
    HOME: (h.bankAssets || 0) * 0.35 + (h.shopTake || 0) + (fly?.assets || 0) * 0.5,
    // ギャンブル大国：カジノの通算収支（プレイヤーが負けるほど上がる）
    GAMBLE: (h.casinoTake || 0),
    // 仕事国：会社の資本と売上、そして法人税
    WORK: corpCapital * 0.5 + corpRevenue + (h.corpTax || 0) * 2,
    // スポーツ大国：競技場で動いた賞金
    SPORT: (arena?.pool || 0) * 3 + (arena?.paid || 0),
  };
}

/** 景気 → 紙幣の強さ（0.40 〜 1.80）。極端に振れないよう tanh でならす */
export const ECON_SCALE = 300000000;     // 3億 動くと、だいたい端まで振れる
export function strengthOf(econ = 0) {
  const t = Math.tanh((Number(econ) || 0) / ECON_SCALE);
  return Math.round((1 + t * 0.6) * 10000) / 10000;   // 0.4 〜 1.6
}

/** すべての通貨の「1単位あたり何 Y か」 */
export function ratesOf(ctx) {
  const econ = economyOf(ctx);
  const sHome = strengthOf(econ.HOME);
  const out = {};
  for (const c of CURRENCIES) {
    if (c.code === BASE_CURRENCY) { out[c.code] = 1; continue; }
    const s = strengthOf(econ[c.country] || 0);
    // 自国が強く、本国が弱いほど、その紙幣は Y に対して高くなる
    out[c.code] = Math.max(0.0001, Math.round(c.base * (s / Math.max(0.2, sHome)) * 10000) / 10000);
  }
  return out;
}

/** 1単位 = 何 Y か */
export const rateOf = (code, ctx) => (code === BASE_CURRENCY ? 1 : ratesOf(ctx)[code] || 1);

/** 外貨 → Y／Y → 外貨（手数料なしの理論値） */
export const toG = (amount, code, ctx) => Math.round((Number(amount) || 0) * rateOf(code, ctx));
export const fromG = (g, code, ctx) => Math.floor((Number(g) || 0) / rateOf(code, ctx));

/** 買うとき（Y を払って外貨を得る）の実効レート。手数料ぶん高くつく */
export const buyRate = (code, ctx, vip) => rateOf(code, ctx) * (1 + spreadOf(vip));
/** 売るとき（外貨を渡して Y を得る）の実効レート。手数料ぶん安く買い取られる */
export const sellRate = (code, ctx, vip) => rateOf(code, ctx) * (1 - spreadOf(vip));

/** Y をいくら払えば、その外貨を n 単位買えるか */
export const costToBuy = (n, code, ctx, vip) => Math.ceil((Number(n) || 0) * buyRate(code, ctx, vip));
/** その外貨を n 単位売ると、Y がいくらになるか */
export const gainToSell = (n, code, ctx, vip) => Math.floor((Number(n) || 0) * sellRate(code, ctx, vip));

/* ---------- 財布 ---------- */
export function normalizeWallet(w = {}) {
  const out = {};
  for (const c of FOREIGN) out[c.code] = Math.max(0, Math.floor(Number(w?.[c.code]) || 0));
  return out;
}
/** 外貨も Y に直した総額（長者番付などで使う） */
export function walletValue(w, ctx) {
  const wl = normalizeWallet(w);
  let g = 0;
  for (const c of FOREIGN) g += (wl[c.code] || 0) * rateOf(c.code, ctx);
  return Math.round(g);
}

/* ---------- 表示 ---------- */
export function fmtMoney(n, code = 'Y') {
  const c = currencyOf(code);
  return `${Math.round(Number(n) || 0).toLocaleString()} ${c.symbol}`;
}
/** レートの見た目（1 BC = 2.85 Y のように） */
export function rateLabel(code, ctx) {
  const r = rateOf(code, ctx);
  return `1 ${currencyOf(code).symbol} = ${r.toFixed(4)} Y`;
}

/* ---------- 値動きの履歴（画面のグラフ用） ----------
   時刻をシードにして、そのときの景気からレートをさかのぼって描くのではなく、
   保存された履歴をそのまま使う。履歴は App 側で一定間隔に積む。 */
export const HISTORY_MAX = 48;
export function pushHistory(hist = [], rates = {}, at = Date.now()) {
  const row = { at, ...Object.fromEntries(CURRENCIES.map(c => [c.code, rates[c.code] ?? 1])) };
  return [...hist, row].slice(-HISTORY_MAX);
}
/** 直近の変化率（％）。履歴が足りないときは 0 */
export function changeOf(hist = [], code = 'Y') {
  if (!Array.isArray(hist) || hist.length < 2) return 0;
  const a = hist[0]?.[code], b = hist[hist.length - 1]?.[code];
  if (!a || !b) return 0;
  return Math.round(((b - a) / a) * 10000) / 100;
}


/* ---------- 為替の記録（みんなで同じグラフを見る） ---------- */
export const FX_ID = 'FX';
export const FX_TICK_MS = 60 * 1000;      // 1分に1回だけ記録する
export const fxDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'world', FX_ID);

export async function ensureFx() {
  try {
    const snap = await getDoc(fxDocRef());
    if (!snap.exists()) await setDoc(fxDocRef(), { hist: [], lastAt: 0, createdAt: Date.now() });
    return true;
  } catch (e) { return false; }
}

export function watchFx(cb) {
  if (typeof cb !== 'function') return () => {};
  try {
    return onSnapshot(fxDocRef(), (snap) => {
      const d = snap.exists() ? snap.data() : null;
      const hist = Array.isArray(d?.hist) ? d.hist.slice(-HISTORY_MAX) : [];
      try { cb({ hist, lastAt: Number(d?.lastAt) || 0 }); } catch (e) { /* noop */ }
    }, () => { /* 読めなくてもゲームは続く */ });
  } catch (e) { return () => {}; }
}

/** いまのレートを1本だけ記録する。前回から FX_TICK_MS 経っていなければ何もしない */
export async function tickFx(ctx, prev = { hist: [], lastAt: 0 }) {
  const now = Date.now();
  if (now - (prev.lastAt || 0) < FX_TICK_MS) return false;
  try {
    const rates = ratesOf(ctx);
    const hist = pushHistory(prev.hist || [], rates, now);
    await setDoc(fxDocRef(), { hist, lastAt: now, updatedAt: now }, { merge: true });
    return true;
  } catch (e) { return false; }
}
