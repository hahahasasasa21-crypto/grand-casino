/* ==========================================================
   学校 — 高校10校・大学10校・専門学校4校
   一覧は上ほどやさしく、下へ行くほど頭が良い（YUTAPON系が最下段）
   ・入学金と授業料（1コマごと）がかかる。VIPは0.9倍
   ・高校は決まった順に授業を受け、最後まで行くと卒業
   ・難関校の入試には ⚡フラッシュ暗算 が出る
   ・学校ごとに企業からの推薦がある（易化／ボーダー低下／試験免除）
   ========================================================== */

import { SUBJECTS, ALL_SUBJECTS } from './subjects.js';

export const RETRY_MS = 60 * 60 * 1000;      // 落ちたら1時間
export const EXAM_EVERY = 4;                  // 何コマごとに定期テストか
export const VIP_TUITION = 0.9;               // VIPの学費割引

const S = (...k) => k;
const R = (target, type, amount, gpa) => ({ target, type, amount, gpa });
const RG = (group, type, amount, gpa) => ({ target: group, group: true, type, amount, gpa });

/* ---------------- 高校（上ほどやさしい） ---------------- */
export const HIGH_SCHOOLS = [
  {
    key: 'YAKAN', name: '夜間定時制高校', icon: '🌙', course: '定時制', dev: 36,
    entry: 20000, tuition: 1200, lessons: 10, uniBonus: 0,
    subjects: S('JP', 'MATH', 'ENG'),
    pass: { base: 0.36, min: 0.18, max: 0.55 },
    desc: '働きながらでも通える。学費がいちばん安い。', perk: '高卒の資格が取れる',
    recs: [],
  },
  {
    key: 'WAKABA', name: '若葉総合高校', icon: '🌱', course: '総合学科', dev: 44,
    entry: 45000, tuition: 2400, lessons: 10, uniBonus: 1,
    subjects: S('JP', 'MATH', 'PE', 'ART', 'ECON'),
    pass: { base: 0.48, min: 0.25, max: 0.66 },
    desc: '好きなことを選んで学べる。', perk: '大学入試に +1',
    recs: [R('SALES', 'EASY')],
  },
  {
    key: 'MIDORI', name: '緑ヶ丘高校', icon: '🍃', course: '普通科', dev: 48,
    entry: 60000, tuition: 3000, lessons: 12, uniBonus: 2,
    subjects: S('JP', 'MATH', 'ENG', 'ART', 'PE'),
    pass: { base: 0.55, min: 0.30, max: 0.72 },
    desc: 'のんびりした校風。', perk: '大学入試に +2',
    recs: [R('SALES', 'LINE', 0.16)],
  },
  {
    key: 'SAKURA', name: '桜丘高校', icon: '🌸', course: '普通科', dev: 52,
    entry: 80000, tuition: 3800, lessons: 12, uniBonus: 3,
    subjects: S('JP', 'MATH', 'ENG', 'HIST', 'PE'),
    pass: { base: 0.62, min: 0.38, max: 0.78 },
    desc: '校風が自由で行事が多い。', perk: '大学入試に +3',
    recs: [R('CLERK', 'EASY'), R('SALES', 'LINE', 0.18)],
  },
  {
    key: 'HOKURYO', name: '北稜情報高校', icon: '🖥️', course: '情報科', dev: 53,
    entry: 90000, tuition: 4200, lessons: 12, uniBonus: 3,
    subjects: S('PROG', 'MATH', 'SCI', 'ENG', 'JP'),
    pass: { base: 0.66, min: 0.42, max: 0.80 },
    desc: '一年生からコードを書く。', perk: '大学入試に +3',
    recs: [R('CLERK', 'LINE', 0.20)],
  },
  {
    key: 'MINATO', name: '港国際高校', icon: '🌏', course: '国際科', dev: 54,
    entry: 90000, tuition: 4200, lessons: 12, uniBonus: 4,
    subjects: S('ENG', 'GRAM', 'JP', 'HIST', 'JHIST'),
    pass: { base: 0.68, min: 0.45, max: 0.82 },
    desc: '英語漬けの3年間。語学系の大学に強い。', perk: '大学入試に +4',
    recs: [R('CLERK', 'LINE', 0.20)],
  },
  {
    key: 'KORYO', name: '工陵工業高校', icon: '🔧', course: '工業科', dev: 57,
    entry: 100000, tuition: 4500, lessons: 12, uniBonus: 4,
    subjects: S('TECH', 'SCI', 'MATH', 'PROG', 'JP'),
    pass: { base: 0.70, min: 0.48, max: 0.84 },
    desc: '製図と機械。手を動かして覚える。', perk: '大学入試に +4／工業系に強い',
    recs: [R('SECURITY', 'EASY'), R('SECURITY', 'LINE', 0.16)],
  },
  {
    key: 'CHUO_COM', name: '中央商業高校', icon: '🧾', course: '商業科', dev: 58,
    entry: 100000, tuition: 4500, lessons: 12, uniBonus: 4,
    subjects: S('COMM', 'MATH', 'ECON', 'JP', 'PROG'),
    pass: { base: 0.70, min: 0.48, max: 0.84 },
    desc: '簿記と計算の実務を叩き込む。', perk: '大学入試に +4／商業系に強い',
    recs: [R('CLERK', 'SKIP'), R('ACCOUNT', 'EASY')],
  },
  {
    key: 'DAIICHI', name: '第一高校', icon: '🎌', course: '普通科', dev: 66,
    entry: 150000, tuition: 6000, lessons: 14, uniBonus: 7, flash: 3,
    subjects: S('JP', 'MATH', 'ENG', 'GRAM', 'HIST', 'JHIST', 'SCI'),
    pass: { base: 0.80, min: 0.62, max: 0.90 },
    desc: '県内屈指の進学校。入試に ⚡フラッシュ暗算 が出る。', perk: '大学入試に +7',
    recs: [R('CIVIL', 'LINE', 0.18), R('CLERK', 'SKIP')],
  },
  {
    key: 'YUTA_HS', name: 'YUTAPON付属高校', icon: '🏯', course: '特進科', dev: 76,
    entry: 400000, tuition: 12000, lessons: 16, uniBonus: 12, flash: 5,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.93, min: 0.84, max: 0.97 },
    desc: '全科目を最高水準で学ぶ、この国の頂点の高校。入試の ⚡フラッシュ暗算 は最高難度。',
    perk: '全科目を履修。大学入試に +12 の下駄',
    recs: [R('CIVIL', 'SKIP'), R('SECURITY', 'SKIP'), R('CLERK', 'SKIP'), R('SALES', 'SKIP')],
  },
];

/* ---------------- 大学（上ほどやさしい） ---------------- */
export const UNIVERSITIES = [
  {
    key: 'CORP_UNI', name: '企業総合大学', icon: '🏢', dev: 47,
    entry: 200000, tuition: 8000, lessons: 14,
    subjects: S('ECON', 'JP', 'ENG', 'COMM', 'PE'),
    pass: { base: 0.44, min: 0.22, max: 0.62 },
    desc: 'いちばん入りやすい大学。企業と組んだ実務教育が売り。', perk: '学費が安く入りやすい',
    recs: [R('SALES', 'SKIP'), R('CLERK', 'LINE', 0.18)],
  },
  {
    key: 'JOHO', name: '情報科学大学', icon: '💻', dev: 55,
    entry: 320000, tuition: 13000, lessons: 16,
    subjects: S('PROG', 'MATH', 'SCI', 'ENG', 'JP'),
    pass: { base: 0.56, min: 0.32, max: 0.72 },
    desc: '情報系に全振りしたカリキュラム。', perk: 'IT系に強い',
    recs: [R('CODER', 'LINE', 0.20)],
  },
  {
    key: 'KOKUSAI', name: '国際教養大学', icon: '🌐', dev: 57,
    entry: 350000, tuition: 14000, lessons: 16,
    subjects: S('ENG', 'GRAM', 'HIST', 'JHIST', 'JP', 'ECON'),
    pass: { base: 0.58, min: 0.34, max: 0.74 },
    desc: '授業の多くが英語で行われる。', perk: '語学・国際系に強い',
    recs: [R('TEACHER', 'LINE', 0.20)],
  },
  {
    key: 'KOKA', name: '工科大学', icon: '⚙️', dev: 59,
    entry: 380000, tuition: 15000, lessons: 16,
    subjects: S('SCI', 'TECH', 'MATH', 'PROG', 'JP'),
    pass: { base: 0.60, min: 0.36, max: 0.76 },
    desc: 'ものづくりの研究に強い。', perk: '工学・技術に強い',
    recs: [R('ARCHITECT', 'LINE', 0.20), R('SECURITY', 'SKIP')],
  },
  {
    key: 'KAIO', name: '海王大学', icon: '💹', dev: 61,
    entry: 400000, tuition: 16000, lessons: 16,
    subjects: S('ECON', 'MATH', 'COMM', 'JP', 'ENG'),
    pass: { base: 0.62, min: 0.38, max: 0.78 },
    desc: '経済学部が看板。金融に強い。', perk: '経済・商業に強い',
    recs: [R('ACCOUNT', 'SKIP'), R('TRADER', 'EASY')],
  },
  {
    key: 'CHUO_UNI', name: '中央総合大学', icon: '🎓', dev: 63,
    entry: 700000, tuition: 24000, lessons: 17,
    subjects: S('JP', 'ENG', 'HIST', 'JHIST', 'ECON', 'MATH'),
    pass: { base: 0.66, min: 0.42, max: 0.82 },
    desc: '海王大学の一段上。総合大学として厚みがあり、学費も相応に高い。',
    perk: '公務員に強い',
    recs: [R('CIVIL', 'SKIP'), R('TEACHER', 'LINE', 0.20)],
  },
  {
    key: 'TEITO', name: '帝都大学', icon: '🏛️', dev: 67,
    entry: 900000, tuition: 30000, lessons: 18,
    subjects: S('JP', 'MATH', 'ENG', 'GRAM', 'HIST', 'JHIST', 'ECON', 'SCI'),
    pass: { base: 0.72, min: 0.50, max: 0.86 },
    desc: '総合力の名門。どの業界にも卒業生がいる。', perk: '幅広い学問を学べる',
    recs: [R('LAWYER', 'EASY'), R('DOCTOR', 'EASY'), R('CIVIL', 'SKIP'), R('TEACHER', 'SKIP')],
  },
  {
    key: 'CASINO_UNI', name: 'カジノ大学', icon: '🎲', dev: 74, flash: 3,
    entry: 1500000, tuition: 45000, lessons: 18, rec: 'CASINO', recGpa: 4.5, backdoor: 60000000,
    subjects: S('MATH', 'ECON', 'COMM', 'HIST', 'JP', 'PROG'),
    pass: { base: 0.90, min: 0.78, max: 0.95 },
    desc: '銀行研究大学と同格。入試に ⚡フラッシュ暗算 あり。桁違いの寄付金を積めば学力不問で入れる。',
    perk: 'YUTAPON-CASINO からの推薦（GPA 4.5 で試験免除・銀行より狭き門）／裏口入学あり',
    recs: [RG('CASINO', 'SKIP', 0, 4.5), RG('CASINO', 'LINE', 0.16), R('DEALERJOB', 'SKIP')],
  },
  {
    key: 'BANK_UNI', name: '銀行研究大学', icon: '🏦', dev: 74, flash: 3, calcAuto: true,
    entry: 2000000, tuition: 55000, lessons: 18, rec: 'BANK', recGpa: 4.3,
    subjects: S('MATH', 'COMM', 'ECON', 'PROG', 'JP', 'ENG'),
    pass: { base: 0.90, min: 0.78, max: 0.95 },
    desc: 'YUTAPON大学の一段下。入試に ⚡フラッシュ暗算 あり。学費はこの国で最も高い。',
    perk: 'YUTAPON-BANK の推薦（GPA 4.3 で試験免除）／研究者の推薦／計算系の職はほぼ確実',
    recs: [
      RG('BANK', 'SKIP', 0, 4.3), RG('BANK', 'LINE', 0.14),
      R('SCIENTIST', 'LINE', 0.22), R('SCIENTIST', 'EASY'),
      { target: 'CALC', calcGroup: true, type: 'LINE', amount: 0.45 },
      R('ACCOUNT', 'SKIP'), R('TRADER', 'SKIP'),
    ],
  },
  {
    key: 'YUTA_UNI', name: 'YUTAPON大学', icon: '👑', dev: 80, flash: 5,
    entry: 1200000, tuition: 40000, lessons: 20, rec: 'BOTH', recGpa: 4.0,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.95, min: 0.88, max: 0.98 },
    desc: 'この世界の最高学府。全学問を修める。入試の ⚡フラッシュ暗算 は最高難度。',
    perk: 'GPA 4.0 以上で卒業すると YUTAPON-BANK と YUTAPON-CASINO の採用試験が免除。届かなくても採用が大幅に有利',
    recs: [
      RG('BANK', 'SKIP', 0, 4.0), RG('CASINO', 'SKIP', 0, 4.0),
      RG('BANK', 'LINE', 0.22), RG('CASINO', 'LINE', 0.22),
      { target: 'ALL', all: true, type: 'SKIP' },
    ],
  },
];

/* ---------------- 専門学校（高いところは目指せないが免除が多い） ---------------- */
export const VOCATIONALS = [
  {
    key: 'VOC_COOK', name: '調理専門学校', icon: '🍳', dev: 40,
    entry: 120000, tuition: 5000, lessons: 8, grant: 'COOK',
    subjects: S('PE', 'ART', 'JP'),
    pass: { base: 0.42, min: 0.20, max: 0.60 },
    desc: '2年で現場に出る。卒業で調理師免許がもらえる。',
    perk: '卒業すると 🍳調理師免許 ／ 調理師・販売スタッフは試験免除',
    recs: [R('CHEF', 'SKIP'), R('SALES', 'SKIP')],
  },
  {
    key: 'VOC_DESIGN', name: 'デザイン専門学校', icon: '🎨', dev: 41,
    entry: 140000, tuition: 5800, lessons: 8, grant: 'QC',
    subjects: S('ART', 'TECH', 'JP'),
    pass: { base: 0.44, min: 0.22, max: 0.62 },
    desc: '色と形の基礎から実制作まで。',
    perk: '卒業すると 🔍品質管理士 ／ 警備主任・販売スタッフは試験免除',
    recs: [R('SECURITY', 'SKIP'), R('SALES', 'SKIP')],
  },
  {
    key: 'VOC_ACC', name: '医療事務専門学校', icon: '🏥', dev: 42,
    entry: 130000, tuition: 5500, lessons: 8, grant: 'BOOK',
    subjects: S('COMM', 'JP', 'MATH'),
    pass: { base: 0.45, min: 0.22, max: 0.63 },
    desc: 'レセプトと簿記を実践的に。',
    perk: '卒業すると 📒簿記2級 ／ 経理・事務員は試験免除',
    recs: [R('ACCOUNT', 'SKIP'), R('CLERK', 'SKIP')],
  },
  {
    key: 'VOC_IT', name: '情報処理専門学校', icon: '🖧', dev: 45,
    entry: 150000, tuition: 6000, lessons: 8, grant: 'IT',
    subjects: S('PROG', 'MATH', 'SCI'),
    pass: { base: 0.48, min: 0.24, max: 0.66 },
    desc: '手を動かして現場の技術を学ぶ。',
    perk: '卒業すると 💻情報処理技術者 ／ 事務員・警備主任は試験免除',
    recs: [R('CLERK', 'SKIP'), R('SECURITY', 'SKIP'), R('ACCOUNT', 'EASY')],
  },
];

export const ALL_SCHOOLS = [
  ...HIGH_SCHOOLS.map(s => ({ ...s, kind: 'HIGH' })),
  ...UNIVERSITIES.map(s => ({ ...s, kind: 'UNI' })),
  ...VOCATIONALS.map(s => ({ ...s, kind: 'VOC' })),
];
export const schoolOf = (key) => ALL_SCHOOLS.find(s => s.key === key) || null;
export const kindLabel = { HIGH: '高校', UNI: '大学', VOC: '専門学校' };

/* ---------------- カリキュラム ---------------- */
export function curriculumOf(school) {
  if (!school) return [];
  const out = [];
  const subs = school.subjects || ['JP'];
  for (let i = 0; i < school.lessons; i++) {
    const kind = ((i + 1) % EXAM_EVERY === 0) ? 'EXAM' : 'LESSON';
    out.push({ i, subject: subs[i % subs.length], kind });
  }
  out.push({ i: school.lessons, subject: subs[0], kind: 'FINAL' });
  return out;
}
export const totalSteps = (school) => (school ? school.lessons + 1 : 0);

/* ---------------- 学力と偏差値 ---------------- */
/** 自分の偏差値。授業で貯めた学力・資格の数・出身高校・塾やお守りで決まる */
export function myDeviation(edu = {}, licenses = [], prepBonus = 0) {
  let d = 36;
  d += Math.min(14, (licenses?.length || 0) * 1.8);
  d += Math.min(14, (edu.study || 0) * 0.010);
  const hs = edu.hs;
  if (hs?.graduated) {
    const hsInfo = schoolOf(hs.key);
    d += (hsInfo?.uniBonus || 0);
    d += (hs.gpa || 0) * 1.4;
  }
  const uni = edu.uni;
  if (uni?.graduated) d += 6 + (uni.gpa || 0) * 1.2;
  d += prepBonus || 0;
  return Math.round(d * 10) / 10;
}

/** 入試の合格ライン。偏差値が上回るほど下がるが、下限と上限がある */
export function admissionLine(school, myDev) {
  if (!school) return 1;
  const gap = myDev - school.dev;
  const adj = gap >= 0 ? -gap * 0.006 : -gap * 0.005;
  const raw = school.pass.base + adj;
  return Math.max(school.pass.min, Math.min(school.pass.max, Math.round(raw * 1000) / 1000));
}

/** 受験できるか。backdoor（寄付金入学）は学力も高卒条件も再受験待ちも飛ばせる */
export function canEnroll(school, edu = {}, now = Date.now(), opts = {}) {
  const slot = school.kind === 'HIGH' ? 'hs' : school.kind === 'UNI' ? 'uni' : 'voc';
  const cur = edu[slot];
  if (cur && !cur.graduated && cur.key === school.key) return { ok: false, reason: '在学中です' };
  if (cur && !cur.graduated) return { ok: false, reason: `${kindLabel[school.kind]}に在学中です（先に卒業を）` };
  if (cur && cur.graduated && cur.key === school.key) return { ok: false, reason: '卒業済みです' };
  // ほかの学校に在学中なら受けられない（学校はひとつずつ）
  for (const k of ['hs', 'voc', 'uni']) {
    if (k !== slot && edu[k] && !edu[k].graduated) return { ok: false, reason: '別の学校に在学中です' };
  }
  if (opts.backdoor) return { ok: true, reason: '' };
  if (school.kind === 'UNI' && !edu.hs?.graduated) return { ok: false, reason: '高校を卒業している必要があります' };
  const until = (edu.retryAt || {})[school.key] || 0;
  if (now < until) return { ok: false, reason: `再受験まで あと ${Math.ceil((until - now) / 60000)} 分` };
  return { ok: true, reason: '' };
}

/* ---------------- 学歴 ---------------- */
export function eduLevelOf(edu = {}) {
  if (edu.uni?.graduated) return 3;
  if (edu.voc?.graduated) return 2;
  if (edu.hs?.graduated) return 1;
  return 0;
}
export const EDU_NAME = ['学歴なし', '高卒', '専門卒', '大卒'];

/** 学位のタグ（プロフィールで名前の横に付けられる） */
export function degreeTags(edu = {}) {
  const out = [];
  if (edu.hs?.graduated) {
    const s = schoolOf(edu.hs.key);
    if (s) out.push({ key: `HS_${s.key}`, label: `${s.icon}${s.name}卒`, color: '#93c5fd' });
  }
  if (edu.voc?.graduated) {
    const s = schoolOf(edu.voc.key);
    if (s) out.push({ key: `VOC_${s.key}`, label: `${s.icon}${s.name}卒`, color: '#5eead4' });
  }
  if (edu.uni?.graduated) {
    const s = schoolOf(edu.uni.key);
    if (s) out.push({ key: `UNI_${s.key}`, label: `${s.icon}${s.name}卒（GPA ${(edu.uni.gpa || 0).toFixed(1)}）`, color: '#fbbf24' });
  }
  return out;
}

/* ---------------- 推薦・試験免除 ---------------- */
export const REC_LABEL = {
  EASY: { name: '問題が易しくなる', icon: '📗', color: '#60a5fa' },
  LINE: { name: '合格ボーダーが下がる', icon: '📘', color: '#34d399' },
  SKIP: { name: '試験が免除される', icon: '📕', color: '#fbbf24' },
};

function recMatches(rec, career) {
  if (!career) return false;
  if (rec.all) return true;
  if (rec.group) return career.group === rec.target;
  if (rec.calcGroup) return !!career.calcJob && !career.group;
  return rec.target === career.key;
}

/** 卒業した学校から来ている推薦をまとめる */
export function recommendPerk(edu = {}, career) {
  const out = { skip: false, ease: 0, diffDown: 0, notes: [], from: [] };
  if (!career) return out;
  for (const slot of ['hs', 'voc', 'uni']) {
    const r = edu[slot];
    if (!r?.graduated) continue;
    const s = schoolOf(r.key);
    if (!s?.recs) continue;
    for (const rec of s.recs) {
      if (!recMatches(rec, career)) continue;
      if (rec.gpa && (r.gpa || 0) < rec.gpa) continue;
      if (rec.type === 'SKIP') { out.skip = true; out.notes.push(`${s.icon}${s.name} の推薦で採用試験は免除`); }
      else if (rec.type === 'LINE') {
        const a = rec.amount ?? 0.18;
        if (a > out.ease) { out.ease = a; out.notes.push(`${s.icon}${s.name} の推薦で合格ライン -${Math.round(a * 100)}pt`); }
      } else if (rec.type === 'EASY') {
        const a = rec.amount ?? 1;
        if (a > out.diffDown) { out.diffDown = a; out.notes.push(`${s.icon}${s.name} の推薦で問題が易しくなる`); }
      }
      out.from.push(s.key);
    }
  }
  // 大卒そのものの下駄（推薦がないときだけ）
  if (!out.skip && out.ease === 0 && edu.uni?.graduated) {
    out.ease = Math.min(0.12, 0.02 + (edu.uni.gpa || 0) * 0.02);
    out.notes.push('大卒として少し優遇されます');
  }
  return out;
}
/** 旧名のまま呼んでいるところ用 */
export const admissionPerk = recommendPerk;

/** 学校ごとの推薦一覧（学校カードに出す） */
export function recsOf(school) {
  return (school?.recs || []).map(r => ({
    ...r,
    label: REC_LABEL[r.type],
    who: r.all ? 'すべての職種' : r.group ? (r.target === 'BANK' ? 'YUTAPON-BANK' : 'YUTAPON-CASINO')
      : r.calcGroup ? '計算系の職種' : r.target,
  }));
}

/* ---------------- 学費（VIPは0.9倍） ---------------- */
export const entryFee = (school, vip) => Math.round((school?.entry || 0) * (vip ? VIP_TUITION : 1));
export const tuitionFee = (school, vip) => Math.round((school?.tuition || 0) * (vip ? VIP_TUITION : 1));

/* ---------------- 入試に出るゲーム ---------------- */
/** 難関校は ⚡フラッシュ暗算。YUTAPON系だけ最高難度 */
export function entranceTask(school) {
  if (school?.flash) {
    return { game: 'FLASH', subject: 'MATH', diff: school.flash };
  }
  const sub = school?.subjects?.[0] || 'JP';
  return { game: SUBJECTS[sub]?.game || 'CHOICE', subject: sub, diff: Math.max(1, Math.min(5, Math.round((school.dev - 34) / 9))) };
}

/* ---------------- 塾 ---------------- */
export const CRAM_COURSES = [
  { key: 'LIGHT', name: '個別指導（60分）', icon: '📗', cost: 12000, bonus: 1.5, hours: 1, desc: '偏差値 +1.5（1時間）' },
  { key: 'STD', name: '受験対策コース', icon: '📘', cost: 45000, bonus: 4, hours: 2, desc: '偏差値 +4（2時間）＋出そうな問題を4問' },
  { key: 'INTENSIVE', name: '直前合宿', icon: '📕', cost: 160000, bonus: 9, hours: 3, desc: '偏差値 +9（3時間）＋出そうな問題を8問' },
];
export const cramOf = (k) => CRAM_COURSES.find(c => c.key === k) || null;

/** いま効いている塾・アイテムの下駄 */
export function prepBonusOf(prep = {}, items = {}, now = Date.now()) {
  let b = 0;
  if (prep.until && now < prep.until) b += prep.bonus || 0;
  if ((items.LUCKY_CHARM || 0) > 0) b += 2;     // お守りは持っているだけで少し
  return Math.round(b * 10) / 10;
}
