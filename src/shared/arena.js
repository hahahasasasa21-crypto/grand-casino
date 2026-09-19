import { doc, getDoc, setDoc, onSnapshot, increment, runTransaction } from 'firebase/firestore';
import { db, appId } from './firebase.js';

/* ==========================================================
   スポーツ大国の競技場
   ・この国にカジノはない。かわりに賞金マッチがある
   ・勝敗は「部活の実力 × 今日の出来ばえ」と相手の強さで決まる
   ・賭け金の一部が賞金プールに積まれ、SP（スポルト）の強さになる
   ========================================================== */

export const ARENA_ID = 'ARENA';
export const arenaRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'world', ARENA_ID);

export const emptyArena = () => ({ pool: 0, paid: 0, matches: 0 });

export function normalizeArena(d) {
  const s = d && typeof d === 'object' ? d : {};
  return {
    pool: Math.max(0, Math.round(Number(s.pool) || 0)),
    paid: Math.max(0, Math.round(Number(s.paid) || 0)),
    matches: Math.max(0, Math.floor(Number(s.matches) || 0)),
    updatedAt: Number(s.updatedAt) || 0,
  };
}

export async function ensureArena() {
  try {
    const snap = await getDoc(arenaRef());
    if (!snap.exists()) await setDoc(arenaRef(), { ...emptyArena(), createdAt: Date.now() });
    return true;
  } catch (e) { return false; }
}

export function watchArena(cb) {
  if (typeof cb !== 'function') return () => {};
  try {
    return onSnapshot(arenaRef(), (snap) => {
      try { cb(normalizeArena(snap.exists() ? snap.data() : null)); } catch (e) { /* noop */ }
    }, () => { /* noop */ });
  } catch (e) { return () => {}; }
}

/* ---------- 試合の種類 ---------- */
export const MATCHES = [
  {
    key: 'EXHIB', name: 'エキシビション', icon: '🤝', fee: 5000,
    power: 260, prize: 3.0, cool: 30000,
    desc: '地元のクラブとの親善試合。誰でも出られる。',
  },
  {
    key: 'PRIZE', name: '賞金マッチ', icon: '🏅', fee: 50000,
    power: 1100, prize: 3.4, cool: 60000, minSkill: 300,
    desc: '賞金の出る本番。相手はそれなりに強い。',
  },
  {
    key: 'TITLE', name: 'タイトルマッチ', icon: '👑', fee: 300000,
    power: 3000, prize: 4.2, cool: 180000, minSkill: 1200,
    desc: 'この国の頂点を決める一戦。負ければ何も残らない。',
  },
  {
    key: 'WORLD', name: '世界タイトル戦', icon: '🌍', fee: 2000000,
    power: 8000, prize: 5.0, cool: 600000, minSkill: 3000,
    desc: '世界中の猛者が集まる舞台。勝てば賞金は桁違い。',
  },
];
export const matchOf = (k) => MATCHES.find(m => m.key === k) || MATCHES[0];

/** 賞金の一部（15%）が競技場のプールに積まれる。これが SP の強さになる */
export const ARENA_CUT = 0.15;

export function canFight(m, { club, now = Date.now(), lastAt = 0, balance = 0 }) {
  if (!m) return { ok: false, reason: '試合がありません' };
  if (!club?.key) return { ok: false, reason: '先に部活に入ってください（卒業後も戦績は残ります）' };
  if (m.minSkill && (club.skill || 0) < m.minSkill) {
    return { ok: false, reason: `実力 ${m.minSkill.toLocaleString()} 以上が必要です（いま ${Math.round(club.skill || 0).toLocaleString()}）` };
  }
  const until = (lastAt || 0) + (m.cool || 0);
  if (now < until) return { ok: false, reason: `次の試合まで あと ${Math.ceil((until - now) / 1000)} 秒` };
  if (balance < m.fee) return { ok: false, reason: '参加費が足りません' };
  return { ok: true, reason: '' };
}

/** 自分の強さ。部活の実力と、その日の出来ばえで決まる */
export const myPower = (club, perf) =>
  Math.max(1, Math.round((60 + (club?.skill || 0)) * (0.3 + perf * 1.5) * (1 + (club?.fame || 0) / 12000)));

/** 勝率。強さの比から出す（番狂わせもある） */
export function winChance(mine, theirs) {
  const a = Math.pow(Math.max(1, mine), 1.5);
  const b = Math.pow(Math.max(1, theirs), 1.5);
  return a / (a + b);
}

/** 賞金。勝てば fee × prize、負けても出来がよければ少しだけ出る */
export function payoutOf(m, win, perf) {
  if (win) return Math.round(m.fee * m.prize * (0.75 + perf * 0.45));
  return Math.round(m.fee * 0.25 * Math.max(0, perf - 0.4));
}

/** 競技場の会計に積む（失敗してもゲームは止めない） */
export async function recordMatch(fee, payout) {
  const cut = Math.round(Math.max(0, fee) * ARENA_CUT);
  try {
    await setDoc(arenaRef(), {
      pool: increment(cut),
      paid: increment(Math.max(0, Math.round(payout || 0))),
      matches: increment(1),
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (e) { return false; }
}
