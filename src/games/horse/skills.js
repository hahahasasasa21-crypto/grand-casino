/* ==========================================================
   競走馬スキル定義（全50種）
   ------------------------------------------------------------
   on:
     'start'      … 発走時に1回
     'tick'       … 毎ティック（発動条件はスキル側で判定）
     'overtaken'  … 他馬に抜かれた瞬間
     'overtake'   … 他馬を抜いた瞬間
     'corner'     … コーナー進入時
     'straight'   … 最終直線進入時

   効果を出すためのヘルパー（第2引数 c）:
     c.buff(h,'speed'|'accel'|'drain', 倍率, 秒)  一時的な効果
     c.spd(h, ±N)      スピード能力を恒久的に増減
     c.sta(h, ±N)      体力能力（スタミナ持ち）を恒久的に増減
     c.stam(h, ±N)     体力ゲージを即時増減
     c.note(h, text)   実況に一言

   ※ レースは約90〜150秒あるので「ずっと続く効果」は小さく、
     「数秒だけの効果」は大きくしてバランスを取っている。
   ========================================================== */

export const SKILL_CATS = {
  reaction: { label: '反応', color: '#f87171' },
  rank: { label: '順位', color: '#60a5fa' },
  stamina: { label: '体力', color: '#34d399' },
  speed: { label: '瞬発', color: '#fbbf24' },
  course: { label: '適性', color: '#c084fc' },
  debuff: { label: '弱点', color: '#94a3b8' },
};

/** rarity: 1=よくある 2=やや珍しい 3=レア */
export const SKILLS = [
  /* ---------- 反応系 ---------- */
  {
    id: 'COUNTER', name: '逆襲', cat: 'reaction', rarity: 2,
    desc: '抜かされるたびに3秒間スピード×1.20', on: 'overtaken', cd: 4,
    run: (h, c) => { c.buff(h, 'speed', 1.20, 3); return true; },
  },
  {
    id: 'FLINCH', name: '気後れ', cat: 'debuff', rarity: 1, bad: true,
    desc: '抜かされると4秒間スピード×0.90＋体力-7', on: 'overtaken', cd: 5,
    run: (h, c) => { c.buff(h, 'speed', 0.90, 4); c.stam(h, -7); return true; },
  },
  {
    id: 'CHASE', name: '闘志', cat: 'reaction', rarity: 2,
    desc: '他馬を抜くたびに3秒間スピード×1.14', on: 'overtake', cd: 4,
    run: (h, c) => { c.buff(h, 'speed', 1.14, 3); return true; },
  },
  {
    id: 'GRIT', name: '執念', cat: 'reaction', rarity: 3,
    desc: '抜かされても脚色が衰えない（スピード低下スキルを無効化）', on: 'start',
    run: (h) => { h.immuneDebuff = true; return true; },
  },
  {
    id: 'BROKEN', name: '心折れ', cat: 'debuff', rarity: 1, bad: true,
    desc: '3回抜かされるとスピード-16（そのレース中ずっと）', on: 'overtaken',
    run: (h, c) => { if (h.overtakenCount === 3) { c.spd(h, -16); return true; } return false; },
  },
  {
    id: 'DUEL', name: '一騎打ち', cat: 'reaction', rarity: 2,
    desc: '前の馬との差が1馬身以内なら2秒間スピード×1.12', on: 'tick', cd: 2.5,
    run: (h, c) => {
      const ahead = c.all.find(o => o.rank === h.rank - 1);
      if (ahead && ahead.pos - h.pos < 2.6) { c.buff(h, 'speed', 1.12, 2.2); return true; }
      return false;
    },
  },
  {
    id: 'SHADOW', name: '影走り', cat: 'stamina', rarity: 2,
    desc: '前の馬の直後につけると体力消費-22%', on: 'tick', cd: 2,
    run: (h, c) => {
      const ahead = c.all.find(o => o.rank === h.rank - 1);
      if (ahead && ahead.pos - h.pos < 4) { c.buff(h, 'drain', 0.78, 2.2); return true; }
      return false;
    },
  },
  {
    id: 'SIDEBYSIDE', name: '併走上手', cat: 'stamina', rarity: 1,
    desc: '近くに馬がいると体力消費-14%', on: 'tick', cd: 2.5,
    run: (h, c) => {
      const near = c.all.some(o => o.id !== h.id && Math.abs(o.pos - h.pos) < 3);
      if (near) { c.buff(h, 'drain', 0.86, 2.6); return true; }
      return false;
    },
  },

  /* ---------- 順位系 ---------- */
  {
    id: 'LEADER_PRIDE', name: '先頭の意地', cat: 'rank', rarity: 2,
    desc: '1位のとき4秒間スピード×1.05', on: 'tick', cd: 4,
    run: (h, c) => { if (h.rank === 1) { c.buff(h, 'speed', 1.05, 4.2); return true; } return false; },
  },
  {
    id: 'SECOND_KICK', name: '二の脚', cat: 'rank', rarity: 2,
    desc: '2位のとき一瞬スピード×1.26（1.6秒）', on: 'tick', cd: 6,
    run: (h, c) => { if (h.rank === 2) { c.buff(h, 'speed', 1.26, 1.6); return true; } return false; },
  },
  {
    id: 'THIRD_EYE', name: '三番手の策士', cat: 'rank', rarity: 2,
    desc: '3位のとき5秒間 加速力+25%', on: 'tick', cd: 5,
    run: (h, c) => { if (h.rank === 3) { c.buff(h, 'accel', 1.25, 5.2); return true; } return false; },
  },
  {
    id: 'MID_PACK', name: '中団の名手', cat: 'rank', rarity: 1,
    desc: '4〜6位のとき体力消費-18%', on: 'tick', cd: 3,
    run: (h, c) => { if (h.rank >= 4 && h.rank <= 6) { c.buff(h, 'drain', 0.82, 3.2); return true; } return false; },
  },
  {
    id: 'LAST_FURY', name: '最後方の怒り', cat: 'rank', rarity: 2,
    desc: '最下位のとき5秒間スピード×1.12', on: 'tick', cd: 5,
    run: (h, c) => { if (h.rank === c.all.length) { c.buff(h, 'speed', 1.12, 5.2); return true; } return false; },
  },
  {
    id: 'CLIMB', name: '位置取り上手', cat: 'rank', rarity: 1,
    desc: '3秒ごとに12%の確率でスピード×1.16（2秒）', on: 'tick', cd: 3,
    run: (h, c) => { if (c.rng() < 0.12) { c.buff(h, 'speed', 1.16, 2); return true; } return false; },
  },
  {
    id: 'IMPATIENT', name: '焦り', cat: 'debuff', rarity: 1, bad: true,
    desc: '5位以下だと体力消費+22%', on: 'tick', cd: 3,
    run: (h, c) => { if (h.rank >= 5) { c.buff(h, 'drain', 1.22, 3.2); return true; } return false; },
  },
  {
    id: 'SOLO_RUN', name: '独走', cat: 'stamina', rarity: 3,
    desc: '2位を3馬身以上離すと体力消費-38%', on: 'tick', cd: 3,
    run: (h, c) => {
      if (h.rank !== 1) return false;
      const second = c.all.find(o => o.rank === 2);
      if (second && h.pos - second.pos > 7.8) { c.buff(h, 'drain', 0.62, 3.2); return true; }
      return false;
    },
  },
  {
    id: 'RUSH_UP', name: '追込一閃', cat: 'rank', rarity: 3,
    desc: '最後方を経験した馬が4位以内に上がるとスピード×1.30（4秒）', on: 'overtake', once: true,
    run: (h, c) => {
      if (h.wasLast && h.rank <= 4) { c.buff(h, 'speed', 1.30, 4); return true; }
      return false;
    },
  },

  /* ---------- 体力系 ---------- */
  {
    id: 'RECOVER', name: '回復', cat: 'stamina', rarity: 1,
    desc: '3秒ごとに20%の確率で体力+11', on: 'tick', cd: 3,
    run: (h, c) => { if (c.rng() < 0.20) { c.stam(h, 11); return true; } return false; },
  },
  {
    id: 'GREAT_RECOVER', name: '超回復', cat: 'stamina', rarity: 3,
    desc: '4秒ごとに25%の確率で体力+20', on: 'tick', cd: 4,
    run: (h, c) => { if (c.rng() < 0.25) { c.stam(h, 20); return true; } return false; },
  },
  {
    id: 'ECO', name: '燃費王', cat: 'stamina', rarity: 2,
    desc: '体力消費がレース中ずっと-16%', on: 'start',
    run: (h, c) => { c.buff(h, 'drain', 0.84, 999); return true; },
  },
  {
    id: 'IRON_LUNG', name: '鉄の心肺', cat: 'stamina', rarity: 2,
    desc: 'スタート時に体力+20、体力能力+8', on: 'start',
    run: (h, c) => { c.stam(h, 20); c.sta(h, 8); return true; },
  },
  {
    id: 'GUTS', name: '底力', cat: 'stamina', rarity: 2,
    desc: '体力30%以下のとき4秒間スピード×1.14', on: 'tick', cd: 4,
    run: (h, c) => { if (h.stamina <= h.maxStamina * 0.3) { c.buff(h, 'speed', 1.14, 4.2); return true; } return false; },
  },
  {
    id: 'TOUGH', name: 'しぶとさ', cat: 'stamina', rarity: 2,
    desc: '体力切れによる失速が半分になる', on: 'start',
    run: (h) => { h.tough = true; return true; },
  },
  {
    id: 'GAMBLE', name: '勝負師', cat: 'speed', rarity: 3,
    desc: '残り20%で体力を25消費してスピード×1.26（5秒）', on: 'tick', once: true,
    run: (h, c) => {
      if (c.p > 0.80 && h.stamina > 28) { c.stam(h, -25); c.buff(h, 'speed', 1.26, 5); return true; }
      return false;
    },
  },
  {
    id: 'LATE_BLOOM', name: '大器晩成', cat: 'stamina', rarity: 2,
    desc: 'レースが進むほど速くなる（終盤で最大×1.06）', on: 'tick', cd: 4,
    run: (h, c) => { c.buff(h, 'speed', 1 + 0.06 * c.p, 4.2); return c.p > 0.35; },
  },

  /* ---------- 瞬発・スピード系 ---------- */
  {
    id: 'START_DASH', name: 'スタートダッシュ', cat: 'speed', rarity: 1,
    desc: '発走直後5秒間スピード×1.16', on: 'start',
    run: (h, c) => { c.buff(h, 'speed', 1.16, 5); return true; },
  },
  {
    id: 'SLOW_START', name: '出遅れ', cat: 'debuff', rarity: 1, bad: true,
    desc: '発走直後4秒間スピード×0.82', on: 'start',
    run: (h, c) => { c.buff(h, 'speed', 0.82, 4); return true; },
  },
  {
    id: 'ACCEL', name: '加速装置', cat: 'speed', rarity: 2,
    desc: '加速力+28%（レース中ずっと）', on: 'start',
    run: (h, c) => { c.buff(h, 'accel', 1.28, 999); return true; },
  },
  {
    id: 'HEAVY_START', name: '鈍足始動', cat: 'debuff', rarity: 1, bad: true,
    desc: '加速力-22%（レース中ずっと）', on: 'start',
    run: (h, c) => { c.buff(h, 'accel', 0.78, 999); return true; },
  },
  {
    id: 'FLASH', name: '抜群の瞬発力', cat: 'speed', rarity: 2,
    desc: '3秒ごとに8%の確率でスピード×1.32（1.5秒）', on: 'tick', cd: 3,
    run: (h, c) => { if (c.rng() < 0.08) { c.buff(h, 'speed', 1.32, 1.5); return true; } return false; },
  },
  {
    id: 'STRAIGHT_BOSS', name: '直線番長', cat: 'speed', rarity: 2,
    desc: '最終直線に入るとスピード+22', on: 'straight',
    run: (h, c) => { c.spd(h, 22); return true; },
  },
  {
    id: 'CORNER_ACE', name: 'コーナー巧者', cat: 'speed', rarity: 1,
    desc: 'コーナー進入で8秒間スピード×1.09', on: 'corner',
    run: (h, c) => { c.buff(h, 'speed', 1.09, 8); return true; },
  },
  {
    id: 'CORNER_POOR', name: 'コーナー下手', cat: 'debuff', rarity: 1, bad: true,
    desc: 'コーナー進入で8秒間スピード×0.93', on: 'corner',
    run: (h, c) => { c.buff(h, 'speed', 0.93, 8); return true; },
  },
  {
    id: 'LAST_SPURT', name: '末脚爆発', cat: 'speed', rarity: 3,
    desc: '残り15%でスピード×1.28（5秒）', on: 'tick', once: true,
    run: (h, c) => { if (c.p > 0.85) { c.buff(h, 'speed', 1.28, 5); return true; } return false; },
  },
  {
    id: 'DEMON_LEG', name: '鬼脚', cat: 'speed', rarity: 3,
    desc: '残り10%で加速力+45%＆スピード×1.10', on: 'tick', once: true,
    run: (h, c) => { if (c.p > 0.90) { c.buff(h, 'accel', 1.45, 30); c.buff(h, 'speed', 1.10, 30); return true; } return false; },
  },
  {
    id: 'GOAL_RUSH', name: 'ラストスパート', cat: 'speed', rarity: 2,
    desc: 'ゴール前5%でスピード×1.22', on: 'tick', once: true,
    run: (h, c) => { if (c.p > 0.95) { c.buff(h, 'speed', 1.22, 20); return true; } return false; },
  },
  {
    id: 'ESCAPE', name: '逃げ切り', cat: 'stamina', rarity: 3,
    desc: '序盤で1位ならその後の体力消費-30%', on: 'tick', once: true,
    run: (h, c) => { if (c.p > 0.28 && h.rank === 1) { c.buff(h, 'drain', 0.70, 999); return true; } return false; },
  },
  {
    id: 'SAVE_LEG', name: '差し脚温存', cat: 'speed', rarity: 2,
    desc: '中盤まで×0.97（体力温存）／残り30%から×1.10', on: 'tick', cd: 3,
    run: (h, c) => {
      if (c.p < 0.70) { c.buff(h, 'speed', 0.97, 3.2); return false; }
      c.buff(h, 'speed', 1.10, 3.2); return true;
    },
  },
  {
    id: 'OUTSIDE_RUSH', name: '大外強襲', cat: 'speed', rarity: 2,
    desc: '最終直線で外へ持ち出す。スピード+14（外枠ほど強い）', on: 'straight',
    run: (h, c) => { c.spd(h, 8 + h.frame * 1.6); return true; },
  },
  {
    id: 'INSIDE_STAB', name: '内突き', cat: 'speed', rarity: 3,
    desc: '最終直線で内をつく。60%成功でスピード+26／失敗で-14', on: 'straight',
    run: (h, c) => {
      if (c.rng() < 0.6) { c.spd(h, 26); c.note(h, '内をズバッと突いた！'); }
      else { c.spd(h, -14); c.note(h, '内で詰まった…'); }
      return true;
    },
  },

  /* ---------- 適性・条件系 ---------- */
  {
    id: 'RAIN_LOVER', name: '雨男', cat: 'course', rarity: 2,
    desc: '馬場が重・不良のときスピード+20', on: 'start',
    run: (h, c) => {
      if (c.race.turf === '重' || c.race.turf === '不良') { c.spd(h, 20); return true; }
      return false;
    },
  },
  {
    id: 'SUN_LOVER', name: '晴れ男', cat: 'course', rarity: 1,
    desc: '馬場が良のときスピード+13', on: 'start',
    run: (h, c) => { if (c.race.turf === '良') { c.spd(h, 13); return true; } return false; },
  },
  {
    id: 'LONG_GUN', name: '長距離砲', cat: 'course', rarity: 2,
    desc: '2000m以上で体力能力+18・スピード+8', on: 'start',
    run: (h, c) => {
      if (c.race.distance >= 2000) { c.sta(h, 18); c.spd(h, 8); return true; }
      return false;
    },
  },
  {
    id: 'SPRINTER', name: '短距離砲', cat: 'course', rarity: 2,
    desc: '1600m以下でスピード+18', on: 'start',
    run: (h, c) => { if (c.race.distance <= 1600) { c.spd(h, 18); return true; } return false; },
  },
  {
    id: 'INNER_FRAME', name: '内枠得意', cat: 'course', rarity: 1,
    desc: '1〜4枠でスピード+11', on: 'start',
    run: (h, c) => { if (h.frame <= 4) { c.spd(h, 11); return true; } return false; },
  },
  {
    id: 'OUTER_FRAME', name: '外枠得意', cat: 'course', rarity: 1,
    desc: '5〜8枠でスピード+11', on: 'start',
    run: (h, c) => { if (h.frame >= 5) { c.spd(h, 11); return true; } return false; },
  },
  {
    id: 'DARK_HORSE', name: '伏兵', cat: 'course', rarity: 2,
    desc: '5番人気以下ならスピード+14', on: 'start',
    run: (h, c) => { if (h.popularity >= 5) { c.spd(h, 14); return true; } return false; },
  },
  {
    id: 'FAVORITE', name: '本命の風格', cat: 'course', rarity: 2,
    desc: '1〜2番人気ならスピード+12', on: 'start',
    run: (h, c) => { if (h.popularity <= 2) { c.spd(h, 12); return true; } return false; },
  },
  {
    id: 'CALM', name: '冷静沈着', cat: 'course', rarity: 2,
    desc: '走りのブレが半減して安定する', on: 'start',
    run: (h) => { h.noiseScale = 0.5; return true; },
  },
  {
    id: 'WILD', name: 'ムラ駆け', cat: 'debuff', rarity: 1, bad: true,
    desc: '走りのブレが2倍（大化けも大失速もある）', on: 'start',
    run: (h) => { h.noiseScale = 2.0; return true; },
  },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const SKILL_COUNT = SKILLS.length;
