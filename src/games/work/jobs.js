/* ==========================================================
   YUTAPON WORKS — 仕事・資格・就職のデータ
   ・アルバイト … 誰でもすぐ働ける。ミニゲームの出来で日給が決まる
   ・資格      … 受験料を払って試験に合格すると取得。就職の条件になる
   ・就職      … 採用試験に受かると社員に。給料（時間経過）＋出勤（ミニゲーム）
                 経験値がたまると昇進試験を受けられる
   ========================================================== */

/* ---------- ミニゲームの種類 ---------- */
export const GAMES = {
  WORD: { key: 'WORD', name: '英単語', icon: '📚', desc: '日本語を見て英単語を入力' },
  TYPING: { key: 'TYPING', name: 'タイピング', icon: '⌨️', desc: '表示された文をそのまま打つ' },
  CALC: { key: 'CALC', name: '暗算', icon: '🧮', desc: '計算の答えを入力' },
  MEMORY: { key: 'MEMORY', name: '記憶', icon: '🧠', desc: '並びを覚えて同じ順に押す' },
  SORT: { key: 'SORT', name: '仕分け', icon: '📦', desc: '品物を正しい箱へ入れる' },
  INSPECT: { key: 'INSPECT', name: '検品', icon: '🔍', desc: 'ひとつだけ違うものを探す' },
  LOAN: { key: 'LOAN', name: '融資審査', icon: '🏦', desc: '申込書を読み、貸すか断るかを決める' },
  FRAUD: { key: 'FRAUD', name: '不正検知', icon: '🕵️', desc: '配当が合っていない記録を見つける' },
  CHOICE: { key: 'CHOICE', name: '筆記試験', icon: '📝', desc: '4つの選択肢から正解を選ぶ' },
  FLASH: { key: 'FLASH', name: 'フラッシュ暗算', icon: '⚡', desc: '一瞬ずつ光る数字を足していく' },
};
export const gameOf = (k) => GAMES[k] || GAMES.WORD;

/* ---------- アルバイト（資格なしで働ける） ---------- */
export const PART_TIME = [
  { key: 'POST', name: 'ポスティング', icon: '📮', game: 'SORT', diff: 1, pay: 450, cool: 30000, desc: 'チラシを地区ごとに仕分けて配る。' },
  { key: 'TISSUE', name: 'ティッシュ配り', icon: '🧻', game: 'INSPECT', diff: 1, pay: 500, cool: 30000, desc: '受け取ってくれそうな人を見分ける。' },
  { key: 'WORDPT', name: '英単語バイト', icon: '📚', game: 'WORD', diff: 1, pay: 600, cool: 30000, desc: '単語カードの検収作業。昔ながらのバイト。' },
  { key: 'TRAFFIC', name: '交通整理', icon: '🚧', game: 'MEMORY', diff: 1, pay: 650, cool: 35000, desc: '通した車の順番を覚えておく。' },
  { key: 'CONVENI', name: 'コンビニ店員', icon: '🏪', game: 'CALC', diff: 2, pay: 900, cool: 40000, desc: 'レジ打ちとおつりの計算。' },
  { key: 'CAFE', name: 'カフェ店員', icon: '☕', game: 'MEMORY', diff: 2, pay: 950, cool: 40000, desc: '注文を聞いて順番どおりに出す。' },
  { key: 'WAREHOUSE', name: '倉庫仕分け', icon: '📦', game: 'SORT', diff: 2, pay: 1000, cool: 40000, desc: '流れてくる荷物を行き先別に。' },
  { key: 'DATA', name: 'データ入力', icon: '⌨️', game: 'TYPING', diff: 2, pay: 1100, cool: 40000, desc: '伝票をひたすら打ち込む。' },
  { key: 'QCPT', name: '検品スタッフ', icon: '🔍', game: 'INSPECT', diff: 2, pay: 1200, cool: 45000, desc: 'ラインを流れる製品の不良を見つける。' },
  { key: 'CRAM', name: '塾講師', icon: '🎓', game: 'WORD', diff: 3, pay: 1600, cool: 50000, desc: '中高生に英単語を教える。' },
  { key: 'CALLC', name: 'コールセンター', icon: '📞', game: 'TYPING', diff: 3, pay: 1800, cool: 50000, desc: '聞きながら記録を打ち込む。' },
  { key: 'MOVING', name: '引っ越し作業', icon: '🚚', game: 'SORT', diff: 3, pay: 2000, cool: 55000, desc: '荷物を部屋ごとに振り分ける。体力勝負。' },
  { key: 'NIGHT', name: '夜間警備', icon: '🔦', game: 'INSPECT', diff: 3, pay: 2200, cool: 60000, desc: '深夜のビルで異常を見つける。' },
  { key: 'MARKET', name: '市場の競り子', icon: '🐟', game: 'CALC', diff: 3, pay: 2400, cool: 60000, desc: '早朝の市場で値段を即座に計算。' },
];
export const partTimeOf = (k) => PART_TIME.find(j => j.key === k) || null;

/* ---------- 資格 ---------- */
export const LICENSES = [
  { key: 'ENG', name: '英語検定', icon: '🇬🇧', fee: 5000, game: 'WORD', diff: 3, pass: 0.8, req: [], desc: '英語の読み書きができる証明。' },
  { key: 'TYPE', name: 'タイピング技能士', icon: '⌨️', fee: 5000, game: 'TYPING', diff: 3, pass: 0.8, req: [], desc: '速く正確に打てる証明。' },
  { key: 'ABACUS', name: '珠算検定', icon: '🧮', fee: 5000, game: 'CALC', diff: 3, pass: 0.8, req: [], desc: '暗算の速さの証明。' },
  { key: 'MEMO', name: '記憶力検定', icon: '🧠', fee: 6000, game: 'MEMORY', diff: 3, pass: 0.8, req: [], desc: '短期記憶の強さの証明。' },
  { key: 'QC', name: '品質管理士', icon: '🔍', fee: 6000, game: 'INSPECT', diff: 3, pass: 0.8, req: [], desc: '不良品を見抜く目の証明。' },
  { key: 'COOK', name: '調理師免許', icon: '🍳', fee: 12000, game: 'SORT', diff: 4, pass: 0.8, req: [], desc: '食材の扱いと衛生の国家資格。' },
  { key: 'DEALER', name: 'ディーラー資格', icon: '🃏', fee: 15000, game: 'CALC', diff: 4, pass: 0.85, req: ['ABACUS'], desc: 'カジノでテーブルを任される資格。' },
  { key: 'BOOK', name: '簿記2級', icon: '📒', fee: 15000, game: 'CALC', diff: 4, pass: 0.85, req: ['ABACUS'], desc: '帳簿を読み書きできる証明。' },
  { key: 'IT', name: '情報処理技術者', icon: '💻', fee: 18000, game: 'TYPING', diff: 4, pass: 0.85, req: ['TYPE'], desc: 'システムを設計・実装できる証明。' },
  { key: 'SEC', name: '証券外務員', icon: '📈', fee: 20000, game: 'CALC', diff: 4, pass: 0.85, req: ['BOOK'], desc: '金融商品を扱える資格。' },
  { key: 'TEACH', name: '教員免許', icon: '🎓', fee: 20000, game: 'WORD', diff: 4, pass: 0.85, req: ['ENG'], desc: '学校で教えるための免許。' },
  { key: 'ARCH', name: '建築士', icon: '📐', fee: 25000, game: 'MEMORY', diff: 4, pass: 0.85, req: ['QC'], desc: '建物を設計できる国家資格。' },
  { key: 'PILOT', name: '操縦士免許', icon: '✈️', fee: 55000, game: 'INSPECT', diff: 5, pass: 0.9, req: ['QC', 'MEMO'], desc: '旅客機を操縦できる免許。' },
  {
    key: 'DOC', name: '医師免許', icon: '🩺', fee: 60000, game: 'MEMORY', diff: 5, pass: 0.9, req: ['MEMO', 'QC'],
    desc: '医療行為を行える国家資格。【2次試験まである最難関】',
    stages: [
      { game: 'MEMORY', diff: 5, pass: 0.9, name: '1次：記憶試験（激ムズ）' },
      { game: 'INSPECT', diff: 5, pass: 0.85, cols: 9, rounds: 6, name: '2次：所見の読影（超広範囲）' },
    ],
  },
  { key: 'LAW', name: '弁護士資格', icon: '⚖️', fee: 60000, game: 'WORD', diff: 5, pass: 0.9, req: ['TEACH'], desc: '法廷に立てる資格。最難関のひとつ。' },
  { key: 'PHD', name: '博士号', icon: '🔬', fee: 80000, game: 'WORD', diff: 5, pass: 0.9, req: ['TEACH', 'ARCH'], desc: '研究者として認められた証。' },
];
export const licenseOf = (k) => LICENSES.find(l => l.key === k) || null;

/* ---------- 役職（全職種で共通のはしご） ---------- */
export const RANKS = [
  { name: '見習い', mult: 1.00, exp: 0 },
  { name: '一般社員', mult: 1.35, exp: 150 },
  { name: '主任', mult: 1.75, exp: 450 },
  { name: '係長', mult: 2.25, exp: 900 },
  { name: '課長', mult: 2.90, exp: 1500 },
  { name: '部長', mult: 3.70, exp: 2300 },
  { name: '役員', mult: 4.80, exp: 3300 },
];

/* ---------- 学歴のレベル ---------- */
export const EDU = { NONE: 0, HIGH: 1, VOC: 2, UNI: 3 };
export const EDU_LABEL = ['学歴不問', '高卒以上', '専門卒以上', '大卒以上'];

/* ---------- 就職できる仕事 ----------
   eduReq … 必要な学歴　volatile … 出来ばえで報酬が大きく化ける仕事
   group  … YUTAPON-GROUP の部署（FLY / BANK / CASINO） */
export const CAREERS = [
  {
    key: 'SALES', name: '販売スタッフ', icon: '🛍️', field: '小売', eduReq: 0,
    req: [], minWorkExp: 120, salary: 380, shiftPay: 1300, shift: { game: 'MEMORY', diff: 2 },
    exam: { game: 'MEMORY', diff: 2, pass: 0.6 }, desc: '店頭に立ち、客の要望を覚えて応える。',
  },
  {
    key: 'CLERK', name: '事務員', icon: '🗂️', field: '事務', eduReq: 1,
    req: ['TYPE'], minWorkExp: 0, salary: 520, shiftPay: 1600, shift: { game: 'TYPING', diff: 2 },
    exam: { game: 'TYPING', diff: 3, pass: 0.65 }, desc: '書類作成とデータ管理。高卒から入れる。',
  },
  {
    key: 'SECURITY', name: '警備主任', icon: '🛡️', field: '警備', eduReq: 1,
    req: ['QC'], minWorkExp: 150, salary: 680, shiftPay: 2100, shift: { game: 'INSPECT', diff: 3 },
    exam: { game: 'INSPECT', diff: 3, pass: 0.7 }, desc: '施設の監視と巡回の責任者。',
  },
  {
    key: 'CIVIL', name: '公務員', icon: '🏛️', field: '官公庁', eduReq: 1, uniBonus: 1.6, steady: true,
    req: [], minWorkExp: 260, salary: 900, shiftPay: 2600, shift: { game: 'SORT', diff: 3 },
    exam: { game: 'CHOICE', diff: 3, pass: 0.72 },
    desc: '窓口と事務。安定していて景気に左右されない。',
    perk: '大卒だと給料が1.6倍になる',
  },
  {
    key: 'ACCOUNT', name: '経理', icon: '📒', field: '財務', eduReq: 2, calcJob: true,
    req: ['BOOK'], minWorkExp: 200, salary: 1100, shiftPay: 3000, shift: { game: 'CALC', diff: 3 },
    exam: { game: 'CALC', diff: 4, pass: 0.7 }, desc: '会社のお金の流れを管理する。',
  },
  {
    key: 'DEALERJOB', name: 'カジノディーラー', icon: '🃏', field: 'カジノ', eduReq: 2, calcJob: true,
    req: ['DEALER'], minWorkExp: 250, salary: 1300, shiftPay: 3400, shift: { game: 'CALC', diff: 4 },
    exam: { game: 'CALC', diff: 4, pass: 0.75 }, desc: 'YUTAPON CASINO のテーブルを仕切る。',
  },
  {
    key: 'CHEF', name: '調理師', icon: '🍳', field: '飲食', eduReq: 2,
    req: ['COOK'], minWorkExp: 250, salary: 1250, shiftPay: 3300, shift: { game: 'SORT', diff: 4 },
    exam: { game: 'SORT', diff: 4, pass: 0.72 }, desc: '厨房を預かり、段取りで勝負する。',
  },
  {
    key: 'TEACHER', name: '教師', icon: '🏫', field: '教育', eduReq: 3,
    req: ['TEACH'], minWorkExp: 300, salary: 2100, shiftPay: 4600, shift: { game: 'WORD', diff: 4 },
    exam: { game: 'CHOICE', diff: 4, pass: 0.75 }, desc: '教壇に立ち、生徒を送り出す。',
  },
  {
    key: 'CODER', name: 'プログラマー', icon: '💻', field: 'IT', eduReq: 3,
    req: ['IT'], minWorkExp: 300, salary: 2600, shiftPay: 5400, shift: { game: 'TYPING', diff: 4 },
    exam: { game: 'TYPING', diff: 4, pass: 0.75 }, desc: 'システムを書いて世界を動かす。',
  },
  {
    key: 'ARCHITECT', name: '建築士', icon: '📐', field: '建設', eduReq: 3,
    req: ['ARCH'], minWorkExp: 400, salary: 2900, shiftPay: 5800, shift: { game: 'MEMORY', diff: 4 },
    exam: { game: 'MEMORY', diff: 4, pass: 0.78 }, desc: '図面を引き、街をつくる。',
  },
  {
    key: 'TRADER', name: '証券トレーダー', icon: '📈', field: '金融', eduReq: 3, volatile: true, calcJob: true,
    req: ['SEC'], minWorkExp: 450, salary: 3200, shiftPay: 6400, shift: { game: 'CALC', diff: 5 },
    exam: { game: 'CALC', diff: 5, pass: 0.8 },
    desc: '一瞬の判断で数字を積み上げる。出来が悪い日はほぼ無給。',
    perk: '出来ばえで報酬が激変（最大 2.45 倍、失敗すればほぼゼロ）',
  },
  {
    key: 'PILOTJOB', name: 'パイロット', icon: '✈️', field: '航空', eduReq: 3,
    req: ['PILOT'], minWorkExp: 600, salary: 3800, shiftPay: 7200, shift: { game: 'INSPECT', diff: 5 },
    exam: { game: 'INSPECT', diff: 5, pass: 0.82 }, desc: '何百人の命を預かって空を飛ぶ。',
  },
  {
    key: 'DOCTOR', name: '医師', icon: '🩺', field: '医療', eduReq: 3,
    req: ['DOC'], minWorkExp: 700, salary: 4400, shiftPay: 8200, shift: { game: 'MEMORY', diff: 5 },
    exam: { game: 'MEMORY', diff: 5, pass: 0.84 }, desc: '診断と治療。休みはあまりない。',
  },
  {
    key: 'LAWYER', name: '弁護士', icon: '⚖️', field: '法務', eduReq: 3,
    req: ['LAW'], minWorkExp: 700, salary: 4600, shiftPay: 8600, shift: { game: 'WORD', diff: 5 },
    exam: { game: 'CHOICE', diff: 5, pass: 0.84 }, desc: '言葉で人を守る仕事。',
  },
  {
    key: 'SCIENTIST', name: '研究者', icon: '🔬', field: '研究', eduReq: 3, volatile: true,
    req: ['PHD'], minWorkExp: 800, salary: 5000, shiftPay: 9200, shift: { game: 'INSPECT', diff: 5 },
    exam: { game: 'INSPECT', diff: 5, pass: 0.86 },
    desc: '誰も知らないことを最初に知る。空振りの日もあれば、大発見の日もある。',
    perk: '出来ばえで報酬が激変（最大 2.45 倍、失敗すればほぼゼロ）',
  },
  {
    key: 'ATHLETE', name: 'プロスポーツ選手', icon: '🏅', field: 'スポーツ', eduReq: 0, volatile: true, athlete: true,
    req: [], minWorkExp: 400, salary: 3400, shiftPay: 9600, shift: { game: 'MEMORY', diff: 5 },
    exam: { game: 'MEMORY', diff: 5, pass: 0.80 },
    desc: '部活で名を上げた者だけがなれる。ひとつの試合で年収が変わる世界。',
    perk: '部活の実力 2,400・名声 2,000 以上で応募できる／出来ばえで報酬が激変（最大 3.6 倍、失敗すればほぼゼロ）',
    clubReq: { skill: 2400, fame: 2000 },
  },
  /* ---- YUTAPON-GROUP の3部署。条件も給料も最高クラス。
         格は FLY ＜ BANK ＜ CASINO の順 ---- */
  {
    key: 'FLYSTAFF', name: 'YUTAPON-FLY 運航管理', icon: '🛫', field: 'YUTAPON-GROUP', group: 'FLY', eduReq: 3,
    req: ['PILOT', 'QC'], minWorkExp: 850, salary: 19800, shiftPay: 55800, shift: { game: 'INSPECT', diff: 5 },
    exam: { game: 'INSPECT', diff: 4, pass: 0.78 },
    desc: '世界を結ぶ路線の運航を預かる。区間ごとの運賃を決めるのもこの仕事。',
    perk: '旅行画面で 運賃を変えられる（基準の0.5〜2.5倍）',
  },
  {
    key: 'BANKER', name: 'YUTAPON-BANK 行員', icon: '🏦', field: 'YUTAPON-GROUP', group: 'BANK', eduReq: 3, calcJob: true,
    req: ['BOOK', 'SEC'], minWorkExp: 1000, salary: 20400, shiftPay: 57600, shift: { game: 'LOAN', diff: 4 },
    exam: { game: 'LOAN', diff: 3, pass: 0.80 },
    desc: '実在するプレイヤーの融資を審査する。判断が銀行の資産に直結する。',
    perk: '役職に応じて自分の預金金利が上がる',
  },
  {
    key: 'CASINOSTAFF', name: 'YUTAPON-CASINO 職員', icon: '🎰', field: 'YUTAPON-GROUP', group: 'CASINO', eduReq: 3,
    req: ['DEALER', 'QC'], minWorkExp: 1150, salary: 21600, shiftPay: 61200, shift: { game: 'FRAUD', diff: 4 },
    exam: { game: 'FRAUD', diff: 4, pass: 0.83 },
    desc: 'カジノの配当記録を監査し、VIP 会員制度を管轄する。グループでいちばん格が高い。',
    perk: '役職に応じて VIP 券が割引',
  },
];
export const careerOf = (k) => CAREERS.find(c => c.key === k) || null;

/* ---------- YUTAPON-GROUP の部署 ----------
   ひとつのグループを3つの部署が支えている。格は FLY ＜ BANK ＜ CASINO。
   学校からの推薦も、この部署ごとに分かれている。 */
export const GROUP_NAME = 'YUTAPON-GROUP';
export const DEPARTMENTS = [
  { key: 'FLY', name: 'YUTAPON-FLY', short: 'FLY', icon: '🛫', rank: 1, color: '#38bdf8', job: 'FLYSTAFF', desc: '世界を結ぶ航空部門。運賃を決め、路線を守る。' },
  { key: 'BANK', name: 'YUTAPON-BANK', short: 'BANK', icon: '🏦', rank: 2, color: '#34d399', job: 'BANKER', desc: '金庫を預かる銀行部門。預金と融資のすべて。' },
  { key: 'CASINO', name: 'YUTAPON-CASINO', short: 'CASINO', icon: '🎰', rank: 3, color: '#fbbf24', job: 'CASINOSTAFF', desc: 'グループの顔。カジノと VIP 制度を管轄する最上位部門。' },
];
export const departmentOf = (k) => DEPARTMENTS.find(d => d.key === k) || null;
/** その職が属する部署 */
export const deptOfJob = (jobKey) => DEPARTMENTS.find(d => d.job === jobKey) || null;

/* ---------- 計算まわり ---------- */
export const PAY_INTERVAL = 15 * 60 * 1000;   // 給料日の間隔
export const PAY_MAX_PERIODS = 8;             // オフライン中に貯まる上限
export const SHIFT_COOLDOWN = 60 * 1000;      // 出勤の間隔

export const rankOf = (i) => RANKS[Math.max(0, Math.min(RANKS.length - 1, i || 0))];
export const nextRank = (i) => (i + 1 < RANKS.length ? RANKS[i + 1] : null);

/** 給料（1回の給料日あたり）。公務員は大卒だと上がる */
export const VIP_PAY = 1.1;   // VIPは給料1.1倍

/** パイロットの給料倍率。みんなが YUTAPON FLY で使った G が積み上がるほど上がる（最大5倍） */
export const PILOT_SCALE = 50000000;
export const PILOT_MAX = 5;
export const pilotMult = (flySpend = 0) => 1 + Math.min(PILOT_MAX - 1, Math.max(0, flySpend) / PILOT_SCALE);

/** プロスポーツ選手の給料倍率。部活の名声がそのまま値打ちになる */
export const athleteMult = (fame = 0) => 1 + Math.min(4, Math.max(0, fame) / 3000);

export function salaryOf(job, eduLevel = 0, vip = false, extra = {}) {
  const c = careerOf(job?.key);
  if (!c) return 0;
  const uni = c.uniBonus && eduLevel >= EDU.UNI ? c.uniBonus : 1;
  const fly = c.key === 'PILOTJOB' ? pilotMult(extra.flySpend) : 1;
  const ath = c.athlete ? athleteMult(extra.fame) : 1;
  return Math.round(c.salary * rankOf(job.rank).mult * uni * fly * ath * (vip ? VIP_PAY : 1));
}

/** 出勤1回の満額（実際は出来ばえを掛ける）。役職の効きは給料より控えめ */
export function shiftPayOf(job, vip = false, extra = {}) {
  const c = careerOf(job?.key);
  if (!c) return 0;
  const m = 1 + (rankOf(job.rank).mult - 1) * 0.5;
  const fly = c.key === 'PILOTJOB' ? pilotMult(extra.flySpend) : 1;
  const ath = c.athlete ? athleteMult(extra.fame) : 1;
  return Math.round(c.shiftPay * m * fly * ath * (vip ? VIP_PAY : 1));
}

/** 出勤で入る経験値 */
export function shiftExp(diff, perf, mult = 1) {
  return Math.max(1, Math.round((8 + diff * 4) * (0.4 + perf * 0.9) * mult));
}
export const expMultOf = (career) => (career?.group ? 10 : 1);

/** 出来ばえ → 報酬の倍率。volatile な仕事は当たり外れが激しい */
export function payCurve(career, perf) {
  if (career?.athlete) {
    // スポーツは出来ばえで最も激しく変わる
    if (perf < 0.45) return perf * 0.35;
    return 0.15 + Math.pow(perf, 2.8) * 3.45;           // 完璧なら 3.6 倍
  }
  if (career?.volatile) {
    if (perf < 0.5) return perf * 0.5;                  // 半分を切るとほぼ無給
    return 0.25 + Math.pow(perf, 2.4) * 2.2;            // 完璧なら 2.45 倍まで化ける
  }
  if (career?.steady) return 0.6 + perf * 0.5;          // 公務員は安定
  return perf < 0.3 ? 0.15 : 0.35 + perf * 0.8;
}

/** 昇進に必要な経験値（届いていなければ残りを返す） */
export function promotionNeed(job) {
  const nxt = nextRank(job?.rank ?? 0);
  if (!nxt) return null;
  return { rank: nxt, need: nxt.exp, left: Math.max(0, nxt.exp - (job?.exp || 0)) };
}

/* ---------- 転職の不利 ----------
   別の会社に移るたびに採用が少しきびしくなる。転職エージェントで打ち消せる */
export const JOB_CHANGE_STEP = 0.04;
export const JOB_CHANGE_MAX = 0.20;
export const jobChangePenalty = (changes = 0) => Math.min(JOB_CHANGE_MAX, Math.max(0, changes) * JOB_CHANGE_STEP);

/** 応募の可否（学歴・資格・経験・部活の戦績） */
export function canApply(career, licenses, workExp, eduLevel = 0, club = null) {
  if (career.clubReq) {
    const skill = club?.skill || 0, fame = club?.fame || 0;
    if (skill < career.clubReq.skill || fame < career.clubReq.fame) {
      return { ok: false, reason: `部活で 実力 ${career.clubReq.skill.toLocaleString()}・名声 ${career.clubReq.fame.toLocaleString()} が必要です（いま ${Math.round(skill).toLocaleString()}／${Math.round(fame).toLocaleString()}）` };
    }
  }
  if ((career.eduReq || 0) > (eduLevel || 0)) {
    return { ok: false, reason: `${EDU_LABEL[career.eduReq]} が必要です` };
  }
  const miss = (career.req || []).filter(r => !licenses.includes(r));
  if (miss.length) return { ok: false, reason: `資格が足りません：${miss.map(m => licenseOf(m)?.name || m).join('・')}` };
  if ((workExp || 0) < (career.minWorkExp || 0)) {
    return { ok: false, reason: `通算経験 ${career.minWorkExp} が必要です（いま ${Math.floor(workExp || 0)}）` };
  }
  return { ok: true, reason: '' };
}

/** 受験の可否 */
export function canTakeExam(license, licenses) {
  if (licenses.includes(license.key)) return { ok: false, reason: '取得済みです' };
  const miss = (license.req || []).filter(r => !licenses.includes(r));
  if (miss.length) return { ok: false, reason: `先に ${miss.map(m => licenseOf(m)?.name || m).join('・')} が必要` };
  return { ok: true, reason: '' };
}

/** 応募にかかる受験料 */
export const applyFee = (career) => Math.round(career.salary * 8);

/** 行員の特典：預金金利の上乗せ（30分あたり） */
export function bankerRateBonus(job) {
  if (job?.key !== 'BANKER') return 0;
  return (job.rank || 0) * 0.0002;
}

/** 運航管理の特典：自分が乗るときの運賃割引 */
export function flyStaffDiscount(job) {
  if (job?.key !== 'FLYSTAFF') return 0;
  return Math.min(0.40, 0.10 + (job.rank || 0) * 0.05);
}

/** カジノ職員の特典：VIP 関連の割引率 */
export function casinoStaffDiscount(job) {
  if (job?.key !== 'CASINOSTAFF') return 0;
  return Math.min(0.30, (job.rank || 0) * 0.05);
}

/** YUTAPON グループの社員か */
export const isGroupJob = (job) => !!careerOf(job?.key)?.group;

/** ランキングなどに出す肩書き */
export function jobLabel(job) {
  const c = careerOf(job?.key);
  if (!c) return null;
  return `${c.icon}${c.name}・${rankOf(job.rank).name}`;
}

/* ---------- 出来ばえの評価 ---------- */
export function gradeOf(perf) {
  if (perf >= 0.95) return { g: 'S', color: '#fbbf24', word: '完璧な仕事' };
  if (perf >= 0.8) return { g: 'A', color: '#34d399', word: 'よくやった' };
  if (perf >= 0.6) return { g: 'B', color: '#60a5fa', word: 'まずまず' };
  if (perf >= 0.4) return { g: 'C', color: '#a3a3a3', word: 'ぎりぎり' };
  return { g: 'D', color: '#f87171', word: '要練習' };
}
