import React, { useState } from 'react';
import { ArrowLeft, ShoppingBag, Check, Lock } from 'lucide-react';
import { Panel, GoldButton, VipBadge } from '../shared/ui';
import { VIP_PRICE, VIP_PERKS, VIP_SUBSCRIPTION } from '../shared/vip';

const fmt = (n) => (n || 0).toLocaleString();

export default function Shop({ balance, vip, vipSince, onBuyVip, onBack, showToast }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const buy = async () => {
    if (vip) return;
    if (balance < VIP_PRICE) { showToast('所持金が足りません。', 'error'); return; }
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await onBuyVip(); } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition">
        <ArrowLeft size={20} /> メニューに戻る
      </button>

      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20"><ShoppingBag size={24} /></div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">ショップ</h2>
          <p className="text-xs md:text-sm text-amber-200/60 font-semibold">所持金 {fmt(balance)} G</p>
        </div>
      </div>

      {/* ===== VIP券（買い切り） ===== */}
      <Panel gold className="p-0 overflow-hidden mb-4">
        <div className="relative p-6" style={{
          background: 'linear-gradient(135deg, rgba(120,75,10,0.55) 0%, rgba(40,25,5,0.5) 55%, rgba(12,8,2,0.5) 100%)',
        }}>
          <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,205,110,0.5) 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, rgba(255,205,110,0.5) 0 1px, transparent 1px 18px)',
          }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <VipBadge size="lg" />
                <h3 className="text-2xl font-black text-white">VIP券</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/15">買い切り</span>
              </div>
              <p className="text-sm text-amber-100/70">一度買えばずっと使える、YUTAPON CASINO の特別会員証です。</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-bold tracking-widest">PRICE</div>
              <div className="font-mono text-3xl font-black text-amber-300">{fmt(VIP_PRICE)}<span className="text-base ml-1">G</span></div>
            </div>
          </div>

          <div className="relative grid sm:grid-cols-2 gap-2 mt-5">
            {VIP_PERKS.map(p => (
              <div key={p.title} className="flex items-start gap-2.5 p-3 rounded-xl bg-black/45 border border-amber-300/15">
                <span className="text-xl leading-none mt-0.5">{p.icon}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-black text-white flex items-center gap-1.5">
                    {p.title}
                    {vip && <Check size={13} className="text-emerald-400" />}
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
                  <div className="font-black text-emerald-300">ご加入済みです</div>
                  {vipSince && <div className="text-[11px] text-gray-400">加入日：{new Date(vipSince).toLocaleDateString('ja-JP')}</div>}
                </div>
              </div>
            ) : (
              <>
                <GoldButton onClick={buy} disabled={busy || balance < VIP_PRICE} className="w-full py-4 text-lg">
                  {busy ? '購入中…' : confirm ? `本当に ${fmt(VIP_PRICE)} G で購入しますか？（もう一度押す）` : `${fmt(VIP_PRICE)} G で購入する`}
                </GoldButton>
                {balance < VIP_PRICE && (
                  <p className="text-[11px] text-red-400 mt-2 text-center">
                    あと {fmt(VIP_PRICE - balance)} G 足りません。
                  </p>
                )}
                {confirm && (
                  <button onClick={() => setConfirm(false)} className="w-full mt-2 text-[11px] text-gray-500 hover:text-gray-300 font-bold">キャンセル</button>
                )}
              </>
            )}
          </div>
        </div>
      </Panel>

      {/* ===== VIP券（定期購入） ===== */}
      <Panel className="p-5 opacity-70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 text-gray-500 border border-white/10"><Lock size={18} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-gray-300">VIP券（定期購入）</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/15">準備中</span>
              </div>
              <p className="text-[11px] text-gray-500">{VIP_SUBSCRIPTION.period}ごとに {fmt(VIP_SUBSCRIPTION.price)} G で自動更新される予定のプランです。</p>
            </div>
          </div>
          <button disabled className="px-6 py-2.5 rounded-xl font-black bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed">
            近日公開
          </button>
        </div>
      </Panel>

      <p className="text-[11px] text-gray-600 mt-5 text-center">
        ※ 通貨はすべて架空のゲーム内通貨（G）です。現実のお金は一切かかりません。
      </p>
    </div>
  );
}
