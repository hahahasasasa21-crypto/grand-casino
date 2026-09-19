import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, LogOut, RefreshCw, Users, Plus, Clock } from 'lucide-react';
import {
  doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit, runTransaction,
} from 'firebase/firestore';
import { db, appId } from '../../shared/firebase';
import { Panel, GoldButton, PlayingCard, playSfx } from '../../shared/ui';
import { evaluateHand } from '../../shared/cards';
import { startHand, applyAction, totalPot, STAKES, STREET_LABEL } from '../pokerEngine';
import { fmt, SEAT_POS, Seat, ChipStack } from './table';

/* ==========================================================
   TEXAS HOLD'EM — オンライン（みんなで対戦）
   ・部屋(pokerRooms)を作って着席、全員が同じ盤面を見る
   ・手番のプレイヤーが自分の行動を Firestore に書き込み、
     その結果の盤面を全員が受け取る（トランザクションで二重適用を防止）
   ・一番若い席の人が「進行役」になり、配り直し・時間切れ処理を担当する
   ========================================================== */

const TURN_MS = 25000;        // 1手あたりの持ち時間
const AWAY_MS = 60000;        // これ以上反応がない席は離席扱い
const NEXT_HAND_MS = 5000;    // ハンド終了から次を配るまで

const roomsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'pokerRooms');
const roomDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', id);
const presenceRef = (id) => collection(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', id, 'presence');

const fresh = (p) => p && Date.now() - (p.at || 0) < AWAY_MS;

export default function PokerOnline({ balance, updateBalance, onBack, showToast, playerName, emitNews, vip }) {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [presence, setPresence] = useState([]);
  const [stakeIdx, setStakeIdx] = useState(1);
  const [maxSeats, setMaxSeats] = useState(6);
  const [sound, setSound] = useState(true);
  const [raiseTo, setRaiseTo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [buyinAt, setBuyinAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  const mountedRef = useRef(true);
  const soundRef = useRef(true);
  const roomRef = useRef(null);
  const busyRef = useRef(false);
  const endTimerRef = useRef(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    mountedRef.current = true;
    const iv = setInterval(() => mountedRef.current && setNow(Date.now()), 250);
    return () => { mountedRef.current = false; clearInterval(iv); clearTimeout(endTimerRef.current); };
  }, []);

  const stake = STAKES[stakeIdx];
  const seats = room?.seats || [];
  const mySeat = seats.findIndex(s => s && s.name === playerName);
  const hand = room?.hand || null;
  const me = hand && mySeat >= 0 ? hand.players.find(p => p.id === mySeat) : null;
  const myTurn = !!(hand && !hand.finished && hand.toAct === mySeat);
  const pot = hand ? totalPot(hand) : 0;
  const toCall = hand && me ? Math.max(0, hand.currentBet - me.bet) : 0;
  const maxRaise = me ? me.bet + me.stack : 0;
  const minRaiseTo = hand && room ? Math.min(maxRaise, hand.currentBet + Math.max(hand.minRaise, room.bb)) : 0;
  const timeLeft = hand && !hand.finished && room?.actionDeadline ? Math.max(0, room.actionDeadline - now) : 0;

  const myEval = useMemo(() => {
    if (!hand || !me || !me.hole?.length) return null;
    return evaluateHand([...me.hole, ...hand.board]);
  }, [hand, me]);

  /* ---------- ロビー ---------- */
  useEffect(() => {
    if (roomId) return;
    const q = query(roomsRef(), orderBy('createdAt', 'desc'), limit(12));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list.filter(r => Date.now() - (r.updatedAt || r.createdAt || 0) < 6 * 3600 * 1000));
    }, () => { });
    return () => unsub();
  }, [roomId]);

  /* ---------- 部屋の購読 ---------- */
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(roomDoc(roomId), snap => {
      if (!snap.exists()) { setRoom(null); setRoomId(null); showToast('テーブルが解散されました。', 'warning'); return; }
      setRoom({ id: roomId, ...snap.data() });
    }, () => { });
    const unsubP = onSnapshot(presenceRef(roomId), snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPresence(list);
    }, () => { });
    return () => { unsub(); unsubP(); };
  }, [roomId, showToast]);

  /* ---------- 在席ハートビート ---------- */
  useEffect(() => {
    if (!roomId || !playerName) return;
    const beat = () => setDoc(doc(presenceRef(roomId), encodeURIComponent(playerName)), { name: playerName, at: Date.now() }).catch(() => { });
    beat();
    const iv = setInterval(beat, 12000);
    return () => clearInterval(iv);
  }, [roomId, playerName]);

  const presenceByName = useMemo(() => Object.fromEntries(presence.map(p => [p.name, p])), [presence]);
  const activeSeats = seats.map((s, i) => ({ s, i })).filter(x => x.s && fresh(presenceByName[x.s.name]) && x.s.stack > 0);

  /** 進行役＝いちばん若い席の在席プレイヤー */
  const refereeSeat = activeSeats.length ? activeSeats[0].i : -1;
  const isReferee = refereeSeat === mySeat && mySeat >= 0;

  /* ---------- 部屋の作成／参加 ---------- */
  const createRoom = async () => {
    if (balance < stake.buyin) { showToast(`バイイン ${fmt(stake.buyin)} Y が必要です。`, 'error'); return; }
    setBusy(true);
    try {
      const ref = doc(roomsRef());
      const emptySeats = Array.from({ length: maxSeats }, () => null);
      await updateBalance(-stake.buyin);
      emptySeats[0] = { name: playerName, stack: stake.buyin, vip: !!vip, joinedAt: Date.now() };
      await setDoc(ref, {
        sb: stake.sb, bb: stake.bb, buyin: stake.buyin, stakeLabel: stake.label,
        maxSeats, seats: emptySeats,
        createdBy: playerName, createdAt: Date.now(), updatedAt: Date.now(),
        hand: null, handNo: 0, dealer: 0, actionDeadline: 0, lastEndAt: 0,
      });
      setBuyinAt(stake.buyin);
      setRoomId(ref.id);
      playSfx('coin', soundRef.current);
      showToast('🎲 テーブルを作成しました。', 'success');
    } catch (e) {
      showToast('テーブル作成に失敗しました。', 'error');
    } finally { setBusy(false); }
  };

  const joinRoom = async (r) => {
    const existing = (r.seats || []).findIndex(s => s && s.name === playerName);
    if (existing >= 0) { setRoomId(r.id); setBuyinAt(r.seats[existing].stack); showToast('席に戻りました。', 'info'); return; }
    if (balance < r.buyin) { showToast(`バイイン ${fmt(r.buyin)} Y が必要です。`, 'error'); return; }
    setBusy(true);
    try {
      let ok = false;
      await updateBalance(-r.buyin);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        if (!snap.exists()) throw new Error('gone');
        const data = snap.data();
        const s = [...(data.seats || [])];
        if (s.some(x => x && x.name === playerName)) { ok = true; return; }
        const idx = s.findIndex(x => !x);
        if (idx < 0) throw new Error('full');
        s[idx] = { name: playerName, stack: r.buyin, vip: !!vip, joinedAt: Date.now() };
        tx.update(roomDoc(r.id), { seats: s, updatedAt: Date.now() });
        ok = true;
      });
      if (ok) { setBuyinAt(r.buyin); setRoomId(r.id); playSfx('coin', soundRef.current); }
    } catch (e) {
      await updateBalance(r.buyin).catch(() => { });
      showToast(String(e.message) === 'full' ? 'このテーブルは満席です。' : '着席に失敗しました。', 'error');
    } finally { setBusy(false); }
  };

  const standUp = async () => {
    if (!room || mySeat < 0) { setRoomId(null); return; }
    if (hand && !hand.finished && hand.players.some(p => p.id === mySeat && !p.folded)) {
      showToast('ハンド進行中は退席できません（フォールドしてからどうぞ）。', 'error');
      return;
    }
    setBusy(true);
    try {
      let back = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(room.id));
        if (!snap.exists()) return;
        const data = snap.data();
        const s = [...(data.seats || [])];
        const i = s.findIndex(x => x && x.name === playerName);
        if (i < 0) return;
        back = s[i].stack || 0;
        s[i] = null;
        const anyLeft = s.some(x => x);
        tx.update(roomDoc(room.id), { seats: s, updatedAt: Date.now(), ...(anyLeft ? {} : { hand: null }) });
      });
      if (back > 0) await updateBalance(back).catch(() => { });
      await deleteDoc(doc(presenceRef(room.id), encodeURIComponent(playerName))).catch(() => { });
      const net = back - buyinAt;
      if (net >= 20000) emitNews(`🃏 ${playerName} がオンラインポーカーで +${fmt(net)} Y を持ち帰りました！`, 'poker');
      showToast(`💰 ${fmt(back)} Y を持って退席しました（収支 ${net >= 0 ? '+' : ''}${fmt(net)} Y）`, net >= 0 ? 'success' : 'warning');
      setRoomId(null); setRoom(null);
    } catch (e) { showToast('退席に失敗しました。', 'error'); }
    finally { setBusy(false); }
  };

  /* ---------- 自分の行動 ---------- */
  const act = async (action, amount = 0) => {
    if (!room || !myTurn || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(room.id));
        const data = snap.data();
        if (!data?.hand || data.hand.finished) throw new Error('stale');
        if (data.hand.toAct !== mySeat) throw new Error('not-your-turn');
        const next = applyAction(data.hand, mySeat, action, amount);
        tx.update(roomDoc(room.id), {
          hand: next,
          actionDeadline: next.finished ? 0 : Date.now() + TURN_MS,
          updatedAt: Date.now(),
        });
      });
      playSfx(action === 'FOLD' ? 'click' : 'coin', soundRef.current);
    } catch (e) { /* 盤面が進んでいただけなので黙って無視 */ }
    finally { busyRef.current = false; setBusy(false); }
  };

  /* ---------- 進行役の仕事 ---------- */
  const startNextHand = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        const data = snap.data();
        if (!data) return;
        if (data.hand && !data.hand.finished) return;
        const live = (data.seats || []).map((s, i) => ({ s, i }))
          .filter(x => x.s && x.s.stack > 0 && fresh(presenceByName[x.s.name]));
        if (live.length < 2) return;
        const players = (data.seats || []).map((s, i) => ({
          id: i,
          name: s ? s.name : '',
          isHuman: true,
          avatar: s && s.vip ? '👑' : '🧑',
          vip: !!(s && s.vip),
          stack: s ? s.stack : 0,
          bet: 0, totalBet: 0, folded: false, allIn: false,
          hole: [], acted: false, lastAction: '',
          sitting: !!(s && s.stack > 0 && fresh(presenceByName[s.name])),
          persona: null, handRank: null,
        }));
        const st = startHand({ players, dealer: data.dealer ?? 0, stake: { sb: data.sb, bb: data.bb }, handNo: data.handNo || 0 });
        if (!st) return;
        tx.update(roomDoc(r.id), {
          hand: st,
          dealer: st.dealer,
          handNo: (data.handNo || 0) + 1,
          actionDeadline: Date.now() + TURN_MS,
          updatedAt: Date.now(),
        });
      });
    } catch (e) { /* noop */ }
  }, [presenceByName]);

  const settleHandToSeats = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        const data = snap.data();
        if (!data?.hand?.finished) return;
        const s = [...(data.seats || [])];
        data.hand.players.forEach(p => { if (s[p.id]) s[p.id] = { ...s[p.id], stack: p.stack }; });
        tx.update(roomDoc(r.id), { seats: s, hand: null, actionDeadline: 0, lastEndAt: Date.now(), updatedAt: Date.now() });
      });
    } catch (e) { /* noop */ }
  }, []);

  const foldTimedOut = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        const data = snap.data();
        if (!data?.hand || data.hand.finished) return;
        if ((data.actionDeadline || 0) > Date.now()) return;
        const actor = data.hand.players[data.hand.toAct];
        if (!actor) return;
        const needCall = data.hand.currentBet - actor.bet > 0;
        const next = applyAction(data.hand, actor.id, needCall ? 'FOLD' : 'CHECK', 0);
        tx.update(roomDoc(r.id), {
          hand: next,
          actionDeadline: next.finished ? 0 : Date.now() + TURN_MS,
          updatedAt: Date.now(),
        });
      });
    } catch (e) { /* noop */ }
  }, []);

  // 進行役のループ
  useEffect(() => {
    if (!isReferee || !room) return;
    const iv = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;
      if (r.hand && !r.hand.finished) {
        if ((r.actionDeadline || 0) > 0 && Date.now() > r.actionDeadline + 1200) foldTimedOut();
      } else if (r.hand && r.hand.finished) {
        if (Date.now() - (r.updatedAt || 0) > NEXT_HAND_MS) settleHandToSeats();
      } else {
        if (Date.now() - (r.lastEndAt || 0) > 2500) startNextHand();
      }
    }, 1200);
    return () => clearInterval(iv);
  }, [isReferee, room, foldTimedOut, settleHandToSeats, startNextHand]);

  useEffect(() => {
    if (myTurn) setRaiseTo(prev => Math.max(minRaiseTo, Math.min(maxRaise, prev || minRaiseTo)));
  }, [myTurn, minRaiseTo, maxRaise]);

  /* ==================== ロビー ==================== */
  if (!roomId || !room) {
    const open = rooms.filter(r => (r.seats || []).some(s => !s));
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="w-full flex justify-between items-center mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} Y</div>
        </div>

        <Panel gold className="p-5 mb-4">
          <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2"><Users size={22} /> オンラインテーブル</h2>
          <p className="text-xs text-gray-400">空いているテーブルに着席するか、新しいテーブルを立ち上げてください。</p>
        </Panel>

        {rooms.length > 0 ? (
          <div className="space-y-2 mb-5">
            {rooms.map(r => {
              const occupied = (r.seats || []).filter(Boolean);
              const mine = occupied.some(s => s.name === playerName);
              const full = occupied.length >= (r.maxSeats || 6);
              return (
                <button key={r.id} onClick={() => joinRoom(r)} disabled={busy || (full && !mine)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 transition text-left disabled:opacity-40">
                  <div className="text-2xl">🃏</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white flex items-center gap-2">
                      {r.createdBy} のテーブル
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30">{r.stakeLabel}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {occupied.length} / {r.maxSeats} 人 ・ バイイン {fmt(r.buyin)} Y
                      {occupied.length > 0 && <> ・ {occupied.map(s => s.name).join('、')}</>}
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black shrink-0">
                    {mine ? '席に戻る' : full ? '満席' : '着席'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Panel className="p-6 mb-5 text-center">
            <p className="text-gray-400 text-sm">いま開いているテーブルはありません。<br />最初の1人としてテーブルを立ち上げましょう。</p>
          </Panel>
        )}

        <Panel className="p-5">
          <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Plus size={16} /> テーブルを立ち上げる</h3>
          <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">レート（SB / BB）</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {STAKES.map((s, i) => (
              <button key={s.label} onClick={() => setStakeIdx(i)}
                className={`p-3 rounded-2xl border-2 text-left transition ${stakeIdx === i ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:bg-white/5'}`}>
                <div className="text-lg font-black text-white">{s.label}</div>
                <div className="text-[11px] text-gray-400">バイイン {fmt(s.buyin)} Y</div>
              </button>
            ))}
          </div>
          <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">席数</div>
          <div className="flex gap-2 mb-4">
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setMaxSeats(n)}
                className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition ${maxSeats === n ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                {n}人
              </button>
            ))}
          </div>
          <GoldButton onClick={createRoom} disabled={busy || balance < stake.buyin} className="w-full py-3.5 text-lg">
            {fmt(stake.buyin)} Y で立ち上げて着席する
          </GoldButton>
        </Panel>

        <p className="text-[11px] text-gray-600 mt-4 text-center leading-relaxed">
          ※ サーバーを持たない構成のため、配られた札はデータ上は全員の端末に届いています。<br />
          仲間内で遊ぶ前提の作りです（画面には自分の手札とショーダウンしか表示されません）。
        </p>
      </div>
    );
  }

  /* ==================== テーブル ==================== */
  const viewPlayers = hand
    ? hand.players
    : seats.map((s, i) => ({
      id: i, name: s ? s.name : '空席', stack: s ? s.stack : 0, vip: !!(s && s.vip),
      avatar: s ? (s.vip ? '👑' : '🧑') : '💺', isHuman: true, sitting: !!s,
      hole: [], folded: !s, bet: 0, lastAction: '', persona: null,
    }));
  const n = viewPlayers.length;
  const basePos = SEAT_POS[n] || SEAT_POS[6];
  // 自分の席が手前に来るように並べ替える
  const order = [];
  const anchor = mySeat >= 0 ? mySeat : 0;
  for (let k = 0; k < n; k++) order.push((anchor + k) % n);
  const posOf = (seatIdx) => basePos[order.indexOf(seatIdx)] || basePos[0];

  const winnerIds = hand?.winners?.map(w => w.id) || [];
  const smallSeats = n >= 5;
  const occupiedCount = seats.filter(Boolean).length;

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto">
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-3">
        <button onClick={standUp} disabled={busy}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40">
          <LogOut size={18} /> 退席して精算
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setSound(s => !s)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10">
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">TABLE</div>
            <div className="font-mono text-xs text-white font-bold">{room.stakeLabel}</div>
          </div>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">収支</div>
            <div className={`font-mono text-xs font-bold ${((mySeat >= 0 ? (hand ? (me?.stack ?? seats[mySeat].stack) : seats[mySeat].stack) : 0) - buyinAt) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(() => { const cur = mySeat >= 0 ? (hand && me ? me.stack : seats[mySeat]?.stack || 0) : 0; const d = cur - buyinAt; return (d >= 0 ? '+' : '') + fmt(d); })()}
            </div>
          </div>
          <div className="bg-black/60 px-3 py-1.5 rounded-full border border-amber-500/30 font-mono text-base text-amber-300 font-bold">{fmt(balance)} Y</div>
        </div>
      </div>

      {/* ===== テーブル ===== */}
      <div className="relative w-full mx-auto" style={{ maxWidth: 880 }}>
        <div className="relative" style={{ paddingBottom: '62%' }}>
          <div className="absolute inset-0 rounded-[48%/44%]" style={{
            background: 'linear-gradient(160deg,#6b4523 0%,#4a2f16 45%,#2d1c0c 100%)',
            boxShadow: '0 26px 60px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,220,160,0.25)',
          }} />
          <div className="absolute rounded-[48%/44%]" style={{
            inset: '5.5%',
            background: 'radial-gradient(ellipse at 50% 38%, #17734a 0%, #0e5233 48%, #07301f 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.65), inset 0 0 0 3px rgba(255,215,120,0.18)',
          }}>
            <div className="absolute inset-[3%] rounded-[48%/44%] border border-amber-200/10" />
            <div className="absolute left-1/2 top-[30%] -translate-x-1/2 text-amber-200/10 font-black tracking-[0.5em] text-sm md:text-lg select-none">YUTAPON CASINO</div>
          </div>

          {/* 中央 */}
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
            {!hand && (
              <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/15 text-[11px] font-black text-gray-300 text-center">
                {occupiedCount < 2 ? 'あと1人でゲーム開始' : activeSeats.length < 2 ? '参加者の応答を待っています…' : 'まもなく配ります…'}
              </div>
            )}
          </div>

          {/* 席 */}
          {viewPlayers.map((p) => {
            const away = seats[p.id] && !fresh(presenceByName[seats[p.id].name]);
            return (
              <React.Fragment key={p.id}>
                <Seat p={{ ...p, name: p.name + (away ? '（離席）' : '') }} seatPos={posOf(p.id)} small={smallSeats}
                  empty={!seats[p.id]}
                  isTurn={!!(hand && !hand.finished && hand.toAct === p.id)}
                  reveal={!!hand?.reveal}
                  isWinner={winnerIds.includes(p.id)}
                  dealer={hand ? hand.dealer === p.id : room.dealer === p.id} />
                {p.bet > 0 && (
                  <div className="absolute -translate-x-1/2 -translate-y-1/2 z-15"
                    style={{
                      left: `${posOf(p.id)[0] + (50 - posOf(p.id)[0]) * 0.40}%`,
                      top: `${posOf(p.id)[1] + (46 - posOf(p.id)[1]) * 0.40}%`,
                    }}>
                    <ChipStack amount={p.bet} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ===== 操作 ===== */}
      <Panel className="p-3 mt-3">
        {mySeat < 0 ? (
          <div className="text-center py-3 text-sm text-gray-400 font-bold">観戦中です。</div>
        ) : myTurn && hand ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2 text-[11px] items-center">
              <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">ポット <b className="text-amber-300">{fmt(pot)}</b></span>
              <span className="px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">スタック <b className="text-white">{fmt(me.stack)}</b></span>
              {toCall > 0 && <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-400/30 text-red-300">要コール <b>{fmt(toCall)}</b></span>}
              {myEval && <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">現在の役 <b>{myEval.name}</b></span>}
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-200 flex items-center gap-1">
                <Clock size={11} />{Math.ceil(timeLeft / 1000)}s
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => act('FOLD')} disabled={busy}
                className="py-3 rounded-xl font-black bg-red-700 hover:bg-red-600 text-white transition active:scale-95 disabled:opacity-50">フォールド</button>
              {toCall > 0 ? (
                <button onClick={() => act('CALL')} disabled={busy}
                  className="py-3 rounded-xl font-black bg-sky-700 hover:bg-sky-600 text-white transition active:scale-95 disabled:opacity-50">
                  コール {fmt(Math.min(toCall, me.stack))}
                </button>
              ) : (
                <button onClick={() => act('CHECK')} disabled={busy}
                  className="py-3 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white transition active:scale-95 disabled:opacity-50">チェック</button>
              )}
              <button onClick={() => act(toCall > 0 ? 'RAISE' : 'BET', raiseTo)}
                disabled={busy || maxRaise <= hand.currentBet}
                className="py-3 rounded-xl font-black bg-emerald-700 hover:bg-emerald-600 text-white transition active:scale-95 disabled:opacity-40">
                {raiseTo >= maxRaise ? 'オールイン' : (toCall > 0 ? 'レイズ' : 'ベット')} {fmt(raiseTo)}
              </button>
            </div>

            {maxRaise > hand.currentBet && (
              <div className="flex items-center gap-2">
                <input type="range" min={minRaiseTo} max={maxRaise} step={room.sb}
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
        ) : hand && !hand.finished ? (
          <div className="flex items-center justify-center gap-3 py-3 text-gray-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm font-bold">{hand.players[hand.toAct]?.name} の番です…（残り {Math.ceil(timeLeft / 1000)}s）</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="text-sm font-bold text-gray-400">
              {occupiedCount < 2 ? '他のプレイヤーの参加を待っています…' : hand?.finished ? 'まもなく次のハンドです…' : '次のハンドの準備中…'}
            </span>
            {isReferee && <span className="text-[10px] font-black px-2 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">あなたが進行役です</span>}
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
