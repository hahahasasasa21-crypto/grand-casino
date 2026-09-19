import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { Panel, GoldButton, playSfx } from '../../shared/ui';
import { GAMES, gameOf } from './jobs.js';
import { drawQuestions, subjectOf } from '../school/subjects.js';

/* ==========================================================
   仕事のミニゲーム
   どれも「出来ばえ perf（0〜1）」を返す。報酬はそれに比例する。
   ========================================================== */

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1);[b[i], b[j]] = [b[j], b[i]]; } return b; };
const clampDiff = (d) => Math.max(1, Math.min(5, d || 1));

/* ---------- 共通の枠 ---------- */
function Shell({ title, sub, icon, step, steps, timeLeft, timeMax, children, onQuit, accent = '#fbbf24' }) {
  const pct = timeMax > 0 ? Math.max(0, Math.min(100, (timeLeft / timeMax) * 100)) : 0;
  return (
    <Panel className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-white truncate">{title}</div>
          {sub && <div className="text-[11px] text-gray-500 truncate">{sub}</div>}
        </div>
        {steps > 0 && <span className="text-[11px] font-mono font-bold text-gray-400 shrink-0">{Math.min(step + 1, steps)} / {steps}</span>}
        {onQuit && (
          <button onClick={onQuit} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 shrink-0" title="やめる"><X size={14} /></button>
        )}
      </div>
      {timeMax > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <Clock size={12} className={pct < 30 ? 'text-red-400' : 'text-gray-500'} />
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-200"
              style={{ width: `${pct}%`, background: pct < 30 ? '#f87171' : accent }} />
          </div>
          <span className={`font-mono text-[11px] font-black w-9 text-right ${pct < 30 ? 'text-red-400' : 'text-gray-400'}`}>
            {(timeLeft / 1000).toFixed(1)}
          </span>
        </div>
      )}
      {children}
    </Panel>
  );
}

/** ms 単位のカウントダウン。key が変わるとリセット */
function useCountdown(ms, running, onEnd, key) {
  const [left, setLeft] = useState(ms);
  const endRef = useRef(0);
  const cbRef = useRef(onEnd);
  useEffect(() => { cbRef.current = onEnd; }, [onEnd]);
  useEffect(() => {
    if (!running) { setLeft(ms); return; }
    endRef.current = Date.now() + ms;
    setLeft(ms);
    const iv = setInterval(() => {
      const l = endRef.current - Date.now();
      if (l <= 0) { clearInterval(iv); setLeft(0); cbRef.current && cbRef.current(); }
      else setLeft(l);
    }, 90);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, ms]);
  return left;
}

/* ==========================================================
   1. 英単語
   ========================================================== */
const WORDS = {
  1: [['apple', 'りんご'], ['book', '本'], ['cat', 'ねこ'], ['dog', 'いぬ'], ['egg', 'たまご'], ['fish', 'さかな'],
  ['gold', 'きん'], ['hat', 'ぼうし'], ['ice', 'こおり'], ['key', 'かぎ'], ['milk', 'ぎゅうにゅう'], ['rain', 'あめ'],
  ['star', 'ほし'], ['tree', 'き'], ['water', 'みず'], ['bird', 'とり']],
  2: [['mountain', 'やま'], ['river', 'かわ'], ['school', 'がっこう'], ['doctor', 'いしゃ'], ['flower', 'はな'],
  ['garden', 'にわ'], ['island', 'しま'], ['journey', 'たび'], ['kitchen', 'だいどころ'], ['mirror', 'かがみ'],
  ['bridge', 'はし'], ['market', 'いちば'], ['ticket', 'きっぷ'], ['weather', 'てんき'], ['forest', 'もり']],
  3: [['hospital', 'びょういん'], ['library', 'としょかん'], ['machine', 'きかい'], ['neighbor', 'となりびと'],
  ['opinion', 'いけん'], ['passenger', 'じょうきゃく'], ['question', 'しつもん'], ['research', 'けんきゅう'],
  ['schedule', 'よてい'], ['treasure', 'たからもの'], ['umbrella', 'かさ'], ['village', 'むら'], ['carpenter', 'だいく']],
  4: [['democracy', 'みんしゅしゅぎ'], ['philosophy', 'てつがく'], ['algorithm', 'アルゴリズム'],
  ['experience', 'けいけん'], ['government', 'せいふ'], ['individual', 'こじん'], ['literature', 'ぶんがく'],
  ['negotiate', 'こうしょうする'], ['permanent', 'えいきゅうの'], ['revolution', 'かくめい'], ['technology', 'ぎじゅつ']],
  5: [['archaeology', 'こうこがく'], ['bureaucracy', 'かんりょうせい'], ['entrepreneur', 'きぎょうか'],
  ['infrastructure', 'インフラ'], ['jurisdiction', 'かんかつ'], ['pharmaceutical', 'せいやくの'],
  ['constitutional', 'けんぽうじょうの'], ['unprecedented', 'ぜんれいのない'], ['sophisticated', 'せんれんされた'],
  ['acknowledgment', 'しょうにん']],
};

function WordGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const ROUNDS = 5;
  const perQ = 13000 - d * 1000;
  const qs = useMemo(() => shuffle(WORDS[d]).slice(0, ROUNDS), [d]);
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);
  const inputRef = useRef(null);

  const next = useCallback((correct) => {
    if (lock.current) return;
    lock.current = true;
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    setTimeout(() => {
      setFb(null); setVal('');
      if (i + 1 >= ROUNDS) onFinish(okRef.current / ROUNDS);
      else { setI(i + 1); lock.current = false; }
    }, 700);
  }, [i, onFinish]);

  const left = useCountdown(perQ, !fb, () => next(false), i);
  useEffect(() => { inputRef.current?.focus(); }, [i]);
  const q = qs[i];
  if (!q) return null;

  return shell({
    step: i, steps: ROUNDS, timeLeft: left, timeMax: perQ,
    body: (
      <>
        <div className={`rounded-2xl border-2 p-6 text-center mb-3 transition
          ${fb === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : fb === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <p className="text-[10px] text-gray-500 font-bold tracking-[0.3em] mb-2">日本語 → 英語</p>
          <p className="text-3xl md:text-4xl font-black text-white">{q[1]}</p>
          {fb && <p className={`mt-3 font-black ${fb === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {fb === 'ok' ? '✅ 正解！' : `❌ 正解は ${q[0]}`}</p>}
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} disabled={!!fb}
            onKeyDown={e => { if (e.key === 'Enter' && !fb) next(val.trim().toLowerCase() === q[0]); }}
            placeholder="英単語を入力して Enter" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
            className="flex-1 min-w-0 bg-black/60 text-white font-mono text-lg p-3 rounded-xl border-2 border-white/10 focus:border-amber-400 outline-none disabled:opacity-50" />
          <GoldButton onClick={() => !fb && next(val.trim().toLowerCase() === q[0])} disabled={!!fb} className="px-5">回答</GoldButton>
        </div>
      </>
    ),
  });
}

/* ==========================================================
   2. タイピング
   ========================================================== */
const PHRASES = {
  1: ['cash flow', 'open the door', 'good morning', 'thank you', 'new order'],
  2: ['please check the invoice', 'the meeting starts at ten', 'send me the report', 'we need more boxes'],
  3: ['the quick brown fox jumps over', 'please confirm the delivery date', 'our team finished the project'],
  4: ['the customer requested a full refund yesterday', 'all documents must be filed before the deadline'],
  5: ['an unexpected error occurred while processing your recent transaction request',
    'the quarterly financial statement requires approval from the board of directors'],
};

function TypingGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const ROUNDS = 3;
  const rounds = useMemo(() => Array.from({ length: ROUNDS }, () => pick(PHRASES[d])), [d]);
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState(null);
  const scores = useRef([]);
  const lock = useRef(false);
  const inputRef = useRef(null);
  const target = rounds[i] || '';
  const limit = Math.max(6000, Math.round((target.length / (2.0 + d * 0.45)) * 1000));

  const accuracy = (typed, goal) => {
    let ok = 0;
    for (let k = 0; k < goal.length; k++) if (typed[k] === goal[k]) ok++;
    const over = Math.max(0, typed.length - goal.length);
    return Math.max(0, (ok - over * 0.5) / goal.length);
  };

  const next = useCallback((typed) => {
    if (lock.current) return;
    lock.current = true;
    const s = accuracy(typed, target);
    scores.current.push(s);
    setFb(s >= 0.99 ? 'ok' : s >= 0.7 ? 'mid' : 'ng');
    playSfx(s >= 0.7 ? 'coin' : 'click');
    setTimeout(() => {
      setFb(null); setVal('');
      if (i + 1 >= ROUNDS) onFinish(scores.current.reduce((a, b) => a + b, 0) / ROUNDS);
      else { setI(i + 1); lock.current = false; }
    }, 750);
  }, [i, target, onFinish]);

  const left = useCountdown(limit, !fb, () => next(inputRef.current?.value || ''), i);
  useEffect(() => { inputRef.current?.focus(); }, [i]);

  return shell({
    step: i, steps: ROUNDS, timeLeft: left, timeMax: limit,
    body: (
      <>
        <div className={`rounded-2xl border-2 p-4 mb-3 transition
          ${fb === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : fb === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <p className="text-[10px] text-gray-500 font-bold tracking-[0.3em] mb-2">そのまま打つ</p>
          <p className="font-mono text-lg md:text-xl leading-relaxed break-all">
            {target.split('').map((ch, k) => {
              const typed = val[k];
              const cls = typed == null ? 'text-gray-500' : typed === ch ? 'text-emerald-300' : 'text-red-400 bg-red-500/20';
              return <span key={k} className={cls}>{ch === ' ' ? ' ' : ch}</span>;
            })}
          </p>
        </div>
        <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} disabled={!!fb}
          onKeyDown={e => { if (e.key === 'Enter' && !fb) next(val); }}
          placeholder="ここに入力（Enterで確定）" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
          className="w-full bg-black/60 text-white font-mono text-base p-3 rounded-xl border-2 border-white/10 focus:border-amber-400 outline-none disabled:opacity-50" />
      </>
    ),
  });
}

/* ==========================================================
   3. 暗算
   ========================================================== */
function makeCalc(d) {
  const a = (lo, hi) => lo + rnd(hi - lo + 1);
  if (d === 1) { const x = a(1, 20), y = a(1, 20); return { q: `${x} + ${y}`, ans: x + y }; }
  if (d === 2) {
    if (rnd(2)) { const x = a(11, 99), y = a(11, 99); return { q: `${x} + ${y}`, ans: x + y }; }
    const x = a(30, 99), y = a(1, 29); return { q: `${x} − ${y}`, ans: x - y };
  }
  if (d === 3) {
    if (rnd(2)) { const x = a(2, 9), y = a(11, 49); return { q: `${x} × ${y}`, ans: x * y }; }
    const total = a(230, 980), paid = Math.ceil(total / 100) * 100 + a(0, 3) * 100;
    return { q: `${total}円の会計に ${paid}円。おつりは？`, ans: paid - total };
  }
  if (d === 4) {
    if (rnd(2)) { const x = a(12, 39), y = a(12, 39); return { q: `${x} × ${y}`, ans: x * y }; }
    const p = pick([5, 10, 20, 25, 50]), base = a(4, 40) * 100;
    return { q: `${base}円の ${p}％ は？`, ans: Math.round(base * p / 100) };
  }
  if (rnd(2)) { const x = a(6, 19), y = a(6, 19), z = a(2, 9); return { q: `(${x} + ${y}) × ${z}`, ans: (x + y) * z }; }
  const base = a(8, 60) * 100, off = pick([15, 30, 35, 40, 60]);
  return { q: `${base}円の ${off}％引きは？`, ans: Math.round(base * (100 - off) / 100) };
}

function CalcGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const ROUNDS = 6;
  const qs = useMemo(() => Array.from({ length: ROUNDS }, () => makeCalc(d)), [d]);
  const perQ = 15000 - d * 1200;
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);
  const inputRef = useRef(null);

  const next = useCallback((raw) => {
    if (lock.current) return;
    lock.current = true;
    const correct = Number(raw) === qs[i].ans && String(raw).trim() !== '';
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    setTimeout(() => {
      setFb(null); setVal('');
      if (i + 1 >= ROUNDS) onFinish(okRef.current / ROUNDS);
      else { setI(i + 1); lock.current = false; }
    }, 650);
  }, [i, qs, onFinish]);

  const left = useCountdown(perQ, !fb, () => next(''), i);
  useEffect(() => { inputRef.current?.focus(); }, [i]);

  return shell({
    step: i, steps: ROUNDS, timeLeft: left, timeMax: perQ,
    body: (
      <>
        <div className={`rounded-2xl border-2 p-6 text-center mb-3 transition
          ${fb === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : fb === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <p className="text-2xl md:text-3xl font-black text-white font-mono">{qs[i].q}</p>
          {fb && <p className={`mt-2 font-black ${fb === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {fb === 'ok' ? '✅ 正解！' : `❌ 正解は ${qs[i].ans.toLocaleString()}`}</p>}
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="number" inputMode="numeric" value={val} onChange={e => setVal(e.target.value)} disabled={!!fb}
            onKeyDown={e => { if (e.key === 'Enter' && !fb) next(val); }}
            placeholder="答えを入力して Enter"
            className="flex-1 min-w-0 bg-black/60 text-white font-mono text-lg p-3 rounded-xl border-2 border-white/10 focus:border-amber-400 outline-none disabled:opacity-50" />
          <GoldButton onClick={() => !fb && next(val)} disabled={!!fb} className="px-5">回答</GoldButton>
        </div>
      </>
    ),
  });
}

/* ==========================================================
   4. 記憶
   ========================================================== */
const MEM_POOL = ['🍎', '🍌', '🍇', '🍓', '🍑', '🥝', '🍍', '🥑', '🌶️', '🥕', '🧀', '🍞'];

function MemoryGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const ROUNDS = 3;
  const N = 3 + d;
  const showMs = 1000 + N * 430;
  const answerMs = 4000 + N * 1600;

  const [round, setRound] = useState(0);
  const [stage, setStage] = useState('SHOW');   // SHOW | INPUT | FB
  const [seq, setSeq] = useState([]);
  const [palette, setPalette] = useState([]);
  const [got, setGot] = useState([]);
  const scores = useRef([]);
  const lock = useRef(false);

  const deal = useCallback(() => {
    const p = shuffle(MEM_POOL).slice(0, Math.min(MEM_POOL.length, N + 3));
    const s = Array.from({ length: N }, () => pick(p));
    setSeq(s); setPalette(shuffle(p)); setGot([]); setStage('SHOW');
    lock.current = false;
  }, [N]);

  useEffect(() => { deal(); }, [deal, round]);
  useEffect(() => {
    if (stage !== 'SHOW') return;
    const t = setTimeout(() => setStage('INPUT'), showMs);
    return () => clearTimeout(t);
  }, [stage, showMs, round]);

  const settle = useCallback((answer) => {
    if (lock.current) return;
    lock.current = true;
    let ok = 0;
    for (let k = 0; k < seq.length; k++) { if (answer[k] === seq[k]) ok++; else break; }
    scores.current.push(ok / seq.length);
    setStage('FB');
    playSfx(ok === seq.length ? 'coin' : 'click');
    setTimeout(() => {
      if (round + 1 >= ROUNDS) onFinish(scores.current.reduce((a, b) => a + b, 0) / ROUNDS);
      else setRound(round + 1);
    }, 1000);
  }, [seq, round, onFinish]);

  const left = useCountdown(answerMs, stage === 'INPUT', () => settle(got), `${round}-${stage}`);

  const tap = (sym) => {
    if (stage !== 'INPUT') return;
    const n = [...got, sym];
    setGot(n);
    playSfx('click');
    if (n.length >= seq.length) settle(n);
  };

  return shell({
    step: round, steps: ROUNDS, timeLeft: stage === 'INPUT' ? left : answerMs, timeMax: answerMs,
    body: (
      <>
        <div className="rounded-2xl border-2 border-white/10 bg-black/40 p-5 mb-3 min-h-[104px] flex flex-col items-center justify-center">
          {stage === 'SHOW' && (
            <>
              <p className="text-[10px] text-amber-300 font-black tracking-[0.3em] mb-2">おぼえて！</p>
              <div className="flex flex-wrap justify-center gap-2">
                {seq.map((s, k) => <span key={k} className="text-3xl md:text-4xl">{s}</span>)}
              </div>
            </>
          )}
          {stage === 'INPUT' && (
            <>
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] mb-2">同じ順に押す</p>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: seq.length }).map((_, k) => (
                  <span key={k} className="w-10 h-10 rounded-xl border border-white/15 bg-black/50 flex items-center justify-center text-2xl">
                    {got[k] || ''}
                  </span>
                ))}
              </div>
            </>
          )}
          {stage === 'FB' && (
            <>
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] mb-2">正解</p>
              <div className="flex flex-wrap justify-center gap-2">
                {seq.map((s, k) => (
                  <span key={k} className={`text-3xl ${got[k] === s ? '' : 'opacity-40 grayscale'}`}>{s}</span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {palette.map((s, k) => (
            <button key={k} onClick={() => tap(s)} disabled={stage !== 'INPUT'}
              className="aspect-square rounded-xl bg-black/50 border border-white/10 hover:border-amber-400/60 text-2xl disabled:opacity-30 transition">
              {s}
            </button>
          ))}
        </div>
      </>
    ),
  });
}

/* ==========================================================
   5. 仕分け
   ========================================================== */
const SORT_CATS = [
  { name: '食べ物', icon: '🍱', items: ['🍎', '🍌', '🍇', '🍞', '🧀', '🍙', '🍜', '🍰', '🥕', '🍓'] },
  { name: '道具', icon: '🧰', items: ['🔧', '🔨', '🪛', '🪚', '📏', '✂️', '🔩', '🪝', '🧲', '⚙️'] },
  { name: '生き物', icon: '🐾', items: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐸', '🐤', '🐢', '🦁'] },
  { name: '乗り物', icon: '🚏', items: ['🚗', '🚕', '🚌', '🚓', '🚑', '🚚', '🚲', '🛵', '🚂', '✈️'] },
];

function SortGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const nCats = d <= 2 ? 2 : d <= 4 ? 3 : 4;
  const total = 10 + d * 2;
  const limit = Math.round(total * (1550 - d * 110));

  const cats = useMemo(() => shuffle(SORT_CATS).slice(0, nCats), [nCats]);
  const queue = useMemo(() => {
    const q = [];
    for (let k = 0; k < total; k++) {
      const ci = rnd(cats.length);
      q.push({ sym: pick(cats[ci].items), ci });
    }
    return q;
  }, [cats, total]);

  const [i, setI] = useState(0);
  const [flash, setFlash] = useState(null);
  const okRef = useRef(0);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish(okRef.current / total);
  }, [onFinish, total]);

  const left = useCountdown(limit, true, finish, 'sort');

  const answer = (ci) => {
    if (i >= queue.length || done.current) return;
    const ok = queue[i].ci === ci;
    if (ok) okRef.current += 1;
    setFlash(ok ? 'ok' : 'ng');
    playSfx(ok ? 'coin' : 'click');
    setTimeout(() => setFlash(null), 160);
    if (i + 1 >= queue.length) { setI(i + 1); finish(); }
    else setI(i + 1);
  };

  const cur = queue[i];
  return shell({
    step: i, steps: total, timeLeft: left, timeMax: limit,
    body: (
      <>
        <div className={`rounded-2xl border-2 p-6 mb-3 flex items-center justify-center min-h-[120px] transition
          ${flash === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : flash === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <span className="text-6xl md:text-7xl">{cur ? cur.sym : '✅'}</span>
        </div>
        <div className={`grid gap-2 ${nCats === 2 ? 'grid-cols-2' : nCats === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {cats.map((c, ci) => (
            <button key={c.name} onClick={() => answer(ci)} disabled={!cur}
              className="py-3 rounded-xl bg-black/50 border border-white/10 hover:border-amber-400/60 text-white font-black text-sm disabled:opacity-30 transition">
              <span className="block text-xl leading-none mb-1">{c.icon}</span>{c.name}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 text-center mt-2">正解 {okRef.current} / {total}</p>
      </>
    ),
  });
}

/* ==========================================================
   6. 検品（ひとつだけ違う色）
   ========================================================== */
function InspectGame({ diff, onFinish, shell, ctx }) {
  const d = clampDiff(diff);
  const ROUNDS = ctx?.rounds || 5;
  const cols = ctx?.cols || (d <= 2 ? 4 : d <= 4 ? 5 : 6);
  const cells = cols * cols;
  const delta = 17 - d * 2.6;
  const perR = 6400 - d * 500;

  const [round, setRound] = useState(0);
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);

  const board = useMemo(() => {
    const hue = rnd(360), sat = 52 + rnd(22), lig = 42 + rnd(14);
    return { odd: rnd(cells), base: `hsl(${hue} ${sat}% ${lig}%)`, alt: `hsl(${hue} ${sat}% ${lig + delta}%)` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, cells, delta]);

  const next = useCallback((correct) => {
    if (lock.current) return;
    lock.current = true;
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    setTimeout(() => {
      setFb(null);
      if (round + 1 >= ROUNDS) onFinish(okRef.current / ROUNDS);
      else { setRound(round + 1); lock.current = false; }
    }, 520);
  }, [round, onFinish]);

  const left = useCountdown(perR, !fb, () => next(false), round);

  return shell({
    step: round, steps: ROUNDS, timeLeft: left, timeMax: perR,
    body: (
      <>
        <p className="text-[11px] text-gray-500 text-center mb-2">ひとつだけ色が違う不良品を見つける</p>
        <div className="grid gap-1.5 mx-auto max-w-sm" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cells }).map((_, k) => (
            <button key={k} onClick={() => next(k === board.odd)} disabled={!!fb}
              className={`aspect-square rounded-lg border transition ${fb && k === board.odd ? 'border-white ring-2 ring-white' : 'border-black/30'}`}
              style={{ background: k === board.odd ? board.alt : board.base }} />
          ))}
        </div>
        <p className={`text-center font-black mt-2 h-5 ${fb === 'ok' ? 'text-emerald-400' : fb === 'ng' ? 'text-red-400' : 'text-transparent'}`}>
          {fb === 'ok' ? '✅ 発見！' : fb === 'ng' ? '❌ 見逃し' : '.'}
        </p>
      </>
    ),
  });
}


/* ==========================================================
   7. 融資審査（YUTAPON-BANK の仕事）
   実際にこのサイトで遊んでいる人の信用スコアと借入を見て判断する
   ========================================================== */
export const LOAN_RULE = { minCredit: 60, limitPerCredit: 1000 };

/** 審査の正解。表に出ている数字だけで必ず決まる */
export function loanVerdict(app) {
  if (app.delinquent) return false;
  if (app.credit < LOAN_RULE.minCredit) return false;
  return app.loan + app.want <= app.credit * LOAN_RULE.limitPerCredit;
}

const FAKE_NAMES = ['たけし', 'さくら', 'ケンジ', 'ゆかり', 'ハヤト', 'みなみ', 'リョウ', 'あおい', 'ダイキ', 'なつき'];
const PURPOSES = ['スロットの軍資金', '事業の運転資金', '馬券の購入', '引っ越し費用', '株の買い増し', '設備の入れ替え', '結婚資金', 'VIP券の購入'];

function makeApplications(n, diff, players) {
  const real = (players || []).filter(p => p && p.name).slice(0, 12);
  const out = [];
  for (let i = 0; i < n; i++) {
    const src = real.length ? real[(i * 3 + rnd(real.length)) % real.length] : null;
    const name = src ? src.name : pick(FAKE_NAMES);
    // 半分くらいは「承認が正解」になるように希望額を作る
    const credit = src ? Math.max(0, Math.round(src.creditScore ?? 100)) : 30 + rnd(150);
    const loan = src ? Math.max(0, Math.round(src.loanBalance || 0)) : rnd(4) === 0 ? rnd(60000) : 0;
    const limit = credit * LOAN_RULE.limitPerCredit;
    const room = Math.max(0, limit - loan);
    const wantOk = room > 1000 ? Math.max(1000, Math.round(room * (0.35 + Math.random() * 0.5))) : 0;
    const wantNg = Math.round((room > 0 ? room : limit) + 5000 + rnd(80000));
    const shouldPass = Math.random() < 0.5 && wantOk > 0 && credit >= LOAN_RULE.minCredit;
    const app = {
      name, credit, loan,
      deposit: src ? Math.max(0, Math.round(src.bankBalance || 0)) : rnd(200000),
      want: shouldPass ? wantOk : wantNg,
      purpose: pick(PURPOSES),
      delinquent: !shouldPass && Math.random() < 0.18 - diff * 0.01,
      real: !!src,
    };
    out.push(app);
  }
  return out;
}

function LoanGame({ diff, onFinish, shell, ctx }) {
  const d = clampDiff(diff);
  const ROUNDS = 6;
  const perQ = 13000 - d * 1100;
  const apps = useMemo(() => makeApplications(ROUNDS, d, ctx?.players), [d, ctx]);
  const [i, setI] = useState(0);
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);

  const decide = useCallback((approve) => {
    if (lock.current) return;
    lock.current = true;
    const right = loanVerdict(apps[i]);
    const correct = approve === right;
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    if (ctx?.onReview) ctx.onReview(correct, approve, apps[i]);
    setTimeout(() => {
      setFb(null);
      if (i + 1 >= ROUNDS) onFinish(okRef.current / ROUNDS);
      else { setI(i + 1); lock.current = false; }
    }, 900);
  }, [i, apps, onFinish, ctx]);

  const left = useCountdown(perQ, !fb, () => decide(false), i);
  const a = apps[i];
  if (!a) return null;
  const limit = a.credit * LOAN_RULE.limitPerCredit;
  const after = a.loan + a.want;

  return shell({
    step: i, steps: ROUNDS, timeLeft: left, timeMax: perQ,
    body: (
      <>
        <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 mb-2">
          <div className="text-[10px] font-black tracking-widest text-sky-300 mb-0.5">審査基準</div>
          <p className="text-[11px] text-gray-300 leading-snug">
            ①延滞していないこと　②信用スコア <b className="text-white">{LOAN_RULE.minCredit} 以上</b>　
            ③<b className="text-white">借入残高＋希望額 ≦ 信用スコア×{LOAN_RULE.limitPerCredit.toLocaleString()}</b>
          </p>
        </div>
        <div className={`rounded-2xl border-2 p-4 mb-3 transition
          ${fb === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : fb === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧾</span>
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500 font-bold tracking-widest">融資申込書</div>
              <div className="text-lg font-black text-white truncate">
                {a.name} <span className="text-[11px] text-gray-500 font-bold">様</span>
                {a.real && <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">実在の顧客</span>}
              </div>
            </div>
            {a.delinquent && <span className="ml-auto text-[10px] font-black px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-400/40">延滞あり</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[9px] text-gray-500 font-bold">信用スコア</div>
              <div className={`font-mono font-black ${a.credit >= LOAN_RULE.minCredit ? 'text-emerald-300' : 'text-red-300'}`}>{a.credit}</div>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[9px] text-gray-500 font-bold">借入上限</div>
              <div className="font-mono font-black text-gray-300">{limit.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[9px] text-gray-500 font-bold">現在の借入</div>
              <div className="font-mono font-black text-gray-300">{a.loan.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-white/10">
              <div className="text-[9px] text-gray-500 font-bold">預金残高</div>
              <div className="font-mono font-black text-gray-300">{a.deposit.toLocaleString()}</div>
            </div>
            <div className="col-span-2 p-2 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <div className="text-[9px] text-amber-200/70 font-bold">希望額（用途：{a.purpose}）</div>
              <div className="font-mono font-black text-amber-300 text-lg">{a.want.toLocaleString()} G</div>
              <div className="text-[10px] text-gray-500">貸したあとの残高 {after.toLocaleString()} / 上限 {limit.toLocaleString()}</div>
            </div>
          </div>
          {fb && (
            <p className={`mt-2 text-center font-black ${fb === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {fb === 'ok' ? '✅ 正しい判断' : `❌ 正解は「${loanVerdict(a) ? '承認' : '謝絶'}」`}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => decide(true)} disabled={!!fb}
            className="py-3 rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">承認する</button>
          <button onClick={() => decide(false)} disabled={!!fb}
            className="py-3 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white border border-white/10 disabled:opacity-40">謝絶する</button>
        </div>
      </>
    ),
  });
}

/* ==========================================================
   8. 不正検知（YUTAPON-CASINO の仕事）
   配当 ＝ 賭け金 × 倍率 になっていない記録をひとつ見つける
   ========================================================== */
const CASINO_GAMES = ['スロット', 'ナンバールーレット', '赤と黒', 'ブラックジャック', '競馬・単勝', '競馬・三連単', '人生ゲーム'];

function makeLedger(diff) {
  const rows = 4 + Math.min(2, Math.floor(diff / 2));
  const out = [];
  for (let k = 0; k < rows; k++) {
    const bet = (1 + rnd(40)) * 100;
    const mult = pick([1.5, 2, 2.5, 3, 4, 5, 8, 10, 12, 20]);
    out.push({ game: pick(CASINO_GAMES), bet, mult, payout: Math.round(bet * mult), bad: false });
  }
  const bad = rnd(out.length);
  const r = out[bad];
  // 難しいほど「ズレ」が小さい
  const gapPct = 0.30 - diff * 0.045;
  const gap = Math.max(100, Math.round(r.payout * gapPct / 100) * 100);
  r.payout += (rnd(2) ? gap : -gap);
  if (r.payout < 0) r.payout = Math.round(r.bet * r.mult) + gap;
  r.bad = true;
  return out;
}

function FraudGame({ diff, onFinish, shell, ctx }) {
  const d = clampDiff(diff);
  const ROUNDS = 5;
  const perR = 13000 - d * 1000;
  const [round, setRound] = useState(0);
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ledger = useMemo(() => makeLedger(d), [round, d]);

  const next = useCallback((correct) => {
    if (lock.current) return;
    lock.current = true;
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    if (ctx?.onAudit) ctx.onAudit(correct);
    setTimeout(() => {
      setFb(null);
      if (round + 1 >= ROUNDS) onFinish(okRef.current / ROUNDS);
      else { setRound(round + 1); lock.current = false; }
    }, 800);
  }, [round, onFinish, ctx]);

  const left = useCountdown(perR, !fb, () => next(false), round);

  return shell({
    step: round, steps: ROUNDS, timeLeft: left, timeMax: perR,
    body: (
      <>
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 mb-2">
          <div className="text-[10px] font-black tracking-widest text-amber-300 mb-0.5">監査基準</div>
          <p className="text-[11px] text-gray-300">配当 ＝ 賭け金 × 倍率。合っていない行がちょうど1つあります。</p>
        </div>
        <div className="space-y-1.5">
          {ledger.map((r, k) => (
            <button key={k} onClick={() => next(r.bad)} disabled={!!fb}
              className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left transition disabled:cursor-default
                ${fb && r.bad ? 'border-emerald-400 bg-emerald-500/15' : 'border-white/10 bg-black/40 hover:border-amber-400/50'}`}>
              <span className="text-[11px] font-bold text-gray-300 w-28 shrink-0 truncate">{r.game}</span>
              <span className="text-[11px] font-mono text-gray-400 shrink-0">{r.bet.toLocaleString()}G</span>
              <span className="text-[11px] font-mono text-sky-300 shrink-0">×{r.mult}</span>
              <span className="ml-auto text-[13px] font-mono font-black text-amber-300 shrink-0">{r.payout.toLocaleString()}G</span>
            </button>
          ))}
        </div>
        <p className={`text-center font-black mt-2 h-5 ${fb === 'ok' ? 'text-emerald-400' : fb === 'ng' ? 'text-red-400' : 'text-transparent'}`}>
          {fb === 'ok' ? '✅ 摘発！' : fb === 'ng' ? '❌ 見逃し' : '.'}
        </p>
      </>
    ),
  });
}


/* ==========================================================
   9. 筆記試験（4択）— 学校の授業・テスト・入試に使う
   ========================================================== */
function ChoiceGame({ diff, onFinish, shell, ctx }) {
  const d = clampDiff(diff);
  const subject = ctx?.subject || 'JP';
  const ROUNDS = Math.min(6, Math.max(4, 4 + Math.floor(d / 2)));
  const perQ = 17000 - d * 1500;
  const prepared = ctx?.prepared || [];

  const qs = useMemo(() => {
    const drawn = drawQuestions(subject, ROUNDS, ctx?.seed || Math.floor(Math.random() * 1e9));
    return drawn.map((row, k) => {
      const opts = shuffle(row.a.map((text, i) => ({ text, ok: i === 0 })));
      return { q: row.q, opts, ok: row.a[0] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, ROUNDS, ctx?.seed]);

  const [i, setI] = useState(0);
  const [fb, setFb] = useState(null);
  const okRef = useRef(0);
  const lock = useRef(false);

  const next = useCallback((correct) => {
    if (lock.current) return;
    lock.current = true;
    if (correct) okRef.current += 1;
    setFb(correct ? 'ok' : 'ng');
    playSfx(correct ? 'coin' : 'click');
    setTimeout(() => {
      setFb(null);
      if (i + 1 >= qs.length) onFinish(okRef.current / Math.max(1, qs.length));
      else { setI(i + 1); lock.current = false; }
    }, 850);
  }, [i, qs.length, onFinish]);

  const left = useCountdown(perQ, !fb, () => next(false), i);
  const cur = qs[i];
  if (!cur) return null;
  const studied = prepared.includes(cur.q);

  return shell({
    step: i, steps: qs.length, timeLeft: left, timeMax: perQ,
    body: (
      <>
        <div className={`rounded-2xl border-2 p-4 mb-3 transition
          ${fb === 'ok' ? 'border-emerald-500 bg-emerald-500/10' : fb === 'ng' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-black/40'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: subjectOf(subject).color + '22', color: subjectOf(subject).color }}>
              {subjectOf(subject).icon} {subjectOf(subject).name}
            </span>
            {studied && <span className="text-[10px] font-black text-amber-300">📖 対策した問題だ！</span>}
          </div>
          <p className="text-base md:text-lg font-bold text-white leading-snug">{cur.q}</p>
          {fb && <p className={`mt-2 font-black ${fb === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {fb === 'ok' ? '✅ 正解！' : `❌ 正解は「${cur.ok}」`}</p>}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {cur.opts.map((o, k) => (
            <button key={k} onClick={() => next(o.ok)} disabled={!!fb}
              className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition disabled:cursor-default
                ${fb && o.ok ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 bg-black/40 text-gray-200 hover:border-amber-400/60'}`}>
              <span className="inline-block w-5 text-gray-500 font-black">{'ABCD'[k]}</span>{o.text}
            </button>
          ))}
        </div>
      </>
    ),
  });
}


/* ==========================================================
   10. フラッシュ暗算 — 難関校の入試で出る
   数字が一瞬ずつ光る。全部足した答えを入力する。
   ========================================================== */
function FlashGame({ diff, onFinish, shell, ctx }) {
  const d = clampDiff(diff);
  const ROUNDS = 3;
  const count = 3 + d;                       // 出る数字の個数
  const digits = d <= 2 ? 1 : d <= 4 ? 2 : 3; // 桁数
  const flashMs = Math.max(220, 900 - d * 130);
  const answerMs = 9000 + d * 500;

  const [round, setRound] = useState(0);
  const [stage, setStage] = useState('FLASH');   // FLASH | INPUT | FB
  const [shown, setShown] = useState(-1);
  const [val, setVal] = useState('');
  const scores = useRef([]);
  const lock = useRef(false);
  const inputRef = useRef(null);

  const nums = useMemo(() => {
    const lo = Math.pow(10, digits - 1), hi = Math.pow(10, digits) - 1;
    return Array.from({ length: count }, () => lo + rnd(hi - lo + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, count, digits]);
  const sum = useMemo(() => nums.reduce((a, b) => a + b, 0), [nums]);

  // 1つずつ光らせる
  useEffect(() => {
    if (stage !== 'FLASH') return;
    let i = 0;
    setShown(0);
    const iv = setInterval(() => {
      i += 1;
      if (i >= nums.length) { clearInterval(iv); setShown(-1); setStage('INPUT'); }
      else setShown(i);
    }, flashMs);
    return () => clearInterval(iv);
  }, [stage, nums, flashMs]);

  useEffect(() => { if (stage === 'INPUT') setTimeout(() => inputRef.current?.focus(), 30); }, [stage]);

  const settle = useCallback((raw) => {
    if (lock.current) return;
    lock.current = true;
    const ok = Number(raw) === sum && String(raw).trim() !== '';
    scores.current.push(ok ? 1 : 0);
    setStage('FB');
    playSfx(ok ? 'coin' : 'click');
    setTimeout(() => {
      setVal(''); lock.current = false;
      if (round + 1 >= ROUNDS) onFinish(scores.current.reduce((a, b) => a + b, 0) / ROUNDS);
      else { setRound(round + 1); setStage('FLASH'); }
    }, 1100);
  }, [sum, round, onFinish]);

  const left = useCountdown(answerMs, stage === 'INPUT', () => settle(''), `${round}-${stage}`);

  return shell({
    step: round, steps: ROUNDS, timeLeft: stage === 'INPUT' ? left : answerMs, timeMax: answerMs,
    body: (
      <>
        <div className="rounded-2xl border-2 border-white/10 bg-black/60 mb-3 flex flex-col items-center justify-center"
          style={{ minHeight: 150 }}>
          {stage === 'FLASH' && (
            <>
              <p className="text-[10px] text-amber-300 font-black tracking-[0.3em] mb-1">たし算していく</p>
              <div className="font-mono font-black text-white leading-none" style={{ fontSize: 68 }}>
                {shown >= 0 ? nums[shown] : ''}
              </div>
              <div className="flex gap-1 mt-3">
                {nums.map((_, k) => (
                  <span key={k} className={`w-2 h-2 rounded-full ${k <= shown ? 'bg-amber-400' : 'bg-white/15'}`} />
                ))}
              </div>
            </>
          )}
          {stage === 'INPUT' && (
            <>
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] mb-2">合計は？</p>
              <div className="font-mono font-black text-gray-700 leading-none" style={{ fontSize: 56 }}>？</div>
            </>
          )}
          {stage === 'FB' && (
            <>
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] mb-1">正解</p>
              <div className="font-mono font-black text-emerald-300 leading-none" style={{ fontSize: 52 }}>{sum}</div>
              <p className="text-[11px] text-gray-500 mt-2">{nums.join(' ＋ ')}</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="number" inputMode="numeric" value={val} disabled={stage !== 'INPUT'}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && stage === 'INPUT') settle(val); }}
            placeholder={stage === 'FLASH' ? '見て覚える…' : '合計を入力して Enter'}
            className="flex-1 min-w-0 bg-black/60 text-white font-mono text-lg p-3 rounded-xl border-2 border-white/10 focus:border-amber-400 outline-none disabled:opacity-40" />
          <GoldButton onClick={() => stage === 'INPUT' && settle(val)} disabled={stage !== 'INPUT'} className="px-5">回答</GoldButton>
        </div>
      </>
    ),
  });
}

/* ==========================================================
   入口
   ========================================================== */
const IMPL = { WORD: WordGame, TYPING: TypingGame, CALC: CalcGame, MEMORY: MemoryGame, SORT: SortGame, INSPECT: InspectGame, LOAN: LoanGame, FRAUD: FraudGame, CHOICE: ChoiceGame, FLASH: FlashGame };

export function MiniGame({ game, diff, title, sub, onDone, onQuit, ctx }) {
  const g = gameOf(game);
  const Impl = IMPL[g.key] || WordGame;
  const [started, setStarted] = useState(false);
  const d = clampDiff(diff);

  const shell = useCallback(({ step, steps, timeLeft, timeMax, body }) => (
    <Shell title={title} sub={`${g.icon} ${g.name}・難易度 ${'★'.repeat(d)}${'☆'.repeat(5 - d)}`} icon={g.icon}
      step={step} steps={steps} timeLeft={timeLeft} timeMax={timeMax} onQuit={onQuit}>
      {body}
    </Shell>
  ), [title, g, d, onQuit]);

  if (!started) {
    return (
      <Panel className="p-6 text-center">
        <div className="text-5xl mb-2">{g.icon}</div>
        <h3 className="text-xl font-black text-white mb-1">{title}</h3>
        {sub && <p className="text-[12px] text-gray-400 mb-2">{sub}</p>}
        <p className="text-sm text-gray-300 mb-1">{g.name}：{g.desc}</p>
        <p className="text-[11px] text-amber-300 font-bold mb-5">難易度 {'★'.repeat(d)}{'☆'.repeat(5 - d)}</p>
        <div className="flex gap-3">
          <button onClick={onQuit} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition">やめる</button>
          <GoldButton onClick={() => setStarted(true)} className="flex-1 py-3 text-lg">はじめる</GoldButton>
        </div>
      </Panel>
    );
  }
  return <Impl diff={d} onFinish={onDone} shell={shell} ctx={ctx} />;
}

export { GAMES };
