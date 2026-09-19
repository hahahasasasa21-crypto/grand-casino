import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Briefcase, GraduationCap, Building2, Clock, Award, LogOut, TrendingUp, Lock, Check, Pickaxe } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, playSfx } from '../../shared/ui';
import { MiniGame } from './minigames.jsx';
import MiningView from './Mining.jsx';
import {
  GAMES, gameOf, PART_TIME, partTimeOf, LICENSES, licenseOf, CAREERS, careerOf,
  RANKS, rankOf, nextRank, salaryOf, shiftPayOf, shiftExp, promotionNeed,
  canApply, canTakeExam, applyFee, gradeOf, PAY_INTERVAL, SHIFT_COOLDOWN,
  bankerRateBonus, casinoStaffDiscount, payCurve, expMultOf, EDU_LABEL, jobChangePenalty,
} from './jobs.js';
import { recommendPerk, eduLevelOf, RETRY_MS } from '../school/schools.js';
import { postKindOf, postingPayable } from '../../shared/corp.js';

/* ==========================================================
   YUTAPON WORKS — 職業安定所
   アルバイト／資格／就職の3本立て
   ========================================================== */

const fmt = (n) => Math.round(n || 0).toLocaleString();
const BIG_NEWS_LICENSES = ['DOC', 'LAW', 'PHD', 'PILOT'];

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(iv); }, [ms]);
  return now;
}

function Stars({ n }) {
  return <span className="text-amber-300/80 text-[10px] tracking-tight">{'★'.repeat(n)}<span className="text-white/20">{'☆'.repeat(5 - n)}</span></span>;
}

function Bar({ value, max, color = '#fbbf24' }) {
  const p = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- 結果カード ---------- */
function ResultCard({ data, onClose }) {
  const g = gradeOf(data.perf);
  return (
    <Panel gold className="p-6 text-center">
      <div className="text-[10px] font-black tracking-[0.35em] text-amber-200/70 mb-1">{data.headline}</div>
      <h3 className="text-2xl font-black text-white mb-3">{data.title}</h3>
      <div className="inline-flex items-baseline gap-2 mb-1">
        <span className="text-6xl font-black" style={{ color: g.color }}>{g.g}</span>
        <span className="text-sm font-bold" style={{ color: g.color }}>{g.word}</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-4">出来ばえ {Math.round(data.perf * 100)}％</p>
      {data.lines.map((l, i) => (
        <div key={i} className="flex justify-between items-center text-sm px-3 py-2 rounded-xl bg-black/40 border border-white/10 mb-1.5">
          <span className="text-gray-400 font-bold">{l.label}</span>
          <span className={`font-mono font-black ${l.tone || 'text-amber-300'}`}>{l.value}</span>
        </div>
      ))}
      {data.note && <p className={`text-xs font-bold mt-3 ${data.ok ? 'text-emerald-300' : 'text-red-300'}`}>{data.note}</p>}
      <GoldButton onClick={onClose} className="w-full py-3 mt-4">つづける</GoldButton>
    </Panel>
  );
}

/* ---------- 本体 ---------- */
export default function WorkView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  job, licenses = [], jobRecord = {}, workExp = 0, workCool = {}, saveWork,
  rankingData = [], onGroupWork, miningBalance, edu = {}, vip = false,
  companies = [], onCorpWork, items = {}, onUseItem, jobChanges = 0,
}) {
  const eduLevel = eduLevelOf(edu);
  const [tab, setTab] = useState('PART');        // PART | LICENSE | CAREER
  const [task, setTask] = useState(null);        // 実行中のミニゲーム
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(500);
  const busyRef = useRef(false);

  const career = careerOf(job?.key);
  const rank = rankOf(job?.rank ?? 0);
  const promo = job ? promotionNeed(job) : null;
  const payLeft = job ? Math.max(0, (job.lastPayAt || job.hiredAt || 0) + PAY_INTERVAL - now) : 0;
  const shiftLeft = job ? Math.max(0, (job.lastShiftAt || 0) + SHIFT_COOLDOWN - now) : 0;

  const save = useCallback(async (patch) => {
    try { await saveWork(patch); } catch (e) { showToast('保存に失敗しました。', 'error'); }
  }, [saveWork, showToast]);

  /** よその会社が出している求人 */
  const postings = useMemo(() => {
    const out = [];
    (companies || []).forEach(c => (c.postings || []).forEach(pj => {
      if (c.owner === playerName) return;          // 自分の会社では働けない
      out.push({ ...pj, corpId: c.id, corpName: c.name, corpIcon: c.icon, company: c });
    }));
    return out.sort((a, b) => b.pay - a.pay);
  }, [companies, playerName]);

  /* ---------- アルバイト ---------- */
  const startPart = (j) => {
    const left = Math.max(0, (workCool[j.key] || 0) + j.cool - now);
    if (left > 0) { showToast(`${j.name} は あと ${Math.ceil(left / 1000)} 秒で受けられます。`, 'warning'); return; }
    setTask({ kind: 'PART', job: j, game: j.game, diff: j.diff, title: j.name, sub: j.desc });
  };

  /* ---------- 会社の求人で働く ---------- */
  const startPosting = (pj) => {
    const k = postKindOf(pj.kind);
    const left = Math.max(0, (workCool[`C_${pj.id}`] || 0) + k.cool - now);
    if (left > 0) { showToast(`次に働けるまで あと ${Math.ceil(left / 1000)} 秒です。`, 'warning'); return; }
    if (postingPayable(pj.company, pj.pay) <= 0) { showToast('この会社にいま支払う資金がありません。', 'error'); return; }
    setTask({
      kind: 'POST', posting: pj, game: pj.game, diff: pj.diff,
      title: `${pj.name}（${pj.corpName}）`, sub: `${k.name}・満額 ${fmt(pj.pay)} G`,
    });
  };

  const finishPosting = async (pj, perf) => {
    const full = Math.round(pj.pay * (perf < 0.3 ? 0.15 : 0.35 + perf * 0.85));
    let paid = 0;
    if (onCorpWork) paid = await onCorpWork(pj.corpId, full);
    const exp = Math.round(shiftExp(pj.diff, perf) * (pj.kind === 'FULL' ? 1.4 : 0.8));
    await save({ workExp: (workExp || 0) + exp, workCool: { ...workCool, [`C_${pj.id}`]: Date.now() } });
    playSfx(perf >= 0.6 ? 'win' : 'click');
    setResult({
      headline: postKindOf(pj.kind).name.toUpperCase(), title: `${pj.corpName}・${pj.name}`, perf, ok: perf >= 0.4,
      lines: [
        { label: '報酬', value: `+${fmt(paid)} G`, tone: 'text-emerald-300' },
        { label: '通算経験', value: `+${exp}` },
        ...(paid < full ? [{ label: '会社の資金不足', value: `満額 ${fmt(full)} G`, tone: 'text-red-300' }] : []),
      ],
      note: paid <= 0 ? 'この会社にお金がなく、報酬が支払われませんでした。' : '',
    });
  };

  const finishPart = async (j, perf) => {
    const pay = perf < 0.3 ? Math.round(j.pay * 0.15) : Math.round(j.pay * (0.35 + perf * 0.85));
    const exp = Math.round(shiftExp(j.diff, perf) * 0.6);
    if (pay > 0) { try { await updateBalance(pay); } catch (e) { /* noop */ } }
    await save({ workExp: (workExp || 0) + exp, workCool: { ...workCool, [j.key]: Date.now() } });
    playSfx(perf >= 0.6 ? 'win' : 'click');
    setResult({
      headline: 'ARBEIT', title: j.name, perf, ok: perf >= 0.4,
      lines: [
        { label: '日給', value: `+${fmt(pay)} G`, tone: 'text-emerald-300' },
        { label: '通算経験', value: `+${exp}` },
      ],
      note: perf >= 0.95 ? '店長も驚く手際でした。' : perf < 0.3 ? '今日はうまくいきませんでした…' : '',
    });
  };

  /* ---------- 資格試験 ---------- */
  const startExam = async (lic) => {
    if (busyRef.current) return;
    const chk = canTakeExam(lic, licenses);
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }
    if (balance < lic.fee) { showToast(`受験料 ${fmt(lic.fee)} G が足りません。`, 'error'); return; }
    busyRef.current = true; setBusy(true);
    try { await updateBalance(-lic.fee); }
    catch (e) { busyRef.current = false; setBusy(false); return; }
    busyRef.current = false; setBusy(false);
    const st = lic.stages?.[0];
    setTask({
      kind: 'EXAM', lic, stage: 0,
      game: st?.game || lic.game, diff: st?.diff ?? lic.diff,
      cols: st?.cols, rounds: st?.rounds,
      title: `${lic.name} 試験${st ? `（${st.name}）` : ''}`,
      sub: `合格ライン ${Math.round((st?.pass ?? lic.pass) * 100)}％`,
    });
  };

  const finishExam = async (lic, perf, stage = 0) => {
    const stages = lic.stages;
    if (stages) {
      const cur = stages[stage];
      if (perf < cur.pass) {
        playSfx('click');
        setResult({
          headline: 'EXAMINATION', title: `${lic.name}・${cur.name}`, perf, ok: false,
          lines: [
            { label: '合格ライン', value: `${Math.round(cur.pass * 100)}％` },
            { label: 'あなたの得点', value: `${Math.round(perf * 100)}％`, tone: 'text-red-300' },
          ],
          note: '不合格… 受験料は返りません。',
        });
        return;
      }
      if (stage + 1 < stages.length) {
        const nx = stages[stage + 1];
        showToast(`✅ ${cur.name} 合格！ 続けて ${nx.name} です。`, 'success');
        setTask({
          kind: 'EXAM', lic, stage: stage + 1,
          game: nx.game, diff: nx.diff, cols: nx.cols, rounds: nx.rounds,
          title: `${lic.name} 試験（${nx.name}）`,
          sub: `合格ライン ${Math.round(nx.pass * 100)}％`,
        });
        return;
      }
    }
    const passed = stages ? true : perf >= lic.pass;
    if (passed) {
      await save({ licenses: [...licenses, lic.key] });
      playSfx('win');
      if (BIG_NEWS_LICENSES.includes(lic.key) && emitNews) {
        emitNews(`${lic.icon} ${playerName} が【${lic.name}】に合格！`, 'jackpot');
      }
    } else playSfx('click');
    setResult({
      headline: 'EXAMINATION', title: lic.name, perf, ok: passed,
      lines: [
        { label: '合格ライン', value: `${Math.round(lic.pass * 100)}％` },
        { label: 'あなたの得点', value: `${Math.round(perf * 100)}％`, tone: passed ? 'text-emerald-300' : 'text-red-300' },
      ],
      note: passed ? `🎉 ${lic.name} を取得しました！` : '不合格… 受験料は返りません。',
    });
  };

  /* ---------- 就職 ---------- */
  const startApply = async (c) => {
    if (busyRef.current) return;
    if (job) { showToast('先に今の仕事を退職してください。', 'warning'); return; }
    const until = (edu.retryAt || {})[c.key] || 0;
    if (Date.now() < until) {
      showToast(`${c.name} の再チャレンジまで あと ${Math.ceil((until - Date.now()) / 60000)} 分です。`, 'warning');
      return;
    }
    const chk = canApply(c, licenses, workExp, eduLevel);
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }
    const fee = applyFee(c);
    if (balance < fee) { showToast(`受験料 ${fmt(fee)} G が足りません。`, 'error'); return; }
    busyRef.current = true; setBusy(true);
    try { await updateBalance(-fee); }
    catch (e) { busyRef.current = false; setBusy(false); return; }
    busyRef.current = false; setBusy(false);

    const perk = recommendPerk(edu, c);
    if (perk.skip) { await finishApply(c, 1, true); return; }   // 推薦で試験免除
    let penalty = jobChangePenalty(jobChanges);
    if (penalty > 0 && (items.AGENT || 0) > 0 && onUseItem) {
      if (await onUseItem('AGENT')) { penalty = 0; showToast('🤝 転職エージェントが不利を帳消しにしました。', 'success'); }
    }
    const line = Math.max(0.28, c.exam.pass - (perk.ease || 0) + penalty);
    setTask({
      kind: 'APPLY', career: c, game: c.exam.game, diff: Math.max(1, c.exam.diff - (perk.diffDown || 0)), line,
      title: `${c.name} 採用試験`,
      sub: `合格ライン ${Math.round(line * 100)}％${perk.ease ? `（推薦 -${Math.round(perk.ease * 100)}pt）` : ''}${penalty ? `（転職 +${Math.round(penalty * 100)}pt）` : ''}`,
    });
  };

  const finishApply = async (c, perf, recommended = false) => {
    const perk = recommendPerk(edu, c);
    const line = Math.max(0.28, c.exam.pass - (perk.ease || 0) + jobChangePenalty(jobChanges));
    const passed = recommended || perf >= line;
    if (!passed) await save({ [`edu.retryAt.${c.key}`]: Date.now() + RETRY_MS });
    if (passed) {
      const rec = jobRecord[c.key] || { rank: 0, exp: 0 };
      const t = Date.now();
      // 前と違う会社に移ったら転職1回とカウント（次からの採用が少しきびしくなる）
      const moved = jobRecord.__last && jobRecord.__last !== c.key;
      await save({
        job: { key: c.key, rank: rec.rank || 0, exp: rec.exp || 0, hiredAt: t, lastPayAt: t, lastShiftAt: 0 },
        'jobRecord.__last': c.key,
        ...(moved ? { jobChanges: (jobChanges || 0) + 1 } : {}),
      });
      playSfx('win');
      if (emitNews) emitNews(`${c.icon} ${playerName} が【${c.name}】として採用されました！`, 'info');
    } else playSfx('click');
    setResult({
      headline: 'RECRUITMENT', title: c.name, perf, ok: passed,
      lines: [
        { label: '合格ライン', value: recommended ? '推薦（免除）' : `${Math.round(line * 100)}％` },
        { label: 'あなたの得点', value: recommended ? '—' : `${Math.round(perf * 100)}％`, tone: passed ? 'text-emerald-300' : 'text-red-300' },
        ...(perk.notes?.length ? [{ label: '推薦', value: perk.notes[0], tone: 'text-sky-300' }] : []),
      ],
      note: passed
        ? (recommended ? `🎉 推薦で採用！ 今日から ${c.name} です。` : `🎉 今日から ${c.name} です！`)
        : `不採用… ${Math.round(RETRY_MS / 60000)} 分後に再チャレンジできます。`,
    });
    if (passed) setTab('CAREER');
  };

  const startShift = () => {
    if (!career || !job) return;
    if (shiftLeft > 0) { showToast(`次の出勤まで あと ${Math.ceil(shiftLeft / 1000)} 秒です。`, 'warning'); return; }
    setTask({
      kind: 'SHIFT', career, game: career.shift.game, diff: career.shift.diff,
      title: `${career.name}の出勤`, sub: `${rank.name}・満額 ${fmt(shiftPayOf(job, vip))} G`,
    });
  };

  const finishShift = async (c, perf) => {
    const full = shiftPayOf(job, vip);
    const pay = Math.round(full * payCurve(c, perf));
    const exp = shiftExp(c.shift.diff, perf, expMultOf(c));
    if (pay > 0) { try { await updateBalance(pay); } catch (e) { /* noop */ } }
    const nj = { ...job, exp: (job.exp || 0) + exp, lastShiftAt: Date.now() };
    await save({
      job: nj, workExp: (workExp || 0) + exp,
      jobRecord: { ...jobRecord, [c.key]: { rank: nj.rank, exp: nj.exp } },
    });
    // YUTAPON グループの社員は、働いた成果がそのまま金庫に反映される
    if (c.group && onGroupWork) {
      const earned = Math.round(full * perf * 1.6);
      onGroupWork(c.group, earned, pay);
    }
    playSfx(perf >= 0.6 ? 'win' : 'click');
    const need = promotionNeed(nj);
    setResult({
      headline: 'SHIFT', title: `${c.name}・${rank.name}`, perf, ok: perf >= 0.4,
      lines: [
        { label: '出勤手当', value: `+${fmt(pay)} G`, tone: 'text-emerald-300' },
        { label: '経験値', value: `+${exp}` },
        ...(need ? [{ label: `${need.rank.name}まで`, value: need.left > 0 ? `あと ${need.left}` : '昇進試験を受けられます', tone: need.left > 0 ? 'text-gray-300' : 'text-amber-300' }] : []),
      ],
      note: perf >= 0.95 ? '文句なしの仕事ぶりでした。' : '',
    });
  };

  const startPromo = () => {
    if (!career || !job || !promo || promo.left > 0) return;
    setTask({
      kind: 'PROMO', career, game: career.exam.game, diff: Math.min(5, career.exam.diff + 1),
      title: `${promo.rank.name} 昇進試験`, sub: `合格ライン ${Math.round(Math.min(0.95, career.exam.pass + 0.05) * 100)}％`,
    });
  };

  const finishPromo = async (c, perf) => {
    const line = Math.min(0.95, c.exam.pass + 0.05);
    const passed = perf >= line;
    const nxt = nextRank(job.rank);
    if (passed && nxt) {
      const nj = { ...job, rank: job.rank + 1 };
      await save({ job: nj, jobRecord: { ...jobRecord, [c.key]: { rank: nj.rank, exp: nj.exp || 0 } } });
      playSfx('win');
      if (emitNews && job.rank + 1 >= RANKS.length - 1) {
        emitNews(`${c.icon} ${playerName} が ${c.name} の${nxt.name}に就任！`, 'jackpot');
      }
    } else playSfx('click');
    setResult({
      headline: 'PROMOTION', title: nxt ? `${nxt.name} 昇進試験` : '昇進試験', perf, ok: passed,
      lines: [
        { label: '合格ライン', value: `${Math.round(line * 100)}％` },
        { label: 'あなたの得点', value: `${Math.round(perf * 100)}％`, tone: passed ? 'text-emerald-300' : 'text-red-300' },
        ...(passed && nxt ? [{ label: '新しい給料', value: `${fmt(Math.round(c.salary * nxt.mult))} G / 給料日`, tone: 'text-amber-300' }] : []),
      ],
      note: passed && nxt ? `🎉 ${nxt.name} に昇進しました！` : 'また挑戦しましょう。',
    });
  };

  const quitJob = async () => {
    if (!job || !career) return;
    await save({
      job: null,
      jobRecord: { ...jobRecord, [career.key]: { rank: job.rank, exp: job.exp || 0 } },
    });
    showToast(`${career.name} を退職しました。役職と経験は残ります。`, 'info');
  };

  /** 融資審査・不正検知にわたす文脈（実在プレイヤーの数字を使う） */
  const gameCtx = useMemo(() => ({
    players: (rankingData || []).filter(r => !r.isBank && r.name !== playerName),
    cols: task?.cols, rounds: task?.rounds,
  }), [rankingData, playerName, task]);

  /* ---------- ミニゲームの終了 ---------- */
  const onDone = useCallback(async (perf) => {
    const t = task;
    setTask(null);
    if (!t) return;
    if (t.kind === 'PART') return finishPart(t.job, perf);
    if (t.kind === 'EXAM') return finishExam(t.lic, perf, t.stage || 0);
    if (t.kind === 'POST') return finishPosting(t.posting, perf);
    if (t.kind === 'APPLY') return finishApply(t.career, perf);
    if (t.kind === 'SHIFT') return finishShift(t.career, perf);
    if (t.kind === 'PROMO') return finishPromo(t.career, perf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, job, licenses, jobRecord, workExp, workCool]);

  /* ==================== 画面 ==================== */
  if (task) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <MiniGame game={task.game} diff={task.diff} title={task.title} sub={task.sub} ctx={gameCtx}
          onDone={onDone} onQuit={() => { setTask(null); showToast('中断しました。', 'info'); }} />
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <ResultCard data={result} onClose={() => setResult(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> メニューに戻る</button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} G</div>
      </div>

      <Panel gold className="p-5 mb-4">
        <SectionTitle icon={<Briefcase size={26} />} title="仕事" sub="アルバイト・求人・採掘・資格・就職" />
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">いまの仕事</div>
            <div className="text-[13px] font-black text-white truncate">{career ? `${career.icon}${career.name}` : '無職'}</div>
            <div className="text-[10px] text-amber-300 font-bold">{career ? rank.name : 'アルバイト中'}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">通算経験</div>
            <div className="text-[15px] font-black font-mono text-emerald-300">{fmt(workExp)}</div>
            <div className="text-[10px] text-gray-500">応募の条件</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">資格</div>
            <div className="text-[15px] font-black font-mono text-sky-300">{licenses.length} / {LICENSES.length}</div>
            <div className="text-[10px] text-gray-500">取得数</div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { k: 'PART', label: 'アルバイト', icon: <Briefcase size={15} /> },
          { k: 'MINE', label: '採掘', icon: <Pickaxe size={15} /> },
          { k: 'LICENSE', label: '資格', icon: <GraduationCap size={15} /> },
          { k: 'CAREER', label: '就職', icon: <Building2 size={15} /> },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`py-2.5 rounded-xl font-black text-[13px] border-2 transition flex items-center justify-center gap-1.5
              ${tab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ---------- アルバイト ---------- */}
      {tab === 'PART' && (
        <div className="space-y-2">
          {postings.length > 0 && (
            <>
              <div className="text-[10px] font-black tracking-widest text-sky-300/80 flex items-center gap-1.5">
                🏢 企業の求人（{postings.length}）
              </div>
              {postings.map(pj => {
                const k = postKindOf(pj.kind);
                const g = gameOf(pj.game);
                const left = Math.max(0, (workCool[`C_${pj.id}`] || 0) + k.cool - now);
                const payable = postingPayable(pj.company, pj.pay);
                return (
                  <button key={pj.id} onClick={() => startPosting(pj)} disabled={left > 0 || payable <= 0}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-sky-500/5 border border-sky-400/25 hover:border-sky-400/60 transition text-left disabled:opacity-45">
                    <span className="text-2xl shrink-0">{k.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-sm">{pj.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-400/15 text-sky-200 font-bold border border-sky-400/30">{k.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold">{g.icon}{g.name}</span>
                        <Stars n={pj.diff} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">🏢 {pj.corpName} が募集中</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-amber-300 text-sm">{fmt(pj.pay)} G</div>
                      <div className="text-[10px] text-gray-500">
                        {payable <= 0 ? '資金切れ' : left > 0 ? `休憩 ${Math.ceil(left / 1000)}s` : '働く'}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="h-1" />
            </>
          )}
          <p className="text-[11px] text-gray-500 mb-1">資格がなくても今すぐ働けます。出来ばえで日給が変わり、通算経験も少し貯まります。</p>
          {PART_TIME.map(j => {
            const g = gameOf(j.game);
            const left = Math.max(0, (workCool[j.key] || 0) + j.cool - now);
            return (
              <button key={j.key} onClick={() => startPart(j)} disabled={left > 0}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 transition text-left disabled:opacity-45">
                <span className="text-2xl shrink-0">{j.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm">{j.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold">{g.icon}{g.name}</span>
                    <Stars n={j.diff} />
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{j.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-amber-300 text-sm">〜{fmt(j.pay * 1.2)} G</div>
                  <div className="text-[10px] text-gray-500">{left > 0 ? `休憩 ${Math.ceil(left / 1000)}s` : '働く'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- 採掘 ---------- */}
      {tab === 'MINE' && (
        <div className="-mx-4 md:-mx-8">
          <MiningView balance={balance} updateBalance={miningBalance || updateBalance}
            onBack={() => setTab('PART')} showToast={showToast} playerName={playerName} emitNews={emitNews} />
        </div>
      )}

      {/* ---------- 資格 ---------- */}
      {tab === 'LICENSE' && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500 mb-1">受験料を払って試験に合格すると取得。就職の条件になります。落ちても受験料は戻りません。</p>
          {LICENSES.map(l => {
            const owned = licenses.includes(l.key);
            const chk = canTakeExam(l, licenses);
            const g = gameOf(l.game);
            return (
              <div key={l.key}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition
                  ${owned ? 'bg-emerald-500/10 border-emerald-400/40' : chk.ok ? 'bg-black/40 border-white/10' : 'bg-black/30 border-white/5 opacity-70'}`}>
                <span className="text-2xl shrink-0">{l.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm">{l.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold">{g.icon}{g.name}</span>
                    <Stars n={l.diff} />
                    {owned && <span className="text-[10px] font-black text-emerald-300 flex items-center gap-0.5"><Check size={11} />取得済</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{l.desc}</p>
                  {!owned && !chk.ok && <p className="text-[10px] text-red-300 font-bold flex items-center gap-1"><Lock size={9} />{chk.reason}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gray-500">合格 {Math.round(l.pass * 100)}％</div>
                  {owned ? (
                    <span className="text-[11px] font-black text-emerald-300">✓</span>
                  ) : (
                    <button onClick={() => startExam(l)} disabled={!chk.ok || busy || balance < l.fee}
                      className="mt-0.5 px-3 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white text-[11px] font-black disabled:opacity-30">
                      受験 {fmt(l.fee)}G
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- 就職 ---------- */}
      {tab === 'CAREER' && (
        <div className="space-y-3">
          {job && career ? (
            <Panel gold className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{career.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">{career.field}</div>
                  <div className="text-xl font-black text-white truncate">{career.name}</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-black shrink-0">{rank.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold">給料（{Math.round(PAY_INTERVAL / 60000)}分ごと）</div>
                  <div className="font-mono font-black text-emerald-300">{fmt(salaryOf(job, eduLevel, vip))} G</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={9} />次まで {mmss(payLeft)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="text-[9px] text-gray-500 font-bold">出勤手当（満額）</div>
                  <div className="font-mono font-black text-amber-300">{fmt(shiftPayOf(job, vip))} G</div>
                  <div className="text-[10px] text-gray-500">{gameOf(career.shift.game).icon}{gameOf(career.shift.game).name}・<Stars n={career.shift.diff} /></div>
                </div>
              </div>

              {career.perk && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-400/30">
                  <div className="text-[10px] font-black tracking-widest text-sky-300 mb-0.5">社員特典</div>
                  <p className="text-[11px] text-gray-300">
                    {career.perk}
                    {career.key === 'BANKER' && <b className="text-emerald-300">（いま +{(bankerRateBonus(job) * 100).toFixed(2)}％／30分）</b>}
                    {career.key === 'CASINOSTAFF' && <b className="text-amber-300">（いま {Math.round(casinoStaffDiscount(job) * 100)}％引き）</b>}
                  </p>
                </div>
              )}

              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-gray-400">経験値 {fmt(job.exp || 0)}</span>
                  <span className="text-gray-500">{promo ? `${promo.rank.name} まで ${fmt(promo.left)}` : '最高位です'}</span>
                </div>
                <Bar value={job.exp || 0} max={promo ? promo.need : (job.exp || 1)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <GoldButton onClick={startShift} disabled={shiftLeft > 0} className="py-3">
                  {shiftLeft > 0 ? `休憩中 ${Math.ceil(shiftLeft / 1000)}s` : '出勤する'}
                </GoldButton>
                {promo && promo.left <= 0 ? (
                  <button onClick={startPromo} className="py-3 rounded-xl font-black bg-gradient-to-r from-sky-500 to-indigo-500 text-white flex items-center justify-center gap-1.5">
                    <TrendingUp size={16} />昇進試験
                  </button>
                ) : (
                  <button onClick={quitJob} className="py-3 rounded-xl font-black bg-white/10 hover:bg-white/20 text-gray-300 flex items-center justify-center gap-1.5">
                    <LogOut size={15} />退職する
                  </button>
                )}
              </div>
              {promo && promo.left <= 0 && (
                <button onClick={quitJob} className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-gray-500 hover:text-gray-300">退職する</button>
              )}

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">役職のはしご</div>
                <div className="flex flex-wrap gap-1">
                  {RANKS.map((r, i) => (
                    <span key={r.name}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                        ${i === job.rank ? 'bg-amber-400 text-black border-amber-300' : i < job.rank ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' : 'bg-black/40 text-gray-500 border-white/10'}`}>
                      {r.name}<span className="opacity-60"> ×{r.mult.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          ) : (
            <Panel className="p-4 text-center">
              <Award size={26} className="mx-auto text-gray-600 mb-1" />
              <p className="text-sm font-bold text-white">まだ就職していません</p>
              <p className="text-[11px] text-gray-500">資格をとって応募しましょう。採用されると給料と出勤手当が入ります。</p>
            </Panel>
          )}

          <div className="space-y-2">
            {CAREERS.map(c => {
              const chk = canApply(c, licenses, workExp, eduLevel);
              const mine = job?.key === c.key;
              const rec = jobRecord[c.key];
              return (
                <div key={c.key}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition
                    ${mine ? 'bg-amber-400/10 border-amber-400/50' : chk.ok ? 'bg-black/40 border-white/10' : 'bg-black/30 border-white/5 opacity-70'}`}>
                  <span className="text-2xl shrink-0">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold">{c.field}</span>
                      {mine && <span className="text-[10px] font-black text-amber-300">勤務中</span>}
                      {!mine && rec && (rec.rank > 0 || rec.exp > 0) && <span className="text-[10px] text-sky-300 font-bold">復職可（{rankOf(rec.rank).name}）</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{c.desc}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(c.req.length ? c.req : ['資格不要']).map(r => {
                        const l = licenseOf(r);
                        const ok = !l || licenses.includes(r);
                        return (
                          <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border
                            ${ok ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                            {l ? `${l.icon}${l.name}` : r}
                          </span>
                        );
                      })}
                      {c.minWorkExp > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border
                          ${workExp >= c.minWorkExp ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                          経験 {c.minWorkExp}
                        </span>
                      )}
                      {c.eduReq > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border
                          ${eduLevel >= c.eduReq ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                          🎓{EDU_LABEL[c.eduReq]}
                        </span>
                      )}
                      {c.volatile && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border text-amber-300 border-amber-400/30 bg-amber-500/10">💥 出来ばえで激変</span>}
                      {c.group && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border text-amber-200 border-amber-300/40 bg-amber-400/15">🌟 給料6倍・経験10倍</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-amber-300 text-sm">{fmt(c.salary)} G</div>
                    <div className="text-[9px] text-gray-500 mb-1">給料/{Math.round(PAY_INTERVAL / 60000)}分</div>
                    {!mine && (
                      <button onClick={() => startApply(c)} disabled={!chk.ok || !!job || busy}
                        className="px-3 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white text-[11px] font-black disabled:opacity-30">
                        応募 {fmt(applyFee(c))}G
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
