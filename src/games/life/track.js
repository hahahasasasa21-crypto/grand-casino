/* ==========================================================
   人生ゲーム — コース（道）のジオメトリ
   ウェイポイントから Catmull-Rom 曲線を作り、
   ・SVG の d 属性（滑らかなベジェ）
   ・マスの中心座標と進行方向の角度
   ・任意の位置（小数）での座標 ＝ コマのアニメーション用
   を提供する。
   ========================================================== */

export const VIEW_W = 1216;
export const VIEW_H = 736;

/** 4段の蛇行。横の直線はわざと少し波打たせて「田舎道」の見た目にする */
const WAY = [
  [76, 150], [190, 112], [330, 138], [470, 102], [610, 132], [750, 106], [890, 136], [1012, 114],
  [1106, 152], [1134, 216], [1082, 268],
  [960, 302], [820, 268], [680, 298], [540, 268], [400, 298], [262, 272], [142, 302],
  [74, 344], [68, 404], [126, 446],
  [254, 474], [394, 444], [534, 474], [674, 444], [814, 474], [954, 448], [1074, 472],
  [1144, 514], [1138, 576], [1074, 616],
  [946, 642], [806, 614], [666, 644], [526, 618], [386, 644], [246, 622], [118, 650],
];

/* ---------- Catmull-Rom ---------- */
function crPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function extend(wp) {
  return [wp[0], ...wp, wp[wp.length - 1]];
}

/** 曲線を折れ線に展開（座標計算用） */
function sample(wp, per = 18) {
  const ext = extend(wp);
  const pts = [];
  for (let i = 0; i + 3 < ext.length; i++) {
    for (let j = 0; j < per; j++) pts.push(crPoint(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], j / per));
  }
  pts.push(wp[wp.length - 1]);
  return pts;
}

/** 曲線をベジェに変換（描画用・文字列が短くて滑らか） */
function toBezier(wp) {
  const ext = extend(wp);
  let d = `M${wp[0][0]} ${wp[0][1]}`;
  for (let i = 1; i + 2 < ext.length; i++) {
    const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0]} ${p2[1]}`;
  }
  return d;
}

const PTS = sample(WAY);
const CUM = (() => {
  const c = [0];
  for (let i = 1; i < PTS.length; i++) {
    const dx = PTS[i][0] - PTS[i - 1][0], dy = PTS[i][1] - PTS[i - 1][1];
    c.push(c[i - 1] + Math.hypot(dx, dy));
  }
  return c;
})();

export const ROAD_D = toBezier(WAY);
export const ROAD_LEN = CUM[CUM.length - 1];
/** 道の折れ線（風景を道から離して置くための当たり判定に使う） */
export const ROAD_PTS = PTS;

const PAD_A = 46;   // スタート側の余白
const PAD_B = 46;   // ゴール側の余白

/** 距離 s の地点の座標と進行方向（度） */
export function pointAtLength(s) {
  const t = Math.max(0, Math.min(ROAD_LEN, s));
  let lo = 0, hi = CUM.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (CUM[mid] <= t) lo = mid; else hi = mid;
  }
  const seg = CUM[hi] - CUM[lo] || 1;
  const f = (t - CUM[lo]) / seg;
  const x = PTS[lo][0] + (PTS[hi][0] - PTS[lo][0]) * f;
  const y = PTS[lo][1] + (PTS[hi][1] - PTS[lo][1]) * f;
  const a = Math.atan2(PTS[hi][1] - PTS[lo][1], PTS[hi][0] - PTS[lo][0]);
  return { x, y, ang: a * 180 / Math.PI, rad: a };
}

/** マス番号（小数可）→ 座標。n はマスの総数 */
export function tileAt(i, n) {
  const usable = ROAD_LEN - PAD_A - PAD_B;
  const step = usable / Math.max(1, n - 1);
  return pointAtLength(PAD_A + step * i);
}

/** マス間隔（px）— タイルの大きさを決めるのに使う */
export function tileGap(n) {
  return (ROAD_LEN - PAD_A - PAD_B) / Math.max(1, n - 1);
}

/** 進行方向に対して垂直・平行にずらした座標（コマを並べるのに使う） */
export function offsetFrom(pt, perp, along) {
  const c = Math.cos(pt.rad), s = Math.sin(pt.rad);
  return {
    x: pt.x + (-s) * perp + c * along,
    y: pt.y + (c) * perp + s * along,
  };
}
