import React, { useState } from 'react';
import { ArrowLeft, Spade, Users, Bot } from 'lucide-react';
import { Panel } from '../../shared/ui';
import PokerSolo from './Solo';
import PokerOnline from './Online';

/* ==========================================================
   TEXAS HOLD'EM — モード選択
   ========================================================== */
export default function PokerView(props) {
  const [mode, setMode] = useState(null);   // null | 'SOLO' | 'ONLINE'

  if (mode === 'SOLO') return <PokerSolo {...props} onBack={() => setMode(null)} />;
  if (mode === 'ONLINE') return <PokerOnline {...props} onBack={() => setMode(null)} />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="w-full flex justify-between items-center mb-4">
        <button onClick={props.onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft size={20} /> 戻る
        </button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">
          {(props.balance || 0).toLocaleString()} G
        </div>
      </div>

      <Panel gold className="p-6">
        <h2 className="text-3xl font-black text-white mb-1 flex items-center gap-2"><Spade size={26} /> TEXAS HOLD'EM</h2>
        <p className="text-sm text-amber-200/70 mb-5">
          SB/BB・ディーラーボタン移動・ミニマムレイズ・サイドポットに対応した本式ルールです。
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <button onClick={() => setMode('SOLO')}
            className="text-left p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/50 to-emerald-950 hover:border-emerald-400/60 transition">
            <div className="text-3xl mb-2"><Bot size={30} className="text-emerald-300" /></div>
            <div className="text-xl font-black text-white">ソロ（CPU対戦）</div>
            <p className="text-xs text-gray-400 mt-1">6種類の性格を持つCPUと、いつでも好きなだけ。</p>
          </button>
          <button onClick={() => setMode('ONLINE')}
            className="text-left p-5 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-900/50 to-sky-950 hover:border-sky-400/60 transition">
            <div className="text-3xl mb-2"><Users size={30} className="text-sky-300" /></div>
            <div className="text-xl font-black text-white">オンライン対戦</div>
            <p className="text-xs text-gray-400 mt-1">テーブルを立ち上げて、みんなで同じ卓を囲む。最大6人。</p>
          </button>
        </div>
      </Panel>
    </div>
  );
}
