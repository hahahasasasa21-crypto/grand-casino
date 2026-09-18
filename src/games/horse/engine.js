import { SKILLS, SKILL_BY_ID } from './skills.js';

/* ==========================================================
   競馬エンジン
   ・シード値から出走表とレース結果が完全に決まる（決定論）ので、
     公開レースでは全員がまったく同じレースを見られる。
   ・オッズはモンテカルロ法（同じ条件でレースを何百回も試走）で算出。
   ========================================================== */

/* ---------- 乱数（シード付き） ---------- */
export function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

/* ---------- 基本データ ---------- */
/* 脚質。序盤・中盤・終盤のペース配分。
   「どの脚質でも走破タイムの期待値は同じ」になるよう調整してあり、
   有利不利を分けるのは体力の使い方とスキルの相性。 */
export const RUNNING_STYLES = {
  NIGE: { key: 'NIGE', label: '逃げ', early: 1.060, mid: 1.000, late: 0.946, desc: 'ハナを切って押し切る' },
  SENKO: { key: 'SENKO', label: '先行', early: 1.030, mid: 1.000, late: 0.972, desc: '前目につけて抜け出す' },
  SASHI: { key: 'SASHI', label: '差し', early: 0.975, mid: 1.000, late: 1.026, desc: '中団から差し切る' },
  OIKOMI: { key: 'OIKOMI', label: '追込', early: 0.950, mid: 0.995, late: 1.062, desc: '後方一気の大外強襲' },
};
const STYLE_KEYS = ['NIGE', 'SENKO', 'SASHI', 'OIKOMI'];

export const COURSES = [
  { name: '中山競馬場', surface: '芝', distance: 2500, label: '中山・芝2500m', turnDir: '右', grade: 'GI' },
  { name: '東京競馬場', surface: '芝', distance: 2400, label: '東京・芝2400m', turnDir: '左', grade: 'GI' },
  { name: '阪神競馬場', surface: '芝', distance: 2000, label: '阪神・芝2000m', turnDir: '右', grade: 'GII' },
  { name: '京都競馬場', surface: '芝', distance: 1800, label: '京都・芝1800m', turnDir: '右', grade: 'GIII' },
  { name: '中京競馬場', surface: '芝', distance: 1600, label: '中京・芝1600m', turnDir: '左', grade: 'GII' },
  { name: '新潟競馬場', surface: '芝', distance: 1400, label: '新潟・芝1400m', turnDir: '左', grade: 'GIII' },
  { name: '京都競馬場', surface: '芝', distance: 1200, label: '京都・芝1200m', turnDir: '右', grade: 'GIII' },
  { name: '東京競馬場', surface: 'ダート', distance: 1600, label: '東京・ダ1600m', turnDir: '左', grade: 'GII' },
];

export const WEATHERS = [
  { name: '晴', turf: '良', icon: '☀️', sky: ['#7dd3fc', '#e0f2fe'] },
  { name: '晴', turf: '良', icon: '☀️', sky: ['#60a5fa', '#dbeafe'] },
  { name: '曇', turf: '良', icon: '☁️', sky: ['#94a3b8', '#e2e8f0'] },
  { name: '曇', turf: '稍重', icon: '☁️', sky: ['#7c8798', '#cbd5e1'] },
  { name: '小雨', turf: '稍重', icon: '🌦️', sky: ['#64748b', '#94a3b8'] },
  { name: '雨', turf: '重', icon: '🌧️', sky: ['#475569', '#64748b'] },
  { name: '大雨', turf: '不良', icon: '⛈️', sky: ['#334155', '#475569'] },
];

export const TURF_PENALTY = { '良': 1.0, '稍重': 0.982, '重': 0.962, '不良': 0.938 };
export const TURF_COLOR = { '良': 'text-emerald-400', '稍重': 'text-yellow-400', '重': 'text-orange-400', '不良': 'text-red-400' };

const NAME_A = ['ゴールド', 'シルバー', 'サンライズ', 'メイショウ', 'ダイワ', 'トウカイ', 'キング', 'クイーン', 'ミラクル', 'サイレント',
  'ブラック', 'ホワイト', 'グラン', 'スーパー', 'ハイパー', 'ドリーム', 'エターナル', 'シャイニング', 'レジェンド', 'ロイヤル',
  'マイネル', 'ヒシ', 'タニノ', 'ナリタ', 'シンボリ', 'アグネス', 'ビワ', 'マチカネ', 'サクラ', 'スズカ',
  'ウイニング', 'ブレイジング', 'ラッキー', 'クリムゾン', 'エメラルド', 'サファイア', 'テンポイント', 'カレン', 'オーシャン', 'ステラ'];
const NAME_B = ['スター', 'ブライアン', 'キャップ', 'インパクト', 'シップ', 'オペラ', 'スズカ', 'ルドルフ', 'フラッシュ', 'ウィナー',
  'ロード', 'クラウン', 'ソング', 'ブレイブ', 'アロー', 'ホープ', 'サンダー', 'ブリッツ', 'ノヴァ', 'マーチ',
  'ダンサー', 'ハンター', 'ファイター', 'ソレイユ', 'ルナ', 'ヴィクトリー', 'ジュエル', 'スピリット', 'テイオー', 'グロリア',
  'エース', 'バロン', 'コメット', 'ミラージュ', 'ゼファー', 'タイフーン', 'ファルコン', 'レイン', 'シャドウ', 'オーラ'];

const JOCKEYS = ['武藤 豊', '岡部 幸', '横山 典', '福永 祐', '川田 将', '戸崎 圭', '松山 弘', '坂井 瑠',
  'ルメール', 'デムーロ', '池添 謙', '浜中 俊', '岩田 望', '鮫島 駿', '西村 淳', '菅原 明',
  '和田 竜', '内田 博', '田辺 裕', '三浦 皇', '幸 英明', '北村 友'];

const SILKS = [
  { bg: '#f8fafc', fg: '#0f172a' }, { bg: '#111827', fg: '#f9fafb' }, { bg: '#dc2626', fg: '#ffffff' },
  { bg: '#2563eb', fg: '#ffffff' }, { bg: '#ca8a04', fg: '#1f2937' }, { bg: '#16a34a', fg: '#ffffff' },
  { bg: '#9333ea', fg: '#ffffff' }, { bg: '#0891b2', fg: '#ffffff' }, { bg: '#f97316', fg: '#1f2937' },
  { bg: '#ec4899', fg: '#ffffff' }, { bg: '#14b8a6', fg: '#062a26' }, { bg: '#64748b', fg: '#f8fafc' },
  { bg: '#a3e635', fg: '#1a2e05' }, { bg: '#7c2d12', fg: '#fed7aa' }, { bg: '#1e1b4b', fg: '#c7d2fe' },
  { bg: '#fcd34d', fg: '#451a03' },
];

/** 馬番→枠番（JRA方式に近い簡易版） */
function frameOf(num, total) {
  if (total <= 8) return num;
  const per = Math.ceil(total / 8);
  return Math.min(8, Math.ceil(num / per));
}

export const CONDITIONS = [
  { min: 6, label: '絶好調', color: '#34d399', mult: 1.018 },
  { min: 2, label: '好調', color: '#a3e635', mult: 1.008 },
  { min: -2, label: '普通', color: '#94a3b8', mult: 1.0 },
  { min: -6, label: 'やや不安', color: '#fbbf24', mult: 0.992 },
  { min: -99, label: '不調', color: '#f87171', mult: 0.982 },
];
const condOf = (form) => CONDITIONS.find(c => form >= c.min) || CONDITIONS[CONDITIONS.length - 1];

/* ==========================================================
   出走表の生成（seed から完全に決まる）
   ========================================================== */
export function buildRaceCard(seed, opts = {}) {
  const rng = mulberry32(seed);
  const course = opts.course || pick(rng, COURSES);
  const weather = opts.weather || pick(rng, WEATHERS);
  const count = opts.count || randInt(rng, 8, 12);

  const usedNames = new Set();
  const entries = [];
  for (let i = 0; i < count; i++) {
    let name = '';
    let guard = 0;
    do { name = pick(rng, NAME_A) + pick(rng, NAME_B); guard++; } while (usedNames.has(name) && guard < 30);
    usedNames.add(name);

    const speed = randInt(rng, 52, 98);
    const stamina = randInt(rng, 52, 98);
    const form = Math.round((rng() * 18 - 9) * 10) / 10;
    const styleKey = pick(rng, STYLE_KEYS);

    // スキルは 2〜4 個。不利スキルも混ざる（それがオッズに反映される）
    const nSkill = randInt(rng, 2, 4);
    const pool = [...SKILLS];
    const skills = [];
    for (let k = 0; k < nSkill && pool.length; k++) {
      // レア度が低いものほど出やすい
      let idx = Math.floor(rng() * pool.length);
      if (pool[idx].rarity === 3 && rng() > 0.42) idx = Math.floor(rng() * pool.length);
      skills.push(pool[idx].id);
      pool.splice(idx, 1);
    }

    entries.push({
      id: i + 1,
      num: i + 1,
      frame: frameOf(i + 1, count),
      name,
      jockey: JOCKEYS[(Math.floor(rng() * JOCKEYS.length)) % JOCKEYS.length],
      silk: SILKS[i % SILKS.length],
      speed, stamina, form,
      condition: condOf(form).label,
      conditionColor: condOf(form).color,
      style: styleKey,
      skills,
      weight: randInt(rng, 440, 528),
      age: randInt(rng, 3, 7),
    });
  }

  return {
    seed,
    course,
    weather,
    distance: course.distance,
    turf: weather.turf,
    entries,
    raceName: `${course.grade} ${pick(rng, ['ユタポンカジノ記念', 'ターフチャレンジ', 'ゴールデンカップ', 'エメラルドステークス', 'ロイヤルマイル', 'クラウンダービー', 'ミッドナイト賞', 'フォーチュン特別'])}`,
  };
}

/* ==========================================================
   レースシミュレーション
   ------------------------------------------------------------
   90〜150秒走り続けるので「ずっと効く効果」はごく小さく、
   「数秒だけ効く効果」は大きく効くようにしてある。
   勝敗を最終的に分けるのは主に “体力（スタミナ）” と終盤のスキル。
   ========================================================== */
const DT = 0.2;              // シミュレーションの刻み（秒）
export const SIM_DT = DT;

const SPD_A = 15.35;         // 基準速度(m/s)
const SPD_B = 0.85;          // スピード能力100あたりの上乗せ
const LUCK_AMP = 0.110;      // 当日の出来（レースごとの運）
const NOISE_STEP = 0.060;    // 走行中のブレ
const NOISE_DECAY = 0.90;
const DRAIN_K = 0.72;        // 体力消費係数
const ACCEL_BASE = 1.30;     // 基本加速力(1/s)
const TROUBLE_P = 0.0009;    // 1ティックあたりの不利（前が詰まる等）発生率
const STAM_FLOOR = 0.88;     // 体力切れ時の最低速度倍率
const TOUGH_FLOOR = 0.94;    // 「しぶとさ」持ちの最低速度倍率
const STAM_KNEE = 0.28;      // 体力が何割を切ると失速し始めるか

/** コースのフェーズ（0..1 の進捗） */
export function phaseOf(p) {
  if (p < 0.13) return 'START';
  if (p < 0.34) return 'CORNER12';
  if (p < 0.60) return 'BACK';
  if (p < 0.82) return 'CORNER34';
  return 'HOME';
}
export const PHASE_LABEL = {
  START: 'スタート直後', CORNER12: '1〜2コーナー', BACK: '向正面', CORNER34: '3〜4コーナー', HOME: '最終直線',
};

export function createSim(card, raceSeed, { log = false } = {}) {
  const rng = mulberry32(raceSeed >>> 0);
  const dist = card.distance;
  const turfM = TURF_PENALTY[card.turf] ?? 1;
  const raceCtxBase = { turf: card.turf, distance: dist, surface: card.course.surface };

  const horses = card.entries.map(e => {
    const cond = CONDITIONS.find(c => e.form >= c.min) || CONDITIONS[CONDITIONS.length - 1];
    const luck = 1 + (rng() - 0.5) * LUCK_AMP;
    const h = {
      id: e.id, num: e.num, frame: e.frame, name: e.name, jockey: e.jockey, silk: e.silk,
      style: e.style, skills: e.skills, popularity: e.popularity || 99,
      spdStat: e.speed, stamStat: e.stamina,
      condMul: cond.mult, luck,
      baseTop: 0,
      stamina: 0, maxStamina: 0,
      pos: 0, v: 0, rank: e.id, lastRank: e.id,
      overtakenCount: 0, overtakeCount: 0, wasLast: false,
      buffs: [], cds: {}, used: {}, nz: 0,
      immuneDebuff: false, tough: false, noiseScale: 1,
      gate: 1 + (rng() - 0.5) * 0.14,
      finishTime: null, lane: e.id - 1,
      lastActivation: null, trouble: 0,
    };
    h.baseTop = (SPD_A + (h.spdStat / 100) * SPD_B) * h.condMul * h.luck;
    h.maxStamina = 58 + (h.stamStat / 100) * 50;
    h.stamina = h.maxStamina;
    return h;
  });

  const state = { t: 0, tick: 0, finished: 0, order: [], events: [], phase: 'START', done: false };
  const n = horses.length;

  /* --- スキル用ヘルパー --- */
  const buff = (h, k, m, dur) => {
    if (h.immuneDebuff && m < 1 && k === 'speed') return;
    h.buffs.push({ k, m, until: state.t + dur });
  };
  const spd = (h, d) => {
    h.spdStat = Math.max(5, h.spdStat + d);
    h.baseTop = (SPD_A + (h.spdStat / 100) * SPD_B) * h.condMul * h.luck;
  };
  const sta = (h, d) => {
    h.stamStat = Math.max(5, h.stamStat + d);
    const nm = 58 + (h.stamStat / 100) * 50;
    h.stamina += Math.max(0, nm - h.maxStamina);
    h.maxStamina = nm;
  };
  const stam = (h, d) => { h.stamina = Math.max(0, Math.min(h.maxStamina, h.stamina + d)); };
  const note = (h, msg) => { if (log) state.events.push({ t: state.t, id: h.id, kind: 'note', text: msg, name: h.name }); };
  const ctx = { p: 0, t: 0, dt: DT, rng, all: horses, race: raceCtxBase, buff, spd, sta, stam, note };

  function fire(h, when) {
    for (let i = 0; i < h.skills.length; i++) {
      const sk = SKILL_BY_ID[h.skills[i]];
      if (!sk || sk.on !== when) continue;
      if (sk.once && h.used[sk.id]) continue;
      if (sk.cd && (h.cds[sk.id] || 0) > state.t) continue;
      ctx.p = h.pos / dist;
      ctx.t = state.t;
      const ok = sk.run(h, ctx);
      if (sk.cd) h.cds[sk.id] = state.t + sk.cd;
      if (ok) {
        if (sk.once) h.used[sk.id] = true;
        h.lastActivation = { id: sk.id, name: sk.name, t: state.t, bad: !!sk.bad };
        if (log) state.events.push({ t: state.t, id: h.id, kind: 'skill', skillId: sk.id, name: sk.name, horse: h.name, bad: !!sk.bad });
      }
    }
  }

  // 発走
  horses.forEach(h => fire(h, 'start'));

  function step() {
    if (state.done) return state;
    state.tick++;
    state.t += DT;

    // 先頭位置（隊列のまとまりを保つために使う）
    let leadPos = 0, secondPos = 0;
    for (let i = 0; i < n; i++) {
      const q = horses[i].pos;
      if (q > leadPos) { secondPos = leadPos; leadPos = q; }
      else if (q > secondPos) secondPos = q;
    }

    for (let i = 0; i < n; i++) {
      const h = horses[i];
      if (h.finishTime !== null) continue;
      const p = h.pos / dist;

      // バフの整理（加算合成 + クランプで暴走を防ぐ）
      let sAdd = 0, aMul = 1, dMul = 1;
      let w = 0;
      for (let b = 0; b < h.buffs.length; b++) {
        const bf = h.buffs[b];
        if (bf.until <= state.t) continue;
        if (bf.k === 'speed') sAdd += bf.m - 1;
        else if (bf.k === 'accel') aMul *= bf.m;
        else dMul *= bf.m;
        h.buffs[w++] = bf;
      }
      h.buffs.length = w;
      let sMul = 1 + sAdd;
      if (sMul > 1.45) sMul = 1.45;
      if (sMul < 0.62) sMul = 0.62;

      const st = RUNNING_STYLES[h.style];
      const styleM = p < 0.32 ? st.early : p < 0.68 ? st.mid : st.late;
      const homeM = p > 0.84 ? 1.02 : 1;
      const gateM = state.t < 3 ? h.gate : 1;
      const ratio = h.stamina / h.maxStamina;
      const fl = h.tough ? TOUGH_FLOOR : STAM_FLOOR;
      const staminaM = ratio >= STAM_KNEE ? 1 : fl + (1 - fl) * (ratio / STAM_KNEE);

      // なだらかに揺れるノイズ（コースのアヤ）
      h.nz = h.nz * NOISE_DECAY + (rng() - 0.5) * NOISE_STEP * h.noiseScale;
      if (h.nz > 0.09) h.nz = 0.09;
      if (h.nz < -0.09) h.nz = -0.09;

      // 不利（前が詰まる・接触など）
      if (h.trouble > 0) h.trouble -= DT;
      else if (rng() < TROUBLE_P) {
        h.trouble = 2.2;
        buff(h, 'speed', 0.88, 2.2);
        if (log) state.events.push({ t: state.t, id: h.id, kind: 'note', text: '前が詰まった！', name: h.name });
      }

      // 隊列のまとまり：離された馬は少し追い上げ、独走馬は少し息を入れる
      const gapBack = leadPos - h.pos;
      let cohesion = 1;
      if (gapBack > 12) cohesion = 1 + Math.min(0.105, (gapBack - 12) * 0.0030);
      else if (h.pos >= leadPos && leadPos - secondPos > 10) cohesion = 1 - Math.min(0.05, (leadPos - secondPos - 10) * 0.0022);

      const target = h.baseTop * styleM * homeM * gateM * turfM * sMul * staminaM * cohesion * (1 + h.nz);
      const k = Math.min(1, ACCEL_BASE * aMul * DT);
      h.v += (target - h.v) * k;
      h.pos += h.v * DT;

      const r = h.v / h.baseTop;
      const drain = DRAIN_K * (r * r * r * Math.sqrt(r > 0 ? r : 0)) * DT * dMul / (0.5 + (h.stamStat / 100) * 1.0);
      h.stamina = h.stamina > drain ? h.stamina - drain : 0;

      if (h.pos >= dist) {
        const over = (h.pos - dist) / (h.v > 0.001 ? h.v : 0.001);
        h.finishTime = state.t - over;
        h.pos = dist;
        state.finished++;
        state.order.push(h);
        state.order.sort((a, b) => a.finishTime - b.finishTime);
      }
    }

    // 順位
    const sorted = horses.slice().sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      return b.pos - a.pos;
    });
    for (let i = 0; i < n; i++) {
      const h = sorted[i];
      h.lastRank = h.rank;
      h.rank = i + 1;
      if (h.rank === n) h.wasLast = true;
    }

    // イベント発火
    const prevPhase = state.phase;
    const lead = sorted[0];
    state.phase = phaseOf(lead.pos / dist);

    for (let i = 0; i < n; i++) {
      const h = horses[i];
      if (h.finishTime !== null) continue;
      if (h.rank > h.lastRank) { h.overtakenCount++; fire(h, 'overtaken'); }
      else if (h.rank < h.lastRank) { h.overtakeCount++; fire(h, 'overtake'); }
      const hp = h.pos / dist;
      if (!h._c12 && hp >= 0.13) { h._c12 = 1; fire(h, 'corner'); }
      if (!h._c34 && hp >= 0.60) { h._c34 = 1; fire(h, 'corner'); }
      if (!h._home && hp >= 0.82) { h._home = 1; fire(h, 'straight'); }
      fire(h, 'tick');
    }
    if (prevPhase !== state.phase && log) {
      state.events.push({ t: state.t, kind: 'phase', phase: state.phase });
    }

    if (state.finished >= n) state.done = true;
    return state;
  }

  function runToEnd(maxTicks = 3000) {
    while (!state.done && state.tick < maxTicks) step();
    if (!state.done) {
      horses.forEach(h => {
        if (h.finishTime === null) { h.finishTime = state.t + (dist - h.pos); state.order.push(h); }
      });
      state.order.sort((a, b) => a.finishTime - b.finishTime);
      state.done = true;
    }
    return state;
  }

  return { horses, state, step, runToEnd, dist, DT };
}

/* ==========================================================
   オッズ算出（モンテカルロ）
   ========================================================== */
export function computeWinProbs(card, trials = 160) {
  const n = card.entries.length;
  const acc = { wins: new Array(n).fill(0), top3: new Array(n).fill(0), rankSum: new Array(n).fill(0), done: 0 };
  for (let i = 0; i < trials; i++) runTrial(card, acc, i);
  return finishProbs(acc, trials, n);
}

function runTrial(card, acc, i) {
  const sim = createSim(card, (card.seed * 2654435761 + i * 40503 + 12345) >>> 0);
  const st = sim.runToEnd();
  const order = st.order;
  if (!order.length) return;
  acc.wins[order[0].id - 1] += 1;
  for (let k = 0; k < order.length; k++) {
    acc.rankSum[order[k].id - 1] += k + 1;
    if (k < 3) acc.top3[order[k].id - 1] += 1;
  }
  acc.done++;
}

function finishProbs(acc, trials, n) {
  // 平均着順から「地力の事前分布」を作り、試走回数が少なくても
  // オッズが同じ値に張り付かないようにする
  const meanRank = acc.rankSum.map(r => r / Math.max(1, acc.done));
  const sc = meanRank.map(r => Math.exp(-(r - 1) / 1.7));
  const scSum = sc.reduce((a, b) => a + b, 0) || 1;
  const prior = sc.map(x => x / scSum);

  const sc3 = meanRank.map(r => Math.exp(-(r - 2) / 2.4));
  const sc3Sum = sc3.reduce((a, b) => a + b, 0) || 1;
  const prior3 = sc3.map(x => Math.min(0.95, (x / sc3Sum) * 3));

  const K = 12;
  const win = acc.wins.map((w, i) => Math.max(0.0012, (w + K * prior[i]) / (trials + K)));
  const wSum = win.reduce((a, b) => a + b, 0);
  const place = acc.top3.map((w, i) => Math.min(0.97, Math.max(0.01, (w + K * prior3[i]) / (trials + K))));
  return { win: win.map(x => x / wSum), place };
}

/**
 * オッズ算出を少しずつ進める非同期版。
 * 一気に計算すると画面が固まるので、数回ずつに分けて実行する。
 */
export function computeWinProbsAsync(card, trials, onProgress) {
  const n = card.entries.length;
  const acc = { wins: new Array(n).fill(0), top3: new Array(n).fill(0), rankSum: new Array(n).fill(0), done: 0 };
  let i = 0;
  const batch = Math.max(4, Math.round(trials / 18));
  return new Promise(resolve => {
    const run = () => {
      const end = Math.min(trials, i + batch);
      for (; i < end; i++) runTrial(card, acc, i);
      if (onProgress) onProgress(i / trials);
      if (i < trials) setTimeout(run, 0);
      else resolve(finishProbs(acc, trials, n));
    };
    run();
  });
}

const PAYOUT_RATE = 0.80;   // 控除率20%（JRA相当）
const round1 = (x) => Math.round(x * 10) / 10;

/**
 * 勝率からオッズを付けて出走表を確定させる。
 * 「伏兵」「本命の風格」など人気に依存するスキルがあるため 2 段階で計算する。
 *   1回目 … 人気なしで試走 → 仮の人気順を決める
 *   2回目 … 人気を入れて試走 → 本オッズ
 */
export function attachOdds(card, trials = 160) {
  const assignPop = (c, probs) => {
    const ranked = c.entries.map((e, i) => ({ id: e.id, p: probs.win[i] })).sort((a, b) => b.p - a.p);
    return {
      ...c,
      entries: c.entries.map(e => ({ ...e, popularity: ranked.findIndex(r => r.id === e.id) + 1 })),
    };
  };
  const pre = computeWinProbs(card, Math.max(32, Math.round(trials * 0.32)));
  const staged = assignPop(card, pre);
  const probs = computeWinProbs(staged, trials);
  return finalizeCard(card, assignPop(staged, probs), probs);
}

/** 進捗コールバック付きの非同期版（UIを固めない） */
export async function attachOddsAsync(card, trials = 130, onProgress) {
  const assignPop = (c, probs) => {
    const ranked = c.entries.map((e, i) => ({ id: e.id, p: probs.win[i] })).sort((a, b) => b.p - a.p);
    return { ...c, entries: c.entries.map(e => ({ ...e, popularity: ranked.findIndex(r => r.id === e.id) + 1 })) };
  };
  const pre = await computeWinProbsAsync(card, Math.max(32, Math.round(trials * 0.32)), p => onProgress && onProgress(p * 0.28));
  const staged = assignPop(card, pre);
  const probs = await computeWinProbsAsync(staged, trials, p => onProgress && onProgress(0.28 + p * 0.72));
  return finalizeCard(card, assignPop(staged, probs), probs);
}

function finalizeCard(card, withPop, probs) {
  const entries = withPop.entries.map((e, i) => ({
    ...e,
    winProb: probs.win[i],
    placeProb: probs.place[i],
    odds: Math.min(999, Math.max(1.1, round1(PAYOUT_RATE / probs.win[i]))),
    placeOdds: Math.min(99, Math.max(1.1, round1((PAYOUT_RATE + 0.02) / probs.place[i]))),
  }));
  return { ...card, entries, probs };
}

/* ==========================================================
   馬券の種類と払戻倍率（Harville モデル）
   ========================================================== */
export const BET_TYPES = {
  WIN: { key: 'WIN', label: '単勝', desc: '1着になる馬を当てる', picks: 1, ordered: false },
  PLACE: { key: 'PLACE', label: '複勝', desc: '3着以内に入る馬を当てる', picks: 1, ordered: false },
  QUINELLA: { key: 'QUINELLA', label: '馬連', desc: '1・2着の組み合わせ（順不同）', picks: 2, ordered: false },
  EXACTA: { key: 'EXACTA', label: '馬単', desc: '1・2着を着順どおり', picks: 2, ordered: true },
  WIDE: { key: 'WIDE', label: 'ワイド', desc: '選んだ2頭がともに3着以内', picks: 2, ordered: false },
  TRIO: { key: 'TRIO', label: '三連複', desc: '1〜3着の組み合わせ（順不同）', picks: 3, ordered: false },
  TRIFECTA: { key: 'TRIFECTA', label: '三連単', desc: '1〜3着を着順どおり', picks: 3, ordered: true },
};

function pOf(entries, id) {
  const e = entries.find(x => x.id === id);
  return e ? e.winProb : 0.001;
}

/** A→B→C の順で入る確率（Harville） */
function pSeq(entries, ids) {
  let rest = 1, prob = 1;
  for (const id of ids) {
    const p = pOf(entries, id);
    prob *= p / Math.max(1e-6, rest);
    rest -= p;
    if (rest <= 1e-6) break;
  }
  return Math.max(1e-6, prob);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((v, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    permutations(rest).forEach(p => out.push([v, ...p]));
  });
  return out;
}

export function payoutMultiplier(type, picks, entries) {
  if (!picks || picks.length !== BET_TYPES[type].picks) return 0;
  const e = entries;
  switch (type) {
    case 'WIN': {
      const t = e.find(x => x.id === picks[0]);
      return t ? t.odds : 0;
    }
    case 'PLACE': {
      const t = e.find(x => x.id === picks[0]);
      return t ? t.placeOdds : 0;
    }
    case 'EXACTA':
      return Math.max(1.5, round1(PAYOUT_RATE / pSeq(e, picks)));
    case 'QUINELLA': {
      const p = pSeq(e, picks) + pSeq(e, [picks[1], picks[0]]);
      return Math.max(1.3, round1(PAYOUT_RATE / p));
    }
    case 'WIDE': {
      // 2頭がともに3着以内 = 3着までの並びのうち両方を含むもの
      const others = e.filter(x => !picks.includes(x.id)).map(x => x.id);
      let p = 0;
      permutations(picks).forEach(([a, b]) => {
        p += pSeq(e, [a, b]);                    // 1-2着
        others.forEach(o => {
          p += pSeq(e, [a, o, b]);               // 1-3着
          p += pSeq(e, [o, a, b]);               // 2-3着
        });
      });
      return Math.max(1.1, round1(PAYOUT_RATE / Math.max(1e-6, p)));
    }
    case 'TRIFECTA':
      return Math.max(3, round1(PAYOUT_RATE / pSeq(e, picks)));
    case 'TRIO': {
      let p = 0;
      permutations(picks).forEach(perm => { p += pSeq(e, perm); });
      return Math.max(2, round1(PAYOUT_RATE / Math.max(1e-6, p)));
    }
    default: return 0;
  }
}

export function checkHit(type, picks, orderIds) {
  const [a, b, c] = orderIds;
  const top3 = [a, b, c];
  switch (type) {
    case 'WIN': return picks[0] === a;
    case 'PLACE': return top3.includes(picks[0]);
    case 'QUINELLA': return [a, b].slice().sort().join() === [...picks].sort().join();
    case 'EXACTA': return picks[0] === a && picks[1] === b;
    case 'WIDE': return picks.every(p => top3.includes(p));
    case 'TRIO': return top3.slice().sort().join() === [...picks].sort().join();
    case 'TRIFECTA': return picks[0] === a && picks[1] === b && picks[2] === c;
    default: return false;
  }
}

/* ==========================================================
   情報開示のコスト
   「賭け金が高いほど1回の開示単価が高くなる」
   ========================================================== */
export const REVEAL_FIELDS = ['speed', 'stamina', 'odds', 'skills'];
/** 1頭につきコインで開示できるのはこの数まで（全知の望遠鏡だけが例外） */
export const MAX_REVEAL_PER_HORSE = 2;
export const REVEAL_LABEL = { speed: 'スピード', stamina: '体力', odds: 'オッズ', skills: 'スキル' };

export function revealCost(betAmount, revealsUsed) {
  const base = 200 + Math.floor((betAmount || 0) * 0.4);
  return Math.ceil(base * Math.pow(1.25, revealsUsed));
}

/* ==========================================================
   実況コメント
   ========================================================== */
export function commentaryFor(state, horses, card) {
  const sorted = horses.slice().sort((a, b) => b.pos - a.pos);
  const lead = sorted[0];
  const second = sorted[1];
  const p = lead.pos / card.distance;
  const gap = second ? Math.round((lead.pos - second.pos) / 2.4 * 10) / 10 : 0;
  if (p < 0.12) return `スタートしました！${lead.name}が good start、${RUNNING_STYLES[lead.style].label}から先手を取る！`;
  if (p < 0.34) return `1〜2コーナー。${lead.name}が先頭、${gap}馬身のリード。${second ? second.name : ''}が２番手につけています。`;
  if (p < 0.60) return `向正面、隊列が落ち着きました。先頭は${lead.name}。後方から${sorted[sorted.length - 1].name}がじわり動き出す。`;
  if (p < 0.82) return `3〜4コーナー、各馬仕掛けどころ！${lead.name}の脚色は衰えないか！`;
  if (p < 0.95) return `最終直線！${lead.name}が粘る、${second ? second.name : ''}が外から強襲だ！`;
  return `ゴール前、大接戦！${lead.name}か、${second ? second.name : ''}か！`;
}
