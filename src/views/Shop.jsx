import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ShoppingBag, Check, Lock, TrendingUp, TrendingDown, AlertTriangle, Repeat } from 'lucide-react';
import { Panel, GoldButton, VipBadge } from '../shared/ui';
import {
  VIP_PRICE, VIP_PERKS, VIP_SUB_PRICE, VIP_SUB_DAYS,
  ITEM_LIST, GOLD_BASE, goldSellPrice, TAG_ITEMS,
} from '../shared/vip';

const fmt = (n) => (n || 0).toLocaleString();

export default function Shop({
  vipPrice: vipPriceProp, vipSubPrice: vipSubProp, staffOff = 0,
  balance, vip, vipSince, vipSubUntil, vipActive, delinquent, delinquentInfo,
  items = {}, gold = 0, goldPx = GOLD_BASE, marketProfit = 0, ownedTags = [],
  onBuyVip, onSubscribe, onCancelSub, onBuyItem, onTradeGold, onBuyTag, onBack, showToast,
}) {
  const VIP_P = vipPriceProp ?? VIP_PRICE;
  const VIP_SUB_P = vipSubProp ?? VIP_SUB_PRICE;
  const StaffNote = () => (staffOff > 0 ? (
    <div className="mb-3 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-[11px] font-bold text-amber-200">
      🎰 YUTAPON-CASINO 職員特典：VIP 券が {Math.round(staffOff * 100)}％引きになっています
    </div>
  ) : null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [goldQty, setGoldQty] = useState(1);
  const [openPx] = useState(goldPx);
  const firstPx = useRef(goldPx);

  useEffect(() => { if (!firstPx.current) firstPx.current = goldPx; }, [goldPx]);
  const diff = goldPx - (firstPx.current || goldPx);

  /* ---------- 延滞中はショップに入れない ---------- */
  if (delinquent) {
    const hrs = Math.floor((delinquentInfo?.elapsed || 0) / 3600000);
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
          <ArrowLeft size={20} /> メニューに戻る
        </button>
        <Panel className="p-8 text-center border-red-500/40">
          <div className="text-5xl mb-3">🚫</div>
          <h2 className="text-2xl font-black text-red-300 mb-2">ショップは現在ご利用いただけません</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            ローンの返済が <b className="text-red-300">{hrs}時間</b> 滞っています。<br />
            ユタポンバンクでローンを完済すると、すぐに利用を再開できます。
          </p>
          {vip && (
            <div className="mt-4 p-3 rounded-xl bg-amber-400/5 border border-amber-400/25 text-[12px] text-amber-200/80">
              <AlertTriangle size={14} className="inline mr-1" />
              延滞中は <VipBadge size="xs" /> の特典も一時停止されています（完済で自動的に復帰します）。
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const run = async (key, fn) => {
    if (confirm !== key) { setConfirm(key); return; }
    setBusy(true);
    try { await fn(); } finally { setBusy(false); setConfirm(null); }
  };

  const buyItem = async (item) => {
    if (item.vipOnly && !vipActive) { showToast('この商品はVIP会員限定です。', 'warning'); return; }
    if (balance < item.price) { showToast('所持金が足りません。', 'error'); return; }
    setBusy(true);
    try { await onBuyItem(item); } finally { setBusy(false); }
  };

  const sellPx = goldSellPrice(goldPx);
  const qty = Math.max(1, Math.floor(Number(goldQty) || 1));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={20} /> メニューに戻る
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20"><ShoppingBag size={24} /></div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">ショップ</h2>
            <p className="text-xs md:text-sm text-amber-200/60 font-semibold">所持金 {fmt(balance)} Y</p>
          </div>
        </div>
        {gold > 0 && (
          <div className="px-4 py-2 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-right">
            <div className="text-[10px] text-amber-200/70 font-bold">保有している金</div>
            <div className="font-mono font-black text-amber-300">{fmt(gold)} 本 <span className="text-[11px] text-gray-400">≒ {fmt(gold * sellPx)} Y</span></div>
          </div>
        )}
      </div>

      {/* ===== 金の相場 ===== */}
      <Panel className="p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🥇</span>
            <div>
              <h3 className="text-xl font-black text-white">金（ゴールドバー）</h3>
              <p className="text-[11px] text-gray-500 max-w-md leading-snug">
                カジノ全体の景気に連動する現物資産。<b className="text-gray-300">プレイヤー全員の通算損益が増えると値上がり</b>し、減ると値下がりします。
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-bold tracking-widest">現在価格 / 本</div>
            <div className="font-mono text-3xl font-black text-amber-300 flex items-center gap-2 justify-end">
              {diff !== 0 && (diff > 0
                ? <TrendingUp size={20} className="text-emerald-400" />
                : <TrendingDown size={20} className="text-red-400" />)}
              {fmt(goldPx)}<span className="text-base">G</span>
            </div>
            <div className="text-[11px] text-gray-500">
              基準 {fmt(GOLD_BASE)} Y ／ 売値 {fmt(sellPx)} Y
            </div>
          </div>
        </div>

        {/* 相場のメーター */}
        <div className="mt-4">
          <div className="h-2 rounded-full bg-black/60 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${Math.max(2, Math.min(100, (goldPx / (GOLD_BASE * 4)) * 100))}%`,
                background: goldPx >= GOLD_BASE
                  ? 'linear-gradient(90deg,#f59e0b,#fde68a)'
                  : 'linear-gradient(90deg,#7f1d1d,#ef4444)',
              }} />
            <div className="absolute inset-y-0" style={{ left: '25%', width: 2, background: 'rgba(255,255,255,0.45)' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>安値</span>
            <span>基準</span>
            <span>高値</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            みんなの通算損益 合計：
            <b className={marketProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}> {marketProfit >= 0 ? '+' : ''}{fmt(marketProfit)} Y</b>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 mt-4">
          <div>
            <div className="text-[10px] text-gray-400 font-bold mb-1">本数</div>
            <input type="number" min="1" value={goldQty} onChange={e => setGoldQty(e.target.value)}
              className="w-24 bg-black/60 text-white font-mono text-lg p-2 rounded-lg border border-white/10 focus:border-amber-400 outline-none" />
          </div>
          <div className="flex gap-1">
            {[1, 5, 10].map(v => (
              <button key={v} onClick={() => setGoldQty(v)} className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-black border border-white/10">{v}</button>
            ))}
            <button onClick={() => setGoldQty(Math.max(1, Math.floor(balance / goldPx)))} className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-black border border-white/10">最大</button>
          </div>
          <button onClick={() => onTradeGold('BUY', qty)} disabled={busy || balance < goldPx * qty}
            className="px-5 py-2.5 rounded-xl font-black bg-amber-500 hover:bg-amber-400 text-black transition disabled:opacity-30">
            買う（{fmt(goldPx * qty)} Y）
          </button>
          <button onClick={() => onTradeGold('SELL', qty)} disabled={busy || gold < qty}
            className="px-5 py-2.5 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-30">
            売る（+{fmt(sellPx * qty)} Y）
          </button>
        </div>
      </Panel>

      {/* ===== 消耗アイテム ===== */}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        {ITEM_LIST.map(item => {
          const locked = item.vipOnly && !vipActive;
          const owned = items[item.key] || 0;
          return (
            <Panel key={item.key} className={`p-4 ${locked ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-black text-white">{item.name}</h4>
                    {item.vipOnly && <VipBadge size="xs" />}
                    {owned > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">所持 {owned}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{item.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-amber-300">{fmt(item.price)}</div>
                  <button onClick={() => buyItem(item)} disabled={busy || locked || balance < item.price}
                    className="mt-1 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-400 text-black hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
                    {locked ? <span className="flex items-center gap-1"><Lock size={10} />VIP限定</span> : '購入'}
                  </button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* ===== 称号（名前の横につくタグ）｜買い切り・VIP限定 ===== */}
      <div className="mb-4">
        <p className="text-[11px] text-amber-200/60 uppercase tracking-[0.25em] font-bold mb-2">Title</p>
        <div className="grid md:grid-cols-2 gap-3">
          {TAG_ITEMS.map(t => {
            const owned = (ownedTags || []).includes(t.key);
            const locked = t.vipOnly && !vipActive;
            return (
              <Panel key={t.key} gold className={`p-4 ${locked ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-white">{t.name}</h4>
                      {t.vipOnly && <VipBadge size="xs" />}
                      {owned && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">所持済み</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                      名前の横に <span className="font-black" style={{ color: t.color }}>{t.label}</span> を付けられるようになります。プロフィールのタグから選んでください。
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-amber-300">{fmt(t.price)}</div>
                    <button onClick={() => onBuyTag && onBuyTag(t)} disabled={busy || locked || owned || balance < t.price}
                      className="mt-1 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-400 text-black hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed">
                      {owned ? '所持済み' : locked ? <span className="flex items-center gap-1"><Lock size={10} />VIP限定</span> : '購入'}
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <StaffNote />
      {/* ===== VIP券（買い切り）｜YUTAPON-CASINO 管轄 ===== */}
      <Panel gold className="p-0 overflow-hidden mb-4">
        <div className="relative p-6" style={{ background: 'linear-gradient(135deg, rgba(120,75,10,0.55) 0%, rgba(40,25,5,0.5) 55%, rgba(12,8,2,0.5) 100%)' }}>
          <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,205,110,0.5) 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, rgba(255,205,110,0.5) 0 1px, transparent 1px 18px)',
          }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <VipBadge size="lg" />
                <h3 className="text-2xl font-black text-white">VIP券</h3>
                <p className="text-[10px] font-black tracking-widest text-amber-200/60">YUTAPON-CASINO 管轄</p>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/15">買い切り</span>
              </div>
              <p className="text-sm text-amber-100/70">一度買えばずっと使える、YUTAPON CASINO の特別会員証です。</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-bold tracking-widest">PRICE</div>
              <div className="font-mono text-3xl font-black text-amber-300">{fmt(VIP_P)}<span className="text-base ml-1">G</span></div>
            </div>
          </div>

          <div className="relative grid sm:grid-cols-2 gap-2 mt-5">
            {VIP_PERKS.map(p => (
              <div key={p.title} className="flex items-start gap-2.5 p-3 rounded-xl bg-black/45 border border-amber-300/15">
                <span className="text-xl leading-none mt-0.5">{p.icon}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-black text-white flex items-center gap-1.5">
                    {p.title}{vipActive && <Check size={13} className="text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-gray-400 leading-snug">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-5">
            {vip ? (
              <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30">
                <Check size={20} className="text-emerald-400" />
                <div className="flex-1">
                  <div className="font-black text-emerald-300">ご加入済みです（買い切り）</div>
                  {vipSince > 0 && <div className="text-[11px] text-gray-400">加入日：{new Date(vipSince).toLocaleDateString('ja-JP')}</div>}
                </div>
              </div>
            ) : (
              <>
                <GoldButton onClick={() => run('vip', onBuyVip)} disabled={busy || balance < VIP_P} className="w-full py-4 text-lg">
                  {busy ? '購入中…' : confirm === 'vip' ? `本当に ${fmt(VIP_P)} Y で購入しますか？（もう一度押す）` : `${fmt(VIP_P)} Y で購入する`}
                </GoldButton>
                {balance < VIP_P && <p className="text-[11px] text-red-400 mt-2 text-center">あと {fmt(VIP_P - balance)} Y 足りません。</p>}
              </>
            )}
          </div>
        </div>
      </Panel>

      {/* ===== VIP券（定期購入） ===== */}
      <Panel className="p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-400/20"><Repeat size={18} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">VIP券（定期購入）</h3>
                <VipBadge size="xs" />
              </div>
              <p className="text-[11px] text-gray-400">
                {VIP_SUB_DAYS}日ごとに {fmt(VIP_SUB_P)} Y。期限が来ると自動で更新され、所持金が足りないときは自動で解約されます。
              </p>
              {vipSubUntil > Date.now() && (
                <p className="text-[11px] text-emerald-300 font-bold mt-0.5">
                  次回更新：{new Date(vipSubUntil).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          {vip ? (
            <span className="px-4 py-2.5 rounded-xl font-black bg-white/5 text-gray-500 border border-white/10 text-sm">買い切りで加入済み</span>
          ) : vipSubUntil > Date.now() ? (
            <button onClick={() => run('cancel', onCancelSub)} disabled={busy}
              className="px-5 py-2.5 rounded-xl font-black bg-red-700/80 hover:bg-red-600 text-white transition text-sm">
              {confirm === 'cancel' ? '本当に解約しますか？' : '解約する'}
            </button>
          ) : (
            <GoldButton onClick={() => run('sub', onSubscribe)} disabled={busy || balance < VIP_SUB_P} className="px-6 py-2.5">
              {confirm === 'sub' ? 'もう一度押して確定' : `${fmt(VIP_SUB_P)} Y で加入`}
            </GoldButton>
          )}
        </div>
      </Panel>

      <p className="text-[11px] text-gray-600 mt-5 text-center">
        ※ 通貨はすべて架空のゲーム内通貨（Y）です。現実のお金は一切かかりません。
      </p>
    </div>
  );
}
