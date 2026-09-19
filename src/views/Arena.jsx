import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, Swords, Flame, Trophy, Info } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, playSfx } from '../shared/ui.jsx';
import { MiniGame } from '../games/work/minigames.jsx';
import { clubOf, normalizeClub, skillRank, fameRank } from '../games/club/clubs.js';
import {
  MATCHES, matchOf, canFight, myPower, winChance, payoutOf, recordMatch,
  ARENA_CUT, normalizeArena,
} from '../shared/arena.js';
import { mulberry32, hash32 } from '../games/club/tournaments.js';

const fmt = (n) => Math.round(n || 0).toLocaleString();

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(iv); }, [ms]);
  return now;
}

function ResultCard({ data, onClose }) {
  return (
    <Panel gold className="p-6">
      <div className="text-center">
        <div className="text-[10px] font-black tracking-[0.35em] text-amber-200/70 mb-1">{data.headline}</div>
        <h3 className="text-xl font-black text-white mb-2">{data.title}</h3>
        <div className="text-5xl font-black mb-1" style={{ color: data.color }}>{data.big}</div>
        <p className="text-[11px] text-gray-500 mb-4">{data.sub}</p>
      </div>
      {(data.lines || []).map((l, i) => (
        <div key={i} className="flex justify-between items-center text-sm px-3 py-2 rounded-xl bg-black/40 border border-white/10 mb-1.5">
          <span className="text-gray-400 font-bold">{l.label}</span>
          <span className={`font-mono font-black ${l.tone || 'text-amber-300'}`}>{l.value}</span>
        </div>
      ))}
      {data.note && <p className="text-xs font-bold mt-3 text-center text-emerald-300">{data.note}</p>}
      <GoldButton onClick={onClose} className="w-full py-3 mt-4">つづける</GoldButton>
    </Panel>
  );
}

/* ==========================================================
   スポーツアリーナ（スポーツ大国）
   ========================================================== */
export default function ArenaView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  club: rawClub, saveClub, arena: rawArena, workExp = 0, saveWorkExp,
}) {
  const club = useMemo(() => normalizeClub(rawClub), [rawClub]);
  const arena = useMemo(() => normalizeArena(rawArena), [rawArena]);
  const [task, setTask] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const now = useNow(500);

  const info = club.key ? clubOf(club.key) : null;
  const rank = skillRank(club.skill);
  const fr = fameRank(club.fame);
  const lastAt = club.lastArenaAt || 0;

  const start = (m) => {
    if (busyRef.current) return;
    const chk = canFight(m, { club, now, lastAt, balance });
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }
    const d = Math.max(2, Math.min(5, 2 + MATCHES.indexOf(m)));
    setTask({
      match: m, game: info?.game || 'MEMORY', diff: d,
      title: `${m.icon} ${m.name}`,
      sub: `${info?.icon} ${info?.name}／実力 ${fmt(club.skill)}（${rank.name}）　参加費 ${fmt(m.fee)} Y`,
    });
  };

  const finish = async (m, perf) => {
    busyRef.current = true; setBusy(true);
    try { await updateBalance(-m.fee); }
    catch (e) { busyRef.current = false; setBusy(false); return; }

    const mine = myPower(club, perf);
    // 相手の強さは試合ごとに決まっていて、当日のぶれだけシードで動く
    const rnd = mulberry32(hash32(`${playerName}|arena|${m.key}|${Math.floor(Date.now() / 20000)}`));
    const theirs = Math.round(m.power * (0.82 + rnd() * 0.42));
    const chance = winChance(mine, theirs);
    const win = rnd() < chance;
    const payout = payoutOf(m, win, perf);

    if (payout > 0) { try { await updateBalance(payout); } catch (e) { /* noop */ } }
    recordMatch(m.fee, payout);

    const fameGain = win ? Math.round(24 + MATCHES.indexOf(m) * 60) : Math.round(4 + perf * 10);
    const exp = Math.max(1, Math.round((20 + MATCHES.indexOf(m) * 40) * (0.4 + perf)));
    await saveClub({
      'club.fame': (club.fame || 0) + fameGain,
      'club.lastArenaAt': Date.now(),
      'club.wins': (club.wins || 0) + (win ? 1 : 0),
      'club.losses': (club.losses || 0) + (win ? 0 : 1),
    });
    if (saveWorkExp) await saveWorkExp(exp);

    busyRef.current = false; setBusy(false);
    playSfx(win ? (m.key === 'WORLD' ? 'big' : 'win') : 'lose');
    if (win && emitNews && (m.key === 'TITLE' || m.key === 'WORLD')) {
      emitNews(`${m.icon} ${playerName} が【${m.name}】を制覇！（${fmt(payout)} Y）`, 'jackpot');
    }

    setResult({
      headline: 'ARENA', title: m.name,
      big: win ? '勝利' : '敗北',
      color: win ? '#fbbf24' : '#f87171',
      sub: `あなた ${fmt(mine)} 対 相手 ${fmt(theirs)}／勝率 ${Math.round(chance * 100)}％だった`,
      lines: [
        { label: '参加費', value: `-${fmt(m.fee)} Y`, tone: 'text-red-300' },
        { label: '賞金', value: `+${fmt(payout)} Y`, tone: payout > 0 ? 'text-emerald-300' : 'text-gray-500' },
        { label: '今日の出来ばえ', value: `${Math.round(perf * 100)}％` },
        { label: '名声', value: `+${fameGain}（計 ${fmt((club.fame || 0) + fameGain)}）`, tone: 'text-amber-300' },
        { label: '通算経験', value: `+${exp}`, tone: 'text-sky-300' },
      ],
      note: win ? '🏆 勝ちました！ 名声はスポーツ推薦とプロ入りに効きます。' : '',
    });
  };

  const onDone = async (perf) => {
    const t = task; setTask(null);
    if (t) await finish(t.match, perf);
  };

  if (task) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <MiniGame game={task.game} diff={task.diff} title={task.title} sub={task.sub}
          onDone={onDone} onQuit={() => setTask(null)} />
      </div>
    );
  }
  if (result) {
    return (
      <div className="max-w-md mx-auto p-4 md:p-6">
        <ResultCard data={result} onClose={() => setResult(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white font-bold transition">
          <ArrowLeft size={18} /> メニューに戻る
        </button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">
          {fmt(balance)} Y
        </div>
      </div>

      <SectionTitle icon={<Swords size={26} />} title="スポーツアリーナ"
        sub="スポーツ大国｜カジノの代わりに、ここでは賞金マッチが行われている" />

      {/* 自分の状態 */}
      <Panel gold className="p-4 mb-4">
        {club.key && info ? (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-4xl leading-none">{info.icon}</span>
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-lg">{info.name}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                  style={{ color: rank.color, borderColor: `${rank.color}55`, background: `${rank.color}18` }}>{rank.name}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                  style={{ color: fr.color, borderColor: `${fr.color}55`, background: `${fr.color}18` }}>🏅{fr.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-black/40 rounded-xl p-2 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold tracking-widest">実力</div>
                  <div className="font-mono font-black text-emerald-300">{fmt(club.skill)}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-2 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold tracking-widest">名声</div>
                  <div className="font-mono font-black text-amber-300">{fmt(club.fame)}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-2 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold tracking-widest">勝ち／負け</div>
                  <div className="font-mono font-black text-sky-300">{club.wins} / {club.losses}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="text-3xl mb-1">🏟️</div>
            <p className="text-sm font-bold text-white">まだ部活に入っていません</p>
            <p className="text-[11px] text-gray-500">学校で部活に入ると、その実力でここに出場できます。</p>
          </div>
        )}
      </Panel>

      {/* 試合 */}
      <div className="space-y-2 mb-4">
        {MATCHES.map(m => {
          const chk = canFight(m, { club, now, lastAt, balance });
          const mine = myPower(club, 0.75);
          const est = Math.round(winChance(mine, m.power) * 100);
          return (
            <Panel key={m.key} className={`p-4 ${chk.ok ? '' : 'opacity-70'}`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-white">{m.name}</h4>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10">
                      相手の強さ {fmt(m.power)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{m.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-400/20">参加費 {fmt(m.fee)} Y</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">勝てば 最大 {fmt(Math.round(m.fee * m.prize * 1.2))} Y</span>
                    {club.key && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border
                        ${est >= 50 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20' : 'bg-amber-500/10 text-amber-300 border-amber-400/20'}`}>
                        いまの目安 勝率 {est}％
                      </span>
                    )}
                  </div>
                  {!chk.ok && <p className="text-[11px] text-red-300 font-bold mt-1.5">{chk.reason}</p>}
                </div>
                <GoldButton onClick={() => start(m)} disabled={!chk.ok || busy}
                  className="px-4 py-2 text-xs shrink-0 flex items-center gap-1">
                  <Flame size={14} />出場
                </GoldButton>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* 競技場の会計 */}
      <Panel className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={14} className="text-rose-300" />
          <span className="text-[12px] font-black text-white">競技場の会計</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold tracking-widest">賞金プール</div>
            <div className="font-mono font-black text-rose-300 tabular-nums">{fmt(arena.pool)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold tracking-widest">支払った賞金</div>
            <div className="font-mono font-black text-emerald-300 tabular-nums">{fmt(arena.paid)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold tracking-widest">試合数</div>
            <div className="font-mono font-black text-sky-300 tabular-nums">{fmt(arena.matches)}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 items-start">
          <Info size={13} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            参加費の {Math.round(ARENA_CUT * 100)}% が競技場のプールに積まれます。
            このプールが大きくなるほど <b className="text-rose-300">SP（スポルト）</b> が強くなり、
            両替所のレートに出ます。勝敗は部活の実力と今日の出来ばえで決まり、
            賭けごとではありません。
          </p>
        </div>
      </Panel>
    </div>
  );
}
