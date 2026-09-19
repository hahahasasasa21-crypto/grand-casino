import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch, addDoc, query, orderBy, limit, deleteDoc, where, runTransaction } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, Landmark, Send, ChevronRight, RefreshCw, TrendingDown, TrendingUp, Lock, Newspaper, Pickaxe, BookOpen, History, ShoppingBag, Crown, Building2, Users, Plane, Dices, ArrowLeftRight } from 'lucide-react';
import { db, auth, appId, postNews } from './shared/firebase';
import { FeltBackdrop, Panel, GoldButton, SectionTitle, ErrorBoundary, VipBadge, TopBadge, TAU } from './shared/ui';
import {
  VIP_PRICE, VIP_NEWS_COOLDOWN, VIP_NEWS_MAX_LEN, VIP_SUB_PRICE, VIP_SUB_MS,
  loanState, effectiveVip, goldPrice, goldSellPrice, GOLD_BASE, ITEMS, ICONS, iconOf,
} from './shared/vip';
import Shop from './views/Shop';
import CorpView from './views/Corp.jsx';
import SchoolView from './games/school/index.jsx';
import ProfileView, { availableTags, TagChips } from './views/Profile.jsx';
import { eduLevelOf, EDU_NAME, schoolOf } from './games/school/schools.js';
import WorkView from './games/work/index.jsx';
import {
  jobLabel, salaryOf, careerOf as workCareerOf, rankOf as workRankOf,
  bankerRateBonus, casinoStaffDiscount, PAY_INTERVAL, PAY_MAX_PERIODS,
} from './games/work/jobs.js';
import {
  HOUSE_START, houseRef, ensureHouse, houseDeposit, houseWithdraw, houseLend, houseRepay,
  houseLoanInterest, houseDepositInterest, houseCorpTax, houseShop, houseCasino, housePayroll, houseTotal, bigYen,
} from './shared/house';
import { corpTypeOf, bankPayable, MIN_BANK_RATE, MAX_BANK_RATE } from './shared/corp.js';
import Blackjack from './games/Blackjack';
import LifeGame from './games/life/index.jsx';
import SlotMachine from './games/SlotMachine';
import RedBlackView from './games/RedBlack';
import PokerView from './games/Poker.jsx';
import HorseRacing from './games/HorseRacing.jsx';
import TravelView from './views/Travel.jsx';
import ClubView from './games/club/index.jsx';
import CasinoLobby from './views/CasinoLobby.jsx';
import ArenaView from './views/Arena.jsx';
import { ensureArena, watchArena, normalizeArena } from './shared/arena.js';
import {
  COUNTRIES, countryOf, normalizeTravel, inFlight, watchFly, ensureFly,
  normalizeFly, flyTotal, FLY_START, claimPilotPay, flyPayroll, payPilotPool,
} from './shared/world.js';
import ExchangeView from './views/Exchange.jsx';
import {
  CURRENCIES, currencyOfCountry, normalizeWallet, walletValue, ratesOf,
  ensureFx, watchFx, tickFx,
} from './shared/fx.js';
import { normalizeClub } from './games/club/clubs.js';
/* ==========================================================
   競馬イベント：解放
   ========================================================== */
const HORSE_RACING_EVENT_ACTIVE = true;

/* ==========================================================
   カジノは「オフライン」と「オンライン」の2つに分かれている
   ・オフライン … 相手はハウス（YUTAPON-CASINO）。ひとりで好きなときに
   ・オンライン … 相手はほかのプレイヤー。部屋に人がいるほど盛り上がる
   ========================================================== */
const CASINO_SECTIONS = [
  {
    key: 'OFFLINE', view: 'CASINO_OFF', label: 'オフラインカジノ', icon: '🎰',
    tone: 'from-purple-900/70 to-indigo-950',
    note: '相手はハウス。12卓をひとりで、いつでも',
    games: 'スロット／ルーレット／レッド＆ブラック／バカラ／大小／ドラゴンタイガー／クラップス／ハイ＆ロー／プリンコ／ケノ／マイン／ブラックジャック',
  },
  {
    key: 'ONLINE', view: 'CASINO_ON', label: 'オンラインカジノ', icon: '🌐',
    tone: 'from-emerald-900/70 to-teal-950',
    note: '相手はほかのプレイヤー。通信でつながります',
    games: 'テキサスホールデム／バーチャルターフ／オンラインじゃんけん／オンライン人生ゲーム',
  },
];

/* ==========================================================
   英単語定数
   ========================================================== */


/* ==========================================================
   金融定数
   ========================================================== */
const INTEREST_RATE_30MIN = 0.001;
/* ---------- 銀行の口座の種類 ---------- */
const ACCOUNT_TYPES = [
  { key: 'ORDINARY', name: '普通預金', icon: '💳', mult: 1, loanMul: 1, lockMs: 0,
    desc: 'いつでも出し入れ自由。標準の金利。' },
  { key: 'FIXED', name: '定期預金', icon: '🔒', mult: 3, loanMul: 1, lockMs: 30 * 60 * 1000,
    desc: '金利3倍。ただし預け入れから30分は引き出せない。' },
  { key: 'CURRENT', name: '当座預金', icon: '🧾', mult: 0, loanMul: 1.5, lockMs: 0,
    desc: '利息はつかないが、借入上限が1.5倍になる。' },
];
const INTEREST_INTERVAL = 1800000;
const LOAN_INTEREST_RATE = 0.003;
const LOAN_INTERVAL = 900000;

/* ==========================================================
   投資（人物株）定数
   投資額の10%は対象へ即時還元、残り90%が元本。
   元本は対象の純資産変動率の1/10だけ連動する。
   例）10,000Y投資 → 1,000Y還元 / 元本9,000Y。対象が+10%成長 → 元本+1%（9,090Y）。
   ========================================================== */
const INVEST_FEE_RATE = 0.1;
const INVEST_GROWTH_DAMPING = 0.1;
const INVEST_MIN_AMOUNT = 100;

/* ==========================================================
   メイン App
   ========================================================== */
export default function App() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [balance, setBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [loanBalance, setLoanBalance] = useState(0);
  const [creditScore, setCreditScore] = useState(100);
  const [vip, setVip] = useState(false);
  const [vipSince, setVipSince] = useState(0);
  const [lastVipNewsAt, setLastVipNewsAt] = useState(0);
  const [vipSubUntil, setVipSubUntil] = useState(0);
  const [loanStartAt, setLoanStartAt] = useState(0);
  const [items, setItems] = useState({});
  const [gold, setGold] = useState(0);
  const [job, setJob] = useState(null);
  const [licenses, setLicenses] = useState([]);
  const [jobRecord, setJobRecord] = useState({});
  const [workExp, setWorkExp] = useState(0);
  const [workCool, setWorkCool] = useState({});
  const [edu, setEdu] = useState({});
  const [profile, setProfile] = useState({});
  const [ownedIcons, setOwnedIcons] = useState([]);
  const [ownedTags, setOwnedTags] = useState([]);
  const [stats, setStats] = useState({});
  const [jobChanges, setJobChanges] = useState(0);
  const [travel, setTravel] = useState({});
  const [club, setClub] = useState({});
  const [fly, setFly] = useState(normalizeFly(null));
  const [wallet, setWallet] = useState({});
  const [fx, setFx] = useState({ hist: [], lastAt: 0 });
  const [arena, setArena] = useState(normalizeArena(null));
  const [viewProfile, setViewProfile] = useState(null);
  const [bankId, setBankId] = useState('YUTAPON');
  const [acctType, setAcctType] = useState('ORDINARY');
  const [fixedUntil, setFixedUntil] = useState(0);
  const [house, setHouse] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [rankTab, setRankTab] = useState('ALL');
  const [playerRows, setPlayerRows] = useState([]);

  /* ---------- 口座の種類 ---------- */
  const myBank = useMemo(
    () => (bankId === 'YUTAPON' ? null : companies.find(c => c.id === bankId && c.isBank) || null),
    [bankId, companies]);
  const bankName = bankId === 'YUTAPON' ? 'YUTAPON-BANK' : (myBank?.name || '（閉鎖された銀行）');
  const baseRate = bankId === 'YUTAPON' ? INTEREST_RATE_30MIN : (myBank?.rate || 0);
  const eduLevel = eduLevelOf(edu);
  const acct = ACCOUNT_TYPES.find(a => a.key === acctType) || ACCOUNT_TYPES[0];
  const myRate = Math.max(0, baseRate * acct.mult + bankerRateBonus(job));
  const loanLimit = Math.max(0, Math.floor(creditScore * 1000 * acct.loanMul));

  const [marketProfit, setMarketProfit] = useState(0);
  const [topPlayer, setTopPlayer] = useState('');
  const [newsDraft, setNewsDraft] = useState('');
  const [newsTick, setNewsTick] = useState(0);
  const [view, setView] = useState('LOGIN');
  const [loadingMsg, setLoadingMsg] = useState('通信を確立中...');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [bankInput, setBankInput] = useState('');
  const [loanInput, setLoanInput] = useState('');
  const [newsItems, setNewsItems] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);

  const toastTimerRef = useRef(null);
  const passwordRef = useRef('');
  passwordRef.current = inputPassword;

  const showToast = useCallback((msg, type = 'info') => {
    setToastMsg(msg); setToastType(type);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 4000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);
  useEffect(() => {
    const iv = setInterval(() => setNewsTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await signInAnonymously(auth); }
      catch (e) { if (alive) showToast('認証エラー', 'error'); }
    })();
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoadingMsg(''); });
    return () => { alive = false; unsub(); };
  }, [showToast]);

  const playerRef = useCallback((name) =>
    doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(name)), []);

  // プレイヤーデータ購読
  useEffect(() => {
    if (!user || !playerName) return;
    const docRef = playerRef(playerName);
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setBalance(d.balance || 0);
        setBankBalance(d.bankBalance || 0);
        setLoanBalance(d.loanBalance || 0);
        setCreditScore(d.creditScore ?? 100);
        setVip(d.vip === true);
        setVipSince(d.vipSince || 0);
        setLastVipNewsAt(d.lastVipNewsAt || 0);
        setVipSubUntil(d.vipSubUntil || 0);
        setLoanStartAt(d.loanStartAt || 0);
        setItems(d.items || {});
        setGold(d.gold || 0);
        setJob(d.job || null);
        setLicenses(d.licenses || []);
        setJobRecord(d.jobRecord || {});
        setWorkExp(d.workExp || 0);
        setWorkCool(d.workCool || {});
        setEdu(d.edu || {});
        setProfile(d.profile || {});
        setOwnedIcons(d.ownedIcons || []);
        setOwnedTags(d.ownedTags || []);
        setStats(d.stats || {});
        setJobChanges(d.jobChanges || 0);
        setTravel(d.travel || {});
        setClub(d.club || {});
        setWallet(d.wallet || {});
        setBankId(d.bankId || 'YUTAPON');
        setAcctType(d.acctType || 'ORDINARY');
        setFixedUntil(d.fixedUntil || 0);
        maintainLoanFlag(d, docRef);
        maintainSubscription(d, docRef);
        setTransferHistory(d.transferHistory || []);
        calcOfflineInterest(d, docRef);
        calcLoanInterest(d, docRef);
        calcSalary(d, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000, bankBalance: 0, loanBalance: 0,
          creditScore: 100, lastInterestTime: now, lastLoanTime: now,
          createdAt: now, name: playerName, password: passwordRef.current,
          vip: false, vipSince: 0, lastVipNewsAt: 0, vipSubUntil: 0,
          loanStartAt: 0, items: {}, gold: 0,
          job: null, licenses: [], jobRecord: {}, workExp: 0, workCool: {},
          bankId: 'YUTAPON', acctType: 'ORDINARY', fixedUntil: 0,
          edu: {}, profile: { icon: 'FREE_1', tags: [], bio: '' }, ownedIcons: [], ownedTags: [],
          stats: { casinoPlays: 0 }, jobChanges: 0,
          transferHistory: []
        });
      }
    });
    return () => unsub();
  }, [user, playerName, playerRef]);

  // YUTAPON グループ金庫と会社の購読
  useEffect(() => {
    if (!user) return;
    ensureHouse();
    const unsub = onSnapshot(houseRef(), snap => { if (snap.exists()) setHouse(snap.data()); }, () => { });
    const unsubC = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), snap => {
      const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCompanies(list);
    }, () => { });
    return () => { unsub(); unsubC(); };
  }, [user]);

  // YUTAPON FLY（運航実績）の購読。パイロットの給料がここで上がる
  useEffect(() => {
    if (!user) return;
    ensureFly();
    ensureFx();
    ensureArena();
    const unsubA = watchArena(a => setArena(a || normalizeArena(null)));
    const unsub = watchFly(f => { const v = f || normalizeFly(null); setFly(v); flyRef.current = v.spend || 0; });
    const unsubFx = watchFx(v => setFx(v || { hist: [], lastAt: 0 }));
    return () => {
      try { unsub && unsub(); } catch (e) { /* noop */ }
      try { unsubFx && unsubFx(); } catch (e) { /* noop */ }
      try { unsubA && unsubA(); } catch (e) { /* noop */ }
    };
  }, [user]);

  /* 為替の記録：1分に1回だけ、いまのレートを1本積む（誰かが開いていれば進む） */
  useEffect(() => {
    if (!user || !house) return;
    const run = () => { tickFx({ house, companies, fly, arena }, fx).catch(() => { }); };
    run();
    const iv = setInterval(run, 30000);
    return () => clearInterval(iv);
  }, [user, house, companies, fly, arena, fx]);

  // ニュース購読
  useEffect(() => {
    if (!user) return;
    const newsRef = collection(db, 'artifacts', appId, 'public', 'data', 'news');
    const q = query(newsRef, orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setNewsItems(items);
    });
    return () => unsub();
  }, [user]);

  // 銀行利子（30分ごと）
  useEffect(() => {
    if (!user || !playerName || bankBalance <= 0) return;
    const timer = setInterval(() => {
      const docRef = playerRef(playerName);
      const interest = Math.floor(bankBalance * myRate);
      if (interest > 0) {
        payDepositInterest(interest).then(paid => {
          if (paid > 0) {
            updateDoc(docRef, { bankBalance: increment(paid), lastInterestTime: Date.now() });
            showToast(`🏦 ${bankName} の利子 +${paid.toLocaleString()} Y！`, 'success');
          } else {
            updateDoc(docRef, { lastInterestTime: Date.now() });
            showToast('🏦 銀行に現金がなく、利息が支払われませんでした。', 'warning');
          }
        });
      } else {
        updateDoc(docRef, { lastInterestTime: Date.now() });
      }
    }, INTEREST_INTERVAL);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, playerName, bankBalance, myRate, bankName, playerRef, showToast]);

  // 給料日の見張り（アプリを開いたままでも支給されるように）
  useEffect(() => {
    if (!user || !playerName || !job) return;
    const iv = setInterval(() => calcSalary({ job }, playerRef(playerName)), 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, playerName, job, playerRef]);

  // ローン利息（15分ごと）
  useEffect(() => {
    if (!user || !playerName || loanBalance <= 0) return;
    const timer = setInterval(() => {
      const docRef = playerRef(playerName);
      const interest = Math.floor(loanBalance * LOAN_INTEREST_RATE);
      if (interest > 0) {
        updateDoc(docRef, { loanBalance: increment(interest), lastLoanTime: Date.now() });
        houseLoanInterest(interest);
        showToast(`💸 ローン利息 +${interest.toLocaleString()} Y！`, 'warning');
      }
    }, LOAN_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, loanBalance, playerRef, showToast]);

  // ランキング購読
  useEffect(() => {
    if (!user || !['RANKING', 'MENU', 'SHOP', 'SCHOOL', 'CLUB'].includes(view)) return;
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsub = onSnapshot(collRef, snap => {
      const players = [];
      let deposits = 0, loans = 0, accounts = 0;
      snap.forEach(d => {
        const data = d.data();
        let name = data.name;
        if (!name) { try { name = decodeURIComponent(d.id); } catch (e) { name = d.id; } }
        const total = (data.balance || 0) + (data.bankBalance || 0) - (data.loanBalance || 0) + (data.gold || 0) * GOLD_BASE;
        deposits += data.bankBalance || 0;
        loans += data.loanBalance || 0;
        accounts += 1;
        players.push({
          name,
          balance: data.balance || 0,
          bankBalance: data.bankBalance || 0,
          loanBalance: data.loanBalance || 0,
          gold: data.gold || 0,
          job: data.job || null,
          edu: data.edu || {},
          club: data.club || null,
          travel: data.travel || null,
          wallet: data.wallet || {},
          licenses: data.licenses || [],
          profile: data.profile || {},
          workExp: data.workExp || 0,
          stats: data.stats || {},
          ownedTags: data.ownedTags || [],
          creditScore: data.creditScore ?? 100,
          vip: data.vip === true || (data.vipSubUntil || 0) > Date.now(),
          createdAt: data.createdAt || 0,
          profit: total - 10000,
          total,
        });
      });
      players.sort((a, b) => b.total - a.total);
      setMarketProfit(players.reduce((a, p) => a + p.profit, 0));
      setTopPlayer(players.length ? players[0].name : '');
      setPlayerRows(players.slice(0, 20));
    });
    return () => unsub();
  }, [user, view]);

  /** ローンの発生時刻を維持（完済したらリセット） */
  const maintainLoanFlag = async (data, docRef) => {
    const loan = data.loanBalance || 0;
    if (loan > 0 && !data.loanStartAt) {
      try { await updateDoc(docRef, { loanStartAt: Date.now() }); } catch (e) { /* noop */ }
    } else if (loan <= 0 && data.loanStartAt) {
      try { await updateDoc(docRef, { loanStartAt: 0 }); } catch (e) { /* noop */ }
    }
  };

  /** VIP定期購入の自動更新（残高不足なら自動解約） */
  const subBusyRef = useRef(false);
  const maintainSubscription = async (data, docRef) => {
    if (subBusyRef.current) return;
    const until = data.vipSubUntil || 0;
    if (!until || data.vip === true) return;
    if (Date.now() < until) return;
    subBusyRef.current = true;
    try {
      const price = Math.round(VIP_SUB_PRICE * (1 - casinoStaffDiscount(data.job)));
      if ((data.balance || 0) >= price) {
        await updateDoc(docRef, { balance: increment(-price), vipSubUntil: Date.now() + VIP_SUB_MS });
        houseShop(price);
        showToast(`👑 VIP定期購入を更新しました（-${price.toLocaleString()} Y）`, 'info');
      } else {
        await updateDoc(docRef, { vipSubUntil: 0 });
        showToast('👑 所持金が足りず、VIP定期購入は自動解約されました。', 'warning');
      }
    } catch (e) { /* noop */ }
    finally { setTimeout(() => { subBusyRef.current = false; }, 3000); }
  };

  /** 給料日（不在中のぶんもまとめて支給。貯まりすぎないよう上限あり） */
  const salaryBusyRef = useRef(false);
  const flyRef = useRef(0);
  const calcSalary = async (data, docRef) => {
    const j = data.job;
    if (!j || !workCareerOf(j.key) || salaryBusyRef.current) return;
    const now = Date.now();
    const last = j.lastPayAt || j.hiredAt || now;
    const periods = Math.min(PAY_MAX_PERIODS, Math.floor((now - last) / PAY_INTERVAL));
    if (periods <= 0) return;
    const amount = salaryOf(
      j, eduLevelOf(data.edu || {}),
      data.vip === true || (data.vipSubUntil || 0) > Date.now(),
      { flySpend: flyRef.current, fame: data.club?.fame || 0 },
    ) * periods;
    if (amount <= 0) return;
    salaryBusyRef.current = true;
    try {
      // パイロットは、運賃の2割がたまる「パイロットの取り分」からも配分を受け取る
      let share = 0;
      if (j.key === 'PILOTJOB') {
        share = await claimPilotPay(Math.round(amount * 0.5));
      }
      const total = amount + share;
      const nj = { ...j, lastPayAt: last + periods * PAY_INTERVAL, exp: (j.exp || 0) + 5 * periods };
      await updateDoc(docRef, {
        balance: increment(total), job: nj,
        workExp: increment(5 * periods),
        [`jobRecord.${j.key}`]: { rank: nj.rank || 0, exp: nj.exp || 0 },
      });
      const grp = workCareerOf(j.key)?.group;
      if (grp === 'FLY') flyPayroll(amount);
      else if (grp) housePayroll(amount);
      showToast(
        `💼 給料日！ ${workCareerOf(j.key).name}・${workRankOf(j.rank).name} +${total.toLocaleString()} Y（${periods}回分`
        + `${share > 0 ? `・うち運賃配分 ${share.toLocaleString()} Y` : ''}）`,
        'success',
      );
    } catch (e) { /* noop */ }
    finally { setTimeout(() => { salaryBusyRef.current = false; }, 2000); }
  };

  const saveProfile = useCallback(async (patch) => {
    if (!playerName) return;
    const next = {};
    for (const [k, v] of Object.entries(patch)) next[`profile.${k}`] = v;
    await updateDoc(playerRef(playerName), next);
  }, [playerName, playerRef]);

  const buyIcon = useCallback(async (ic) => {
    if (!playerName) return;
    if (balance < ic.price) { showToast('所持金が足りません。', 'error'); return; }
    await updateDoc(playerRef(playerName), {
      balance: increment(-ic.price),
      ownedIcons: [...new Set([...(ownedIcons || []), ic.key])],
      'profile.icon': ic.key,
    });
    houseShop(ic.price);
  }, [playerName, playerRef, balance, ownedIcons, showToast]);

  const saveWork = useCallback(async (patch) => {
    if (!playerName) return;
    await updateDoc(playerRef(playerName), patch);
  }, [playerName, playerRef]);

  /** 旅行・部活・財布の保存（どれもプレイヤー文書のドット記法パッチ） */
  const saveTravel = saveWork;
  const saveClub = saveWork;
  const saveWallet = saveWork;
  /** 部活で入った経験値 */
  const addWorkExp = useCallback(async (n) => {
    if (!playerName || !n) return;
    await updateDoc(playerRef(playerName), { workExp: increment(Math.round(n)) });
  }, [playerName, playerRef]);

  const calcOfflineInterest = async (data, docRef) => {
    const now = Date.now();
    const diff = now - (data.lastInterestTime || now);
    if (diff >= INTEREST_INTERVAL && (data.bankBalance || 0) > 0) {
      const periods = Math.min(Math.floor(diff / INTEREST_INTERVAL), 48);
      const rate = Math.max(0, (data.bankId === 'YUTAPON' || !data.bankId
        ? INTEREST_RATE_30MIN
        : (companies.find(c => c.id === data.bankId)?.rate || 0))
        * (ACCOUNT_TYPES.find(a => a.key === (data.acctType || 'ORDINARY'))?.mult ?? 1)
        + bankerRateBonus(data.job));
      let bank = data.bankBalance, total = 0;
      for (let i = 0; i < periods; i++) { const int = Math.floor(bank * rate); total += int; bank += int; }
      if (total > 0) {
        const paid = await payDepositInterest(total);
        await updateDoc(docRef, { ...(paid > 0 ? { bankBalance: increment(paid) } : {}), lastInterestTime: now });
        if (paid > 0) showToast(`🏦 不在中の利子 +${paid.toLocaleString()} Y！`, 'success');
      } else {
        await updateDoc(docRef, { lastInterestTime: now });
      }
    }
  };

  const calcLoanInterest = async (data, docRef) => {
    const now = Date.now();
    const diff = now - (data.lastLoanTime || now);
    if (diff >= LOAN_INTERVAL && (data.loanBalance || 0) > 0) {
      const periods = Math.min(Math.floor(diff / LOAN_INTERVAL), 500);
      let loan = data.loanBalance, total = 0;
      for (let i = 0; i < periods; i++) { const int = Math.floor(loan * LOAN_INTEREST_RATE); total += int; loan += int; }
      if (total > 0) houseLoanInterest(total);
      if (total > 0) {
        await updateDoc(docRef, { loanBalance: increment(total), lastLoanTime: now });
        showToast(`💸 不在中のローン利息 +${total.toLocaleString()} Y`, 'warning');
      } else {
        await updateDoc(docRef, { lastLoanTime: now });
      }
    }
  };

  // 残高更新：ここで負の残高にならないよう最終防衛
  const balanceRef = useRef(0);
  balanceRef.current = balance;
  const updateBalance = useCallback(async (amount) => {
    if (!playerName || !amount) return;
    if (amount < 0 && balanceRef.current + amount < 0) {
      showToast('所持金が不足しています。', 'error');
      throw new Error('INSUFFICIENT_FUNDS');
    }
    await updateDoc(playerRef(playerName), { balance: increment(amount) });
  }, [playerName, playerRef, showToast]);

  /** ハウス（YUTAPON-CASINO）が胴元のゲーム用。負けたぶんが金庫に入る */
  const casinoBalance = useCallback(async (amount) => {
    await updateBalance(amount);
    if (amount) houseCasino(-amount);
    // 賭けた回数を数える（称号の条件になる）
    if (amount < 0 && playerName) {
      updateDoc(playerRef(playerName), { 'stats.casinoPlays': increment(1), 'stats.wagered': increment(-amount) }).catch(() => { });
    }
  }, [updateBalance, playerName, playerRef]);

  /** 会社の求人で働いたぶんを、その会社の資産から払う。実際に払えた額を返す */
  const onCorpWork = useCallback(async (corpId, amount) => {
    let paid = 0;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'companies', corpId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const c = snap.data();
        const free = Math.max(0, (c.capital || 0) - (c.deposits || 0));
        paid = Math.max(0, Math.min(amount, free));
        if (paid <= 0) return;
        tx.update(ref, { capital: increment(-paid), wages: increment(paid), updatedAt: Date.now() });
      });
      if (paid > 0) await updateBalance(paid);
    } catch (e) { paid = 0; }
    return paid;
  }, [updateBalance]);

  /** YUTAPON グループ社員が働いた成果 */
  /** プレイヤーの航空会社に運賃を払う（8割は会社、2割はパイロットのプール） */
  const onAirlineFare = useCallback(async (corpId, amount) => {
    const total = Math.max(0, Math.round(amount || 0));
    if (!corpId || total <= 0) return false;
    const toPilots = Math.round(total * 0.2);
    const toCompany = total - toPilots;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'companies', corpId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        tx.update(ref, {
          capital: increment(toCompany), airFares: increment(total),
          flights: increment(1), updatedAt: Date.now(),
        });
      });
    } catch (e) { return false; }
    // パイロットの取り分は YUTAPON-FLY のプールに合流させる
    try { await payPilotPool(toPilots); } catch (e) { /* noop */ }
    return true;
  }, []);

  const onGroupWork = useCallback((group, earned, paid) => {
    const e = Math.max(0, Math.round(earned || 0));
    if (group === 'BANK') { houseLoanInterest(e); if (paid > 0) housePayroll(Math.round(paid)); }
    else if (group === 'FLY') { flyPayroll(Math.round(paid || 0) - e); }
    else { houseCasino(e); if (paid > 0) housePayroll(Math.round(paid)); }
  }, []);

  const addTransferHistory = async (entry) => {
    const docRef = playerRef(playerName);
    const snap = await getDoc(docRef);
    const current = snap.exists() ? (snap.data().transferHistory || []) : [];
    await updateDoc(docRef, { transferHistory: [entry, ...current].slice(0, 30) });
  };

  const handleLogin = async () => {
    const name = inputName.trim();
    if (name.length < 2) { showToast('名前は2文字以上で入力してください。', 'error'); return; }
    if (!/^\d{3}$/.test(inputPassword)) { showToast('パスワードは3桁の数字を入力してください。', 'error'); return; }
    try {
      const snap = await getDoc(playerRef(name));
      if (snap.exists()) {
        const data = snap.data();
        if (data.password && data.password !== inputPassword) {
          showToast('パスワードが違います！', 'error'); return;
        }
        if (!data.password) await updateDoc(playerRef(name), { password: inputPassword });
      }
    } catch (e) { console.error(e); }
    setPlayerName(name);
    setView('MENU');
  };

  const claimRelief = async () => {
    if (balance < 100 && bankBalance < 100) {
      await updateBalance(1000);
      showToast('【救済】1,000Y を受け取りました！', 'success');
    } else showToast('まだ資産があります！', 'error');
  };

  const emitNews = useCallback((msg, type) => { postNews(db, appId, msg, type); }, []);

  /* ---------- いまいる国（YUTAPON FLY で移動する） ---------- */
  const trav = useMemo(() => normalizeTravel(travel), [travel]);
  const myCountry = trav.country || 'HOME';
  const myCountryInfo = countryOf(myCountry) || COUNTRIES[0];
  const myClub = useMemo(() => normalizeClub(club), [club]);
  const myWallet = useMemo(() => normalizeWallet(wallet), [wallet]);
  const fxCtx = useMemo(() => ({ house, companies, fly, arena }), [house, companies, fly, arena]);
  const walletG = useMemo(() => walletValue(myWallet, fxCtx), [myWallet, fxCtx]);

  /* ---------- VIP・ショップ ---------- */
  const delinq = useMemo(() => loanState(loanBalance, loanStartAt), [loanBalance, loanStartAt, newsTick]);
  const vipPlan = vip === true || vipSubUntil > Date.now();
  const vipActive = effectiveVip({ vip, vipSubUntil, delinquent: delinq.delinquent });
  const goldPx = useMemo(() => goldPrice(marketProfit), [marketProfit]);
  const staffOff = casinoStaffDiscount(job);
  const vipPrice = Math.round(VIP_PRICE * (1 - staffOff));
  const vipSubPrice = Math.round(VIP_SUB_PRICE * (1 - staffOff));

  /** ショップの称号（大富豪タグなど）を買う。VIP限定・重複不可 */
  const buyTag = useCallback(async (t) => {
    if (!playerName) return;
    if (!vipActive) { showToast('この称号はVIP限定です。', 'warning'); return; }
    if ((ownedTags || []).includes(t.key)) { showToast('すでに持っています。', 'warning'); return; }
    if (balance < t.price) { showToast('所持金が足りません。', 'error'); return; }
    await updateDoc(playerRef(playerName), {
      balance: increment(-t.price),
      ownedTags: [...new Set([...(ownedTags || []), t.key])],
    });
    houseShop(t.price);
    showToast(`${t.icon} ${t.name} を手に入れました！`, 'success');
    if (emitNews) emitNews(`${t.icon} ${playerName} が「${t.name}」を手に入れた！`, 'jackpot');
  }, [playerName, playerRef, balance, ownedTags, vipActive, showToast, emitNews]);

  const myCompanies = useMemo(() => companies.filter(c => c.owner === playerName), [companies, playerName]);

  /* ---------- 長者番付（プレイヤー／企業／すべて） ---------- */
  /* YUTAPON-GROUP（3つの部署をまとめた親会社） */
  const groupRow = useMemo(() => ({
    name: 'YUTAPON-GROUP', isGroup: true, isHouse: true, kind: 'CORP',
    balance: 0, bankBalance: 0, loanBalance: 0, gold: 0, job: null,
    creditScore: 999, vip: true, createdAt: 0,
    depts: [
      { key: 'FLY', name: 'YUTAPON-FLY', icon: '🛫', total: flyTotal(fly), note: `${(fly?.flights || 0).toLocaleString()} 便` },
      { key: 'BANK', name: 'YUTAPON-BANK', icon: '🏦', total: houseTotal(house || { bankAssets: HOUSE_START }), note: `預かり ${bigYen(house?.depositFlow || 0)}` },
      { key: 'CASINO', name: 'YUTAPON-CASINO', icon: '🎰', total: 0, note: `カジノ収支 ${bigYen(house?.casinoTake || 0)}` },
    ],
    profit: 0,
    total: houseTotal(house || { bankAssets: HOUSE_START }) + flyTotal(fly),
  }), [house, fly]);

  const houseRow = useMemo(() => ({
    name: 'YUTAPON-BANK', isBank: true, isHouse: true, isDept: true, dept: 'BANK', kind: 'CORP',
    balance: 0, bankBalance: house?.depositFlow || 0, loanBalance: 0, gold: 0, job: null,
    creditScore: 999, vip: true, createdAt: 0,
    deposits: Math.max(0, house?.depositFlow || 0), loans: Math.max(0, house?.loansOut || 0),
    casinoTake: house?.casinoTake || 0, corpTax: house?.corpTax || 0,
    profit: 0, total: houseTotal(house || { bankAssets: HOUSE_START }),
  }), [house]);

  const flyRow = useMemo(() => ({
    name: 'YUTAPON-FLY', isFly: true, isHouse: true, isDept: true, dept: 'FLY', kind: 'CORP',
    balance: 0, bankBalance: 0, loanBalance: 0, gold: 0, job: null,
    creditScore: 999, vip: true, createdAt: 0,
    flights: fly?.flights || 0, spend: fly?.spend || 0, pilotPool: fly?.pilotPool || 0,
    profit: 0, total: flyTotal(fly),
  }), [fly]);

  const corpRows = useMemo(() => companies.map(c => ({
    name: c.name, kind: 'CORP', isCompany: true, isBank: !!c.isBank,
    owner: c.owner, type: c.type, capital: c.capital || 0, deposits: c.deposits || 0,
    revenue: c.revenue || 0, sharesOut: c.sharesOut || 0,
    total: Math.round(c.capital || 0),
  })), [companies]);

  const rankingData = useMemo(() => {
    // 外貨も G に直して資産に足す
    const people = playerRows.map(p => {
      const fw = walletValue(p.wallet, fxCtx);
      return { ...p, kind: 'PLAYER', walletG: fw, total: p.total + fw, profit: p.profit + fw };
    });
    if (rankTab === 'PLAYER') return [...people].sort((a, b) => b.total - a.total);
    if (rankTab === 'CORP') return [groupRow, houseRow, flyRow, ...corpRows].sort((a, b) => b.total - a.total);
    return [...people, groupRow, houseRow, flyRow, ...corpRows].sort((a, b) => b.total - a.total);
  }, [playerRows, corpRows, groupRow, houseRow, flyRow, rankTab, fxCtx]);

  // 背景色（下までスクロールしても白くならないように）
  useEffect(() => {
    const c = vipActive ? '#140b05' : myCountry === 'GAMBLE' ? '#14060a' : myCountry === 'WORK' ? '#080d14' : '#07100c';
    document.documentElement.style.backgroundColor = c;
    document.body.style.backgroundColor = c;
  }, [vipActive, myCountry]);

  // 延滞に入った／解けたときのお知らせ
  const wasDelinqRef = useRef(false);
  useEffect(() => {
    if (delinq.delinquent && !wasDelinqRef.current) {
      wasDelinqRef.current = true;
      showToast('🚫 ローンの延滞です。ショップが利用できなくなり、VIP特典も一時停止されます。', 'error');
    } else if (!delinq.delinquent && wasDelinqRef.current) {
      wasDelinqRef.current = false;
      if (vipPlan) showToast('✅ 延滞が解消されました。VIP特典が復帰しました。', 'success');
    }
  }, [delinq.delinquent, vipPlan, showToast]);

  const subscribeVip = useCallback(async () => {
    if (vip) return;
    const price = vipSubPrice;
    if (balance < price) { showToast('所持金が足りません。', 'error'); return; }
    try {
      await updateDoc(playerRef(playerName), {
        balance: increment(-price),
        vipSubUntil: Date.now() + VIP_SUB_MS,
      });
      houseShop(price);
      showToast('👑 VIP定期購入に加入しました！（YUTAPON-CASINO 管轄）', 'success');
      postNews(db, appId, `👑 ${playerName} が VIP会員になりました！`, 'jackpot');
    } catch (e) { showToast('加入に失敗しました。', 'error'); }
  }, [vip, balance, vipSubPrice, playerName, playerRef, showToast]);

  const cancelVipSub = useCallback(async () => {
    try {
      await updateDoc(playerRef(playerName), { vipSubUntil: 0 });
      showToast('VIP定期購入を解約しました。', 'info');
    } catch (e) { showToast('解約に失敗しました。', 'error'); }
  }, [playerName, playerRef, showToast]);

  const buyItem = useCallback(async (item) => {
    if (delinq.delinquent) { showToast('延滞中はショップを利用できません。', 'error'); return; }
    if (item.vipOnly && !vipActive) { showToast('この商品はVIP会員限定です。', 'warning'); return; }
    if (balance < item.price) { showToast('所持金が足りません。', 'error'); return; }
    try {
      await updateDoc(playerRef(playerName), {
        balance: increment(-item.price),
        [`items.${item.key}`]: increment(1),
      });
      houseShop(item.price);
      showToast(`${item.icon} ${item.name} を購入しました！`, 'success');
    } catch (e) { showToast('購入に失敗しました。', 'error'); }
  }, [delinq.delinquent, vipActive, balance, playerName, playerRef, showToast]);

  /** アイテムを1つ消費する。成功したら true */
  const useItem = useCallback(async (key) => {
    if ((items[key] || 0) <= 0) return false;
    try {
      await updateDoc(playerRef(playerName), { [`items.${key}`]: increment(-1) });
      return true;
    } catch (e) { return false; }
  }, [items, playerName, playerRef]);

  const tradeGold = useCallback(async (side, qty) => {
    const n = Math.max(1, Math.floor(qty || 1));
    if (delinq.delinquent) { showToast('延滞中はショップを利用できません。', 'error'); return; }
    if (side === 'BUY') {
      const cost = goldPx * n;
      if (balance < cost) { showToast('所持金が足りません。', 'error'); return; }
      await updateDoc(playerRef(playerName), { balance: increment(-cost), gold: increment(n) }).catch(() => { });
      houseShop(cost);
      showToast(`🥇 金を ${n} 本 購入しました（-${cost.toLocaleString()} Y）`, 'success');
    } else {
      if (gold < n) { showToast('保有している金が足りません。', 'error'); return; }
      const got = goldSellPrice(goldPx) * n;
      await updateDoc(playerRef(playerName), { balance: increment(got), gold: increment(-n) }).catch(() => { });
      houseShop(-got);
      showToast(`🥇 金を ${n} 本 売却しました（+${got.toLocaleString()} Y）`, 'success');
    }
  }, [delinq.delinquent, balance, gold, goldPx, playerName, playerRef, showToast]);

  const buyVip = useCallback(async () => {
    if (vip) return;
    if (delinq.delinquent) { showToast('延滞中はショップを利用できません。', 'error'); return; }
    if (balance < vipPrice) { showToast('所持金が足りません。', 'error'); return; }
    try {
      await updateDoc(playerRef(playerName), {
        balance: increment(-vipPrice),
        vip: true,
        vipSince: Date.now(),
      });
      houseShop(vipPrice);
      showToast('👑 VIP会員になりました！ ようこそVIPルームへ。', 'success');
      postNews(db, appId, `👑 ${playerName} が VIP会員になりました！`, 'jackpot');
      setView('MENU');
    } catch (e) {
      showToast('購入に失敗しました。', 'error');
    }
  }, [vip, delinq.delinquent, balance, vipPrice, playerName, playerRef, showToast]);

  const vipNewsLeft = useMemo(() => (lastVipNewsAt ? Math.max(0, VIP_NEWS_COOLDOWN - (Date.now() - lastVipNewsAt)) : 0), [lastVipNewsAt, newsTick]);
  const postVipNews = async () => {
    const msg = newsDraft.trim();
    // 定期購入のVIPでも書けるよう、買い切りフラグではなく実効VIPで判定する
    if (!vipActive) {
      showToast(delinq.delinquent
        ? 'ローン延滞中はニュースに投稿できません。'
        : 'VIP会員になるとニュースに投稿できます。', 'error');
      return;
    }
    if (!msg) { showToast('メッセージを入力してください。', 'error'); return; }
    if (msg.length > VIP_NEWS_MAX_LEN) { showToast(`${VIP_NEWS_MAX_LEN}文字までです。`, 'error'); return; }
    const cooldown = lastVipNewsAt ? Math.max(0, VIP_NEWS_COOLDOWN - (Date.now() - lastVipNewsAt)) : 0;
    if (cooldown > 0) {
      showToast(`次の投稿まで あと ${Math.ceil(cooldown / 1000)} 秒です。`, 'warning');
      return;
    }
    try {
      await postNews(db, appId, `📣 ${playerName}：${msg}`, 'vip');
      await updateDoc(playerRef(playerName), { lastVipNewsAt: Date.now() });
      setNewsDraft('');
      showToast('📣 ニュースに投稿しました！', 'success');
    } catch (e) { showToast('投稿に失敗しました。', 'error'); }
  };

  const bankBusyRef = useRef(false);
  const companyDocRef = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'companies', id);

  /** 選んだ銀行の帳簿を動かす。dir=+1 預け入れ / -1 引き出し。実際に動いた額を返す */
  const bankMove = useCallback(async (amount, dir) => {
    if (bankId === 'YUTAPON') {
      if (dir > 0) await houseDeposit(amount); else await houseWithdraw(amount);
      return amount;
    }
    let moved = 0;
    await runTransaction(db, async (tx) => {
      const ref = companyDocRef(bankId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('gone');
      const c = snap.data();
      if (!c.isBank) throw new Error('gone');
      if (dir > 0) {
        moved = amount;
        tx.update(ref, { capital: increment(amount), deposits: increment(amount), updatedAt: Date.now() });
      } else {
        const avail = Math.min(amount, Math.max(0, c.deposits || 0), Math.max(0, c.capital || 0));
        if (avail <= 0) throw new Error('empty');
        moved = avail;
        tx.update(ref, { capital: increment(-avail), deposits: increment(-avail), updatedAt: Date.now() });
      }
    });
    return moved;
  }, [bankId]);

  /** 預金の利息を、その銀行に払わせる。払えた額を返す */
  const payDepositInterest = useCallback(async (interest) => {
    if (interest <= 0) return 0;
    if (bankId === 'YUTAPON') { await houseDepositInterest(interest); return interest; }
    let paid = 0;
    try {
      await runTransaction(db, async (tx) => {
        const ref = companyDocRef(bankId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const c = snap.data();
        const free = bankPayable(c);
        paid = Math.max(0, Math.min(interest, free));
        if (paid <= 0) return;
        tx.update(ref, { capital: increment(-paid), interestPaid: increment(paid), updatedAt: Date.now() });
      });
    } catch (e) { paid = 0; }
    return paid;
  }, [bankId]);

  const handleBankAction = async (action) => {
    if (bankBusyRef.current) return;
    const amount = parseInt(bankInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    if (bankId !== 'YUTAPON' && !myBank) { showToast('その銀行はもうありません。YUTAPON-BANK に戻してください。', 'error'); return; }
    bankBusyRef.current = true;
    const docRef = playerRef(playerName);
    try {
      if (action === 'DEPOSIT') {
        if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
        await updateBalance(-amount);
        let moved = 0;
        try { moved = await bankMove(amount, 1); }
        catch (e) { await updateBalance(amount).catch(() => { }); showToast('その銀行に預けられませんでした。', 'error'); return; }
        const creditBonus = amount >= 50000 ? 3 : amount >= 10000 ? 1 : 0;
        await updateDoc(docRef, {
          bankBalance: increment(moved),
          lastInterestTime: Date.now(),
          ...(acct.lockMs > 0 ? { fixedUntil: Date.now() + acct.lockMs } : {}),
          ...(creditBonus > 0 ? { creditScore: increment(creditBonus) } : {}),
        });
        if (moved < amount) await updateBalance(amount - moved).catch(() => { });
        showToast(`🏦 ${bankName} に ${moved.toLocaleString()} Y 預け入れました。${creditBonus > 0 ? ` 信用度 +${creditBonus}` : ''}`, 'success');
      } else {
        if (bankBalance < amount) { showToast('預金残高が足りません！', 'error'); return; }
        if (acct.lockMs > 0 && Date.now() < fixedUntil) {
          showToast(`定期預金は あと ${Math.ceil((fixedUntil - Date.now()) / 60000)} 分は引き出せません。`, 'warning');
          return;
        }
        let moved = 0;
        try { moved = await bankMove(amount, -1); }
        catch (e) { showToast('銀行に現金がなく、引き出せませんでした。', 'error'); return; }
        await updateDoc(docRef, { bankBalance: increment(-moved) });
        await updateBalance(moved);
        showToast(`🏦 ${moved.toLocaleString()} Y 引き出しました。`, 'success');
      }
      setBankInput('');
    } finally { bankBusyRef.current = false; }
  };

  /** 口座を変える。預金が残っているうちは変えられない（帳簿がずれるため） */
  const switchAccount = async (nextBankId, nextAcct) => {
    if (bankBalance > 0 && (nextBankId !== bankId)) {
      showToast('銀行を変えるには、先に全額引き出してください。', 'warning');
      return;
    }
    if (nextAcct !== acctType && acctType === 'FIXED' && bankBalance > 0 && Date.now() < fixedUntil) {
      showToast('定期預金の期間中は種類を変えられません。', 'warning');
      return;
    }
    await updateDoc(playerRef(playerName), {
      bankId: nextBankId, acctType: nextAcct, lastInterestTime: Date.now(),
      ...(nextAcct === 'FIXED' && bankBalance > 0 ? { fixedUntil: Date.now() + 30 * 60 * 1000 } : {}),
    });
    showToast('口座を変更しました。', 'success');
  };

  const handleLoan = async () => {
    if (bankBusyRef.current) return;
    const amount = parseInt(loanInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    if (loanLimit <= 0) { showToast('信用度が不足していて借入できません。', 'error'); return; }
    if (loanBalance + amount > loanLimit) {
      showToast(`上限 ${loanLimit.toLocaleString()} Y まで借りられます！`, 'error'); return;
    }
    bankBusyRef.current = true;
    try {
      await updateDoc(playerRef(playerName), {
        balance: increment(amount),
        loanBalance: increment(amount),
        lastLoanTime: Date.now(),
        creditScore: increment(-5),
        ...(loanBalance <= 0 ? { loanStartAt: Date.now() } : {}),
      });
      await houseLend(amount);
      showToast(`💰 ${amount.toLocaleString()} Y 借入しました。信用度 -5`, 'warning');
      setLoanInput('');
    } finally { bankBusyRef.current = false; }
  };

  const handleRepay = async () => {
    if (bankBusyRef.current) return;
    const amount = parseInt(loanInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
    if (loanBalance < amount) { showToast('返済額がローン残高を超えています！', 'error'); return; }
    bankBusyRef.current = true;
    try {
      const willClear = loanBalance - amount <= 0;
      await updateDoc(playerRef(playerName), {
        balance: increment(-amount),
        loanBalance: increment(-amount),
        creditScore: increment(-15),
        ...(willClear ? { loanStartAt: 0 } : {}),
      });
      await houseRepay(amount);
      showToast(willClear
        ? `✅ ${amount.toLocaleString()} Y 返済！ローンを完済しました。`
        : `✅ ${amount.toLocaleString()} Y 返済！信用度 -15`, willClear ? 'success' : 'warning');
      setLoanInput('');
    } finally { bankBusyRef.current = false; }
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount, 10);
    const target = transferTarget.trim();
    if (!target || target === playerName) { showToast('自分以外のプレイヤー名を入力してください。', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast('金額を正しく入力してください。', 'error'); return; }
    if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
    try {
      const targetRef = playerRef(target);
      const targetSnap = await getDoc(targetRef);
      if (!targetSnap.exists()) { showToast(`「${target}」が見つかりません。`, 'error'); return; }
      const selfRef = playerRef(playerName);
      const batch = writeBatch(db);
      batch.update(selfRef, { balance: increment(-amount) });
      batch.update(targetRef, { balance: increment(amount) });
      await batch.commit();
      const now = Date.now();
      await addTransferHistory({ type: 'SENT', to: target, amount, at: now });
      const targetHistory = targetSnap.data().transferHistory || [];
      await updateDoc(targetRef, {
        transferHistory: [{ type: 'RECEIVED', from: playerName, amount, at: now }, ...targetHistory].slice(0, 30)
      });
      if (amount >= 50000) {
        await postNews(db, appId, `💸 ${playerName} → ${target} へ ${amount.toLocaleString()} Y の大口送金！`, 'transfer');
      }
      showToast(`💸 ${target} へ ${amount.toLocaleString()} Y 送金！`, 'success');
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch (e) { showToast('送金エラー', 'error'); }
  };

  const getCreditColor = s => s >= 150 ? 'text-emerald-400' : s >= 100 ? 'text-yellow-400' : s >= 50 ? 'text-orange-400' : 'text-red-400';
  const getCreditLabel = s => s >= 150 ? 'AAA' : s >= 120 ? 'AA' : s >= 100 ? 'A' : s >= 80 ? 'BBB' : s >= 60 ? 'BB' : s >= 40 ? 'B' : 'CCC';

  const toastColors = {
    info: 'bg-amber-400 text-black',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-orange-500 text-white'
  };
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };
  const newsTypeStyle = {
    info: 'text-sky-300', success: 'text-emerald-300', warning: 'text-orange-300', error: 'text-red-300',
    jackpot: 'text-amber-300 font-black', transfer: 'text-purple-300', mining: 'text-amber-400',
    loss: 'text-red-300', janken: 'text-pink-300', invest: 'text-cyan-300', race: 'text-emerald-300', poker: 'text-indigo-300',
    vip: 'text-amber-200 font-bold',
  };



  if (loadingMsg) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07100c] text-white">
      <FeltBackdrop vip={vipActive} country={myCountry} />
      <RefreshCw className="animate-spin text-amber-400 mb-4" size={48} />
      <p className="font-bold text-lg tracking-widest">{loadingMsg}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white font-sans relative flex flex-col justify-between">
      <FeltBackdrop vip={vipActive} country={myCountry} />

      {toastMsg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold max-w-[90vw] text-center ${toastColors[toastType]}`}>
          <AlertCircle size={20} className="shrink-0" /><span>{toastMsg}</span>
        </div>
      )}

      <div className="flex-grow">
        {/* ===== LOGIN ===== */}
        {view === 'LOGIN' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="mb-8 text-center">
              <div className="text-5xl mb-3">♠️ ♥️ ♦️ ♣️</div>
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 mb-1 tracking-tight">YUTAPON CASINO</h1>
              <h2 className="text-lg md:text-2xl font-bold text-amber-100/40 tracking-[0.4em]">&amp; TURF ONLINE</h2>
            </div>
            <Panel gold className="p-8 w-full max-w-md">
              <div className="mb-6 text-center space-y-2">
                <p className="text-gray-300 font-medium">プレイヤー名とパスワードを入力してください</p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-left">
                  <p className="text-amber-300 font-bold mb-1">📋 初回登録と引き継ぎ</p>
                  <p className="text-amber-100/70 text-xs leading-relaxed">
                    ・<span className="font-bold">初回：</span>名前＋パスワードを決めてそのまま登録<br />
                    ・<span className="font-bold">引き継ぎ：</span>登録済みの名前＋同じパスワードでログイン<br />
                    ・パスワードは<span className="font-bold text-amber-300">数字3桁</span>（例：123）
                  </p>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">プレイヤー名</label>
                  <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-black/50 text-white border-2 border-white/10 focus:outline-none focus:border-amber-400 text-center text-2xl font-bold transition-all"
                    placeholder="名前を入力" maxLength={12} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold mb-1 flex items-center gap-1"><Lock size={12} /> パスワード（数字3桁）</label>
                  <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={3}
                    value={inputPassword}
                    onChange={e => setInputPassword(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-black/50 text-white border-2 border-white/10 focus:outline-none focus:border-amber-400 text-center text-3xl font-bold tracking-[1rem] transition-all"
                    placeholder="●●●" />
                </div>
              </div>
              <GoldButton onClick={handleLogin} className="w-full py-4 text-xl">入場・引き継ぎ</GoldButton>
            </Panel>
          </div>
        )}

        {/* ===== MENU ===== */}
        {view === 'MENU' && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-8 border-b border-amber-500/20 pb-6 gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-1">YUTAPON CASINO</h1>
                <p className="text-gray-400 font-medium flex items-center gap-1.5">
                  おかえりなさい、<span className={`font-bold ${vipActive ? 'text-amber-200' : 'text-white'}`}>{playerName}</span>
                  {playerName === topPlayer && <TopBadge size="sm" />}
                  {vipActive && <VipBadge size="sm" />} 様
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => setView('TRAVEL')}
                  className="bg-black/50 border border-sky-500/25 hover:border-sky-400/60 px-4 py-3 rounded-2xl flex items-center gap-3 transition">
                  <span className="text-xl leading-none">{myCountryInfo.icon}</span>
                  <div className="text-left">
                    <span className="text-[10px] text-gray-400 font-bold block">現在地</span>
                    <span className="text-sm font-black text-sky-200">{myCountryInfo.short || myCountryInfo.name}</span>
                  </div>
                </button>
                <div className="bg-black/50 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center gap-3">
                  <Coins className="text-amber-400" size={20} />
                  <div><span className="text-[10px] text-gray-400 font-bold block">所持金</span><span className="font-mono text-lg font-black text-amber-300">{balance.toLocaleString()} Y</span></div>
                </div>
                <div className="bg-black/50 border border-emerald-500/20 px-4 py-3 rounded-2xl flex items-center gap-3">
                  <Landmark className="text-emerald-400" size={20} />
                  <div><span className="text-[10px] text-gray-400 font-bold block">銀行残高</span><span className="font-mono text-lg font-black text-emerald-300">{bankBalance.toLocaleString()} Y</span></div>
                </div>
                {loanBalance > 0 && (
                  <div className="bg-black/50 border border-red-500/30 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <TrendingDown className="text-red-400" size={20} />
                    <div><span className="text-[10px] text-gray-400 font-bold block">ローン残高</span><span className="font-mono text-lg font-black text-red-300">{loanBalance.toLocaleString()} Y</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <div>
                  <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">Casino</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(myCountry === 'SPORT'
                      ? [{ key: 'ARENA', view: 'ARENA', label: 'スポーツアリーナ', icon: '🏟️', tone: 'from-rose-900/70 to-pink-950', note: 'この国にカジノはない。かわりに競技場がある', games: '賞金マッチ／エキシビション／ランキング戦' }]
                      : CASINO_SECTIONS
                    ).map(sec => (
                      <button key={sec.key} onClick={() => setView(sec.view)}
                        className={`group relative overflow-hidden bg-gradient-to-br ${sec.tone} p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-amber-400/50 transition-all transform hover:-translate-y-1 text-left`}>
                        <div className="absolute -top-8 -right-5 text-[132px] leading-none opacity-10 group-hover:opacity-20 transition select-none">{sec.icon}</div>
                        <h2 className="text-2xl font-extrabold text-white mb-1 group-hover:text-amber-200 transition">{sec.icon} {sec.label}</h2>
                        <p className="text-gray-300 text-[13px] font-bold mb-1.5">{sec.note}</p>
                        <p className="text-gray-500 text-[11px] leading-snug">{sec.games}</p>
                        {sec.key === 'OFFLINE' && myCountry === 'GAMBLE' && (
                          <span className="inline-block mt-2 bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">ハイローラー卓 ×100</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>


                <div>
                  <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">World</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <button onClick={() => setView('TRAVEL')} className="group relative overflow-hidden bg-gradient-to-br from-sky-900/70 to-blue-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-sky-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-sky-400/10 group-hover:text-sky-300/20 transition"><Plane size={110} /></div>
                      <span className="bg-black/40 text-sky-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-sky-300/20">YUTAPON FLY</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">旅行</h2>
                      <p className="text-gray-400 text-sm">
                        {myCountryInfo.icon} いま {myCountryInfo.name}・4か国を行き来できる
                      </p>
                    </button>
                    <button onClick={() => setView('CLUB')} className="group relative overflow-hidden bg-gradient-to-br from-rose-900/70 to-pink-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-rose-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-rose-400/10 group-hover:text-rose-300/20 transition"><Trophy size={110} /></div>
                      <span className="bg-black/40 text-rose-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-rose-300/20">Club</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">部活・サークル</h2>
                      <p className="text-gray-400 text-sm">
                        {myClub.key ? `実力 ${Math.round(myClub.skill).toLocaleString()}・名声 ${Math.round(myClub.fame).toLocaleString()}` : '甲子園・総合大会・36の部活'}
                      </p>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">Work</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={() => setView('SCHOOL')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-900/70 to-teal-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-emerald-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-emerald-400/10 group-hover:text-emerald-300/20 transition"><BookOpen size={110} /></div>
                      <span className="bg-black/40 text-emerald-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-emerald-300/20">Academy</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">学校・塾</h2>
                      <p className="text-gray-400 text-sm">
                        {eduLevel > 0
                          ? `${EDU_NAME[eduLevel]}・${myCountryInfo.short} の学校へ`
                          : `${myCountryInfo.short} の高校・大学・専門学校・塾`}
                      </p>
                    </button>
                    <button onClick={() => setView('LABOR')} className="group relative overflow-hidden bg-gradient-to-br from-sky-900/70 to-cyan-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-sky-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-sky-400/10 group-hover:text-sky-300/20 transition"><BookOpen size={110} /></div>
                      <span className="bg-black/40 text-sky-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-sky-300/20">Work</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">仕事</h2>
                      <p className="text-gray-400 text-sm">
                        {job ? `${jobLabel(job)}・給料 ${salaryOf(job, eduLevel, vipActive, { flySpend: fly.spend, fame: myClub.fame }).toLocaleString()}Y` : 'アルバイト14種・資格16種・就職15職'}
                      </p>
                    </button>
                    <button onClick={() => setView('CORP')} className="group relative overflow-hidden bg-gradient-to-br from-indigo-900/70 to-slate-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-indigo-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-indigo-400/10 group-hover:text-indigo-300/20 transition"><Building2 size={110} /></div>
                      <span className="bg-black/40 text-indigo-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-indigo-300/20">Ventures</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">起業</h2>
                      <p className="text-gray-400 text-sm">
                        {myCompanies.length > 0
                          ? `${myCompanies.length}社を経営中・総資産 ${myCompanies.reduce((a, c) => a + (c.capital || 0), 0).toLocaleString()}Y`
                          : '会社を作って育てる・企業投資もできる'}
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[
                    { id: 'SHOP', label: 'ショップ', sub: delinq.delinquent ? '延滞中・利用停止' : vipActive ? 'VIP会員です' : '道具・金・VIP券', icon: <ShoppingBag size={20} />, tone: delinq.delinquent ? 'text-red-400' : 'text-amber-300' },
                    { id: 'BANK', label: '銀行', sub: '口座を選んで預金・借入', icon: <Landmark size={20} />, tone: 'text-emerald-300' },
                    { id: 'EXCHANGE', label: '両替所', sub: walletG > 0 ? `外貨 ${walletG.toLocaleString()} Y ぶん` : 'G ↔ BC ↔ WD の為替', icon: <ArrowLeftRight size={20} />, tone: 'text-violet-300' },
                    { id: 'TRANSFER', label: 'オンライン送金', sub: '他プレイヤーへ送金', icon: <Send size={20} />, tone: 'text-sky-300' },
                    { id: 'INVEST', label: '人物株投資', sub: '他プレイヤーに投資', icon: <TrendingUp size={20} />, tone: 'text-cyan-300' },
                    { id: 'RANKING', label: '長者番付', sub: 'プレイヤーと企業', icon: <Trophy size={20} />, tone: 'text-amber-300' },
                    { id: 'PROFILE', label: 'プロフィール', sub: 'アイコン・タグ・経歴', icon: <BookOpen size={20} />, tone: 'text-sky-300' },
                  ].map(s => (
                    <button key={s.id} onClick={() => { if (s.id === 'SHOP' && delinq.delinquent) { showToast('ローン延滞中のためショップは利用できません。', 'error'); } setView(s.id); }} className="flex items-center justify-between p-4 bg-black/40 hover:bg-black/60 rounded-2xl border border-white/10 hover:border-amber-400/30 transition">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 bg-white/5 rounded-xl ${s.tone}`}>{s.icon}</div>
                        <div className="text-left"><span className="font-bold text-white block text-sm">{s.label}</span><span className="text-[11px] text-gray-400">{s.sub}</span></div>
                      </div>
                      <ChevronRight className="text-gray-600" size={18} />
                    </button>
                  ))}
                </div>

                <Panel className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex gap-8">
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block mb-1">純資産</span>
                      <span className="text-2xl font-black font-mono text-amber-300">{(balance + bankBalance - loanBalance).toLocaleString()} Y</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block mb-1">信用度</span>
                      <span className={`text-2xl font-black font-mono ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                    </div>
                  </div>
                  {balance < 100 && bankBalance < 100 && (
                    <button onClick={claimRelief} className="bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-red-500/30 transition">
                      救済資金 1,000Y を申請する
                    </button>
                  )}
                </Panel>
              </div>

              {/* 右カラム */}
              <div className="space-y-4">
                <Panel className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <Newspaper size={16} className="text-amber-400" />
                    <span className="text-amber-300 font-black text-sm tracking-[0.2em]">CASINO NEWS</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-3 space-y-2">
                    {newsItems.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-8">ニュースはまだありません</p>
                    ) : newsItems.map(item => (
                      <div key={item.id} className="flex gap-2 text-xs">
                        <span className="text-gray-600 shrink-0">{formatTime(item.createdAt)}</span>
                        <span className={newsTypeStyle[item.type] || 'text-gray-300'}>{item.message}</span>
                      </div>
                    ))}
                  </div>
                  {vipActive ? (
                    <div className="border-t border-amber-400/20 p-2.5 bg-amber-400/5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <VipBadge size="xs" />
                        <span className="text-[10px] font-black text-amber-200/80">ニュースに書き込む</span>
                        {vipNewsLeft > 0 && (
                          <span className="ml-auto text-[10px] font-mono text-gray-500">
                            あと {Math.floor(vipNewsLeft / 60000)}:{String(Math.floor((vipNewsLeft % 60000) / 1000)).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input value={newsDraft} onChange={e => setNewsDraft(e.target.value.slice(0, VIP_NEWS_MAX_LEN))}
                          onKeyDown={e => e.key === 'Enter' && postVipNews()}
                          disabled={vipNewsLeft > 0}
                          placeholder={vipNewsLeft > 0 ? '5分に1回まで投稿できます' : '全員のニュース欄に流れます'}
                          className="flex-1 min-w-0 bg-black/60 text-white text-xs p-2 rounded-lg border border-white/10 focus:border-amber-400 outline-none disabled:opacity-50" />
                        <button onClick={postVipNews} disabled={vipNewsLeft > 0 || !newsDraft.trim()}
                          className="px-3 rounded-lg bg-amber-400 text-black text-xs font-black disabled:opacity-30 shrink-0">投稿</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setView('SHOP')} className="w-full border-t border-white/10 p-2.5 text-[11px] text-gray-500 hover:text-amber-200 hover:bg-amber-400/5 transition font-bold text-left">
                      🔒 VIP会員になると、このニュース欄に直接書き込めます（5分に1回）
                    </button>
                  )}
                </Panel>

                <Panel className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <History size={16} className="text-sky-400" />
                    <span className="text-sky-300 font-black text-sm tracking-[0.2em]">送受金履歴</span>
                  </div>
                  <div className="h-52 overflow-y-auto p-3 space-y-2">
                    {transferHistory.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-8">履歴はまだありません</p>
                    ) : transferHistory.slice(0, 20).map((h, i) => (
                      <div key={i} className={`flex justify-between items-center text-xs p-2 rounded-lg ${h.type === 'SENT' ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                        <div>
                          <span className={`font-bold ${h.type === 'SENT' ? 'text-red-300' : 'text-emerald-300'}`}>
                            {h.type === 'SENT' ? `→ ${h.to}` : `← ${h.from}`}
                          </span>
                          <span className="text-gray-600 ml-2">{formatTime(h.at)}</span>
                        </div>
                        <span className={`font-mono font-black ${h.type === 'SENT' ? 'text-red-300' : 'text-emerald-300'}`}>
                          {h.type === 'SENT' ? '-' : '+'}{(h.amount || 0).toLocaleString()}Y
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}

        {view === 'SLOT' && <ErrorBoundary onReset={() => setView('MENU')}><SlotMachine balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} vip={vipActive} /></ErrorBoundary>}
        {view === 'ROULETTE' && <ErrorBoundary onReset={() => setView('MENU')}><RouletteView balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} /></ErrorBoundary>}
        {view === 'REDBLACK' && <ErrorBoundary onReset={() => setView('MENU')}><RedBlackView balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} /></ErrorBoundary>}
        {view === 'POKER' && <ErrorBoundary onReset={() => setView('MENU')}><PokerView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} vip={vipActive} /></ErrorBoundary>}
        {view === 'RACE' && <ErrorBoundary onReset={() => setView('MENU')}><HorseRacing balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} vip={vipActive} items={items} useItem={useItem} /></ErrorBoundary>}
        {view === 'LABOR' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <WorkView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              job={job} licenses={licenses} jobRecord={jobRecord} workExp={workExp} workCool={workCool}
              saveWork={saveWork} rankingData={rankingData} onGroupWork={onGroupWork}
              miningBalance={casinoBalance} edu={edu} vip={vipActive}
              companies={companies} onCorpWork={onCorpWork} items={items} onUseItem={useItem}
              jobChanges={jobChanges} club={myClub} flySpend={fly.spend} />
          </ErrorBoundary>
        )}
        {view === 'SCHOOL' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <SchoolView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              edu={edu} licenses={licenses} items={items} workExp={workExp} saveEdu={saveWork}
              onUseItem={useItem} vip={vipActive}
              players={playerRows} country={myCountry} club={myClub} />
          </ErrorBoundary>
        )}
        {view === 'TRAVEL' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <TravelView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              travel={travel} saveTravel={saveTravel} vip={vipActive} licenses={licenses}
              job={job} wallet={wallet} saveWallet={saveWallet} house={house} companies={companies}
              arena={arena} onAirlineFare={onAirlineFare} />
          </ErrorBoundary>
        )}
        {view === 'CLUB' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <ClubView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              edu={edu} club={club} saveClub={saveClub} players={playerRows}
              workExp={workExp} saveWorkExp={addWorkExp} />
          </ErrorBoundary>
        )}
        {view === 'EXCHANGE' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <ExchangeView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName}
              wallet={wallet} saveWallet={saveWallet} vip={vipActive}
              house={house} companies={companies} fly={fly} arena={arena} fxHistory={fx.hist} country={myCountry} />
          </ErrorBoundary>
        )}
        {view === 'ARENA' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <ArenaView balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              club={club} saveClub={saveClub} arena={arena} workExp={workExp} saveWorkExp={addWorkExp} />
          </ErrorBoundary>
        )}
        {(view === 'CASINO_OFF' || view === 'CASINO_ON') && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <CasinoLobby mode={view === 'CASINO_ON' ? 'ONLINE' : 'OFFLINE'}
              balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')}
              onPick={(id) => setView(id)}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              vip={vipActive} highRoller={myCountry === 'GAMBLE'} countryName={myCountryInfo.name} />
          </ErrorBoundary>
        )}
        {view === 'PROFILE' && (
          <ErrorBoundary onReset={() => { setViewProfile(null); setView('MENU'); }}>
            <ProfileView balance={balance} onBack={() => { if (viewProfile) { setViewProfile(null); setView('RANKING'); } else setView('MENU'); }}
              showToast={showToast} playerName={playerName} vip={vipActive} isTop={topPlayer === playerName}
              job={job} edu={edu} licenses={licenses} workExp={workExp} companies={companies}
              profile={profile} ownedIcons={ownedIcons} ownedTags={ownedTags} stats={stats}
              netWorth={balance + bankBalance - loanBalance + gold * GOLD_BASE}
              onBuyIcon={buyIcon} onBuyTag={buyTag} onSaveProfile={saveProfile}
              viewing={viewProfile} canSeeDetail={!viewProfile || vipActive} />
          </ErrorBoundary>
        )}
        {view === 'CORP' && (
          <ErrorBoundary onReset={() => setView('MENU')}>
            <CorpView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')}
              showToast={showToast} playerName={playerName} emitNews={emitNews}
              licenses={licenses} marketMood={Math.max(-1, Math.min(1, marketProfit / 3000000))}
              onCorpTax={(t) => houseCorpTax(t)} edu={edu} />
          </ErrorBoundary>
        )}
        {view === 'LIFE' && <ErrorBoundary onReset={() => setView('MENU')}><LifeGame balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} vip={vipActive} /></ErrorBoundary>}
        {view === 'SHOP' && <ErrorBoundary onReset={() => setView('MENU')}><Shop balance={balance} vip={vip} vipSince={vipSince} vipSubUntil={vipSubUntil} vipActive={vipActive} delinquent={delinq.delinquent} delinquentInfo={delinq} items={items} gold={gold} goldPx={goldPx} marketProfit={marketProfit} vipPrice={vipPrice} vipSubPrice={vipSubPrice} staffOff={staffOff} onBuyVip={buyVip} onSubscribe={subscribeVip} onCancelSub={cancelVipSub} onBuyItem={buyItem} onTradeGold={tradeGold} ownedTags={ownedTags} onBuyTag={buyTag} onBack={() => setView('MENU')} showToast={showToast} /></ErrorBoundary>}
        {view === 'BLACKJACK' && <ErrorBoundary onReset={() => setView('MENU')}><Blackjack balance={balance} updateBalance={casinoBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} vip={vipActive} /></ErrorBoundary>}
        {view === 'JANKEN' && <ErrorBoundary onReset={() => setView('MENU')}><JankenView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} /></ErrorBoundary>}
        {view === 'INVEST' && <ErrorBoundary onReset={() => setView('MENU')}><InvestmentView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} /></ErrorBoundary>}

        {/* ===== BANK ===== */}
        {view === 'BANK' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <Panel gold className="p-6 md:p-8">
              <SectionTitle icon={<Landmark size={28} />} title="銀行"
                sub={`${bankName}・${acct.name} ／ 預金 30分 +${(myRate * 100).toFixed(2)}% ／ ローン 15分 +0.3%`} />

              {/* 口座を選ぶ */}
              <div className="mb-5">
                <div className="text-[11px] font-black text-gray-400 tracking-widest mb-2">どの銀行に預けますか</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {[{ id: 'YUTAPON', name: 'YUTAPON-BANK', rate: INTEREST_RATE_30MIN, sub: 'グループ直営・資産 ' + bigYen(houseTotal(house)) + ' G', safe: true },
                  ...companies.filter(c => c.isBank).map(c => ({
                    id: c.id, name: c.name, rate: c.rate || 0,
                    sub: `代表 ${c.owner}・支払い余力 ${bankPayable(c).toLocaleString()} Y`, safe: bankPayable(c) > 0,
                  }))].map(b => (
                    <button key={b.id} onClick={() => switchAccount(b.id, acctType)}
                      className={`p-3 rounded-2xl border-2 text-left transition ${bankId === b.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-black/40 hover:border-white/25'}`}>
                      <div className="flex items-center gap-1.5">
                        <Landmark size={14} className={bankId === b.id ? 'text-emerald-300' : 'text-gray-500'} />
                        <span className="font-black text-white text-sm truncate">{b.name}</span>
                        {b.id !== 'YUTAPON' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-black">BANK</span>}
                        <span className="ml-auto font-mono text-[12px] font-black text-emerald-300">{(b.rate * 100).toFixed(2)}%</span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{b.sub}</div>
                      {!b.safe && <div className="text-[10px] text-red-400 font-bold">現金が尽きていて利息が止まっています</div>}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-black text-gray-400 tracking-widest mb-2">口座の種類</div>
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_TYPES.map(a => (
                    <button key={a.key} onClick={() => switchAccount(bankId, a.key)}
                      className={`p-2.5 rounded-2xl border-2 text-left transition ${acctType === a.key ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:border-white/25'}`}>
                      <div className="text-lg leading-none mb-0.5">{a.icon}</div>
                      <div className="font-black text-white text-[12px]">{a.name}</div>
                      <div className="text-[9px] text-gray-500 leading-tight">{a.desc}</div>
                    </button>
                  ))}
                </div>
                {bankBalance > 0 && <p className="text-[10px] text-gray-500 mt-1.5">※ 銀行を変えるには先に全額引き出してください。</p>}
                {acctType === 'FIXED' && fixedUntil > Date.now() && (
                  <p className="text-[11px] text-amber-300 font-bold mt-1.5">🔒 引き出し可能まで あと {Math.ceil((fixedUntil - Date.now()) / 60000)} 分</p>
                )}
                {job?.key === 'BANKER' && (
                  <p className="text-[11px] text-sky-300 font-bold mt-1.5">🏦 行員特典で金利 +{(bankerRateBonus(job) * 100).toFixed(2)}％／30分</p>
                )}
              </div>
              <div className="bg-black/40 p-5 rounded-2xl border border-white/10 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-400">信用スコア</span>
                  <span className={`text-2xl font-black ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 mb-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, (creditScore / 200) * 100))}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>借入上限: <span className="text-white font-bold">{loanLimit.toLocaleString()} Y</span>{acct.loanMul !== 1 && <span className="text-emerald-300 font-bold"> ({acct.name} ×{acct.loanMul})</span>}</div>
                  <div>借入残高: <span className="text-red-400 font-bold">{loanBalance.toLocaleString()} Y</span></div>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl border border-white/10 p-4 mb-5 text-xs grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-gray-400 font-bold mb-1">📈 信用度UP</p>
                  <p className="text-emerald-400">・1万G以上預金 <span className="text-white font-bold">+1</span></p>
                  <p className="text-emerald-400">・5万G以上預金 <span className="text-white font-bold">+3</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-400 font-bold mb-1">📉 信用度DOWN</p>
                  <p className="text-red-400">・ローン借入 <span className="text-white font-bold">-5</span></p>
                  <p className="text-red-400">・ローン返済 <span className="text-white font-bold">-15</span></p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[['所持金', balance, 'text-amber-300'], ['預金残高', bankBalance, 'text-emerald-300'], ['ローン残高', loanBalance, 'text-red-300']].map(([label, val, color]) => (
                  <div key={label} className="bg-black/40 p-4 rounded-xl border border-white/10 text-center">
                    <span className="text-[10px] text-gray-400 block mb-1 font-bold">{label}</span>
                    <span className={`text-lg font-mono font-black ${color}`}>{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <label className="block text-sm text-gray-400 font-bold mb-2">💰 預金・引出</label>
                <div className="relative mb-3">
                  <input type="number" value={bankInput} onChange={e => setBankInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-black/50 text-white font-mono text-xl p-4 rounded-xl border border-white/10 focus:outline-none focus:border-emerald-500" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button onClick={() => setBankInput(String(balance))} className="bg-white/10 hover:bg-white/20 text-xs px-2 py-1 rounded font-bold transition">所持金</button>
                    <button onClick={() => setBankInput(String(bankBalance))} className="bg-white/10 hover:bg-white/20 text-xs px-2 py-1 rounded font-bold transition text-emerald-300">預金</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleBankAction('DEPOSIT')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black transition active:scale-95">預け入れる</button>
                  <button onClick={() => handleBankAction('WITHDRAW')} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-black border border-white/10 transition active:scale-95">引き出す</button>
                </div>
              </div>
              <div className="border-t border-white/10 pt-5">
                <label className="block text-sm text-gray-400 font-bold mb-2">🏦 借入・返済</label>
                <div className="relative mb-3">
                  <input type="number" value={loanInput} onChange={e => setLoanInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-black/50 text-white font-mono text-xl p-4 rounded-xl border border-white/10 focus:outline-none focus:border-red-500" />
                  <div className="absolute right-3 top-3">
                    <button onClick={() => setLoanInput(String(loanBalance))} className="bg-white/10 hover:bg-white/20 text-xs px-2 py-1 rounded font-bold transition text-red-300">全額返済</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLoan} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded-xl font-black transition active:scale-95">借入する（信用度-5）</button>
                  <button onClick={handleRepay} disabled={loanBalance <= 0} className="flex-1 bg-sky-700 hover:bg-sky-600 text-white py-3 rounded-xl font-black transition active:scale-95 disabled:opacity-40">返済する（信用度-15）</button>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ===== TRANSFER ===== */}
        {view === 'TRANSFER' && (
          <div className="p-6 md:p-12 max-w-2xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <Panel gold className="p-6 md:p-8">
              <SectionTitle icon={<Send size={28} />} title="ONLINE TRANSFER" sub="他のプレイヤーへ送金します" />
              <div className="bg-black/40 p-4 rounded-xl border border-white/10 mb-6 flex justify-between">
                <span className="text-sm text-gray-400 font-bold">所持金</span>
                <span className="text-xl font-mono font-black text-amber-300">{balance.toLocaleString()} Y</span>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">送金先プレイヤー名</label>
                  <input type="text" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} placeholder="相手の登録名"
                    className="w-full bg-black/50 text-white font-bold p-4 rounded-xl border border-white/10 focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">送金金額 (G)</label>
                  <div className="relative">
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="金額を入力"
                      className="w-full bg-black/50 text-white font-mono text-xl p-4 rounded-xl border border-white/10 focus:outline-none focus:border-sky-500" />
                    <button onClick={() => setTransferAmount(String(balance))} className="absolute right-3 top-3.5 bg-white/10 hover:bg-white/20 text-xs px-3 py-1.5 rounded font-bold transition">全額</button>
                  </div>
                </div>
              </div>
              <button onClick={handleTransfer} className="w-full bg-sky-600 hover:bg-sky-500 text-white py-4 rounded-xl font-black transition active:scale-95 text-lg flex items-center justify-center gap-2">
                <Send size={20} /> 送金を実行する
              </button>
            </Panel>
          </div>
        )}

        {/* ===== RANKING ===== */}
        {view === 'RANKING' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <Panel gold className="p-6 md:p-8">
              <SectionTitle icon={<Trophy size={28} />} title="LEADERBOARD" sub="プレイヤーと企業の総資産ランキング。YUTAPON-BANK も参戦" />
              {!vipActive && (
                <button onClick={() => setView('SHOP')} className="w-full mb-4 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-left hover:bg-amber-400/10 transition">
                  <span className="text-[11px] text-amber-200/80 font-bold flex items-center gap-1.5">
                    <Crown size={13} /> VIP会員になると、信用スコア・通算収支・参加日まで見られます
                  </span>
                </button>
              )}
              {/* YUTAPON-GROUP と3つの部署 */}
              <Panel gold className="p-4 mb-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <span className="text-[13px] font-black text-amber-200">🎰 YUTAPON-GROUP</span>
                  <span className="font-mono text-[13px] font-black text-emerald-300 tabular-nums">
                    グループ総資産 {bigYen(groupRow.total)} Y
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {groupRow.depts.map((d, i) => (
                    <div key={d.key} className="p-2.5 rounded-2xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-lg leading-none">{d.icon}</span>
                        <span className="text-[11px] font-black text-white truncate">{d.name}</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-gray-400 border border-white/10">
                          格 {i + 1}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{d.note}</div>
                      {d.total > 0 && (
                        <div className="font-mono text-[12px] font-black text-amber-300 tabular-nums">{bigYen(d.total)} Y</div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  ひとつのグループを3つの部署が支えています。格は FLY ＜ BANK ＜ CASINO の順で、
                  学校からの推薦も部署ごとに分かれています。BANK と CASINO は同じ金庫を共有しています。
                </p>
              </Panel>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { k: 'ALL', label: 'すべて', icon: <Trophy size={14} /> },
                  { k: 'PLAYER', label: 'プレイヤー', icon: <Users size={14} /> },
                  { k: 'CORP', label: '企業', icon: <Building2 size={14} /> },
                ].map(t => (
                  <button key={t.k} onClick={() => setRankTab(t.k)}
                    className={`py-2.5 rounded-xl font-black text-[13px] border-2 transition flex items-center justify-center gap-1.5
                      ${rankTab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {rankingData.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">プレイヤーがまだ存在しません。</p>
                ) : rankingData.map((player, index) => {
                  const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;

                  if (player.isCompany) {
                    const ct = corpTypeOf(player.type);
                    return (
                      <div key={'c-' + player.name + index}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all
                          ${player.owner === playerName ? 'bg-indigo-500/10 border-indigo-400/60' : 'bg-black/40 border-white/10'}`}>
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="w-8 text-center text-xl font-bold shrink-0">{rankBadge}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-lg flex items-center gap-1.5 truncate text-white">
                              <span className="text-xl">{ct?.icon || '🏢'}</span>{player.name}
                              {player.isBank && <span className="text-[10px] bg-emerald-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">BANK</span>}
                              <span className="text-[10px] bg-indigo-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">企業</span>
                              {player.owner === playerName && <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">YOU</span>}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 font-semibold">
                              <span>{ct?.name || '会社'}</span>
                              <span>代表:{player.owner}</span>
                              <span className="text-emerald-400/90">通算売上:{player.revenue.toLocaleString()}Y</span>
                              {player.isBank && <span className="text-sky-300">預かり:{player.deposits.toLocaleString()}Y</span>}
                              {player.sharesOut > 0 && <span className="text-amber-300">発行株:{player.sharesOut.toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-lg md:text-xl font-black text-indigo-300 shrink-0">{player.total.toLocaleString()} Y</span>
                      </div>
                    );
                  }

                  if (player.isBank) {
                    return (
                      <div key="yutapon-bank" className="flex items-center justify-between p-4 rounded-2xl border border-emerald-400/45 bg-gradient-to-r from-emerald-900/45 via-emerald-950/40 to-black/40">
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="w-8 text-center text-xl font-bold shrink-0">{rankBadge}</span>
                          <div className="min-w-0">
                            <span className="font-black text-lg flex items-center gap-1.5 text-emerald-300 truncate">
                              <Landmark size={17} className="shrink-0" /> YUTAPON-BANK
                              <span className="text-[10px] bg-emerald-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">BANK</span>
                              <span className="text-[10px] bg-indigo-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">企業</span>
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400 font-semibold">
                              <span>預かり:{player.deposits.toLocaleString()}Y</span>
                              <span className="text-amber-300">貸出:{player.loans.toLocaleString()}Y</span>
                              <span className={player.casinoTake >= 0 ? 'text-emerald-400' : 'text-red-400'}>カジノ収支:{player.casinoTake >= 0 ? '+' : ''}{player.casinoTake.toLocaleString()}Y</span>
                              <span className="text-sky-300">法人税:{player.corpTax.toLocaleString()}Y</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-lg md:text-xl font-black text-emerald-300 shrink-0">{bigYen(player.total)} Y</span>
                      </div>
                    );
                  }

                  const isSelf = player.name === playerName;
                  const title = jobLabel(player.job);
                  const pTags = (player.profile?.tags || [])
                    .map(k => availableTags({
                      job: player.job, edu: player.edu, licenses: player.licenses,
                      vip: player.vip, isTop: player.name === topPlayer, companies, name: player.name,
                      stats: player.stats, netWorth: player.total, ownedTags: player.ownedTags,
                    }).find(t => t.key === k)).filter(Boolean).slice(0, 3);
                  const isStaff = player.job?.key === 'BANKER' || player.job?.key === 'CASINOSTAFF';
                  return (
                    <button key={player.name + index} onClick={() => { setViewProfile({ ...player, netWorth: player.total }); setView('PROFILE'); }}
                      className={`w-full text-left flex items-center justify-between p-4 rounded-2xl border transition-all hover:border-amber-400/50 ${isSelf ? 'bg-amber-500/10 border-amber-500' : 'bg-black/40 border-white/10'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 text-center text-xl font-bold shrink-0">{rankBadge}</span>
                        <span className="w-10 h-10 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-center text-xl shrink-0">
                          {iconOf(player.profile?.icon).icon}
                        </span>
                        <div className="min-w-0">
                          <span className={`font-bold text-lg flex items-center gap-1.5 flex-wrap ${isSelf ? 'text-amber-300' : player.vip ? 'text-amber-200' : 'text-white'}`}>
                            {player.name}
                            {player.name === topPlayer && <TopBadge size="xs" />}
                            {player.vip && <VipBadge size="xs" />}
                            {isStaff && <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black shrink-0">YUTA職員</span>}
                            {isSelf && <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">YOU</span>}
                          </span>
                          {pTags.length > 0 && <div className="flex flex-wrap gap-1 my-0.5"><TagChips tags={pTags} /></div>}
                          {title && <div className="text-[11px] font-bold text-sky-300/90 truncate">{title}</div>}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500 font-semibold">
                            <span>手元:{player.balance.toLocaleString()}Y</span>
                            <span className="text-emerald-400/90">銀行:{player.bankBalance.toLocaleString()}Y</span>
                            <span className={player.loanBalance > 0 ? 'text-red-400' : ''}>ローン:{player.loanBalance.toLocaleString()}Y</span>
                            <span className={player.gold > 0 ? 'text-amber-400' : ''}>金:{player.gold.toLocaleString()}g</span>
                            {vipActive && <span className={getCreditColor(player.creditScore)}>信用 {getCreditLabel(player.creditScore)}({Math.floor(player.creditScore)})</span>}
                            {vipActive && (
                              <span className={player.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                通算 {player.profit >= 0 ? '+' : ''}{player.profit.toLocaleString()}Y
                              </span>
                            )}
                            {vipActive && player.createdAt > 0 && <span className="text-gray-600">{new Date(player.createdAt).toLocaleDateString('ja-JP')}〜</span>}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-lg md:text-xl font-black text-amber-300 shrink-0">{player.total.toLocaleString()} Y</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}
      </div>

      <footer className="py-6 border-t border-white/5 text-center text-[11px] text-gray-600 tracking-widest">
        © 2026 YUTAPON CASINO &amp; TURF — 20歳未満の入場はご遠慮ください（架空通貨Y）
      </footer>
    </div>
  );
}

/* ==========================================================
   NUMBER ROULETTE
   ポインタは真上（-π/2）。スライスiの中心が真上に来る角度を
   厳密に計算して停止させるため、見た目と当選が必ず一致する。
   ========================================================== */
const ROULETTE_ZONES = [
  { value: 1, label: '×1', color: '#15803d', textClass: 'text-green-400', borderClass: 'border-green-500', weight: 12 },
  { value: 3, label: '×3', color: '#1d4ed8', textClass: 'text-blue-400', borderClass: 'border-blue-500', weight: 9 },
  { value: 5, label: '×5', color: '#6d28d9', textClass: 'text-purple-400', borderClass: 'border-purple-500', weight: 6 },
  { value: 10, label: '×10', color: '#b45309', textClass: 'text-amber-400', borderClass: 'border-amber-500', weight: 4 },
  { value: 20, label: '×20', color: '#be123c', textClass: 'text-rose-400', borderClass: 'border-rose-500', weight: 2 },
];

function RouletteView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const WHEEL_SLOTS = useMemo(() => {
    const arr = ROULETTE_ZONES.flatMap(z => Array(z.weight).fill(z.value));
    // 同色が固まらないよう均等分散
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);
  const TOTAL_SLOTS = WHEEL_SLOTS.length;

  const [bets, setBets] = useState({ 1: 0, 3: 0, 5: 0, 10: 0, 20: 0 });
  const [phase, setPhase] = useState('BETTING');
  const [resultZone, setResultZone] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [stakedTotal, setStakedTotal] = useState(0);
  const [history, setHistory] = useState([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const waitRef = useRef(null);
  const angleRef = useRef(0);
  const phaseRef = useRef('BETTING');
  const autoRef = useRef(false);
  const betsRef = useRef(bets);
  const balanceRef = useRef(balance);
  const mountedRef = useRef(true);

  betsRef.current = bets;
  balanceRef.current = balance;
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { autoRef.current = autoSpin; }, [autoSpin]);

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

  const drawWheel = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 16;
    ctx.clearRect(0, 0, W, H);

    // 外枠
    ctx.beginPath(); ctx.arc(cx, cy, R + 11, 0, TAU);
    ctx.fillStyle = '#241a0b'; ctx.fill();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4; ctx.stroke();

    const slice = TAU / TOTAL_SLOTS;
    WHEEL_SLOTS.forEach((val, i) => {
      const zone = ROULETTE_ZONES.find(z => z.value === val);
      const startA = angle + i * slice - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, startA, startA + slice); ctx.closePath();
      ctx.fillStyle = zone.color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();

      const midA = startA + slice / 2;
      ctx.save();
      ctx.translate(cx + R * 0.72 * Math.cos(midA), cy + R * 0.72 * Math.sin(midA));
      ctx.rotate(midA + Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(11, Math.floor(R * 0.085))}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(val), 0, 0);
      ctx.restore();
    });

    // ハブ
    const hubR = R * 0.17;
    const g = ctx.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, 0, cx, cy, hubR);
    g.addColorStop(0, '#4b3a16'); g.addColorStop(1, '#120c04');
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${Math.floor(hubR * 0.9)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎡', cx, cy);

    // ポインタ（真上）
    const top = cy - R - 12;
    ctx.beginPath();
    ctx.moveTo(cx, top + 26); ctx.lineTo(cx - 12, top); ctx.lineTo(cx + 12, top); ctx.closePath();
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.stroke();
  }, [WHEEL_SLOTS, TOTAL_SLOTS]);

  useEffect(() => { drawWheel(angleRef.current); }, [drawWheel]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      clearInterval(waitRef.current);
    };
  }, []);

  const setBetFor = (value, amount) => {
    if (phaseRef.current !== 'BETTING') return;
    const num = Math.max(0, Math.floor(Number(amount) || 0));
    setBets(prev => ({ ...prev, [value]: num }));
  };
  const addBet = (value, amount) => setBetFor(value, (bets[value] || 0) + amount);
  const clearBets = () => setBets({ 1: 0, 3: 0, 5: 0, 10: 0, 20: 0 });

  const startWait = useCallback(() => {
    setPhase('WAIT'); phaseRef.current = 'WAIT';
    let c = 8; setCountdown(c);
    clearInterval(waitRef.current);
    waitRef.current = setInterval(() => {
      c -= 1; setCountdown(c);
      if (c <= 0) {
        clearInterval(waitRef.current);
        if (autoRef.current && mountedRef.current) executeSpin();
        else { setPhase('BETTING'); phaseRef.current = 'BETTING'; }
      }
    }, 1000);
  }, []);

  const executeSpin = useCallback(async () => {
    if (phaseRef.current === 'SPINNING') return;
    const bet = { ...betsRef.current };
    const total = Object.values(bet).reduce((a, b) => a + b, 0);
    if (total <= 0) { showToast('賭け金を設定してください！', 'error'); setPhase('BETTING'); phaseRef.current = 'BETTING'; autoRef.current = false; setAutoSpin(false); return; }
    if (total > balanceRef.current) { showToast('残高が足りません！', 'error'); setPhase('BETTING'); phaseRef.current = 'BETTING'; autoRef.current = false; setAutoSpin(false); return; }

    try { await updateBalance(-total); }
    catch (e) { setPhase('BETTING'); phaseRef.current = 'BETTING'; autoRef.current = false; setAutoSpin(false); return; }

    setStakedTotal(total);
    setResultZone(null); setWinAmount(0);
    setPhase('SPINNING'); phaseRef.current = 'SPINNING';

    const winIdx = Math.floor(Math.random() * TOTAL_SLOTS);
    const winValue = WHEEL_SLOTS[winIdx];
    const winZone = ROULETTE_ZONES.find(z => z.value === winValue);

    // スライスiの中心が真上に来る角度 = -(i+0.5)*slice
    const slice = TAU / TOTAL_SLOTS;
    const desired = (((-(winIdx + 0.5) * slice) % TAU) + TAU) % TAU;
    const current = ((angleRef.current % TAU) + TAU) % TAU;
    let delta = desired - current;
    if (delta < 0) delta += TAU;
    const spins = 5 + Math.floor(Math.random() * 3);
    const startAngle = angleRef.current;
    const targetAngle = startAngle + spins * TAU + delta;
    const duration = 4200 + Math.random() * 1200;
    const t0 = performance.now();

    const animate = (now) => {
      const raw = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      angleRef.current = startAngle + (targetAngle - startAngle) * eased;
      drawWheel(angleRef.current);
      if (raw < 1) { animRef.current = requestAnimationFrame(animate); return; }

      angleRef.current = targetAngle;
      drawWheel(targetAngle);
      if (!mountedRef.current) return;

      const payout = (bet[winValue] || 0) * winValue;
      if (payout > 0) updateBalance(payout).catch(() => {});
      setResultZone(winZone); setWinAmount(payout);
      setPhase('RESULT'); phaseRef.current = 'RESULT';
      setHistory(prev => [{ value: winValue, net: payout - total }, ...prev].slice(0, 12));

      if (payout > 0) {
        showToast(`🎡 ${winValue} エリア当選！ +${payout.toLocaleString()} Y`, 'success');
        if (payout - total >= 50000) emitNews(`🎡 ${playerName} がルーレットで ×${winValue} を的中！ +${(payout - total).toLocaleString()} Y！`, 'jackpot');
      } else {
        showToast(`😢 ${winValue} エリア…ハズレ`, 'error');
      }
      if (autoRef.current) setTimeout(() => { if (mountedRef.current) startWait(); }, 1200);
    };
    animRef.current = requestAnimationFrame(animate);
  }, [WHEEL_SLOTS, TOTAL_SLOTS, drawWheel, updateBalance, showToast, emitNews, playerName, startWait]);

  const toggleAuto = () => {
    const next = !autoSpin;
    setAutoSpin(next); autoRef.current = next;
    if (!next) {
      clearInterval(waitRef.current);
      if (phaseRef.current === 'WAIT') { setPhase('BETTING'); phaseRef.current = 'BETTING'; }
    } else if (phaseRef.current === 'BETTING') {
      executeSpin();
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="w-full flex justify-between items-center mb-5">
        <button onClick={() => { autoRef.current = false; onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} Y</div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[55%]">
          <Panel gold className="p-5 flex flex-col items-center gap-4">
            <div className="relative w-full flex justify-center">
              <canvas ref={canvasRef} width={480} height={480} className="w-full max-w-[460px] h-auto" />
              {phase === 'WAIT' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 rounded-full w-28 h-28 flex flex-col items-center justify-center border-2 border-amber-500/40">
                    <span className="text-amber-300 text-4xl font-black leading-none">{countdown}</span>
                    <span className="text-amber-300/70 text-[11px] font-bold mt-1">次のスピン</span>
                  </div>
                </div>
              )}
            </div>

            {phase === 'RESULT' && resultZone && (
              <div className={`w-full max-w-[460px] p-5 rounded-2xl border-2 text-center ${winAmount > 0 ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  <div>
                    <div className={`text-2xl font-black ${resultZone.textClass}`}>{resultZone.value} エリア</div>
                    <div className="text-gray-400 text-sm">倍率 <span className={`font-black ${resultZone.textClass}`}>×{resultZone.value}</span></div>
                  </div>
                  {winAmount > 0 ? (
                    <div className="text-right">
                      <div className="text-3xl font-black text-emerald-400">+{winAmount.toLocaleString()} Y</div>
                      <div className={`text-sm font-bold ${winAmount - stakedTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        収支 {winAmount - stakedTotal >= 0 ? '+' : ''}{(winAmount - stakedTotal).toLocaleString()} Y
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl font-black text-red-400">ハズレ</div>
                      <div className="text-red-400/80 text-sm">-{stakedTotal.toLocaleString()} Y</div>
                    </div>
                  )}
                </div>
                {!autoSpin && (
                  <GoldButton onClick={() => { setPhase('BETTING'); phaseRef.current = 'BETTING'; setResultZone(null); }} className="w-full mt-4 py-2.5">
                    次のスピンへ
                  </GoldButton>
                )}
              </div>
            )}

            {history.length > 0 && (
              <div className="w-full max-w-[460px] bg-black/40 border border-white/10 rounded-2xl p-3">
                <div className="text-[11px] font-black text-gray-400 tracking-[0.25em] mb-2">RECENT</div>
                <div className="flex flex-wrap gap-2">
                  {history.map((h, i) => {
                    const z = ROULETTE_ZONES.find(zz => zz.value === h.value);
                    return (
                      <div key={i} title={`${h.net >= 0 ? '+' : ''}${h.net.toLocaleString()} Y`}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black border-2 ${z.borderClass} ${h.net >= 0 ? 'ring-2 ring-emerald-400/40' : ''}`}
                        style={{ backgroundColor: z.color }}>{h.value}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="xl:w-[45%]">
          <Panel className="p-5 flex flex-col h-full">
            <h3 className="text-xl font-black text-white mb-0.5">🎡 ROULETTE BET</h3>
            <p className="text-gray-500 text-xs mb-4">賭けたいエリアに金額を入力（複数同時OK）</p>

            <div className="space-y-2.5 flex-1 mb-4">
              {ROULETTE_ZONES.map(zone => (
                <div key={zone.value} className={`p-3 rounded-xl border-2 transition ${bets[zone.value] > 0 ? `${zone.borderClass} bg-black/60` : 'border-white/10 bg-black/30'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm border-2 border-white/20 shrink-0" style={{ backgroundColor: zone.color }}>{zone.value}</div>
                    <div className="flex-1">
                      <div className={`font-black text-sm ${zone.textClass}`}>{zone.label} エリア</div>
                      <div className="text-gray-500 text-[11px]">当選確率 {Math.round((zone.weight / TOTAL_SLOTS) * 1000) / 10}%</div>
                    </div>
                    {bets[zone.value] > 0 && (
                      <div className={`text-[11px] font-bold ${zone.textClass}`}>→ {(bets[zone.value] * zone.value).toLocaleString()} Y</div>
                    )}
                  </div>
                  <input type="number" min="0" step="100" value={bets[zone.value] || ''} placeholder="0"
                    onChange={e => setBetFor(zone.value, e.target.value)} disabled={phase !== 'BETTING'}
                    className="w-full bg-black/60 text-white font-mono text-base p-2 rounded-lg border border-white/10 focus:outline-none focus:border-amber-400 disabled:opacity-50 mb-1.5" />
                  <div className="flex gap-1.5">
                    {[100, 500, 1000, 5000].map(v => (
                      <button key={v} onClick={() => addBet(zone.value, v)} disabled={phase !== 'BETTING'}
                        className="flex-1 bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white text-[11px] py-1 rounded transition disabled:opacity-40">
                        +{v >= 1000 ? v / 1000 + 'K' : v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm font-bold">合計ベット</span>
                <span className="font-mono text-xl font-black text-amber-300">{totalBet.toLocaleString()} Y</span>
              </div>
              <div className="flex gap-2">
                <button onClick={clearBets} disabled={phase !== 'BETTING'} className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-3 px-4 rounded-xl transition disabled:opacity-40 text-sm">クリア</button>
                <GoldButton onClick={executeSpin} disabled={phase !== 'BETTING' || totalBet <= 0 || totalBet > balance} className="flex-1 py-3 text-lg">
                  {phase === 'SPINNING' ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPINNING…</span>
                    : phase === 'WAIT' ? `${countdown} 秒後` : '🎡 SPIN！'}
                </GoldButton>
              </div>
              <button onClick={toggleAuto}
                className={`w-full py-3 rounded-xl font-black text-sm transition border-2 flex items-center justify-center gap-2 ${autoSpin ? 'bg-orange-600/20 border-orange-500 text-orange-300' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                <RefreshCw size={16} className={autoSpin ? 'animate-spin' : ''} />
                {autoSpin ? 'オートスピン ON — クリックでOFF' : 'オートスピン OFF — クリックでON'}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}


/* ==========================================================
   マインスイーパー採掘
   ========================================================== */

/* ==========================================================
   オンラインじゃんけん
   ========================================================== */
const JANKEN_HANDS = [
  { id: 'rock', label: 'グー', emoji: '✊', beats: 'scissors' },
  { id: 'scissors', label: 'チョキ', emoji: '✌️', beats: 'paper' },
  { id: 'paper', label: 'パー', emoji: '🖐️', beats: 'rock' },
];

function JankenView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [phase, setPhase] = useState('LOBBY');
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myHand, setMyHand] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [createBet, setCreateBet] = useState(100);
  const [gameResult, setGameResult] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [locked, setLocked] = useState(false);

  const phaseRef = useRef('LOBBY');
  const lockedRef = useRef(false);
  const resolvedRef = useRef(false);
  const isHostRef = useRef(false);
  const roomIdRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const roomsRef = useMemo(() => collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms'), []);
  const roomDoc = useCallback((id) => doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', id), []);

  // ロビー購読
  useEffect(() => {
    if (phase !== 'LOBBY') return;
    const q = query(roomsRef, orderBy('createdAt', 'desc'), limit(15));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list);
    });
    return () => unsub();
  }, [phase, roomsRef]);

  const resolveGame = useCallback(async (data) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    const host = isHostRef.current;
    const mine = host ? data.hostHand : data.guestHand;
    const theirs = host ? data.guestHand : data.hostHand;
    const mineData = JANKEN_HANDS.find(h => h.id === mine);
    const theirsData = JANKEN_HANDS.find(h => h.id === theirs);
    let result = 'DRAW';
    if (mineData && theirsData) {
      if (mineData.beats === theirs) result = 'WIN';
      else if (theirsData.beats === mine) result = 'LOSE';
    }
    const bet = data.bet || 0;
    try {
      if (result === 'WIN') await updateBalance(bet);
      else if (result === 'LOSE') await updateBalance(-bet);
    } catch (e) { /* noop */ }

    const opp = host ? data.guest : data.host;
    if (result === 'WIN') emitNews(`✊ ${playerName} が ${opp} とのじゃんけんに勝利！ +${bet.toLocaleString()} Y`, 'janken');
    if (!mountedRef.current) return;
    setGameResult({ result, mine, theirs, mineLabel: mineData?.label || '？', theirsLabel: theirsData?.label || '？', bet });
    setPhase('RESULT'); phaseRef.current = 'RESULT';
    try { await updateDoc(roomDoc(roomIdRef.current), { status: 'DONE' }); } catch (e) { /* noop */ }
  }, [updateBalance, emitNews, playerName, roomDoc]);

  // ルーム購読
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(roomDoc(roomId), snap => {
      if (!snap.exists()) {
        if (mountedRef.current) {
          showToast('ルームが解散されました。', 'warning');
          resetRoomState();
        }
        return;
      }
      const data = snap.data();
      setCurrentRoom(data);
      setOpponentName(isHostRef.current ? (data.guest || '') : (data.host || ''));
      if (data.hostHand && data.guestHand && phaseRef.current !== 'RESULT') resolveGame(data);
    });
    return () => unsub();
  }, [roomId, roomDoc, resolveGame, showToast]);

  // チャット購読
  useEffect(() => {
    if (!roomId) return;
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId, 'chat');
    const q = query(chatRef, orderBy('createdAt', 'asc'), limit(60));
    const unsub = onSnapshot(q, snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
    });
    return () => unsub();
  }, [roomId]);

  const submitHand = useCallback(async (handId, timeout = false) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setMyHand(handId);
    try {
      await updateDoc(roomDoc(roomIdRef.current), { [isHostRef.current ? 'hostHand' : 'guestHand']: handId });
      showToast(timeout ? '⏰ 時間切れ！ランダムで出しました' : `${JANKEN_HANDS.find(h => h.id === handId)?.emoji} を出しました！`, timeout ? 'warning' : 'info');
    } catch (e) { showToast('送信エラー', 'error'); }
  }, [roomDoc, showToast]);

  // 30秒タイマー（更新関数の中で副作用を起こさない）
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    if (timeLeft <= 0) {
      if (!lockedRef.current) submitHand(JANKEN_HANDS[Math.floor(Math.random() * 3)].id, true);
      return;
    }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, submitHand]);

  const resetRoomState = () => {
    setRoomId(null); roomIdRef.current = null;
    setCurrentRoom(null); setMyHand(null);
    setLocked(false); lockedRef.current = false;
    resolvedRef.current = false;
    setGameResult(null); setIsHost(false); isHostRef.current = false;
    setOpponentName(''); setChatMessages([]);
    setPhase('LOBBY'); phaseRef.current = 'LOBBY';
  };

  const createRoom = async () => {
    const bet = parseInt(createBet, 10);
    if (isNaN(bet) || bet < 10) { showToast('賭け金は10Y以上にしてください。', 'error'); return; }
    if (bet > balance) { showToast('所持金が足りません。', 'error'); return; }
    try {
      const ref = doc(roomsRef);
      await setDoc(ref, {
        host: playerName, guest: null, hostHand: null, guestHand: null,
        bet, status: 'WAITING', createdAt: Date.now(),
      });
      resolvedRef.current = false;
      setRoomId(ref.id); roomIdRef.current = ref.id;
      setIsHost(true); isHostRef.current = true;
      setPhase('ROOM');
      showToast('ルームを作成しました！', 'success');
    } catch (e) { showToast('ルーム作成エラー', 'error'); }
  };

  const joinRoom = async (room) => {
    if (room.guest) { showToast('このルームは満員です。', 'error'); return; }
    if (room.host === playerName) { showToast('自分のルームには参加できません。', 'error'); return; }
    if ((room.bet || 0) > balance) { showToast(`賭け金 ${(room.bet || 0).toLocaleString()} Y が足りません。`, 'error'); return; }
    try {
      await updateDoc(roomDoc(room.id), { guest: playerName, status: 'PLAYING' });
      resolvedRef.current = false;
      setRoomId(room.id); roomIdRef.current = room.id;
      setIsHost(false); isHostRef.current = false;
      setOpponentName(room.host);
      setPhase('ROOM');
      showToast('ルームに参加しました！', 'success');
    } catch (e) { showToast('参加エラー', 'error'); }
  };

  const startGame = async () => {
    if (!currentRoom?.guest) { showToast('相手の参加を待っています…', 'info'); return; }
    resolvedRef.current = false;
    setMyHand(null); setLocked(false); lockedRef.current = false; setGameResult(null);
    setTimeLeft(30);
    try { await updateDoc(roomDoc(roomId), { hostHand: null, guestHand: null, status: 'PLAYING' }); } catch (e) { /* noop */ }
    setPhase('PLAYING');
  };

  const guestReady = () => {
    resolvedRef.current = false;
    setMyHand(null); setLocked(false); lockedRef.current = false; setGameResult(null);
    setTimeLeft(30);
    setPhase('PLAYING');
  };

  const rematch = async () => {
    if (!roomId) return;
    resolvedRef.current = false;
    setMyHand(null); setLocked(false); lockedRef.current = false; setGameResult(null);
    setTimeLeft(30);
    try { await updateDoc(roomDoc(roomId), { hostHand: null, guestHand: null, status: 'PLAYING' }); } catch (e) { /* noop */ }
    setPhase('PLAYING');
  };

  const leaveRoom = async () => {
    if (isHostRef.current && roomIdRef.current) {
      try { await deleteDoc(roomDoc(roomIdRef.current)); } catch (e) { /* noop */ }
    }
    resetRoomState();
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    setChatInput('');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId, 'chat'),
        { sender: playerName, message: text.slice(0, 100), createdAt: Date.now() });
    } catch (e) { showToast('送信エラー', 'error'); }
  };

  const chatTime = ts => {
    const d = new Date(ts || Date.now());
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (phase === 'LOBBY') {
    const open = rooms.filter(r => !r.guest && r.status === 'WAITING' && r.host !== playerName);
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">✊ オンラインじゃんけん ✌️</h2>
          <p className="text-gray-400">リアルタイム2人対戦・30秒制限・チャット付き</p>
        </div>

        <Panel gold className="p-6 mb-6">
          <h3 className="text-lg font-black text-white mb-4">🆕 新しいルームを作る</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
            <div className="flex-1 w-full">
              <label className="text-[11px] text-gray-400 font-bold block mb-1">賭け金額 (G)</label>
              <input type="number" min="10" step="10" value={createBet} onChange={e => setCreateBet(e.target.value)}
                className="w-full bg-black/50 text-white font-mono text-xl p-3 rounded-xl border border-white/10 focus:outline-none focus:border-amber-400" />
            </div>
            <div className="text-gray-500 text-sm">
              <div>所持金: <span className="text-amber-300 font-bold">{balance.toLocaleString()} Y</span></div>
              <div className="text-[11px]">勝てば +{(parseInt(createBet, 10) || 0).toLocaleString()} / 負ければ -{(parseInt(createBet, 10) || 0).toLocaleString()}</div>
            </div>
          </div>
          <GoldButton onClick={createRoom} className="w-full py-3">ルームを作成する</GoldButton>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <span className="text-pink-300 font-black text-sm tracking-[0.2em]">🔍 参加可能なルーム</span>
            <span className="ml-auto text-xs text-gray-500">{open.length} 件</span>
          </div>
          <div className="p-3 space-y-2 min-h-[80px]">
            {open.length === 0
              ? <p className="text-gray-600 text-sm text-center py-6">現在参加できるルームはありません</p>
              : open.map(room => (
                <div key={room.id} className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10">
                  <div><span className="text-white font-bold">{room.host}</span><span className="text-gray-500 text-xs ml-2">のルーム</span></div>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-300 font-mono font-black">{(room.bet || 0).toLocaleString()} Y</span>
                    <button onClick={() => joinRoom(room)} className="bg-pink-600 hover:bg-pink-500 text-white text-sm font-black px-4 py-2 rounded-lg transition active:scale-95">参加する</button>
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <button onClick={leaveRoom} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
          <ArrowLeft size={18} /> {isHost ? 'ルームを解散' : 'ルームを退出'}
        </button>
        <div className="text-sm text-gray-400">賭け金: <span className="text-amber-300 font-black">{(currentRoom?.bet || 0).toLocaleString()} Y</span></div>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{balance.toLocaleString()} Y</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {phase === 'ROOM' && (
            <Panel gold className="p-8 text-center">
              <h3 className="text-2xl font-black text-white mb-4">🎮 ルーム待機中</h3>
              <div className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/10">
                <div className="flex justify-around items-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><span className="text-2xl">👤</span></div>
                    <div className="text-white font-bold">{currentRoom?.host || '...'}</div>
                    <div className="text-[11px] text-pink-300">HOST</div>
                  </div>
                  <div className="text-3xl text-gray-600 font-black">VS</div>
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${currentRoom?.guest ? 'bg-sky-500/20' : 'bg-white/5 animate-pulse'}`}>
                      <span className="text-2xl">{currentRoom?.guest ? '👤' : '⏳'}</span>
                    </div>
                    <div className={`font-bold ${currentRoom?.guest ? 'text-white' : 'text-gray-600'}`}>{currentRoom?.guest || '待機中...'}</div>
                    <div className="text-[11px] text-sky-300">GUEST</div>
                  </div>
                </div>
              </div>
              {isHost
                ? <GoldButton onClick={startGame} disabled={!currentRoom?.guest} className="w-full py-4 text-lg">
                    {currentRoom?.guest ? '✊ ゲームスタート！' : '相手の参加を待っています…'}
                  </GoldButton>
                : <button onClick={guestReady} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-4 rounded-xl text-lg transition active:scale-95">✊ 準備OK！</button>}
            </Panel>
          )}

          {phase === 'PLAYING' && (
            <Panel className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-white font-bold text-sm">あなた: <span className="text-pink-300">{playerName}</span></div>
                <div className={`text-4xl font-black ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>⏱ {timeLeft}</div>
                <div className="text-white font-bold text-sm">相手: <span className="text-sky-300">{opponentName || '...'}</span></div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 mb-6">
                <div className={`h-3 rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${(timeLeft / 30) * 100}%` }} />
              </div>
              <p className="text-center text-gray-400 font-bold mb-6">
                {locked ? `${JANKEN_HANDS.find(h => h.id === myHand)?.emoji} 手を出しました！相手を待っています…` : '手を選んでください！'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {JANKEN_HANDS.map(hand => (
                  <button key={hand.id} onClick={() => submitHand(hand.id)} disabled={locked}
                    className={`flex flex-col items-center justify-center p-5 rounded-2xl border-4 transition active:scale-95 ${myHand === hand.id ? 'border-amber-400 bg-amber-400/15' : locked ? 'border-white/10 bg-black/40 opacity-40' : 'border-white/10 bg-black/40 hover:border-pink-400'}`}>
                    <span className="text-4xl md:text-5xl mb-2">{hand.emoji}</span>
                    <span className="text-white font-black">{hand.label}</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {phase === 'RESULT' && gameResult && (
            <Panel className={`p-8 text-center border-4 ${gameResult.result === 'WIN' ? 'border-amber-400' : gameResult.result === 'LOSE' ? 'border-red-500' : 'border-white/20'}`}>
              <div className="text-6xl mb-3">{gameResult.result === 'WIN' ? '🏆' : gameResult.result === 'LOSE' ? '😢' : '🤝'}</div>
              <h3 className={`text-4xl font-black mb-4 ${gameResult.result === 'WIN' ? 'text-amber-300' : gameResult.result === 'LOSE' ? 'text-red-400' : 'text-gray-400'}`}>
                {gameResult.result === 'WIN' ? '勝ち！' : gameResult.result === 'LOSE' ? '負け…' : 'あいこ！'}
              </h3>
              <div className="flex justify-center items-center gap-8 mb-6">
                <div className="text-center">
                  <div className="text-5xl mb-1">{JANKEN_HANDS.find(h => h.id === gameResult.mine)?.emoji}</div>
                  <div className="text-pink-300 font-bold text-xs">{playerName}</div>
                </div>
                <div className="text-2xl text-gray-600 font-black">VS</div>
                <div className="text-center">
                  <div className="text-5xl mb-1">{JANKEN_HANDS.find(h => h.id === gameResult.theirs)?.emoji}</div>
                  <div className="text-sky-300 font-bold text-xs">{opponentName}</div>
                </div>
              </div>
              <div className={`text-2xl font-black mb-6 ${gameResult.result === 'WIN' ? 'text-emerald-400' : gameResult.result === 'LOSE' ? 'text-red-400' : 'text-gray-400'}`}>
                {gameResult.result === 'DRAW' ? '賭け金の移動なし' : `${gameResult.result === 'WIN' ? '+' : '-'}${gameResult.bet.toLocaleString()} Y`}
              </div>
              <div className="flex gap-3">
                <GoldButton onClick={rematch} className="flex-1 py-4">もう一度！</GoldButton>
                <button onClick={leaveRoom} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition">ルームを出る</button>
              </div>
            </Panel>
          )}
        </div>

        <Panel className="overflow-hidden flex flex-col" style={{ height: 480 }}>
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-pink-300 font-black text-sm tracking-[0.2em]">💬 ルームチャット</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0
              ? <p className="text-gray-600 text-xs text-center py-4">チャットを始めましょう！</p>
              : chatMessages.map(msg => (
                <div key={msg.id} className={`text-xs ${msg.sender === playerName ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block max-w-[85%] px-3 py-2 rounded-2xl ${msg.sender === playerName ? 'bg-pink-600/80 text-white' : 'bg-white/10 text-gray-200'}`}>
                    {msg.sender !== playerName && <div className="text-pink-300 font-bold mb-0.5">{msg.sender}</div>}
                    <div className="break-words">{msg.message}</div>
                    <div className="opacity-50 mt-0.5">{chatTime(msg.createdAt)}</div>
                  </div>
                </div>
              ))}
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="メッセージを入力..." maxLength={100}
              className="flex-1 bg-black/50 text-white text-sm p-2 rounded-lg border border-white/10 focus:outline-none focus:border-pink-500" />
            <button onClick={sendChat} className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 rounded-lg transition active:scale-95"><Send size={16} /></button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ==========================================================
   人物株投資
   ========================================================== */
function InvestmentView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [tab, setTab] = useState('BUY');
  const [targetInput, setTargetInput] = useState('');
  const [amountInput, setAmountInput] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [myInvestments, setMyInvestments] = useState([]);
  const [received, setReceived] = useState([]);
  const [netWorths, setNetWorths] = useState({});

  const investRef = useMemo(() => collection(db, 'artifacts', appId, 'public', 'data', 'investments'), []);

  useEffect(() => {
    if (!playerName) return;
    const unsub = onSnapshot(query(investRef, where('investor', '==', playerName)), snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMyInvestments(list);
    });
    return () => unsub();
  }, [playerName, investRef]);

  useEffect(() => {
    if (!playerName) return;
    const unsub = onSnapshot(query(investRef, where('target', '==', playerName)), snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReceived(list);
    });
    return () => unsub();
  }, [playerName, investRef]);

  const activeTargets = useMemo(
    () => [...new Set(myInvestments.filter(i => i.status === 'ACTIVE').map(i => i.target))].sort().join('|'),
    [myInvestments]
  );

  useEffect(() => {
    if (!activeTargets) return;
    const unsubs = activeTargets.split('|').filter(Boolean).map(target =>
      onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(target)), snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        setNetWorths(prev => ({ ...prev, [target]: (d.balance || 0) + (d.bankBalance || 0) - (d.loanBalance || 0) }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [activeTargets]);

  const valueOf = (inv, current) => {
    const base = inv.baseNetWorth;
    if (!base || base <= 0) return inv.principal;
    const cur = (current === undefined || current === null) ? base : current;
    const growth = ((cur - base) / base) * INVEST_GROWTH_DAMPING;
    return Math.max(0, Math.floor(inv.principal * (1 + growth)));
  };

  const invest = async () => {
    const target = targetInput.trim();
    const amount = parseInt(amountInput, 10);
    if (!target) { showToast('投資先のプレイヤー名を入力してください。', 'error'); return; }
    if (target === playerName) { showToast('自分自身には投資できません。', 'error'); return; }
    if (isNaN(amount) || amount < INVEST_MIN_AMOUNT) { showToast(`投資額は ${INVEST_MIN_AMOUNT.toLocaleString()}Y 以上にしてください。`, 'error'); return; }
    if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
    setBusy(true);
    try {
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(target));
      const snap = await getDoc(targetRef);
      if (!snap.exists()) { showToast(`「${target}」が見つかりません。`, 'error'); setBusy(false); return; }
      const d = snap.data();
      const baseNetWorth = (d.balance || 0) + (d.bankBalance || 0) - (d.loanBalance || 0);
      if (baseNetWorth <= 0) { showToast(`${target} の純資産が0以下のため投資できません。`, 'error'); setBusy(false); return; }

      const fee = Math.floor(amount * INVEST_FEE_RATE);
      const principal = amount - fee;
      await updateBalance(-amount);
      await updateDoc(targetRef, { balance: increment(fee) });
      await addDoc(investRef, {
        investor: playerName, target, amount, fee, principal,
        baseNetWorth, status: 'ACTIVE', createdAt: Date.now(),
      });
      showToast(`📈 ${target} に ${amount.toLocaleString()}Y 投資（${fee.toLocaleString()}Y 還元／元本 ${principal.toLocaleString()}Y）`, 'success');
      if (amount >= 50000) emitNews(`📈 ${playerName} が ${target} に ${amount.toLocaleString()}Y の大口投資！`, 'invest');
      setTargetInput('');
    } catch (e) { showToast('投資エラー', 'error'); }
    setBusy(false);
  };

  const sell = async (inv) => {
    if (inv.status !== 'ACTIVE' || busy) return;
    setBusy(true);
    const value = valueOf(inv, netWorths[inv.target]);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'investments', inv.id), {
        status: 'SOLD', soldAt: Date.now(), soldValue: value,
      });
      if (value > 0) await updateBalance(value);
      const profit = value - inv.amount;
      if (profit >= 0) {
        showToast(`✅ ${inv.target} 株を売却 +${value.toLocaleString()}Y（損益 +${profit.toLocaleString()}Y）`, 'success');
        if (profit >= 20000) emitNews(`📈 ${playerName} が ${inv.target} 株で +${profit.toLocaleString()}Y の利益確定！`, 'invest');
      } else {
        showToast(`📉 ${inv.target} 株を売却 ${value.toLocaleString()}Y（損益 ${profit.toLocaleString()}Y）`, 'warning');
      }
    } catch (e) { showToast('売却エラー', 'error'); }
    setBusy(false);
  };

  const fmt = ts => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const previewAmount = parseInt(amountInput, 10) || 0;
  const previewFee = Math.floor(previewAmount * INVEST_FEE_RATE);
  const active = myInvestments.filter(i => i.status === 'ACTIVE');
  const sold = myInvestments.filter(i => i.status !== 'ACTIVE');

  return (
    <div className="p-6 md:p-12 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
      <Panel gold className="p-6 md:p-8">
        <SectionTitle icon={<TrendingUp size={28} />} title="PERSON STOCK" sub="他プレイヤーに投資して成長の一部を分け合う" />

        <div className="bg-black/40 rounded-xl border border-white/10 p-4 mb-6 text-[12px] space-y-1 text-gray-400">
          <p className="text-gray-200 font-bold mb-1">📖 仕組み</p>
          <p>・投資額の<span className="text-cyan-300 font-bold">{Math.round(INVEST_FEE_RATE * 100)}%</span>は投資先へ即時還元。</p>
          <p>・残り<span className="text-cyan-300 font-bold">{Math.round((1 - INVEST_FEE_RATE) * 100)}%</span>が元本になり、投資先の純資産の変動率の<span className="text-cyan-300 font-bold">1/10</span>だけ連動。</p>
          <p>・例）10,000Y投資 → 1,000Y還元／元本9,000Y。投資先が+10%成長で元本+1%（9,090Y）。</p>
          <p>・好きなタイミングで売却するとその時点の評価額を受け取ります（下落時は元本も減少）。</p>
        </div>

        <div className="flex gap-2 mb-6">
          {[['BUY', '投資する'], ['HOLD', `保有 (${active.length})`], ['RECV', '受けた投資']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border ${tab === k ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-black/40 text-gray-400 border-white/10 hover:bg-white/10'}`}>{label}</button>
          ))}
        </div>

        {tab === 'BUY' && (
          <div>
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 mb-6 flex justify-between">
              <span className="text-sm text-gray-400 font-bold">所持金</span>
              <span className="text-xl font-mono font-black text-amber-300">{balance.toLocaleString()} Y</span>
            </div>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">投資先プレイヤー名</label>
                <input type="text" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="相手の登録名"
                  className="w-full bg-black/50 text-white font-bold p-4 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 font-bold mb-2">投資金額 (G)</label>
                <div className="relative">
                  <input type="number" min={INVEST_MIN_AMOUNT} value={amountInput} onChange={e => setAmountInput(e.target.value)}
                    className="w-full bg-black/50 text-white font-mono text-xl p-4 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-400" />
                  <button onClick={() => setAmountInput(String(balance))} className="absolute right-3 top-3.5 bg-white/10 hover:bg-white/20 text-xs px-3 py-1.5 rounded font-bold transition">全額</button>
                </div>
              </div>
            </div>
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 mb-6 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 text-[11px] block">投資先への還元</span><span className="text-cyan-300 font-mono font-bold">{previewFee.toLocaleString()} Y</span></div>
              <div><span className="text-gray-500 text-[11px] block">運用元本</span><span className="text-emerald-400 font-mono font-bold">{(previewAmount - previewFee).toLocaleString()} Y</span></div>
            </div>
            <button onClick={invest} disabled={busy} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-black transition active:scale-95 text-lg flex items-center justify-center gap-2 disabled:opacity-50">
              <TrendingUp size={20} /> 投資を実行する
            </button>
          </div>
        )}

        {tab === 'HOLD' && (
          <div className="space-y-3">
            {active.length === 0 && sold.length === 0 && <p className="text-center text-gray-500 py-12">投資履歴はまだありません。</p>}
            {active.map(inv => {
              const cur = netWorths[inv.target];
              const value = valueOf(inv, cur);
              const profit = value - inv.amount;
              const growth = inv.baseNetWorth > 0 && cur !== undefined ? ((cur - inv.baseNetWorth) / inv.baseNetWorth) * 100 : 0;
              return (
                <div key={inv.id} className="bg-black/40 p-4 rounded-xl border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-white font-bold text-lg">{inv.target}</span>
                      <span className="text-[11px] text-gray-500 ml-2">{fmt(inv.createdAt)}</span>
                    </div>
                    <span className="bg-cyan-500/10 text-cyan-300 text-[11px] font-bold px-2 py-1 rounded-full">保有中</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[12px] mb-3">
                    <div><span className="text-gray-500 block">元本</span><span className="text-white font-mono font-bold">{inv.principal.toLocaleString()}Y</span></div>
                    <div><span className="text-gray-500 block">対象の成長</span><span className={`font-mono font-bold ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</span></div>
                    <div><span className="text-gray-500 block">評価額</span><span className="text-amber-300 font-mono font-bold">{value.toLocaleString()}Y</span></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()}Y</span>
                    <GoldButton onClick={() => sell(inv)} disabled={busy} className="px-5 py-2 text-sm">売却する</GoldButton>
                  </div>
                </div>
              );
            })}
            {sold.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] text-gray-500 font-bold mb-2">売却済み</p>
                <div className="space-y-2">
                  {sold.slice(0, 10).map(inv => {
                    const profit = (inv.soldValue || 0) - inv.amount;
                    return (
                      <div key={inv.id} className="flex justify-between items-center text-[12px] p-3 rounded-lg bg-black/30 border border-white/10">
                        <div><span className="text-white font-bold">{inv.target}</span><span className="text-gray-600 ml-2">{fmt(inv.soldAt)}</span></div>
                        <span className={`font-mono font-black ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()}Y</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'RECV' && (
          <div className="space-y-2">
            {received.length === 0
              ? <p className="text-center text-gray-500 py-12">他のプレイヤーからの投資はまだありません。</p>
              : received.map(inv => (
                <div key={inv.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-black/40 border border-white/10">
                  <div>
                    <span className="text-white font-bold">{inv.investor}</span>
                    <span className="text-gray-600 text-[11px] ml-2">{fmt(inv.createdAt)}</span>
                    <span className={`text-[11px] ml-2 ${inv.status === 'ACTIVE' ? 'text-cyan-300' : 'text-gray-500'}`}>{inv.status === 'ACTIVE' ? '保有中' : '売却済'}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">+{(inv.fee || 0).toLocaleString()}Y 受取済</span>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
