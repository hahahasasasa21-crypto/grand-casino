/* ==========================================================
   部活・サークル
   ・学校に在籍しているあいだだけ入れる（卒業すると戦績だけ残る）
   ・練習すると「実力」が上がる。練習にはミニゲームを使う
   ・大会に出ると「名声」が貯まり、スポーツ推薦とプロへの道がひらく
   ========================================================== */

/* game … 練習と試合に使うミニゲーム
   team … 団体競技の人数（1なら個人競技）
   season … 大会のカテゴリ（SPORT / CULTURE）
   power … 実力の伸びやすさ（低いほど伸びにくい＝強豪になりにくい） */
const SPORT = (key, name, icon, game, team, opts = {}) => ({
  key, name, icon, game, team, kind: 'SPORT', ...opts,
});
const CULTURE = (key, name, icon, game, team, opts = {}) => ({
  key, name, icon, game, team, kind: 'CULTURE', ...opts,
});

export const CLUBS = [
  /* ---- 運動部（20競技） ---- */
  SPORT('BASEBALL', '野球部', '⚾', 'MEMORY', 9, { desc: 'サインを覚え、配球を読む。甲子園はここから。', koshien: true, hard: 1.15 }),
  SPORT('SOCCER', 'サッカー部', '⚽', 'SORT', 11, { desc: '味方の位置を見てボールを配る。', hard: 1.1 }),
  SPORT('BASKET', 'バスケットボール部', '🏀', 'MEMORY', 5, { desc: 'セットプレーを覚えて走る。' }),
  SPORT('VOLLEY', 'バレーボール部', '🏐', 'INSPECT', 6, { desc: '相手の穴を一瞬で見抜く。' }),
  SPORT('TRACK', '陸上競技部', '🏃', 'TYPING', 1, { desc: 'ひたすら速く、正確に。個人競技。' }),
  SPORT('SWIM', '水泳部', '🏊', 'TYPING', 1, { desc: 'タイムとの戦い。' }),
  SPORT('TENNIS', 'テニス部', '🎾', 'INSPECT', 2, { desc: '相手の癖を読む。' }),
  SPORT('PINGPONG', '卓球部', '🏓', 'CALC', 1, { desc: '反射と計算。部室ひとつで始められる。', easy: true }),
  SPORT('BADMINTON', 'バドミントン部', '🏸', 'INSPECT', 2, { desc: 'シャトルの軌道を読む。' }),
  SPORT('KENDO', '剣道部', '🥋', 'MEMORY', 5, { desc: '型を体に入れる。', hard: 1.05 }),
  SPORT('JUDO', '柔道部', '🥋', 'SORT', 5, { desc: '組み手と体さばき。', hard: 1.05 }),
  SPORT('KYUDO', '弓道部', '🏹', 'INSPECT', 5, { desc: '静けさの中で的を射る。' }),
  SPORT('KARATE', '空手部', '🥊', 'MEMORY', 5, { desc: '形と組手。' }),
  SPORT('RUGBY', 'ラグビー部', '🏉', 'SORT', 15, { desc: '15人でひとつの塊になる。', hard: 1.2 }),
  SPORT('HANDBALL', 'ハンドボール部', '🤾', 'SORT', 7, { desc: '空中での判断。' }),
  SPORT('BOXING', 'ボクシング部', '🥊', 'INSPECT', 1, { desc: '一瞬の見切り。個人競技。' }),
  SPORT('GYMNAST', '体操部', '🤸', 'MEMORY', 1, { desc: '演技構成を完璧に覚える。' }),
  SPORT('FENCING', 'フェンシング部', '🤺', 'INSPECT', 1, { desc: '間合いと駆け引き。' }),
  SPORT('GOLF', 'ゴルフ部', '⛳', 'CALC', 1, { desc: '距離と風を計算する。' }),
  SPORT('DANCE', 'ダンス部', '💃', 'MEMORY', 8, { desc: '振り付けをそろえる。' }),

  /* ---- 文化部（16） ---- */
  CULTURE('ESPORTS', 'eスポーツ部', '🎮', 'TYPING', 5, { desc: '指の速さがすべて。', hard: 1.1 }),
  CULTURE('BRASS', '吹奏楽部', '🎺', 'MEMORY', 30, { desc: '全国大会は金賞をめざす。', hard: 1.15 }),
  CULTURE('ART', '美術部', '🎨', 'INSPECT', 1, { desc: '見たものを正確に写しとる。' }),
  CULTURE('LIGHTMUSIC', '軽音楽部', '🎸', 'MEMORY', 4, { desc: 'コード進行を体で覚える。' }),
  CULTURE('PHOTO', '写真部', '📷', 'INSPECT', 1, { desc: '決定的瞬間を逃さない。' }),
  CULTURE('DRAMA', '演劇部', '🎭', 'WORD', 10, { desc: '台詞を頭に叩き込む。' }),
  CULTURE('SHODO', '書道部', '🖌️', 'MEMORY', 1, { desc: '一画に集中する。' }),
  CULTURE('SHOGI', '将棋部', '♟️', 'MEMORY', 1, { desc: '定跡を覚え、詰みを読む。' }),
  CULTURE('IGO', '囲碁部', '⚫', 'MEMORY', 1, { desc: '盤面の形を覚える。' }),
  CULTURE('QUIZ', 'クイズ研究会', '❓', 'CHOICE', 3, { desc: '早押しの知識量。' }),
  CULTURE('SCIENCE', '科学部', '🔬', 'CHOICE', 4, { desc: '実験と観察。' }),
  CULTURE('LITERATURE', '文芸部', '📖', 'WORD', 1, { desc: '言葉を選ぶ。' }),
  CULTURE('BROADCAST', '放送部', '📻', 'TYPING', 4, { desc: '正確に速く読む。' }),
  CULTURE('KARUTA', '競技かるた部', '🎴', 'MEMORY', 5, { desc: '百首を体に入れる。', hard: 1.1 }),
  CULTURE('ROBOT', 'ロボット研究部', '🤖', 'SORT', 4, { desc: '部品を組み、動かす。' }),
  CULTURE('COOKING', '料理部', '🍳', 'SORT', 6, { desc: '段取りがすべて。' }),
];

export const clubOf = (k) => CLUBS.find(c => c.key === k) || null;
export const SPORT_CLUBS = CLUBS.filter(c => c.kind === 'SPORT');
export const CULTURE_CLUBS = CLUBS.filter(c => c.kind === 'CULTURE');

/* ---------------- 練習 ---------------- */
export const TRAIN_COOLDOWN = 45 * 1000;     // 練習の間隔
export const TRAIN_COST = (school) => Math.max(200, Math.round((school?.tuition || 1000) * 0.25));

/** 練習で伸びる実力。伸びは上に行くほど鈍る（青天井にしない） */
export function trainGain(club, skill, perf, schoolPower = 1) {
  const c = clubOf(club) || {};
  const hard = c.hard || 1;
  const base = 14 * (0.25 + perf * 1.25) * schoolPower / hard;
  const soften = 1 / (1 + Math.max(0, skill) / 600);     // 実力が上がるほど伸びにくい
  return Math.max(1, Math.round(base * soften));
}

/** 実力のランク */
export const SKILL_RANKS = [
  { min: 0, name: '一年生', color: '#a3a3a3' },
  { min: 120, name: 'ベンチ入り', color: '#93c5fd' },
  { min: 300, name: 'レギュラー', color: '#60a5fa' },
  { min: 600, name: '主力', color: '#34d399' },
  { min: 1000, name: 'エース', color: '#fbbf24' },
  { min: 1600, name: '主将', color: '#fb923c' },
  { min: 2400, name: '県内最強', color: '#f472b6' },
  { min: 3600, name: '全国区', color: '#c084fc' },
  { min: 5200, name: '怪物', color: '#f87171' },
];
export const skillRank = (s) => [...SKILL_RANKS].reverse().find(r => (s || 0) >= r.min) || SKILL_RANKS[0];

/** 名声のランク（スポーツ推薦とプロ入りに効く） */
export function fameRank(f) {
  const v = f || 0;
  if (v >= 4000) return { name: '伝説', color: '#fbbf24' };
  if (v >= 2000) return { name: '全国の名前', color: '#f472b6' };
  if (v >= 900) return { name: '強豪校のエース', color: '#c084fc' };
  if (v >= 260) return { name: '地区の実力者', color: '#34d399' };
  if (v >= 60) return { name: '名前が出はじめた', color: '#60a5fa' };
  return { name: '無名', color: '#a3a3a3' };
}

/* ---------------- 部員データの形 ---------------- */
export function normalizeClub(c = {}) {
  return {
    key: c.key || null,
    school: c.school || null,
    skill: c.skill || 0,
    fame: c.fame || 0,
    stamina: c.stamina === undefined ? 100 : c.stamina,
    joinedAt: c.joinedAt || 0,
    lastTrainAt: c.lastTrainAt || 0,
    lastMatchAt: c.lastMatchAt || 0,
    wins: c.wins || 0,
    losses: c.losses || 0,
    titles: c.titles || [],
    history: c.history || [],
  };
}
