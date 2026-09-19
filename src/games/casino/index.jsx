import React, { useState } from 'react';
import { ArrowLeft, Dices, Crown } from 'lucide-react';
import { Panel, SectionTitle, VipBadge, playSfx } from '../../shared/ui.jsx';
import Baccarat from './Baccarat.jsx';
import SicBo from './SicBo.jsx';
import DragonTiger from './DragonTiger.jsx';
import Craps from './Craps.jsx';
import HighLow from './HighLow.jsx';
import Plinko from './Plinko.jsx';
import Keno from './Keno.jsx';
import Mines from './Mines.jsx';

/* ==========================================================
   カジノフロア — 新しいテーブルをまとめた部屋
   ギャンブル大国（GAMBLE）にいるときは「ハイローラー卓」になり、
   ベットの上限が 100 倍になる。
   ========================================================== */

export const FLOOR_GAMES = [
  {
    id: 'BACCARAT', name: 'バカラ', icon: '🎴', Comp: Baccarat,
    tag: 'Table', tone: 'from-emerald-900/70 to-green-950',
    desc: 'プレイヤーとバンカー、どちらが 9 に近いか。絞りと罫線つきの本格卓。',
    house: '控除率 1.06〜1.24%（メイン）',
  },
  {
    id: 'SICBO', name: '大小（シックボー）', icon: '🎲', Comp: SicBo,
    tag: 'Table', tone: 'from-rose-900/70 to-red-950',
    desc: 'サイコロ3つ。大小・ゾロ目・合計・1個賭けと、賭け方が 50 通り。',
    house: '控除率 2.8〜4.7%',
  },
  {
    id: 'DRAGONTIGER', name: 'ドラゴンタイガー', icon: '🐉', Comp: DragonTiger,
    tag: 'Table', tone: 'from-amber-900/70 to-orange-950',
    desc: '1枚ずつ配って強い方が勝ち。1ゲームが速い。オート10回つき。',
    house: '控除率 3.7%',
  },
  {
    id: 'CRAPS', name: 'クラップス', icon: '🎯', Comp: Craps,
    tag: 'Table', tone: 'from-indigo-900/70 to-slate-950',
    desc: 'サイコロ2つ。カムアウトからポイント、セブンアウトまで。案内つき。',
    house: '控除率 1.4〜5.0%',
  },
  {
    id: 'HIGHLOW', name: 'ハイ＆ロー', icon: '🃏', Comp: HighLow,
    tag: 'Solo', tone: 'from-purple-900/70 to-fuchsia-950',
    desc: '次のカードはハイかロー。連勝するほど倍率が伸びる。どこで降りるか。',
    house: '控除率 4.0%',
  },
  {
    id: 'PLINKO', name: 'プリンコ', icon: '🎯', Comp: Plinko,
    tag: 'Arcade', tone: 'from-cyan-900/70 to-sky-950',
    desc: '玉を落として釘に当てる。段数とリスクで配当の山が変わる。オート10球。',
    house: '控除率 約4%',
  },
  {
    id: 'KENO', name: 'ケノ', icon: '🔢', Comp: Keno,
    tag: 'Lottery', tone: 'from-violet-900/70 to-indigo-950',
    desc: '80個から20個の抽選。1〜10個を選んで的中数で配当。',
    house: '控除率 約4.5%',
  },
  {
    id: 'MINES', name: 'マイン', icon: '💣', Comp: Mines,
    tag: 'Solo', tone: 'from-stone-800/80 to-neutral-950',
    desc: '地雷を避けて開けるほど倍率が伸びる。どこで回収するか。',
    house: '控除率 4.0%',
  },
];

export const floorGameOf = (id) => FLOOR_GAMES.find(g => g.id === id) || null;

export default function CasinoFloor({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  vip = false, highRoller = false, countryName = 'YUTAPON-GROUP',
}) {
  const [pick, setPick] = useState(null);
  const g = floorGameOf(pick);

  if (g) {
    const Comp = g.Comp;
    return (
      <Comp
        balance={balance} updateBalance={updateBalance} onBack={() => setPick(null)}
        showToast={showToast} playerName={playerName} emitNews={emitNews}
        vip={vip} highRoller={highRoller}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 font-bold transition">
        <ArrowLeft size={18} /> メニューに戻る
      </button>

      <SectionTitle icon={<Dices size={26} />}
        title={highRoller ? 'ハイローラー・フロア' : 'カジノフロア'}
        sub={highRoller ? `${countryName}｜ベット上限 100 倍` : `${countryName}｜8つのテーブル`} />

      {highRoller && (
        <Panel gold className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <Crown className="text-amber-300 shrink-0" size={22} />
            <div>
              <p className="text-sm font-black text-amber-200">ギャンブル大国のハイローラー卓です</p>
              <p className="text-[11px] text-amber-100/70">
                すべてのテーブルでベットの上限が 100 倍になります。勝っても負けても桁が違います。
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FLOOR_GAMES.map(x => (
          <button key={x.id}
            onClick={() => { playSfx('click'); setPick(x.id); }}
            className={`group relative overflow-hidden bg-gradient-to-br ${x.tone} p-5 rounded-3xl shadow-2xl border border-white/10 hover:border-amber-400/50 transition-all transform hover:-translate-y-1 text-left`}>
            <div className="absolute -top-6 -right-4 text-[104px] leading-none opacity-10 group-hover:opacity-20 transition select-none">{x.icon}</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-black/40 text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] inline-block border border-amber-300/20">{x.tag}</span>
              {highRoller && <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">×100</span>}
            </div>
            <h3 className="text-lg font-extrabold text-white mb-1 group-hover:text-amber-200 transition">{x.icon} {x.name}</h3>
            <p className="text-gray-400 text-[13px] leading-snug">{x.desc}</p>
            <p className="text-[10px] text-emerald-300/70 font-bold mt-1.5">{x.house}</p>
          </button>
        ))}
      </div>

      <Panel className="p-4 mt-4">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          どのテーブルも配当と控除率を画面の中に正直に出しています。結果はベットを確定した瞬間に決まり、
          あとから引き直すことはできません。通貨はすべて架空のゲーム内通貨（G）です。
        </p>
      </Panel>
    </div>
  );
}
