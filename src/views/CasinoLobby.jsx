import React, { useState } from 'react';
import { ArrowLeft, Dices, Globe, Crown, Lock } from 'lucide-react';
import { Panel, SectionTitle, VipBadge, playSfx } from '../shared/ui.jsx';
import Baccarat from '../games/casino/Baccarat.jsx';
import SicBo from '../games/casino/SicBo.jsx';
import DragonTiger from '../games/casino/DragonTiger.jsx';
import Craps from '../games/casino/Craps.jsx';
import HighLow from '../games/casino/HighLow.jsx';
import Plinko from '../games/casino/Plinko.jsx';
import Keno from '../games/casino/Keno.jsx';
import Mines from '../games/casino/Mines.jsx';

/* ==========================================================
   カジノロビー
   ・オフラインカジノ … 相手はハウス。12卓ぜんぶここに並ぶ
   ・オンラインカジノ … 相手はほかのプレイヤー
   ギャンブル大国にいるときは、オフラインが「ハイローラー卓」になり
   ベットの上限が 100 倍になる。
   ========================================================== */

/** この画面の中でそのまま遊べる卓（カジノフロアの8卓） */
const INLINE = {
  BACCARAT: Baccarat, SICBO: SicBo, DRAGONTIGER: DragonTiger, CRAPS: Craps,
  HIGHLOW: HighLow, PLINKO: Plinko, KENO: Keno, MINES: Mines,
};

export const OFFLINE_GAMES = [
  { id: 'SLOT', name: 'SLOT MACHINE', jp: 'スロットマシン', icon: '🎰', tag: 'Reel', tone: 'from-purple-900/70 to-indigo-950', desc: '3Dリール・24コマ実機仕様', house: '還元率 96%' },
  { id: 'ROULETTE', name: 'NUMBER ROULETTE', jp: 'ナンバールーレット', icon: '🎡', tag: 'Wheel', tone: 'from-red-900/70 to-rose-950', desc: '数字エリア・矢印位置で厳密判定', house: '還元率 約96%' },
  { id: 'REDBLACK', name: 'RED & BLACK', jp: 'レッド＆ブラック', icon: '🔴', tag: 'Wheel', tone: 'from-rose-900/70 to-neutral-950', desc: '3D欧州式ホイール・本格ベットテーブル', house: '控除率 2.7%' },
  { id: 'BACCARAT', name: 'バカラ', icon: '🎴', tag: 'Table', tone: 'from-emerald-900/70 to-green-950', desc: 'プレイヤーとバンカー、どちらが 9 に近いか。絞りと罫線つき', house: '控除率 1.06〜1.24%' },
  { id: 'SICBO', name: '大小（シックボー）', icon: '🎲', tag: 'Table', tone: 'from-rose-900/70 to-red-950', desc: 'サイコロ3つ。賭け方は 50 通り', house: '控除率 2.8〜4.7%' },
  { id: 'DRAGONTIGER', name: 'ドラゴンタイガー', icon: '🐉', tag: 'Table', tone: 'from-amber-900/70 to-orange-950', desc: '1枚ずつ配って強い方が勝ち。オート10回つき', house: '控除率 3.7%' },
  { id: 'CRAPS', name: 'クラップス', icon: '🎯', tag: 'Table', tone: 'from-indigo-900/70 to-slate-950', desc: 'カムアウトからポイント、セブンアウトまで', house: '控除率 1.4〜5.0%' },
  { id: 'HIGHLOW', name: 'ハイ＆ロー', icon: '🃏', tag: 'Solo', tone: 'from-purple-900/70 to-fuchsia-950', desc: '連勝するほど倍率が伸びる。どこで降りるか', house: '控除率 4.0%' },
  { id: 'PLINKO', name: 'プリンコ', icon: '📍', tag: 'Arcade', tone: 'from-cyan-900/70 to-sky-950', desc: '玉を落として釘に当てる。オート10球', house: '控除率 約4%' },
  { id: 'KENO', name: 'ケノ', icon: '🔢', tag: 'Lottery', tone: 'from-violet-900/70 to-indigo-950', desc: '80個から20個の抽選。1〜10個を選ぶ', house: '控除率 約4.5%' },
  { id: 'MINES', name: 'マイン', icon: '💣', tag: 'Solo', tone: 'from-stone-800/80 to-neutral-950', desc: '地雷を避けて開けるほど倍率が伸びる', house: '控除率 4.0%' },
  { id: 'BLACKJACK', name: 'BLACKJACK', jp: 'ブラックジャック', icon: '🂡', tag: 'VIP Room', tone: 'from-amber-900/70 to-yellow-950', desc: '6デッキ・3:2配当・スプリット/ダブル対応', house: '控除率 約0.5%', vipOnly: true },
];

export const ONLINE_GAMES = [
  { id: 'POKER', name: "TEXAS HOLD'EM", jp: 'テキサスホールデム', icon: '🃏', tag: 'Card Room', tone: 'from-emerald-900/70 to-green-950', desc: '6人テーブル・SB/BB・サイドポット対応', house: 'プレイヤー同士' },
  { id: 'RACE', name: 'VIRTUAL TURF', jp: 'バーチャルターフ', icon: '🏇', tag: 'Racing', tone: 'from-lime-900/70 to-emerald-950', desc: '能力非公開・50種スキル・公開レース対応', house: 'パリミュチュエル' },
  { id: 'JANKEN', name: 'オンラインじゃんけん', icon: '✊', tag: 'Online', tone: 'from-pink-900/70 to-rose-950', desc: 'ルーム制2人対戦・チャット付き', house: 'プレイヤー同士' },
  { id: 'LIFE', name: 'オンライン人生ゲーム', icon: '🎲', tag: 'Online', tone: 'from-indigo-900/70 to-slate-950', desc: '最大6人・ルーレットで進む人生の盤上ゲーム', house: 'プレイヤー同士' },
];

export const lobbyListOf = (mode) => (mode === 'ONLINE' ? ONLINE_GAMES : OFFLINE_GAMES);

export default function CasinoLobby({
  mode = 'OFFLINE',                // OFFLINE | ONLINE
  balance, updateBalance, onBack, onPick, showToast, playerName, emitNews,
  vip = false, highRoller = false, countryName = 'YUTAPON-GROUP',
}) {
  const [inline, setInline] = useState(null);
  const list = lobbyListOf(mode);
  const online = mode === 'ONLINE';

  const Comp = inline ? INLINE[inline] : null;
  if (Comp) {
    return (
      <Comp
        balance={balance} updateBalance={updateBalance} onBack={() => setInline(null)}
        showToast={showToast} playerName={playerName} emitNews={emitNews}
        vip={vip} highRoller={highRoller}
      />
    );
  }

  const open = (g) => {
    if (g.vipOnly && !vip) {
      showToast('この卓は VIP 会員限定です。ショップで VIP 券をどうぞ。', 'warning');
      return;
    }
    playSfx('click');
    if (INLINE[g.id]) setInline(g.id);
    else onPick(g.id);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 font-bold transition">
        <ArrowLeft size={18} /> メニューに戻る
      </button>

      <SectionTitle
        icon={online ? <Globe size={26} /> : <Dices size={26} />}
        title={online ? 'オンラインカジノ' : highRoller ? 'ハイローラー・フロア' : 'オフラインカジノ'}
        sub={online
          ? `${countryName}｜相手はほかのプレイヤー・${list.length} 種類`
          : `${countryName}｜相手はハウス・${list.length} 卓${highRoller ? '／ベット上限 100 倍' : ''}`} />

      {highRoller && !online && (
        <Panel gold className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <Crown className="text-amber-300 shrink-0" size={22} />
            <div>
              <p className="text-sm font-black text-amber-200">ギャンブル大国のハイローラー卓です</p>
              <p className="text-[11px] text-amber-100/70">
                すべての卓でベットの上限が 100 倍になります。勝っても負けても桁が違います。
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(g => {
          const locked = g.vipOnly && !vip;
          return (
            <button key={g.id} onClick={() => open(g)}
              className={`group relative overflow-hidden bg-gradient-to-br ${g.tone} p-5 rounded-3xl shadow-2xl border transition-all transform hover:-translate-y-1 text-left
                ${locked ? 'border-amber-400/25 hover:border-amber-300/60' : 'border-white/10 hover:border-amber-400/50'}`}>
              <div className="absolute -top-6 -right-4 text-[104px] leading-none opacity-10 group-hover:opacity-20 transition select-none">{g.icon}</div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-black/40 text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] inline-block border border-amber-300/20">{g.tag}</span>
                {g.vipOnly && <VipBadge size="xs" />}
                {highRoller && !online && <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">×100</span>}
              </div>
              <h3 className="text-lg font-extrabold text-white mb-0.5 group-hover:text-amber-200 transition">{g.icon} {g.name}</h3>
              {g.jp && <p className="text-[11px] text-amber-200/50 font-bold mb-0.5">{g.jp}</p>}
              <p className="text-gray-400 text-[13px] leading-snug">{g.desc}</p>
              <p className="text-[10px] text-emerald-300/70 font-bold mt-1.5">{g.house}</p>
              {locked && <p className="text-[11px] text-amber-300/80 font-bold mt-1 flex items-center gap-1"><Lock size={10} />VIP会員になると遊べます</p>}
            </button>
          );
        })}
      </div>

      <Panel className="p-4 mt-4">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {online
            ? 'オンラインの卓は、ほかのプレイヤーと直接やりとりします。部屋に人がいないときは、少し待つか自分で部屋を作ってください。'
            : 'どの卓も配当と控除率を画面の中に正直に出しています。結果はベットを確定した瞬間に決まり、あとから引き直すことはできません。'}
          {' '}通貨はすべて架空のゲーム内通貨（Y・ユタ）です。
        </p>
      </Panel>
    </div>
  );
}
