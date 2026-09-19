import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, Building2, TrendingUp, TrendingDown, Coins, Lock, Landmark, Plus, RefreshCw, Users,
} from 'lucide-react';
import { doc, setDoc, collection, onSnapshot, runTransaction, increment } from 'firebase/firestore';
import { db, appId } from '../shared/firebase';
import { Panel, GoldButton, SectionTitle, playSfx } from '../shared/ui';
import { licenseOf, gameOf } from '../games/work/jobs.js';
import {
  CORP_TYPES, corpTypeOf, CORP_INTERVAL, CORP_TAX, BASE_SHARES, MAX_LEVEL,
  levelOf, duePeriods, settleCompany, sharePrice, sellPrice, ownerEquity,
  bankPayable, canFound, MIN_BANK_RATE, MAX_BANK_RATE, EDU_REQ_LABEL,
  POST_KINDS, postKindOf, POSTING_GAMES, MAX_POSTINGS, POST_FEE, validPosting,
  routesOf, airFareBounds, clampAirFare, MAX_ROUTES, ROUTE_FEE,
} from '../shared/corp.js';
import { COUNTRIES, countryOf, CLASSES, classOf, segKey, FARES } from '../shared/world.js';
import { eduLevelOf } from '../games/school/schools.js';

/* ==========================================================
   起業 — 会社を作って育て、投資する
   お金が動くところはすべて runTransaction。
   売上は「期」単位でしか進まないので、何度押しても二重取りできない。
   ========================================================== */

const fmt = (n) => Math.round(n || 0).toLocaleString();
const companiesRef = () => collection(db, 'artifacts', appId, 'public', 'data', 'companies');
const companyDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'companies', id);

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- 会社カード（毎秒の再描画で作り直されないよう外に出す） ---------- */
function CompanyCard({ c, owner, playerName, now, amountIn, setAmountIn, onWithdraw, onInvest, onDivest, onRate, onOpenPost, onDeletePost, onOpenRoute, onDeleteRoute }) {
    const t = corpTypeOf(c.type);
    const lv = levelOf(c);
    const price = sharePrice(c);
    const held = c.shares?.[playerName] || 0;
    const nextIn = Math.max(0, (c.lastPayoutAt || c.createdAt || 0) + CORP_INTERVAL - now);
    return (
      <Panel className={`p-4 ${owner ? 'border-amber-400/40' : ''}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{t?.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-black text-white truncate">{c.name}</span>
              {c.isBank && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-black">BANK</span>}
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">企業</span>
            </div>
            <div className="text-[11px] text-gray-500">{t?.name} ・ 代表 {c.owner} ・ 規模 Lv.{lv}/{MAX_LEVEL}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono font-black text-amber-300">{fmt(c.capital)} Y</div>
            <div className="text-[10px] text-gray-500">会社の資産</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">株価</div>
            <div className="font-mono font-black text-sky-300 text-sm">{fmt(price)}</div>
          </div>
          <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">通算売上</div>
            <div className="font-mono font-black text-emerald-300 text-sm">{fmt(c.revenue)}</div>
          </div>
          <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-[9px] text-gray-500 font-bold">次の決算</div>
            <div className="font-mono font-black text-gray-300 text-sm">{mmss(nextIn)}</div>
          </div>
        </div>

        {c.isBank && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black text-emerald-300 flex items-center gap-1"><Landmark size={12} />銀行業</span>
              <span className="text-[11px] font-mono text-white">金利 {((c.rate || 0) * 100).toFixed(2)}％／30分</span>
            </div>
            <div className="text-[10px] text-gray-400">
              預かり金 {fmt(c.deposits)} Y（{c.depositors || 0}口座）・利息に使える現金 {fmt(bankPayable(c))} Y
            </div>
            {owner && (
              <div className="flex gap-1 mt-1.5">
                {[0.0005, 0.0010, 0.0015, 0.0025, 0.0040].map(r => (
                  <button key={r} onClick={() => onRate(c, r)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition
                      ${Math.abs((c.rate || 0) - r) < 1e-9 ? 'bg-emerald-400 text-black border-emerald-300' : 'bg-black/40 text-gray-400 border-white/10'}`}>
                    {(r * 100).toFixed(2)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {owner && (
          <div className="mb-3 p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-sky-300 flex items-center gap-1"><Users size={12} />求人（{(c.postings || []).length}/{MAX_POSTINGS}）</span>
              <span className="text-[10px] text-gray-500">掲載料 {fmt(POST_FEE)} Y</span>
            </div>
            {(c.postings || []).map(pj => (
              <div key={pj.id} className="flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10">
                <span className="text-sm">{postKindOf(pj.kind).icon}</span>
                <span className="text-[11px] font-black text-white truncate flex-1">{pj.name}</span>
                <span className="text-[10px] text-gray-400">{gameOf(pj.game).icon}{gameOf(pj.game).name}</span>
                <span className="text-[11px] font-mono font-black text-amber-300">{fmt(pj.pay)}Y</span>
                <button onClick={() => onDeletePost(c, pj.id)} className="text-[10px] font-black text-red-300 px-1.5">削除</button>
              </div>
            ))}
            {(c.postings || []).length < MAX_POSTINGS && (
              <button onClick={() => onOpenPost(c)} className="w-full py-1.5 rounded-lg bg-sky-600/70 hover:bg-sky-500 text-white text-[11px] font-black">
                ＋ 求人を出す
              </button>
            )}
            <p className="text-[10px] text-gray-500 mt-1">報酬は会社の資産から支払われます（預かり金には手を付けません）。</p>
          </div>
        )}

        {/* 航空会社だけ：路線・クラス・運賃を決める */}
        {owner && corpTypeOf(c.type)?.isAirline && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <span className="text-[11px] font-black text-sky-300 flex items-center gap-1">🛩️ 就航路線（{routesOf(c).length}/{MAX_ROUTES}）</span>
                <span className="text-[10px] text-gray-500">運賃の8割が会社の資産に</span>
              </div>
              {routesOf(c).map((r) => {
                const [a, b] = r.seg.split('|');
                return (
                  <div key={r.seg} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 border border-white/10 mb-1 flex-wrap">
                    <span className="text-[11px] font-black text-white">
                      {countryOf(a)?.icon}{countryOf(a)?.short} ↔ {countryOf(b)?.icon}{countryOf(b)?.short}
                    </span>
                    {CLASSES.map(cl => (
                      r.cls?.[cl.key] ? (
                        <span key={cl.key} className="text-[10px] font-mono font-black text-emerald-300">
                          {cl.icon}{fmt(r.cls[cl.key])}
                        </span>
                      ) : null
                    ))}
                    <button onClick={() => onDeleteRoute(c, r.seg)} className="ml-auto text-[10px] font-black text-red-300 px-1.5">削除</button>
                  </div>
                );
              })}
              {routesOf(c).length < MAX_ROUTES && (
                <button onClick={() => onOpenRoute(c)} className="w-full py-1.5 rounded-lg bg-sky-600/70 hover:bg-sky-500 text-white text-[11px] font-black">
                  ＋ 路線をひらく（{fmt(ROUTE_FEE)} Y）
                </button>
              )}
          </div>
        )}

        {owner ? (
          <>
            <div className="text-[10px] text-gray-500 mb-1">
              出金できる持ち分 <b className="text-amber-300">{fmt(ownerEquity(c))} Y</b>
              （預かり金と投資家のぶんは出せません）
            </div>
            <div className="flex gap-2">
              <input type="number" value={amountIn} onChange={e => setAmountIn(e.target.value)} placeholder="金額"
                className="flex-1 min-w-0 bg-black/60 text-white font-mono text-sm p-2 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
              <button onClick={() => onWithdraw(c)} className="px-3 py-2 rounded-xl bg-amber-500 text-black text-xs font-black">出金</button>
              <button onClick={() => onInvest(c)} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-black border border-white/10">増資</button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] text-gray-500 mb-1">
              保有 <b className="text-sky-300">{held} 株</b>（評価 {fmt(held * sellPrice(c))} Y）・売値は買値の92％
            </div>
            <div className="flex gap-2">
              <input type="number" value={amountIn} onChange={e => setAmountIn(e.target.value)} placeholder="投資額 / 売却株数"
                className="flex-1 min-w-0 bg-black/60 text-white font-mono text-sm p-2 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
              <button onClick={() => onInvest(c)} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-black">買う</button>
              <button onClick={() => onDivest(c)} disabled={held <= 0}
                className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-black border border-white/10 disabled:opacity-30">売る</button>
            </div>
          </>
        )}
      </Panel>
    );
  }

export default function CorpView({
  balance, updateBalance, onBack, showToast, playerName, emitNews,
  licenses = [], marketMood = 0, onCorpTax, edu = {},
}) {
  const eduLevel = eduLevelOf(edu);
  const [companies, setCompanies] = useState([]);
  const [tab, setTab] = useState('MINE');     // MINE | FOUND | INVEST
  const [name, setName] = useState('');
  const [typeKey, setTypeKey] = useState('RETAIL');
  const [busy, setBusy] = useState(false);
  const [amountIn, setAmountIn] = useState('');
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const settledRef = useRef({});

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const unsub = onSnapshot(companiesRef(), snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.capital || 0) - (a.capital || 0));
      setCompanies(list);
    }, () => { });
    return () => unsub();
  }, []);

  const mine = useMemo(() => companies.filter(c => c.owner === playerName), [companies, playerName]);
  const invested = useMemo(
    () => companies.filter(c => c.owner !== playerName && (c.shares?.[playerName] || 0) > 0),
    [companies, playerName]);
  const type = corpTypeOf(typeKey);

  /* ---------- 決算（誰が開いても同じ結果になる。二重計上しない） ---------- */
  const settle = useCallback(async (c) => {
    if (duePeriods(c) <= 0) return;
    if (settledRef.current[c.id] && Date.now() - settledRef.current[c.id] < 8000) return;
    settledRef.current[c.id] = Date.now();
    try {
      let taxed = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(companyDoc(c.id));
        if (!snap.exists()) return;
        const fresh = { id: c.id, ...snap.data() };
        const r = settleCompany(fresh, marketMood);
        if (!r) return;                       // 誰かが先に精算済み
        taxed = r.tax;
        tx.update(companyDoc(c.id), {
          capital: increment(r.net),
          revenue: increment(r.gross),
          taxPaid: increment(r.tax),
          lastPayoutAt: r.lastPayoutAt,
          updatedAt: Date.now(),
        });
      });
      if (taxed > 0 && onCorpTax) onCorpTax(taxed);
    } catch (e) { /* noop */ }
  }, [marketMood, onCorpTax]);

  useEffect(() => {
    // 自分の会社と投資先だけ、開いている間に精算する
    const targets = [...mine, ...invested];
    targets.forEach(c => { if (duePeriods(c) > 0) settle(c); });
  }, [mine, invested, settle, now]);

  /* ---------- 設立 ---------- */
  const found = async () => {
    if (busyRef.current) return;
    const nm = name.trim();
    if (nm.length < 2 || nm.length > 16) { showToast('会社名は2〜16文字で入力してください。', 'error'); return; }
    if (mine.length >= 3) { showToast('会社は1人3社までです。', 'warning'); return; }
    const chk = canFound(type, licenses, eduLevel);
    if (!chk.ok) {
      showToast(chk.edu ? chk.reason : `資格が足りません：${chk.miss.map(m => licenseOf(m)?.name || m).join('・')}`, 'error');
      return;
    }
    if (balance < type.cost) { showToast(`設立費用 ${fmt(type.cost)} Y が足りません。`, 'error'); return; }
    if (companies.some(c => (c.name || '').trim() === nm)) { showToast('同じ名前の会社があります。', 'error'); return; }
    busyRef.current = true; setBusy(true);
    try {
      await updateBalance(-type.cost);
      const t = Date.now();
      const ref = doc(companiesRef());
      await setDoc(ref, {
        name: nm, owner: playerName, type: type.key, isBank: !!type.isBank,
        capital: Math.round(type.cost * 0.8), deposits: 0, depositors: 0,
        rate: type.isBank ? 0.0015 : 0,
        sharesOut: 0, shares: {}, revenue: 0, taxPaid: 0,
        createdAt: t, lastPayoutAt: t, updatedAt: t,
      });
      playSfx('win');
      showToast(`🏢 「${nm}」を設立しました！`, 'success');
      if (emitNews) emitNews(`${type.icon} ${playerName} が ${type.name}「${nm}」を設立！`, 'info');
      setName(''); setTab('MINE');
    } catch (e) { showToast('設立に失敗しました。', 'error'); }
    finally { busyRef.current = false; setBusy(false); }
  };

  /* ---------- オーナーの出金・増資 ---------- */
  const withdraw = async (c) => {
    if (busyRef.current) return;
    const amount = Math.floor(Number(amountIn) || 0);
    if (amount <= 0) { showToast('金額を入力してください。', 'error'); return; }
    busyRef.current = true;
    try {
      let paid = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(companyDoc(c.id));
        if (!snap.exists()) throw new Error('gone');
        const fresh = { id: c.id, ...snap.data() };
        if (fresh.owner !== playerName) throw new Error('owner');
        const max = ownerEquity(fresh);
        if (amount > max) throw new Error('over');
        paid = amount;
        tx.update(companyDoc(c.id), { capital: increment(-amount), updatedAt: Date.now() });
      });
      if (paid > 0) { await updateBalance(paid); playSfx('coin'); showToast(`💰 ${fmt(paid)} Y 出金しました。`, 'success'); setAmountIn(''); }
    } catch (e) {
      const m = String(e.message);
      showToast(m === 'over' ? 'オーナーの持ち分を超えています（預かり金と投資家のぶんは出せません）。' : '出金できませんでした。', 'error');
    } finally { busyRef.current = false; }
  };

  const invest = async (c) => {
    if (busyRef.current) return;
    const amount = Math.floor(Number(amountIn) || 0);
    if (amount <= 0) { showToast('金額を入力してください。', 'error'); return; }
    if (balance < amount) { showToast('所持金が足りません。', 'error'); return; }
    busyRef.current = true;
    try {
      await updateBalance(-amount);
      let got = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(companyDoc(c.id));
        if (!snap.exists()) throw new Error('gone');
        const fresh = { id: c.id, ...snap.data() };
        const price = sharePrice(fresh);
        const shares = Math.floor(amount / price);
        if (shares <= 0) throw new Error('small');
        got = shares;
        tx.update(companyDoc(c.id), {
          capital: increment(shares * price),
          sharesOut: increment(shares),
          [`shares.${playerName}`]: increment(shares),
          updatedAt: Date.now(),
        });
      });
      playSfx('coin');
      showToast(`📈 ${c.name} の株を ${got} 株 買いました。`, 'success');
      setAmountIn('');
    } catch (e) {
      await updateBalance(amount).catch(() => { });
      showToast(String(e.message) === 'small' ? '1株ぶんに足りません。' : '投資に失敗しました。', 'error');
    } finally { busyRef.current = false; }
  };

  const divest = async (c) => {
    if (busyRef.current) return;
    const have = c.shares?.[playerName] || 0;
    const want = Math.floor(Number(amountIn) || 0) || have;
    if (have <= 0) { showToast('株を持っていません。', 'error'); return; }
    const sell = Math.min(have, want);
    busyRef.current = true;
    try {
      let paid = 0;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(companyDoc(c.id));
        if (!snap.exists()) throw new Error('gone');
        const fresh = { id: c.id, ...snap.data() };
        const own = fresh.shares?.[playerName] || 0;
        const n = Math.min(own, sell);
        if (n <= 0) throw new Error('none');
        const unit = sellPrice(fresh);
        const gross = n * unit;
        const free = Math.max(0, (fresh.capital || 0) - (fresh.deposits || 0));
        const pay = Math.min(gross, free);
        paid = pay;
        tx.update(companyDoc(c.id), {
          capital: increment(-pay),
          sharesOut: increment(-n),
          [`shares.${playerName}`]: increment(-n),
          updatedAt: Date.now(),
        });
      });
      if (paid > 0) { await updateBalance(paid); playSfx('coin'); showToast(`📉 株を売って ${fmt(paid)} Y 受け取りました。`, 'success'); }
      else showToast('会社に現金がなく、売却できませんでした。', 'warning');
      setAmountIn('');
    } catch (e) { showToast('売却に失敗しました。', 'error'); }
    finally { busyRef.current = false; }
  };

  const setRate = async (c, rate) => {
    const r = Math.max(MIN_BANK_RATE, Math.min(MAX_BANK_RATE, rate));
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(companyDoc(c.id));
        if (!snap.exists()) return;
        if (snap.data().owner !== playerName) return;
        tx.update(companyDoc(c.id), { rate: r, updatedAt: Date.now() });
      });
      showToast(`🏦 金利を ${(r * 100).toFixed(2)}％／30分 にしました。`, 'success');
    } catch (e) { /* noop */ }
  };

  /* ---------- 航空会社の路線 ---------- */
  const [routeFor, setRouteFor] = useState(null);
  const [routeDraft, setRouteDraft] = useState({ seg: 'GAMBLE|HOME', ECO: 0, BIZ: 0, FIRST: 0 });

  const openRoute = (c) => {
    const seg = Object.keys(FARES)[0];
    const base = FARES[seg];
    setRouteDraft({
      seg,
      ECO: Math.round(base * 1),
      BIZ: Math.round(base * 2.6),
      FIRST: Math.round(base * 7),
    });
    setRouteFor(c);
  };
  const pickSeg = (seg) => {
    const base = FARES[seg] || 0;
    setRouteDraft({ seg, ECO: Math.round(base), BIZ: Math.round(base * 2.6), FIRST: Math.round(base * 7) });
  };
  const submitRoute = async () => {
    const c = routeFor;
    if (!c || busyRef.current) return;
    const seg = routeDraft.seg;
    if (!FARES[seg]) { showToast('その区間はありません。', 'warning'); return; }
    const already = routesOf(c);
    if (already.length >= MAX_ROUTES) { showToast(`路線は ${MAX_ROUTES} つまでです。`, 'warning'); return; }
    if (already.some(r => r.seg === seg)) { showToast('その路線はもう開いています。', 'warning'); return; }
    const cls = {};
    for (const cl of CLASSES) {
      const v = Number(routeDraft[cl.key]);
      if (!Number.isFinite(v) || v <= 0) continue;
      cls[cl.key] = clampAirFare(v, FARES[seg] * cl.mult);
    }
    if (!Object.keys(cls).length) { showToast('クラスを1つ以上、運賃を入れてください。', 'warning'); return; }
    busyRef.current = true; setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'companies', c.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('no');
        const cur = snap.data();
        const free = Math.max(0, (cur.capital || 0) - (cur.deposits || 0));
        if (free < ROUTE_FEE) throw new Error('poor');
        const list = Array.isArray(cur.routes) ? cur.routes : [];
        tx.update(ref, {
          capital: increment(-ROUTE_FEE),
          routes: [...list, { seg, cls, openedAt: Date.now() }].slice(0, MAX_ROUTES),
          updatedAt: Date.now(),
        });
      });
      showToast('🛩️ 路線をひらきました。みんなの空港に並びます。', 'success');
      setRouteFor(null);
    } catch (e) {
      showToast(String(e?.message) === 'poor' ? '会社の資金が足りません。' : '路線をひらけませんでした。', 'error');
    } finally { busyRef.current = false; setBusy(false); }
  };
  const deleteRoute = async (c, seg) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'companies', c.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const list = (Array.isArray(snap.data().routes) ? snap.data().routes : []).filter(r => r.seg !== seg);
        tx.update(ref, { routes: list, updatedAt: Date.now() });
      });
      showToast('路線を廃止しました。', 'info');
    } catch (e) { showToast('廃止できませんでした。', 'error'); }
    finally { busyRef.current = false; }
  };

  /* ---------- 求人 ---------- */
  const [postFor, setPostFor] = useState(null);
  const [draft, setDraft] = useState({ kind: 'PART', name: '', game: 'CALC', diff: 2, pay: 1200 });
  const openPost = (c) => { setPostFor(c); setDraft({ kind: 'PART', name: '', game: 'CALC', diff: 2, pay: 1200 }); };

  const submitPost = async () => {
    if (busyRef.current || !postFor) return;
    const err = validPosting(draft);
    if (err) { showToast(err, 'error'); return; }
    busyRef.current = true;
    try {
      await runTransaction(db, async (tx) => {
        const ref = companyDoc(postFor.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('gone');
        const f = { id: postFor.id, ...snap.data() };
        if (f.owner !== playerName) throw new Error('owner');
        const list = f.postings || [];
        if (list.length >= MAX_POSTINGS) throw new Error('full');
        if (bankPayable(f) < POST_FEE) throw new Error('poor');
        const pj = {
          id: `p${Date.now().toString(36)}`, kind: draft.kind, name: draft.name.trim(),
          game: draft.game, diff: Math.max(1, Math.min(5, Number(draft.diff) || 2)),
          pay: Math.floor(Number(draft.pay) || 0), by: playerName, at: Date.now(),
        };
        tx.update(ref, { postings: [...list, pj], capital: increment(-POST_FEE), updatedAt: Date.now() });
      });
      playSfx('coin');
      showToast('📣 求人を出しました。みんなの「仕事」に並びます。', 'success');
      setPostFor(null);
    } catch (e) {
      const m = String(e.message);
      showToast(m === 'poor' ? '会社の資金が足りません。' : m === 'full' ? '求人は1社2件までです。' : '求人を出せませんでした。', 'error');
    } finally { busyRef.current = false; }
  };

  const deletePost = async (c, id) => {
    try {
      await runTransaction(db, async (tx) => {
        const ref = companyDoc(c.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const f = snap.data();
        if (f.owner !== playerName) return;
        tx.update(ref, { postings: (f.postings || []).filter(x => x.id !== id), updatedAt: Date.now() });
      });
      showToast('求人を取り下げました。', 'info');
    } catch (e) { /* noop */ }
  };

  /* ---------- 画面 ---------- */
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> メニューに戻る</button>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} Y</div>
      </div>

      <Panel gold className="p-5 mb-4">
        <SectionTitle icon={<Building2 size={26} />} title="YUTAPON VENTURES" sub="起業・経営・企業投資" />
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          会社は {Math.round(CORP_INTERVAL / 60000)} 分ごとに決算があり、売上の <b className="text-amber-300">{Math.round(CORP_TAX * 100)}％</b> は法人税として YUTAPON-BANK に入ります。
          売上は業種と規模で決まり、<b className="text-gray-300">同じ期は何度読み込んでも同じ金額</b>になります。
        </p>
      </Panel>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { k: 'MINE', label: `自分の会社 (${mine.length})` },
          { k: 'FOUND', label: '起業する' },
          { k: 'INVEST', label: '企業投資' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`py-2.5 rounded-xl font-black text-[13px] border-2 transition
              ${tab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {routeFor && (
        <Panel gold className="p-4 mb-3">
          <h3 className="text-sm font-black text-white mb-2">{routeFor.name} の路線をひらく</h3>
          <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">区間</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
            {Object.keys(FARES).map(seg => {
              const [a, b] = seg.split('|');
              const on = routeDraft.seg === seg;
              return (
                <button key={seg} onClick={() => pickSeg(seg)}
                  className={`py-2 rounded-xl text-[11px] font-black border transition
                    ${on ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                  {countryOf(a)?.icon}{countryOf(a)?.short}<br />↕<br />{countryOf(b)?.icon}{countryOf(b)?.short}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-1.5">クラスと運賃（0 にすると就航しません）</div>
          <div className="space-y-1.5 mb-3">
            {CLASSES.map(cl => {
              const b = airFareBounds((FARES[routeDraft.seg] || 0) * cl.mult);
              return (
                <div key={cl.key} className="flex items-center gap-2">
                  <span className="text-[12px] font-black text-white w-24 shrink-0">{cl.icon} {cl.name}</span>
                  <input type="number" value={routeDraft[cl.key] ?? 0}
                    onChange={e => setRouteDraft(d => ({ ...d, [cl.key]: e.target.value }))}
                    className="flex-1 min-w-0 bg-black/60 text-white font-mono text-sm p-2 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
                  <span className="text-[10px] text-gray-500 shrink-0 w-28 text-right">{fmt(b.min)}〜{fmt(b.max)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mb-2">
            運賃は YUTAPON-FLY の基準の 0.3〜3.0 倍まで。安くすればお客が集まり、高くすれば1便あたりの利益が増えます。
          </p>
          <div className="flex gap-2">
            <button onClick={() => setRouteFor(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-black text-sm">やめる</button>
            <GoldButton onClick={submitRoute} disabled={busy} className="flex-1 py-2.5">ひらく（{fmt(ROUTE_FEE)} Y）</GoldButton>
          </div>
        </Panel>
      )}

      {postFor && (
        <Panel gold className="p-4 mb-3">
          <h3 className="text-sm font-black text-white mb-2">{postFor.name} の求人を出す</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {Object.values(POST_KINDS).map(k => (
              <button key={k.key} onClick={() => setDraft(d => ({ ...d, kind: k.key, pay: k.key === 'PART' ? 1200 : 12000 }))}
                className={`p-2.5 rounded-xl border-2 text-left transition ${draft.kind === k.key ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                <div className="text-lg leading-none">{k.icon}</div>
                <div className="text-[12px] font-black text-white">{k.name}</div>
                <div className="text-[10px] text-gray-500">報酬 {fmt(k.min)}〜{fmt(k.max)} Y・間隔 {Math.round(k.cool / 60000) || 1}分</div>
              </button>
            ))}
          </div>
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value.slice(0, 14) }))}
            placeholder="仕事名（例：レジ打ちスタッフ）"
            className="w-full bg-black/60 text-white text-sm p-2.5 rounded-xl border border-white/10 focus:border-amber-400 outline-none mb-2" />
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-2">
            {POSTING_GAMES.map(g => (
              <button key={g} onClick={() => setDraft(d => ({ ...d, game: g }))}
                className={`py-2 rounded-xl text-[11px] font-black border transition ${draft.game === g ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400'}`}>
                {gameOf(g).icon}<span className="block text-[9px]">{gameOf(g).name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black text-gray-400 shrink-0">難易度</span>
            {[1, 2, 3, 4, 5].map(d => (
              <button key={d} onClick={() => setDraft(x => ({ ...x, diff: d }))}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-black border ${draft.diff === d ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-500'}`}>★{d}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-black text-gray-400 shrink-0">報酬</span>
            <input type="number" value={draft.pay} onChange={e => setDraft(d => ({ ...d, pay: e.target.value }))}
              className="flex-1 bg-black/60 text-white font-mono text-sm p-2 rounded-xl border border-white/10 focus:border-amber-400 outline-none" />
            <span className="text-[11px] text-gray-500 shrink-0">Y / 1回</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPostFor(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-black text-sm">やめる</button>
            <GoldButton onClick={submitPost} className="flex-1 py-2.5">掲載する（{fmt(POST_FEE)} Y）</GoldButton>
          </div>
        </Panel>
      )}

      {tab === 'MINE' && (
        <div className="space-y-3">
          {mine.length === 0 ? (
            <Panel className="p-6 text-center">
              <Building2 size={26} className="mx-auto text-gray-600 mb-1" />
              <p className="text-sm font-bold text-white">まだ会社がありません</p>
              <p className="text-[11px] text-gray-500">「起業する」から設立できます。資格が要る業種もあります。</p>
            </Panel>
          ) : mine.map(c => <CompanyCard key={c.id} c={c} owner playerName={playerName} now={now} amountIn={amountIn} setAmountIn={setAmountIn} onWithdraw={withdraw} onInvest={invest} onDivest={divest} onRate={setRate} onOpenPost={openPost} onDeletePost={deletePost} onOpenRoute={openRoute} onDeleteRoute={deleteRoute} />)}
          {invested.length > 0 && (
            <>
              <div className="text-[10px] font-black tracking-widest text-sky-300/70 pt-2">投資している会社</div>
              {invested.map(c => <CompanyCard key={c.id} c={c} playerName={playerName} now={now} amountIn={amountIn} setAmountIn={setAmountIn} onWithdraw={withdraw} onInvest={invest} onDivest={divest} onRate={setRate} onOpenPost={openPost} onDeletePost={deletePost} onOpenRoute={openRoute} onDeleteRoute={deleteRoute} />)}
            </>
          )}
        </div>
      )}

      {tab === 'FOUND' && (
        <div className="space-y-3">
          <Panel className="p-4">
            <label className="block text-[11px] font-black text-gray-400 mb-1.5 tracking-widest">会社名</label>
            <input value={name} onChange={e => setName(e.target.value.slice(0, 16))} placeholder="例：ユタポン商事"
              className="w-full bg-black/60 text-white text-base p-3 rounded-xl border border-white/10 focus:border-amber-400 outline-none mb-3" />
            <GoldButton onClick={found} disabled={busy || balance < (type?.cost || 0) || !canFound(type, licenses, eduLevel).ok}
              className="w-full py-3 text-base flex items-center justify-center gap-2">
              <Plus size={18} />{type?.name} を設立（{fmt(type?.cost)} Y）
            </GoldButton>
            <p className="text-[10px] text-gray-500 mt-1.5 text-center">設立費用の80％が会社の資産になります。1人3社まで。</p>
          </Panel>

          <div className="space-y-2">
            {CORP_TYPES.map(t => {
              const chk = canFound(t, licenses, eduLevel);
              const sel = t.key === typeKey;
              return (
                <button key={t.key} onClick={() => setTypeKey(t.key)}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition
                    ${sel ? 'border-amber-400 bg-amber-400/10' : chk.ok ? 'border-white/10 bg-black/40 hover:border-white/25' : 'border-white/5 bg-black/30 opacity-70'}`}>
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm">{t.name}</span>
                      {t.isBank && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-black">BANK</span>}
                    </div>
                    <p className="text-[11px] text-gray-500">{t.desc}</p>
                    {t.site && <p className="text-[10px] text-sky-300/80 mt-0.5">🔗 {t.site}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.eduReq > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border
                          ${eduLevel >= t.eduReq ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                          🎓{EDU_REQ_LABEL[t.eduReq]}
                        </span>
                      )}
                      {(t.req.length ? t.req : ['資格不要']).map(r => {
                        const l = licenseOf(r);
                        const ok = !l || licenses.includes(r);
                        return (
                          <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border
                            ${ok ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
                            {l ? `${l.icon}${l.name}` : r}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-amber-300 text-sm">{fmt(t.cost)}</div>
                    <div className="text-[9px] text-gray-500">設立費用</div>
                    <div className="text-[10px] text-emerald-300 font-bold mt-1">売上 〜{fmt(t.base)}</div>
                    {!chk.ok && <Lock size={11} className="inline text-red-400 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'INVEST' && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-500">
            会社が育つと株価が上がります。売るときは買値の92％なので、買ってすぐ売ると損をします。
          </p>
          {companies.length === 0 ? (
            <Panel className="p-6 text-center"><p className="text-sm text-gray-400">まだ会社がありません。</p></Panel>
          ) : companies.map(c => <CompanyCard key={c.id} c={c} owner={c.owner === playerName} playerName={playerName} now={now} amountIn={amountIn} setAmountIn={setAmountIn} onWithdraw={withdraw} onInvest={invest} onDivest={divest} onRate={setRate} onOpenPost={openPost} onDeletePost={deletePost} onOpenRoute={openRoute} onDeleteRoute={deleteRoute} />)}
        </div>
      )}
    </div>
  );
}
