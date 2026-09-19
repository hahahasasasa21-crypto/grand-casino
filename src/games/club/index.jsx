import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Trophy, Users, Dumbbell, Flame, Star, Award, ChevronRight, Swords } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, playSfx } from '../../shared/ui.jsx';
import { MiniGame } from '../work/minigames.jsx';
import { schoolOf } from '../school/schools.js';
import {
  CLUBS, clubOf, SPORT_CLUBS, CULTURE_CLUBS, normalizeClub,
  trainGain, skillRank, fameRank, TRAIN_COOLDOWN, TRAIN_COST,
} from './clubs.js';
import {
  TOURNAMENTS, tournamentOf, canEnter, buildField, runTournament, rewardOf, roundName, teamPower,
} from './tournaments.js';

const fmt = (n) => Math.round(n || 0).toLocaleString();

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(iv); }, [ms]);
  return now;
}

function Bar({ value, max, color = '#fbbf24' }) {
  const p = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

/* ---------- トーナメント表 ---------- */
function Bracket({ result, club }) {
  if (!result) return null;
  const { rounds, totalRounds } = result;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-3 min-w-max pb-1">
        {rounds.map((pairs, ri) => (
          <div key={ri} className="min-w-[188px]">
            <div className="text-[10px] font-black tracking-widest text-amber-200/70 mb-1.5 text-center">
              {roundName(totalRounds, ri)}
            </div>
            <div className="space-y-1.5">
              {pairs.map((p, pi) => {
                const involved = p.a?.mine || p.b?.mine;
                return (
                  <div key={pi} className={`rounded-xl border p-1.5 text-[11px] ${involved ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                    {[p.a, p.b].map((t, ti) => {
                      if (!t) return <div key={ti} className="text-gray-600 px-1">— 不戦勝 —</div>;
                      const win = ti === 0 ? p.aWin : !p.aWin;
                      return (
                        <div key={ti} className={`flex items-center justify-between px-1 py-0.5 rounded ${win ? 'text-white font-black' : 'text-gray-500 line-through'}`}>
                          <span className="truncate flex items-center gap-1">
                            <span>{t.icon}</span>
                            <span className="truncate max-w-[104px]">{t.name}</span>
                            {t.mine && <span className="text-[8px] px-1 rounded bg-amber-400 text-black font-black">自分</span>}
                            {t.real && <span className="text-[8px] px-1 rounded bg-sky-500/30 text-sky-200 font-black">実在</span>}
                          </span>
                          <span className="font-mono shrink-0">{ti === 0 ? p.score[0] : p.score[1]}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 結果カード ---------- */
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
      {data.bracket && <div className="mt-3">{data.bracket}</div>}
      {data.note && <p className="text-xs font-bold mt-3 text-center text-emerald-300">{data.note}</p>}
      <GoldButton onClick={onClose} className="w-full py-3 mt-4">つづける</GoldButton>
    </Panel>
  );
}

/* ==========================================================
   本体
   ========================================================== */
export default function ClubView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  edu = {}, club: rawClub, saveClub, players = [], workExp = 0, saveWorkExp,
}) {
  const club = useMemo(() => normalizeClub(rawClub), [rawClub]);
  const [tab, setTab] = useState('HOME');      // HOME | JOIN | CUP
  const [task, setTask] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const now = useNow(1000);

  /* 在学中の学校（部活はここに所属する） */
  const enrolled = useMemo(() => {
    for (const k of ['hs', 'uni', 'voc']) {
      const r = edu[k];
      if (r && !r.graduated) return { slot: k, rec: r, school: schoolOf(r.key) };
    }
    return null;
  }, [edu]);
  const school = enrolled?.school || null;

  const save = useCallback(async (patch) => {
    try { await saveClub(patch); } catch (e) { showToast('保存に失敗しました。', 'error'); }
  }, [saveClub, showToast]);

  const myClubInfo = club.key ? clubOf(club.key) : null;
  const rank = skillRank(club.skill);
  const fr = fameRank(club.fame);

  /* 同じ部活をやっている実在プレイヤー（同じ学校＝味方／別の学校＝ライバル） */
  const peers = useMemo(() => {
    if (!club.key || !school) return { mates: [], rivals: [] };
    const slot = school.kind === 'HIGH' ? 'hs' : school.kind === 'UNI' ? 'uni' : 'voc';
    const mates = [], rivals = [];
    for (const p of players) {
      if (!p?.name || p.name === playerName) continue;
      const pc = p.club;
      if (!pc || pc.key !== club.key) continue;
      const rec = p?.edu?.[slot];
      if (!rec || rec.graduated) continue;
      const row = { name: p.name, skill: pc.skill || 0, fame: pc.fame || 0, schoolKey: rec.key, vip: !!p.vip };
      if (rec.key === school.key) mates.push(row); else rivals.push(row);
    }
    mates.sort((a, b) => b.skill - a.skill);
    rivals.sort((a, b) => b.skill - a.skill);
    return { mates, rivals };
  }, [players, club.key, school, playerName]);

  /* ---------- 入部・退部 ---------- */
  const join = async (c) => {
    if (!school) { showToast('学校に在籍していないと部活に入れません。', 'warning'); return; }
    if (!(school.clubs || []).includes(c.key)) { showToast('この学校にはその部がありません。', 'warning'); return; }
    if (club.key === c.key) { showToast('すでに入っています。', 'info'); return; }
    if (club.key) {
      // 別の部に移ると実力は半分になる
      await save({
        'club.key': c.key, 'club.school': school.key, 'club.joinedAt': Date.now(),
        'club.skill': Math.round((club.skill || 0) * 0.5),
      });
      showToast(`${c.icon} ${c.name} に移りました（実力は半分に）。`, 'info');
    } else {
      await save({ 'club.key': c.key, 'club.school': school.key, 'club.joinedAt': Date.now() });
      showToast(`${c.icon} ${c.name} に入部しました！`, 'success');
    }
    playSfx('win');
    setTab('HOME');
  };

  /* ---------- 練習 ---------- */
  const startTrain = () => {
    if (busyRef.current) return;
    if (!club.key || !school) { showToast('先に部活に入ってください。', 'warning'); return; }
    const until = (club.lastTrainAt || 0) + TRAIN_COOLDOWN;
    if (now < until) { showToast(`次の練習まで あと ${Math.ceil((until - now) / 1000)} 秒`, 'warning'); return; }
    const cost = TRAIN_COST(school);
    if (balance < cost) { showToast(`部費 ${fmt(cost)} Y が足りません。`, 'error'); return; }
    const c = clubOf(club.key);
    const d = Math.max(1, Math.min(5, 1 + Math.floor((club.skill || 0) / 900)));
    setTask({
      kind: 'TRAIN', club: c, cost,
      game: c.game, diff: d,
      title: `${c.icon} ${c.name}・練習`,
      sub: `${school.name}／実力 ${fmt(club.skill)}（${rank.name}）　部費 ${fmt(cost)} Y`,
    });
  };

  const finishTrain = async (c, cost, perf) => {
    try { await updateBalance(-cost); } catch (e) { setTask(null); return; }
    const gain = trainGain(c.key, club.skill, perf, school?.clubPower || 1);
    const exp = Math.max(1, Math.round((10 + (school?.dev || 50) * 0.25) * (0.4 + perf)));
    await save({
      'club.skill': (club.skill || 0) + gain,
      'club.lastTrainAt': Date.now(),
    });
    if (saveWorkExp) await saveWorkExp(exp);
    playSfx(perf >= 0.7 ? 'win' : 'click');
    const nr = skillRank((club.skill || 0) + gain);
    setResult({
      headline: 'TRAINING', title: `${c.icon} ${c.name}`,
      big: `+${gain}`, color: '#34d399',
      sub: `出来ばえ ${Math.round(perf * 100)}％`,
      lines: [
        { label: '部費', value: `-${fmt(cost)} Y`, tone: 'text-red-300' },
        { label: '実力', value: `${fmt(club.skill)} → ${fmt((club.skill || 0) + gain)}`, tone: 'text-emerald-300' },
        { label: '格', value: nr.name },
        { label: '通算経験', value: `+${exp}`, tone: 'text-sky-300' },
      ],
      note: nr.name !== rank.name ? `🎉 ${nr.name} になりました！` : '',
    });
  };

  /* ---------- 大会 ---------- */
  const startCup = (t) => {
    if (busyRef.current) return;
    const chk = canEnter(t, { club, school, now, lastAt: club.lastMatchAt });
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }
    if (balance < t.fee) { showToast(`参加費 ${fmt(t.fee)} Y が足りません。`, 'error'); return; }
    const c = clubOf(club.key);
    const d = Math.max(2, Math.min(5, 2 + Math.floor((club.skill || 0) / 1200)));
    setTask({
      kind: 'CUP', cup: t, club: c, diff: d, game: c.game,
      title: `${t.icon} ${t.short}・${c.name}`,
      sub: `参加費 ${fmt(t.fee)} Y／${Math.pow(2, t.rounds)}校のトーナメント／今日の出来が自分の働きになります`,
    });
  };

  const finishCup = async (t, perf) => {
    busyRef.current = true;
    try { await updateBalance(-t.fee); } catch (e) { busyRef.current = false; setTask(null); return; }
    const seed = Math.floor(Date.now() / 30000);
    const field = buildField(t, { players, me: playerName, myClub: club, mySchool: school, seed });
    const res = runTournament(t, field, club.key, perf, seed);
    const { prize, fame } = rewardOf(t, res.myRound, res.totalRounds, res.won);
    if (prize > 0) { try { await updateBalance(prize); } catch (e) { /* noop */ } }

    const titles = res.won ? [...(club.titles || []), { cup: t.key, at: Date.now(), club: club.key }].slice(-20) : club.titles;
    const hist = [{ cup: t.key, round: res.myRound, total: res.totalRounds, won: res.won, at: Date.now() }, ...(club.history || [])].slice(0, 12);
    await save({
      'club.fame': (club.fame || 0) + fame,
      'club.lastMatchAt': Date.now(),
      'club.wins': (club.wins || 0) + res.myRound,
      'club.losses': (club.losses || 0) + (res.won ? 0 : 1),
      'club.titles': titles,
      'club.history': hist,
    });
    busyRef.current = false;
    playSfx(res.won ? 'big' : res.myRound > 0 ? 'win' : 'lose');
    if (res.won && emitNews) {
      emitNews(`${t.icon} ${playerName}（${school.icon}${school.name} ${clubOf(club.key)?.name}）が【${t.short}】で優勝！`, 'jackpot');
    } else if (res.myRound >= res.totalRounds - 1 && emitNews) {
      emitNews(`${t.icon} ${playerName}（${school.icon}${school.name}）が【${t.short}】決勝進出！`, 'info');
    }
    const reached = res.won ? '優勝' : res.myRound === 0 ? '初戦敗退' : `${roundName(res.totalRounds, res.myRound - 1)}敗退`;
    setResult({
      headline: 'TOURNAMENT', title: `${t.icon} ${t.short}`,
      big: res.won ? '優勝' : reached,
      color: res.won ? '#fbbf24' : res.myRound > 0 ? '#60a5fa' : '#f87171',
      sub: `${Math.pow(2, t.rounds)}校／自分の出来ばえ ${Math.round(perf * 100)}％`,
      lines: [
        { label: '参加費', value: `-${fmt(t.fee)} Y`, tone: 'text-red-300' },
        { label: '賞金', value: `+${fmt(prize)} Y`, tone: 'text-emerald-300' },
        { label: '名声', value: `+${fame}（計 ${fmt((club.fame || 0) + fame)}）`, tone: 'text-amber-300' },
        { label: '味方の部員', value: `${peers.mates.length + 1} 人` },
        { label: '実在プレイヤーの学校', value: `${field.filter(f => f.real).length} 校`, tone: 'text-sky-300' },
      ],
      bracket: <Bracket result={res} club={club.key} />,
      note: res.won ? `🏆 ${school.name} の優勝です！` : '',
    });
  };

  /* ---------- ミニゲームの終了 ---------- */
  const onDone = async (perf) => {
    const t = task; setTask(null);
    if (!t) return;
    setBusy(true);
    try {
      if (t.kind === 'TRAIN') await finishTrain(t.club, t.cost, perf);
      else if (t.kind === 'CUP') await finishCup(t.cup, perf);
    } finally { setBusy(false); }
  };

  /* ---------- 画面 ---------- */
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
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <ResultCard data={result} onClose={() => setResult(null)} />
      </div>
    );
  }

  const available = school ? (school.clubs || []) : [];
  const trainLeft = Math.max(0, (club.lastTrainAt || 0) + TRAIN_COOLDOWN - now);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 font-bold transition">
        <ArrowLeft size={18} /> メニューに戻る
      </button>

      <SectionTitle icon={<Trophy size={26} />} title="部活・サークル"
        sub={school ? `${school.icon} ${school.name}（部活 ${available.length} 種）` : '学校に在籍すると入れます'} />

      {/* ---- 自分の部活 ---- */}
      {club.key && myClubInfo ? (
        <Panel gold className="p-5 mb-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-5xl leading-none">{myClubInfo.icon}</div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-white">{myClubInfo.name}</h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                  style={{ color: rank.color, borderColor: `${rank.color}55`, background: `${rank.color}18` }}>{rank.name}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                  style={{ color: fr.color, borderColor: `${fr.color}55`, background: `${fr.color}18` }}>🏅{fr.name}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{myClubInfo.desc}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
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
                <div className="bg-black/40 rounded-xl p-2 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold tracking-widest">優勝</div>
                  <div className="font-mono font-black text-amber-300">{(club.titles || []).length} 回</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-1">
                  <span>次の格まで</span>
                  <span>{rank.name}</span>
                </div>
                <Bar value={club.skill} max={(skillRank(club.skill + 100000).min || 6000)} color={rank.color} />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <GoldButton onClick={startTrain} disabled={busy || trainLeft > 0 || !school}
                className="w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2">
                <Dumbbell size={18} />
                {trainLeft > 0 ? `あと ${Math.ceil(trainLeft / 1000)} 秒` : `練習する（${fmt(TRAIN_COST(school))} Y）`}
              </GoldButton>
              {!school && <p className="text-[10px] text-red-300 mt-1 text-center">卒業したので練習はできません</p>}
            </div>
          </div>

          {/* 味方とライバル */}
          {(peers.mates.length > 0 || peers.rivals.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-black/40 rounded-2xl p-3 border border-emerald-400/20">
                <div className="text-[11px] font-black text-emerald-300 mb-1.5 flex items-center gap-1"><Users size={12} />同じ部の仲間（{peers.mates.length}）</div>
                {peers.mates.length === 0 ? <p className="text-[11px] text-gray-600">まだいません</p> : (
                  <div className="space-y-1">
                    {peers.mates.slice(0, 5).map(m => (
                      <div key={m.name} className="flex justify-between text-[11px]">
                        <span className="text-white font-bold truncate">{m.name}</span>
                        <span className="font-mono text-emerald-300">{fmt(m.skill)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-black/40 rounded-2xl p-3 border border-red-400/20">
                <div className="text-[11px] font-black text-red-300 mb-1.5 flex items-center gap-1"><Swords size={12} />他校のライバル（{peers.rivals.length}）</div>
                {peers.rivals.length === 0 ? <p className="text-[11px] text-gray-600">まだいません</p> : (
                  <div className="space-y-1">
                    {peers.rivals.slice(0, 5).map(m => (
                      <div key={m.name} className="flex justify-between text-[11px]">
                        <span className="text-white font-bold truncate">
                          {m.name} <span className="text-gray-500">/ {schoolOf(m.schoolKey)?.name || '?'}</span>
                        </span>
                        <span className="font-mono text-red-300">{fmt(m.skill)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="p-5 mb-4 text-center">
          <div className="text-4xl mb-2">🏟️</div>
          <p className="text-sm text-gray-300 font-bold mb-1">まだ部活に入っていません</p>
          <p className="text-[11px] text-gray-500">
            {school ? `${school.name} には ${available.length} 種類の部活があります。` : '学校に在籍すると部活に入れます。'}
          </p>
        </Panel>
      )}

      {/* ---- タブ ---- */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{ k: 'HOME', label: '戦績', icon: <Star size={14} /> },
        { k: 'JOIN', label: '入部する', icon: <Users size={14} /> },
        { k: 'CUP', label: '大会', icon: <Trophy size={14} /> }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`py-2.5 rounded-2xl text-xs font-black border transition flex items-center justify-center gap-1.5
              ${tab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:border-white/25'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ---- 戦績 ---- */}
      {tab === 'HOME' && (
        <div className="space-y-3">
          {(club.titles || []).length > 0 && (
            <Panel className="p-4">
              <h4 className="text-sm font-black text-amber-300 mb-2 flex items-center gap-1.5"><Award size={14} />優勝した大会</h4>
              <div className="flex flex-wrap gap-2">
                {(club.titles || []).slice().reverse().map((t, i) => {
                  const cup = tournamentOf(t.cup);
                  return (
                    <span key={i} className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-400/15 text-amber-200 border border-amber-400/30">
                      {cup?.icon} {cup?.short || t.cup}
                    </span>
                  );
                })}
              </div>
            </Panel>
          )}
          <Panel className="p-4">
            <h4 className="text-sm font-black text-white mb-2">大会の記録</h4>
            {(club.history || []).length === 0 ? (
              <p className="text-[11px] text-gray-500">まだ大会に出ていません。</p>
            ) : (
              <div className="space-y-1.5">
                {(club.history || []).map((h, i) => {
                  const cup = tournamentOf(h.cup);
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                      <span className="font-bold text-white">{cup?.icon} {cup?.short}</span>
                      <span className={h.won ? 'text-amber-300 font-black' : 'text-gray-400'}>
                        {h.won ? '優勝' : h.round === 0 ? '初戦敗退' : `${roundName(h.total, h.round - 1)}敗退`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel className="p-4">
            <h4 className="text-sm font-black text-white mb-1.5">🏅 スポーツ推薦について</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              名声が貯まると、学力が足りない学校にも <span className="text-rose-300 font-bold">スポーツ推薦</span> で入れることがあります。
              名声 260 で地区の学校、900 を超えると強豪校、さらに上ならどんな学校でも試験が免除されます。
              大会で勝ち上がるほど名声は大きく増えます。
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed mt-1.5">
              実力 2,400 と名声 2,000 を超えると、仕事の「就職」に <span className="text-amber-300 font-bold">プロスポーツ選手</span> が現れます。
              報酬は出来ばえで激変します。
            </p>
          </Panel>
        </div>
      )}

      {/* ---- 入部 ---- */}
      {tab === 'JOIN' && (
        <div className="space-y-3">
          {!school && <Panel className="p-4 text-[12px] text-gray-400">学校に在籍していません。学校に入ると部活が選べます。</Panel>}
          {school && (
            <>
              <p className="text-[11px] text-gray-500 px-1">
                {school.icon} {school.name} には <span className="text-amber-300 font-black">{available.length}</span> 種類の部活があります。
                部を移ると実力は半分になります。
              </p>
              {[{ label: '運動部', list: SPORT_CLUBS }, { label: '文化部', list: CULTURE_CLUBS }].map(sec => {
                const rows = sec.list.filter(c => available.includes(c.key));
                if (!rows.length) return null;
                return (
                  <div key={sec.label}>
                    <p className="text-[10px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-2">{sec.label}（{rows.length}）</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {rows.map(c => {
                        const mine = club.key === c.key;
                        const n = players.filter(p => p?.club?.key === c.key && p?.edu?.[school.kind === 'HIGH' ? 'hs' : school.kind === 'UNI' ? 'uni' : 'voc']?.key === school.key).length;
                        return (
                          <button key={c.key} onClick={() => join(c)} disabled={mine}
                            className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition
                              ${mine ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:border-white/30'}`}>
                            <span className="text-2xl shrink-0">{c.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-white text-sm">{c.name}</span>
                                {mine && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">所属中</span>}
                                {c.koshien && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/25 text-red-200 border border-red-400/30">甲子園</span>}
                              </div>
                              <p className="text-[11px] text-gray-500 leading-snug">{c.desc}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10">
                                  {c.team > 1 ? `団体 ${c.team}人` : '個人競技'}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10">
                                  練習：{c.game === 'MEMORY' ? '記憶' : c.game === 'SORT' ? '仕分け' : c.game === 'INSPECT' ? '検品' : c.game === 'TYPING' ? 'タイピング' : c.game === 'CALC' ? '暗算' : c.game === 'WORD' ? '英単語' : '筆記'}
                                </span>
                                {n > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">部員 {n} 人</span>}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-600 shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ---- 大会 ---- */}
      {tab === 'CUP' && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500 px-1">
            大会は<span className="text-sky-300 font-bold">通信</span>されます。同じ部活のプレイヤーは、同じ学校なら味方として、
            別の学校なら相手校としてトーナメント表に並びます。
          </p>
          {TOURNAMENTS.map(t => {
            const chk = canEnter(t, { club, school, now, lastAt: club.lastMatchAt });
            return (
              <Panel key={t.key} className={`p-4 ${chk.ok ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-white">{t.name}</h4>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/30">
                        {t.short}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10">
                        {Math.pow(2, t.rounds)}校
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{t.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-400/20">参加費 {fmt(t.fee)} Y</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">優勝賞金 {fmt(t.prize)} Y</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-400/20">名声 +{t.fameWin}</span>
                    </div>
                    {!chk.ok && <p className="text-[11px] text-red-300 font-bold mt-1.5">{chk.reason}</p>}
                  </div>
                  <GoldButton onClick={() => startCup(t)} disabled={!chk.ok || busy || balance < t.fee}
                    className="px-4 py-2 text-xs shrink-0 flex items-center gap-1">
                    <Flame size={14} />出場
                  </GoldButton>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
