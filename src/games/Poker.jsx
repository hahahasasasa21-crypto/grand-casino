import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Spade, Volume2, VolumeX, LogOut, RefreshCw } from 'lucide-react';
import { Panel, GoldButton, PlayingCard, Chip, playSfx } from '../shared/ui';
import { evaluateHand } from '../shared/cards';
import {
  createTable, startHand, applyAction, cpuDecide, totalPot,
  STAKES, STREET_LABEL, PERSONAS,
} from './pokerEngine';

/* ==========================================================
   TEXAS HOLD'EM — 6人テーブル
   ・本式ルール（SB/BB、ボタン移動、ミニマムレイズ、サイドポット）
   ・CPUは性格ごとに戦い方が違う（タイト／超攻撃／ルースなど）
   ・テーブルにはバイインして着席。退席でスタックを所持金に戻す。
   ========================================================== */

const fmt = (n) => (n || 0).toLocaleString();

/** 席の配置（人間は常に手前中央） */
const SEAT_POS = {
  6: [[50, 96], [6, 70], [10, 22], [50, 4], [90, 22], [94, 70]],
  5: [[50, 96], [6, 62], [24, 8], [76, 8], [94, 62]],
  4: [[50, 96], [6, 48], [50, 4], [94, 48]],
  3: [[50, 96], [12, 22], [88, 22]],
  2: [[50, 96], [50, 4]],
};

function ChipStack({ amount, size = 18 }) {
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

function Seat({ p, isTurn, reveal, isWinner, dealer, seatPos, small }) {
  const [x, y] = seatPos;
  const dim = p.folded || !p.sitting;
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%`, width: small ? 112 : 126, zIndex: isTurn ? 25 : 12 }}>
      {/* カード */}
      <div className={`flex gap-0.5 transition-opacity ${dim ? 'opacity-25' : ''}`}>
        <PlayingCard card={p.hole?.[0]} hidden={!(p.isHuman || (reveal && !p.folded)) || !p.hole?.length} tiny={small} small={!small} />
        <PlayingCard card={p.hole?.[1]} hidden={!(p.isHuman || (reveal && !p.folded)) || !p.hole?.length} tiny={small} small={!small} />
      </div>

      {/* プレート */}
      <div className={`relative w-full rounded-xl px-2 py-1 border-2 text-center transition-all
        ${isWinner ? 'border-amber-300 bg-amber-400/25 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
          : isTurn ? 'border-emerald-300 bg-emerald-500/20 shadow-[0_0_14px_rgba(52,211,153,0.5)]'
            : 'border-white/15 bg-black/70'} ${dim ? 'opacity-45' : ''}`}>
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm leading-none">{p.avatar}</span>
          <span className="text-[11px] font-black text-white truncate max-w-[72px]">{p.name}</span>
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

export default function PokerView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [stakeIdx, setStakeIdx] = useState(1);
  const [seatCount, setSeatCount] = useState(6);
  const [table, setTable] = useState(null);
  const [hand, setHand] = useState(null);
  const [sound, setSound] = useState(true);
  const [raiseTo, setRaiseTo] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);

  const cpuTimer = useRef(null);
  const mountedRef = useRef(true);
  const soundRef = useRef(true);
  const handRef = useRef(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { handRef.current = hand; }, [hand]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimeout(cpuTimer.current); };
  }, []);

  const stake = STAKES[stakeIdx];
  const me = hand ? hand.players.find(p => p.isHuman) : null;
  const myTurn = !!(hand && !hand.finished && hand.players[hand.toAct]?.isHuman);
  const pot = hand ? totalPot(hand) : 0;
  const toCall = hand && me ? Math.max(0, hand.currentBet - me.bet) : 0;
  const maxRaise = me ? me.bet + me.stack : 0;
  const minRaiseTo = hand ? Math.min(maxRaise, hand.currentBet + Math.max(hand.minRaise, stake.bb)) : 0;

  const myEval = useMemo(() => {
    if (!hand || !me || !me.hole?.length) return null;
    return evaluateHand([...me.hole, ...hand.board]);
  }, [hand, me]);

  /* ---------- 着席／退席 ---------- */
  const sitDown = async () => {
    const buyin = stake.buyin;
    if (balance < buyin) { showToast(`このテーブルは ${fmt(buyin)} G のバイインが必要です。`, 'error'); return; }
    try { await updateBalance(-buyin); } catch (e) { return; }
    const t = createTable(playerName || 'YOU', seatCount, stake, buyin);
    setTable(t);
    setSessionStart(buyin);
    setHand(null);
    playSfx('coin', soundRef.current);
    showToast(`💺 ${stake.label} テーブルに ${fmt(buyin)} G で着席しました。`, 'success');
  };

  const leaveTable = async () => {
    if (!table) return;
    const my = (hand ? hand.players : table.players).find(p => p.isHuman);
    const stack = Math.max(0, my ? my.stack : 0);
    if (hand && !hand.finished) { showToast('ハンド進行中は退席できません。', 'error'); return; }
    if (stack > 0) { try { await updateBalance(stack); } catch (e) { /* noop */ } }
    const net = stack - sessionStart;
    if (net >= 20000) emitNews(`🃏 ${playerName} がテキサスホールデムで +${fmt(net)} G を持ち帰りました！`, 'poker');
    showToast(`💰 ${fmt(stack)} G を持って退席しました（収支 ${net >= 0 ? '+' : ''}${fmt(net)} G）`, net >= 0 ? 'success' : 'warning');
    clearTimeout(cpuTimer.current);
    setTable(null); setHand(null);
  };

  /* ---------- ハンド進行 ---------- */
  const scheduleCpu = useCallback((st) => {
    clearTimeout(cpuTimer.current);
    if (!st || st.finished) return;
    const p = st.players[st.toAct];
    if (!p || p.isHuman) return;
    const delay = 650 + Math.random() * 850;
    cpuTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const cur = handRef.current;
      if (!cur || cur.finished) return;
      const actor = cur.players[cur.toAct];
      if (!actor || actor.isHuman) return;
      let d;
      try { d = cpuDecide(cur, actor.id); }
      catch (e) { d = { action: 'FOLD' }; }
      const next = applyAction(cur, actor.id, d.action, d.amount || 0);
      playSfx(d.action === 'FOLD' ? 'click' : 'coin', soundRef.current);
      setHand(next);
    }, delay);
  }, []);

  useEffect(() => { scheduleCpu(hand); }, [hand, scheduleCpu]);

  // ハンド終了時の演出とテーブル更新
  useEffect(() => {
    if (!hand || !hand.finished || !table) return;
    const my = hand.players.find(p => p.isHuman);
    const won = hand.winners.find(w => w.id === 0);
    if (won) playSfx('win', soundRef.current);
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setTable(prev => prev ? ({
        ...prev,
        players: hand.players.map(p => ({ ...p, hole: [], folded: false, allIn: false, bet: 0, totalBet: 0, lastAction: '', handRank: null, sitting: p.isHuman ? true : p.stack > 0 })),
        dealer: hand.dealer,
        handNo: prev.handNo + 1,
      }) : prev);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand?.finished]);

  const nextHand = () => {
    if (!table) return;
    const my = table.players.find(p => p.isHuman);
    if (!my || my.stack < stake.bb) { showToast('スタックが足りません。退席して再バイインしてください。', 'warning'); return; }
    // CPUが飛んでいたら補充（新しい客が座る）
    const players = table.players.map(p => {
      if (p.isHuman || p.stack > 0) return p;
      const used = table.players.filter(x => x.persona).map(x => x.persona.key);
      const fresh = PERSONAS.filter(x => !used.includes(x.key));
      const per = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : p.persona;
      return { ...p, persona: per, name: per.name, avatar: per.avatar, stack: stake.buyin, sitting: true };
    });
    const t2 = { ...table, players };
    const st = startHand(t2);
    if (!st) { showToast('テーブルに人が足りません。', 'error'); return; }
    setTable(t2);
    setHand(st);
    setRaiseTo(Math.min(st.currentBet * 3, (st.players.find(p => p.isHuman)?.stack || 0)));
    playSfx('click', soundRef.current);
  };

  const act = (action, amount) => {
    if (!hand || hand.finished || !myTurn || busy) return;
    setBusy(true);
    try {
      const next = applyAction(hand, 0, action, amount || 0);
      playSfx(action === 'FOLD' ? 'click' : 'coin', soundRef.current);
      setHand(next);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (myTurn) setRaiseTo(prev => Math.max(minRaiseTo, Math.min(maxRaise, prev || minRaiseTo)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, minRaiseTo, maxRaise]);

  /* ==================== ロビー ==================== */
  if (!table) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="w-full flex justify-between items-center mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} G</div>
        </div>

        <Panel gold className="p-6">
          <h2 className="text-3xl font-black text-white mb-1 flex items-center gap-2"><Spade size={26} /> TEXAS HOLD'EM</h2>
          <p className="text-sm text-amber-200/70 mb-5">テーブルにバイインして着席します。退席するとスタックがそのまま所持金に戻ります。</p>

          <div className="mb-5">
            <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">テーブル（SB / BB）</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {STAKES.map((s, i) => (
                <button key={s.label} onClick={() => setStakeIdx(i)}
                  className={`p-3 rounded-2xl border-2 text-left transition ${stakeIdx === i ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:bg-white/5'}`}>
                  <div className="text-lg font-black text-white">{s.label}</div>
                  <div className="text-[11px] text-gray-400">バイイン {fmt(s.buyin)} G</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">人数</div>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setSeatCount(n)}
                  className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition ${seatCount === n ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                  {n}人
                </button>
              ))}
            </div>
          </div>

          <GoldButton onClick={sitDown} disabled={balance < stake.buyin} className="w-full py-4 text-lg">
            {fmt(stake.buyin)} G で着席する
          </GoldButton>
          {balance < stake.buyin && <p className="text-[11px] text-red-400 mt-2 text-center">所持金が足りません。</p>}

          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PERSONAS.map(p => (
              <div key={p.key} className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10">
                <span className="text-xl">{p.avatar}</span>
                <div>
                  <div className="text-xs font-black text-white">{p.name}</div>
                  <div className="text-[10px] text-gray-500">{p.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  /* ==================== テーブル ==================== */
  const players = hand ? hand.players : table.players;
  const positions = SEAT_POS[players.length] || SEAT_POS[6];
  const winnerIds = hand?.winners?.map(w => w.id) || [];
  const smallSeats = players.length >= 5;

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto">
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-3">
        <button onClick={leaveTable} disabled={hand && !hand.finished}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40">
          <LogOut size={18} /> 退席して精算
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setSound(s => !s)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10">
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">TABLE</div>
            <div className="font-mono text-xs text-white font-bold">{stake.label}</div>
          </div>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">収支</div>
            <div className={`font-mono text-xs font-bold ${(me ? me.stack : 0) - sessionStart >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(me ? me.stack : 0) - sessionStart >= 0 ? '+' : ''}{fmt((me ? me.stack : 0) - sessionStart)}
            </div>
          </div>
          <div className="bg-black/60 px-3 py-1.5 rounded-full border border-amber-500/30 font-mono text-base text-amber-300 font-bold">{fmt(balance)} G</div>
        </div>
      </div>

      {/* ===== テーブル ===== */}
      <div className="relative w-full mx-auto" style={{ maxWidth: 880 }}>
        <div className="relative" style={{ paddingBottom: '62%' }}>
          {/* 木製レール */}
          <div className="absolute inset-0 rounded-[48%/44%]" style={{
            background: 'linear-gradient(160deg,#6b4523 0%,#4a2f16 45%,#2d1c0c 100%)',
            boxShadow: '0 26px 60px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,220,160,0.25)',
          }} />
          {/* フェルト */}
          <div className="absolute rounded-[48%/44%]" style={{
            inset: '5.5%',
            background: 'radial-gradient(ellipse at 50% 38%, #17734a 0%, #0e5233 48%, #07301f 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.65), inset 0 0 0 3px rgba(255,215,120,0.18)',
          }}>
            <div className="absolute inset-[3%] rounded-[48%/44%] border border-amber-200/10" />
            <div className="absolute left-1/2 top-[30%] -translate-x-1/2 text-amber-200/10 font-black tracking-[0.5em] text-sm md:text-lg select-none">GRAND CASINO</div>
          </div>

          {/* 中央：ポットとボード */}
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-20">
            <div className="px-4 py-1 rounded-full bg-black/60 border border-amber-300/25 text-xs md:text-sm font-black text-amber-200 backdrop-blur-sm">
              POT {fmt(pot)}
              {hand && !hand.finished && <span className="ml-2 text-[10px] text-emerald-200/70">{STREET_LABEL[hand.street]}</span>}
            </div>
            <div className="flex gap-1 md:gap-1.5">
              {[0, 1, 2, 3, 4].map(i => (
                <PlayingCard key={i} card={hand?.board?.[i]} hidden={!hand?.board?.[i]} small />
              ))}
            </div>
            {hand?.finished && hand.winners.length > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black text-center shadow-lg">
                {hand.winners.map(w => `${w.name} +${fmt(w.amount)}`).join(' / ')}
                {hand.winners[0]?.hand && <div className="font-bold text-[10px]">{hand.winners[0].hand.name}</div>}
              </div>
            )}
          </div>

          {/* 席 */}
          {players.map((p, i) => (
            <React.Fragment key={p.id}>
              <Seat p={p} seatPos={positions[i]} small={smallSeats}
                isTurn={!!(hand && !hand.finished && hand.toAct === i)}
                reveal={!!hand?.reveal}
                isWinner={winnerIds.includes(p.id)}
                dealer={hand ? hand.dealer === i : table.dealer === i} />
              {/* ベット */}
              {p.bet > 0 && (
                <div className="absolute -translate-x-1/2 -translate-y-1/2 z-15"
                  style={{
                    left: `${positions[i][0] + (50 - positions[i][0]) * 0.40}%`,
                    top: `${positions[i][1] + (46 - positions[i][1]) * 0.40}%`,
                  }}>
                  <ChipStack amount={p.bet} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ===== 操作 ===== */}
      <Panel className="p-3 mt-3">
        {!hand || hand.finished ? (
          <div className="flex flex-wrap items-center gap-3">
            <GoldButton onClick={nextHand} className="flex-1 min-w-[180px] py-3.5 text-base flex items-center justify-center gap-2">
              <Spade size={18} /> {hand ? '次のハンドへ' : 'ハンドを開始する'}
            </GoldButton>
            {hand?.finished && me && (
              <div className="text-sm font-bold text-gray-300">
                あなた：<span className="font-mono text-amber-300">{fmt(me.stack)}</span>
                {myEval && hand.reveal && <span className="ml-2 text-xs text-emerald-300">{myEval.name}</span>}
              </div>
            )}
          </div>
        ) : myTurn ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">ポット <b className="text-amber-300">{fmt(pot)}</b></span>
              <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">スタック <b className="text-white">{fmt(me.stack)}</b></span>
              {toCall > 0 && <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-400/30 text-red-300">要コール <b>{fmt(toCall)}</b></span>}
              {myEval && <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">現在の役 <b>{myEval.name}</b></span>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => act('FOLD')}
                className="py-3 rounded-xl font-black bg-red-700 hover:bg-red-600 text-white transition active:scale-95">フォールド</button>
              {toCall > 0 ? (
                <button onClick={() => act('CALL')}
                  className="py-3 rounded-xl font-black bg-sky-700 hover:bg-sky-600 text-white transition active:scale-95">
                  コール {fmt(Math.min(toCall, me.stack))}
                </button>
              ) : (
                <button onClick={() => act('CHECK')}
                  className="py-3 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white transition active:scale-95">チェック</button>
              )}
              <button onClick={() => act(toCall > 0 ? 'RAISE' : 'BET', raiseTo)}
                disabled={maxRaise <= hand.currentBet}
                className="py-3 rounded-xl font-black bg-emerald-700 hover:bg-emerald-600 text-white transition active:scale-95 disabled:opacity-40">
                {raiseTo >= maxRaise ? 'オールイン' : (toCall > 0 ? 'レイズ' : 'ベット')} {fmt(raiseTo)}
              </button>
            </div>

            {maxRaise > hand.currentBet && (
              <div className="flex items-center gap-2">
                <input type="range" min={minRaiseTo} max={maxRaise} step={stake.sb}
                  value={Math.min(maxRaise, Math.max(minRaiseTo, raiseTo))}
                  onChange={e => setRaiseTo(Number(e.target.value))}
                  className="flex-1 accent-amber-400" />
                <div className="flex gap-1">
                  {[['1/2', 0.5], ['3/4', 0.75], ['POT', 1]].map(([lbl, k]) => (
                    <button key={lbl} onClick={() => setRaiseTo(Math.min(maxRaise, Math.max(minRaiseTo, Math.round(hand.currentBet + (pot + toCall) * k))))}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-[10px] font-black border border-white/10">{lbl}</button>
                  ))}
                  <button onClick={() => setRaiseTo(maxRaise)}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-black border border-amber-400/30">MAX</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-3 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm font-bold">{hand.players[hand.toAct]?.name} が考えています…</span>
          </div>
        )}

        {hand?.log?.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowLog(s => !s)} className="text-[11px] text-gray-500 hover:text-gray-300 font-bold">
              {showLog ? 'ログを隠す ▲' : 'ハンドログを見る ▼'}
            </button>
            {showLog && (
              <div className="mt-2 bg-black/40 rounded-xl border border-white/10 p-2.5 max-h-40 overflow-y-auto space-y-0.5">
                {hand.log.slice().reverse().map((l, i) => <div key={i} className="text-[11px] text-gray-400">・{l}</div>)}
              </div>
            )}
          </div>
        )}
      </Panel>

      <style>{`@keyframes pokerTimer { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}
