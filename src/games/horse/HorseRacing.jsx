import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Eye, Users, Trophy, Zap, Clock, Ticket } from 'lucide-react';
import { doc, setDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, appId } from '../../shared/firebase';
import { Panel, GoldButton, playSfx } from '../../shared/ui';
import {
  buildRaceCard, attachOddsAsync, createSim, SIM_DT,
  BET_TYPES, payoutMultiplier, checkHit, RUNNING_STYLES, TURF_COLOR,
  REVEAL_FIELDS, REVEAL_LABEL, MAX_REVEAL_PER_HORSE, revealCost, commentaryFor, phaseOf, PHASE_LABEL,
} from './engine';
import { SKILL_BY_ID, SKILL_CATS } from './skills';
import { ITEMS } from '../../shared/vip';
import { Track3D, OvalMap, OrderBoard } from './RaceView';

/* ==========================================================
   VIRTUAL TURF — 本格競馬
   ・ソロレース と 公開レース（みんなで同じレースを見る）
   ・馬の能力は最初すべて非公開。コインを払うとランダムに1項目が判明。
     賭け金が大きいほど 1回あたりの開示料金が高くなる。
   ========================================================== */

const RACE_SCREEN_SECONDS = 34;   // 1レースを画面上で何秒に圧縮するか
const LOBBY_CHOICES = [30, 60, 120, 300];
const BET_PRESETS = [100, 500, 1000, 5000, 10000];
const MAX_SINGLE_PICKS = 5;   // 単勝・複勝は5頭までまとめ買い
const MAX_COMBO_TICKETS = 2;  // 2頭以上の券種は1レース2組まで

const raceRoomsRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'raceRooms');
const raceRoomDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'raceRooms', id);
const ticketsRef = (id) => collection(db, 'artifacts', appId, 'public', 'data', 'raceRooms', id, 'tickets');
const viewersRef = (id) => collection(db, 'artifacts', appId, 'public', 'data', 'raceRooms', id, 'viewers');

const fmt = (n) => (n || 0).toLocaleString();

/* ---------- 能力バー ---------- */
function StatBar({ value, color = '#34d399', hidden }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
      {hidden
        ? <div className="h-full w-full" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#475569 0 4px,#334155 4px 8px)' }} />
        : <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: color }} />}
    </div>
  );
}

/* ---------- 出走馬カード ---------- */
function EntryRow({ e, revealed, picked, pickIndex, onPick, onReveal, cost, canReveal, disabled, ordered }) {
  const has = (f) => revealed.includes(f);
  return (
    <div className={`rounded-xl border-2 p-2 transition ${picked ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
      <div className="flex items-start gap-2">
        <button onClick={() => onPick(e.id)} disabled={disabled}
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black disabled:opacity-60"
          style={{ background: e.silk.bg, color: e.silk.fg }}>{e.num}</button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onPick(e.id)} disabled={disabled} className="block w-full text-left disabled:opacity-70">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-[13px] truncate">{e.name}</span>
              {picked && (
                <span className="text-[9px] bg-amber-400 text-black font-black rounded px-1.5 py-0.5 shrink-0">
                  {ordered ? `${pickIndex + 1}着` : `${'①②③④⑤'[pickIndex] || pickIndex + 1}`}
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {e.frame}枠{e.num}番・{e.jockey}・{RUNNING_STYLES[e.style].label}・{e.age}歳・{e.weight}kg
            </div>
          </button>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5">
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-500">スピード</span>
                <span className="font-mono font-bold" style={{ color: has('speed') ? '#fbbf24' : '#64748b' }}>{has('speed') ? e.speed : '???'}</span>
              </div>
              <StatBar value={e.speed} color="#fbbf24" hidden={!has('speed')} />
            </div>
            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-500">体力</span>
                <span className="font-mono font-bold" style={{ color: has('stamina') ? '#34d399' : '#64748b' }}>{has('stamina') ? e.stamina : '???'}</span>
              </div>
              <StatBar value={e.stamina} color="#34d399" hidden={!has('stamina')} />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1 items-center">
            {has('skills')
              ? e.skills.map(sid => {
                const sk = SKILL_BY_ID[sid];
                if (!sk) return null;
                const c = SKILL_CATS[sk.cat] || { color: '#94a3b8' };
                return (
                  <span key={sid} className="w-full flex items-start gap-1.5 rounded-lg px-1.5 py-1 border"
                    style={{ borderColor: c.color + '44', background: c.color + '12' }}>
                    <span className="text-[9px] font-black shrink-0" style={{ color: c.color }}>
                      {sk.bad ? '▽' : '▲'}{sk.name}
                    </span>
                    <span className="text-[9px] text-gray-400 leading-snug">{sk.desc}</span>
                  </span>
                );
              })
              : <span className="text-[9px] text-gray-600 font-bold px-1.5 py-0.5 rounded-full border border-white/10 bg-black/40">スキル ???</span>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[9px] text-gray-500">単勝</div>
          <div className={`font-mono font-black text-sm ${has('odds') ? 'text-amber-300' : 'text-gray-600'}`}>
            {has('odds') ? e.odds.toFixed(1) : '??.?'}
          </div>
          <div className="flex justify-end gap-0.5 mt-0.5" title={`開示は1頭 ${MAX_REVEAL_PER_HORSE} 項目まで`}>
            {Array.from({ length: MAX_REVEAL_PER_HORSE }).map((_, k) => (
              <span key={k} className={`w-2 h-2 rounded-full border ${revealed.length > k ? 'bg-sky-400 border-sky-300' : 'border-white/25'}`} />
            ))}
          </div>
          {has('odds') && <div className="text-[9px] text-gray-500">{e.popularity}人気</div>}
          <button onClick={() => onReveal(e.id)} disabled={!canReveal}
            className="mt-1 text-[9px] font-black px-2 py-1 rounded-lg bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
            <Eye size={10} />{canReveal ? fmt(cost) : revealed.length >= REVEAL_FIELDS.length ? '全開示' : '上限'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function HorseRacing({ balance, updateBalance, onBack, showToast, playerName, emitNews, vip, items = {}, useItem }) {
  const [mode, setMode] = useState('MENU');          // MENU | SOLO | PUBLIC
  const [phase, setPhase] = useState('IDLE');        // IDLE | LOADING | BETTING | COUNTDOWN | RACING | RESULT
  const [progress, setProgress] = useState(0);
  const [card, setCard] = useState(null);
  const [reveals, setReveals] = useState({});        // { [id]: ['speed', ...] }
  const [revealsUsed, setRevealsUsed] = useState(0);
  const [betType, setBetType] = useState('WIN');
  const [picks, setPicks] = useState([]);
  const [betAmount, setBetAmount] = useState(1000);
  const [tickets, setTickets] = useState([]);
  const [countdown, setCountdown] = useState(3);
  const [commentary, setCommentary] = useState('');
  const [resultOrder, setResultOrder] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [speedUp, setSpeedUp] = useState(false);
  const [skillFeed, setSkillFeed] = useState([]);
  const [tab, setTab] = useState('CARD');            // CARD | ROOM

  // 公開レース
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [roomTickets, setRoomTickets] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [lobbySeconds, setLobbySeconds] = useState(60);
  const [remain, setRemain] = useState(0);

  const simRef = useRef(null);
  const rafRef = useRef(null);
  const mountedRef = useRef(true);
  const phaseRef = useRef('IDLE');
  const settledRef = useRef(false);
  const speedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { speedRef.current = speedUp; }, [speedUp]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const myPicks = useMemo(() => {
    const s = new Set();
    tickets.forEach(t => t.picks.forEach(p => s.add(p)));
    picks.forEach(p => s.add(p));
    return [...s];
  }, [tickets, picks]);

  const requiredPicks = BET_TYPES[betType].picks;
  const totalStaked = tickets.reduce((a, t) => a + t.amount, 0);

  /* ---------- 出走表の用意 ---------- */
  const prepareCard = useCallback(async (seed) => {
    setPhase('LOADING'); setProgress(0);
    const base = buildRaceCard(seed);
    const withOdds = await attachOddsAsync(base, 130, p => { if (mountedRef.current) setProgress(p); });
    if (!mountedRef.current) return null;
    setCard(withOdds);
    setReveals({}); setRevealsUsed(0); setPicks([]); setTickets([]);
    setResultOrder(null); setPayouts(null); setSkillFeed([]);
    settledRef.current = false; startedRef.current = false;
    simRef.current = null;
    setCommentary('出走馬の能力は非公開です。コインを払って情報を集めましょう。');
    setPhase('BETTING');
    return withOdds;
  }, []);

  /* ---------- 情報開示 ---------- */
  const unitCost = revealCost(betAmount, revealsUsed);
  const doReveal = async (id) => {
    if (!card) return;
    const cur = reveals[id] || [];
    if (cur.length >= MAX_REVEAL_PER_HORSE) {
      showToast(`情報開示は1頭につき ${MAX_REVEAL_PER_HORSE}項目 までです。`, 'warning');
      return;
    }
    const left = REVEAL_FIELDS.filter(f => !cur.includes(f));
    if (!left.length) { showToast('この馬の情報はすべて開示済みです。', 'info'); return; }
    if (balance < unitCost) { showToast('コインが足りません。', 'error'); return; }
    try { await updateBalance(-unitCost); } catch (e) { return; }
    const field = left[Math.floor(Math.random() * left.length)];
    setReveals(prev => ({ ...prev, [id]: [...(prev[id] || []), field] }));
    setRevealsUsed(n => n + 1);
    playSfx('coin');
    const e = card.entries.find(x => x.id === id);
    if (field === 'skills') {
      const lines = e.skills.map(sid => { const sk = SKILL_BY_ID[sid]; return sk ? `${sk.bad ? '▽' : '▲'}${sk.name}：${sk.desc}` : ''; }).filter(Boolean);
      showToast(`🔍 ${e.name} のスキル／ ${lines.join(' ／ ')}`, 'success');
    } else {
      const val = field === 'speed' ? e.speed : field === 'stamina' ? e.stamina
        : `単勝${e.odds.toFixed(1)}倍（${e.popularity}番人気）`;
      showToast(`🔍 ${e.name} の【${REVEAL_LABEL[field]}】＝ ${val}`, 'success');
    }
  };

  /* ---------- 馬券 ---------- */
  const isSingle = requiredPicks === 1;
  const maxPicks = isSingle ? MAX_SINGLE_PICKS : requiredPicks;

  const togglePick = (id) => {
    if (phase !== 'BETTING') return;
    setPicks(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= maxPicks) {
        showToast(isSingle
          ? `単勝・複勝は ${MAX_SINGLE_PICKS}頭 まで選べます。`
          : `${BET_TYPES[betType].label}は ${requiredPicks}頭 です。外してから選び直してください。`, 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };
  useEffect(() => { setPicks([]); }, [betType]);

  /** 倍率はオッズから決まるので、選んだ馬すべてのオッズを開示していないと見せない */
  const oddsKnown = useCallback(
    (ids) => ids.length > 0 && ids.every(id => (reveals[id] || []).includes('odds')),
    [reveals]);

  /** いま選んでいる馬で、券種ごとにいくらになるか（-1 ＝ 頭数は足りているがオッズ未開示） */
  const multByType = useMemo(() => {
    const out = {};
    if (!card) return out;
    Object.values(BET_TYPES).forEach(b => {
      if (picks.length < b.picks) { out[b.key] = 0; return; }
      const g = picks.slice(0, b.picks);
      out[b.key] = oddsKnown(g) ? (payoutMultiplier(b.key, g, card.entries) || 0) : -1;
    });
    return out;
  }, [card, picks, oddsKnown]);

  const comboTickets = tickets.filter(t => BET_TYPES[t.type].picks >= 2).length;
  const expectedPicks = picks.slice(0, requiredPicks);
  const expectedKnown = picks.length >= requiredPicks && oddsKnown(expectedPicks);
  const expectedMult = expectedKnown && card
    ? payoutMultiplier(betType, expectedPicks, card.entries) : 0;
  const ticketCount = isSingle ? picks.length : 1;
  const totalCost = (Number(betAmount) || 0) * ticketCount;

  const buyTicket = async () => {
    if (!card) return;
    if (picks.length < requiredPicks) { showToast(`${BET_TYPES[betType].label}は${requiredPicks}頭選んでください。`, 'error'); return; }
    const amount = Math.floor(Number(betAmount) || 0);
    if (amount < 100) { showToast('100G以上を指定してください。', 'error'); return; }

    // 1頭選択の券種は選んだ頭数ぶんをまとめ買い、2頭以上は1組ずつ（1レース2組まで）
    const groups = isSingle ? picks.map(id => [id]) : [picks.slice(0, requiredPicks)];
    if (!isSingle && comboTickets + 1 > MAX_COMBO_TICKETS) {
      showToast(`${BET_TYPES[betType].label}など2頭以上の券種は1レース ${MAX_COMBO_TICKETS}組 までです。`, 'warning');
      return;
    }
    const cost = amount * groups.length;
    if (balance < cost) { showToast('残高が足りません。', 'error'); return; }
    try { await updateBalance(-cost); } catch (e) { return; }

    const made = groups.map(g => ({
      type: betType, picks: [...g], amount,
      mult: payoutMultiplier(betType, g, card.entries),
    }));
    setTickets(prev => [...prev, ...made]);
    setPicks([]);
    playSfx('coin');
    showToast(made.length > 1
      ? `🎫 ${BET_TYPES[betType].label} を ${made.length}点（計 ${fmt(cost)}G）購入`
      : `🎫 ${BET_TYPES[betType].label} ${made[0].picks.join('-')} を ${fmt(amount)}G 購入`, 'success');
    if (mode === 'PUBLIC' && roomId) {
      for (const t of made) {
        try { await addDoc(ticketsRef(roomId), { ...t, player: playerName, at: Date.now() }); } catch (e) { /* noop */ }
      }
    }
  };

  /* ---------- 道具 ---------- */
  const revealAll = (field) => {
    setReveals(prev => {
      const n = { ...prev };
      card.entries.forEach(e => { n[e.id] = [...new Set([...(n[e.id] || []), field])]; });
      return n;
    });
  };
  const useOddsTicket = async () => {
    if ((items[ITEMS.ODDS_TICKET.key] || 0) <= 0) return;
    if (!(await useItem(ITEMS.ODDS_TICKET.key))) { showToast('チケットを使えませんでした。', 'error'); return; }
    revealAll('odds');
    playSfx('coin');
    showToast('🎫 全頭のオッズを開示しました！', 'success');
  };
  const useSkillBook = async () => {
    if ((items[ITEMS.SKILL_BOOK.key] || 0) <= 0) return;
    if (!(await useItem(ITEMS.SKILL_BOOK.key))) { showToast('名鑑を使えませんでした。', 'error'); return; }
    revealAll('skills');
    playSfx('coin');
    showToast('📜 全頭のスキルを開示しました！', 'success');
  };

  /* ---------- 精算 ---------- */
  const settle = useCallback(async (orderIds, theCard, theTickets) => {
    if (settledRef.current) return;
    settledRef.current = true;
    let total = 0;
    const rows = theTickets.map(t => {
      const hit = checkHit(t.type, t.picks, orderIds);
      const win = hit ? Math.floor(t.amount * t.mult) : 0;
      total += win;
      return { ...t, hit, win };
    });
    if (total > 0) {
      try { await updateBalance(total); } catch (e) { /* noop */ }
      showToast(`🏇 的中！ 払戻 +${fmt(total)} G`, 'success');
      playSfx('win');
      if (total >= 100000) emitNews(`🏇 ${playerName} が競馬で大的中！ ${fmt(total)} G 獲得！`, 'race');
    } else if (theTickets.length) {
      showToast('ハズレ…次のレースへ', 'warning');
      playSfx('lose');
    }
    const staked = theTickets.reduce((a, t) => a + t.amount, 0);
    setPayouts({ rows, total, staked });
  }, [updateBalance, showToast, emitNews, playerName]);

  /* ---------- レース進行 ---------- */
  const beginRace = useCallback((theCard, raceSeed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    const sim = createSim(theCard, raceSeed, { log: true });
    sim.horses.forEach(h => { h.renderPos = 0; h.prevPos = 0; });
    simRef.current = sim;
    setPhase('RACING'); phaseRef.current = 'RACING';
    setCommentary('ゲートが開きました！');
    playSfx('gate');

    const estSeconds = theCard.distance / 16.8;
    const baseScale = estSeconds / RACE_SCREEN_SECONDS;
    let last = performance.now();
    let acc = 0;
    let lastComment = 0;
    let seenEvents = 0;

    const loop = (now) => {
      if (!mountedRef.current) return;
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const scale = baseScale * (speedRef.current ? 2.2 : 1);
      acc += dtReal * scale;
      let steps = 0;
      while (acc >= SIM_DT && !sim.state.done && steps < 30) {
        sim.horses.forEach(h => { h.prevPos = h.pos; });
        sim.step();
        acc -= SIM_DT;
        steps++;
      }
      const alpha = sim.state.done ? 1 : Math.min(1, acc / SIM_DT);
      sim.horses.forEach(h => {
        if (h.finishTime !== null) {
          // ゴール後も惰性で走り抜ける（止まって重なるのを防ぐ）
          h.renderPos = theCard.distance + Math.max(0, sim.state.t - h.finishTime) * h.v * 0.55;
        } else {
          h.renderPos = h.prevPos + (h.pos - h.prevPos) * alpha;
        }
      });

      // 実況とスキルフィード
      if (now - lastComment > 2600) {
        lastComment = now;
        setCommentary(commentaryFor(sim.state, sim.horses, theCard));
      }
      if (sim.state.events.length > seenEvents) {
        const fresh = sim.state.events.slice(seenEvents).filter(e => e.kind === 'skill' || e.kind === 'note');
        seenEvents = sim.state.events.length;
        if (fresh.length) setSkillFeed(prev => [...fresh.slice(-4).reverse(), ...prev].slice(0, 14));
      }

      if (sim.state.done) {
        const orderIds = sim.state.order.map(h => h.id);
        setResultOrder(sim.state.order.map(h => ({
          id: h.id, num: h.num, name: h.name, silk: h.silk, time: h.finishTime, stamina: h.stamina,
        })));
        setPhase('RESULT'); phaseRef.current = 'RESULT';
        setCommentary('入線！ 各馬ゴールしました。');
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // 結果が出たら精算
  useEffect(() => {
    if (phase === 'RESULT' && resultOrder && card) {
      settle(resultOrder.map(h => h.id), card, tickets);
    }
  }, [phase, resultOrder, card, tickets, settle]);

  /* ---------- ソロ ---------- */
  const startSolo = async () => {
    setMode('SOLO');
    await prepareCard((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  };
  const soloGo = () => {
    if (!card) return;
    setPhase('COUNTDOWN'); setCountdown(3);
  };
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      beginRace(card, (card.seed * 7919 + 13) >>> 0);
      return;
    }
    playSfx('tick');
    const t = setTimeout(() => setCountdown(c => c - 1), 850);
    return () => clearTimeout(t);
  }, [phase, countdown, card, beginRace]);

  /* ---------- 公開レース ---------- */
  // ロビー購読
  useEffect(() => {
    if (mode !== 'PUBLIC' || roomId) return;
    const q = query(raceRoomsRef(), orderBy('createdAt', 'desc'), limit(8));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list);
    }, () => { });
    return () => unsub();
  }, [mode, roomId]);

  // 部屋購読
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(raceRoomDoc(roomId), snap => {
      if (!snap.exists()) { setRoom(null); return; }
      setRoom({ id: roomId, ...snap.data() });
    }, () => { });
    const unsubT = onSnapshot(ticketsRef(roomId), snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.at || 0) - (a.at || 0));
      setRoomTickets(list);
    }, () => { });
    const unsubV = onSnapshot(viewersRef(roomId), snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setViewers(list.filter(v => Date.now() - (v.at || 0) < 45000));
    }, () => { });
    return () => { unsub(); unsubT(); unsubV(); };
  }, [roomId]);

  // 在室ハートビート
  useEffect(() => {
    if (!roomId || !playerName) return;
    const beat = () => {
      setDoc(doc(viewersRef(roomId), encodeURIComponent(playerName)), { name: playerName, at: Date.now() }).catch(() => { });
    };
    beat();
    const iv = setInterval(beat, 12000);
    return () => clearInterval(iv);
  }, [roomId, playerName]);

  // 発走までのカウント
  useEffect(() => {
    if (!room || !room.postTime) return;
    const iv = setInterval(() => {
      const left = Math.max(0, room.postTime - Date.now());
      setRemain(left);
      if (left <= 0 && phaseRef.current === 'BETTING' && card && !startedRef.current) {
        beginRace(card, room.raceSeed >>> 0);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [room, card, beginRace]);

  // 結果を部屋に記録（最初に書き込めた人が確定させる）
  useEffect(() => {
    if (mode !== 'PUBLIC' || !roomId || !resultOrder) return;
    updateDoc(raceRoomDoc(roomId), {
      status: 'DONE',
      resultOrder: resultOrder.map(h => h.id),
      finishedAt: Date.now(),
    }).catch(() => { });
  }, [mode, roomId, resultOrder]);

  const enterPublic = () => { setMode('PUBLIC'); setPhase('IDLE'); };

  const createRoom = async () => {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const raceSeed = (seed * 2246822519 + 7) >>> 0;
    const postTime = Date.now() + lobbySeconds * 1000;
    try {
      const ref = doc(raceRoomsRef());
      await setDoc(ref, {
        seed, raceSeed, postTime, createdBy: playerName, createdAt: Date.now(),
        status: 'BETTING', lobbySeconds, resultOrder: null,
      });
      setRoomId(ref.id);
      showToast(`📣 レースを立ち上げました！ ${lobbySeconds}秒後に発走です。`, 'success');
      await prepareCard(seed);
    } catch (e) {
      showToast('レースの作成に失敗しました。', 'error');
    }
  };

  const joinRoom = async (r) => {
    setRoomId(r.id);
    await prepareCard(r.seed);
    if (r.status === 'DONE' && r.resultOrder) {
      showToast('このレースは終了しています。結果を表示します。', 'info');
    }
  };

  const leaveRoom = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRoomId(null); setRoom(null); setRoomTickets([]); setViewers([]);
    setCard(null); setPhase('IDLE'); startedRef.current = false; settledRef.current = false;
    simRef.current = null; setResultOrder(null); setPayouts(null); setTickets([]);
  };

  const backToMenu = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMode('MENU'); setPhase('IDLE'); setCard(null); setRoomId(null); setRoom(null);
    simRef.current = null; startedRef.current = false; settledRef.current = false;
    setResultOrder(null); setPayouts(null); setTickets([]);
  };

  const activeRooms = rooms.filter(r => r.status !== 'DONE' && (r.postTime || 0) > Date.now() - 180000);

  /* ==================== 描画 ==================== */
  const header = (
    <div className="w-full flex flex-wrap gap-3 justify-between items-center mb-4">
      <button onClick={mode === 'MENU' ? onBack : (roomId ? leaveRoom : backToMenu)}
        disabled={phase === 'RACING'}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40">
        <ArrowLeft size={20} /> {mode === 'MENU' ? '戻る' : roomId ? 'ロビーへ' : 'メニューへ'}
      </button>
      <div className="flex items-center gap-3">
        {card && (
          <div className="text-xs font-bold text-gray-300 hidden sm:block">
            {card.weather.icon} {card.weather.name}／馬場 <span className={TURF_COLOR[card.turf]}>{card.turf}</span>
          </div>
        )}
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} G</div>
      </div>
    </div>
  );

  /* ---------- モード選択 ---------- */
  if (mode === 'MENU') {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {header}
        <Panel gold className="p-6 mb-4">
          <h2 className="text-3xl font-black text-white mb-1">🏇 VIRTUAL TURF</h2>
          <p className="text-sm text-amber-200/70 mb-5">
            出走馬の <b>スピード・体力・スキル・オッズ</b> はすべて非公開。コインで情報を買って、勝ち馬を見抜け。
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <button onClick={startSolo}
              className="text-left p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/50 to-emerald-950 hover:border-emerald-400/60 transition">
              <div className="text-3xl mb-2">🐎</div>
              <div className="text-xl font-black text-white">ソロレース</div>
              <p className="text-xs text-gray-400 mt-1">自分のペースで。好きなときに発走できます。</p>
            </button>
            <button onClick={enterPublic}
              className="text-left p-5 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-900/50 to-sky-950 hover:border-sky-400/60 transition">
              <div className="text-3xl mb-2">📣</div>
              <div className="text-xl font-black text-white">公開レース</div>
              <p className="text-xs text-gray-400 mt-1">
                最初に入った人が発走までの秒数を決定。時間が来るまで誰でも参加でき、観戦だけでもOK。
              </p>
            </button>
          </div>
        </Panel>

        <Panel className="p-5">
          <h3 className="text-sm font-black text-amber-200 tracking-[0.2em] mb-3">スキル図鑑（全{Object.keys(SKILL_BY_ID).length}種）</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {Object.values(SKILL_BY_ID).map(sk => {
              const c = SKILL_CATS[sk.cat] || { color: '#94a3b8', label: '' };
              return (
                <div key={sk.id} className="p-2 rounded-lg bg-black/40 border border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ color: c.color, background: c.color + '1a' }}>{c.label}</span>
                    <span className="text-xs font-black text-white">{sk.bad ? '▽' : '▲'}{sk.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{sk.desc}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  /* ---------- 公開レースのロビー ---------- */
  if (mode === 'PUBLIC' && !roomId) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {header}
        <Panel gold className="p-5 mb-4">
          <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2"><Users size={22} /> 公開レース ロビー</h2>
          <p className="text-xs text-gray-400">開催中のレースに参加するか、新しいレースを立ち上げてください。</p>
        </Panel>

        {activeRooms.length > 0 ? (
          <div className="space-y-2 mb-5">
            {activeRooms.map(r => {
              const left = Math.max(0, (r.postTime || 0) - Date.now());
              return (
                <button key={r.id} onClick={() => joinRoom(r)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 transition text-left">
                  <div className="text-2xl">🏇</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white">{r.createdBy} のレース</div>
                    <div className="text-[11px] text-gray-500">発走まで {Math.ceil(left / 1000)} 秒 ／ 設定 {r.lobbySeconds}秒</div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black">参加する</span>
                </button>
              );
            })}
          </div>
        ) : (
          <Panel className="p-6 mb-5 text-center">
            <p className="text-gray-400 text-sm">いま開催中のレースはありません。<br />あなたが最初の参加者として、発走までの秒数を決められます。</p>
          </Panel>
        )}

        <Panel className="p-5">
          <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Clock size={16} /> 新しいレースを立ち上げる</h3>
          <p className="text-[11px] text-gray-500 mb-3">最初の参加者が「発走までの秒数」を決めます。その間は誰でも入室でき、馬券購入も観戦も自由です。</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {LOBBY_CHOICES.map(s => (
              <button key={s} onClick={() => setLobbySeconds(s)}
                className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition ${lobbySeconds === s ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:bg-white/10'}`}>
                {s < 60 ? `${s}秒` : `${s / 60}分`}
              </button>
            ))}
          </div>
          <GoldButton onClick={createRoom} className="w-full py-3.5 text-lg">
            {lobbySeconds < 60 ? `${lobbySeconds}秒後` : `${lobbySeconds / 60}分後`}に発走するレースを作る
          </GoldButton>
        </Panel>
      </div>
    );
  }

  /* ---------- 読み込み中 ---------- */
  if (phase === 'LOADING' || !card) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {header}
        <Panel className="p-10 flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-amber-400" size={40} />
          <p className="font-bold text-white">オッズを算出中…</p>
          <div className="w-full max-w-sm h-2 rounded-full bg-black/60 overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-[11px] text-gray-500">同じ条件で何百回も試走して、本物のオッズを計算しています。</p>
        </Panel>
      </div>
    );
  }

  const inRace = phase === 'RACING' || phase === 'RESULT' || phase === 'COUNTDOWN';
  const postLeftSec = Math.ceil(remain / 1000);

  /* ---------- レース画面 ---------- */
  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {header}

      {/* レース名 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{card.raceName}</h2>
          <p className="text-xs text-emerald-300 font-bold">{card.course.label}・{card.entries.length}頭立て{mode === 'PUBLIC' ? '・公開レース' : '・ソロ'}</p>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'PUBLIC' && room && phase === 'BETTING' && (
            <div className="px-4 py-2 rounded-xl bg-red-600/90 text-white font-black font-mono text-lg">
              発走まで {postLeftSec}s
            </div>
          )}
          {mode === 'PUBLIC' && (
            <div className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Users size={14} />{viewers.length || 1}人
            </div>
          )}
          {phase === 'RACING' && (
            <button onClick={() => setSpeedUp(s => !s)}
              className={`px-3 py-2 rounded-xl text-xs font-black border transition ${speedUp ? 'bg-amber-400 text-black border-amber-200' : 'bg-black/50 text-gray-300 border-white/10'}`}>
              <Zap size={13} className="inline mr-1" />{speedUp ? '2.2倍速' : '等速'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ===== 左：中継 ===== */}
        <div className="xl:col-span-2 space-y-3">
          <div className="relative">
            <Track3D simRef={simRef} card={card} picks={myPicks} running={phase === 'RACING'}
              height={360} speedLabel={phase === 'RACING' ? (speedUp ? '2.2x' : '1x') : null} />
            {phase === 'COUNTDOWN' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 rounded-2xl">
                <div className="text-7xl md:text-8xl font-black text-white animate-bounce">{countdown || 'GO!'}</div>
              </div>
            )}
            {phase === 'BETTING' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 rounded-2xl gap-3">
                <div className="text-lg md:text-2xl font-black text-white">各馬、パドックで待機中</div>
                {mode === 'SOLO'
                  ? <GoldButton onClick={soloGo} className="px-8 py-3 text-lg">レースを発走させる</GoldButton>
                  : <div className="text-amber-300 font-black font-mono text-3xl">{postLeftSec}s</div>}
              </div>
            )}
          </div>

          {/* 実況 */}
          <Panel className="p-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <OvalMap horses={simRef.current ? simRef.current.horses : card.entries.map(e => ({ ...e, pos: 0 }))}
                  dist={card.distance} picks={myPicks} turnDir={card.course.turnDir} size={78} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1">
                  実況 {simRef.current && phase === 'RACING' ? `／ ${PHASE_LABEL[phaseOf((simRef.current.horses.reduce((a, b) => b.pos > a.pos ? b : a, simRef.current.horses[0]).pos) / card.distance)]}` : ''}
                </div>
                <p className="text-sm md:text-base font-bold text-white leading-snug">{commentary}</p>
              </div>
            </div>
          </Panel>

          {/* 結果 */}
          {phase === 'RESULT' && resultOrder && (
            <Panel gold className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="text-amber-300" size={20} />
                <h3 className="text-xl font-black text-white">レース結果</h3>
                {payouts?.total > 0 && <span className="bg-amber-400 text-black text-xs font-black px-2.5 py-1 rounded-full animate-pulse">🎉 的中！</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {resultOrder.slice(0, 4).map((h, i) => {
                  const e = card.entries.find(x => x.id === h.id);
                  const mine = myPicks.includes(h.id);
                  return (
                    <div key={h.id} className={`p-2.5 rounded-xl text-center border ${mine ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                      <div className="text-lg">{['🥇', '🥈', '🥉', '4'][i]}</div>
                      <div className="w-7 h-7 mx-auto my-1 flex items-center justify-center rounded-lg text-xs font-black"
                        style={{ background: h.silk.bg, color: h.silk.fg }}>{h.num}</div>
                      <div className="text-[11px] text-white font-bold truncate">{h.name}</div>
                      <div className="text-[10px] text-amber-300">{e ? e.odds.toFixed(1) : '-'}倍</div>
                      <div className="text-[9px] text-gray-500 font-mono">{h.time.toFixed(1)}s</div>
                    </div>
                  );
                })}
              </div>
              {payouts && (
                <div className="space-y-1.5 mb-3">
                  {payouts.rows.map((t, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${t.hit ? 'bg-emerald-500/10 border border-emerald-400/30' : 'bg-black/40 border border-white/5'}`}>
                      <span className="font-black text-gray-300 w-14">{BET_TYPES[t.type].label}</span>
                      <span className="font-mono text-white flex-1">{t.picks.join('-')}</span>
                      <span className="text-gray-500">{fmt(t.amount)}G ×{t.mult}</span>
                      <span className={`font-black w-24 text-right ${t.hit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.hit ? `+${fmt(t.win)}` : 'ハズレ'}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-xs text-gray-400 font-bold">収支</span>
                    <span className={`font-mono font-black text-lg ${payouts.total - payouts.staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {payouts.total - payouts.staked >= 0 ? '+' : ''}{fmt(payouts.total - payouts.staked)} G
                    </span>
                  </div>
                </div>
              )}
              {mode === 'SOLO'
                ? <GoldButton onClick={() => prepareCard((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)} className="w-full py-3">次のレースへ</GoldButton>
                : <GoldButton onClick={leaveRoom} className="w-full py-3">ロビーに戻る</GoldButton>}
            </Panel>
          )}

          {/* スキル発動ログ */}
          {(phase === 'RACING' || phase === 'RESULT') && skillFeed.length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">スキル発動ログ</div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {skillFeed.map((ev, i) => (
                  <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${ev.bad ? 'text-slate-300 border-slate-500/40 bg-slate-500/10' : 'text-amber-200 border-amber-400/40 bg-amber-400/10'}`}>
                    {ev.horse || ev.name}：{ev.kind === 'skill' ? ev.name : ev.text}
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ===== 右：出馬表 / 投票 ===== */}
        <div className="space-y-3">
          {inRace && phase !== 'COUNTDOWN' ? (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">着順ボード</div>
              <OrderBoard simRef={simRef} card={card} picks={myPicks} />
            </Panel>
          ) : (
            <>
              {/* 情報開示の説明 */}
              <Panel className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5"><Eye size={15} /> 情報開示</h3>
                  <span className="text-[11px] font-mono font-black text-sky-300">1回 {fmt(unitCost)} G</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-snug">
                  馬の「<b className="text-gray-300">スピード / 体力 / オッズ / スキル</b>」のうち、まだ隠れている1項目が<b className="text-gray-300">ランダムに</b>判明します。<br />
                  <b className="text-sky-300">1頭につき {MAX_REVEAL_PER_HORSE}項目 まで</b>。<br />
                  単価 = 200G ＋ 購入予定額 <b className="text-gray-300">{fmt(betAmount)}G</b> の40％。開示のたびに ×1.25（現在{revealsUsed}回）。
                </p>
              </Panel>

              {/* 道具 */}
              {(items[ITEMS.ODDS_TICKET.key] || items[ITEMS.SKILL_BOOK.key]) ? (
                <Panel className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">🎒 道具</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { it: ITEMS.ODDS_TICKET, on: useOddsTicket, disabled: phase !== 'BETTING' },
                      { it: ITEMS.SKILL_BOOK, on: useSkillBook, disabled: phase !== 'BETTING' },
                    ].map(({ it, on, disabled }) => {
                      const n = items[it.key] || 0;
                      return (
                        <button key={it.key} onClick={on} disabled={disabled || n <= 0}
                          className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition disabled:opacity-30
                            bg-black/40 border-white/10 hover:bg-white/5`}>
                          <span className="text-lg leading-none">{it.icon}</span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black text-white truncate">{it.name}</span>
                            <span className="block text-[9px] text-gray-500">{it.short} ×{n}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>
              ) : null}

              {/* 馬券種別 */}
              <Panel className="p-3">
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {Object.values(BET_TYPES).map(b => {
                    const m = multByType[b.key] || 0;
                    return (
                      <button key={b.key} onClick={() => setBetType(b.key)} disabled={phase !== 'BETTING'}
                        className={`py-1 rounded-lg text-[11px] font-black border transition disabled:opacity-50 leading-tight ${betType === b.key ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/40 text-gray-400 border-white/10'}`}>
                        <span className="block">{b.label}</span>
                        <span className={`block text-[9px] font-mono ${betType === b.key ? 'text-black/70' : m > 0 ? 'text-amber-300' : 'text-gray-600'}`}>
                          {m > 0 ? `${m}倍` : m < 0 ? '?.?倍' : `${b.picks}頭`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mb-2">
                  {BET_TYPES[betType].desc}（{requiredPicks}頭選択{BET_TYPES[betType].ordered ? '・押した順が着順' : ''}）
                  {isSingle
                    ? <span className="text-amber-300/80"> ／ {MAX_SINGLE_PICKS}頭までまとめ買いできます</span>
                    : <span className="text-amber-300/80"> ／ 1レース{MAX_COMBO_TICKETS}組まで（購入済み {comboTickets}組）</span>}
                </p>

                <div className="flex flex-wrap gap-1 mb-2">
                  {BET_PRESETS.map(v => (
                    <button key={v} onClick={() => setBetAmount(v)} disabled={phase !== 'BETTING'}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 ${Number(betAmount) === v ? 'bg-white/15 text-white border-white/30' : 'bg-black/40 text-gray-400 border-white/10'}`}>
                      {fmt(v)}
                    </button>
                  ))}
                </div>
                <input type="number" min="100" step="100" value={betAmount}
                  onChange={e => setBetAmount(e.target.value)} disabled={phase !== 'BETTING'}
                  className="w-full bg-black/60 text-white font-mono text-base p-2.5 rounded-lg border border-white/10 focus:border-amber-400 outline-none mb-2 disabled:opacity-50" />

                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-gray-400">選択：<span className="font-mono text-white">{picks.length ? picks.join('-') : '—'}</span></span>
                  {expectedMult > 0 ? (
                    <span className="text-gray-400">的中 <span className="text-amber-300 font-black">{fmt(Math.floor((Number(betAmount) || 0) * expectedMult))}G</span>（{expectedMult}倍）</span>
                  ) : picks.length >= requiredPicks ? (
                    <span className="text-gray-500 flex items-center gap-1"><Eye size={10} />倍率はオッズを開示すると分かります</span>
                  ) : null}
                </div>
                <GoldButton onClick={buyTicket} disabled={phase !== 'BETTING' || picks.length < requiredPicks}
                  className="w-full py-2.5 flex items-center justify-center gap-2">
                  <Ticket size={16} /> {isSingle && picks.length > 1 ? `${picks.length}点を購入（${fmt(totalCost)}G）` : '馬券を購入'}
                </GoldButton>
                {tickets.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] text-gray-500 font-bold">購入済み {tickets.length}枚／計 {fmt(totalStaked)}G</div>
                    {tickets.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] bg-black/40 rounded-lg px-2 py-1 border border-white/5">
                        <span className="font-black text-amber-300 w-12">{BET_TYPES[t.type].label}</span>
                        <span className="font-mono text-white flex-1">{t.picks.join('-')}</span>
                        <span className="text-gray-500">{fmt(t.amount)}G ×{oddsKnown(t.picks) ? t.mult : '?'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* 出馬表 */}
              <Panel className="p-3">
                <div className="flex gap-1 mb-2">
                  <button onClick={() => setTab('CARD')} className={`flex-1 py-1.5 rounded-lg text-[11px] font-black ${tab === 'CARD' ? 'bg-white/15 text-white' : 'bg-black/40 text-gray-500'}`}>出馬表</button>
                  {mode === 'PUBLIC' && <button onClick={() => setTab('ROOM')} className={`flex-1 py-1.5 rounded-lg text-[11px] font-black ${tab === 'ROOM' ? 'bg-white/15 text-white' : 'bg-black/40 text-gray-500'}`}>みんなの馬券</button>}
                </div>
                {tab === 'CARD' ? (
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                    {card.entries.map(e => {
                      const rev = reveals[e.id] || [];
                      const idx = picks.indexOf(e.id);
                      return (
                        <EntryRow key={e.id} e={e} revealed={rev}
                          picked={idx >= 0} pickIndex={idx} ordered={BET_TYPES[betType].ordered} 
                          onPick={togglePick} onReveal={doReveal}
                          cost={unitCost} canReveal={phase === 'BETTING' && rev.length < MAX_REVEAL_PER_HORSE && balance >= unitCost}
                          disabled={phase !== 'BETTING'} />
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                    {roomTickets.length === 0 && <p className="text-[11px] text-gray-500 text-center py-6">まだ誰も馬券を買っていません。</p>}
                    {roomTickets.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-[11px] bg-black/40 rounded-lg px-2 py-1.5 border border-white/5">
                        <span className="font-bold text-sky-300 w-16 truncate">{t.player}</span>
                        <span className="font-black text-amber-300 w-10">{BET_TYPES[t.type]?.label}</span>
                        <span className="font-mono text-white flex-1">{(t.picks || []).join('-')}</span>
                        <span className="text-gray-500">{fmt(t.amount)}G</span>
                      </div>
                    ))}
                    {viewers.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-white/10">
                        <div className="text-[10px] text-gray-500 font-bold mb-1">入室中（{viewers.length}人）</div>
                        <div className="flex flex-wrap gap-1">
                          {viewers.map(v => (
                            <span key={v.id} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-200">{v.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
