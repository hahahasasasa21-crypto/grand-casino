import { careerOf, rankOf, EDU } from '../games/work/jobs.js';
import { schoolOf, eduLevelOf } from '../games/school/schools.js';

/* ==========================================================
   信用度
   ・預けたから上がる、ではない。口座を持ってからの「時間」で少しずつ育つ
   ・そこに 学歴 と 就職先 のボーナスが大きく乗る
   ・延滞や踏み倒しは、育てた土台のほうを削る
   表示される信用度 ＝ 土台（時間で育つ）＋ 学歴 ＋ 就職先
   ========================================================== */

export const CREDIT_BASE = 100;                  // 口座を作ったときの土台
export const CREDIT_INTERVAL = 10 * 60 * 1000;   // 10分ごとに
export const CREDIT_PER_TICK = 1;                // +1 ずつ
export const CREDIT_MAX_PERIODS = 12;            // 離れていたぶんも、まとめて最大12回まで
export const CREDIT_AGE_CAP = 180;               // 時間だけで伸びるのはここまで

/** 時間で増えるぶん。いまの土台と最後に数えた時刻から、何回ぶん増えるかを出す */
export function creditTicks(base = CREDIT_BASE, lastAt = 0, now = Date.now()) {
  if (!lastAt) return { periods: 0, gain: 0, nextAt: now };
  const periods = Math.min(CREDIT_MAX_PERIODS, Math.floor((now - lastAt) / CREDIT_INTERVAL));
  if (periods <= 0) return { periods: 0, gain: 0, nextAt: lastAt };
  const room = Math.max(0, CREDIT_AGE_CAP - (base || 0));
  const gain = Math.min(room, periods * CREDIT_PER_TICK);
  return { periods, gain, nextAt: lastAt + periods * CREDIT_INTERVAL };
}

/* ---------- 学歴のボーナス（大幅） ---------- */
export function eduCredit(edu = {}) {
  let v = 0;
  const lv = eduLevelOf(edu);
  if (lv >= 1) v += 10;          // 高卒
  if (lv >= 2) v += 12;          // 専門卒（高卒ぶんに上乗せ）
  if (lv >= 3) v += 25;          // 大卒（さらに上乗せ）

  const hs = edu.hs;
  if (hs?.graduated) {
    const s = schoolOf(hs.key);
    if (s) v += Math.max(0, (s.dev - 34) * 0.35) + (hs.gpa || 0) * 2.5;
  }
  const voc = edu.voc;
  if (voc?.graduated) v += 6 + (voc.gpa || 0) * 2;
  const uni = edu.uni;
  if (uni?.graduated) {
    const s = schoolOf(uni.key);
    if (s) v += Math.max(0, (s.dev - 40) * 1.1) + (uni.gpa || 0) * 7;
    if (uni.backdoor) v -= 12;   // 寄付金入学は信用にならない
  }
  return Math.round(v);
}

/** 学歴ボーナスの内訳（画面の説明用） */
export function eduCreditLines(edu = {}) {
  const out = [];
  const lv = eduLevelOf(edu);
  if (lv >= 1) out.push({ label: '高卒', value: 10 });
  if (lv >= 2) out.push({ label: '専門卒', value: 12 });
  if (lv >= 3) out.push({ label: '大卒', value: 25 });
  const hs = edu.hs, uni = edu.uni, voc = edu.voc;
  if (hs?.graduated) {
    const s = schoolOf(hs.key);
    if (s) out.push({ label: `${s.icon}${s.name}（GPA ${(hs.gpa || 0).toFixed(1)}）`, value: Math.round(Math.max(0, (s.dev - 34) * 0.35) + (hs.gpa || 0) * 2.5) });
  }
  if (voc?.graduated) {
    const s = schoolOf(voc.key);
    out.push({ label: `${s?.icon || '📘'}${s?.name || '専門学校'}`, value: Math.round(6 + (voc.gpa || 0) * 2) });
  }
  if (uni?.graduated) {
    const s = schoolOf(uni.key);
    if (s) out.push({ label: `${s.icon}${s.name}（GPA ${(uni.gpa || 0).toFixed(1)}）`, value: Math.round(Math.max(0, (s.dev - 40) * 1.1) + (uni.gpa || 0) * 7) });
    if (uni.backdoor) out.push({ label: '寄付金入学', value: -12 });
  }
  return out;
}

/* ---------- 就職先のボーナス（大幅） ---------- */
export function jobCredit(job) {
  const c = careerOf(job?.key);
  if (!c) return 0;
  let v = Math.min(55, Math.round((c.salary || 0) / 380));   // 給料の水準
  v += (job.rank || 0) * 7;                                  // 役職
  if (c.group) v += 30;                                      // YUTAPON-GROUP の社員
  if (c.steady) v += 15;                                     // 公務員は景気に左右されない
  if (c.volatile) v -= 8;                                    // 当たり外れの大きい仕事は少し不利
  return Math.max(0, Math.round(v));
}

export function jobCreditLines(job) {
  const c = careerOf(job?.key);
  if (!c) return [];
  const out = [{ label: `${c.icon}${c.name}`, value: Math.min(55, Math.round((c.salary || 0) / 380)) }];
  if ((job.rank || 0) > 0) out.push({ label: `役職（${rankOf(job.rank).name}）`, value: (job.rank || 0) * 7 });
  if (c.group) out.push({ label: 'YUTAPON-GROUP 社員', value: 30 });
  if (c.steady) out.push({ label: '安定した職', value: 15 });
  if (c.volatile) out.push({ label: '浮き沈みの大きい職', value: -8 });
  return out;
}

/* ---------- まとめ ---------- */
export const CREDIT_MAX = 999;
export function effectiveCredit({ base = CREDIT_BASE, edu = {}, job = null } = {}) {
  const v = (base || 0) + eduCredit(edu) + jobCredit(job);
  return Math.max(0, Math.min(CREDIT_MAX, Math.round(v)));
}

/** 相手の行（長者番付など）から信用度を出す */
export const creditOfRow = (p) => effectiveCredit({ base: p?.creditScore ?? CREDIT_BASE, edu: p?.edu, job: p?.job });

/* ---------- 格付け ---------- */
export const creditLabel = (s) =>
  s >= 300 ? 'SSS' : s >= 230 ? 'AAA' : s >= 170 ? 'AA' : s >= 100 ? 'A'
    : s >= 80 ? 'BBB' : s >= 60 ? 'BB' : s >= 40 ? 'B' : 'CCC';

export const creditColor = (s) =>
  s >= 230 ? 'text-fuchsia-300' : s >= 170 ? 'text-emerald-400' : s >= 100 ? 'text-yellow-400'
    : s >= 60 ? 'text-orange-400' : 'text-red-400';
