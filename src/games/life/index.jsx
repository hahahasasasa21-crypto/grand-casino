import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Users, Plus, Clock, Trophy, LogOut, RefreshCw, Play, Sparkles } from 'lucide-react';
import {
  doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit, runTransaction,
} from 'firebase/firestore';
import { db, appId } from '../../shared/firebase';
import { Panel, GoldButton, VipBadge, playSfx } from '../../shared/ui';
import {
  BOARD, GOAL_INDEX, SPACE_STYLE, CAREERS, careerOf, ENTRY_FEES, START_CASH,
  TURN_MS, KID_VALUE, SPOUSE_VALUE, newPlayer, applySpin, applyChoice, settle, prizeSplit,
  regionOf, spaceInfo,
} from './engine.js';
import { LifeBoard, Spinner, EventCard } from './board.jsx';

/* ==========================================================
   オンライン人生ゲーム
   ・部屋を立てて最大6人。参加費を出し合い、最終資産の順位で山分け
   ・手番の人がルーレットを回して結果を書き込み、全員がそれを見る
   ========================================================== */

const fmt = (n) => (n || 0).toLocaleString();
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];
const AWAY_MS = 75000;
const SPIN_MS = 2450;

const roomsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'lifeRooms');
const roomDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'lifeRooms', id);
const presenceRef = (id) => collection(db, 'artifacts', appId, 'public', 'data', 'lifeRooms', id, 'presence');
const isFresh = (p) => p && Date.now() - (p.at || 0) < AWAY_MS;

function diffLog(prevLast, cur) {
  if (!prevLast) return cur.slice(-3);
  const i = cur.lastIndexOf(prevLast);
  if (i < 0) return cur.slice(-3);
  return cur.slice(i + 1);
}

/* ---------- 小さな部品 ---------- */
function StageRibbon({ pos }) {
  const r = regionOf(pos);
  const pct = Math.round((pos / GOAL_INDEX) * 100);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-black/50 border border-white/10">
      <span className="text-[10px] font-black tracking-[.25em] shrink-0" style={{ color: r.color }}>{r.sub}</span>
      <span className="text-sm font-black text-white shrink-0">{r.name}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg,${r.color},#fde68a)` }} />
      </div>
      <span className="font-mono text-[11px] text-gray-400 shrink-0">{pos + 1}/{GOAL_INDEX + 1}</span>
    </div>
  );
}

function TimerRing({ ms, total, color = '#fbbf24' }) {
  const f = Math.max(0, Math.min(1, ms / total));
  const R = 15, C = 2 * Math.PI * R;
  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
        <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - f)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-black text-white">
        {Math.ceil(ms / 1000)}
      </span>
    </div>
  );
}

function PlayerCard({ p, i, mine, active, away, color }) {
  const c = careerOf(p.career);
  const pct = Math.round((p.pos / GOAL_INDEX) * 100);
  return (
    <div className={`relative p-2.5 rounded-2xl border overflow-hidden transition
      ${active ? 'border-emerald-400 bg-emerald-500/10' : mine ? 'border-amber-400/50 bg-amber-400/5' : 'border-white/10 bg-black/40'}
      ${p.finished ? 'opacity-80' : ''} ${away ? 'grayscale-[.5]' : ''}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
      <div className="flex items-center gap-1.5 pl-1.5">
        <svg viewBox="0 0 44 22" className="w-6 h-3 shrink-0">
          <path d="M2 17 L2 13 Q2 10 5 9.4 L11 8.8 L15 3.4 Q16.6 1.4 19.4 1.4 L26 1.4 Q29.2 1.4 30.8 3.6 L34 8.6 L37 9.8 Q39.4 10.8 39.4 13.6 L39.4 17 Z"
            fill={color} stroke="rgba(0,0,0,.5)" strokeWidth="1.2" />
          <circle cx="12" cy="17.6" r="3.4" fill="#18181b" />
          <circle cx="32" cy="17.6" r="3.4" fill="#18181b" />
        </svg>
        <span className="text-[12px] font-black text-white truncate">{p.name}</span>
        {p.vip && <VipBadge size="xs" />}
        {p.finished && <span className="text-[9px] font-black px-1 rounded bg-amber-400 text-black">GOAL</span>}
        {away && <span className="text-[9px] text-gray-500">離席</span>}
        <span className="ml-auto font-mono text-[12px] font-black text-amber-300">{fmt(p.cash)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold shrink-0">
          {c ? `${c.icon} ${c.name}` : '職業なし'}
        </span>
        <span className="text-[11px] text-gray-400 truncate">
          {p.spouse ? '💍' : ''}{p.kids > 0 ? `👶×${p.kids}` : ''}{p.stocks > 0 ? ` 📈×${p.stocks}` : ''}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-1.5">
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="font-mono text-[9px] text-gray-500 shrink-0">{p.pos + 1}</span>
      </div>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function LifeGame({ balance, updateBalance, onBack, showToast, playerName, emitNews, vip }) {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [presence, setPresence] = useState([]);
  const [feeIdx, setFeeIdx] = useState(1);
  const [maxSeats, setMaxSeats] = useState(4);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [spinBusy, setSpinBusy] = useState(false);
  const [wheel, setWheel] = useState(null);
  const [card, setCard] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const mountedRef = useRef(true);
  const roomRef = useRef(null);
  const busyRef = useRef(false);
  const prevLast = useRef(null);
  const queued = useRef(null);
  const cardTimer = useRef(0);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    mountedRef.current = true;
    const iv = setInterval(() => mountedRef.current && setNow(Date.now()), 300);
    return () => { mountedRef.current = false; clearInterval(iv); clearTimeout(cardTimer.current); };
  }, []);

  const fee = ENTRY_FEES[feeIdx];
  const players = room?.players || [];
  const myIdx = players.findIndex(p => p.name === playerName);
  const me = myIdx >= 0 ? players[myIdx] : null;
  const myTurn = room?.status === 'PLAYING' && room.turn === myIdx && !me?.finished;
  const pending = room?.pending || null;
  const myPending = pending && pending.player === myIdx;
  const timeLeft = room?.status === 'PLAYING' && room.turnDeadline ? Math.max(0, room.turnDeadline - now) : 0;

  /* ---------- 購読 ---------- */
  useEffect(() => {
    if (roomId) return;
    const q = query(roomsRef(), orderBy('createdAt', 'desc'), limit(12));
    const unsub = onSnapshot(q, snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list.filter(r => Date.now() - (r.updatedAt || r.createdAt || 0) < 6 * 3600 * 1000));
    }, () => { });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(roomDoc(roomId), snap => {
      if (!snap.exists()) { setRoom(null); setRoomId(null); showToast('部屋が解散されました。', 'warning'); return; }
      setRoom({ id: roomId, ...snap.data() });
    }, () => { });
    const unsubP = onSnapshot(presenceRef(roomId), snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPresence(list);
    }, () => { });
    return () => { unsub(); unsubP(); };
  }, [roomId, showToast]);

  useEffect(() => {
    if (!roomId || !playerName) return;
    const beat = () => setDoc(doc(presenceRef(roomId), encodeURIComponent(playerName)), { name: playerName, at: Date.now() }).catch(() => { });
    beat();
    const iv = setInterval(beat, 15000);
    return () => clearInterval(iv);
  }, [roomId, playerName]);

  const presenceByName = useMemo(() => Object.fromEntries(presence.map(p => [p.name, p])), [presence]);
  const activeIdx = players.map((p, i) => ({ p, i })).filter(x => isFresh(presenceByName[x.p.name])).map(x => x.i);
  const isReferee = activeIdx.length > 0 && activeIdx[0] === myIdx;

  /* ---------- ほかの人のルーレットを見る ---------- */
  const lastSpinAt = room?.lastSpin?.at || 0;
  useEffect(() => {
    const ls = roomRef.current?.lastSpin;
    if (!ls || !lastSpinAt) return;
    if (ls.player === myIdx) return;          // 自分の分はすでに回している
    setWheel({ value: ls.value, key: `r-${ls.at}` });
    setSpinBusy(true);
    const t = setTimeout(() => setSpinBusy(false), SPIN_MS);
    return () => clearTimeout(t);
  }, [lastSpinAt, myIdx]);

  /* ---------- できごとカードを仕込む ---------- */
  useEffect(() => {
    if (!room) { prevLast.current = null; return; }
    const cur = room.log || [];
    if (cur.length === 0) { prevLast.current = null; return; }
    const last = cur[cur.length - 1];
    if (last === prevLast.current) return;
    const added = diffLog(prevLast.current, cur);
    prevLast.current = last;
    const ls = room.lastSpin;
    if (!ls) return;
    const p = (room.players || [])[ls.player];
    if (!p) return;
    const info = spaceInfo(p.pos);
    queued.current = {
      key: `${ls.at}-${cur.length}`,
      icon: info.st.icon, label: info.st.label, title: info.detail,
      lines: added.slice(-4), color: info.st.bg, spin: ls.value,
      player: p.name, region: info.region.name,
    };
  }, [room]);

  useEffect(() => {
    if (spinBusy || !queued.current) return;
    const c = queued.current; queued.current = null;
    setCard(c);
    clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => mountedRef.current && setCard(null), 3500);
  }, [spinBusy, now]);

  /* ---------- 部屋の作成・参加 ---------- */
  const createRoom = async () => {
    if (balance < fee) { showToast(`参加費 ${fmt(fee)} G が必要です。`, 'error'); return; }
    setBusy(true);
    try {
      await updateBalance(-fee);
      const ref = doc(roomsRef());
      await setDoc(ref, {
        fee, maxSeats, createdBy: playerName, createdAt: Date.now(), updatedAt: Date.now(),
        status: 'WAITING', seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
        pot: fee, players: [newPlayer(playerName, vip)],
        turn: 0, turnNo: 0, turnDeadline: 0, pending: null, log: [], lastSpin: null,
        results: null, claimed: {}, finishedCount: 0,
      });
      setRoomId(ref.id); setClaimed(false); prevLast.current = null;
      playSfx('coin');
      showToast('🎲 部屋を作りました。参加者を待ちましょう。', 'success');
    } catch (e) { showToast('部屋の作成に失敗しました。', 'error'); }
    finally { setBusy(false); }
  };

  const joinRoom = async (r) => {
    if ((r.players || []).some(p => p.name === playerName)) { setRoomId(r.id); return; }
    if (r.status !== 'WAITING') { showToast('この部屋はもう始まっています。', 'error'); return; }
    if (balance < r.fee) { showToast(`参加費 ${fmt(r.fee)} G が必要です。`, 'error'); return; }
    setBusy(true);
    try {
      await updateBalance(-r.fee);
      let ok = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        if (!snap.exists()) throw new Error('gone');
        const d = snap.data();
        if (d.status !== 'WAITING') throw new Error('started');
        const ps = [...(d.players || [])];
        if (ps.some(p => p.name === playerName)) { ok = true; return; }
        if (ps.length >= (d.maxSeats || 6)) throw new Error('full');
        ps.push(newPlayer(playerName, vip));
        tx.update(roomDoc(r.id), { players: ps, pot: (d.pot || 0) + d.fee, updatedAt: Date.now() });
        ok = true;
      });
      if (ok) { setRoomId(r.id); setClaimed(false); prevLast.current = null; playSfx('coin'); }
    } catch (e) {
      await updateBalance(r.fee).catch(() => { });
      const m = String(e.message);
      showToast(m === 'full' ? '満員です。' : m === 'started' ? 'もう始まっています。' : '参加に失敗しました。', 'error');
    } finally { setBusy(false); }
  };

  const leaveRoom = async () => {
    if (!room) { setRoomId(null); return; }
    if (room.status === 'PLAYING') { showToast('ゲーム中は退室できません。', 'error'); return; }
    setBusy(true);
    try {
      if (room.status === 'WAITING' && myIdx >= 0) {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomDoc(room.id));
          if (!snap.exists()) return;
          const d = snap.data();
          const ps = (d.players || []).filter(p => p.name !== playerName);
          if (ps.length === 0) { tx.delete(roomDoc(room.id)); return; }
          tx.update(roomDoc(room.id), { players: ps, pot: Math.max(0, (d.pot || 0) - d.fee), updatedAt: Date.now() });
        });
        await updateBalance(room.fee).catch(() => { });
        showToast(`参加費 ${fmt(room.fee)} G を返金しました。`, 'info');
      }
      await deleteDoc(doc(presenceRef(room.id), encodeURIComponent(playerName))).catch(() => { });
      setRoomId(null); setRoom(null); setCard(null); setWheel(null);
    } finally { setBusy(false); }
  };

  const startGame = async () => {
    if (!room || players.length < 2) { showToast('2人以上でスタートできます。', 'error'); return; }
    await updateDoc(roomDoc(room.id), {
      status: 'PLAYING', turn: 0, turnNo: 0, turnDeadline: Date.now() + TURN_MS,
      log: ['ゲームスタート！'], updatedAt: Date.now(),
    }).catch(() => { });
    playSfx('gate');
  };

  /* ---------- 手番の処理 ---------- */
  const doSpin = useCallback(async (forIdx) => {
    const r = roomRef.current;
    if (!r || busyRef.current) return;
    busyRef.current = true;
    const value = 1 + Math.floor(Math.random() * 10);
    if (forIdx === myIdx) {
      setSpinBusy(true);
      setWheel({ value, key: `me-${Date.now()}` });
      playSfx('click');
      await new Promise(res => setTimeout(res, SPIN_MS));
      if (mountedRef.current) setSpinBusy(false);
    }
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        const d = snap.data();
        if (!d || d.status !== 'PLAYING' || d.pending) throw new Error('stale');
        if (d.turn !== forIdx) throw new Error('not-turn');
        const { state } = applySpin({ ...d, id: undefined }, forIdx, value);
        tx.update(roomDoc(r.id), {
          players: state.players, turn: state.turn, turnNo: state.turnNo,
          turnDeadline: state.turnDeadline || Date.now() + TURN_MS,
          pending: state.pending || null, log: state.log || [], lastSpin: state.lastSpin || null,
          status: state.status || 'PLAYING', finishedCount: state.finishedCount || 0,
          updatedAt: Date.now(),
        });
      });
    } catch (e) { /* noop */ }
    finally { busyRef.current = false; }
  }, [myIdx]);

  const choose = async (choice) => {
    const r = roomRef.current;
    if (!r || busyRef.current) return;
    busyRef.current = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomDoc(r.id));
        const d = snap.data();
        if (!d?.pending || d.pending.player !== myIdx) throw new Error('stale');
        const state = applyChoice({ ...d, id: undefined }, myIdx, choice);
        tx.update(roomDoc(r.id), {
          players: state.players, turn: state.turn, turnNo: state.turnNo,
          turnDeadline: state.turnDeadline || Date.now() + TURN_MS,
          pending: null, log: state.log || [], status: state.status || 'PLAYING',
          updatedAt: Date.now(),
        });
      });
      playSfx('coin');
    } catch (e) { /* noop */ }
    finally { busyRef.current = false; }
  };

  /* ---------- 進行役：時間切れと集計 ---------- */
  useEffect(() => {
    if (!isReferee || !room) return;
    const iv = setInterval(async () => {
      const r = roomRef.current;
      if (!r) return;
      if (r.status === 'PLAYING' && !r.pending && r.turnDeadline && Date.now() > r.turnDeadline + 1500) {
        doSpin(r.turn);
      }
      if (r.status === 'PLAYING' && r.pending && r.turnDeadline && Date.now() > r.turnDeadline + 8000) {
        try {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomDoc(r.id));
            const d = snap.data();
            if (!d?.pending) return;
            const def = d.pending.kind === 'CAREER' ? 'OFFICE' : d.pending.kind === 'GAMBLE' ? 'NO' : 0;
            const state = applyChoice({ ...d, id: undefined }, d.pending.player, def);
            tx.update(roomDoc(r.id), {
              players: state.players, turn: state.turn, turnNo: state.turnNo,
              turnDeadline: Date.now() + TURN_MS, pending: null,
              log: state.log || [], status: state.status || 'PLAYING', updatedAt: Date.now(),
            });
          });
        } catch (e) { /* noop */ }
      }
      if (r.status === 'DONE' && !r.results) {
        try {
          const st = settle(r);
          await updateDoc(roomDoc(r.id), { results: st.results, stockValue: st.stockValue, updatedAt: Date.now() });
        } catch (e) { /* noop */ }
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [isReferee, room, doSpin]);

  /* ---------- 賞金の受け取り ---------- */
  const myResult = room?.results?.find(r => r.name === playerName);
  useEffect(() => {
    if (!room || !myResult || claimed) return;
    if (room.claimed && room.claimed[playerName]) { setClaimed(true); return; }
    (async () => {
      setClaimed(true);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomDoc(room.id));
          const d = snap.data();
          if (!d || (d.claimed && d.claimed[playerName])) return;
          tx.update(roomDoc(room.id), { [`claimed.${playerName}`]: true, updatedAt: Date.now() });
        });
        if (myResult.prize > 0) {
          await updateBalance(myResult.prize);
          showToast(`🏆 ${myResult.rank}位！ 賞金 ${fmt(myResult.prize)} G を受け取りました`, 'success');
          playSfx('win');
          if (myResult.rank === 1 && myResult.prize >= 50000) {
            emitNews(`🎲 ${playerName} が人生ゲームで優勝！ ${fmt(myResult.prize)} G 獲得！`, 'jackpot');
          }
        } else {
          showToast(`${myResult.rank}位でした…`, 'warning');
        }
      } catch (e) { /* noop */ }
    })();
  }, [room, myResult, claimed, playerName, updateBalance, showToast, emitNews]);

  /* ==================== ロビー ==================== */
  if (!roomId || !room) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="w-full flex justify-between items-center mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
          <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} G</div>
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-amber-500/25 mb-4">
          <div className="absolute inset-0 opacity-45 pointer-events-none">
            <LifeBoard players={[]} myIdx={-1} turnIdx={-1} colors={COLORS} />
          </div>
          <div className="relative p-6 md:p-8" style={{ background: 'linear-gradient(100deg,rgba(6,12,10,.94) 30%,rgba(6,12,10,.55))' }}>
            <div className="text-[10px] font-black tracking-[.35em] text-amber-300/70 mb-1">ONLINE BOARD GAME</div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2">人生ゲーム</h2>
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed max-w-md">
              最大6人で48マスの人生を走ります。参加費を全員で出し合い、
              <b className="text-amber-200">ゴール時の最終資産の順位</b>で山分け。<br />
              最終資産 ＝ 所持金 ＋ 子ども{fmt(KID_VALUE)}/人 ＋ 結婚{fmt(SPOUSE_VALUE)} ＋ 株（1口 10,000〜35,000）
            </p>
          </div>
        </div>

        {rooms.length > 0 ? (
          <div className="space-y-2 mb-5">
            {rooms.map(r => {
              const mine = (r.players || []).some(p => p.name === playerName);
              const full = (r.players || []).length >= (r.maxSeats || 6);
              return (
                <button key={r.id} onClick={() => joinRoom(r)} disabled={busy || (!mine && (full || r.status !== 'WAITING'))}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 transition text-left disabled:opacity-40">
                  <div className="text-2xl">🎲</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white flex items-center gap-2 flex-wrap">
                      {r.createdBy} の部屋
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-400/30">参加費 {fmt(r.fee)}G</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${r.status === 'WAITING' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' : 'bg-white/10 text-gray-400 border-white/15'}`}>
                        {r.status === 'WAITING' ? '募集中' : r.status === 'PLAYING' ? 'ゲーム中' : '終了'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {(r.players || []).length} / {r.maxSeats} 人 ・ 賞金プール {fmt(r.pot)} G
                      {(r.players || []).length > 0 && <> ・ {(r.players || []).map(p => p.name).join('、')}</>}
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black shrink-0">
                    {mine ? '戻る' : full ? '満員' : r.status !== 'WAITING' ? '開始済' : '参加'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Panel className="p-6 mb-5 text-center">
            <p className="text-gray-400 text-sm">いま募集中の部屋はありません。<br />最初の1人として部屋を立ててみましょう。</p>
          </Panel>
        )}

        <Panel className="p-5">
          <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Plus size={16} /> 部屋を立てる</h3>
          <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">参加費</div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {ENTRY_FEES.map((f, i) => (
              <button key={f} onClick={() => setFeeIdx(i)}
                className={`p-3 rounded-2xl border-2 transition ${feeIdx === i ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                <div className="text-base font-black">{fmt(f)}</div>
                <div className="text-[10px]">G</div>
              </button>
            ))}
          </div>
          <div className="text-xs font-black text-gray-400 mb-2 tracking-widest">人数</div>
          <div className="flex gap-2 mb-4">
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setMaxSeats(n)}
                className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition ${maxSeats === n ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                {n}人
              </button>
            ))}
          </div>
          <GoldButton onClick={createRoom} disabled={busy || balance < fee} className="w-full py-3.5 text-lg">
            参加費 {fmt(fee)} G で部屋を立てる
          </GoldButton>
        </Panel>
      </div>
    );
  }

  /* ==================== 部屋 ==================== */
  const waiting = room.status === 'WAITING';
  const done = room.status === 'DONE';
  const cur = players[room.turn];
  const curColor = COLORS[room.turn % COLORS.length];

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto">
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-3">
        <button onClick={leaveRoom} disabled={busy || room.status === 'PLAYING'}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40">
          <LogOut size={18} /> {waiting ? '退室（参加費は返金）' : 'ロビーへ'}
        </button>
        <div className="flex items-center gap-2">
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">賞金プール</div>
            <div className="font-mono text-xs text-amber-300 font-bold">{fmt(room.pot)} G</div>
          </div>
          <div className="text-center px-2">
            <div className="text-[9px] text-gray-500 font-bold">参加</div>
            <div className="font-mono text-xs text-white font-bold">{players.length}/{room.maxSeats}</div>
          </div>
          <div className="bg-black/60 px-3 py-1.5 rounded-full border border-amber-500/30 font-mono text-base text-amber-300 font-bold">{fmt(balance)} G</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 盤面 */}
        <div className="lg:col-span-2 space-y-3">
          {me && !waiting && <StageRibbon pos={me.pos} />}

          <div className="relative rounded-2xl overflow-hidden border-2 border-amber-900/40 shadow-2xl">
            <LifeBoard players={players} myIdx={myIdx} turnIdx={room.status === 'PLAYING' ? room.turn : -1}
              colors={COLORS} focusIdx={me?.pos} />
            <EventCard data={card} />
            {room.status === 'PLAYING' && (
              <div className="absolute top-2 right-2 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/75 border border-white/15 backdrop-blur-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: curColor }} />
                <span className="text-[11px] font-black text-white">{myTurn ? 'あなたの番' : `${cur?.name || '—'} の番`}</span>
              </div>
            )}
          </div>

          {/* 操作 */}
          <Panel className="p-4">
            {waiting ? (
              <div className="text-center space-y-3">
                <p className="text-sm font-bold text-white">
                  参加者を待っています（{players.length}/{room.maxSeats}人）
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map((p, i) => (
                    <span key={p.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 border border-white/10 text-xs font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {p.name}{p.vip && <VipBadge size="xs" />}
                    </span>
                  ))}
                </div>
                {room.createdBy === playerName ? (
                  <GoldButton onClick={startGame} disabled={players.length < 2} className="px-8 py-3 text-base flex items-center gap-2 mx-auto">
                    <Play size={18} /> ゲームを始める
                  </GoldButton>
                ) : (
                  <p className="text-[11px] text-gray-500">部屋主（{room.createdBy}）の開始を待っています…</p>
                )}
              </div>
            ) : done ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="text-amber-300" size={20} />
                  <h3 className="text-xl font-black text-white">最終結果</h3>
                  {room.stockValue > 0 && <span className="text-[11px] text-gray-500">株の評価額 {fmt(room.stockValue)} G/口</span>}
                </div>
                {!room.results ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-gray-400"><RefreshCw size={16} className="animate-spin" />集計中…</div>
                ) : (
                  <div className="space-y-1.5">
                    {room.results.map(r => {
                      const top = room.results[0]?.assets || 1;
                      const w = Math.max(6, Math.round((Math.max(0, r.assets) / Math.max(1, top)) * 100));
                      const ci = players.findIndex(p => p.name === r.name);
                      return (
                        <div key={r.name} className={`relative overflow-hidden flex items-center gap-3 p-3 rounded-xl border ${r.name === playerName ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                          <div className="absolute left-0 top-0 bottom-0 opacity-15" style={{ width: `${w}%`, background: COLORS[ci % COLORS.length] }} />
                          <span className="relative w-8 text-center text-lg font-black">{['🥇', '🥈', '🥉'][r.rank - 1] || r.rank}</span>
                          <div className="relative flex-1 min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5">{r.name}{r.vip && <VipBadge size="xs" />}</div>
                            <div className="text-[10px] text-gray-500">
                              所持金 {fmt(r.cash)} ／ 子 {r.kids}人 ／ {r.spouse ? '既婚' : '独身'} ／ 株 {r.stocks}口
                            </div>
                          </div>
                          <div className="relative text-right shrink-0">
                            <div className="font-mono font-black text-amber-300">{fmt(r.assets)}</div>
                            <div className="text-[10px] text-emerald-400 font-bold">賞金 +{fmt(r.prize)} G</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <GoldButton onClick={() => { setRoomId(null); setRoom(null); }} className="w-full py-3">ロビーに戻る</GoldButton>
              </div>
            ) : myPending ? (
              <div className="space-y-3">
                <p className="text-sm font-black text-amber-200 text-center flex items-center justify-center gap-1.5">
                  <Sparkles size={15} />
                  {pending.kind === 'CAREER' ? '職業を選んでください' : pending.kind === 'GAMBLE' ? '勝負しますか？' : '株を何口買いますか？'}
                </p>
                {pending.kind === 'CAREER' && (
                  <div className="grid grid-cols-2 gap-2">
                    {CAREERS.map(c => (
                      <button key={c.key} onClick={() => choose(c.key)}
                        className="p-3 rounded-xl bg-black/50 border border-white/10 hover:border-amber-400/60 text-left transition">
                        <div className="font-black text-white text-sm">{c.icon} {c.name}</div>
                        <div className="text-[11px] text-amber-300 font-mono">給料 {fmt(c.salary)}</div>
                        <div className="text-[10px] text-gray-500 leading-snug">{c.desc}</div>
                      </button>
                    ))}
                  </div>
                )}
                {pending.kind === 'GAMBLE' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => choose('YES')} className="py-3 rounded-xl font-black bg-amber-500 text-black">勝負する（所持金の30%）</button>
                    <button onClick={() => choose('NO')} className="py-3 rounded-xl font-black bg-white/10 text-white">見送る（+5,000）</button>
                  </div>
                )}
                {pending.kind === 'STOCK' && (
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map(n => (
                      <button key={n} onClick={() => choose(n)} disabled={n * 20000 > (me?.cash || 0)}
                        className="py-3 rounded-xl font-black bg-black/50 border border-white/10 text-white hover:border-amber-400/60 disabled:opacity-30">
                        {n}口<span className="block text-[10px] text-gray-500">{fmt(n * 20000)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Spinner value={wheel?.value || 1} spinKey={wheel?.key} size={186} />
                <div className="flex-1 w-full text-center sm:text-left space-y-2">
                  {me?.finished ? (
                    <p className="text-sm font-bold text-emerald-300">🏁 ゴール済みです。ほかの人を待っています…</p>
                  ) : myTurn ? (
                    <>
                      <p className="text-lg font-black text-white">あなたの番です</p>
                      <GoldButton onClick={() => doSpin(myIdx)} disabled={busyRef.current || spinBusy}
                        className="w-full sm:w-auto px-10 py-3.5 text-lg">
                        {spinBusy ? '回転中…' : 'ルーレットを回す'}
                      </GoldButton>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px] text-amber-300 font-mono">
                        <TimerRing ms={timeLeft} total={TURN_MS} /> 残り時間
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-black text-white flex items-center justify-center sm:justify-start gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: curColor }} />
                        {cur ? `${cur.name} の番` : '待機中'}
                      </p>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px] text-gray-400">
                        <TimerRing ms={timeLeft} total={TURN_MS} color={curColor} />
                        {spinBusy ? 'ルーレットが回っています…' : pending && !myPending ? `${players[pending.player]?.name} が選択中…` : '手番を待っています'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </Panel>

          {/* ログ */}
          {(room.log || []).length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5 flex items-center gap-1.5">
                <Clock size={11} /> ログ
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {[...(room.log || [])].reverse().map((l, i) => (
                  <div key={i} className={`text-[11px] ${i === 0 ? 'text-amber-200 font-bold' : 'text-gray-400'}`}>・{l}</div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* プレイヤー */}
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2 flex items-center gap-1.5">
              <Users size={11} /> プレイヤー
            </div>
            <div className="space-y-1.5">
              {players.map((p, i) => (
                <PlayerCard key={p.name} p={p} i={i} mine={i === myIdx}
                  active={room.turn === i && room.status === 'PLAYING'}
                  away={!isFresh(presenceByName[p.name])}
                  color={COLORS[i % COLORS.length]} />
              ))}
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">賞金の分配</div>
            <div className="space-y-1">
              {prizeSplit(Math.max(2, players.length)).map((s, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-gray-400">{i + 1}位</span>
                  <span className="font-mono text-amber-300 font-bold">{fmt(Math.floor((room.pot || 0) * s))} G（{Math.round(s * 100)}%）</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">所持金は {fmt(START_CASH)} からスタート。マスのイベントで増減します。</p>
          </Panel>

          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">マスの種類</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {Object.entries(SPACE_STYLE).filter(([k]) => k !== 'START').map(([k, s]) => (
                <div key={k} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 h-4 rounded-md shrink-0 border border-white/25"
                    style={{ background: `linear-gradient(180deg,${s.bg},${s.bg2})` }} />
                  <span className="text-[10px] text-gray-400 truncate">{s.icon} {s.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
