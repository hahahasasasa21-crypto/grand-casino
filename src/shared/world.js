/* ==========================================================
   世界（国）と YUTAPON FLY（航空会社）
   ・プレイヤーは3つの国を行き来する
   ・移動には運賃がかかり、そのお金は YUTAPON FLY の売上として
     みんなで1つの数字に積み上がる
   ・積み上がった売上が「パイロットの給料倍率」になる
     （＝他人がたくさん飛ぶほど、パイロットの給料が上がる）
   ========================================================== */

import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, runTransaction } from 'firebase/firestore';
import { db, appId } from './firebase.js';

/* ==========================================================
   1. 国
   ========================================================== */

export const DEFAULT_COUNTRY = 'HOME';

export const COUNTRIES = [
  {
    key: 'HOME',
    name: 'YUTAPON-GROUP',
    short: 'GROUP',
    icon: '🎰',
    tone: '#fbbf24',
    desc: '本国。YUTAPON-CASINO と YUTAPON-BANK と学校の本拠地。',
    blurb: 'すべての始まりの地。YUTAPON-CASINO も YUTAPON-BANK も学校も、ぜんぶここにある。迷ったら GROUP へ帰れば、たいていのことはできる。',
  },
  {
    key: 'GAMBLE',
    name: 'ギャンブル大国',
    short: 'ギャンブル大国',
    icon: '🎲',
    tone: '#f472b6',
    desc: '賭けのレートが桁違いの国。運賃も一番高い。',
    blurb: '街ごとひとつの巨大カジノ。ここでは賭け金の桁がひとつ違う。入国するだけで GROUP の何倍もの運賃がかかるが、その先にあるのは夢か破産か。',
  },
  {
    key: 'SPORT',
    name: 'スポーツ大国',
    short: 'スポーツ大国',
    icon: '🏟️',
    tone: '#fb7185',
    desc: 'カジノの代わりに競技場がある国。部活とスポーツがすべて。',
    blurb: 'この国にカジノはない。かわりに街のまんなかに巨大な競技場があり、賞金マッチが一日じゅう行われている。学校も部活に全振りしていて、スポーツ推薦の本場でもある。',
  },
  {
    key: 'WORK',
    name: '仕事国',
    short: '仕事国',
    icon: '🏭',
    tone: '#38bdf8',
    desc: '働くための国。大学が4つある。',
    blurb: '朝から晩まで工場と会社が動き続ける国。大学が4つあり、学び直してから働く人も多い。ギャンブルの匂いはしないが、稼いだぶんは確実に残る。',
  },
];

/** キーでも国オブジェクトでも引ける（見つからなければ null） */
export const countryOf = (key) => {
  const k = key && typeof key === 'object' ? key.key : key;
  return COUNTRIES.find((c) => c.key === k) || null;
};
export const countryName = (key) => countryOf(key)?.name || 'どこか';

/* ==========================================================
   2. 運賃と座席クラス
   ========================================================== */

/** VIPは運賃が1割引き */
export const VIP_FARE_MUL = 0.9;

/* ---------- 会社としての YUTAPON-FLY の取り分 ---------- */
export const FLY_COMPANY_SHARE = 0.8;
export const FLY_PILOT_SHARE = 0.2;
export const FLY_START = 3000000000;      // 開業時の資産 30億
/** 運賃は基準の 0.5〜2.5 倍までしか動かせない */
export const FARE_MIN_MUL = 0.5;
export const FARE_MAX_MUL = 2.5;


/** 区間キーは並び順に依存しない（HOME→WORK と WORK→HOME は同じ区間） */
export const segKey = (a, b) => [String(a), String(b)].sort().join('|');

/** 区間ごとの基本運賃（エコノミー1席ぶん） */
export const FARES = {
  'GAMBLE|HOME': 2400000,   // YUTAPON-GROUP ↔ ギャンブル大国（一番高い）
  'GAMBLE|WORK': 1800000,   // ギャンブル大国 ↔ 仕事国
  'HOME|WORK': 900000,      // YUTAPON-GROUP ↔ 仕事国
  'HOME|SPORT': 1200000,    // YUTAPON-GROUP ↔ スポーツ大国
  'GAMBLE|SPORT': 2000000,  // ギャンブル大国 ↔ スポーツ大国
  'SPORT|WORK': 1000000,    // スポーツ大国 ↔ 仕事国
};

/** 表示用の路線一覧 */
export const ROUTES = [
  { a: 'HOME', b: 'GAMBLE', base: FARES['GAMBLE|HOME'] },
  { a: 'HOME', b: 'SPORT', base: FARES['HOME|SPORT'] },
  { a: 'HOME', b: 'WORK', base: FARES['HOME|WORK'] },
  { a: 'GAMBLE', b: 'SPORT', base: FARES['GAMBLE|SPORT'] },
  { a: 'GAMBLE', b: 'WORK', base: FARES['GAMBLE|WORK'] },
  { a: 'SPORT', b: 'WORK', base: FARES['SPORT|WORK'] },
];

/** 運賃の動かせる幅（基準の 0.5〜2.5 倍） */
export function fareBounds(seg) {
  const base = FARES[seg] || 0;
  return { min: Math.round(base * FARE_MIN_MUL), max: Math.round(base * FARE_MAX_MUL), base };
}

/** その区間の基本運賃（定期便が無ければ 0）
    fly を渡すと、YUTAPON-FLY が決めた運賃が優先される */
export function baseFare(from, to, fly = null) {
  if (!from || !to || from === to) return 0;
  const seg = segKey(from, to);
  const set = Number(fly?.fares?.[seg]);
  if (Number.isFinite(set) && set > 0) {
    const b = fareBounds(seg);
    return Math.max(b.min, Math.min(b.max, Math.round(set)));
  }
  return FARES[seg] || 0;
}

export const CLASSES = [
  {
    key: 'ECO',
    name: 'エコノミー',
    code: 'ECO',
    icon: '💺',
    mult: 1,
    ms: 90000,
    exp: 0,
    bonusRate: 0,
    perk: 'いちばん安い席。飛行90秒、機内はドリンクのみ。',
    service: ['ドリンクサービス', '手荷物1個', '座席は普通'],
  },
  {
    key: 'BIZ',
    name: 'ビジネス',
    code: 'BIZ',
    icon: '🥂',
    mult: 2.6,
    ms: 40000,
    exp: 150,
    bonusRate: 0,
    perk: 'フルフラットシートで飛行40秒。到着時に経験値がすこし入る。',
    service: ['フルフラットシート', '機内食（温かい料理）', '到着時に経験値 +150'],
  },
  {
    key: 'FIRST',
    name: 'ファースト',
    code: '1ST',
    icon: '👑',
    mult: 7,
    ms: 0,
    exp: 0,
    bonusRate: 0.03,
    perk: '待ち時間ゼロで即到着。搭乗時にウェルカムギフト（運賃の3％）。',
    service: ['個室スイート', 'シャンパンとコース料理', '搭乗ボーナス：運賃の3％を還元', '待ち時間なしで即到着'],
  },
];

/** キーでもクラスオブジェクトでも引ける（見つからなければエコノミー） */
export const classOf = (key) => {
  const k = key && typeof key === 'object' ? key.key : key;
  return CLASSES.find((c) => c.key === k) || CLASSES[0];
};
export const isClassKey = (key) => CLASSES.some((c) => c.key === key);

/**
 * 運賃。VIPは0.9倍（四捨五入）。
 * @param {string} from 出発地のキー
 * @param {string} to 行き先のキー
 * @param {string} cls 座席クラスのキー
 * @param {boolean} vip VIPかどうか
 */
export function fareOf(from, to, cls, vip = false, fly = null) {
  const base = baseFare(from, to, fly);
  if (!base) return 0;
  const c = classOf(cls);
  return Math.round(base * c.mult * (vip ? VIP_FARE_MUL : 1));
}

/** ファーストクラスの搭乗ボーナス（Yで返る） */
export function boardingBonus(cls, fare) {
  const c = classOf(cls);
  return Math.max(0, Math.round((fare || 0) * (c.bonusRate || 0)));
}

/** 到着時に入る経験値 */
export function arrivalExp(cls) {
  return classOf(cls).exp || 0;
}

/* ==========================================================
   3. シード付き乱数（便名・ゲート番号を毎回同じにする）
   ========================================================== */

export function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 定番の mulberry32。同じ種なら必ず同じ並びになる */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 便名（例：YF 102）。区間とクラスが同じなら毎回同じ便名になる */
export function flightNoOf(from, to, cls) {
  const rnd = mulberry32(hash32(`${segKey(from, to)}#${classOf(cls).key}`));
  const head = from === 'HOME' ? 1 : from === 'GAMBLE' ? 4 : 7;
  const n = head * 100 + Math.floor(rnd() * 98) + 1;
  return `YF ${n}`;
}

/** ゲート番号（例：A12） */
export function gateOf(from, to, cls) {
  const rnd = mulberry32(hash32(`gate:${from}>${to}:${classOf(cls).key}`));
  const row = 'ABCD'[Math.floor(rnd() * 4)];
  const num = 1 + Math.floor(rnd() * 24);
  return `${row}${String(num).padStart(2, '0')}`;
}

/* ==========================================================
   4. プレイヤーの travel
   形： { country, flyingTo, from, arriveAt, departAt, cls, spent, flights, visits, exp }
   ========================================================== */

/** 欠けているところを埋めて、いつでも安全に読める形にする */
export function normalizeTravel(t) {
  const src = t && typeof t === 'object' ? t : {};
  const visits = {};
  for (const c of COUNTRIES) {
    const v = Number(src.visits?.[c.key]);
    visits[c.key] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  const country = countryOf(src.country) ? src.country : DEFAULT_COUNTRY;
  const flyingTo = countryOf(src.flyingTo) ? src.flyingTo : null;
  return {
    country,
    flyingTo,
    from: countryOf(src.from) ? src.from : (flyingTo ? country : null),
    departAt: Number(src.departAt) || 0,
    arriveAt: Number(src.arriveAt) || 0,
    cls: isClassKey(src.cls) ? src.cls : 'ECO',
    spent: Math.max(0, Number(src.spent) || 0),
    flights: Math.max(0, Math.floor(Number(src.flights) || 0)),
    visits,
    exp: Math.max(0, Math.floor(Number(src.exp) || 0)),
  };
}

/** いま空の上か */
export function inFlight(travel, now = Date.now()) {
  const t = travel && typeof travel === 'object' ? travel : {};
  if (!t.flyingTo) return false;
  return now < (Number(t.arriveAt) || 0);
}

/** 着いたのに、まだ到着処理が終わっていない状態 */
export function hasLanded(travel, now = Date.now()) {
  const t = travel && typeof travel === 'object' ? travel : {};
  if (!t.flyingTo) return false;
  return now >= (Number(t.arriveAt) || 0);
}

/** 到着までの残りミリ秒 */
export function flightLeft(travel, now = Date.now()) {
  const t = travel && typeof travel === 'object' ? travel : {};
  if (!t.flyingTo) return 0;
  return Math.max(0, (Number(t.arriveAt) || 0) - now);
}

/** 飛行の進み具合 0〜1 */
export function flightProgress(travel, now = Date.now()) {
  const t = travel && typeof travel === 'object' ? travel : {};
  if (!t.flyingTo) return 0;
  const dep = Number(t.departAt) || 0;
  const arr = Number(t.arriveAt) || 0;
  const span = arr - dep;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (now - dep) / span));
}

/** mm:ss */
export function flightClock(ms) {
  const s = Math.max(0, Math.ceil((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** その便に乗れるか */
export function canFly(travel, from, to, now = Date.now()) {
  const t = normalizeTravel(travel);
  if (!countryOf(to)) return { ok: false, reason: '行き先が見つかりません。' };
  if (inFlight(t, now)) return { ok: false, reason: 'いまは飛行中です。到着までお待ちください。' };
  if (hasLanded(t, now)) return { ok: false, reason: '到着手続きの最中です。すこし待ってください。' };
  const dep = countryOf(from) ? from : t.country;
  if (dep === to) return { ok: false, reason: 'いまいる国へは飛べません。' };
  if (!baseFare(dep, to)) return { ok: false, reason: 'この区間に定期便はありません。' };
  return { ok: true, reason: '' };
}

/* ==========================================================
   5. YUTAPON FLY の会計（全プレイヤー共通の1つの数字）
   ========================================================== */

export const FLY_ID = 'FLY';

/** パイロットの給料倍率の計算に使う目盛り */
export const PILOT_SCALE = 50000000;   // これだけ運賃が積み上がると +1.0
export const PILOT_MAX = 5;            // 上限は5倍

export const flyDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'world', FLY_ID);

/* ---------- 会社としての YUTAPON-FLY ----------
   運賃は 8割が会社の資産に、2割がパイロットの取り分（プール）に入る。
   運航管理の社員は、区間ごとの運賃を決められる（上下の限度つき）。 */

/** 空っぽの会計 */
export const emptyFly = () => ({ spend: 0, flights: 0, assets: 0, pilotPool: 0, pilotPaid: 0, fares: {} });

/** 読み出したデータを安全な形に */
export function normalizeFly(d) {
  const src = d && typeof d === 'object' ? d : {};
  const fares = {};
  for (const k of Object.keys(FARES)) {
    const v = Number(src.fares?.[k]);
    if (Number.isFinite(v) && v > 0) fares[k] = Math.round(v);
  }
  return {
    spend: Math.max(0, Number(src.spend) || 0),
    flights: Math.max(0, Math.floor(Number(src.flights) || 0)),
    assets: Math.round(Number(src.assets) || 0),
    pilotPool: Math.max(0, Math.round(Number(src.pilotPool) || 0)),
    pilotPaid: Math.max(0, Math.round(Number(src.pilotPaid) || 0)),
    fares,
    farePolicyBy: String(src.farePolicyBy || ''),
    farePolicyAt: Number(src.farePolicyAt) || 0,
    updatedAt: Number(src.updatedAt) || 0,
  };
}

/** 会社の総資産（開業時の残高＋増減） */
export const flyTotal = (f) => FLY_START + Math.round(f?.assets || 0);

/** 運賃の動かせる幅 */

/** 会計の文書が無ければ作る（失敗してもゲームは止めない） */
export async function ensureFly() {
  try {
    const ref = flyDocRef();
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...emptyFly(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 1便ぶんの運賃を YUTAPON FLY の売上に足す。
 * お金が動くので必ず increment を使う（同時に何人飛んでも取りこぼさない）。
 * 失敗してもゲームは止めない。
 */
export async function recordFlight(amount) {
  const g = Math.max(0, Math.round(Number(amount) || 0));
  const toPilots = Math.round(g * FLY_PILOT_SHARE);
  const toCompany = g - toPilots;
  const patch = {
    spend: increment(g), flights: increment(1),
    assets: increment(toCompany), pilotPool: increment(toPilots),
    updatedAt: Date.now(),
  };
  try {
    await updateDoc(flyDocRef(), patch);
    return true;
  } catch (e) {
    // まだ文書が無いときだけここに来る。merge で作りながら足す。
    try {
      await setDoc(flyDocRef(), patch, { merge: true });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/**
 * 会計を購読する。cb には { spend, flights } が渡る。
 * 返り値は購読解除の関数（必ず呼べる形で返す）。
 */
/** パイロットの取り分を受け取る。プールにある分しか出ない。実際に払えた額を返す */
export async function claimPilotPay(amount) {
  const want = Math.max(0, Math.round(Number(amount) || 0));
  if (want <= 0) return 0;
  try {
    let paid = 0;
    await runTransaction(db, async (tx) => {
      const ref = flyDocRef();
      const snap = await tx.get(ref);
      const cur = normalizeFly(snap.exists() ? snap.data() : null);
      paid = Math.max(0, Math.min(want, cur.pilotPool));
      if (paid <= 0) return;
      tx.set(ref, {
        pilotPool: increment(-paid), pilotPaid: increment(paid), updatedAt: Date.now(),
      }, { merge: true });
    });
    return paid;
  } catch (e) {
    return 0;
  }
}

/** パイロットの取り分のプールに足す（プレイヤーの航空会社ぶんもここに合流する） */
export async function payPilotPool(amount) {
  const g = Math.max(0, Math.round(Number(amount) || 0));
  if (g <= 0) return false;
  const patch = { pilotPool: increment(g), updatedAt: Date.now() };
  try {
    await updateDoc(flyDocRef(), patch);
    return true;
  } catch (e) {
    try { await setDoc(flyDocRef(), patch, { merge: true }); return true; } catch (e2) { return false; }
  }
}

/** 会社の資産を動かす（社員の給料など） */
export async function flyPayroll(amount) {
  const g = Math.round(Number(amount) || 0);
  if (!g) return false;
  try {
    await setDoc(flyDocRef(), { assets: increment(-g), payroll: increment(g), updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (e) { return false; }
}

/** 運航管理が区間の運賃を決める。上下の限度からはみ出す値は丸める */
export async function setFare(seg, value, by = '') {
  if (!FARES[seg]) return { ok: false, reason: 'その区間はありません' };
  const b = fareBounds(seg);
  const v = Math.max(b.min, Math.min(b.max, Math.round(Number(value) || 0)));
  try {
    // fares は丸ごと読み書きする（ドット記法は merge と相性が悪いので使わない）
    await runTransaction(db, async (tx) => {
      const ref = flyDocRef();
      const snap = await tx.get(ref);
      const cur = normalizeFly(snap.exists() ? snap.data() : null);
      tx.set(ref, {
        fares: { ...cur.fares, [seg]: v },
        farePolicyBy: String(by || ''), farePolicyAt: Date.now(), updatedAt: Date.now(),
      }, { merge: true });
    });
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, reason: '保存できませんでした' };
  }
}

export function watchFly(cb) {
  if (typeof cb !== 'function') return () => {};
  try {
    return onSnapshot(
      flyDocRef(),
      (snap) => {
        try { cb(normalizeFly(snap.exists() ? snap.data() : null)); } catch (e) { /* noop */ }
      },
      () => { /* 読めなくてもゲームは続ける */ },
    );
  } catch (e) {
    return () => {};
  }
}

/**
 * パイロットの給料倍率。
 * 世界じゅうの移動で消費された Y が積み上がるほど上がる（最大5倍）。
 */
export function pilotMultiplier(flySpend) {
  return 1 + Math.min(PILOT_MAX - 1, (Number(flySpend) || 0) / PILOT_SCALE);
}

/** 次の倍率まであといくら運賃が必要か（表示用） */
export function pilotNextStep(flySpend) {
  const spend = Math.max(0, Number(flySpend) || 0);
  const cap = PILOT_SCALE * (PILOT_MAX - 1);
  if (spend >= cap) return 0;
  const nextWhole = Math.floor(spend / PILOT_SCALE) + 1;
  return Math.max(0, Math.min(cap, nextWhole * PILOT_SCALE) - spend);
}
