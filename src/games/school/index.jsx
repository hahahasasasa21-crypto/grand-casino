import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, GraduationCap, BookOpen, School, Clock, Lock, Check, Award, TrendingUp, Sparkles,
} from 'lucide-react';
import { Panel, GoldButton, SectionTitle, playSfx } from '../../shared/ui';
import { MiniGame } from '../work/minigames.jsx';
import { licenseOf } from '../work/jobs.js';
import { SUBJECTS, subjectOf, drawQuestions, hasPool } from './subjects.js';
import {
  HIGH_SCHOOLS, UNIVERSITIES, VOCATIONALS, ALL_SCHOOLS, schoolOf, kindLabel,
  curriculumOf, totalSteps, myDeviation, admissionLine, canEnroll, eduLevelOf, EDU_NAME,
  CRAM_COURSES, cramOf, prepBonusOf, RETRY_MS, EXAM_EVERY,
  entryFee, tuitionFee, entranceTask, recsOf, REC_LABEL, VIP_TUITION,
} from './schools.js';
import { careerOf, CAREERS } from '../work/jobs.js';

/* ==========================================================
   学校 — 入学・授業・テスト・卒業、そして塾
   ========================================================== */

const fmt = (n) => Math.round(n || 0).toLocaleString();
const KINDS = [
  { k: 'HIGH', label: '高校', list: HIGH_SCHOOLS, icon: <School size={15} /> },
  { k: 'UNI', label: '大学', list: UNIVERSITIES, icon: <GraduationCap size={15} /> },
  { k: 'VOC', label: '専門学校', list: VOCATIONALS, icon: <BookOpen size={15} /> },
];

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

function gpaOf(grades = {}) {
  const v = Object.values(grades);
  if (!v.length) return 0;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 5 * 10) / 10;   // 0〜5.0
}
function gradeLetter(gpa) {
  if (gpa >= 4.5) return { g: '秀', color: '#fbbf24' };
  if (gpa >= 4.0) return { g: '優', color: '#34d399' };
  if (gpa >= 3.0) return { g: '良', color: '#60a5fa' };
  if (gpa >= 2.0) return { g: '可', color: '#a3a3a3' };
  return { g: '不可', color: '#f87171' };
}

/* ---------- 結果カード ---------- */
function ResultCard({ data, onClose }) {
  return (
    <Panel gold className="p-6 text-center">
      <div className="text-[10px] font-black tracking-[0.35em] text-amber-200/70 mb-1">{data.headline}</div>
      <h3 className="text-2xl font-black text-white mb-3">{data.title}</h3>
      <div className="text-6xl font-black mb-1" style={{ color: data.color }}>{data.big}</div>
      <p className="text-[11px] text-gray-500 mb-4">{data.sub}</p>
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
export default function SchoolView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  edu = {}, licenses = [], items = {}, workExp = 0, saveEdu, onUseItem, vip = false,
}) {
  const [openRecs, setOpenRecs] = useState(null);
  const [tab, setTab] = useState('CAMPUS');    // CAMPUS | HIGH | UNI | VOC | CRAM
  const [task, setTask] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [backdoorConfirm, setBackdoorConfirm] = useState(null);
  const now = useNow(1000);
  const busyRef = useRef(false);

  const prep = edu.prep || {};
  const prepBonus = prepBonusOf(prep, items, now);
  const myDev = myDeviation(edu, licenses, prepBonus);
  const eduLevel = eduLevelOf(edu);
  const prepared = (edu.prepared || []).map(x => x.q || x);

  const save = useCallback(async (patch) => {
    try { await saveEdu(patch); } catch (e) { showToast('保存に失敗しました。', 'error'); }
  }, [saveEdu, showToast]);

  /** 在学中の学校（1つだけ） */
  const current = useMemo(() => {
    for (const k of ['hs', 'voc', 'uni']) {
      const rec = edu[k];
      if (rec && !rec.graduated) return { slot: k, rec, school: schoolOf(rec.key) };
    }
    return null;
  }, [edu]);

  const slotOf = (kind) => (kind === 'HIGH' ? 'hs' : kind === 'UNI' ? 'uni' : 'voc');

  /* ---------- 入試 ---------- */
  const startEntrance = async (school, backdoor = false) => {
    if (busyRef.current) return;
    const chk = canEnroll({ ...school }, edu, now, { backdoor });
    if (!chk.ok) { showToast(chk.reason, 'warning'); return; }

    if (backdoor) {
      const cost = school.backdoor;
      if (balance < cost) { showToast(`寄付金 ${fmt(cost)} G が足りません。`, 'error'); return; }
      busyRef.current = true; setBusy(true);
      try { await updateBalance(-cost); } catch (e) { busyRef.current = false; setBusy(false); return; }
      busyRef.current = false; setBusy(false);
      await enroll(school, true);
      setBackdoorConfirm(null);
      return;
    }

    const fee = entryFee(school, vip);
    if (balance < fee) { showToast(`入学金 ${fmt(fee)} G が足りません。`, 'error'); return; }
    busyRef.current = true; setBusy(true);
    try { await updateBalance(-fee); }
    catch (e) { busyRef.current = false; setBusy(false); return; }
    busyRef.current = false; setBusy(false);
    const line = admissionLine(school, myDev);
    const t = entranceTask(school);
    setTask({
      kind: 'ENTRANCE', school, line, ...t,
      title: `${school.name} 入学試験`,
      sub: `偏差値 ${school.dev}／あなた ${myDev}／合格ライン ${Math.round(line * 100)}％${t.game === 'FLASH' ? '／⚡フラッシュ暗算' : ''}`,
    });
  };

  const enroll = async (school, viaBackdoor = false) => {
    const slot = slotOf(school.kind);
    const t = Date.now();
    await save({
      [`edu.${slot}`]: {
        key: school.key, progress: 0, grades: {}, gpa: 0, graduated: false,
        enrolledAt: t, backdoor: !!viaBackdoor,
      },
    });
    playSfx('win');
    if (emitNews && (school.key === 'YUTA_UNI' || school.key === 'YUTA_HS' || school.key === 'BANK_UNI' || school.key === 'CASINO_UNI')) {
      emitNews(`${school.icon} ${playerName} が【${school.name}】に${viaBackdoor ? '入学（寄付金）' : '合格'}！`, 'jackpot');
    }
    setTab('CAMPUS');
  };

  const finishEntrance = async (school, line, perf) => {
    const passed = perf >= line;
    // 合格祈願のお守りは受けた時点で効果を終える（受かっても落ちても）
    if ((items.LUCKY_CHARM || 0) > 0 && onUseItem) {
      await onUseItem('LUCKY_CHARM');
      showToast('⛩️ 合格祈願のお守りは役目を終えました。', 'info');
    }
    if (passed) await enroll(school);
    else {
      await save({ [`edu.retryAt.${school.key}`]: Date.now() + RETRY_MS });
      playSfx('click');
    }
    setResult({
      headline: 'ENTRANCE EXAM', title: school.name,
      big: passed ? '合格' : '不合格', color: passed ? '#34d399' : '#f87171',
      sub: `得点 ${Math.round(perf * 100)}％ ／ 合格ライン ${Math.round(line * 100)}％`, ok: passed,
      lines: [
        { label: '学校の偏差値', value: `${school.dev}` },
        { label: 'あなたの偏差値', value: `${myDev}`, tone: myDev >= school.dev ? 'text-emerald-300' : 'text-red-300' },
        { label: '入学金', value: `-${fmt(entryFee(school, vip))} G`, tone: 'text-red-300' },
      ],
      note: passed
        ? `🎉 ${school.name} に入学しました！`
        : `不合格… 同じ学校は ${Math.round(RETRY_MS / 60000)} 分後に再受験できます。`,
    });
  };

  /* ---------- 授業とテスト ---------- */
  const startLesson = () => {
    if (!current) return;
    const { school, rec } = current;
    const plan = curriculumOf(school);
    const step = plan[rec.progress];
    if (!step) return;
    const tui = tuitionFee(school, vip);
    if (balance < tui) { showToast(`授業料 ${fmt(tui)} G が足りません。`, 'error'); return; }
    const subj = subjectOf(step.subject);
    const isExam = step.kind !== 'LESSON';
    setTask({
      kind: 'LESSON', school, step,
      game: subj.game, subject: step.subject,
      diff: Math.max(1, Math.min(5, Math.round((school.dev - 34) / 10) + (isExam ? 1 : 0))),
      title: `${school.name}・${isExam ? (step.kind === 'FINAL' ? '卒業試験' : '定期テスト') : '授業'}（${subj.name}）`,
      sub: `${rec.progress + 1} / ${totalSteps(school)}　授業料 ${fmt(tui)} G`,
      tuition: tui,
    });
  };

  const finishLesson = async (school, step, perf) => {
    const slot = slotOf(school.kind);
    const rec = edu[slot] || {};
    const isExam = step.kind !== 'LESSON';
    // 大学はアルバイトとは比べものにならない経験が入る
    const expBase = school.kind === 'UNI' ? 260 : school.kind === 'VOC' ? 150 : 90;
    const gainExp = Math.round(expBase * (0.4 + perf * 1.1));
    const gainStudy = Math.round((school.dev * 0.4) * (0.35 + perf));
    const progress = (rec.progress || 0) + 1;
    const grades = { ...(rec.grades || {}) };
    if (isExam) {
      const prevN = grades[`${step.subject}_n`] || 0;
      const prev = grades[step.subject] || 0;
      grades[step.subject] = Math.round(((prev * prevN + perf) / (prevN + 1)) * 1000) / 1000;
      grades[`${step.subject}_n`] = prevN + 1;
    }
    const cleanGrades = Object.fromEntries(Object.entries(grades).filter(([k]) => !k.endsWith('_n')));
    const gpa = gpaOf(cleanGrades);
    const done = progress >= totalSteps(school);

    const patch = {
      [`edu.${slot}.progress`]: progress,
      [`edu.${slot}.grades`]: grades,
      [`edu.${slot}.gpa`]: gpa,
      'edu.study': (edu.study || 0) + gainStudy,
      workExp: (workExp || 0) + gainExp,
    };
    if (done) {
      patch[`edu.${slot}.graduated`] = true;
      patch[`edu.${slot}.graduatedAt`] = Date.now();
      if (school.grant && !licenses.includes(school.grant)) patch.licenses = [...licenses, school.grant];
    }
    await save(patch);
    playSfx(perf >= 0.6 ? 'win' : 'click');

    if (done && emitNews) {
      emitNews(`${school.icon} ${playerName} が【${school.name}】を卒業（GPA ${gpa.toFixed(1)}）！`,
        school.key === 'YUTA_UNI' ? 'jackpot' : 'info');
    }

    const gl = gradeLetter(gpa);
    setResult({
      headline: done ? 'GRADUATION' : isExam ? 'EXAMINATION' : 'LESSON',
      title: done ? `${school.name} 卒業` : `${school.name}・${subjectOf(step.subject).name}`,
      big: done ? '卒業' : `${Math.round(perf * 100)}％`,
      color: done ? '#fbbf24' : perf >= 0.6 ? '#34d399' : '#f87171',
      sub: done ? `最終GPA ${gpa.toFixed(1)}（${gl.g}）` : isExam ? '定期テストの結果' : '今日の授業',
      ok: true,
      lines: [
        { label: '授業料', value: `-${fmt(tuitionFee(school, vip))} G`, tone: 'text-red-300' },
        { label: '通算経験', value: `+${gainExp}`, tone: 'text-emerald-300' },
        { label: '学力', value: `+${gainStudy}`, tone: 'text-sky-300' },
        { label: '進度', value: `${progress} / ${totalSteps(school)}` },
        ...(isExam ? [{ label: 'GPA', value: gpa.toFixed(1), tone: 'text-amber-300' }] : []),
      ],
      note: done
        ? (school.grant ? `🎉 卒業！ ${licenseOf(school.grant)?.name} を取得しました。` : '🎉 卒業おめでとう！')
        : '',
    });
  };

  /* ---------- 塾 ---------- */
  const takeCram = async (course, subject) => {
    if (busyRef.current) return;
    if (balance < course.cost) { showToast(`受講料 ${fmt(course.cost)} G が足りません。`, 'error'); return; }
    busyRef.current = true; setBusy(true);
    try { await updateBalance(-course.cost); }
    catch (e) { busyRef.current = false; setBusy(false); return; }
    const until = Date.now() + course.hours * 3600 * 1000;
    const nQ = course.key === 'STD' ? 4 : course.key === 'INTENSIVE' ? 8 : 0;
    const drawn = nQ > 0 && hasPool(subject)
      ? drawQuestions(subject, nQ, Math.floor(Date.now() / 60000))
      : [];
    await save({
      'edu.prep': { bonus: course.bonus, until, course: course.key },
      ...(drawn.length ? { 'edu.prepared': [...new Set([...(edu.prepared || []).slice(-20), ...drawn.map(d => d.q)])] } : {}),
    });
    busyRef.current = false; setBusy(false);
    playSfx('coin');
    setResult({
      headline: 'CRAM SCHOOL', title: course.name,
      big: `+${course.bonus}`, color: '#60a5fa',
      sub: `偏差値が ${course.hours} 時間のあいだ上がります`, ok: true,
      lines: [
        { label: '受講料', value: `-${fmt(course.cost)} G`, tone: 'text-red-300' },
        { label: '偏差値', value: `${myDev} → ${myDeviation(edu, licenses, prepBonusOf({ bonus: course.bonus, until }, items))}`, tone: 'text-emerald-300' },
        ...(drawn.length ? [{ label: '出そうな問題', value: `${drawn.length} 問`, tone: 'text-sky-300' }] : []),
      ],
      note: drawn.length
        ? `${subjectOf(subject).name} の出そうな問題を教わりました（必ず出るとは限りません）。`
        : '',
    });
  };

  /* ---------- 学歴ロンダリング ---------- */
  const launder = async (key, slot) => {
    if (busyRef.current) return;
    if ((items[key] || 0) <= 0) { showToast('持っていません。', 'warning'); return; }
    if (!edu[slot]) { showToast('消す学歴がありません。', 'warning'); return; }
    busyRef.current = true;
    try {
      const ok = await onUseItem(key);
      if (!ok) { showToast('使用に失敗しました。', 'error'); return; }
      const name = schoolOf(edu[slot].key)?.name || '学歴';
      await save({ [`edu.${slot}`]: null });
      playSfx('coin');
      showToast(`🧼 ${name} の学歴を消しました。受け直せます。`, 'success');
    } finally { busyRef.current = false; }
  };

  /* ---------- 赤本を使う ---------- */
  const useAkahon = async (key) => {
    if (busyRef.current) return;
    if ((items[key] || 0) <= 0) { showToast('持っていません。', 'warning'); return; }
    busyRef.current = true;
    try {
      const ok = await onUseItem(key);
      if (!ok) { showToast('使用に失敗しました。', 'error'); return; }
      const pool = ['JP', 'GRAM', 'HIST', 'ECON', 'SCI', 'PROG'];
      const subs = key === 'AKAHON_PRO' ? pool : pool.slice(0, 4);
      const per = key === 'AKAHON_PRO' ? 4 : 3;
      const got = [];
      subs.forEach((sk, i) => {
        drawQuestions(sk, per, Math.floor(Date.now() / 60000) + i * 977).forEach(d => got.push(d.q));
      });
      await save({ 'edu.prepared': [...new Set([...(edu.prepared || []).slice(-30), ...got])] });
      playSfx('coin');
      setResult({
        headline: 'STUDY', title: key === 'AKAHON_PRO' ? '最難関大 予想問題集' : '大学受験 赤本',
        big: `${got.length}問`, color: '#f87171',
        sub: '出そうな問題を読み込みました', ok: true,
        lines: [{ label: '対策した科目', value: `${subs.length} 科目`, tone: 'text-sky-300' }],
        note: '必ず出るとは限りません。試験中に「📖 対策した問題だ！」と出たら得点のチャンスです。',
      });
    } finally { busyRef.current = false; }
  };

  /* ---------- ミニゲームの終了 ---------- */
  const onDone = useCallback(async (perf) => {
    const t = task;
    setTask(null);
    if (!t) return;
    if (t.kind === 'ENTRANCE') return finishEntrance(t.school, t.line, perf);
    if (t.kind === 'LESSON') {
      try { await updateBalance(-t.tuition); } catch (e) { showToast('授業料が払えませんでした。', 'error'); return; }
      return finishLesson(t.school, t.step, perf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, edu, licenses, workExp]);

  const gameCtx = useMemo(() => ({
    subject: task?.subject, prepared,
    seed: task ? (task.school?.key || '').length * 7919 + (task.step?.i || 0) * 131 + Math.floor(Date.now() / 300000) : 0,
  }), [task, prepared]);

  /* ==================== 画面 ==================== */
  if (task) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <MiniGame game={task.game} diff={task.diff} title={task.title} sub={task.sub} ctx={gameCtx}
          onDone={onDone} onQuit={() => { setTask(null); showToast('中断しました。（お金は戻りません）', 'warning'); }} />
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
        <SectionTitle icon={<GraduationCap size={26} />} title="YUTAPON ACADEMY" sub="高校・大学・専門学校・塾" />
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">偏差値</div>
            <div className="text-xl font-black font-mono text-amber-300">{myDev}</div>
            {prepBonus > 0 && <div className="text-[9px] text-emerald-400 font-bold">塾 +{prepBonus}</div>}
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">学歴</div>
            <div className="text-[13px] font-black text-white">{EDU_NAME[eduLevel]}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">学力</div>
            <div className="text-[15px] font-black font-mono text-sky-300">{fmt(edu.study)}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">資格</div>
            <div className="text-[15px] font-black font-mono text-emerald-300">{licenses.length}</div>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          偏差値は「学力 ＋ 資格の数 ＋ 出身高校 ＋ 塾やお守り」で決まります。学校の偏差値を上回るほど合格ラインが下がります（下限あり）。
        </p>
      </Panel>

      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {[{ k: 'CAMPUS', label: '在学', icon: <School size={14} /> },
        ...KINDS.map(x => ({ k: x.k, label: x.label, icon: x.icon })),
        { k: 'CRAM', label: '塾', icon: <BookOpen size={14} /> }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`py-2.5 rounded-xl font-black text-[12px] border-2 transition flex items-center justify-center gap-1
              ${tab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ---------- 在学中 ---------- */}
      {tab === 'CAMPUS' && (
        <div className="space-y-3">
          {current ? (() => {
            const { school, rec } = current;
            const plan = curriculumOf(school);
            const step = plan[rec.progress];
            const gl = gradeLetter(rec.gpa || 0);
            return (
              <Panel gold className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{school.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black tracking-[0.25em] text-amber-200/70">{kindLabel[school.kind]}・偏差値 {school.dev}</div>
                    <div className="text-xl font-black text-white truncate">{school.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] text-gray-500 font-bold">GPA</div>
                    <div className="font-mono font-black text-lg" style={{ color: gl.color }}>{(rec.gpa || 0).toFixed(1)}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-gray-400">進度 {rec.progress} / {totalSteps(school)}</span>
                    <span className="text-gray-500">授業料 {fmt(tuitionFee(school, vip))} G / コマ</span>
                  </div>
                  <Bar value={rec.progress} max={totalSteps(school)} />
                </div>

                {/* 時間割 */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {plan.map((s, i) => {
                    const done = i < rec.progress;
                    const nowStep = i === rec.progress;
                    const sub = subjectOf(s.subject);
                    return (
                      <span key={i}
                        className={`text-[10px] font-black px-1.5 py-1 rounded-lg border transition
                          ${done ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                            : nowStep ? 'bg-amber-400 text-black border-amber-300'
                              : 'bg-black/40 text-gray-600 border-white/10'}`}>
                        {s.kind === 'FINAL' ? '🎓' : s.kind === 'EXAM' ? '📝' : sub.icon}{s.kind === 'LESSON' ? '' : ''}
                      </span>
                    );
                  })}
                </div>

                {step ? (
                  <>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 mb-3">
                      <div className="text-[10px] text-gray-500 font-black tracking-widest mb-0.5">つぎの授業</div>
                      <div className="text-base font-black text-white">
                        {subjectOf(step.subject).icon} {subjectOf(step.subject).name}
                        <span className="ml-2 text-[11px] font-bold" style={{ color: step.kind === 'FINAL' ? '#fbbf24' : step.kind === 'EXAM' ? '#f472b6' : '#94a3b8' }}>
                          {step.kind === 'FINAL' ? '卒業試験' : step.kind === 'EXAM' ? '定期テスト' : '通常授業'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {step.kind === 'LESSON' ? '学力と経験が入ります。' : 'この結果が GPA になります。'}
                      </div>
                    </div>
                    <GoldButton onClick={startLesson} disabled={balance < tuitionFee(school, vip)} className="w-full py-3.5 text-lg">
                      授業を受ける（{fmt(tuitionFee(school, vip))} G）
                    </GoldButton>
                  </>
                ) : (
                  <p className="text-center text-emerald-300 font-bold">全課程を修了しました。</p>
                )}

                {/* 成績表 */}
                {Object.keys(rec.grades || {}).some(k => !k.endsWith('_n')) && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">成績表</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(rec.grades).filter(([k]) => !k.endsWith('_n')).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-2 py-1 rounded-lg bg-black/40 border border-white/10">
                          <span className="text-[11px] text-gray-400">{subjectOf(k).icon}{subjectOf(k).name}</span>
                          <span className="font-mono text-[12px] font-black" style={{ color: subjectOf(k).color }}>{Math.round(v * 100)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            );
          })() : (
            <Panel className="p-6 text-center">
              <School size={26} className="mx-auto text-gray-600 mb-1" />
              <p className="text-sm font-bold text-white">いまは学校に通っていません</p>
              <p className="text-[11px] text-gray-500">高校 → 大学の順に進めます。専門学校は高校を出ていなくても入れます。</p>
            </Panel>
          )}

          {/* 学歴 */}
          <Panel className="p-4">
            <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">学歴</div>
            <div className="space-y-1.5">
              {[['hs', '高校'], ['voc', '専門学校'], ['uni', '大学']].map(([slot, label]) => {
                const r = edu[slot];
                const s = r ? schoolOf(r.key) : null;
                return (
                  <div key={slot} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                    <span className="text-[11px] font-black text-gray-500 w-16 shrink-0">{label}</span>
                    {s ? (
                      <>
                        <span className="text-lg">{s.icon}</span>
                        <span className="text-[13px] font-black text-white truncate">{s.name}</span>
                        {r.graduated
                          ? <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-black shrink-0">卒業 GPA {(r.gpa || 0).toFixed(1)}</span>
                          : <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">在学中</span>}
                        {r.backdoor && <span className="text-[10px] text-gray-600">（寄付入学）</span>}
                      </>
                    ) : <span className="text-[12px] text-gray-600">— なし</span>}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* ---------- 学校一覧 ---------- */}
      {['HIGH', 'UNI', 'VOC'].includes(tab) && (
        <div className="space-y-2">
          {tab === 'UNI' && !edu.hs?.graduated && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/30 text-[11px] font-bold text-red-300">
              大学を受験するには高校を卒業している必要があります。
            </div>
          )}
          {KINDS.find(x => x.k === tab).list.map(raw => {
            const school = { ...raw, kind: tab };
            const line = admissionLine(school, myDev);
            const chk = canEnroll(school, edu, now);
            const rec = edu[slotOf(tab)];
            const done = rec?.graduated && rec.key === school.key;
            const chance = myDev - school.dev;
            return (
              <div key={school.key}
                className={`p-3 rounded-2xl border transition
                  ${done ? 'bg-emerald-500/10 border-emerald-400/40' : chk.ok ? 'bg-black/40 border-white/10' : 'bg-black/30 border-white/5 opacity-75'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{school.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm">{school.name}</span>
                      {school.course && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-bold">{school.course}</span>}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border
                        ${chance >= 0 ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                        偏差値 {school.dev}
                      </span>
                      {done && <span className="text-[10px] font-black text-emerald-300 flex items-center gap-0.5"><Check size={11} />卒業</span>}
                    </div>
                    <p className="text-[11px] text-gray-500">{school.desc}</p>
                    {school.perk && <p className="text-[10px] text-sky-300/85 mt-0.5">✨ {school.perk}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {school.subjects.slice(0, 8).map(sk => (
                        <span key={sk} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-white/10"
                          style={{ color: subjectOf(sk).color }}>{subjectOf(sk).icon}{subjectOf(sk).name}</span>
                      ))}
                      {school.subjects.length > 8 && <span className="text-[9px] text-gray-500">＋{school.subjects.length - 8}</span>}
                    </div>
                    {school.flash && <p className="text-[10px] font-black text-amber-300 mt-0.5">⚡ 入試に フラッシュ暗算 が出ます（難度 ★{school.flash}）</p>}
                    {!chk.ok && !done && <p className="text-[10px] text-red-300 font-bold mt-1 flex items-center gap-1"><Lock size={9} />{chk.reason}</p>}
                    {recsOf(school).length > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); setOpenRecs(openRecs === school.key ? null : school.key); }}
                        className="mt-1 text-[10px] font-black text-sky-300 hover:text-sky-200">
                        🤝 推薦が来ている企業（{recsOf(school).length}）{openRecs === school.key ? ' ▲' : ' ▼'}
                      </button>
                    )}
                    {openRecs === school.key && (
                      <div className="mt-1.5 space-y-1">
                        {recsOf(school).map((r, i) => {
                          const c = careerOf(r.who) || null;
                          const who = c ? `${c.icon}${c.name}` : r.who === 'ALL' || r.all ? '🌟 すべての職種' : r.who;
                          return (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                              style={{ borderColor: r.label.color + '44', background: r.label.color + '12' }}>
                              <span className="text-[11px]">{r.label.icon}</span>
                              <span className="text-[10px] font-black text-white truncate flex-1">{who}</span>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: r.label.color }}>{r.label.name}</span>
                              {r.gpa && <span className="text-[9px] text-gray-400 shrink-0">GPA {r.gpa}+</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <div className="font-mono font-black text-amber-300 text-sm">{fmt(entryFee(school, vip))}</div>
                    <div className="text-[9px] text-gray-500">入学金{vip ? '（VIP 0.9倍）' : ''}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">授業 {fmt(tuitionFee(school, vip))}×{totalSteps(school)}</div>
                    <div className="text-[10px] font-black mt-0.5" style={{ color: line > 0.8 ? '#f87171' : line > 0.6 ? '#fbbf24' : '#34d399' }}>
                      合格 {Math.round(line * 100)}％
                    </div>
                    {!done && (
                      <button onClick={() => startEntrance(school)} disabled={!chk.ok || busy || balance < school.entry}
                        className="mt-1 w-full px-2 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-500 text-white text-[11px] font-black disabled:opacity-30">
                        受験する
                      </button>
                    )}
                    {school.backdoor && !done && canEnroll(school, edu, now, { backdoor: true }).ok && (
                      backdoorConfirm === school.key ? (
                        <button onClick={() => startEntrance(school, true)} disabled={busy || balance < school.backdoor}
                          className="mt-1 w-full px-2 py-1.5 rounded-xl bg-red-600 text-white text-[10px] font-black disabled:opacity-30">
                          本当に {fmt(school.backdoor)} G？
                        </button>
                      ) : (
                        <button onClick={() => setBackdoorConfirm(school.key)}
                          className="mt-1 w-full px-2 py-1.5 rounded-xl bg-amber-500/80 text-black text-[10px] font-black">
                          寄付金入学 {fmt(school.backdoor)}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- 塾 ---------- */}
      {tab === 'CRAM' && (
        <div className="space-y-3">
          <Panel className="p-4">
            <h3 className="text-sm font-black text-white mb-1 flex items-center gap-1.5"><Sparkles size={15} />YUTAPON ゼミナール</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              受講すると一定時間だけ偏差値が上がり、入試・テストの合格ラインが下がります。
              上のコースでは<b className="text-gray-300">出そうな問題</b>も教われます（必ず出るとは限りません）。
            </p>
            {prep.until > now && (
              <p className="text-[11px] font-bold text-emerald-300 mt-1.5">
                いま +{prep.bonus} が有効（あと {Math.ceil((prep.until - now) / 60000)} 分）
              </p>
            )}
          </Panel>
          {CRAM_COURSES.map(c => (
            <Panel key={c.key} className="p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white text-sm">{c.name}</div>
                  <div className="text-[11px] text-gray-500">{c.desc}</div>
                </div>
                <div className="font-mono font-black text-amber-300 text-sm shrink-0">{fmt(c.cost)} G</div>
              </div>
              {c.key === 'LIGHT' ? (
                <GoldButton onClick={() => takeCram(c, 'JP')} disabled={busy || balance < c.cost} className="w-full py-2 mt-2 text-sm">受講する</GoldButton>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
                  {['JP', 'GRAM', 'HIST', 'ECON', 'SCI', 'PROG'].map(sk => (
                    <button key={sk} onClick={() => takeCram(c, sk)} disabled={busy || balance < c.cost}
                      className="py-2 rounded-xl bg-black/50 border border-white/10 hover:border-amber-400/60 text-[11px] font-black text-white disabled:opacity-30">
                      {subjectOf(sk).icon}<span className="block text-[9px] text-gray-400">{subjectOf(sk).name}</span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          ))}
          {/* 学歴ロンダリング */}
          {((items.LAUNDER_HS || 0) > 0 || (items.LAUNDER_UNI || 0) > 0) && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">学歴ロンダリング</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[['LAUNDER_HS', 'hs', '🧼', '高校の学歴を消す'], ['LAUNDER_UNI', 'uni', '🧽', '大学の学歴を消す']].map(([k, slot, ic, label]) => (
                  <button key={k} onClick={() => launder(k, slot)} disabled={(items[k] || 0) <= 0 || !edu[slot]}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-amber-400/50 text-left disabled:opacity-30 transition">
                    <span className="text-xl">{ic}</span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-black text-white truncate">{label}</span>
                      <span className="block text-[10px] text-gray-500">
                        {edu[slot] ? `${schoolOf(edu[slot].key)?.name} を消去` : '対象なし'} ×{items[k] || 0}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {/* 道具 */}
          {((items.AKAHON || 0) > 0 || (items.AKAHON_PRO || 0) > 0 || (items.LUCKY_CHARM || 0) > 0) && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2">受験の道具</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[['AKAHON', '📕', '大学受験 赤本', '4科目ぶんの予想問題'],
                ['AKAHON_PRO', '📙', '最難関大 予想問題集', '全科目ぶんの予想問題']].map(([k, ic, nm, sub]) => (
                  <button key={k} onClick={() => useAkahon(k)} disabled={(items[k] || 0) <= 0}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-amber-400/50 text-left disabled:opacity-30 transition">
                    <span className="text-xl">{ic}</span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-black text-white truncate">{nm}</span>
                      <span className="block text-[10px] text-gray-500">{sub} ×{items[k] || 0}</span>
                    </span>
                  </button>
                ))}
                {(items.LUCKY_CHARM || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30">
                    <span className="text-xl">⛩️</span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-black text-amber-200">合格祈願のお守り</span>
                      <span className="block text-[10px] text-gray-400">持っているだけで 偏差値 +2</span>
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {prepared.length > 0 && (
            <Panel className="p-3">
              <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">対策した問題（{prepared.length}）</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {prepared.slice(-12).map((q, i) => <div key={i} className="text-[11px] text-gray-400">📖 {q}</div>)}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
