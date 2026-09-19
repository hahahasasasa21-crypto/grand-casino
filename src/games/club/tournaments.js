/* ==========================================================
   大会 — 甲子園・総合大会・全国大会
   ・通信：ほかのプレイヤーの部活データを読んで出場校をつくる
   ・同じ高校の人は味方（チーム力に加算）
   ・ほかの高校の人は敵（そのままトーナメントに並ぶ）
   ・出場校が足りないぶんは、実在の学校名を使った NPC 校で埋める
   ========================================================== */

import { clubOf } from './clubs.js';
import { ALL_SCHOOLS, schoolOf } from '../school/schools.js';

/* ---------- 乱数（シード付き・引き直し不可） ---------- */
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 大会の定義 ---------- */
export const TOURNAMENTS = [
  {
    key: 'KOSHIEN', name: '全国高校野球選手権（甲子園）', short: '甲子園', icon: '⚾',
    kind: 'HIGH', only: ['BASEBALL'], rounds: 4, fee: 30000, prize: 2400000,
    cool: 20 * 60 * 1000,
    desc: '高校野球部だけが出られる、いちばん有名な大会。勝ち上がるほど名声が跳ね上がる。',
    fameWin: 260, fameLose: 30,
  },
  {
    key: 'INTERHIGH', name: '全国高校総合体育大会（インターハイ）', short: '総合大会', icon: '🏅',
    kind: 'HIGH', clubKind: 'SPORT', rounds: 4, fee: 20000, prize: 1500000,
    cool: 15 * 60 * 1000,
    desc: '高校の運動部が競技ごとに全国で戦う。同じ高校の部員は味方としてチーム力に加わる。',
    fameWin: 180, fameLose: 24,
  },
  {
    key: 'SOBUN', name: '全国高等学校総合文化祭（総文祭）', short: '総文祭', icon: '🎭',
    kind: 'HIGH', clubKind: 'CULTURE', rounds: 3, fee: 15000, prize: 1100000,
    cool: 15 * 60 * 1000,
    desc: '高校の文化部の全国大会。吹奏楽も将棋もここで日本一が決まる。',
    fameWin: 150, fameLose: 20,
  },
  {
    key: 'UNIV', name: '全日本大学選手権', short: '大学選手権', icon: '🏆',
    kind: 'UNI', rounds: 4, fee: 60000, prize: 4200000,
    cool: 20 * 60 * 1000,
    desc: '大学のサークル・体育会の全国大会。高校より一段レベルが高い。',
    fameWin: 300, fameLose: 40,
  },
  {
    key: 'WORLD', name: '世界選手権', short: '世界選手権', icon: '🌍',
    kind: 'ANY', rounds: 5, fee: 300000, prize: 26000000, minSkill: 2400,
    cool: 45 * 60 * 1000,
    desc: '実力 2,400 以上だけが挑める、国の枠を越えた舞台。ここで勝てばプロの道がひらく。',
    fameWin: 900, fameLose: 120,
  },
];
export const tournamentOf = (k) => TOURNAMENTS.find(t => t.key === k) || null;

/** その部活・その学歴でこの大会に出られるか */
export function canEnter(t, { club, school, now = Date.now(), lastAt = 0 }) {
  if (!t) return { ok: false, reason: '大会がありません' };
  if (!club?.key) return { ok: false, reason: '先に部活に入ってください' };
  if (!school) return { ok: false, reason: '学校に在籍している必要があります' };
  const c = clubOf(club.key);
  if (t.only && !t.only.includes(club.key)) {
    return { ok: false, reason: `${t.only.map(k => clubOf(k)?.name).join('・')} だけが出られます` };
  }
  if (t.clubKind && c?.kind !== t.clubKind) {
    return { ok: false, reason: t.clubKind === 'SPORT' ? '運動部だけが出られます' : '文化部だけが出られます' };
  }
  if (t.kind === 'HIGH' && school.kind !== 'HIGH') return { ok: false, reason: '高校生の大会です' };
  if (t.kind === 'UNI' && school.kind !== 'UNI') return { ok: false, reason: '大学生の大会です' };
  if (t.minSkill && (club.skill || 0) < t.minSkill) {
    return { ok: false, reason: `実力 ${t.minSkill.toLocaleString()} 以上が必要です（いま ${Math.round(club.skill || 0).toLocaleString()}）` };
  }
  const until = (lastAt || 0) + (t.cool || 0);
  if (now < until) return { ok: false, reason: `次の大会まで あと ${Math.ceil((until - now) / 60000)} 分` };
  return { ok: true, reason: '' };
}

/* ---------- 出場校をつくる ---------- */

/** プレイヤー一覧から、この大会に出てくる「学校」を組み立てる。
    players … [{ name, club, edu, vip }]（App から渡す生のプレイヤー行）
    me      … 自分の名前 */
export function buildField(t, { players = [], me, myClub, mySchool, seed }) {
  const clubKey = myClub?.key;
  const rnd = mulberry32(hash32(`${t.key}|${clubKey}|${seed}`));
  const slot = mySchool?.kind === 'HIGH' ? 'hs' : mySchool?.kind === 'UNI' ? 'uni' : 'voc';

  /* 同じ部活をやっている実在プレイヤーを集める */
  const real = [];
  for (const p of players) {
    if (!p?.name || p.name === me) continue;
    const pc = p.club;
    if (!pc || pc.key !== clubKey) continue;
    const rec = p?.edu?.[slot];
    if (!rec || rec.graduated) continue;                // 在学中だけ
    const sc = schoolOf(rec.key);
    if (!sc) continue;
    if (t.kind === 'HIGH' && sc.kind !== 'HIGH') continue;
    if (t.kind === 'UNI' && sc.kind !== 'UNI') continue;
    real.push({ name: p.name, schoolKey: rec.key, skill: pc.skill || 0, fame: pc.fame || 0, vip: !!p.vip });
  }

  /* 自分の学校のチーム（同じ高校の人は味方） */
  const mates = real.filter(r => r.schoolKey === mySchool?.key);
  const myTeam = {
    schoolKey: mySchool.key, name: mySchool.name, icon: mySchool.icon,
    mine: true,
    members: [{ name: me, skill: myClub.skill || 0, fame: myClub.fame || 0, me: true }, ...mates],
  };

  /* ほかの学校のチーム */
  const bySchool = new Map();
  for (const r of real) {
    if (r.schoolKey === mySchool?.key) continue;
    if (!bySchool.has(r.schoolKey)) bySchool.set(r.schoolKey, []);
    bySchool.get(r.schoolKey).push(r);
  }
  const rivals = [...bySchool.entries()].map(([k, members]) => {
    const s = schoolOf(k);
    return { schoolKey: k, name: s?.name || k, icon: s?.icon || '🏫', members, real: true };
  });

  /* 足りないぶんは NPC 校で埋める（同じ国・同じ種別の学校から） */
  const size = Math.pow(2, t.rounds);
  const pool = ALL_SCHOOLS.filter(s =>
    s.kind === mySchool.kind &&
    s.key !== mySchool.key &&
    !bySchool.has(s.key) &&
    (s.clubs || []).includes(clubKey));
  const npc = [];
  const shuffled = [...pool].sort(() => rnd() - 0.5);
  for (let i = 0; npc.length < Math.max(0, size - 1 - rivals.length); i++) {
    const s = shuffled[i % Math.max(1, shuffled.length)] || { key: `NPC${i}`, name: `第${i + 1}高校`, icon: '🏫', dev: 50, clubPower: 1 };
    const dup = i >= shuffled.length ? ` ${String.fromCharCode(65 + Math.floor(i / Math.max(1, shuffled.length)))}` : '';
    npc.push({
      schoolKey: `${s.key}${dup}`, name: `${s.name}${dup}`, icon: s.icon, npc: true,
      members: [], npcPower: npcPower(s, t, rnd),
    });
    if (npc.length > 64) break;
  }

  const field = [myTeam, ...rivals, ...npc].slice(0, size);
  // シードを散らす
  const ordered = [];
  const rest = field.slice(1).sort(() => rnd() - 0.5);
  ordered.push(field[0]);
  rest.forEach(x => ordered.push(x));
  return ordered;
}

/** NPC 校の強さ。学校の偏差値と部活の強さで決まる */
function npcPower(school, t, rnd) {
  const base = (school.dev || 50) * 9 * (school.clubPower || 1);
  const swing = 0.65 + rnd() * 0.8;
  const stage = t.kind === 'UNI' ? 1.5 : t.key === 'WORLD' ? 3.2 : 1;
  return Math.round(base * swing * stage);
}

/** チーム力。自分の出来ばえ（perf）は自分のぶんだけに掛かる */
export function teamPower(team, club, perf = 1) {
  if (team.npc) return team.npcPower;
  const c = clubOf(club) || { team: 1 };
  const s = schoolOf(team.schoolKey);
  const cap = Math.max(1, c.team || 1);
  // 上位の部員から順に、頭数ぶんだけ数える（多すぎても無限には強くならない）
  const sorted = [...team.members].sort((a, b) => (b.skill || 0) - (a.skill || 0)).slice(0, cap);
  let p = 0;
  sorted.forEach((m, i) => {
    const w = 1 / (1 + i * 0.35);                   // 2人目以降は効きが落ちる
    const boost = m.me ? (0.35 + perf * 1.15) : 1;  // 自分の今日の出来
    p += (m.skill || 0) * w * boost;
  });
  // 部員が定員に足りないぶんは学校の部の地力で補う
  const missing = Math.max(0, cap - sorted.length);
  p += missing * 70 * (s?.clubPower || 1);
  return Math.max(1, Math.round(p));
}

/** 1試合。強さの比から勝率を出す（番狂わせも起きる） */
export function playMatch(a, b, rnd) {
  const pa = Math.max(1, a.power), pb = Math.max(1, b.power);
  const w = Math.pow(pa, 1.6) / (Math.pow(pa, 1.6) + Math.pow(pb, 1.6));
  const aWin = rnd() < w;
  // スコアも作る（見た目のため）
  const gap = Math.abs(w - 0.5) * 2;
  const hi = 1 + Math.floor(rnd() * (2 + gap * 7));
  const lo = Math.max(0, Math.floor(hi - 1 - rnd() * (1 + gap * 5)));
  return { aWin, score: aWin ? [hi, lo] : [lo, hi], odds: w };
}

/** トーナメントをぜんぶ回す。自分が負けたところで止めずに、最後まで結果を作る */
export function runTournament(t, field, club, perf, seed) {
  const rnd = mulberry32(hash32(`${t.key}|${seed}|run`));
  let teams = field.map(f => ({ ...f, power: teamPower(f, club, perf) }));
  const rounds = [];
  let myRound = 0;
  let myOut = false;
  let champion = null;

  while (teams.length > 1) {
    const pairs = [];
    for (let i = 0; i < teams.length; i += 2) {
      const a = teams[i], b = teams[i + 1];
      if (!b) { pairs.push({ a, b: null, aWin: true, score: [0, 0], bye: true }); continue; }
      const r = playMatch(a, b, rnd);
      pairs.push({ a, b, ...r });
    }
    rounds.push(pairs);
    const next = pairs.map(p => (p.aWin ? p.a : p.b));
    const stillIn = next.some(x => x?.mine);
    if (!myOut) {
      if (stillIn) myRound++;
      else { myOut = true; }
    }
    teams = next;
  }
  champion = teams[0] || null;
  const won = !!champion?.mine;
  const totalRounds = rounds.length;
  return { rounds, champion, won, myRound, totalRounds };
}

/** 勝ち上がった段階の呼び名 */
export function roundName(total, idx) {
  const left = total - idx;
  if (left === 1) return '決勝';
  if (left === 2) return '準決勝';
  if (left === 3) return '準々決勝';
  return `${Math.pow(2, left)}回戦`;
}

/** 賞金と名声 */
export function rewardOf(t, myRound, total, won) {
  const ratio = total > 0 ? myRound / total : 0;
  const prize = won ? t.prize : Math.round(t.prize * Math.pow(ratio, 2.2) * 0.45);
  const fame = won
    ? t.fameWin
    : Math.max(t.fameLose, Math.round(t.fameLose + (t.fameWin - t.fameLose) * Math.pow(ratio, 1.8)));
  return { prize: Math.max(0, prize), fame };
}
