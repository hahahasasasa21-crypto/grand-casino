import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowLeftRight, TrendingUp, TrendingDown, Globe, Info } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, playSfx } from '../shared/ui.jsx';
import {
  CURRENCIES, FOREIGN, currencyOf, currencyOfCountry, BASE_CURRENCY,
  ratesOf, rateOf, buyRate, sellRate, costToBuy, gainToSell, spreadOf,
  normalizeWallet, walletValue, economyOf, strengthOf, changeOf, fmtMoney,
} from '../shared/fx.js';
import { COUNTRIES, countryOf } from '../shared/world.js';

const fmt = (n) => Math.round(n || 0).toLocaleString();

/* ---------- レートの折れ線（SVG・履歴をそのまま描く） ---------- */
function Spark({ hist = [], code, color }) {
  const vals = hist.map(h => h?.[code]).filter(v => Number.isFinite(v));
  if (vals.length < 2) {
    return <div className="h-12 flex items-center justify-center text-[10px] text-gray-600">値動きはこれから記録されます</div>;
  }
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || max * 0.02 || 1;
  const W = 240, H = 48;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / span) * (H - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 block">
      <defs>
        <linearGradient id={`fx-${code}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill={`url(#fx-${code})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={up ? color : '#f87171'} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- 景気メーター ---------- */
function EconBar({ label, icon, value, color }) {
  const s = strengthOf(value);                 // 0.4 〜 1.6
  const p = Math.max(0, Math.min(100, ((s - 0.4) / 1.2) * 100));
  return (
    <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-black text-white">{icon} {label}</span>
        <span className="text-[11px] font-mono font-black" style={{ color }}>×{s.toFixed(3)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

/* ==========================================================
   両替所
   ========================================================== */
export default function ExchangeView({
  balance, updateBalance, onBack, showToast, playerName,
  wallet: rawWallet, saveWallet, vip = false,
  house, companies = [], fly, arena, fxHistory = [], country = 'HOME',
}) {
  const [pick, setPick] = useState('BC');
  const [side, setSide] = useState('BUY');     // BUY … Y を払って外貨を買う
  const [qty, setQty] = useState(10);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const wallet = useMemo(() => normalizeWallet(rawWallet), [rawWallet]);
  const ctx = useMemo(() => ({ house, companies, fly, arena }), [house, companies, fly, arena]);
  const rates = useMemo(() => ratesOf(ctx), [ctx]);
  const econ = useMemo(() => economyOf(ctx), [ctx]);

  const cur = currencyOf(pick);
  const have = wallet[pick] || 0;
  const cost = costToBuy(qty, pick, ctx, vip);
  const gain = gainToSell(qty, pick, ctx, vip);
  const spread = spreadOf(vip);
  const localCode = currencyOfCountry(country).code;

  useEffect(() => { setQty(q => Math.max(1, Math.floor(q) || 1)); }, [pick, side]);

  const trade = async () => {
    if (busyRef.current) return;
    const n = Math.max(1, Math.floor(qty) || 0);
    if (side === 'BUY') {
      const g = costToBuy(n, pick, ctx, vip);
      if (balance < g) { showToast(`${fmt(g)} Y が足りません。`, 'error'); return; }
      busyRef.current = true; setBusy(true);
      try {
        await updateBalance(-g);
        await saveWallet({ [`wallet.${pick}`]: (wallet[pick] || 0) + n });
        playSfx('coin');
        showToast(`${cur.icon} ${fmt(n)} ${cur.symbol} を買いました（-${fmt(g)} Y）`, 'success');
      } catch (e) { showToast('両替に失敗しました。', 'error'); }
      finally { busyRef.current = false; setBusy(false); }
    } else {
      if (have < n) { showToast(`${cur.symbol} が足りません。`, 'error'); return; }
      const g = gainToSell(n, pick, ctx, vip);
      busyRef.current = true; setBusy(true);
      try {
        await saveWallet({ [`wallet.${pick}`]: have - n });
        await updateBalance(g);
        playSfx('coin');
        showToast(`${cur.icon} ${fmt(n)} ${cur.symbol} を売りました（+${fmt(g)} Y）`, 'success');
      } catch (e) { showToast('両替に失敗しました。', 'error'); }
      finally { busyRef.current = false; setBusy(false); }
    }
  };

  const maxQty = side === 'BUY'
    ? Math.floor(balance / Math.max(0.0001, buyRate(pick, ctx, vip)))
    : have;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white font-bold transition">
          <ArrowLeft size={18} /> メニューに戻る
        </button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">
          {fmt(balance)} Y
        </div>
      </div>

      <SectionTitle icon={<ArrowLeftRight size={26} />} title="両替所"
        sub={`YUTAPON EXCHANGE｜手数料 ${Math.round(spread * 100)}%${vip ? '（VIP 半額）' : ''}`} />

      {/* ---- 財布 ---- */}
      <Panel gold className="p-4 mb-4">
        <div className="text-[10px] font-black tracking-[0.3em] text-amber-200/60 mb-2">WALLET</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CURRENCIES.map(c => {
            const amt = c.code === BASE_CURRENCY ? balance : (wallet[c.code] || 0);
            const isLocal = c.code === localCode;
            return (
              <div key={c.code} className={`px-3 py-2.5 rounded-2xl border ${isLocal ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg leading-none">{c.icon}</span>
                  <span className="text-[12px] font-black text-white">{c.symbol}</span>
                  <span className="text-[10px] text-gray-500">{c.name}</span>
                  {isLocal && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">いまいる国</span>}
                </div>
                <div className="font-mono font-black text-xl" style={{ color: c.color }}>{fmt(amt)}</div>
                {c.code !== BASE_CURRENCY && (
                  <div className="text-[10px] text-gray-500">≒ {fmt((wallet[c.code] || 0) * rates[c.code])} Y</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] px-1">
          <span className="text-gray-500 font-bold">外貨をぜんぶ Y に直すと</span>
          <span className="font-mono font-black text-emerald-300">{fmt(walletValue(wallet, ctx))} Y</span>
        </div>
      </Panel>

      {/* ---- レート板 ---- */}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        {FOREIGN.map(c => {
          const ch = changeOf(fxHistory, c.code);
          const up = ch >= 0;
          return (
            <Panel key={c.code} className={`p-4 cursor-pointer transition ${pick === c.code ? 'ring-1 ring-amber-400/60' : ''}`}>
              <button onClick={() => setPick(c.code)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xl leading-none">{c.icon}</span>
                      <span className="font-black text-white">{c.symbol}</span>
                      <span className="text-[11px] text-gray-500">{c.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {countryOf(c.country)?.icon} {countryOf(c.country)?.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-xl" style={{ color: c.color }}>
                      {rates[c.code].toFixed(4)}
                    </div>
                    <div className="text-[10px] text-gray-500">Y / 1 {c.symbol}</div>
                    <div className={`text-[11px] font-black flex items-center justify-end gap-0.5 ${up ? 'text-emerald-300' : 'text-red-300'}`}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{up ? '+' : ''}{ch}%
                    </div>
                  </div>
                </div>
                <Spark hist={fxHistory} code={c.code} color={c.color} />
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-center">
                    <div className="text-[9px] text-gray-500 font-bold">買う</div>
                    <div className="text-[11px] font-mono font-black text-red-300">{buyRate(c.code, ctx, vip).toFixed(4)}</div>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-center">
                    <div className="text-[9px] text-gray-500 font-bold">売る</div>
                    <div className="text-[11px] font-mono font-black text-emerald-300">{sellRate(c.code, ctx, vip).toFixed(4)}</div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">{c.desc}</p>
              </button>
            </Panel>
          );
        })}
      </div>

      {/* ---- 両替 ---- */}
      <Panel className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black tracking-[0.3em] text-amber-200/60">TRADE</span>
          <span className="text-[12px] font-black text-white">{cur.icon} {cur.symbol}</span>
          {vip && <VipBadge size="xs" />}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[{ k: 'BUY', label: `Y で ${cur.symbol} を買う`, tone: 'text-red-200' },
          { k: 'SELL', label: `${cur.symbol} を Y に替える`, tone: 'text-emerald-200' }].map(x => (
            <button key={x.k} onClick={() => setSide(x.k)}
              className={`py-2.5 rounded-2xl text-[12px] font-black border transition
                ${side === x.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : `border-white/10 bg-black/40 ${x.tone} opacity-70 hover:opacity-100`}`}>
              {x.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setQty(q => Math.max(1, Math.floor(q) - 10))}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black">−</button>
          <input type="number" value={qty} min={1}
            onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="flex-1 bg-black/60 text-white font-mono text-lg text-center p-2.5 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
          <button onClick={() => setQty(q => Math.floor(q) + 10)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black">＋</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[10, 100, 1000].map(n => (
            <button key={n} onClick={() => setQty(n)}
              className="py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] font-black text-gray-300 hover:border-amber-400/50">{n}</button>
          ))}
          <button onClick={() => setQty(Math.max(1, maxQty))}
            className="py-1.5 rounded-lg bg-amber-400/80 text-black text-[11px] font-black">最大</button>
        </div>

        <div className="p-3 rounded-2xl bg-black/50 border border-white/10 mb-3">
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-gray-400 font-bold">{side === 'BUY' ? '受け取る' : '渡す'}</span>
            <span className="font-mono font-black" style={{ color: cur.color }}>{fmt(qty)} {cur.symbol}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-400 font-bold">{side === 'BUY' ? '支払う' : '受け取る'}</span>
            <span className={`font-mono font-black ${side === 'BUY' ? 'text-red-300' : 'text-emerald-300'}`}>
              {side === 'BUY' ? `-${fmt(cost)}` : `+${fmt(gain)}`} Y
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1 pt-1 border-t border-white/10">
            <span>手数料 {Math.round(spread * 100)}%</span>
            <span>実効 {(side === 'BUY' ? buyRate(pick, ctx, vip) : sellRate(pick, ctx, vip)).toFixed(4)} Y / {cur.symbol}</span>
          </div>
        </div>

        <GoldButton onClick={trade} disabled={busy || qty < 1 || (side === 'BUY' ? balance < cost : have < qty)}
          className="w-full py-3.5 text-lg">
          {side === 'BUY' ? `${fmt(cost)} Y で買う` : `${fmt(qty)} ${cur.symbol} を売る`}
        </GoldButton>
      </Panel>

      {/* ---- 景気 ---- */}
      <Panel className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={14} className="text-sky-300" />
          <span className="text-[12px] font-black text-white">国ごとの景気</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {COUNTRIES.map(c => (
            <EconBar key={c.key} label={c.name} icon={c.icon} value={econ[c.key] || 0}
              color={currencyOfCountry(c.key).color} />
          ))}
        </div>
        <div className="mt-3 flex gap-2 items-start">
          <Info size={13} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            レートは景気で動きます。<b className="text-rose-300">カジノで誰かが負けるほど BC が強く</b>なり、
            <b className="text-sky-300">会社の売上と法人税が増えるほど WD が強く</b>なります。
            本国の金庫が増えると Y 自体が強くなるので、外貨は相対的に安くなります。
            ランダムではなく、みんなの遊んだ結果がそのまま数字になっています。
          </p>
        </div>
      </Panel>
    </div>
  );
}
