import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { ArrowLeft, GraduationCap, Clock, BookOpen, Award, RefreshCw, CheckCircle2 } from 'lucide-react';
import { appId } from './firebaseConfig';

/* ==========================================================
   学園システム（実時間の出席 → 履修充足で定期テスト）
   ・1コマ = 実時間 CLASS_SECONDS 秒。最後まで在席で満額、途中退出は半額。
   ・各科目の必要コマ数を満たすと定期テストが解禁される。
   ・テストは問題を解く形式ではなく、蓄積した学力で自動採点される。
   ========================================================== */

const CLASS_SECONDS = 120;          // 1コマの実時間（秒）
const CLASSES_PER_SUBJECT = 2;      // 1学期あたり各科目に必要なコマ数
const PASS_LINE = 60;               // 進級に必要な平均点

const STAGES = [
  {
    key: 'HIGH',
    label: '私立グランド高等学校',
    short: '高校',
    terms: 3,
    accent: 'text-sky-300',
    ring: 'border-sky-500/40',
    glow: 'from-sky-900/60 to-slate-950',
    stipend: 300,            // 1コマごとの奨学金
    examReward: 20000,       // 満点時のテスト報酬
    gainPerClass: 6,
    subjects: [
      { key: 'jp', name: '国語', emoji: '📖', topics: ['係り結びの法則と已然形', '漢文の再読文字「未」「将」', '芥川龍之介『羅生門』の下人の心理', '和歌の枕詞と序詞の違い'] },
      { key: 'math', name: '数学', emoji: '📐', topics: ['二次関数の平方完成と頂点', '三角比の相互関係 sin²θ+cos²θ=1', '確率の加法定理と余事象', '数列の漸化式と一般項'] },
      { key: 'en', name: '英語', emoji: '🔤', topics: ['仮定法過去完了 If I had known...', '関係代名詞 what の用法', '分詞構文における意味上の主語', '現在完了進行形と継続用法'] },
      { key: 'sci', name: '理科', emoji: '🔬', topics: ['運動量保存則と反発係数', 'モル濃度と質量パーセント濃度', '細胞分裂における減数分裂の意義', 'オームの法則と合成抵抗'] },
      { key: 'soc', name: '社会', emoji: '🗺️', topics: ['大化の改新と公地公民制', '需要曲線のシフト要因', '三権分立と違憲立法審査権', '産業革命とエンクロージャー'] },
    ],
  },
  {
    key: 'UNIV',
    label: 'グランド大学 経済学部',
    short: '大学',
    terms: 4,
    accent: 'text-amber-300',
    ring: 'border-amber-500/40',
    glow: 'from-amber-900/60 to-yellow-950',
    stipend: 900,
    examReward: 70000,
    gainPerClass: 5,
    subjects: [
      { key: 'micro', name: 'ミクロ経済学', emoji: '📉', topics: ['限界効用逓減の法則', '無差別曲線と予算制約線', '完全競争市場の均衡条件', '外部不経済とピグー税'] },
      { key: 'macro', name: 'マクロ経済学', emoji: '📈', topics: ['IS-LM分析と財政政策の効果', '乗数効果と限界消費性向', 'フィリップス曲線とスタグフレーション', 'GDPデフレーターと実質成長率'] },
      { key: 'stat', name: '統計学', emoji: '🎲', topics: ['大数の法則と中心極限定理', '帰無仮説と第一種の過誤', '最小二乗法と決定係数R²', 'ベイズの定理と事後確率'] },
      { key: 'fin', name: 'ファイナンス', emoji: '🏦', topics: ['現在価値と割引率', 'ポートフォリオ理論と分散投資', 'CAPMとベータ値', 'ブラック・ショールズ式の考え方'] },
      { key: 'law', name: '商法', emoji: '⚖️', topics: ['株式会社の機関設計', '善管注意義務と忠実義務', '手形の裏書と善意取得', 'インサイダー取引規制'] },
    ],
  },
];

const stageByKey = k => STAGES.find(s => s.key === k) || STAGES[0];

const GRADE_TABLE = [
  { min: 90, label: 'S', color: 'text-amber-300', word: '首席級' },
  { min: 80, label: 'A', color: 'text-emerald-300', word: '優' },
  { min: 70, label: 'B', color: 'text-sky-300', word: '良' },
  { min: 60, label: 'C', color: 'text-yellow-300', word: '可' },
  { min: 0,  label: 'D', color: 'text-red-400', word: '不可' },
];
const gradeOf = score => GRADE_TABLE.find(g => score >= g.min);

const emptyRecord = () => ({
  stageKey: 'HIGH',
  term: 1,
  classesDone: {},   // { subjectKey: コマ数 }
  ability: {},       // { subjectKey: 0-100 }
  history: [],       // 受験履歴
  graduated: [],     // 卒業した stageKey
});

function Panel({ children, className = '', gold = false }) {
  return (
    <div className={`relative rounded-3xl border ${gold ? 'border-amber-500/40' : 'border-white/10'} bg-[#0b1512]/90 backdrop-blur-sm shadow-2xl shadow-black/60 ${className}`}>
      {gold && <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-amber-300/10" />}
      {children}
    </div>
  );
}

function GoldButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-[#241a04] font-black rounded-xl shadow-lg shadow-amber-900/40 border border-amber-200/60 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 ${className}`}
    >
      {children}
    </button>
  );
}

export default function SchoolView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const db = useMemo(() => getFirestore(getApp()), []);
  const playerRef = useMemo(
    () => doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(playerName)),
    [db, playerName]
  );

  const [record, setRecord] = useState(null);
  const [view, setView] = useState('CAMPUS');     // CAMPUS | CLASS | EXAM
  const [activeSubject, setActiveSubject] = useState(null);
  const [remaining, setRemaining] = useState(CLASS_SECONDS);
  const [topicIdx, setTopicIdx] = useState(0);
  const [examResult, setExamResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const classStartRef = useRef(0);
  const awardedRef = useRef(false);
  const subjectRef = useRef(null);
  const recordRef = useRef(null);
  const mountedRef = useRef(true);

  recordRef.current = record;
  subjectRef.current = activeSubject;

  // 学籍データ購読
  useEffect(() => {
    if (!playerName) return;
    const unsub = onSnapshot(playerRef, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setRecord({ ...emptyRecord(), ...(d.school || {}) });
    });
    return () => unsub();
  }, [playerRef, playerName]);

  const stage = stageByKey(record?.stageKey);
  const subjects = stage.subjects;

  const abilityOf = useCallback(k => Math.min(100, Math.round(record?.ability?.[k] || 0)), [record]);
  const doneOf = useCallback(k => record?.classesDone?.[k] || 0, [record]);

  const requiredPerSubject = CLASSES_PER_SUBJECT * (record?.term || 1);
  const totalRequired = requiredPerSubject * subjects.length;
  const totalDone = subjects.reduce((a, s) => a + Math.min(doneOf(s.key), requiredPerSubject), 0);
  const examUnlocked = totalDone >= totalRequired;
  const overallAbility = subjects.length
    ? Math.round(subjects.reduce((a, s) => a + abilityOf(s.key), 0) / subjects.length)
    : 0;

  const saveRecord = useCallback(async (patch) => {
    const base = recordRef.current || emptyRecord();
    const next = { ...base, ...patch };
    await updateDoc(playerRef, { school: next });
    return next;
  }, [playerRef]);

  /* ---------- 授業 ---------- */

  const awardClass = useCallback(async (ratio) => {
    const subject = subjectRef.current;
    const base = recordRef.current;
    if (!subject || !base || awardedRef.current) return;
    awardedRef.current = true;

    const st = stageByKey(base.stageKey);
    const cur = base.ability?.[subject.key] || 0;
    // 学力は100に近づくほど伸びにくい
    const gain = st.gainPerClass * ratio * (1 - cur / 130);
    const nextAbility = Math.min(100, Math.round((cur + gain) * 10) / 10);
    const nextDone = (base.classesDone?.[subject.key] || 0) + (ratio >= 1 ? 1 : 0);
    const stipend = Math.floor(st.stipend * ratio);

    try {
      await saveRecord({
        ability: { ...(base.ability || {}), [subject.key]: nextAbility },
        classesDone: { ...(base.classesDone || {}), [subject.key]: nextDone },
      });
      if (stipend > 0) await updateBalance(stipend);
    } catch (e) { /* noop */ }

    if (!mountedRef.current) return;
    if (ratio >= 1) {
      showToast(`🎓 ${subject.name}を1コマ受講！学力 +${(nextAbility - cur).toFixed(1)} ／ 奨学金 +${stipend.toLocaleString()} G`, 'success');
    } else {
      showToast(`🚪 途中退出。学力 +${(nextAbility - cur).toFixed(1)} ／ 奨学金 +${stipend.toLocaleString()} G`, 'warning');
    }
  }, [saveRecord, updateBalance, showToast]);

  const startClass = (subject) => {
    if (doneOf(subject.key) >= requiredPerSubject) {
      showToast(`${subject.name}は今学期の必要コマ数を満たしています。`, 'info');
      return;
    }
    setActiveSubject(subject);
    subjectRef.current = subject;
    awardedRef.current = false;
    classStartRef.current = Date.now();
    setRemaining(CLASS_SECONDS);
    setTopicIdx(0);
    setView('CLASS');
  };

  // 授業タイマー（開始時刻から算出するのでタブ制限の影響を受けにくい）
  useEffect(() => {
    if (view !== 'CLASS') return;
    const tick = setInterval(() => {
      const elapsed = (Date.now() - classStartRef.current) / 1000;
      const left = Math.max(0, CLASS_SECONDS - elapsed);
      setRemaining(left);
      setTopicIdx(Math.min(3, Math.floor((elapsed / CLASS_SECONDS) * 4)));
      if (left <= 0) {
        clearInterval(tick);
        awardClass(1).then(() => {
          if (mountedRef.current) { setView('CAMPUS'); setActiveSubject(null); }
        });
      }
    }, 250);
    return () => clearInterval(tick);
  }, [view, awardClass]);

  const leaveClass = () => {
    const elapsed = (Date.now() - classStartRef.current) / 1000;
    const ratio = Math.max(0, Math.min(1, elapsed / CLASS_SECONDS)) * 0.5;
    awardClass(ratio).then(() => {
      if (mountedRef.current) { setView('CAMPUS'); setActiveSubject(null); }
    });
  };

  // 画面離脱時も半額で精算
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (subjectRef.current && !awardedRef.current && classStartRef.current) {
        const elapsed = (Date.now() - classStartRef.current) / 1000;
        if (elapsed > 3) {
          const ratio = Math.max(0, Math.min(1, elapsed / CLASS_SECONDS)) * 0.5;
          awardClass(ratio);
        }
      }
    };
  }, [awardClass]);

  /* ---------- 定期テスト ---------- */

  const takeExam = async () => {
    if (!examUnlocked || busy) return;
    setBusy(true);
    const base = recordRef.current;
    const st = stageByKey(base.stageKey);

    // 学力をもとに自動採点。当日の調子で ±12 点ぶれる。
    const scores = subjects.map(s => {
      const ability = base.ability?.[s.key] || 0;
      const condition = (Math.random() * 24) - 12;
      const raw = ability * 0.95 + 8 + condition;
      return { ...s, score: Math.max(0, Math.min(100, Math.round(raw))) };
    });
    const avg = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
    const passed = avg >= PASS_LINE;
    const reward = Math.floor(st.examReward * Math.pow(avg / 100, 1.8));
    const isFinalTerm = base.term >= st.terms;
    const graduating = passed && isFinalTerm;

    const entry = {
      stageKey: st.key, term: base.term, avg,
      scores: scores.map(s => ({ key: s.key, name: s.name, score: s.score })),
      reward, at: Date.now(),
    };

    let patch = { history: [entry, ...(base.history || [])].slice(0, 20) };

    if (passed) {
      if (graduating) {
        const nextStageIdx = STAGES.findIndex(x => x.key === st.key) + 1;
        const nextStage = STAGES[nextStageIdx];
        patch = {
          ...patch,
          graduated: [...new Set([...(base.graduated || []), st.key])],
          stageKey: nextStage ? nextStage.key : st.key,
          term: 1,
          classesDone: {},
          ability: nextStage ? {} : base.ability,
        };
      } else {
        patch = { ...patch, term: base.term + 1 };
      }
    } else {
      // 不合格は留年。履修はリセットされ、もう一度受け直し。
      patch = { ...patch, classesDone: {} };
    }

    try {
      await saveRecord(patch);
      if (reward > 0) await updateBalance(reward);
    } catch (e) { /* noop */ }

    if (graduating) {
      emitNews(`🎓 ${playerName} が${st.label}を平均${avg}点で卒業！`, 'success');
    } else if (avg >= 90) {
      emitNews(`📚 ${playerName} が${st.short}の定期テストで平均${avg}点を叩き出した！`, 'success');
    }

    if (mountedRef.current) {
      setExamResult({ scores, avg, reward, passed, graduating, stage: st, term: base.term });
      setView('EXAM');
    }
    setBusy(false);
  };

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-white">
        <RefreshCw className="animate-spin text-amber-400 mb-4" size={40} />
        <p className="font-bold tracking-widest text-sm">学籍情報を照会中...</p>
      </div>
    );
  }

  /* ---------- 授業画面 ---------- */
  if (view === 'CLASS' && activeSubject) {
    const progress = ((CLASS_SECONDS - remaining) / CLASS_SECONDS) * 100;
    const mm = Math.floor(remaining / 60);
    const ss = Math.floor(remaining % 60).toString().padStart(2, '0');
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          <button onClick={leaveClass} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
            <ArrowLeft size={18} /> 途中退出（学力は半分）
          </button>
          <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">
            {balance.toLocaleString()} G
          </div>
        </div>

        {/* 黒板 */}
        <div className="relative rounded-2xl border-[14px] border-[#6b4f2a] shadow-2xl shadow-black/70 overflow-hidden"
          style={{ background: 'linear-gradient(160deg,#14452f 0%,#0d3322 60%,#0a2a1c 100%)' }}>
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)'
          }} />
          <div className="relative p-6 md:p-10 min-h-[22rem] flex flex-col">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/15">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeSubject.emoji}</span>
                <div>
                  <div className="text-white/50 text-[11px] font-bold tracking-[0.3em]">{stage.short} {record.term}学期</div>
                  <div className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'serif' }}>{activeSubject.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white/50 text-[11px] font-bold tracking-widest">残り時間</div>
                <div className={`font-mono text-3xl font-black ${remaining <= 15 ? 'text-amber-300 animate-pulse' : 'text-white'}`}>{mm}:{ss}</div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {activeSubject.topics.map((t, i) => (
                <div key={i}
                  className={`flex items-start gap-3 transition-all duration-700 ${i <= topicIdx ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}>
                  <span className="text-amber-200/70 font-black shrink-0">{i + 1}.</span>
                  <span className="text-lg md:text-xl text-white/90" style={{ fontFamily: 'serif' }}>{t}</span>
                  {i < topicIdx && <CheckCircle2 size={16} className="text-emerald-400/70 mt-1.5 shrink-0" />}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all duration-200"
                  style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-white/40 text-[11px] font-bold mt-3 tracking-widest">
                最後まで在席すると学力と奨学金が満額もらえます
              </p>
            </div>
          </div>
        </div>

        <Panel className="mt-5 p-4 flex justify-around text-center">
          <div>
            <div className="text-[10px] text-gray-500 font-bold tracking-widest">現在の学力</div>
            <div className="text-xl font-black text-sky-300 font-mono">{abilityOf(activeSubject.key)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold tracking-widest">履修状況</div>
            <div className="text-xl font-black text-white font-mono">{doneOf(activeSubject.key)} / {requiredPerSubject}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold tracking-widest">完走時の奨学金</div>
            <div className="text-xl font-black text-emerald-300 font-mono">+{stage.stipend.toLocaleString()}</div>
          </div>
        </Panel>
      </div>
    );
  }

  /* ---------- テスト結果画面 ---------- */
  if (view === 'EXAM' && examResult) {
    const g = gradeOf(examResult.avg);
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <Panel gold className="p-6 md:p-10">
          <div className="text-center mb-6 pb-6 border-b border-white/10">
            <p className="text-[11px] tracking-[0.4em] text-amber-200/60 font-bold mb-2">EXAMINATION RESULT</p>
            <h2 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'serif' }}>
              {examResult.stage.label}
            </h2>
            <p className="text-gray-400 text-sm font-bold">{examResult.term}学期 定期試験</p>
          </div>

          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">平均点</div>
              <div className="text-6xl font-black text-white font-mono">{examResult.avg}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">評定</div>
              <div className={`text-6xl font-black ${g.color}`}>{g.label}</div>
              <div className={`text-xs font-bold ${g.color}`}>{g.word}</div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {examResult.scores.map(s => {
              const sg = gradeOf(s.score);
              return (
                <div key={s.key} className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                  <span className="text-xl">{s.emoji}</span>
                  <span className="flex-1 font-bold text-white text-sm">{s.name}</span>
                  <div className="w-28 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${s.score}%` }} />
                  </div>
                  <span className="font-mono font-black text-white w-10 text-right">{s.score}</span>
                  <span className={`font-black w-5 text-center ${sg.color}`}>{sg.label}</span>
                </div>
              );
            })}
          </div>

          <div className={`p-5 rounded-2xl border-2 text-center mb-6 ${examResult.passed ? 'border-amber-400 bg-amber-500/10' : 'border-red-500/50 bg-red-500/5'}`}>
            <div className="text-2xl font-black mb-1">
              {examResult.graduating ? '🎓 卒業！' : examResult.passed ? '✅ 進級決定' : '📉 留年...'}
            </div>
            <p className="text-sm text-gray-400 mb-2">
              {examResult.graduating ? '次の学校へ進学できます。'
                : examResult.passed ? '次の学期へ進みます。必要コマ数が増えます。'
                : `平均${PASS_LINE}点未満のため留年です。履修はリセットされました。`}
            </p>
            <div className="text-3xl font-black text-emerald-400">+{examResult.reward.toLocaleString()} G</div>
          </div>

          <GoldButton onClick={() => { setExamResult(null); setView('CAMPUS'); }} className="w-full py-4 text-lg">
            キャンパスに戻る
          </GoldButton>
        </Panel>
      </div>
    );
  }

  /* ---------- キャンパス（一覧）---------- */
  const lastExam = record.history?.[0];
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft size={20} /> メニューに戻る
        </button>
        <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">
          {balance.toLocaleString()} G
        </div>
      </div>

      {/* 学籍票 */}
      <Panel gold className="p-6 md:p-8 mb-5">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${stage.glow} border ${stage.ring} shrink-0`}>
            <GraduationCap size={40} className={stage.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] tracking-[0.4em] text-amber-200/50 font-bold mb-1">STUDENT REGISTER</p>
            <h2 className="text-2xl md:text-3xl font-black text-white truncate" style={{ fontFamily: 'serif' }}>{stage.label}</h2>
            <p className="text-gray-400 text-sm font-bold">
              {playerName} ／ {record.term}学期（全{stage.terms}学期）
              {record.graduated?.length > 0 && (
                <span className="ml-2 text-[11px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black">
                  {record.graduated.map(k => stageByKey(k).short).join('・')}卒
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">総合学力</div>
              <div className="text-3xl font-black text-sky-300 font-mono">{overallAbility}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">履修</div>
              <div className="text-3xl font-black text-white font-mono">{totalDone}<span className="text-base text-gray-500">/{totalRequired}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[11px] text-gray-400 font-bold mb-1">
            <span>今学期の履修進捗</span>
            <span>{Math.round((totalDone / totalRequired) * 100)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-300 transition-all"
              style={{ width: `${(totalDone / totalRequired) * 100}%` }} />
          </div>
        </div>

        <div className="mt-5">
          {examUnlocked ? (
            <GoldButton onClick={takeExam} disabled={busy} className="w-full py-4 text-lg flex items-center justify-center gap-2">
              <Award size={20} /> {record.term}学期 定期試験を受ける
            </GoldButton>
          ) : (
            <div className="w-full py-4 rounded-xl bg-black/40 border border-white/10 text-center">
              <span className="text-gray-500 font-bold text-sm">
                あと <span className="text-white font-black">{totalRequired - totalDone}</span> コマ受講すると定期試験が解禁されます
              </span>
            </div>
          )}
        </div>
      </Panel>

      {/* 時間割 */}
      <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">Time Table</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {subjects.map(s => {
          const done = doneOf(s.key);
          const full = done >= requiredPerSubject;
          const ab = abilityOf(s.key);
          return (
            <button key={s.key} onClick={() => startClass(s)} disabled={full}
              className={`group text-left p-5 rounded-2xl border-2 transition-all ${full
                ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default'
                : 'border-white/10 bg-black/40 hover:border-amber-400/50 hover:-translate-y-0.5'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white text-lg">{s.name}</div>
                  <div className="text-[11px] text-gray-500 font-bold">1コマ {CLASS_SECONDS / 60} 分 ／ 奨学金 {stage.stipend.toLocaleString()} G</div>
                </div>
                {full
                  ? <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-1 rounded-full">履修済</span>
                  : <span className="text-[10px] bg-white/10 text-gray-300 font-black px-2 py-1 rounded-full group-hover:bg-amber-400 group-hover:text-black transition">受講する</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-1">
                    <span>学力</span><span className="font-mono text-sky-300">{ab}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${ab}%` }} />
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {Array(requiredPerSubject).fill(0).map((_, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < done ? 'bg-amber-400' : 'bg-white/15'}`} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 成績表 */}
      {record.history?.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <BookOpen size={16} className="text-sky-400" />
            <span className="text-sky-300 font-black text-sm tracking-[0.2em]">成績表</span>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {record.history.map((h, i) => {
              const hg = gradeOf(h.avg);
              const hs = stageByKey(h.stageKey);
              return (
                <div key={i} className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/10 text-sm">
                  <div className="min-w-0">
                    <span className="text-white font-bold">{hs.short} {h.term}学期</span>
                    <span className="text-gray-600 text-[11px] ml-2">
                      {new Date(h.at).getMonth() + 1}/{new Date(h.at).getDate()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono font-black text-white">{h.avg}点</span>
                    <span className={`font-black ${hg.color}`}>{hg.label}</span>
                    <span className="font-mono text-emerald-400 text-xs">+{(h.reward || 0).toLocaleString()}G</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <p className="text-center text-gray-600 text-[11px] mt-5 leading-relaxed">
        授業は実時間で進行します。最後まで在席すると学力と奨学金が満額、途中退出は半額です。<br />
        定期試験は問題を解くのではなく、積み上げた学力から自動採点されます。平均{PASS_LINE}点未満は留年。
      </p>
    </div>
  );
}
