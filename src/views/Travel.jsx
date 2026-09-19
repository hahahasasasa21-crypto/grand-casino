import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, PlaneTakeoff, PlaneLanding, Plane, Globe, Ticket, Clock,
  MapPin, Crown, Sparkles, Luggage, TowerControl,
} from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, playSfx } from '../shared/ui.jsx';
import {
  COUNTRIES, countryOf, CLASSES, classOf, fareOf, baseFare, segKey,
  normalizeTravel, inFlight, hasLanded, flightLeft, flightProgress, flightClock,
  canFly, flightNoOf, gateOf, boardingBonus, arrivalExp,
  recordFlight, watchFly, ensureFly, emptyFly,
  flyTotal, setFare, fareBounds, FARES, FLY_PILOT_SHARE, FLY_COMPANY_SHARE,
} from '../shared/world.js';
import {
  pilotMultiplier, pilotNextStep, PILOT_MAX, PILOT_SCALE, VIP_FARE_MUL,
  mulberry32, hash32,
} from '../shared/world.js';
import {
  CURRENCIES, currencyOf, currencyOfCountry, normalizeWallet, rateOf, BASE_CURRENCY,
} from '../shared/fx.js';
import { isAirline, routesOf, airFare, corpTypeOf } from '../shared/corp.js';

/* ==========================================================
   YUTAPON FLY 国際空港
   ・出発案内板から便を選び、運賃を払って別の国へ飛ぶ
   ・運賃は YUTAPON FLY の売上になり、パイロットの給料倍率を押し上げる
   ========================================================== */

const fmt = (n) => Math.round(n || 0).toLocaleString();

function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}

/* ---------- 機内の窓から見える星と雲（シード付きなので毎回同じ並び） ---------- */
const STARS = (() => {
  const rnd = mulberry32(hash32('yutapon-fly-window-stars'));
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    top: Math.round(rnd() * 92) + 2,
    size: 1 + Math.round(rnd() * 2),
    dur: 6 + Math.round(rnd() * 100) / 10,
    delay: Math.round(rnd() * 120) / 10,
    op: 0.3 + Math.round(rnd() * 70) / 100,
  }));
})();

const CLOUDS = (() => {
  const rnd = mulberry32(hash32('yutapon-fly-window-clouds'));
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    top: 40 + Math.round(rnd() * 55),
    w: 70 + Math.round(rnd() * 120),
    h: 14 + Math.round(rnd() * 16),
    dur: 11 + Math.round(rnd() * 130) / 10,
    delay: Math.round(rnd() * 150) / 10,
    op: 0.08 + Math.round(rnd() * 16) / 100,
  }));
})();

/* ---------- この画面だけで使うアニメーション ---------- */
function FlyStyles() {
  return (
    <style>{`
      @keyframes yfFlipIn {
        0%   { transform: rotateX(-92deg); opacity: 0; }
        60%  { transform: rotateX(12deg);  opacity: 1; }
        100% { transform: rotateX(0deg);   opacity: 1; }
      }
      @keyframes yfBlink { 0%,60% { opacity: 1; } 61%,100% { opacity: 0.18; } }
      @keyframes yfStarFly  { from { left: 106%; } to { left: -8%; } }
      @keyframes yfCloudFly { from { left: 112%; } to { left: -40%; } }
      @keyframes yfHover { 0%,100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, calc(-50% - 3px)); } }
      @keyframes yfBeacon { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
      @keyframes yfScan { from { transform: translateY(-100%); } to { transform: translateY(700%); } }
      @keyframes yfStamp {
        0%   { transform: scale(2.4) rotate(-18deg); opacity: 0; }
        70%  { transform: scale(0.94) rotate(-8deg); opacity: 1; }
        100% { transform: scale(1) rotate(-8deg);    opacity: 1; }
      }
    `}</style>
  );
}

/* ---------- 掲示板の1文字（パタパタ） ---------- */
function FlipText({ text, delay = 0, className = '' }) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{ animation: `yfFlipIn 420ms ${delay}ms cubic-bezier(.2,.9,.3,1.2) both`, transformOrigin: '50% 0%' }}
    >
      {text}
    </span>
  );
}

/* ---------- 出発案内板の1行 ---------- */
function BoardRow({ row, index, balance, travel, now }) {
  const flying = inFlight(travel, now) || hasLanded(travel, now);
  const mine = flying && travel.flyingTo === row.dest.key && travel.cls === row.cls.key;
  const poor = row.fare > balance;

  let status = '定刻';
  let tone = 'text-amber-300';
  if (mine) { status = '搭乗済'; tone = 'text-emerald-300'; }
  else if (flying) { status = '手続中'; tone = 'text-gray-500'; }
  else if (poor) { status = '残高不足'; tone = 'text-red-400/80'; }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-amber-500/10 last:border-b-0 ${mine ? 'bg-emerald-400/5' : ''}`}>
      <span className="w-[4.4rem] shrink-0 text-amber-200 tracking-widest">
        <FlipText text={row.no} delay={index * 55} />
      </span>
      <span className="flex-1 min-w-0 truncate text-amber-100">
        <FlipText text={`${row.dest.icon} ${row.dest.short}`} delay={index * 55 + 40} />
      </span>
      <span className="w-[5.2rem] shrink-0 text-amber-300/80">
        <FlipText text={`${row.cls.icon} ${row.cls.code}`} delay={index * 55 + 80} />
      </span>
      <span className="w-[2.9rem] shrink-0 text-center text-sky-300/90">
        <FlipText text={row.gate} delay={index * 55 + 120} />
      </span>
      <span className="w-[6.4rem] shrink-0 text-right text-amber-200 tabular-nums">
        <FlipText text={fmt(row.fare)} delay={index * 55 + 160} />
      </span>
      <span className={`w-[4.2rem] shrink-0 text-right ${tone}`} style={mine ? undefined : { animation: 'yfBlink 2.4s steps(1,end) infinite' }}>
        <FlipText text={status} delay={index * 55 + 200} />
      </span>
    </div>
  );
}

/* ---------- 出発案内板 ---------- */
function DepartureBoard({ rows, balance, travel, now, here }) {
  return (
    <div className="rounded-3xl border border-amber-500/30 bg-black shadow-2xl shadow-black/70 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <TowerControl size={16} className="text-amber-300 shrink-0" />
          <span className="font-mono text-[11px] md:text-xs font-black tracking-[0.3em] text-amber-300 truncate">DEPARTURES</span>
          <span className="text-[10px] font-black text-gray-500 truncate">出発案内</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: 'yfBeacon 1.6s ease-in-out infinite' }} />
          <span className="font-mono text-[10px] font-black tracking-widest text-amber-200/70">{here.icon} {here.short} 空港</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[33rem] font-mono text-[12px] md:text-[13px] font-bold">
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-widest text-amber-500/50 border-b border-amber-500/20 bg-white/[0.02]">
            <span className="w-[4.4rem] shrink-0">便名</span>
            <span className="flex-1 min-w-0">行き先</span>
            <span className="w-[5.2rem] shrink-0">クラス</span>
            <span className="w-[2.9rem] shrink-0 text-center">ゲート</span>
            <span className="w-[6.4rem] shrink-0 text-right">運賃(Y)</span>
            <span className="w-[4.2rem] shrink-0 text-right">状態</span>
          </div>
          {rows.map((r, i) => (
            <BoardRow key={r.id} row={r} index={i} balance={balance} travel={travel} now={now} />
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-amber-500/20 bg-white/[0.02] flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-amber-500/50 tracking-widest truncate">YUTAPON FLY ・ 全便 定刻運航</span>
        <span className="font-mono text-[10px] text-amber-300/70 tabular-nums">
          {new Date(now).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

/* ---------- いまいる国 ---------- */
function HereCard({ here, visits }) {
  return (
    <Panel gold className="p-5 overflow-hidden relative">
      <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl" style={{ background: `${here.tone}22` }} />
      <div className="relative flex items-start gap-4">
        <div className="text-6xl md:text-7xl leading-none shrink-0 drop-shadow">{here.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin size={12} className="text-amber-300 shrink-0" />
            <span className="text-[10px] font-black tracking-[0.3em] text-amber-300/80">現在地</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">{here.name}</h3>
          <p className="text-[12px] text-amber-200/70 font-bold mt-0.5">{here.desc}</p>
          <p className="text-[11px] text-gray-400 leading-relaxed mt-2">{here.blurb}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10">
            <Luggage size={11} className="text-gray-400" />
            <span className="text-[10px] font-black text-gray-300">この国への入国 {visits} 回</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- 運賃ポリシー（YUTAPON-FLY 運航管理だけが触れる） ---------- */
function FarePolicy({ fly, playerName, showToast }) {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const segs = Object.keys(FARES);

  const apply = async (seg) => {
    if (busy) return;
    const b = fareBounds(seg);
    const v = Number(draft[seg]);
    if (!Number.isFinite(v) || v <= 0) { showToast('金額を入力してください。', 'warning'); return; }
    setBusy(true);
    const r = await setFare(seg, v, playerName);
    setBusy(false);
    if (r.ok) {
      showToast(`🛫 運賃を ${fmt(r.value)} Y にしました。`, 'success');
      setDraft(d => ({ ...d, [seg]: '' }));
    } else showToast(r.reason || '変更できませんでした。', 'error');
  };

  return (
    <Panel gold className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <TowerControl size={16} className="text-amber-300" />
        <span className="text-[13px] font-black text-amber-200">運航管理室</span>
        <span className="text-[10px] text-gray-500">YUTAPON-FLY 社員のみ</span>
      </div>
      <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
        区間ごとの基本運賃（エコノミー1席ぶん）を決められます。基準の 0.5〜2.5 倍まで。
        高くすれば会社の資産とパイロットの取り分が増えますが、誰も飛ばなくなれば売上は止まります。
      </p>
      <div className="space-y-2">
        {segs.map((seg) => {
          const b = fareBounds(seg);
          const cur = fly?.fares?.[seg] || b.base;
          const [a, c] = seg.split('|');
          return (
            <div key={seg} className="p-2.5 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <span className="text-[12px] font-black text-white">
                  {countryOf(a)?.icon}{countryOf(a)?.short} ↔ {countryOf(c)?.icon}{countryOf(c)?.short}
                </span>
                <span className="font-mono text-[12px] font-black text-amber-300 tabular-nums">
                  いま {fmt(cur)} Y
                  {cur !== b.base && <span className="text-[10px] text-gray-500"> / 基準 {fmt(b.base)}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={draft[seg] ?? ''} placeholder={`${b.min}〜${b.max}`}
                  onChange={(e) => setDraft(d => ({ ...d, [seg]: e.target.value }))}
                  className="flex-1 min-w-0 bg-black/60 text-white font-mono text-sm p-2 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
                <GoldButton onClick={() => apply(seg)} disabled={busy} className="px-4 py-2 text-xs shrink-0">
                  決定
                </GoldButton>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[0.5, 0.8, 1, 1.5, 2.5].map(m => (
                  <button key={m} onClick={() => setDraft(d => ({ ...d, [seg]: String(Math.round(b.base * m)) }))}
                    className="flex-1 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-gray-300 hover:border-amber-400/50">
                    ×{m}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {fly?.farePolicyBy && (
        <p className="text-[10px] text-gray-500 mt-2">
          最後に運賃を決めたのは <b className="text-amber-200">{fly.farePolicyBy}</b> さんです。
        </p>
      )}
    </Panel>
  );
}

/* ---------- 行き先カード ---------- */
function DestinationCard({ dest, from, vip, balance, selected, onSelect, onBoard, disabled, blockedReason, fly }) {
  const cls = classOf(selected);
  const fare = fareOf(from, dest.key, cls.key, vip, fly);
  const poor = fare > balance;
  const no = flightNoOf(from, dest.key, cls.key);
  const gate = gateOf(from, dest.key, cls.key);
  const bonus = boardingBonus(cls, fare);

  return (
    <Panel className="p-4 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-4xl leading-none shrink-0">{dest.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-base leading-tight truncate">{dest.name}</div>
          <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{dest.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[11px] font-black text-amber-300 tracking-widest">{no}</div>
          <div className="font-mono text-[10px] text-sky-300/80">ゲート {gate}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {CLASSES.map((c) => {
          const f = fareOf(from, dest.key, c.key, vip, fly);
          const on = c.key === cls.key;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(dest.key, c.key)}
              className={`p-2 rounded-xl border-2 text-center transition
                ${on ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-black/40 hover:border-white/25'}`}
            >
              <div className="text-lg leading-none">{c.icon}</div>
              <div className={`text-[10px] font-black leading-tight mt-0.5 ${on ? 'text-amber-200' : 'text-gray-300'}`}>{c.name}</div>
              <div className={`font-mono text-[10px] font-black tabular-nums ${f > balance ? 'text-red-400/80' : 'text-emerald-300'}`}>{fmt(f)}</div>
              <div className="text-[9px] text-gray-500">{c.ms === 0 ? '即到着' : `${Math.round(c.ms / 1000)}秒`}</div>
            </button>
          );
        })}
      </div>

      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 mb-3">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          <span className="text-amber-200 font-black">{cls.icon} {cls.name}</span>：{cls.perk}
        </p>
        {bonus > 0 && (
          <p className="text-[11px] text-emerald-300 font-bold mt-1">搭乗ボーナス +{fmt(bonus)} Y</p>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-end justify-between mb-2">
          <span className="text-[10px] font-black tracking-widest text-gray-500">運賃</span>
          <span className="font-mono text-xl font-black text-amber-300 tabular-nums">{fmt(fare)} <span className="text-xs">G</span></span>
        </div>
        {poor && !disabled && (
          <p className="text-[11px] text-red-300 font-bold mb-1.5 text-center">あと {fmt(fare - balance)} Y 足りません</p>
        )}
        {disabled && blockedReason && (
          <p className="text-[11px] text-gray-500 font-bold mb-1.5 text-center">{blockedReason}</p>
        )}
        <GoldButton
          onClick={() => onBoard(dest.key, cls.key)}
          disabled={disabled || poor}
          className="w-full py-3 text-sm flex items-center justify-center gap-2"
        >
          <PlaneTakeoff size={16} />搭乗する
        </GoldButton>
      </div>
    </Panel>
  );
}

/* ---------- 機内の窓 ---------- */
function CabinWindow({ tone }) {
  return (
    <div className="relative h-36 md:h-44 rounded-[2rem] overflow-hidden border-4 border-white/15 shadow-inner"
      style={{ background: 'linear-gradient(180deg,#05070f 0%,#0a1020 45%,#0d1a2b 100%)' }}>
      {/* 星 */}
      {STARS.map((s) => (
        <span key={`s${s.id}`} className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`, width: s.size, height: s.size, opacity: s.op,
            animation: `yfStarFly ${s.dur}s linear ${s.delay}s infinite`,
          }} />
      ))}
      {/* 雲 */}
      {CLOUDS.map((c) => (
        <span key={`c${c.id}`} className="absolute rounded-full blur-md"
          style={{
            top: `${c.top}%`, width: c.w, height: c.h,
            background: 'rgba(255,255,255,0.9)', opacity: c.op,
            animation: `yfCloudFly ${c.dur}s linear ${c.delay}s infinite`,
          }} />
      ))}
      {/* 月 */}
      <span className="absolute top-4 right-8 w-9 h-9 rounded-full"
        style={{ background: 'radial-gradient(circle at 34% 30%, #fff6d8, #f0d79a 55%, #c9a86a 100%)', boxShadow: '0 0 22px rgba(255,235,180,0.35)' }} />
      {/* 地平線の光 */}
      <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: `linear-gradient(0deg, ${tone}33 0%, rgba(0,0,0,0) 100%)` }} />
      {/* 窓ガラスの反射 */}
      <div className="pointer-events-none absolute inset-0 rounded-[1.7rem]"
        style={{ boxShadow: 'inset 0 10px 24px rgba(255,255,255,0.10), inset 0 -18px 30px rgba(0,0,0,0.55)' }} />
    </div>
  );
}

/* ---------- 飛行中 ---------- */
function InFlightPanel({ travel, now }) {
  const from = countryOf(travel.from) || COUNTRIES[0];
  const to = countryOf(travel.flyingTo) || COUNTRIES[0];
  const cls = classOf(travel.cls);
  const p = flightProgress(travel, now);
  const left = flightLeft(travel, now);
  const no = flightNoOf(travel.from, travel.flyingTo, travel.cls);

  return (
    <Panel gold className="p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Plane size={18} className="text-amber-300 shrink-0" />
          <span className="font-mono text-sm font-black tracking-widest text-amber-200">{no}</span>
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/30 shrink-0">
            {cls.icon} {cls.name}
          </span>
        </div>
        <span className="text-[10px] font-black tracking-[0.25em] text-emerald-300 shrink-0" style={{ animation: 'yfBeacon 1.6s ease-in-out infinite' }}>
          飛行中
        </span>
      </div>

      <CabinWindow tone={to.tone} />

      {/* 進み具合 */}
      <div className="mt-5 mb-2 flex items-center justify-between text-[11px] font-black">
        <span className="text-gray-300">{from.icon} {from.short}</span>
        <span className="text-gray-300">{to.short} {to.icon}</span>
      </div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300 ease-linear"
            style={{ width: `${p * 100}%`, background: 'linear-gradient(90deg,#fbbf24,#fde68a)' }} />
        </div>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-white/25" />
          ))}
        </div>
        <div className="absolute top-1/2 transition-all duration-300 ease-linear"
          style={{ left: `${Math.max(2, Math.min(98, p * 100))}%` }}>
          <div style={{ animation: 'yfHover 2.2s ease-in-out infinite', transform: 'translate(-50%,-50%)' }}>
            <Plane size={26} className="text-amber-300 drop-shadow" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="p-3 rounded-2xl bg-black/50 border border-white/10 text-center">
          <div className="text-[10px] font-black tracking-widest text-gray-500 mb-0.5">到着まで</div>
          <div className="font-mono text-3xl font-black text-amber-300 tabular-nums">{flightClock(left)}</div>
        </div>
        <div className="p-3 rounded-2xl bg-black/50 border border-white/10 text-center">
          <div className="text-[10px] font-black tracking-widest text-gray-500 mb-0.5">飛行の進み</div>
          <div className="font-mono text-3xl font-black text-emerald-300 tabular-nums">{Math.round(p * 100)}％</div>
        </div>
      </div>

      <div className="mt-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-400/20">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={12} className="text-amber-300" />
          <span className="text-[11px] font-black text-amber-200">{cls.name}の機内サービス</span>
        </div>
        <ul className="space-y-1">
          {cls.service.map((s, i) => (
            <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
              <span className="text-amber-400/70 leading-none mt-0.5">◆</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[10px] text-gray-500 text-center mt-3">
        シートベルトをお締めください。到着すると自動で入国手続きが行われます。
      </p>
    </Panel>
  );
}

/* ---------- 到着カード ---------- */
function ArrivedCard({ data, onClose }) {
  const c = data.country;
  return (
    <Panel gold className="p-6 text-center relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl" style={{ background: `${c.tone}22` }} />
      <div className="relative">
        <div className="text-[10px] font-black tracking-[0.35em] text-amber-200/70 mb-1">ARRIVAL ・ 入国手続き完了</div>
        <div className="text-7xl leading-none my-3" style={{ animation: 'yfStamp 620ms cubic-bezier(.2,.9,.3,1.2) both' }}>{c.icon}</div>
        <h3 className="text-2xl font-black text-white mb-1">{c.name} に到着しました</h3>
        <p className="text-[11px] text-gray-500 mb-4">{c.blurb}</p>

        <div className="space-y-1.5 text-left">
          <div className="flex justify-between items-center text-sm px-3 py-2 rounded-xl bg-black/40 border border-white/10">
            <span className="text-gray-400 font-bold">便名 / クラス</span>
            <span className="font-mono font-black text-amber-300">{data.no}・{data.cls.name}</span>
          </div>
          <div className="flex justify-between items-center text-sm px-3 py-2 rounded-xl bg-black/40 border border-white/10">
            <span className="text-gray-400 font-bold">この国への入国</span>
            <span className="font-mono font-black text-sky-300">{data.visits} 回目</span>
          </div>
          {data.exp > 0 && (
            <div className="flex justify-between items-center text-sm px-3 py-2 rounded-xl bg-black/40 border border-white/10">
              <span className="text-gray-400 font-bold">機内で得た経験値</span>
              <span className="font-mono font-black text-emerald-300">+{fmt(data.exp)}</span>
            </div>
          )}
        </div>

        <GoldButton onClick={onClose} className="w-full py-3 mt-4">入国する</GoldButton>
      </div>
    </Panel>
  );
}

/* ---------- YUTAPON FLY の累計 ---------- */
function FlyLedger({ fly, isPilot }) {
  const mul = pilotMultiplier(fly.spend);
  const next = pilotNextStep(fly.spend);
  const cap = PILOT_SCALE * (PILOT_MAX - 1);
  const p = Math.max(0, Math.min(100, (fly.spend / cap) * 100));
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
        <Globe size={18} className="text-sky-300 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-black text-white truncate">YUTAPON FLY 運航実績</h3>
          <p className="text-[10px] text-gray-500">世界じゅうのプレイヤーの移動が、ぜんぶここに積み上がります</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
          <div className="text-[10px] font-black tracking-widest text-gray-500 mb-0.5">総運航回数</div>
          <div className="font-mono text-2xl font-black text-sky-300 tabular-nums">{fmt(fly.flights)}</div>
          <div className="text-[9px] text-gray-600">便</div>
        </div>
        <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-center">
          <div className="text-[10px] font-black tracking-widest text-gray-500 mb-0.5">総運賃</div>
          <div className="font-mono text-2xl font-black text-amber-300 tabular-nums">{fmt(fly.spend)}</div>
          <div className="text-[9px] text-gray-600">G</div>
        </div>
      </div>

      {/* 会社としての YUTAPON-FLY */}
      <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <span className="text-[11px] font-black text-white">🛫 YUTAPON-FLY（企業）</span>
          <span className="font-mono text-[13px] font-black text-emerald-300 tabular-nums">
            資産 {fmt(flyTotal(fly))} Y
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-center">
            <div className="text-[9px] text-emerald-200/70 font-bold">会社の取り分</div>
            <div className="font-mono text-sm font-black text-emerald-300">{Math.round(FLY_COMPANY_SHARE * 100)}%</div>
          </div>
          <div className="flex-1 p-2 rounded-xl bg-sky-500/10 border border-sky-400/25 text-center">
            <div className="text-[9px] text-sky-200/70 font-bold">パイロットの取り分</div>
            <div className="font-mono text-sm font-black text-sky-300">{Math.round(FLY_PILOT_SHARE * 100)}%</div>
          </div>
          <div className="flex-1 p-2 rounded-xl bg-amber-500/10 border border-amber-400/25 text-center">
            <div className="text-[9px] text-amber-200/70 font-bold">未配分のプール</div>
            <div className="font-mono text-sm font-black text-amber-300 tabular-nums">{fmt(fly.pilotPool)}</div>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
          運賃は 8割が YUTAPON-FLY の資産に、2割がパイロットの取り分としてプールされます。
          プールは、パイロットの給料日に配分されます（これまで {fmt(fly.pilotPaid)} Y を配分済み）。
        </p>
      </div>

      <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-400/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-black text-amber-200 flex items-center gap-1">✈️ パイロットの給料倍率</span>
          <span className="font-mono text-lg font-black text-amber-300 tabular-nums">×{mul.toFixed(2)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden mb-1.5">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: 'linear-gradient(90deg,#fbbf24,#fde68a)' }} />
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          <b className="text-amber-200">パイロットの給料はこの数字で上がります。</b>
          みんなが払った運賃 {fmt(PILOT_SCALE)} Y ごとに倍率が +1.00、最大 ×{PILOT_MAX}.00 まで伸びます。
          {next > 0
            ? <> 次の目盛りまで あと <b className="text-amber-300">{fmt(next)} Y</b>。</>
            : <> すでに上限に到達しています。</>}
        </p>
        {isPilot && (
          <p className="text-[11px] text-emerald-300 font-bold mt-1.5">
            ✈️ 操縦士免許をお持ちです。いまの倍率 ×{mul.toFixed(2)} があなたの給料に乗ります。
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ==========================================================
   本体
   ========================================================== */
export default function TravelView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  travel, saveTravel, vip = false, licenses = [],
  job = null, wallet: rawWallet, saveWallet, house, companies = [], arena,
  onAirlineFare,
}) {
  const now = useNow(250);
  const t = useMemo(() => normalizeTravel(travel), [travel]);
  const here = countryOf(t.country) || COUNTRIES[0];
  const dests = useMemo(() => COUNTRIES.filter((c) => c.key !== t.country), [t.country]);

  const [picks, setPicks] = useState({});
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState(null);
  const [fly, setFly] = useState(() => emptyFly());

  const busyRef = useRef(false);
  const landedRef = useRef({ stamp: '', at: 0, done: false });

  const isPilot = Array.isArray(licenses) && licenses.includes('PILOT');
  const flying = inFlight(t, now);
  const landing = hasLanded(t, now);
  const visitedCount = COUNTRIES.filter((c) => c.key === t.country || (t.visits?.[c.key] || 0) > 0).length;

  /* ---------- YUTAPON FLY の会計を購読 ---------- */
  useEffect(() => {
    ensureFly();
    const unsub = watchFly((d) => setFly(d));
    return () => { try { unsub(); } catch (e) { /* noop */ } };
  }, []);

  /* ---------- 出発案内板の中身（便名とゲートはシード付きなので毎回同じ） ---------- */
  const rows = useMemo(() => {
    const list = [];
    for (const d of dests) {
      for (const c of CLASSES) {
        list.push({
          id: `${d.key}-${c.key}`,
          dest: d,
          cls: c,
          no: flightNoOf(t.country, d.key, c.key),
          gate: gateOf(t.country, d.key, c.key),
          fare: fareOf(t.country, d.key, c.key, vip, fly),
        });
      }
    }
    return list;
  }, [dests, t.country, vip, fly]);

  const pickOf = (key) => picks[key] || 'ECO';

  /* ---------- 支払い通貨 ----------
     いまいる国の紙幣で払うと、両替の手数料がかからない（現地通貨のごほうび） */
  const wallet = useMemo(() => normalizeWallet(rawWallet), [rawWallet]);
  const fxCtx = useMemo(() => ({ house, companies, fly }), [house, companies, fly]);
  const localCur = currencyOfCountry(t.country);
  const [payCur, setPayCur] = useState(BASE_CURRENCY);
  useEffect(() => { setPayCur(BASE_CURRENCY); }, [t.country]);
  /** 運賃（Y建て）を、選んだ通貨でいくらになるか */
  const priceIn = useCallback((g, code) => {
    if (!code || code === BASE_CURRENCY) return Math.round(g);
    return Math.ceil(g / Math.max(0.0001, rateOf(code, fxCtx)));   // 手数料なしの正味レート
  }, [fxCtx]);
  const select = useCallback((destKey, clsKey) => {
    playSfx('click');
    setPicks((p) => ({ ...p, [destKey]: clsKey }));
  }, []);

  /* ---------- 到着処理（useRef で1回だけ） ---------- */
  useEffect(() => {
    if (!t.flyingTo) {
      landedRef.current = { stamp: '', at: 0, done: false };
      return;
    }
    if (now < t.arriveAt) return;

    const stamp = `${t.flyingTo}@${t.arriveAt}`;
    const g = landedRef.current;
    if (g.stamp === stamp && (g.done || Date.now() - g.at < 6000)) return;
    landedRef.current = { stamp, at: Date.now(), done: false };

    const destKey = t.flyingTo;
    const dest = countryOf(destKey);
    if (!dest) return;
    const visits = (t.visits?.[destKey] || 0) + 1;
    const gained = arrivalExp(t.cls);
    const no = flightNoOf(t.from, destKey, t.cls);

    const patch = {
      'travel.country': destKey,
      'travel.flyingTo': null,
      'travel.from': null,
      'travel.departAt': 0,
      'travel.arriveAt': 0,
      [`travel.visits.${destKey}`]: visits,
    };
    if (gained > 0) patch['travel.exp'] = (t.exp || 0) + gained;

    (async () => {
      try {
        await saveTravel(patch);
        landedRef.current = { stamp, at: Date.now(), done: true };
        playSfx('bell');
        setArrived({ country: dest, visits, exp: gained, cls: classOf(t.cls), no });
      } catch (e) {
        showToast('入国手続きに失敗しました。すこし待ってからもう一度開いてください。', 'error');
      }
    })();
  }, [t, now, saveTravel, showToast]);

  /* ---------- ほかのプレイヤーの航空会社 ---------- */
  const airlines = useMemo(() => {
    const out = [];
    for (const c of (companies || [])) {
      if (!isAirline({ ...c, isAirline: corpTypeOf(c.type)?.isAirline })) continue;
      for (const d of dests) {
        const seg = segKey(t.country, d.key);
        for (const cl of CLASSES) {
          const f = airFare(c, seg, cl.key);
          if (f > 0) out.push({ company: c, dest: d, cls: cl, fare: Math.round(f * (vip ? VIP_FARE_MUL : 1)) });
        }
      }
    }
    return out.sort((a, b) => a.fare - b.fare);
  }, [companies, dests, t.country, vip]);

  const boardAirline = useCallback(async (row) => {
    if (busyRef.current) return;
    const chk = canFly(t, t.country, row.dest.key, Date.now());
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }
    if (balance < row.fare) { showToast(`運賃 ${fmt(row.fare)} Y が足りません。`, 'warning'); return; }
    busyRef.current = true; setBusy(true);
    try {
      await updateBalance(-row.fare);
      if (onAirlineFare) await onAirlineFare(row.company.id, row.fare);
      const departAt = Date.now();
      await saveTravel({
        'travel.flyingTo': row.dest.key,
        'travel.from': t.country,
        'travel.departAt': departAt,
        'travel.arriveAt': departAt + row.cls.ms,
        'travel.cls': row.cls.key,
        'travel.spent': (t.spent || 0) + row.fare,
        'travel.flights': (t.flights || 0) + 1,
      });
      setArrived(null);
      playSfx('gate');
      if (emitNews) emitNews(`✈️ ${playerName} が ${row.company.name} で ${row.dest.name} へ！`, 'info');
      showToast(`${row.cls.icon} ${row.company.name} の ${row.dest.name} 行きに搭乗しました。`, 'success');
    } catch (e) {
      showToast('搭乗手続きに失敗しました。', 'error');
    } finally { busyRef.current = false; setBusy(false); }
  }, [t, balance, updateBalance, saveTravel, showToast, emitNews, playerName, onAirlineFare]);

  /* ---------- 搭乗 ---------- */
  const board = useCallback(async (destKey, clsKey) => {
    if (busyRef.current) return;
    const chk = canFly(t, t.country, destKey, Date.now());
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }

    const dest = countryOf(destKey);
    const cls = classOf(clsKey);
    const fare = fareOf(t.country, destKey, cls.key, vip, fly);
    if (fare <= 0) { showToast('この区間に定期便はありません。', 'warning'); return; }

    // 現地の紙幣でも払える（両替の手数料なし）
    const useCur = payCur !== BASE_CURRENCY && payCur === localCur.code ? payCur : BASE_CURRENCY;
    const price = priceIn(fare, useCur);
    if (useCur === BASE_CURRENCY) {
      if (balance < fare) {
        showToast(`運賃 ${fmt(fare)} Y が足りません。あと ${fmt(fare - balance)} Y です。`, 'warning');
        return;
      }
    } else if ((wallet[useCur] || 0) < price) {
      showToast(`運賃 ${fmt(price)} ${useCur} が足りません。両替所で用意してください。`, 'warning');
      return;
    }

    busyRef.current = true; setBusy(true);
    let paid = false;
    try {
      if (useCur === BASE_CURRENCY) await updateBalance(-fare);
      else await saveWallet({ [`wallet.${useCur}`]: (wallet[useCur] || 0) - price });
      paid = true;

      // YUTAPON FLY の売上に計上（失敗してもゲームは止めない）
      recordFlight(fare);

      const departAt = Date.now();
      const arriveAt = departAt + cls.ms;
      await saveTravel({
        'travel.flyingTo': destKey,
        'travel.from': t.country,
        'travel.departAt': departAt,
        'travel.arriveAt': arriveAt,
        'travel.cls': cls.key,
        'travel.spent': (t.spent || 0) + fare,
        'travel.flights': (t.flights || 0) + 1,
      });

      setArrived(null);
      playSfx('gate');

      // ファーストクラスの搭乗ボーナス（失敗しても搭乗は成立する）
      let bonus = boardingBonus(cls, fare);
      if (bonus > 0) {
        try { await updateBalance(bonus); } catch (e) { bonus = 0; }
      }

      if (emitNews) emitNews(`✈️ ${playerName} が ${dest.name} へ飛び立った！`, 'info');
      showToast(
        `${cls.icon} ${dest.name} 行き ${flightNoOf(t.country, destKey, cls.key)} 便に搭乗しました。`
        + (bonus > 0 ? ` 👑ウェルカムギフト +${fmt(bonus)} Y` : ''),
        'success',
      );
    } catch (e) {
      if (paid) { try { await updateBalance(fare); } catch (e2) { /* noop */ } }
      showToast('搭乗できませんでした。もう一度お試しください。', 'error');
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [t, vip, balance, updateBalance, saveTravel, showToast, emitNews, playerName, fly, payCur, localCur, priceIn, wallet, saveWallet]);

  const blocked = busy || flying || landing;
  const blockedReason = flying ? '飛行中は搭乗できません' : landing ? '入国手続きの最中です' : '';

  /* ---------- 画面 ---------- */
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <FlyStyles />

      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft size={20} /> メニューに戻る
        </button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} Y</div>
      </div>

      <Panel gold className="p-5 mb-4">
        <SectionTitle icon={<PlaneTakeoff size={26} />} title="YUTAPON FLY" sub="国際空港 ・ 世界へ飛ぶ" />
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          4つの国を行き来できます。国が変わると、できることも変わります。
          運賃は <b className="text-amber-300">YUTAPON FLY</b> の売上になり、そのまま
          <b className="text-amber-300">パイロットの給料倍率</b> を押し上げます。
          {vip
            ? <> VIP会員のあなたは、全路線の運賃が <b className="text-amber-300">{Math.round(VIP_FARE_MUL * 100)}％（1割引）</b> です。<VipBadge size="xs" className="ml-1" /></>
            : <> VIP会員になると、運賃が <b className="text-amber-300">0.9倍（1割引）</b> になります。</>}
        </p>
      </Panel>

      <div className="mb-4">
        <DepartureBoard rows={rows} balance={balance} travel={t} now={now} here={here} />
      </div>

      {arrived && (
        <div className="mb-4">
          <ArrivedCard data={arrived} onClose={() => { playSfx('click'); setArrived(null); }} />
        </div>
      )}

      {(flying || landing) ? (
        <div className="mb-4">
          {flying
            ? <InFlightPanel travel={t} now={now} />
            : (
              <Panel gold className="p-6 text-center">
                <PlaneLanding size={32} className="mx-auto text-amber-300 mb-2" />
                <p className="text-sm font-black text-white">着陸しました</p>
                <p className="text-[11px] text-gray-500">入国手続きをしています……</p>
              </Panel>
            )}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <HereCard here={here} visits={t.visits?.[here.key] || 0} />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Ticket size={14} className="text-amber-300" />
            <span className="text-[11px] font-black tracking-widest text-amber-200/70">搭乗券を買う</span>
          </div>

          {/* 支払い通貨 */}
          <Panel className="p-3 mb-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <span className="text-[10px] font-black tracking-[0.25em] text-amber-200/60">支払い</span>
              <span className="text-[10px] text-gray-500">
                現地の紙幣で払うと <b className="text-emerald-300">両替手数料ゼロ</b>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[currencyOf(BASE_CURRENCY), ...(localCur.code !== BASE_CURRENCY ? [localCur] : [])].map((c) => {
                const on = payCur === c.code;
                const have = c.code === BASE_CURRENCY ? balance : (wallet[c.code] || 0);
                return (
                  <button key={c.code} onClick={() => setPayCur(c.code)}
                    className={`p-2.5 rounded-2xl border-2 text-left transition
                      ${on ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-black/40 hover:border-white/25'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg leading-none">{c.icon}</span>
                      <span className="text-[12px] font-black text-white">{c.symbol}</span>
                      <span className="text-[10px] text-gray-500 truncate">{c.name}</span>
                    </div>
                    <div className="font-mono text-[12px] font-black tabular-nums" style={{ color: c.color }}>
                      {fmt(have)}
                    </div>
                  </button>
                );
              })}
            </div>
            {localCur.code === BASE_CURRENCY && (
              <p className="text-[10px] text-gray-600 mt-1.5">
                いまは本国なので G で支払います。別の国にいるときは、その国の紙幣でも払えます。
              </p>
            )}
          </Panel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {dests.map((d) => (
              <DestinationCard
                key={d.key}
                dest={d}
                from={t.country}
                vip={vip}
                fly={fly}
                balance={balance}
                selected={pickOf(d.key)}
                onSelect={select}
                onBoard={board}
                disabled={blocked}
                blockedReason={blockedReason}
              />
            ))}
          </div>
        </>
      )}

      {/* ほかのプレイヤーの航空会社 */}
      {!blocked && airlines.length > 0 && (
        <Panel className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Plane size={14} className="text-sky-300" />
            <span className="text-[12px] font-black text-white">ほかの航空会社の便</span>
            <span className="text-[10px] text-gray-500">プレイヤーが起業した会社です</span>
          </div>
          <p className="text-[10px] text-gray-500 mb-2.5">
            運賃はその会社が決めています。払った運賃の8割はその会社の資産に、2割はパイロットのプールに入ります。
          </p>
          <div className="space-y-1.5">
            {airlines.map((row, i) => (
              <div key={`${row.company.id}-${row.dest.key}-${row.cls.key}`}
                className="flex items-center gap-2 p-2.5 rounded-2xl bg-black/40 border border-white/10 flex-wrap">
                <span className="text-lg leading-none shrink-0">🛩️</span>
                <div className="flex-1 min-w-[140px]">
                  <div className="text-[12px] font-black text-white truncate">{row.company.name}</div>
                  <div className="text-[10px] text-gray-500">
                    {row.dest.icon}{row.dest.short || row.dest.name} ・ {row.cls.icon}{row.cls.name}
                    {row.company.owner ? ` ・ ${row.company.owner} さんの会社` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono text-[13px] font-black tabular-nums ${row.fare > balance ? 'text-red-400/80' : 'text-emerald-300'}`}>
                    {fmt(row.fare)} Y
                  </div>
                  {(() => {
                    const std = fareOf(t.country, row.dest.key, row.cls.key, vip, fly);
                    if (!std) return null;
                    const diff = Math.round(((row.fare - std) / std) * 100);
                    return (
                      <div className={`text-[9px] font-bold ${diff <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        YUTAPON-FLY 比 {diff > 0 ? '+' : ''}{diff}%
                      </div>
                    );
                  })()}
                </div>
                <GoldButton onClick={() => boardAirline(row)} disabled={busy || row.fare > balance}
                  className="px-3 py-1.5 text-[11px] shrink-0">搭乗</GoldButton>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 運航管理（YUTAPON-FLY 社員だけ）: 区間ごとの運賃を決める */}
      {job?.key === 'FLYSTAFF' && (
        <FarePolicy fly={fly} playerName={playerName} showToast={showToast} />
      )}

      {/* あなたの旅の記録 */}
      <Panel className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Clock size={14} className="text-gray-400" />
          <span className="text-[11px] font-black tracking-widest text-gray-400">あなたの旅の記録</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">搭乗回数</div>
            <div className="font-mono font-black text-sky-300 text-sm tabular-nums">{fmt(t.flights)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">運賃の合計</div>
            <div className="font-mono font-black text-amber-300 text-sm tabular-nums">{fmt(t.spent)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">訪れた国</div>
            <div className="font-mono font-black text-gray-300 text-sm tabular-nums">{visitedCount} / {COUNTRIES.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">機内で得た経験値</div>
            <div className="font-mono font-black text-emerald-300 text-sm tabular-nums">{fmt(t.exp)}</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => (
            <span key={c.key}
              className={`text-[10px] font-black px-2 py-0.5 rounded-md border
                ${c.key === t.country ? 'text-amber-200 border-amber-400/40 bg-amber-400/10' : 'text-gray-500 border-white/10 bg-black/30'}`}>
              {c.icon} {c.short} {c.key === t.country ? '（滞在中）' : `${t.visits?.[c.key] || 0}回`}
            </span>
          ))}
        </div>
      </Panel>

      <FlyLedger fly={fly} isPilot={isPilot} />

      <p className="text-[10px] text-gray-600 text-center mt-4 leading-relaxed">
        路線は6区間。運賃は YUTAPON-FLY が決めています（運航管理の社員が変更できます）。</p>
      <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-gray-600">
        <Crown size={11} /> VIPは全路線1割引
      </div>
    </div>
  );
}
