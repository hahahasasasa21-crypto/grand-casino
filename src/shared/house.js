import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, appId } from './firebase';

/* ==========================================================
   YUTAPON グループ金庫
   YUTAPON-BANK と YUTAPON-CASINO は同じ金庫を共有する。

   資産（bankAssets）が動くルール
   ・預けられたら   … 上がる
   ・引き出されたら … 下がる
   ・貸したとき     … 動かない（現金が債権に変わるだけ）
   ・返済されたとき … 動かない（元本ぶん）
   ・ローンの利息   … 上がる
   ・預金の利息     … 下がる（銀行が払うので）
   ・起業した会社の法人税 … 上がる
   ・カジノでプレイヤーが負けた … 上がる（勝たれたら下がる）
   ・VIP・ショップの売上 … 上がる
   ========================================================== */

/* 1.8京。Number の安全整数を超えるので、金庫は「開業時の残高＋増減の合計」で持つ。
   増減（net）だけを保存すれば、何円動いても1円の誤差も出ない。 */
export const HOUSE_START = 180000000000000000;
export const HOUSE_ID = 'YUTAPON';

export const houseRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'house', HOUSE_ID);

const ZERO = {
  v: 2,
  bankAssets: 0,        // 開業時からの増減（表示は HOUSE_START + これ）
  depositFlow: 0,      // 預かり純増
  loansOut: 0,         // 貸出残高（資産には足さない）
  interestEarned: 0,   // ローン利息の累計
  interestPaid: 0,     // 預金利息の支払い累計
  corpTax: 0,          // 法人税の累計
  casinoTake: 0,       // カジノの通算収支（プレイヤーの負けぶん）
  shopTake: 0,         // ショップ・VIPの売上
  loanApproved: 0,     // 行員が承認した件数
  loanRejected: 0,
};

let ensured = false;
export async function ensureHouse() {
  if (ensured) return;
  try {
    const snap = await getDoc(houseRef());
    if (!snap.exists()) await setDoc(houseRef(), { ...ZERO, createdAt: Date.now() });
    else if ((snap.data().v || 1) < 2) {
      // 旧方式（残高そのものを保存）から、増減だけを持つ方式に移行
      await setDoc(houseRef(), { ...snap.data(), ...ZERO, migratedAt: Date.now() });
    }
    ensured = true;
  } catch (e) { /* noop */ }
}

/** すべて increment なので、同時に何人が触っても壊れない */
async function bump(patch) {
  try {
    await ensureHouse();
    const inc = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!v) continue;
      inc[k] = increment(v);
    }
    if (Object.keys(inc).length === 0) return;
    inc.updatedAt = Date.now();
    await updateDoc(houseRef(), inc);
  } catch (e) { /* 金庫の記録に失敗してもプレイは止めない */ }
}

export const houseDeposit = (amount) => bump({ bankAssets: amount, depositFlow: amount });
export const houseWithdraw = (amount) => bump({ bankAssets: -amount, depositFlow: -amount });
export const houseLend = (amount) => bump({ loansOut: amount });
export const houseRepay = (amount) => bump({ loansOut: -amount });
export const houseLoanInterest = (amount) => bump({ bankAssets: amount, interestEarned: amount, loansOut: amount });
export const houseDepositInterest = (amount) => bump({ bankAssets: -amount, interestPaid: amount, depositFlow: amount });
export const houseCorpTax = (amount) => bump({ bankAssets: amount, corpTax: amount });
export const houseShop = (amount) => bump({ bankAssets: amount, shopTake: amount });
/** delta > 0 … プレイヤーが負けた（金庫が増える） */
export const houseCasino = (delta) => bump({ bankAssets: delta, casinoTake: delta });
export const houseLoanReview = (ok) => bump(ok ? { loanApproved: 1 } : { loanRejected: 1 });
/** 社員に払う給料・手当（金庫から出ていく） */
export const housePayroll = (amount) => bump({ bankAssets: -amount, payroll: amount });

/** 金庫の総資産（開業時の残高＋増減＋貸出債権） */
export const houseTotal = (h) => HOUSE_START + Math.round((h?.bankAssets || 0) + (h?.loansOut || 0));
/** 開業時からの純増減 */
export const houseNet = (h) => Math.round(h?.bankAssets || 0);

/** 桁が大きいので「1.8京」のように読める形にする */
export function bigYen(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e16) return `${sign}${(abs / 1e16).toFixed(2)}京`;
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}兆`;
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}億`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(1)}万`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}
