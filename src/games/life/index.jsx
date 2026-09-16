import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Users, Plus, Clock, Trophy, LogOut, RefreshCw, Play } from 'lucide-react';
import {
  doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit, runTransaction,
} from 'firebase/firestore';
import { db, appId } from '../../shared/firebase';
import { Panel, GoldButton, VipBadge, playSfx } from '../../shared/ui';
import {
  BOARD, GOAL_INDEX, SPACE_STYLE, CAREERS, careerOf, ENTRY_FEES, START_CASH,
  TURN_MS, KID_VALUE, SPOUSE_VALUE, newPlayer, applySpin, applyChoice, settle, boardLayout, prizeSplit,
} from './engine';

/* ==========================================================
   オンライン人生ゲーム
   ・部屋を立てて最大6人。参加費を出し合い、最終資産の順位で山分け
   ・手番の人がルーレットを回して結果を書き込み、全員がそれを見る
   ========================================================== */

const fmt = (n) => (n || 0).toLocaleString();
const COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#22d3ee'];
const AWAY_MS = 75000;
const COLS = 8;

const roomsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'lifeRooms');
const roomDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'lifeRooms', id);
const presenceRef = (id) => collection(db, 'artifacts', appId, 'public', 'data', 'lifeRooms', id, 'presence');
const isFresh = (p) => p && Date.now() - (p.at || 0) < AWAY_MS;

/* ---------- 盤面 ---------- */
function Board({ players, myIdx }) {
  const cells = useMemo(() => boardLayout(COLS), []);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
      {cells.map(({ i, sp, row, col }) => {
        const st = SPACE_STYLE[sp.t] || SPACE_STYLE.EVENT;
        const here = players.map((p, k) => ({ p, k })).filter(x => x.p.pos === i);
        return (
          <div key={i}
            style={{ gridRow: row + 1, gridColumn: col + 1, background: st.bg }}
            className="relative rounded-lg aspect-square flex flex-col items-center justify-center border border-white/15 overflow-hidden">
            <span className="text-[13px] leading-none">{st.icon}</span>
            <span className="text-[7px] font-black text-white/70 leading-none mt-0.5">{i + 1}</span>
            {here.length > 0 && (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-0.5 p-0.5">
                {here.map(({ p, k }) => (
                  <span key={k} title={p.name}
                    className={`block rounded-full border ${k === myIdx ? 'border-white' : 'border-black/50'}`}
                    style={{ width: 9, height: 9, background: COLORS[k % COLORS.length] }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- ルーレット ---------- */
function Spinner({ value, spinning }) {
  return (
    <div className="relative w-24 h-24 mx-auto">
      <div className="absolute inset-0 rounded-full border-4 border-amber-400/40"
        style={{ background: 'conic-gradient(#1e293b 0 36deg,#334155 36deg 72deg,#1e293b 72deg 108deg,#334155 108deg 144deg,#1e293b 144deg 180deg,#334155 180deg 216deg,#1e293b 216deg 252deg,#334155 252deg 288deg,#1e293b 288deg 324deg,#334155 324deg 360deg)' }} />
      <div className="absolute inset-3 rounded-full bg-black/70 flex items-center justify-center">
        <span className={`font-mono font-black text-3xl ${spinning ? 'text-gray-500' : 'text-amber-300'}`}>
          {value || '?'}
        </span>
      </div>
      {spinning && <div className="absolute inset-0 rounded-full border-4 border-t-amber-300 border-transparent animate-spin" />}
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
  const [spinning, setSpinning] = useState(false);
  const [spinFace, setSpinFace] = useState(0);
  const [claimed, setClaimed] = useState(false);

  const mountedRef = useRef(true);
  const roomRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    mountedRef.current = true;
    const iv = setInterval(() => mountedRef.current && setNow(Date.now()), 300);
    return () => { mountedRef.current = false; clearInterval(iv); };
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
      setRoomId(ref.id); setClaimed(false);
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
      if (ok) { setRoomId(r.id); setClaimed(false); playSfx('coin'); }
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
      setRoomId(null); setRoom(null);
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
      setSpinning(true);
      const iv = setInterval(() => setSpinFace(1 + Math.floor(Math.random() * 10)), 70);
      await new Promise(res => setTimeout(res, 900));
      clearInterval(iv);
      setSpinFace(value); setSpinning(false);
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
      playSfx('click');
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
        // 選択が返ってこないときは安全側の選択で進める
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

        <Panel gold className="p-5 mb-4">
          <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">🎲 オンライン人生ゲーム</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            最大6人で同じ盤を進みます。参加費を全員で出し合い、<b className="text-gray-300">ゴール時の最終資産の順位</b>で山分け。<br />
            最終資産 ＝ 所持金 ＋ 子ども{fmt(KID_VALUE)}/人 ＋ 結婚{fmt(SPOUSE_VALUE)} ＋ 株（1口 10,000〜35,000）
          </p>
        </Panel>

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
          <Panel className="p-3">
            <Board players={players} myIdx={myIdx} />
          </Panel>

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
                    {room.results.map(r => (
                      <div key={r.name} className={`flex items-center gap-3 p-3 rounded-xl border ${r.name === playerName ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                        <span className="w-8 text-center text-lg font-black">{['🥇', '🥈', '🥉'][r.rank - 1] || r.rank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">{r.name}{r.vip && <VipBadge size="xs" />}</div>
                          <div className="text-[10px] text-gray-500">
                            所持金 {fmt(r.cash)} ／ 子 {r.kids}人 ／ {r.spouse ? '既婚' : '独身'} ／ 株 {r.stocks}口
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-amber-300">{fmt(r.assets)}</div>
                          <div className="text-[10px] text-emerald-400 font-bold">賞金 +{fmt(r.prize)} G</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <GoldButton onClick={() => { setRoomId(null); setRoom(null); }} className="w-full py-3">ロビーに戻る</GoldButton>
              </div>
            ) : myPending ? (
              <div className="space-y-3">
                <p className="text-sm font-black text-amber-200 text-center">
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
              <div className="flex flex-col items-center gap-3">
                <Spinner value={myTurn ? (spinFace || room.lastSpin?.value) : room.lastSpin?.value} spinning={spinning} />
                {me?.finished ? (
                  <p className="text-sm font-bold text-emerald-300">ゴール済みです。ほかの人を待っています…</p>
                ) : myTurn ? (
                  <>
                    <GoldButton onClick={() => doSpin(myIdx)} disabled={busyRef.current || spinning} className="px-10 py-3.5 text-lg">
                      ルーレットを回す
                    </GoldButton>
                    <span className="text-[11px] text-amber-300 font-mono flex items-center gap-1"><Clock size={11} />残り {Math.ceil(timeLeft / 1000)}s</span>
                  </>
                ) : (
                  <p className="text-sm font-bold text-gray-400 flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    {cur ? `${cur.name} の番です…` : '待機中…'}（{Math.ceil(timeLeft / 1000)}s）
                  </p>
                )}
                {pending && !myPending && (
                  <p className="text-[11px] text-gray-500">{players[pending.player]?.name} が選択中…</p>
                )}
              </div>
            )}
          </Panel>

          {/* ログ */}
          {(room.log || []).length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">ログ</div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {[...(room.log || [])].reverse().map((l, i) => (
                  <div key={i} className="text-[11px] text-gray-400">・{l}</div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* プレイヤー */}
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">プレイヤー</div>
            <div className="space-y-1.5">
              {players.map((p, i) => {
                const c = careerOf(p.career);
                const away = !isFresh(presenceByName[p.name]);
                return (
                  <div key={p.name}
                    className={`p-2 rounded-xl border ${room.turn === i && room.status === 'PLAYING' ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-black/40'} ${p.finished ? 'opacity-70' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[12px] font-black text-white truncate">{p.name}</span>
                      {p.vip && <VipBadge size="xs" />}
                      {p.finished && <span className="text-[9px] font-black px-1 rounded bg-amber-400 text-black">GOAL</span>}
                      {away && <span className="text-[9px] text-gray-600">離席</span>}
                      <span className="ml-auto font-mono text-[12px] font-black text-amber-300">{fmt(p.cash)}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 flex flex-wrap gap-x-2">
                      <span>{c ? `${c.icon}${c.name}` : '職業なし'}</span>
                      <span>{p.spouse ? '💍' : ''}{p.kids > 0 ? `👶×${p.kids}` : ''}{p.stocks > 0 ? ` 📈×${p.stocks}` : ''}</span>
                      <span className="ml-auto">{p.pos + 1}/{GOAL_INDEX + 1}マス</span>
                    </div>
                  </div>
                );
              })}
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
        </div>
      </div>
    </div>
  );
}
