import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { Panel, GoldButton, playSfx } from '../../shared/ui';
import { GAMES, gameOf } from './jobs.js';

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
function InspectGame({ diff, onFinish, shell }) {
  const d = clampDiff(diff);
  const ROUNDS = 5;
  const cols = d <= 2 ? 4 : d <= 4 ? 5 : 6;
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
   入口
   ========================================================== */
const IMPL = { WORD: WordGame, TYPING: TypingGame, CALC: CalcGame, MEMORY: MemoryGame, SORT: SortGame, INSPECT: InspectGame };

export function MiniGame({ game, diff, title, sub, onDone, onQuit }) {
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
  return <Impl diff={d} onFinish={onDone} shell={shell} />;
}

export { GAMES };
