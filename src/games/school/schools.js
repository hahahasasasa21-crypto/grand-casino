/* ==========================================================
   学校 — 4つの国の 高校17校・大学18校・専門学校4校
   一覧は上ほどやさしく、下へ行くほど頭が良い（各国の最高峰が最下段）
   ・入学金と授業料（1コマごと）がかかる。VIPは0.9倍
   ・授業で学んだ範囲が、そのあとの定期テストに出る
   ・定員がある（平均5人）。埋まっていると入れない
   ・学校ごとに 企業の推薦 と 大学からの推薦 がある
   ・部活がある。多い学校と少ない学校がある
   ========================================================== */

import { SUBJECTS, ALL_SUBJECTS } from './subjects.js';

export const RETRY_MS = 60 * 60 * 1000;      // 落ちたら1時間
export const EXAM_EVERY = 4;                  // 何コマごとに定期テストか
export const VIP_TUITION = 0.9;               // VIPの学費割引
export const DEFAULT_CAP = 5;                 // 定員の平均

const S = (...k) => k;
const R = (target, type, amount, gpa) => ({ target, type, amount, gpa });
const RG = (group, type, amount, gpa) => ({ target: group, group: true, type, amount, gpa });
/** 大学からの推薦（高校カードに出る） */
const U = (uni, type, amount, gpa) => ({ uni, type, amount, gpa });

/* 部活のセット（多い学校・少ない学校をつくるため） */
const CLUB_FULL = ['BASEBALL', 'SOCCER', 'BASKET', 'VOLLEY', 'TRACK', 'SWIM', 'TENNIS', 'PINGPONG', 'BADMINTON',
  'KENDO', 'JUDO', 'KYUDO', 'KARATE', 'RUGBY', 'HANDBALL', 'BOXING', 'GYMNAST', 'FENCING', 'GOLF', 'ESPORTS',
  'BRASS', 'ART', 'LIGHTMUSIC', 'PHOTO', 'DRAMA', 'SHODO', 'SHOGI', 'IGO', 'QUIZ', 'SCIENCE', 'LITERATURE',
  'BROADCAST', 'KARUTA', 'ROBOT', 'COOKING', 'DANCE'];
const CLUB_BIG = ['BASEBALL', 'SOCCER', 'BASKET', 'VOLLEY', 'TRACK', 'SWIM', 'TENNIS', 'PINGPONG', 'BADMINTON',
  'KENDO', 'JUDO', 'BRASS', 'ART', 'LIGHTMUSIC', 'DRAMA', 'SHOGI', 'QUIZ', 'SCIENCE'];
const CLUB_MID = ['BASEBALL', 'SOCCER', 'BASKET', 'TENNIS', 'TRACK', 'BRASS', 'ART', 'SHOGI', 'QUIZ'];
const CLUB_FEW = ['TRACK', 'PINGPONG', 'SHOGI', 'LITERATURE'];
const CLUB_TINY = ['PINGPONG', 'SHOGI'];

/* ---------------- 高校（上ほどやさしい） ---------------- */
export const HIGH_SCHOOLS = [
  {
    key: 'ZATSU_HS', name: '雑学付属高校', icon: '🧩', course: '雑学科', dev: 34, country: 'WORK', cap: 8,
    entry: 12000, tuition: 800, lessons: 10, uniBonus: 0,
    subjects: S('JP', 'MATH', 'HIST'),
    pass: { base: 0.30, min: 0.14, max: 0.50 },
    desc: '仕事国のいちばん下。役に立つかわからない知識を広く浅く。', perk: '高卒の資格が取れる',
    clubs: CLUB_FEW, clubPower: 0.7,
    recs: [], uniRecs: [U('ZATSU_UNI', 'SKIP')],
  },
  {
    key: 'YAKAN', name: '夜間定時制高校', icon: '🌙', course: '定時制', dev: 36, country: 'HOME', cap: 8,
    entry: 20000, tuition: 1200, lessons: 10, uniBonus: 0,
    subjects: S('JP', 'MATH', 'ENG'),
    pass: { base: 0.36, min: 0.18, max: 0.55 },
    desc: '働きながらでも通える。学費がいちばん安い。', perk: '高卒の資格が取れる',
    clubs: CLUB_TINY, clubPower: 0.6,
    recs: [], uniRecs: [],
  },
  {
    key: 'WAKABA', name: '若葉総合高校', icon: '🌱', course: '総合学科', dev: 44, country: 'HOME', cap: 7,
    entry: 45000, tuition: 2400, lessons: 10, uniBonus: 1,
    subjects: S('JP', 'MATH', 'PE', 'ART', 'ECON'),
    pass: { base: 0.48, min: 0.25, max: 0.66 },
    desc: '好きなことを選んで学べる。部活の種類も多い。', perk: '大学入試に +1／部活が多い',
    clubs: CLUB_BIG, clubPower: 1.0,
    recs: [R('SALES', 'EASY')], uniRecs: [U('CORP_UNI', 'LINE', 0.16)],
  },
  {
    key: 'DEALER_HS', name: 'ディーラー養成高校', icon: '🃏', course: 'ゲーミング科', dev: 46, country: 'GAMBLE', cap: 6,
    entry: 90000, tuition: 4000, lessons: 11, uniBonus: 2,
    subjects: S('MATH', 'COMM', 'ECON', 'JP'),
    pass: { base: 0.50, min: 0.26, max: 0.68 },
    desc: 'ギャンブル大国の職業高校。確率と所作を三年間。', perk: '大学入試に +2／ディーラー資格が取れる',
    grant: 'DEALER',
    clubs: ['ESPORTS', 'SHOGI', 'IGO', 'QUIZ', 'PINGPONG', 'KARUTA'], clubPower: 0.9,
    recs: [R('DEALERJOB', 'LINE', 0.20)], uniRecs: [U('GAMBLE_UNI', 'LINE', 0.18)],
  },
  {
    key: 'MIDORI', name: '緑ヶ丘高校', icon: '🍃', course: '普通科', dev: 48, country: 'HOME', cap: 6,
    entry: 60000, tuition: 3000, lessons: 12, uniBonus: 2,
    subjects: S('JP', 'MATH', 'ENG', 'ART', 'PE'),
    pass: { base: 0.55, min: 0.30, max: 0.72 },
    desc: 'のんびりした校風。', perk: '大学入試に +2',
    clubs: CLUB_MID, clubPower: 0.9,
    recs: [R('SALES', 'LINE', 0.16)], uniRecs: [U('CORP_UNI', 'SKIP')],
  },
  {
    key: 'JITSUMU_HS', name: '実務商業高校', icon: '🧮', course: '実務科', dev: 50, country: 'WORK', cap: 6,
    entry: 70000, tuition: 3200, lessons: 12, uniBonus: 3,
    subjects: S('COMM', 'MATH', 'ECON', 'JP', 'PROG'),
    pass: { base: 0.58, min: 0.32, max: 0.74 },
    desc: '仕事国の中堅。卒業までに帳簿が読めるようになる。', perk: '大学入試に +3／📒簿記2級が取れる',
    grant: 'BOOK',
    clubs: CLUB_MID, clubPower: 0.85,
    recs: [R('ACCOUNT', 'EASY'), R('CLERK', 'LINE', 0.18)],
    uniRecs: [U('ZATSU_UNI', 'SKIP'), U('GAKUSHU_UNI', 'LINE', 0.16)],
  },
  {
    key: 'SAKURA', name: '桜丘高校', icon: '🌸', course: '普通科', dev: 52, country: 'HOME', cap: 6,
    entry: 80000, tuition: 3800, lessons: 12, uniBonus: 3,
    subjects: S('JP', 'MATH', 'ENG', 'HIST', 'PE'),
    pass: { base: 0.62, min: 0.38, max: 0.78 },
    desc: '校風が自由で行事が多い。部活もそろっている。', perk: '大学入試に +3／部活が多い',
    clubs: CLUB_BIG, clubPower: 1.05,
    recs: [R('CLERK', 'EASY'), R('SALES', 'LINE', 0.18)],
    uniRecs: [U('CORP_UNI', 'SKIP'), U('JOHO', 'LINE', 0.16)],
  },
  {
    key: 'HOKURYO', name: '北稜情報高校', icon: '🖥️', course: '情報科', dev: 53, country: 'HOME', cap: 5,
    entry: 90000, tuition: 4200, lessons: 12, uniBonus: 3,
    subjects: S('PROG', 'MATH', 'SCI', 'ENG', 'JP'),
    pass: { base: 0.66, min: 0.42, max: 0.80 },
    desc: '一年生からコードを書く。', perk: '大学入試に +3',
    clubs: ['ESPORTS', 'ROBOT', 'SCIENCE', 'QUIZ', 'SHOGI', 'IGO', 'PHOTO', 'BASKET', 'PINGPONG'], clubPower: 0.95,
    recs: [R('CLERK', 'LINE', 0.20)], uniRecs: [U('JOHO', 'SKIP'), U('KOKA', 'LINE', 0.16)],
  },
  {
    key: 'MINATO', name: '港国際高校', icon: '🌏', course: '国際科', dev: 54, country: 'HOME', cap: 5,
    entry: 90000, tuition: 4200, lessons: 12, uniBonus: 4,
    subjects: S('ENG', 'GRAM', 'JP', 'HIST', 'JHIST'),
    pass: { base: 0.68, min: 0.45, max: 0.82 },
    desc: '英語漬けの3年間。語学系の大学に強い。', perk: '大学入試に +4',
    clubs: ['TENNIS', 'SWIM', 'TRACK', 'DRAMA', 'BRASS', 'QUIZ', 'LITERATURE', 'PHOTO'], clubPower: 0.95,
    recs: [R('CLERK', 'LINE', 0.20)], uniRecs: [U('KOKUSAI', 'SKIP'), U('CHUO_UNI', 'LINE', 0.14)],
  },
  {
    key: 'KORYO', name: '工陵工業高校', icon: '🔧', course: '工業科', dev: 57, country: 'HOME', cap: 5,
    entry: 100000, tuition: 4500, lessons: 12, uniBonus: 4,
    subjects: S('TECH', 'SCI', 'MATH', 'PROG', 'JP'),
    pass: { base: 0.70, min: 0.48, max: 0.84 },
    desc: '製図と機械。手を動かして覚える。', perk: '大学入試に +4／工業系に強い',
    clubs: ['ROBOT', 'SCIENCE', 'RUGBY', 'JUDO', 'BASEBALL', 'TRACK', 'BOXING', 'PHOTO'], clubPower: 1.1,
    recs: [R('SECURITY', 'EASY'), R('SECURITY', 'LINE', 0.16)],
    uniRecs: [U('KOKA', 'SKIP'), U('JITSUMU_UNI', 'LINE', 0.16)],
  },
  {
    key: 'CHUO_COM', name: '中央商業高校', icon: '🧾', course: '商業科', dev: 58, country: 'HOME', cap: 5,
    entry: 100000, tuition: 4500, lessons: 12, uniBonus: 4,
    subjects: S('COMM', 'MATH', 'ECON', 'JP', 'PROG'),
    pass: { base: 0.70, min: 0.48, max: 0.84 },
    desc: '簿記と計算の実務を叩き込む。', perk: '大学入試に +4／商業系に強い',
    clubs: ['BASEBALL', 'SOCCER', 'BASKET', 'BRASS', 'SHOGI', 'QUIZ', 'KARUTA', 'PINGPONG'], clubPower: 1.0,
    recs: [R('CLERK', 'SKIP'), R('ACCOUNT', 'EASY')],
    uniRecs: [U('KAIO', 'LINE', 0.16), U('GAKUSHU_UNI', 'SKIP')],
  },
  {
    key: 'ROUDOU_HS', name: '労働技術高校', icon: '🏗️', course: '技術科', dev: 60, country: 'WORK', cap: 5,
    entry: 130000, tuition: 5200, lessons: 13, uniBonus: 5,
    subjects: S('TECH', 'MATH', 'SCI', 'PROG', 'COMM', 'JP'),
    pass: { base: 0.74, min: 0.52, max: 0.86 },
    desc: '仕事国の名門工科高校。現場に強い卒業生を送り出す。', perk: '大学入試に +5／📐建築士が取れる',
    grant: 'ARCH',
    clubs: ['ROBOT', 'SCIENCE', 'RUGBY', 'BASEBALL', 'JUDO', 'KENDO', 'TRACK', 'BOXING', 'GYMNAST'], clubPower: 1.15,
    recs: [R('ARCHITECT', 'EASY'), R('SECURITY', 'SKIP'), RG('FLY', 'LINE', 0.14)],
    uniRecs: [U('JITSUMU_UNI', 'SKIP'), U('KOKA', 'LINE', 0.16)],
  },
  {
    key: 'DAIICHI', name: '第一高校', icon: '🎌', course: '普通科', dev: 66, country: 'HOME', cap: 5, flash: 3,
    entry: 150000, tuition: 6000, lessons: 14, uniBonus: 7,
    subjects: S('JP', 'MATH', 'ENG', 'GRAM', 'HIST', 'JHIST', 'SCI'),
    pass: { base: 0.80, min: 0.62, max: 0.90 },
    desc: '県内屈指の進学校。入試に ⚡フラッシュ暗算 が出る。文武両道で部活も強い。',
    perk: '大学入試に +7／部活が強い',
    clubs: CLUB_BIG, clubPower: 1.25,
    recs: [R('CIVIL', 'LINE', 0.18), R('CLERK', 'SKIP')],
    uniRecs: [U('TEITO', 'LINE', 0.14), U('CHUO_UNI', 'SKIP'), U('KAIO', 'SKIP')],
  },
  {
    key: 'VEGA_HS', name: '大国際高校', icon: '🎴', course: '特進科', dev: 68, country: 'GAMBLE', cap: 4, flash: 3,
    entry: 350000, tuition: 11000, lessons: 15, uniBonus: 8,
    subjects: S('MATH', 'ECON', 'ENG', 'COMM', 'PROG', 'JP', 'HIST'),
    pass: { base: 0.82, min: 0.64, max: 0.91 },
    desc: 'ギャンブル大国の頂点の高校。確率論と語学を極める。入試に ⚡フラッシュ暗算。',
    perk: '大学入試に +8／カジノ大学への道',
    clubs: ['ESPORTS', 'SHOGI', 'IGO', 'QUIZ', 'FENCING', 'GOLF', 'SWIM', 'TENNIS', 'DANCE', 'BRASS'], clubPower: 1.15,
    recs: [R('DEALERJOB', 'SKIP'), RG('CASINO', 'LINE', 0.10)],
    uniRecs: [U('GAMBLE_UNI', 'SKIP'), U('CASINO_UNI', 'LINE', 0.14), U('CASINO_UNI_G', 'LINE', 0.12)],
  },
  {
    key: 'UNDO_HS', name: '運動付属高校', icon: '🏃', course: '体育科', dev: 44, country: 'SPORT', cap: 8,
    entry: 30000, tuition: 1800, lessons: 10, uniBonus: 1, sportBoost: 1.5,
    subjects: S('PE', 'JP', 'MATH'),
    pass: { base: 0.40, min: 0.18, max: 0.58 },
    desc: 'スポーツ大国の入口。勉強より先に身体を動かす。雑学大学と同じくらいの学力。',
    perk: '大学入試に +1／部活が強い／🏅 スポーツ推薦が効きやすい',
    clubs: CLUB_BIG, clubPower: 1.2,
    recs: [R('ATHLETE', 'EASY')],
    uniRecs: [U('UNDO_UNI', 'SKIP'), U('SPORT_UNI', 'LINE', 0.18)],
  },
  {
    key: 'SPORT_HS', name: 'スポーツ付属高校', icon: '🏆', course: 'アスリート科', dev: 58, country: 'SPORT', cap: 5,
    entry: 150000, tuition: 5000, lessons: 13, uniBonus: 4, sportBoost: 2.2,
    subjects: S('PE', 'SCI', 'JP', 'ENG', 'MATH'),
    pass: { base: 0.62, min: 0.34, max: 0.80 },
    desc: 'スポーツ大国の名門。全国大会の常連で、卒業生の多くがプロに進む。',
    perk: '大学入試に +4／部活が最強クラス／いい成績ならスポーツ大学の推薦',
    clubs: CLUB_FULL, clubPower: 1.45,
    recs: [R('ATHLETE', 'SKIP'), R('SECURITY', 'EASY')],
    uniRecs: [U('SPORT_UNI', 'SKIP', 0, 3.6), U('SPORT_UNI', 'LINE', 0.24), U('UNDO_UNI', 'SKIP')],
  },
  {
    key: 'YUTA_HS', name: 'YUTAPON付属高校', icon: '🏯', course: '特進科', dev: 76, country: 'HOME', cap: 3, flash: 5,
    entry: 400000, tuition: 12000, lessons: 16, uniBonus: 12,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.93, min: 0.84, max: 0.97 },
    desc: '全科目を最高水準で学ぶ、この国の頂点の高校。入試の ⚡フラッシュ暗算 は最高難度。部活も全国区。',
    perk: '全科目を履修。大学入試に +12 の下駄／部活が最強',
    clubs: CLUB_FULL, clubPower: 1.4,
    recs: [R('CIVIL', 'SKIP'), R('SECURITY', 'SKIP'), R('CLERK', 'SKIP'), R('SALES', 'SKIP'), RG('FLY', 'LINE', 0.18)],
    // ほぼ全部の大学から推薦が来る。ただしスポーツ大学（と運動大学）からは来ない
    uniRecs: [
      U('YUTA_UNI', 'LINE', 0.16), U('BANK_UNI', 'SKIP'), U('CASINO_UNI', 'SKIP'),
      U('CASINO_UNI_G', 'LINE', 0.14), U('GAMBLE_UNI', 'SKIP'), U('TEITO', 'SKIP'),
      U('SHIGOTO_UNI', 'LINE', 0.12), U('CHUO_UNI', 'SKIP'), U('KAIO', 'SKIP'),
      U('KOKA', 'SKIP'), U('JOHO', 'SKIP'), U('KOKUSAI', 'SKIP'), U('CORP_UNI', 'SKIP'),
      U('GAKUSHU_UNI', 'SKIP'), U('JITSUMU_UNI', 'SKIP'), U('ZATSU_UNI', 'SKIP'),
    ],
  },
];

/* ---------------- 大学（上ほどやさしい） ---------------- */
export const UNIVERSITIES = [
  {
    key: 'ZATSU_UNI', name: '雑学大学', icon: '🧠', dev: 44, country: 'WORK', cap: 8,
    entry: 120000, tuition: 5000, lessons: 12,
    subjects: S('JP', 'HIST', 'JHIST', 'ECON'),
    pass: { base: 0.40, min: 0.18, max: 0.58 },
    desc: '仕事国のいちばん下の大学。とにかく安く大卒になれる。', perk: 'いちばん安い大卒',
    clubs: CLUB_FEW, clubPower: 0.7,
    recs: [R('SALES', 'SKIP')],
  },
  {
    key: 'CORP_UNI', name: '企業総合大学', icon: '🏢', dev: 47, country: 'HOME', cap: 7,
    entry: 200000, tuition: 8000, lessons: 14,
    subjects: S('ECON', 'JP', 'ENG', 'COMM', 'PE'),
    pass: { base: 0.44, min: 0.22, max: 0.62 },
    desc: 'いちばん入りやすい大学。企業と組んだ実務教育が売り。', perk: '学費が安く入りやすい',
    clubs: CLUB_MID, clubPower: 0.9,
    recs: [R('SALES', 'SKIP'), R('CLERK', 'LINE', 0.18)],
  },
  {
    key: 'JOHO', name: '情報科学大学', icon: '💻', dev: 55, country: 'HOME', cap: 6,
    entry: 320000, tuition: 13000, lessons: 16,
    subjects: S('PROG', 'MATH', 'SCI', 'ENG', 'JP'),
    pass: { base: 0.56, min: 0.32, max: 0.72 },
    desc: '情報系に全振りしたカリキュラム。', perk: 'IT系に強い',
    clubs: ['ESPORTS', 'ROBOT', 'SCIENCE', 'QUIZ', 'SHOGI', 'IGO', 'BASKET', 'TENNIS'], clubPower: 0.95,
    recs: [R('CODER', 'LINE', 0.20)],
  },
  {
    key: 'KOKUSAI', name: '国際教養大学', icon: '🌐', dev: 57, country: 'HOME', cap: 6,
    entry: 350000, tuition: 14000, lessons: 16,
    subjects: S('ENG', 'GRAM', 'HIST', 'JHIST', 'JP', 'ECON'),
    pass: { base: 0.58, min: 0.34, max: 0.74 },
    desc: '授業の多くが英語で行われる。', perk: '語学・国際系に強い',
    clubs: ['TENNIS', 'SWIM', 'DRAMA', 'BRASS', 'LITERATURE', 'DANCE', 'PHOTO', 'QUIZ'], clubPower: 0.95,
    recs: [R('TEACHER', 'LINE', 0.20)],
  },
  {
    key: 'KOKA', name: '工科大学', icon: '⚙️', dev: 59, country: 'HOME', cap: 5,
    entry: 380000, tuition: 15000, lessons: 16,
    subjects: S('SCI', 'TECH', 'MATH', 'PROG', 'JP'),
    pass: { base: 0.60, min: 0.36, max: 0.76 },
    desc: 'ものづくりの研究に強い。', perk: '工学・技術に強い',
    clubs: ['ROBOT', 'SCIENCE', 'RUGBY', 'BASEBALL', 'TRACK', 'JUDO', 'GYMNAST'], clubPower: 1.05,
    recs: [R('ARCHITECT', 'LINE', 0.20), R('SECURITY', 'SKIP'), RG('FLY', 'LINE', 0.18)],
  },
  {
    key: 'KAIO', name: '海王大学', icon: '💹', dev: 61, country: 'HOME', cap: 5,
    entry: 400000, tuition: 16000, lessons: 16,
    subjects: S('ECON', 'MATH', 'COMM', 'JP', 'ENG'),
    pass: { base: 0.62, min: 0.38, max: 0.78 },
    desc: '経済学部が看板。金融に強い。', perk: '経済・商業に強い',
    clubs: CLUB_MID, clubPower: 1.0,
    recs: [R('ACCOUNT', 'SKIP'), R('TRADER', 'EASY')],
  },
  {
    key: 'CHUO_UNI', name: '中央総合大学', icon: '🎓', dev: 63, country: 'HOME', cap: 5,
    entry: 700000, tuition: 24000, lessons: 17,
    subjects: S('JP', 'ENG', 'HIST', 'JHIST', 'ECON', 'MATH'),
    pass: { base: 0.66, min: 0.42, max: 0.82 },
    desc: '海王大学の一段上。総合大学として厚みがあり、学費も相応に高い。',
    perk: '公務員に強い',
    clubs: CLUB_BIG, clubPower: 1.15,
    recs: [R('CIVIL', 'SKIP'), R('TEACHER', 'LINE', 0.20)],
  },
  {
    key: 'GAKUSHU_UNI', name: '学習大学', icon: '📚', dev: 63, country: 'WORK', cap: 5,
    entry: 620000, tuition: 22000, lessons: 17,
    subjects: S('JP', 'ENG', 'GRAM', 'MATH', 'HIST', 'ECON'),
    pass: { base: 0.66, min: 0.42, max: 0.82 },
    desc: '仕事国の名門。中央総合大学と同格。学ぶこと自体を研究する大学。',
    perk: '教師・研究に強い',
    clubs: CLUB_BIG, clubPower: 1.05,
    recs: [R('TEACHER', 'SKIP'), R('SCIENTIST', 'EASY')],
  },
  {
    key: 'JITSUMU_UNI', name: '実務総合大学', icon: '🛠️', dev: 63, country: 'WORK', cap: 5,
    entry: 640000, tuition: 22000, lessons: 17,
    subjects: S('TECH', 'COMM', 'PROG', 'MATH', 'ECON', 'JP'),
    pass: { base: 0.66, min: 0.42, max: 0.82 },
    desc: '仕事国の名門。中央総合大学と同格。現場で使える技術をとことん。',
    perk: '技術系・建設に強い',
    clubs: ['ROBOT', 'SCIENCE', 'RUGBY', 'BASEBALL', 'SOCCER', 'JUDO', 'KENDO', 'TRACK', 'BOXING'], clubPower: 1.1,
    recs: [R('ARCHITECT', 'SKIP'), R('CODER', 'LINE', 0.20), RG('FLY', 'SKIP')],
  },
  {
    key: 'UNDO_UNI', name: '運動大学', icon: '🏃', dev: 44, country: 'SPORT', cap: 8, sportBoost: 1.8,
    entry: 110000, tuition: 4600, lessons: 12,
    subjects: S('PE', 'SCI', 'JP'),
    pass: { base: 0.40, min: 0.16, max: 0.58 },
    desc: '雑学大学と同じくらいの学力。授業の半分が実技で、部活とスポーツに全振りしている。',
    perk: '部活が強い／🏅 スポーツ推薦が効きやすい／就職には弱い',
    clubs: CLUB_FULL, clubPower: 1.3,
    recs: [R('ATHLETE', 'SKIP'), R('SALES', 'SKIP')],
  },
  {
    key: 'SPORT_UNI', name: 'スポーツ大学', icon: '🏆', dev: 55, country: 'SPORT', cap: 6, sportBoost: 2.6,
    entry: 260000, tuition: 9000, lessons: 14,
    subjects: S('PE', 'SCI', 'JP', 'ENG'),
    pass: { base: 0.54, min: 0.24, max: 0.72 },
    desc: '偏差値はまあまあだが、部活だけは世界最高峰。スポーツ推薦がいちばん通りやすい大学。',
    perk: '部活が最強／🏅 スポーツ推薦の本場／就職の推薦は プロスポーツ選手 だけ',
    clubs: CLUB_FULL, clubPower: 1.5,
    recs: [R('ATHLETE', 'SKIP'), R('TEACHER', 'LINE', 0.12)],
  },
  {
    key: 'TEITO', name: '帝都大学', icon: '🏛️', dev: 67, country: 'HOME', cap: 4,
    entry: 900000, tuition: 30000, lessons: 18,
    subjects: S('JP', 'MATH', 'ENG', 'GRAM', 'HIST', 'JHIST', 'ECON', 'SCI'),
    pass: { base: 0.72, min: 0.50, max: 0.86 },
    desc: '総合力の名門。どの業界にも卒業生がいる。', perk: '幅広い学問を学べる',
    clubs: CLUB_FULL, clubPower: 1.2,
    recs: [R('LAWYER', 'EASY'), R('DOCTOR', 'EASY'), R('CIVIL', 'SKIP'), R('TEACHER', 'SKIP')],
  },
  {
    key: 'CASINO_UNI', name: 'カジノ大学', icon: '🎲', dev: 74, country: 'HOME', cap: 4, flash: 3,
    entry: 1500000, tuition: 45000, lessons: 18, rec: 'CASINO', recGpa: 4.5, backdoor: 60000000,
    subjects: S('MATH', 'ECON', 'COMM', 'HIST', 'JP', 'PROG'),
    pass: { base: 0.90, min: 0.78, max: 0.95 },
    desc: '銀行研究大学と同格。入試に ⚡フラッシュ暗算 あり。桁違いの寄付金を積めば学力不問で入れる。',
    perk: 'YUTAPON-CASINO からの推薦（GPA 4.5 で試験免除・銀行より狭き門）／裏口入学あり',
    clubs: ['ESPORTS', 'SHOGI', 'IGO', 'QUIZ', 'GOLF', 'FENCING', 'DANCE'], clubPower: 1.0,
    recs: [RG('CASINO', 'SKIP', 0, 4.5), RG('CASINO', 'LINE', 0.16), R('DEALERJOB', 'SKIP')],
  },
  {
    key: 'BANK_UNI', name: '銀行研究大学', icon: '🏦', dev: 74, country: 'HOME', cap: 4, flash: 3, calcAuto: true,
    entry: 2000000, tuition: 55000, lessons: 18, rec: 'BANK', recGpa: 4.3,
    subjects: S('MATH', 'COMM', 'ECON', 'PROG', 'JP', 'ENG'),
    pass: { base: 0.90, min: 0.78, max: 0.95 },
    desc: 'YUTAPON大学の一段下。入試に ⚡フラッシュ暗算 あり。学費はこの国で最も高い。',
    perk: 'YUTAPON-BANK の推薦（GPA 4.3 で試験免除）／研究者の推薦／計算系の職はほぼ確実',
    clubs: ['SHOGI', 'IGO', 'QUIZ', 'SCIENCE', 'TENNIS', 'GOLF'], clubPower: 0.9,
    recs: [
      RG('BANK', 'SKIP', 0, 4.3), RG('BANK', 'LINE', 0.14),
      R('SCIENTIST', 'LINE', 0.22), R('SCIENTIST', 'EASY'),
      { target: 'CALC', calcGroup: true, type: 'LINE', amount: 0.45 },
      R('ACCOUNT', 'SKIP'), R('TRADER', 'SKIP'),
    ],
  },
  {
    key: 'GAMBLE_UNI', name: 'ギャンブル大学', icon: '🎰', dev: 78, country: 'GAMBLE', cap: 4, flash: 4,
    entry: 2600000, tuition: 62000, lessons: 19, rec: 'CASINO', recGpa: 4.1,
    subjects: S('MATH', 'ECON', 'COMM', 'PROG', 'SCI', 'JP', 'ENG'),
    pass: { base: 0.92, min: 0.80, max: 0.96 },
    desc: 'ギャンブル大国の名門。確率・統計・資金管理をとことん研究する。入試に ⚡フラッシュ暗算 あり。',
    perk: 'YUTAPON-CASINO からの推薦（GPA 4.1 で試験免除）／賭けの数理に最強',
    clubs: ['ESPORTS', 'SHOGI', 'IGO', 'QUIZ', 'SCIENCE', 'FENCING', 'GOLF', 'DANCE'], clubPower: 1.0,
    recs: [
      RG('CASINO', 'SKIP', 0, 4.1), RG('CASINO', 'LINE', 0.20),
      R('DEALERJOB', 'SKIP'), R('TRADER', 'SKIP'), R('ACCOUNT', 'SKIP'),
    ],
  },
  {
    key: 'YUTA_UNI', name: 'YUTAPON大学', icon: '👑', dev: 80, country: 'HOME', cap: 3, flash: 5,
    entry: 600000, tuition: 40000, lessons: 20, rec: 'BOTH', recGpa: 4.0,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.95, min: 0.88, max: 0.98 },
    desc: 'この世界の最高学府。全学問を修める。入試の ⚡フラッシュ暗算 は最高難度。学費は意外と良心的。',
    perk: 'GPA 4.0 以上で卒業すると YUTAPON-BANK と YUTAPON-CASINO の採用試験が免除。届かなくても採用が大幅に有利',
    clubs: CLUB_FULL, clubPower: 1.35,
    recs: [
      RG('FLY', 'SKIP', 0, 4.0), RG('BANK', 'SKIP', 0, 4.0), RG('CASINO', 'SKIP', 0, 4.0),
      RG('FLY', 'LINE', 0.22), RG('BANK', 'LINE', 0.22), RG('CASINO', 'LINE', 0.22),
      { target: 'ALL', all: true, type: 'SKIP' },
    ],
  },
  {
    key: 'CASINO_UNI_G', name: 'カジノ大学（ギャンブル大国キャンパス）', icon: '🎴', dev: 84, country: 'GAMBLE', cap: 3, flash: 5,
    entry: 4000000, tuition: 90000, lessons: 20, rec: 'CASINO', recGpa: 4.2, backdoor: 9000000000,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.96, min: 0.90, max: 0.98 },
    desc: 'カジノ大学の本校。YUTAPON大学すら上回る、賭けの世界の最高峰。入試の ⚡フラッシュ暗算 は最高難度。',
    perk: 'YUTAPON-CASINO からの推薦（GPA 4.2 で試験免除）／裏口入学あり（超超大金）',
    clubs: CLUB_FULL, clubPower: 1.3,
    recs: [
      RG('CASINO', 'SKIP', 0, 4.2), RG('CASINO', 'LINE', 0.24),
      RG('BANK', 'LINE', 0.16),
      { target: 'ALL', all: true, type: 'LINE', amount: 0.24 },
      R('DEALERJOB', 'SKIP'), R('TRADER', 'SKIP'),
    ],
  },
  {
    key: 'SHIGOTO_UNI', name: '仕事大学', icon: '💼', dev: 86, country: 'WORK', cap: 3, flash: 5,
    entry: 3000000, tuition: 75000, lessons: 21,
    subjects: ALL_SUBJECTS,
    pass: { base: 0.96, min: 0.90, max: 0.99 },
    desc: '働くことそのものを極める大学。YUTAPON大学をも上回る、仕事国の最高学府。',
    perk: 'あらゆる職の採用試験が免除される／全学問を修める',
    clubs: CLUB_FULL, clubPower: 1.3,
    recs: [
      { target: 'ALL', all: true, type: 'SKIP' },
      RG('BANK', 'LINE', 0.18), RG('CASINO', 'LINE', 0.18),
    ],
  },
];

/* ---------------- 専門学校（高いところは目指せないが免除が多い） ---------------- */
export const VOCATIONALS = [
  {
    key: 'VOC_COOK', name: '調理専門学校', icon: '🍳', dev: 40, country: 'HOME', cap: 7,
    entry: 120000, tuition: 5000, lessons: 8, grant: 'COOK',
    subjects: S('PE', 'ART', 'JP'),
    pass: { base: 0.42, min: 0.20, max: 0.60 },
    desc: '2年で現場に出る。卒業で調理師免許がもらえる。',
    perk: '卒業すると 🍳調理師免許 ／ 調理師・販売スタッフは試験免除',
    clubs: ['COOKING', 'PINGPONG', 'PHOTO'], clubPower: 0.7,
    recs: [R('CHEF', 'SKIP'), R('SALES', 'SKIP')],
  },
  {
    key: 'VOC_DESIGN', name: 'デザイン専門学校', icon: '🎨', dev: 41, country: 'HOME', cap: 7,
    entry: 140000, tuition: 5800, lessons: 8, grant: 'QC',
    subjects: S('ART', 'TECH', 'JP'),
    pass: { base: 0.44, min: 0.22, max: 0.62 },
    desc: '色と形の基礎から実制作まで。',
    perk: '卒業すると 🔍品質管理士 ／ 警備主任・販売スタッフは試験免除',
    clubs: ['ART', 'PHOTO', 'DRAMA', 'LIGHTMUSIC'], clubPower: 0.7,
    recs: [R('SECURITY', 'SKIP'), R('SALES', 'SKIP')],
  },
  {
    key: 'VOC_ACC', name: '医療事務専門学校', icon: '🏥', dev: 42, country: 'HOME', cap: 6,
    entry: 130000, tuition: 5500, lessons: 8, grant: 'BOOK',
    subjects: S('COMM', 'JP', 'MATH'),
    pass: { base: 0.45, min: 0.22, max: 0.63 },
    desc: 'レセプトと簿記を実践的に。',
    perk: '卒業すると 📒簿記2級 ／ 経理・事務員は試験免除',
    clubs: ['PINGPONG', 'BADMINTON', 'LITERATURE'], clubPower: 0.7,
    recs: [R('ACCOUNT', 'SKIP'), R('CLERK', 'SKIP')],
  },
  {
    key: 'VOC_IT', name: '情報処理専門学校', icon: '🖧', dev: 45, country: 'HOME', cap: 6,
    entry: 150000, tuition: 6000, lessons: 8, grant: 'IT',
    subjects: S('PROG', 'MATH', 'SCI'),
    pass: { base: 0.48, min: 0.24, max: 0.66 },
    desc: '手を動かして現場の技術を学ぶ。',
    perk: '卒業すると 💻情報処理技術者 ／ 事務員・警備主任は試験免除',
    clubs: ['ESPORTS', 'ROBOT', 'SCIENCE', 'SHOGI'], clubPower: 0.8,
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

/* ---------------- 国 ---------------- */
export const countryOfSchool = (school) => school?.country || 'HOME';
/** その国で通える学校だけ */
export const schoolsIn = (list, country) => (list || []).filter(s => (s.country || 'HOME') === (country || 'HOME'));

/* ---------------- 定員 ---------------- */
export const capacityOf = (school) => school?.cap || DEFAULT_CAP;
/** いま在学している人数（卒業した人は席を空ける） */
export function enrolledCount(school, players = []) {
  if (!school) return 0;
  const slot = school.kind === 'HIGH' ? 'hs' : school.kind === 'UNI' ? 'uni' : 'voc';
  let n = 0;
  for (const p of players) {
    const r = p?.edu?.[slot];
    if (r && r.key === school.key && !r.graduated) n++;
  }
  return n;
}
export function seatsLeft(school, players = [], myName = null) {
  const slot = school.kind === 'HIGH' ? 'hs' : school.kind === 'UNI' ? 'uni' : 'voc';
  let n = 0;
  for (const p of players) {
    if (myName && p?.name === myName) continue;      // 自分は数えない
    const r = p?.edu?.[slot];
    if (r && r.key === school.key && !r.graduated) n++;
  }
  return Math.max(0, capacityOf(school) - n);
}

/* ---------------- カリキュラム ----------------
   授業を受けた科目が、そのあとの定期テストの出題範囲になる。
   最後の卒業試験はそれまでの全範囲から出る。 */
export function curriculumOf(school) {
  if (!school) return [];
  const out = [];
  const subs = school.subjects || ['JP'];
  let learned = [];
  for (let i = 0; i < school.lessons; i++) {
    const subject = subs[i % subs.length];
    const isExam = ((i + 1) % EXAM_EVERY === 0);
    if (isExam) {
      // 直前の定期テスト以降に習った範囲
      out.push({ i, subject, kind: 'EXAM', covers: [...new Set(learned)] });
      learned = [];
    } else {
      out.push({ i, subject, kind: 'LESSON', covers: [subject] });
      learned.push(subject);
    }
  }
  out.push({ i: school.lessons, subject: subs[0], kind: 'FINAL', covers: [...new Set(subs)] });
  return out;
}
export const totalSteps = (school) => (school ? school.lessons + 1 : 0);
/** テストの出題範囲を日本語で */
export function coversLabel(step) {
  const c = step?.covers || [];
  if (!c.length) return '';
  return c.map(k => SUBJECTS[k]?.name || k).join('・');
}

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
  for (const k of ['hs', 'voc', 'uni']) {
    if (k !== slot && edu[k] && !edu[k].graduated) return { ok: false, reason: '別の学校に在学中です' };
  }
  // 国が違えば通えない（YUTAPON FLY で移動してから）
  if (opts.country && (school.country || 'HOME') !== opts.country) {
    return { ok: false, reason: `この学校は別の国にあります（旅行で移動してください）` };
  }
  // 定員
  if (opts.seats !== undefined && opts.seats <= 0 && !opts.backdoor) {
    return { ok: false, reason: `定員（${capacityOf(school)}人）がいっぱいです。誰かが卒業するまで待ってください` };
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
  SPORT: { name: 'スポーツ推薦', icon: '🏅', color: '#fb7185' },
};

function recMatches(rec, career) {
  if (!career) return false;
  if (rec.all) return true;
  if (rec.group) return career.group === rec.target;
  if (rec.calcGroup) return !!career.calcJob && !career.group;
  return rec.target === career.key;
}

/** 卒業した学校から来ている推薦をまとめる（就職用） */
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
  if (!out.skip && out.ease === 0 && edu.uni?.graduated) {
    out.ease = Math.min(0.12, 0.02 + (edu.uni.gpa || 0) * 0.02);
    out.notes.push('大卒として少し優遇されます');
  }
  return out;
}
export const admissionPerk = recommendPerk;

/* ---------------- 上の学校への推薦（高校→大学） ---------------- */
/** 出身高校から、その大学への推薦が来ているか */
export function uniRecommendPerk(edu = {}, school) {
  const out = { skip: false, ease: 0, diffDown: 0, notes: [] };
  if (!school || school.kind !== 'UNI') return out;
  const hs = edu.hs;
  if (!hs?.graduated) return out;
  const s = schoolOf(hs.key);
  for (const r of (s?.uniRecs || [])) {
    if (r.uni !== school.key) continue;
    if (r.gpa && (hs.gpa || 0) < r.gpa) continue;
    if (r.type === 'SKIP') { out.skip = true; out.notes.push(`${s.icon}${s.name} からの推薦で入試が免除`); }
    else if (r.type === 'LINE') {
      const a = r.amount ?? 0.16;
      if (a > out.ease) { out.ease = a; out.notes.push(`${s.icon}${s.name} からの推薦で合格ライン -${Math.round(a * 100)}pt`); }
    } else if (r.type === 'EASY') {
      out.diffDown = Math.max(out.diffDown, r.amount ?? 1);
      out.notes.push(`${s.icon}${s.name} からの推薦で問題が易しくなる`);
    }
  }
  return out;
}

/* ---------------- スポーツ推薦 ----------------
   部活でいい成績を残して卒業すると、偏差値が足りなくても入れる学校がある。
   fame（名声）は部活の戦績。大会で勝つほど貯まる。 */
export const SPORT_REC_MIN = 260;      // これを超えると推薦が出る
export const SPORT_REC_STRONG = 900;   // これを超えると難関校も免除

export function sportsRecPerk(club = {}, school) {
  const out = { skip: false, ease: 0, notes: [] };
  if (!school) return out;
  const boost = school.sportBoost || 1;     // スポーツに力を入れている学校ほど通りやすい
  const fame = Math.max(0, club.fame || 0) * boost;
  if (fame < SPORT_REC_MIN) return out;
  // 偏差値の高い学校ほど、たくさんの名声が要る
  const need = Math.max(SPORT_REC_MIN, Math.round((school.dev - 40) * 34));
  if (fame >= need * 3) {
    out.skip = true;
    out.notes.push(`🏅 スポーツ推薦で入試が免除${boost > 1 ? `（この学校はスポーツ推薦に強い ×${boost}）` : ''}`);
  } else if (fame >= need) {
    out.ease = Math.min(0.30, 0.10 + (fame - need) / (need * 12));
    out.notes.push(`🏅 スポーツ推薦で合格ライン -${Math.round(out.ease * 100)}pt${boost > 1 ? `（スポーツ推薦に強い ×${boost}）` : ''}`);
  }
  return out;
}

/** 学校ごとの推薦一覧（学校カードに出す） */
export function recsOf(school) {
  return (school?.recs || []).map(r => ({
    ...r,
    label: REC_LABEL[r.type],
    who: r.all ? 'すべての職種'
      : r.group ? (r.target === 'BANK' ? 'YUTAPON-BANK' : r.target === 'FLY' ? 'YUTAPON-FLY' : 'YUTAPON-CASINO')
        : r.calcGroup ? '計算系の職種' : r.target,
    dept: r.group ? r.target : null,
  }));
}
/** 高校カードに出す「大学からの推薦」 */
export function uniRecsOf(school) {
  return (school?.uniRecs || []).map(r => ({
    ...r,
    label: REC_LABEL[r.type],
    school: schoolOf(r.uni),
  })).filter(r => r.school);
}

/* ---------------- 就学金制度（スカラシップ） ----------------
   いい高校を、いい成績で卒業すると、そのあとの学費が軽くなる。
   偏差値の高い高校ほど、そして GPA が高いほど、免除の幅が大きい。
   高校そのものには効かない（高校を出たごほうびなので）。VIP の割引とは重ねてかかる。 */
export const SCHOLARSHIPS = [
  { key: 'S1', dev: 50, gpa: 3.4, entry: 0.15, tuition: 0.20, name: '奨学生', icon: '🥉', color: '#93c5fd' },
  { key: 'S2', dev: 56, gpa: 3.9, entry: 0.25, tuition: 0.35, name: '特別奨学生', icon: '🥈', color: '#5eead4' },
  { key: 'S3', dev: 64, gpa: 4.3, entry: 0.40, tuition: 0.50, name: '給費生', icon: '🥇', color: '#fbbf24' },
  { key: 'S4', dev: 74, gpa: 4.6, entry: 1.00, tuition: 1.00, name: '特待生（学費全額免除）', icon: '👑', color: '#f472b6' },
];

/** いま効いている就学金。出身高校と GPA から決まる */
export function scholarshipOf(edu = {}) {
  const hs = edu.hs;
  if (!hs?.graduated) return null;
  const s = schoolOf(hs.key);
  if (!s) return null;
  const gpa = hs.gpa || 0;
  let best = null;
  for (const t of SCHOLARSHIPS) {
    if (s.dev >= t.dev && gpa >= t.gpa) best = t;
  }
  if (!best) return null;
  return { ...best, from: s, gpa };
}

/** 次の等級まであと何が足りないか（画面の案内用） */
export function nextScholarship(edu = {}) {
  const hs = edu.hs;
  if (!hs?.graduated) return null;
  const s = schoolOf(hs.key);
  if (!s) return null;
  const gpa = hs.gpa || 0;
  for (const t of SCHOLARSHIPS) {
    if (s.dev >= t.dev && gpa < t.gpa) return { ...t, need: Math.round((t.gpa - gpa) * 10) / 10 };
  }
  return null;
}

/* ---------------- 学費（VIPは0.9倍・就学金はさらに割引） ---------------- */
export const entryFee = (school, vip, scholar = null) => {
  const off = scholar && school?.kind !== 'HIGH' ? (scholar.entry || 0) : 0;
  return Math.round((school?.entry || 0) * (vip ? VIP_TUITION : 1) * (1 - off));
};
export const tuitionFee = (school, vip, scholar = null) => {
  const off = scholar && school?.kind !== 'HIGH' ? (scholar.tuition || 0) : 0;
  return Math.round((school?.tuition || 0) * (vip ? VIP_TUITION : 1) * (1 - off));
};

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
