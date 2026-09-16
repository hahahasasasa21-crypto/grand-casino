import React from 'react';
import { PlayingCard, Chip, VipBadge } from '../../shared/ui';

/* ==========================================================
   ポーカーテーブルの共通パーツ（ソロ／オンライン兼用）
   ========================================================== */

export const fmt = (n) => (n || 0).toLocaleString();

/** 席の配置（自分は常に手前中央） */
export const SEAT_POS = {
  6: [[50, 96], [6, 70], [10, 22], [50, 4], [90, 22], [94, 70]],
  5: [[50, 96], [6, 62], [24, 8], [76, 8], [94, 62]],
  4: [[50, 96], [6, 48], [50, 4], [94, 48]],
  3: [[50, 96], [12, 22], [88, 22]],
  2: [[50, 96], [50, 4]],
};

export function ChipStack({ amount, size = 18 }) {
  if (!amount) return null;
  const n = Math.min(5, Math.max(1, Math.round(Math.log10(amount + 1))));
  const color = amount >= 50000 ? '#0f172a' : amount >= 10000 ? '#b45309' : amount >= 5000 ? '#7c3aed' : amount >= 1000 ? '#16a34a' : amount >= 500 ? '#2563eb' : '#dc2626';
  return (
    <div className="flex items-center gap-1">
      <span className="relative block" style={{ width: size, height: size + n * 2 }}>
        {[...Array(n)].map((_, i) => (
          <span key={i} className="absolute left-0" style={{ bottom: i * 2.5 }}>
            <Chip value="" color={color} size={size} />
          </span>
        ))}
      </span>
      <span className="text-[10px] font-mono font-black text-amber-200 drop-shadow">{fmt(amount)}</span>
    </div>
  );
}

export function Seat({ p, isTurn, reveal, isWinner, dealer, seatPos, small, empty }) {
  const [x, y] = seatPos;
  const dim = p.folded || !p.sitting;
  const hasCards = (p.hole || []).length > 0;

  if (empty) {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
        style={{ left: `${x}%`, top: `${y}%`, width: small ? 112 : 126, zIndex: 8 }}>
        <div className="w-full rounded-xl px-2 py-2 border border-dashed border-white/15 bg-black/35 text-center">
          <div className="text-[11px] font-black text-gray-600">空席</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%`, width: small ? 112 : 126, zIndex: isTurn ? 25 : 12 }}>
      {/* カード */}
      {hasCards && (
        <div className={`flex gap-0.5 transition-opacity ${dim ? 'opacity-25' : ''}`}>
          <PlayingCard card={p.hole?.[0]} hidden={!(p.isHuman || (reveal && !p.folded))} tiny={small} small={!small} />
          <PlayingCard card={p.hole?.[1]} hidden={!(p.isHuman || (reveal && !p.folded))} tiny={small} small={!small} />
        </div>
      )}

      {/* プレート */}
      <div className={`relative w-full rounded-xl px-2 py-1 border-2 text-center transition-all
        ${isWinner ? 'border-amber-300 bg-amber-400/25 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
          : isTurn ? 'border-emerald-300 bg-emerald-500/20 shadow-[0_0_14px_rgba(52,211,153,0.5)]'
            : 'border-white/15 bg-black/70'} ${dim ? 'opacity-45' : ''}`}>
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm leading-none">{p.avatar}</span>
          <span className="text-[11px] font-black text-white truncate max-w-[72px]">{p.name}</span>
          {p.vip && <VipBadge size="xs" />}
        </div>
        <div className="font-mono text-[11px] font-black text-amber-200">{p.allIn ? 'ALL-IN' : fmt(p.stack)}</div>
        {p.persona && <div className="text-[9px] text-gray-500 leading-none">{p.persona.tag}</div>}
        {dealer && (
          <span className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center border border-gray-400">D</span>
        )}
        {isTurn && (
          <span className="absolute left-0 right-0 -bottom-1 h-1 rounded-full overflow-hidden">
            <span className="block h-full bg-emerald-400" style={{ animation: 'pokerTimer 12s linear forwards' }} />
          </span>
        )}
      </div>

      {p.lastAction && (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${p.folded ? 'bg-slate-700 text-slate-300' : 'bg-black/80 text-amber-200 border border-amber-400/30'}`}>
          {p.lastAction}
        </span>
      )}
    </div>
  );
}


/** 自分の席が常に手前中央に来るように、席の並びを回転させる */
export function rotateSeats(list, mySeat) {
  const n = list.length;
  if (n === 0) return [];
  const base = mySeat >= 0 ? mySeat : 0;
  const out = [];
  for (let k = 0; k < n; k++) out.push({ item: list[(base + k) % n], seat: (base + k) % n });
  return out;
}
