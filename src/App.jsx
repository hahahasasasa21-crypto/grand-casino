import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch, addDoc, query, orderBy, limit, deleteDoc, where } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw, TrendingDown, TrendingUp, Lock, Star, Newspaper, Pickaxe, BookOpen, History, Spade } from 'lucide-react';
import { firebaseConfig, appId } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TAU = Math.PI * 2;

/* ==========================================================
   競馬イベント：解放
   ========================================================== */
const HORSE_RACING_EVENT_ACTIVE = true;

/* ==========================================================
   スロット定数
   ========================================================== */
const SYMBOLS = [
  { sym: '🍒', name: 'CHERRY', weight: 30 },
  { sym: '🍋', name: 'LEMON', weight: 25 },
  { sym: '🍊', name: 'ORANGE', weight: 20 },
  { sym: '🍇', name: 'GRAPE', weight: 15 },
  { sym: '🔔', name: 'BELL', weight: 10 },
  { sym: '🍉', name: 'MELON', weight: 8 },
  { sym: '💎', name: 'DIAMOND', weight: 5 },
  { sym: 'BAR', name: 'BAR', weight: 3 },
  { sym: '7️⃣', name: 'SEVEN', weight: 1 },
];
const SYMBOL_POOL = SYMBOLS.flatMap((s, idx) => Array(s.weight).fill(idx));
const PAYTABLE = [
  { combo: ['7️⃣','7️⃣','7️⃣'], mult: 100, label: 'JACKPOT!!!', color: 'text-red-400', glow: 'shadow-red-500/60' },
  { combo: ['BAR','BAR','BAR'], mult: 50, label: 'BIG BONUS!!', color: 'text-yellow-300', glow: 'shadow-yellow-400/60' },
  { combo: ['💎','💎','💎'], mult: 30, label: 'MEGA WIN!', color: 'text-blue-400', glow: 'shadow-blue-400/60' },
  { combo: ['🍉','🍉','🍉'], mult: 20, label: 'SUPER WIN!', color: 'text-green-400', glow: 'shadow-green-400/60' },
  { combo: ['🔔','🔔','🔔'], mult: 10, label: 'WIN!', color: 'text-yellow-400', glow: 'shadow-yellow-400/40' },
  { combo: ['🍇','🍇','🍇'], mult: 5, label: 'WIN!', color: 'text-purple-400', glow: 'shadow-purple-400/40' },
  { combo: ['🍊','🍊','🍊'], mult: 4, label: 'WIN!', color: 'text-orange-400', glow: 'shadow-orange-400/40' },
  { combo: ['🍋','🍋','🍋'], mult: 3, label: 'WIN!', color: 'text-yellow-400', glow: 'shadow-yellow-400/40' },
  { combo: ['🍒','🍒','🍒'], mult: 3, label: 'WIN!', color: 'text-red-400', glow: 'shadow-red-400/40' },
];
// 3×3の有効ライン（インデックスは row*3 + col）
const SLOT_LINES = [
  { cells: [0,1,2], name: '上段' },
  { cells: [3,4,5], name: '中段' },
  { cells: [6,7,8], name: '下段' },
  { cells: [0,4,8], name: '右下がり' },
  { cells: [2,4,6], name: '右上がり' },
];

/* ==========================================================
   競馬定数
   ========================================================== */
const RUNNING_STYLES = {
  NIGE: { label: '逃げ', early: 1.22, late: 0.88 },
  SENKO: { label: '先行', early: 1.10, late: 0.97 },
  SASHI: { label: '差し', early: 0.92, late: 1.13 },
  OIKOMI: { label: '追込', early: 0.82, late: 1.26 },
};
const HORSE_ROSTER = [
  { id: 1, name: 'シンボリルドルフ', jockey: '岡部幸雄', color: '#f8fafc', textColor: '#0f172a', power: 92, stamina: 90, style: 'SENKO', turf: '良' },
  { id: 2, name: 'トウカイテイオー', jockey: '安田隆行', color: '#111827', textColor: '#f9fafb', power: 90, stamina: 84, style: 'SASHI', turf: '良' },
  { id: 3, name: 'オグリキャップ', jockey: '武豊', color: '#dc2626', textColor: '#ffffff', power: 88, stamina: 92, style: 'OIKOMI', turf: '稍重' },
  { id: 4, name: 'ディープインパクト', jockey: '横山典弘', color: '#2563eb', textColor: '#ffffff', power: 95, stamina: 86, style: 'OIKOMI', turf: '良' },
  { id: 5, name: 'ゴールドシップ', jockey: '内田博幸', color: '#ca8a04', textColor: '#1f2937', power: 84, stamina: 95, style: 'OIKOMI', turf: '重' },
  { id: 6, name: 'ナリタブライアン', jockey: '南井克巳', color: '#16a34a', textColor: '#ffffff', power: 91, stamina: 88, style: 'SENKO', turf: '良' },
  { id: 7, name: 'テイエムオペラオー', jockey: '和田竜二', color: '#9333ea', textColor: '#ffffff', power: 87, stamina: 91, style: 'SASHI', turf: '稍重' },
  { id: 8, name: 'サイレンススズカ', jockey: '上村洋行', color: '#0891b2', textColor: '#ffffff', power: 89, stamina: 78, style: 'NIGE', turf: '良' },
];
const COURSES = [
  { name: '中山・芝2500m', distance: 2500, staminaBias: 1.25 },
  { name: '東京・芝2400m', distance: 2400, staminaBias: 1.15 },
  { name: '阪神・芝2000m', distance: 2000, staminaBias: 1.0 },
  { name: '中京・芝1600m', distance: 1600, staminaBias: 0.85 },
  { name: '京都・芝1200m', distance: 1200, staminaBias: 0.7 },
];
const WEATHERS = [
  { name: '晴れ', turf: '良', icon: '☀️' },
  { name: '曇り', turf: '良', icon: '☁️' },
  { name: '小雨', turf: '稍重', icon: '🌦️' },
  { name: '雨', turf: '重', icon: '🌧️' },
  { name: '大雨', turf: '不良', icon: '⛈️' },
];
const TURF_COLOR = { '良': 'text-emerald-400', '稍重': 'text-yellow-400', '重': 'text-orange-400', '不良': 'text-red-400' };
const BET_TYPES = {
  WIN:    { label: '単勝', desc: '1着を当てる', picks: 1 },
  PLACE:  { label: '複勝', desc: '3着以内に入れば的中', picks: 1 },
  QUINELLA: { label: '馬連', desc: '1・2着の組み合わせ（順不同）', picks: 2 },
  EXACTA: { label: '馬単', desc: '1・2着を着順どおり', picks: 2 },
  WIDE:   { label: 'ワイド', desc: '選んだ2頭が共に3着以内', picks: 2 },
};

/* ==========================================================
   英単語定数
   ========================================================== */
const WORD_LEVELS = [
  { words: [
    { en: 'apple', ja: 'りんご' }, { en: 'book', ja: '本' }, { en: 'cat', ja: 'ねこ' },
    { en: 'dog', ja: 'いぬ' }, { en: 'egg', ja: 'たまご' }, { en: 'fish', ja: 'さかな' },
    { en: 'gold', ja: 'きん' }, { en: 'hat', ja: 'ぼうし' }, { en: 'ice', ja: 'こおり' },
    { en: 'job', ja: 'しごと' }, { en: 'key', ja: 'かぎ' }, { en: 'lion', ja: 'ライオン' },
  ], reward: 50, label: '初級', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  { words: [
    { en: 'mountain', ja: 'やま' }, { en: 'river', ja: 'かわ' }, { en: 'school', ja: 'がっこう' },
    { en: 'doctor', ja: 'いしゃ' }, { en: 'flower', ja: 'はな' }, { en: 'garden', ja: 'にわ' },
    { en: 'hospital', ja: 'びょういん' }, { en: 'island', ja: 'しま' }, { en: 'journey', ja: 'たび' },
    { en: 'kitchen', ja: 'だいどころ' }, { en: 'library', ja: 'としょかん' }, { en: 'mirror', ja: 'かがみ' },
  ], reward: 150, label: '中級', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { words: [
    { en: 'democracy', ja: 'みんしゅしゅぎ' }, { en: 'philosophy', ja: 'てつがく' },
    { en: 'algorithm', ja: 'アルゴリズム' }, { en: 'archaeology', ja: 'こうこがく' },
    { en: 'bureaucracy', ja: 'かんりょうせい' }, { en: 'catastrophe', ja: 'だいさんじ' },
    { en: 'entrepreneur', ja: 'きぎょうか' }, { en: 'fluorescent', ja: 'けいこうとう' },
    { en: 'guillotine', ja: 'ギロチン' }, { en: 'hippopotamus', ja: 'カバ' },
    { en: 'infrastructure', ja: 'インフラ' }, { en: 'jurisdiction', ja: 'かんかつ' },
  ], reward: 400, label: '上級', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
];

/* ==========================================================
   採掘定数
   ========================================================== */
const MINE_LEVELS = [
  { label: '浅坑道', cost: 200, rows: 6, cols: 8, mines: 8, reward: 800, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: '⛏️' },
  { label: '中層坑道', cost: 500, rows: 8, cols: 10, mines: 18, reward: 2500, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '🪨' },
  { label: '深層坑道', cost: 1500, rows: 10, cols: 12, mines: 40, reward: 8000, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: '💣' },
  { label: '地獄坑道', cost: 5000, rows: 10, cols: 14, mines: 65, reward: 30000, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '☠️' },
];

/* ==========================================================
   金融定数
   ========================================================== */
const INTEREST_RATE_30MIN = 0.001;
const INTEREST_INTERVAL = 1800000;
const LOAN_INTEREST_RATE = 0.003;
const LOAN_INTERVAL = 900000;

/* ==========================================================
   投資（人物株）定数
   投資額の10%は対象へ即時還元、残り90%が元本。
   元本は対象の純資産変動率の1/10だけ連動する。
   例）10,000G投資 → 1,000G還元 / 元本9,000G。対象が+10%成長 → 元本+1%（9,090G）。
   ========================================================== */
const INVEST_FEE_RATE = 0.1;
const INVEST_GROWTH_DAMPING = 0.1;
const INVEST_MIN_AMOUNT = 100;

/* ==========================================================
   トランプ共通（ポーカー用）
   ========================================================== */
const CARD_SUITS = [
  { s: '♠', red: false }, { s: '♥', red: true }, { s: '♦', red: true }, { s: '♣', red: false },
];
const CARD_RANK_LABEL = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };

function buildDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return deck;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const HAND_NAMES = ['ハイカード','ワンペア','ツーペア','スリーカード','ストレート','フラッシュ','フルハウス','フォーカード','ストレートフラッシュ','ロイヤルフラッシュ'];

// 7枚から最強の5枚役を評価。数値が大きいほど強い。
function evaluateHand(cards) {
  const rankCount = {};
  const suitCount = [0, 0, 0, 0];
  cards.forEach(c => {
    rankCount[c.r] = (rankCount[c.r] || 0) + 1;
    suitCount[c.s]++;
  });
  const flushSuit = suitCount.findIndex(n => n >= 5);

  const straightTop = (ranksSet) => {
    const uniq = [...new Set(ranksSet)].sort((a, b) => b - a);
    if (uniq.includes(14)) uniq.push(1); // A-2-3-4-5
    let run = 1;
    for (let i = 1; i < uniq.length; i++) {
      if (uniq[i] === uniq[i - 1] - 1) {
        run++;
        if (run >= 5) return uniq[i] + 4;
      } else run = 1;
    }
    return 0;
  };

  let category = 0, tiebreak = [];

  if (flushSuit >= 0) {
    const fRanks = cards.filter(c => c.s === flushSuit).map(c => c.r);
    const sfTop = straightTop(fRanks);
    if (sfTop >= 5) {
      category = sfTop === 14 ? 9 : 8;
      tiebreak = [sfTop];
      return { category, value: category * 1e10 + sfTop * 1e8, name: HAND_NAMES[category] };
    }
  }

  const groups = Object.keys(rankCount)
    .map(Number)
    .sort((a, b) => (rankCount[b] - rankCount[a]) || (b - a));
  const counts = groups.map(r => rankCount[r]);

  if (counts[0] === 4) { category = 7; tiebreak = [groups[0], groups[1]]; }
  else if (counts[0] === 3 && counts[1] >= 2) { category = 6; tiebreak = [groups[0], groups[1]]; }
  else if (flushSuit >= 0) {
    category = 5;
    tiebreak = cards.filter(c => c.s === flushSuit).map(c => c.r).sort((a, b) => b - a).slice(0, 5);
  } else {
    const sTop = straightTop(cards.map(c => c.r));
    if (sTop >= 5) { category = 4; tiebreak = [sTop]; }
    else if (counts[0] === 3) { category = 3; tiebreak = [groups[0], groups[1], groups[2]]; }
    else if (counts[0] === 2 && counts[1] === 2) { category = 2; tiebreak = [groups[0], groups[1], groups[2]]; }
    else if (counts[0] === 2) { category = 1; tiebreak = [groups[0], groups[1], groups[2], groups[3]]; }
    else { category = 0; tiebreak = groups.slice(0, 5); }
  }

  let value = category * 1e10;
  tiebreak.slice(0, 5).forEach((r, i) => { value += r * Math.pow(15, 4 - i) * 100; });
  return { category, value, name: HAND_NAMES[category] };
}

// CPU用：残りデッキからランダムに埋めて勝率を概算
function estimateEquity(hole, board, deck, trials = 140) {
  let win = 0, tie = 0;
  for (let t = 0; t < trials; t++) {
    const d = shuffle(deck);
    let idx = 0;
    const fullBoard = [...board];
    while (fullBoard.length < 5) fullBoard.push(d[idx++]);
    const oppHole = [d[idx++], d[idx++]];
    const me = evaluateHand([...hole, ...fullBoard]).value;
    const op = evaluateHand([...oppHole, ...fullBoard]).value;
    if (me > op) win++; else if (me === op) tie++;
  }
  return (win + tie * 0.5) / trials;
}

/* ==========================================================
   ニュース投稿
   ========================================================== */
async function postNews(dbRef, appIdRef, message, type = 'info') {
  try {
    const newsRef = collection(dbRef, 'artifacts', appIdRef, 'public', 'data', 'news');
    await addDoc(newsRef, { message, type, createdAt: Date.now() });
  } catch (e) { console.error('news post error', e); }
}

/* ==========================================================
   共通UIパーツ（カジノ調）
   ========================================================== */
function FeltBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[#07100c]" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(21,94,60,0.45) 0%, rgba(7,16,12,0) 60%)'
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 7px)'
      }} />
      <div className="absolute -top-24 left-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl bg-amber-500/10" />
      <div className="absolute bottom-0 right-1/5 w-[28rem] h-[28rem] rounded-full blur-3xl bg-emerald-500/10" />
    </div>
  );
}

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

function Chip({ value, color = '#b91c1c', size = 40 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-black text-white shadow-lg border-[3px] border-dashed border-white/70"
      style={{ width: size, height: size, background: color, fontSize: size * 0.3 }}
    >
      {value}
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
      <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20">{icon}</div>
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h2>
        {sub && <p className="text-xs md:text-sm text-amber-200/60 font-semibold">{sub}</p>}
      </div>
    </div>
  );
}

function PlayingCard({ card, hidden = false, small = false, dim = false }) {
  const w = small ? 'w-11 h-16 text-base' : 'w-16 h-24 text-2xl md:w-20 md:h-28';
  if (hidden || !card) {
    return (
      <div className={`${w} rounded-lg border-2 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-xl`}>
        <div className="w-[70%] h-[80%] rounded border border-amber-400/30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(251,191,36,0.18) 0 4px, transparent 4px 8px)'
        }} />
      </div>
    );
  }
  const suit = CARD_SUITS[card.s];
  return (
    <div className={`${w} rounded-lg bg-gradient-to-b from-white to-slate-100 border border-slate-300 shadow-xl flex flex-col items-center justify-center font-black ${dim ? 'opacity-50' : ''} ${suit.red ? 'text-red-600' : 'text-slate-900'}`}>
      <span className="leading-none">{CARD_RANK_LABEL[card.r]}</span>
      <span className="leading-none">{suit.s}</span>
    </div>
  );
}

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
  const [view, setView] = useState('LOGIN');
  const [loadingMsg, setLoadingMsg] = useState('通信を確立中...');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');
  const [rankingData, setRankingData] = useState([]);
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
        setTransferHistory(d.transferHistory || []);
        calcOfflineInterest(d, docRef);
        calcLoanInterest(d, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000, bankBalance: 0, loanBalance: 0,
          creditScore: 100, lastInterestTime: now, lastLoanTime: now,
          createdAt: now, name: playerName, password: passwordRef.current,
          transferHistory: []
        });
      }
    });
    return () => unsub();
  }, [user, playerName, playerRef]);

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
      const interest = Math.floor(bankBalance * INTEREST_RATE_30MIN);
      if (interest > 0) {
        updateDoc(docRef, { bankBalance: increment(interest), lastInterestTime: Date.now() });
        showToast(`🏦 銀行利子 +${interest.toLocaleString()} G！`, 'success');
      }
    }, INTEREST_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, bankBalance, playerRef, showToast]);

  // ローン利息（15分ごと）
  useEffect(() => {
    if (!user || !playerName || loanBalance <= 0) return;
    const timer = setInterval(() => {
      const docRef = playerRef(playerName);
      const interest = Math.floor(loanBalance * LOAN_INTEREST_RATE);
      if (interest > 0) {
        updateDoc(docRef, { loanBalance: increment(interest), lastLoanTime: Date.now() });
        showToast(`💸 ローン利息 +${interest.toLocaleString()} G！`, 'warning');
      }
    }, LOAN_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, loanBalance, playerRef, showToast]);

  // ランキング購読
  useEffect(() => {
    if (!user || (view !== 'RANKING' && view !== 'MENU')) return;
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsub = onSnapshot(collRef, snap => {
      const players = [];
      snap.forEach(d => {
        const data = d.data();
        let name = data.name;
        if (!name) { try { name = decodeURIComponent(d.id); } catch (e) { name = d.id; } }
        players.push({
          name,
          balance: data.balance || 0,
          bankBalance: data.bankBalance || 0,
          loanBalance: data.loanBalance || 0,
          creditScore: data.creditScore ?? 100,
          total: (data.balance || 0) + (data.bankBalance || 0) - (data.loanBalance || 0)
        });
      });
      players.sort((a, b) => b.total - a.total);
      setRankingData(players.slice(0, 10));
    });
    return () => unsub();
  }, [user, view]);

  const calcOfflineInterest = async (data, docRef) => {
    const now = Date.now();
    const diff = now - (data.lastInterestTime || now);
    if (diff >= INTEREST_INTERVAL && (data.bankBalance || 0) > 0) {
      const periods = Math.min(Math.floor(diff / INTEREST_INTERVAL), 500);
      let bank = data.bankBalance, total = 0;
      for (let i = 0; i < periods; i++) { const int = Math.floor(bank * INTEREST_RATE_30MIN); total += int; bank += int; }
      if (total > 0) {
        await updateDoc(docRef, { bankBalance: increment(total), lastInterestTime: now });
        showToast(`🏦 不在中の利子 +${total.toLocaleString()} G！`, 'success');
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
      if (total > 0) {
        await updateDoc(docRef, { loanBalance: increment(total), lastLoanTime: now });
        showToast(`💸 不在中のローン利息 +${total.toLocaleString()} G`, 'warning');
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
      showToast('【救済】1,000G を受け取りました！', 'success');
    } else showToast('まだ資産があります！', 'error');
  };

  const handleBankAction = async (action) => {
    const amount = parseInt(bankInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    const docRef = playerRef(playerName);
    if (action === 'DEPOSIT') {
      if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
      const creditBonus = amount >= 50000 ? 3 : amount >= 10000 ? 1 : 0;
      await updateDoc(docRef, {
        balance: increment(-amount),
        bankBalance: increment(amount),
        lastInterestTime: Date.now(),
        ...(creditBonus > 0 ? { creditScore: increment(creditBonus) } : {})
      });
      showToast(`🏦 ${amount.toLocaleString()} G 預け入れました。${creditBonus > 0 ? ` 信用度 +${creditBonus}` : ''}`, 'success');
    } else {
      if (bankBalance < amount) { showToast('銀行残高が足りません！', 'error'); return; }
      await updateDoc(docRef, { balance: increment(amount), bankBalance: increment(-amount) });
      showToast(`🏦 ${amount.toLocaleString()} G 引き出しました。`, 'success');
    }
    setBankInput('');
  };

  const handleLoan = async () => {
    const amount = parseInt(loanInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    const maxLoan = Math.floor(creditScore * 1000);
    if (maxLoan <= 0) { showToast('信用度が不足していて借入できません。', 'error'); return; }
    if (loanBalance + amount > maxLoan) {
      showToast(`上限 ${maxLoan.toLocaleString()} G まで借りられます！`, 'error'); return;
    }
    await updateDoc(playerRef(playerName), {
      balance: increment(amount),
      loanBalance: increment(amount),
      lastLoanTime: Date.now(),
      creditScore: increment(-5)
    });
    showToast(`💰 ${amount.toLocaleString()} G 借入しました。信用度 -5`, 'warning');
    setLoanInput('');
  };

  const handleRepay = async () => {
    const amount = parseInt(loanInput, 10);
    if (isNaN(amount) || amount <= 0) { showToast('有効な数値を入力してください。', 'error'); return; }
    if (balance < amount) { showToast('所持金が足りません！', 'error'); return; }
    if (loanBalance < amount) { showToast('返済額がローン残高を超えています！', 'error'); return; }
    await updateDoc(playerRef(playerName), {
      balance: increment(-amount),
      loanBalance: increment(-amount),
      creditScore: increment(-15)
    });
    showToast(`✅ ${amount.toLocaleString()} G 返済！信用度 -15`, 'warning');
    setLoanInput('');
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
        await postNews(db, appId, `💸 ${playerName} → ${target} へ ${amount.toLocaleString()} G の大口送金！`, 'transfer');
      }
      showToast(`💸 ${target} へ ${amount.toLocaleString()} G 送金！`, 'success');
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch (e) { showToast('送金エラー', 'error'); }
  };

  const emitNews = useCallback((msg, type) => { postNews(db, appId, msg, type); }, []);

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
  };

  const gameCards = [
    { id: 'SLOT', tag: 'Casino', title: 'SLOT MACHINE', desc: '3×3・5ライン判定（判定ズレ修正済み）', emoji: '🎰', ring: 'from-purple-900/70 to-indigo-950' },
    { id: 'ROULETTE', tag: 'Casino', title: 'NUMBER ROULETTE', desc: '数字エリア・矢印位置で厳密判定', emoji: '🎡', ring: 'from-red-900/70 to-rose-950' },
    { id: 'REDBLACK', tag: 'Casino', title: 'RED & BLACK', desc: 'コインを置いて赤黒2倍・数字36倍', emoji: '🔴', ring: 'from-rose-900/70 to-neutral-950' },
    { id: 'POKER', tag: 'Card Room', title: "TEXAS HOLD'EM", desc: '本格テーブル・ディーラーと1対1', emoji: '🃏', ring: 'from-emerald-900/70 to-green-950' },
    { id: 'RACE', tag: 'Racing', title: 'VIRTUAL TURF', desc: '8頭立て・脚質/馬場/5券種', emoji: '🏇', ring: 'from-lime-900/70 to-emerald-950' },
    { id: 'JANKEN', tag: 'Online', title: 'オンラインじゃんけん', desc: 'ルーム制2人対戦・チャット付き', emoji: '✊', ring: 'from-pink-900/70 to-rose-950' },
  ];

  if (loadingMsg) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#07100c] text-white">
      <FeltBackdrop />
      <RefreshCw className="animate-spin text-amber-400 mb-4" size={48} />
      <p className="font-bold text-lg tracking-widest">{loadingMsg}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white font-sans relative flex flex-col justify-between">
      <FeltBackdrop />

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
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 mb-1 tracking-tight">GRAND CASINO</h1>
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
                <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-1">GRAND CASINO</h1>
                <p className="text-gray-400 font-medium">おかえりなさい、<span className="text-white font-bold">{playerName}</span> 様</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="bg-black/50 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center gap-3">
                  <Coins className="text-amber-400" size={20} />
                  <div><span className="text-[10px] text-gray-400 font-bold block">所持金</span><span className="font-mono text-lg font-black text-amber-300">{balance.toLocaleString()} G</span></div>
                </div>
                <div className="bg-black/50 border border-emerald-500/20 px-4 py-3 rounded-2xl flex items-center gap-3">
                  <Landmark className="text-emerald-400" size={20} />
                  <div><span className="text-[10px] text-gray-400 font-bold block">銀行残高</span><span className="font-mono text-lg font-black text-emerald-300">{bankBalance.toLocaleString()} G</span></div>
                </div>
                {loanBalance > 0 && (
                  <div className="bg-black/50 border border-red-500/30 px-4 py-3 rounded-2xl flex items-center gap-3">
                    <TrendingDown className="text-red-400" size={20} />
                    <div><span className="text-[10px] text-gray-400 font-bold block">ローン残高</span><span className="font-mono text-lg font-black text-red-300">{loanBalance.toLocaleString()} G</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <div>
                  <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">Game Floor</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gameCards.filter(g => g.id !== 'RACE' || HORSE_RACING_EVENT_ACTIVE).map(g => (
                      <button key={g.id} onClick={() => setView(g.id)}
                        className={`group relative overflow-hidden bg-gradient-to-br ${g.ring} p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-amber-400/50 transition-all transform hover:-translate-y-1 text-left`}>
                        <div className="absolute -top-6 -right-4 text-[110px] leading-none opacity-10 group-hover:opacity-20 transition select-none">{g.emoji}</div>
                        <span className="bg-black/40 text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-amber-300/20">{g.tag}</span>
                        <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-amber-200 transition">{g.title}</h2>
                        <p className="text-gray-400 text-sm">{g.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-amber-200/50 uppercase tracking-[0.3em] font-bold mb-3">Work</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setView('LABOR')} className="group relative overflow-hidden bg-gradient-to-br from-sky-900/70 to-cyan-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-sky-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-sky-400/10 group-hover:text-sky-300/20 transition"><BookOpen size={110} /></div>
                      <span className="bg-black/40 text-sky-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-sky-300/20">Study</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">英単語バイト</h2>
                      <p className="text-gray-400 text-sm">初級50G〜上級400G・参加費無料</p>
                    </button>
                    <button onClick={() => setView('MINING')} className="group relative overflow-hidden bg-gradient-to-br from-amber-900/70 to-yellow-950 p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-amber-400/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute -top-4 -right-4 text-amber-400/10 group-hover:text-amber-300/20 transition"><Pickaxe size={110} /></div>
                      <span className="bg-black/40 text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-3 inline-block border border-amber-300/20">Mining</span>
                      <h2 className="text-xl font-extrabold text-white mb-1">マインスイーパー採掘</h2>
                      <p className="text-gray-400 text-sm">参加費あり・爆発で没収！最大30,000G</p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[
                    { id: 'BANK', label: 'グランドバンク', sub: '預金・借入・信用度', icon: <Landmark size={20} />, tone: 'text-emerald-300' },
                    { id: 'TRANSFER', label: 'オンライン送金', sub: '他プレイヤーへ送金', icon: <Send size={20} />, tone: 'text-sky-300' },
                    { id: 'INVEST', label: '人物株投資', sub: '他プレイヤーに投資', icon: <TrendingUp size={20} />, tone: 'text-cyan-300' },
                    { id: 'RANKING', label: '長者番付', sub: 'トップ10', icon: <Trophy size={20} />, tone: 'text-amber-300' },
                  ].map(s => (
                    <button key={s.id} onClick={() => setView(s.id)} className="flex items-center justify-between p-4 bg-black/40 hover:bg-black/60 rounded-2xl border border-white/10 hover:border-amber-400/30 transition">
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
                      <span className="text-2xl font-black font-mono text-amber-300">{(balance + bankBalance - loanBalance).toLocaleString()} G</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block mb-1">信用度</span>
                      <span className={`text-2xl font-black font-mono ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                    </div>
                  </div>
                  {balance < 100 && bankBalance < 100 && (
                    <button onClick={claimRelief} className="bg-red-500/10 text-red-300 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-red-500/30 transition">
                      救済資金 1,000G を申請する
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
                          {h.type === 'SENT' ? '-' : '+'}{(h.amount || 0).toLocaleString()}G
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}

        {view === 'SLOT' && <SlotMachine balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'ROULETTE' && <RouletteView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'REDBLACK' && <RedBlackView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'POKER' && <PokerView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'RACE' && <HorseRacing balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'LABOR' && <LaborView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} />}
        {view === 'MINING' && <MiningView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'JANKEN' && <JankenView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'INVEST' && <InvestmentView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}

        {/* ===== BANK ===== */}
        {view === 'BANK' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <Panel gold className="p-6 md:p-8">
              <SectionTitle icon={<Landmark size={28} />} title="GRAND BANK" sub="預金: 30分 +0.1% ／ ローン: 15分 +0.3%" />
              <div className="bg-black/40 p-5 rounded-2xl border border-white/10 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-400">信用スコア</span>
                  <span className={`text-2xl font-black ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 mb-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, (creditScore / 200) * 100))}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>借入上限: <span className="text-white font-bold">{Math.max(0, Math.floor(creditScore * 1000)).toLocaleString()} G</span></div>
                  <div>借入残高: <span className="text-red-400 font-bold">{loanBalance.toLocaleString()} G</span></div>
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
                <span className="text-xl font-mono font-black text-amber-300">{balance.toLocaleString()} G</span>
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
              <SectionTitle icon={<Trophy size={28} />} title="LEADERBOARD" sub="純資産ランキング（所持金＋預金−ローン）" />
              <div className="space-y-3">
                {rankingData.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">プレイヤーがまだ存在しません。</p>
                ) : rankingData.map((player, index) => {
                  const isSelf = player.name === playerName;
                  const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                  return (
                    <div key={player.name + index} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelf ? 'bg-amber-500/10 border-amber-500' : 'bg-black/40 border-white/10'}`}>
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="w-8 text-center text-xl font-bold shrink-0">{rankBadge}</span>
                        <div className="min-w-0">
                          <span className={`font-bold text-lg block truncate ${isSelf ? 'text-amber-300' : 'text-white'}`}>
                            {player.name} {isSelf && <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded ml-1 font-black">YOU</span>}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500 font-semibold">
                            <span>手元:{player.balance.toLocaleString()}G</span>
                            <span>銀行:{player.bankBalance.toLocaleString()}G</span>
                            {player.loanBalance > 0 && <span className="text-red-400">ローン:{player.loanBalance.toLocaleString()}G</span>}
                            <span className={getCreditColor(player.creditScore)}>{getCreditLabel(player.creditScore)}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-lg md:text-xl font-black text-amber-300 shrink-0">{player.total.toLocaleString()} G</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}
      </div>

      <footer className="py-6 border-t border-white/5 text-center text-[11px] text-gray-600 tracking-widest">
        © 2026 GRAND CASINO &amp; TURF — 20歳未満の入場はご遠慮ください（架空通貨G）
      </footer>
    </div>
  );
}

/* ==========================================================
   SLOT MACHINE
   リールを実際のストリップで回し、停止時に「表示＝判定対象」になるよう
   同一配列を参照する。横方向の判定ズレが起きない構造。
   ========================================================== */
const SLOT_CELL_H = 96;   // 1マスの高さ(px)
const SLOT_STRIP_LEN = 28;

function SlotMachine({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [bet, setBet] = useState(100);
  const [strips, setStrips] = useState(() => [0, 1, 2].map(() => Array(SLOT_STRIP_LEN).fill(0).map(randomSymbolIdx)));
  const [offsets, setOffsets] = useState([0, 0, 0]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [status, setStatus] = useState('IDLE');
  const [winLines, setWinLines] = useState([]);
  const [winMessage, setWinMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [netWin, setNetWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [grid, setGrid] = useState(() => Array(9).fill(0));

  const autoRef = useRef(false);
  const statusRef = useRef('IDLE');
  const framesRef = useRef([null, null, null]);
  const timeoutRef = useRef(null);
  const lossStreakRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRef.current = false;
      framesRef.current.forEach(f => f && cancelAnimationFrame(f));
      clearTimeout(timeoutRef.current);
    };
  }, []);

  function randomSymbolIdx() {
    return SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
  }

  const spinColumn = (col, finalCol, duration) => new Promise(resolve => {
    // ストリップ末尾3つ＝最終停止位置に見える3シンボル
    const strip = Array(SLOT_STRIP_LEN).fill(0).map(randomSymbolIdx);
    strip[SLOT_STRIP_LEN - 3] = finalCol[0];
    strip[SLOT_STRIP_LEN - 2] = finalCol[1];
    strip[SLOT_STRIP_LEN - 1] = finalCol[2];
    setStrips(prev => { const n = [...prev]; n[col] = strip; return n; });

    const maxOffset = (SLOT_STRIP_LEN - 3) * SLOT_CELL_H;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // 最後だけゆっくり
      setOffsets(prev => { const n = [...prev]; n[col] = maxOffset * eased; return n; });
      if (t < 1) {
        framesRef.current[col] = requestAnimationFrame(tick);
      } else {
        setOffsets(prev => { const n = [...prev]; n[col] = maxOffset; return n; });
        setSpinning(prev => { const n = [...prev]; n[col] = false; return n; });
        resolve();
      }
    };
    framesRef.current[col] = requestAnimationFrame(tick);
  });

  const startSpin = useCallback(async () => {
    if (statusRef.current !== 'IDLE') return;
    if (balance < bet) {
      showToast('残高が足りません！', 'error');
      autoRef.current = false; setAutoSpin(false); return;
    }
    statusRef.current = 'SPINNING'; setStatus('SPINNING');
    setWinLines([]); setWinMessage(''); setWinAmount(0); setFlash(false);

    try {
      await updateBalance(-bet);
    } catch (e) {
      statusRef.current = 'IDLE'; setStatus('IDLE');
      autoRef.current = false; setAutoSpin(false);
      return;
    }
    setSpinCount(c => c + 1);

    // 最終出目を確定（grid[row*3+col]）
    const finalGrid = Array(9).fill(0).map(randomSymbolIdx);
    const colsFinal = [0, 1, 2].map(col => [finalGrid[col], finalGrid[3 + col], finalGrid[6 + col]]);

    setOffsets([0, 0, 0]);
    setSpinning([true, true, true]);
    await Promise.all([0, 1, 2].map(col => spinColumn(col, colsFinal[col], 1100 + col * 420)));
    if (!mountedRef.current) return;

    setGrid(finalGrid);
    statusRef.current = 'RESULT'; setStatus('RESULT');

    let totalMult = 0;
    const hits = [];
    SLOT_LINES.forEach(line => {
      const syms = line.cells.map(i => SYMBOLS[finalGrid[i]].sym);
      const match = PAYTABLE.find(p => p.combo[0] === syms[0] && p.combo[1] === syms[1] && p.combo[2] === syms[2]);
      if (match) {
        totalMult += match.mult;
        hits.push({ cells: line.cells, name: line.name, mult: match.mult, label: match.label, color: match.color, glow: match.glow });
      }
    });

    if (totalMult > 0) {
      const amount = bet * totalMult;
      setWinAmount(amount);
      setNetWin(w => w + amount - bet);
      const top = [...hits].sort((a, b) => b.mult - a.mult)[0];
      setWinMessage(`${top.label} ×${totalMult}`);
      setWinLines(hits);
      await updateBalance(amount);
      lossStreakRef.current = 0;
      if (totalMult >= 30) setFlash(true);
      if (amount >= 100000) emitNews(`🎰 ${playerName} がスロットで大勝ち！ ${amount.toLocaleString()} G 獲得！！`, 'jackpot');
    } else {
      setWinMessage('LOSE');
      setNetWin(w => w - bet);
      lossStreakRef.current += bet;
      if (lossStreakRef.current >= 100000) {
        emitNews(`💸 ${playerName} がスロットで ${lossStreakRef.current.toLocaleString()} G の大負け...`, 'loss');
        lossStreakRef.current = 0;
      }
    }

    const delay = autoRef.current ? (totalMult >= 30 ? 2200 : 900) : (totalMult > 0 ? 2600 : 1400);
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      statusRef.current = 'IDLE'; setStatus('IDLE');
      setWinMessage(''); setWinLines([]); setFlash(false);
      if (autoRef.current) startSpin();
    }, delay);
  }, [balance, bet, updateBalance, showToast, playerName, emitNews]);

  const toggleAuto = () => {
    const n = !autoSpin;
    autoRef.current = n; setAutoSpin(n);
    if (n && statusRef.current === 'IDLE') startSpin();
  };

  const isHit = idx => winLines.some(wl => wl.cells.includes(idx));
  const hitGlow = idx => (winLines.find(wl => wl.cells.includes(idx)) || {}).glow || '';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center">
      {flash && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-amber-400/10 animate-pulse" />
          {[...Array(18)].map((_, i) => (
            <div key={i} className="absolute text-2xl animate-bounce" style={{ left: `${(i * 37) % 92}%`, top: `${(i * 53) % 88}%`, animationDelay: `${(i % 5) * 0.12}s` }}>⭐</div>
          ))}
        </div>
      )}

      <div className="w-full flex flex-wrap gap-3 justify-between items-center mb-6">
        <button onClick={() => { autoRef.current = false; setAutoSpin(false); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-[10px] text-gray-500 font-bold">SPINS</div><div className="font-mono text-amber-300 font-bold">{spinCount}</div></div>
          <div className="text-center"><div className="text-[10px] text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${netWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netWin >= 0 ? '+' : ''}{netWin.toLocaleString()}</div></div>
          <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className={`relative w-full rounded-[2rem] p-5 md:p-7 border-[10px] shadow-2xl transition-colors ${flash ? 'border-amber-400' : 'border-[#1a120a]'}`}
        style={{ background: 'linear-gradient(180deg,#20160c 0%,#0d0a06 100%)' }}>
        <div className="absolute inset-x-0 -top-1 flex justify-center">
          <span className="px-6 py-1 rounded-b-2xl bg-gradient-to-b from-amber-300 to-amber-600 text-[#241a04] font-black tracking-[0.3em] text-xs">GRAND SLOT</span>
        </div>

        {winMessage && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className={`text-3xl md:text-5xl font-black text-center px-6 py-4 rounded-2xl ${winAmount > 0 ? 'text-amber-300 bg-black/80 border-2 border-amber-400/60 animate-bounce' : 'text-gray-500 bg-black/60'}`}>
              {winMessage}
              {winAmount > 0 && <div className="text-lg md:text-xl text-emerald-400 mt-1">+{winAmount.toLocaleString()} G</div>}
            </div>
          </div>
        )}

        {/* リール窓 */}
        <div className="relative mt-4 mb-4 rounded-2xl bg-black/60 p-3 border border-amber-500/20">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(col => (
              <div key={col} className="relative overflow-hidden rounded-xl border-4 border-slate-200/80 bg-gradient-to-b from-white to-slate-200"
                style={{ height: SLOT_CELL_H * 3 }}>
                <div style={{ transform: `translateY(${-offsets[col]}px)`, willChange: 'transform' }}>
                  {strips[col].map((symIdx, i) => {
                    const visIndexFromEnd = strips[col].length - i; // 1..len
                    const rowIdx = 3 - visIndexFromEnd;             // 停止時の行(0,1,2)
                    const stopped = !spinning[col];
                    const cellIdx = rowIdx >= 0 && rowIdx <= 2 ? rowIdx * 3 + col : -1;
                    const hot = stopped && cellIdx >= 0 && isHit(cellIdx);
                    const sym = SYMBOLS[symIdx];
                    return (
                      <div key={i} style={{ height: SLOT_CELL_H }}
                        className={`flex items-center justify-center border-b border-slate-300/70 transition-colors ${hot ? 'bg-amber-200' : ''}`}>
                        {sym.name === 'BAR'
                          ? <span className="text-2xl font-black text-slate-900 tracking-tight">BAR</span>
                          : <span className="text-4xl md:text-5xl select-none">{sym.sym}</span>}
                        {hot && <Star size={14} className="ml-1 text-amber-500 fill-amber-400" />}
                      </div>
                    );
                  })}
                </div>
                {/* 中段ライン目印 */}
                <div className="pointer-events-none absolute inset-x-0" style={{ top: SLOT_CELL_H, height: SLOT_CELL_H, boxShadow: 'inset 0 0 0 2px rgba(217,119,6,0.35)' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            {[0, 1, 2].map(col => (
              <div key={col} className={`h-1 flex-1 rounded-full transition-all ${spinning[col] ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        {winLines.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {winLines.map((wl, i) => (
              <span key={i} className={`text-xs md:text-sm font-bold px-3 py-1.5 rounded-full bg-black/70 border border-white/10 ${wl.color}`}>
                {wl.name} {wl.label} ×{wl.mult}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center bg-black/50 p-4 rounded-2xl border border-white/10 gap-4">
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 font-bold text-sm">BET</span>
            <select value={bet} onChange={e => setBet(Number(e.target.value))} disabled={status !== 'IDLE'}
              className="bg-black/70 text-amber-300 font-mono text-lg p-3 rounded-lg border border-white/10 outline-none font-bold disabled:opacity-60">
              {[10, 100, 500, 1000, 5000, 10000].map(v => <option key={v} value={v}>{v.toLocaleString()}G</option>)}
            </select>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={toggleAuto} className={`px-5 py-3 rounded-xl font-black transition active:scale-95 border text-sm ${autoSpin ? 'bg-orange-600 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
              {autoSpin ? '🔄 AUTO ON' : 'AUTO'}
            </button>
            <GoldButton onClick={startSpin} disabled={status !== 'IDLE' || balance < bet} className="py-3 px-10 rounded-full text-xl">
              {status === 'SPINNING' ? <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPIN</span> : 'SPIN'}
            </GoldButton>
          </div>
        </div>
      </div>

      <Panel className="mt-5 p-5 w-full">
        <h3 className="text-gray-400 font-bold mb-3 text-center tracking-[0.3em] text-xs">PAYTABLE — 上段/中段/下段＋2斜めの5ライン</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          {PAYTABLE.map((p, i) => (
            <div key={i} className="bg-black/50 p-2 rounded-lg text-center border border-white/10">
              <div className="text-lg mb-1">{p.combo.join('')}</div>
              <div className={`font-black ${p.color}`}>×{p.mult}</div>
            </div>
          ))}
        </div>
      </Panel>
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
        showToast(`🎡 ${winValue} エリア当選！ +${payout.toLocaleString()} G`, 'success');
        if (payout - total >= 50000) emitNews(`🎡 ${playerName} がルーレットで ×${winValue} を的中！ +${(payout - total).toLocaleString()} G！`, 'jackpot');
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
        <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
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
                      <div className="text-3xl font-black text-emerald-400">+{winAmount.toLocaleString()} G</div>
                      <div className={`text-sm font-bold ${winAmount - stakedTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        収支 {winAmount - stakedTotal >= 0 ? '+' : ''}{(winAmount - stakedTotal).toLocaleString()} G
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl font-black text-red-400">ハズレ</div>
                      <div className="text-red-400/80 text-sm">-{stakedTotal.toLocaleString()} G</div>
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
                      <div key={i} title={`${h.net >= 0 ? '+' : ''}${h.net.toLocaleString()} G`}
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
                      <div className={`text-[11px] font-bold ${zone.textClass}`}>→ {(bets[zone.value] * zone.value).toLocaleString()} G</div>
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
                <span className="font-mono text-xl font-black text-amber-300">{totalBet.toLocaleString()} G</span>
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
   RED & BLACK ROULETTE（コインを置く欧州式0〜36）
   ========================================================== */
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const numColor = (n) => n === 0 ? 'green' : (RED_NUMBERS.has(n) ? 'red' : 'black');
const CHIP_DENOMS = [
  { v: 100, color: '#dc2626' },
  { v: 500, color: '#2563eb' },
  { v: 1000, color: '#16a34a' },
  { v: 5000, color: '#7c3aed' },
  { v: 10000, color: '#b45309' },
];
const OUTSIDE_BETS = [
  { id: 'RED', label: '赤', mult: 2, test: n => numColor(n) === 'red', tone: 'bg-red-700' },
  { id: 'BLACK', label: '黒', mult: 2, test: n => numColor(n) === 'black', tone: 'bg-neutral-900' },
  { id: 'GREEN', label: '0 (緑)', mult: 36, test: n => n === 0, tone: 'bg-emerald-700' },
  { id: 'EVEN', label: '偶数', mult: 2, test: n => n !== 0 && n % 2 === 0, tone: 'bg-slate-700' },
  { id: 'ODD', label: '奇数', mult: 2, test: n => n % 2 === 1, tone: 'bg-slate-700' },
  { id: 'LOW', label: '1-18', mult: 2, test: n => n >= 1 && n <= 18, tone: 'bg-slate-700' },
  { id: 'HIGH', label: '19-36', mult: 2, test: n => n >= 19 && n <= 36, tone: 'bg-slate-700' },
];

function RedBlackView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState({});           // { RED: 500, N7: 100 ... }
  const [phase, setPhase] = useState('BETTING');  // BETTING | SPINNING | RESULT
  const [result, setResult] = useState(null);
  const [payout, setPayout] = useState(0);
  const [staked, setStaked] = useState(0);
  const [history, setHistory] = useState([]);

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const angleRef = useRef(0);
  const phaseRef = useRef('BETTING');
  const mountedRef = useRef(true);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

  const drawWheel = useCallback((angle, highlight = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 16;
    ctx.clearRect(0, 0, W, H);

    ctx.beginPath(); ctx.arc(cx, cy, R + 11, 0, TAU);
    ctx.fillStyle = '#241a0b'; ctx.fill();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4; ctx.stroke();

    const slice = TAU / WHEEL_ORDER.length;
    WHEEL_ORDER.forEach((n, i) => {
      const startA = angle + i * slice - Math.PI / 2;
      const c = numColor(n);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, startA, startA + slice); ctx.closePath();
      ctx.fillStyle = c === 'green' ? '#047857' : c === 'red' ? '#b91c1c' : '#111827';
      ctx.fill();
      if (highlight === n) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; }
      else { ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1; }
      ctx.stroke();

      const midA = startA + slice / 2;
      ctx.save();
      ctx.translate(cx + R * 0.8 * Math.cos(midA), cy + R * 0.8 * Math.sin(midA));
      ctx.rotate(midA + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, Math.floor(R * 0.072))}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    });

    const hubR = R * 0.34;
    const g = ctx.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, 0, cx, cy, hubR);
    g.addColorStop(0, '#57430f'); g.addColorStop(1, '#120c04');
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.stroke();

    const top = cy - R - 12;
    ctx.beginPath(); ctx.moveTo(cx, top + 26); ctx.lineTo(cx - 12, top); ctx.lineTo(cx + 12, top); ctx.closePath();
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.stroke();
  }, []);

  useEffect(() => { drawWheel(angleRef.current); }, [drawWheel]);

  const placeChip = (key) => {
    if (phaseRef.current !== 'BETTING') return;
    if (totalBet + chip > balance) { showToast('所持金を超えるベットはできません。', 'error'); return; }
    setBets(prev => ({ ...prev, [key]: (prev[key] || 0) + chip }));
  };
  const removeBet = (key) => {
    if (phaseRef.current !== 'BETTING') return;
    setBets(prev => { const n = { ...prev }; delete n[key]; return n; });
  };
  const clearAll = () => { if (phaseRef.current === 'BETTING') setBets({}); };

  const spin = async () => {
    if (phaseRef.current !== 'BETTING') return;
    if (totalBet <= 0) { showToast('コインを置いてください。', 'error'); return; }
    if (totalBet > balance) { showToast('残高が足りません！', 'error'); return; }
    const snapshotBets = { ...bets };
    try { await updateBalance(-totalBet); } catch (e) { return; }
    setStaked(totalBet);
    setPhase('SPINNING'); phaseRef.current = 'SPINNING';
    setResult(null); setPayout(0);

    const idx = Math.floor(Math.random() * WHEEL_ORDER.length);
    const number = WHEEL_ORDER[idx];
    const slice = TAU / WHEEL_ORDER.length;
    const desired = (((-(idx + 0.5) * slice) % TAU) + TAU) % TAU;
    const current = ((angleRef.current % TAU) + TAU) % TAU;
    let delta = desired - current;
    if (delta < 0) delta += TAU;
    const start = angleRef.current;
    const target = start + (6 + Math.floor(Math.random() * 3)) * TAU + delta;
    const duration = 4600 + Math.random() * 900;
    const t0 = performance.now();

    const animate = (now) => {
      const raw = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      angleRef.current = start + (target - start) * eased;
      drawWheel(angleRef.current);
      if (raw < 1) { animRef.current = requestAnimationFrame(animate); return; }
      angleRef.current = target;
      drawWheel(target, number);
      if (!mountedRef.current) return;

      let win = 0;
      OUTSIDE_BETS.forEach(b => { if (snapshotBets[b.id] && b.test(number)) win += snapshotBets[b.id] * b.mult; });
      const straightKey = 'N' + number;
      if (snapshotBets[straightKey]) win += snapshotBets[straightKey] * 36;

      if (win > 0) updateBalance(win).catch(() => {});
      setResult(number); setPayout(win);
      setPhase('RESULT'); phaseRef.current = 'RESULT';
      setHistory(prev => [number, ...prev].slice(0, 14));
      if (win > 0) {
        showToast(`🎯 ${number}（${numColor(number) === 'red' ? '赤' : numColor(number) === 'black' ? '黒' : '緑'}）！ +${win.toLocaleString()} G`, 'success');
        if (win - totalBet >= 50000) emitNews(`🔴 ${playerName} が赤黒ルーレットで ${number} を的中！ +${(win - totalBet).toLocaleString()} G！`, 'jackpot');
      } else {
        showToast(`😢 ${number} …ハズレ`, 'error');
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const numberCells = Array.from({ length: 36 }, (_, i) => i + 1);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="w-full flex justify-between items-center mb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="xl:w-[42%]">
          <Panel gold className="p-5 flex flex-col items-center gap-4">
            <canvas ref={canvasRef} width={420} height={420} className="w-full max-w-[380px] h-auto" />
            {phase === 'RESULT' && result !== null && (
              <div className={`w-full p-4 rounded-2xl border-2 text-center ${payout > 0 ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                <div className="flex items-center justify-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white border-2 border-white/30 ${numColor(result) === 'red' ? 'bg-red-700' : numColor(result) === 'black' ? 'bg-neutral-900' : 'bg-emerald-700'}`}>{result}</div>
                  <div className="text-left">
                    {payout > 0
                      ? <><div className="text-2xl font-black text-emerald-400">+{payout.toLocaleString()} G</div>
                          <div className={`text-sm font-bold ${payout - staked >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>収支 {payout - staked >= 0 ? '+' : ''}{(payout - staked).toLocaleString()} G</div></>
                      : <><div className="text-2xl font-black text-red-400">ハズレ</div><div className="text-red-400/80 text-sm">-{staked.toLocaleString()} G</div></>}
                  </div>
                </div>
                <GoldButton onClick={() => { setPhase('BETTING'); phaseRef.current = 'BETTING'; setResult(null); }} className="w-full mt-3 py-2.5">次のゲームへ</GoldButton>
              </div>
            )}
            {history.length > 0 && (
              <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-3">
                <div className="text-[11px] font-black text-gray-400 tracking-[0.25em] mb-2">RECENT</div>
                <div className="flex flex-wrap gap-1.5">
                  {history.map((n, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full text-[11px] flex items-center justify-center font-black text-white ${numColor(n) === 'red' ? 'bg-red-700' : numColor(n) === 'black' ? 'bg-neutral-900 border border-white/20' : 'bg-emerald-700'}`}>{n}</div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="xl:w-[58%] space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black text-white">コインを選ぶ</h3>
              <span className="text-xs text-gray-500">クリックでテーブルに置く／右クリックで取消</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {CHIP_DENOMS.map(c => (
                <button key={c.v} onClick={() => setChip(c.v)}
                  className={`rounded-full transition ${chip === c.v ? 'scale-110 ring-4 ring-amber-300' : 'opacity-80 hover:opacity-100'}`}>
                  <Chip value={c.v >= 1000 ? c.v / 1000 + 'K' : c.v} color={c.color} size={46} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="rounded-2xl p-3 border border-emerald-700/40" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f5132 0%, #07130d 75%)' }}>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 mb-3">
                <button onClick={() => placeChip('N0')} onContextMenu={e => { e.preventDefault(); removeBet('N0'); }}
                  className="col-span-2 sm:col-span-1 relative h-11 rounded bg-emerald-700 text-white font-black text-sm border border-white/20 hover:brightness-125">
                  0
                  {bets.N0 > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[9px] font-black rounded-full px-1.5 py-0.5">{bets.N0 >= 1000 ? bets.N0 / 1000 + 'K' : bets.N0}</span>}
                </button>
                {numberCells.map(n => {
                  const key = 'N' + n;
                  const c = numColor(n);
                  return (
                    <button key={n} onClick={() => placeChip(key)} onContextMenu={e => { e.preventDefault(); removeBet(key); }}
                      className={`relative h-11 rounded text-white font-black text-sm border border-white/20 hover:brightness-125 ${c === 'red' ? 'bg-red-700' : 'bg-neutral-900'}`}>
                      {n}
                      {bets[key] > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[9px] font-black rounded-full px-1.5 py-0.5">{bets[key] >= 1000 ? bets[key] / 1000 + 'K' : bets[key]}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OUTSIDE_BETS.map(b => (
                  <button key={b.id} onClick={() => placeChip(b.id)} onContextMenu={e => { e.preventDefault(); removeBet(b.id); }}
                    className={`relative py-3 rounded-lg text-white font-black text-sm border border-white/20 hover:brightness-125 ${b.tone}`}>
                    {b.label} <span className="text-[10px] opacity-70">×{b.mult}</span>
                    {bets[b.id] > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[10px] font-black rounded-full px-1.5 py-0.5">{bets[b.id] >= 1000 ? bets[b.id] / 1000 + 'K' : bets[b.id]}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1">
                <div className="text-[11px] text-gray-400 font-bold">合計ベット</div>
                <div className="font-mono text-2xl font-black text-amber-300">{totalBet.toLocaleString()} G</div>
              </div>
              <button onClick={clearAll} disabled={phase !== 'BETTING'} className="bg-white/5 hover:bg-white/15 text-gray-300 font-bold py-3 px-4 rounded-xl transition disabled:opacity-40 text-sm">全撤去</button>
              <GoldButton onClick={spin} disabled={phase !== 'BETTING' || totalBet <= 0} className="py-3 px-8 text-lg">
                {phase === 'SPINNING' ? <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPIN</span> : 'ボールを投げる'}
              </GoldButton>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">※ ストレート（数字1点）は36倍、赤/黒・偶奇・1-18/19-36は2倍、0のみ36倍。</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   TEXAS HOLD'EM（ディーラーCPUと1対1）
   ========================================================== */
const POKER_STAKES = [100, 500, 1000, 5000];
const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

function PokerView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [stake, setStake] = useState(100);
  const [hand, setHand] = useState(null);     // 進行中のハンド
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [sessionNet, setSessionNet] = useState(0);
  const cpuTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimeout(cpuTimerRef.current); };
  }, []);

  const pushLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 8));

  const startHand = async () => {
    if (busy) return;
    if (balance < stake * 6) {
      showToast(`このレートには最低 ${(stake * 6).toLocaleString()} G 必要です。`, 'error');
      return;
    }
    setBusy(true);
    try { await updateBalance(-stake); } catch (e) { setBusy(false); return; }

    const deck = shuffle(buildDeck());
    const playerHole = [deck.pop(), deck.pop()];
    const cpuHole = [deck.pop(), deck.pop()];
    setLog([]);
    setHand({
      deck, playerHole, cpuHole, board: [],
      street: 'PREFLOP',
      pot: stake * 2,
      playerCommitted: stake,
      cpuCommitted: stake,
      toCall: 0,
      raises: 0,
      turn: 'PLAYER',
      finished: false,
      result: null,
      message: 'アンティ支払い完了。アクションをどうぞ。',
      revealCpu: false,
    });
    pushLog(`新しいハンド開始（アンティ ${stake.toLocaleString()}G ずつ）`);
    setBusy(false);
  };

  const finishHand = useCallback(async (state, outcome) => {
    // outcome: 'PLAYER' | 'CPU' | 'SPLIT'
    let gain = 0;
    if (outcome === 'PLAYER') gain = state.pot;
    else if (outcome === 'SPLIT') gain = Math.floor(state.pot / 2);
    if (gain > 0) { try { await updateBalance(gain); } catch (e) { /* noop */ } }

    const net = gain - state.playerCommitted;
    setSessionNet(s => s + net);
    if (net >= 20000) emitNews(`🃏 ${playerName} がテキサスホールデムで +${net.toLocaleString()} G を獲得！`, 'poker');

    setHand(prev => prev ? ({
      ...state,
      finished: true,
      revealCpu: true,
      result: outcome,
      netGain: net,
      message: outcome === 'PLAYER' ? `勝利！ポット ${state.pot.toLocaleString()}G 獲得`
        : outcome === 'SPLIT' ? `引き分け。${gain.toLocaleString()}G 返却`
        : 'ディーラーの勝ち…',
    }) : prev);
    setBusy(false);
  }, [updateBalance, emitNews, playerName]);

  const showdown = useCallback((state) => {
    const board = [...state.board];
    const d = [...state.deck];
    while (board.length < 5) board.push(d.pop());
    const me = evaluateHand([...state.playerHole, ...board]);
    const op = evaluateHand([...state.cpuHole, ...board]);
    const next = { ...state, board, deck: d, playerHand: me, cpuHand: op };
    pushLog(`ショーダウン：あなた ${me.name} / ディーラー ${op.name}`);
    finishHand(next, me.value > op.value ? 'PLAYER' : me.value < op.value ? 'CPU' : 'SPLIT');
  }, [finishHand]);

  const dealNextStreet = useCallback((state) => {
    const idx = STREETS.indexOf(state.street);
    const d = [...state.deck];
    let board = [...state.board];
    if (idx === 0) board = [d.pop(), d.pop(), d.pop()];
    else board = [...board, d.pop()];
    const nextStreet = STREETS[idx + 1];
    pushLog(`${nextStreet === 'FLOP' ? 'フロップ' : nextStreet === 'TURN' ? 'ターン' : 'リバー'}オープン`);
    return { ...state, deck: d, board, street: nextStreet, toCall: 0, raises: 0, turn: 'PLAYER', message: 'あなたのアクションです。' };
  }, []);

  const cpuAct = useCallback((state) => {
    clearTimeout(cpuTimerRef.current);
    cpuTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const used = [...state.playerHole, ...state.cpuHole, ...state.board];
      const remaining = buildDeck().filter(c => !used.some(u => u.r === c.r && u.s === c.s));
      const equity = estimateEquity(state.cpuHole, state.board, remaining, state.board.length >= 4 ? 200 : 120);
      const toCall = state.toCall;
      const raiseSize = stake * 2;
      let next = { ...state };

      if (toCall > 0) {
        if (equity < 0.36 && toCall > stake) {
          pushLog(`ディーラー：フォールド（あなたの勝ち）`);
          finishHand(next, 'PLAYER');
          return;
        }
        if (equity > 0.72 && next.raises < 2) {
          next.cpuCommitted += toCall + raiseSize;
          next.pot += toCall + raiseSize;
          next.toCall = raiseSize;
          next.raises += 1;
          next.turn = 'PLAYER';
          next.message = `ディーラーがレイズ！ ${raiseSize.toLocaleString()}G のコールが必要です。`;
          pushLog(`ディーラー：レイズ ${raiseSize.toLocaleString()}G`);
          setHand(next); setBusy(false); return;
        }
        next.cpuCommitted += toCall;
        next.pot += toCall;
        next.toCall = 0;
        pushLog(`ディーラー：コール ${toCall.toLocaleString()}G`);
        if (next.street === 'RIVER') { showdown(next); return; }
        setHand(dealNextStreet(next)); setBusy(false); return;
      }

      // ノーベット局面
      if (equity > 0.62 && next.raises < 2) {
        next.cpuCommitted += raiseSize;
        next.pot += raiseSize;
        next.toCall = raiseSize;
        next.raises += 1;
        next.turn = 'PLAYER';
        next.message = `ディーラーがベット ${raiseSize.toLocaleString()}G。`;
        pushLog(`ディーラー：ベット ${raiseSize.toLocaleString()}G`);
        setHand(next); setBusy(false); return;
      }
      pushLog('ディーラー：チェック');
      if (next.street === 'RIVER') { showdown(next); return; }
      setHand(dealNextStreet(next)); setBusy(false);
    }, 850);
  }, [stake, dealNextStreet, finishHand, showdown]);

  const playerAction = async (action) => {
    if (!hand || hand.finished || busy || hand.turn !== 'PLAYER') return;
    const state = { ...hand };
    const raiseSize = stake * 2;

    if (action === 'FOLD') {
      pushLog('あなた：フォールド');
      setBusy(true);
      finishHand(state, 'CPU');
      return;
    }

    if (action === 'CALL') {
      const amount = state.toCall;
      if (amount > balance) { showToast('所持金が足りません。', 'error'); return; }
      setBusy(true);
      try { await updateBalance(-amount); } catch (e) { setBusy(false); return; }
      state.playerCommitted += amount;
      state.pot += amount;
      state.toCall = 0;
      pushLog(`あなた：コール ${amount.toLocaleString()}G`);
      if (state.street === 'RIVER') { showdown(state); return; }
      setHand(dealNextStreet(state));
      setBusy(false);
      return;
    }

    if (action === 'CHECK') {
      pushLog('あなた：チェック');
      setBusy(true);
      state.turn = 'CPU';
      state.message = 'ディーラーが考えています…';
      setHand(state);
      cpuAct(state);
      return;
    }

    if (action === 'BET' || action === 'RAISE') {
      const amount = state.toCall + raiseSize;
      if (amount > balance) { showToast('所持金が足りません。', 'error'); return; }
      if (state.raises >= 2) { showToast('このストリートのレイズ上限です。', 'error'); return; }
      setBusy(true);
      try { await updateBalance(-amount); } catch (e) { setBusy(false); return; }
      state.playerCommitted += amount;
      state.pot += amount;
      state.toCall = raiseSize;
      state.raises += 1;
      state.turn = 'CPU';
      state.message = 'ディーラーが考えています…';
      pushLog(`あなた：${action === 'BET' ? 'ベット' : 'レイズ'} ${amount.toLocaleString()}G`);
      setHand(state);
      cpuAct(state);
    }
  };

  const currentEval = hand && hand.board.length >= 3
    ? evaluateHand([...hand.playerHole, ...hand.board])
    : hand ? evaluateHand([...hand.playerHole, ...hand.board]) : null;

  const streetLabel = { PREFLOP: 'プリフロップ', FLOP: 'フロップ', TURN: 'ターン', RIVER: 'リバー' };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="w-full flex justify-between items-center mb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-3">
          <div className="text-center"><div className="text-[10px] text-gray-500 font-bold">SESSION</div>
            <div className={`font-mono font-bold ${sessionNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sessionNet >= 0 ? '+' : ''}{sessionNet.toLocaleString()}</div></div>
          <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      {/* テーブル */}
      <div className="relative rounded-[3rem] border-[12px] border-[#3b2a12] shadow-2xl shadow-black/70 p-6 md:p-10"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #12653f 0%, #0a3a24 55%, #052015 100%)' }}>
        <div className="absolute inset-3 rounded-[2.2rem] border border-amber-300/15 pointer-events-none" />

        {/* ディーラー */}
        <div className="flex flex-col items-center mb-6">
          <div className="text-[11px] tracking-[0.3em] text-amber-200/60 font-bold mb-2">DEALER</div>
          <div className="flex gap-2">
            <PlayingCard card={hand?.cpuHole?.[0]} hidden={!hand?.revealCpu} />
            <PlayingCard card={hand?.cpuHole?.[1]} hidden={!hand?.revealCpu} />
          </div>
          {hand?.revealCpu && hand?.cpuHand && (
            <div className="mt-2 text-sm font-bold text-amber-200">{hand.cpuHand.name}</div>
          )}
        </div>

        {/* ボード */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-black/40 rounded-full px-5 py-1.5 border border-amber-300/20 mb-3 text-sm font-black text-amber-200">
            POT {(hand?.pot || 0).toLocaleString()} G
            {hand && !hand.finished && <span className="ml-3 text-[11px] text-emerald-200/70">{streetLabel[hand.street]}</span>}
          </div>
          <div className="flex gap-2 min-h-[7rem] items-center">
            {[0, 1, 2, 3, 4].map(i => (
              <PlayingCard key={i} card={hand?.board?.[i]} hidden={!hand?.board?.[i]} />
            ))}
          </div>
        </div>

        {/* プレイヤー */}
        <div className="flex flex-col items-center">
          <div className="flex gap-2 mb-2">
            <PlayingCard card={hand?.playerHole?.[0]} hidden={!hand} />
            <PlayingCard card={hand?.playerHole?.[1]} hidden={!hand} />
          </div>
          <div className="text-[11px] tracking-[0.3em] text-amber-200/60 font-bold">{playerName || 'YOU'}</div>
          {hand && currentEval && (
            <div className="mt-1 text-sm font-black text-white">現在の役：<span className="text-amber-300">{currentEval.name}</span></div>
          )}
        </div>

        {hand?.message && (
          <div className="mt-5 text-center text-sm font-bold text-emerald-100/80">{hand.message}</div>
        )}
      </div>

      {/* 操作 */}
      <Panel className="p-5 mt-5">
        {!hand || hand.finished ? (
          <div className="space-y-4">
            {hand?.finished && (
              <div className={`p-4 rounded-2xl border-2 text-center ${hand.result === 'PLAYER' ? 'border-amber-400 bg-amber-500/10' : hand.result === 'SPLIT' ? 'border-white/20 bg-black/40' : 'border-red-500/40 bg-red-500/5'}`}>
                <div className="text-3xl font-black mb-1">
                  {hand.result === 'PLAYER' ? '🏆 WIN' : hand.result === 'SPLIT' ? '🤝 SPLIT' : '😢 LOSE'}
                </div>
                <div className={`font-mono font-black ${hand.netGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hand.netGain >= 0 ? '+' : ''}{(hand.netGain || 0).toLocaleString()} G
                </div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-400 font-bold mb-2">レート（アンティ）</div>
              <div className="flex flex-wrap gap-2">
                {POKER_STAKES.map(s => (
                  <button key={s} onClick={() => setStake(s)}
                    className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition ${stake === s ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:bg-white/10'}`}>
                    {s.toLocaleString()}G
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">※ ベット/レイズ額はレートの2倍。1ストリートのレイズ上限は2回。参加には最低 {(stake * 6).toLocaleString()}G 必要です。</p>
            </div>
            <GoldButton onClick={startHand} disabled={busy || balance < stake * 6} className="w-full py-4 text-lg flex items-center justify-center gap-2">
              <Spade size={20} /> ハンドを開始する
            </GoldButton>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">ポット <span className="text-amber-300 font-black">{hand.pot.toLocaleString()}G</span></span>
              <span className="px-3 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">投入額 <span className="text-white font-black">{hand.playerCommitted.toLocaleString()}G</span></span>
              {hand.toCall > 0 && <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-400/30 text-red-300">要コール {hand.toCall.toLocaleString()}G</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button onClick={() => playerAction('FOLD')} disabled={busy || hand.turn !== 'PLAYER'}
                className="py-3 rounded-xl font-black bg-red-700 hover:bg-red-600 text-white transition disabled:opacity-40">フォールド</button>
              {hand.toCall > 0 ? (
                <button onClick={() => playerAction('CALL')} disabled={busy || hand.turn !== 'PLAYER'}
                  className="py-3 rounded-xl font-black bg-sky-700 hover:bg-sky-600 text-white transition disabled:opacity-40">コール {hand.toCall.toLocaleString()}</button>
              ) : (
                <button onClick={() => playerAction('CHECK')} disabled={busy || hand.turn !== 'PLAYER'}
                  className="py-3 rounded-xl font-black bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-40">チェック</button>
              )}
              <button onClick={() => playerAction(hand.toCall > 0 ? 'RAISE' : 'BET')} disabled={busy || hand.turn !== 'PLAYER' || hand.raises >= 2}
                className="py-3 rounded-xl font-black bg-emerald-700 hover:bg-emerald-600 text-white transition disabled:opacity-40">
                {hand.toCall > 0 ? 'レイズ' : 'ベット'} {(hand.toCall + stake * 2).toLocaleString()}
              </button>
              <div className="py-3 rounded-xl font-black bg-black/40 border border-white/10 text-center text-gray-400 text-sm">
                {hand.turn === 'PLAYER' ? 'あなたの番' : 'ディーラー思考中'}
              </div>
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="mt-4 bg-black/40 rounded-xl border border-white/10 p-3 max-h-32 overflow-y-auto space-y-1">
            {log.map((l, i) => <div key={i} className="text-[11px] text-gray-400">・{l}</div>)}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ==========================================================
   VIRTUAL TURF（本格競馬）
   ========================================================== */
function buildRaceCard() {
  const course = COURSES[Math.floor(Math.random() * COURSES.length)];
  const weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  const entries = HORSE_ROSTER.map(h => {
    const form = (Math.random() * 12) - 6;                       // 当日の調子
    const turfFit = h.turf === weather.turf ? 4 : (weather.turf === '不良' ? -4 : -1);
    const distFit = 6 - Math.abs(course.staminaBias - (h.stamina / 90)) * 8;
    const strength = h.power * 0.55 + h.stamina * 0.45 * course.staminaBias + turfFit + distFit + form;
    return { ...h, form, strength, condition: form > 3 ? '絶好調' : form > -1 ? '良好' : form > -4 ? '平凡' : '不調' };
  });
  const mean = entries.reduce((a, b) => a + b.strength, 0) / entries.length;
  const weights = entries.map(e => Math.exp((e.strength - mean) / 5.5));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const withOdds = entries.map((e, i) => {
    const prob = weights[i] / sumW;
    const odds = Math.max(1.2, Math.round((0.82 / prob) * 10) / 10);
    return { ...e, prob, odds };
  });
  const ranked = [...withOdds].sort((a, b) => a.odds - b.odds);
  return {
    course, weather,
    entries: withOdds.map(e => ({ ...e, popularity: ranked.findIndex(r => r.id === e.id) + 1 })),
  };
}

function payoutMultiplier(type, picks, entries) {
  const find = id => entries.find(e => e.id === id);
  const a = find(picks[0]);
  const b = picks[1] ? find(picks[1]) : null;
  if (!a) return 0;
  switch (type) {
    case 'WIN': return a.odds;
    case 'PLACE': return Math.max(1.1, Math.round(a.odds * 0.35 * 10) / 10);
    case 'QUINELLA': return b ? Math.max(1.5, Math.round(a.odds * b.odds / 2.5 * 10) / 10) : 0;
    case 'EXACTA': return b ? Math.max(2, Math.round(a.odds * b.odds / 1.4 * 10) / 10) : 0;
    case 'WIDE': return b ? Math.max(1.2, Math.round(a.odds * b.odds / 6 * 10) / 10) : 0;
    default: return 0;
  }
}

function HorseRacing({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [card, setCard] = useState(() => buildRaceCard());
  const [betType, setBetType] = useState('WIN');
  const [picks, setPicks] = useState([]);
  const [betAmount, setBetAmount] = useState(500);
  const [phase, setPhase] = useState('BETTING');   // BETTING | COUNTDOWN | RACING | RESULT
  const [countdown, setCountdown] = useState(3);
  const [runners, setRunners] = useState(() => card.entries.map(e => ({ ...e, pos: 0, stamina: 100, rank: 0 })));
  const [finishOrder, setFinishOrder] = useState([]);
  const [commentary, setCommentary] = useState('出走馬を選んで馬券を購入してください。');
  const [payoutInfo, setPayoutInfo] = useState(null);

  const frameRef = useRef(null);
  const runnersRef = useRef([]);
  const finishedRef = useRef([]);
  const ticketRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; cancelAnimationFrame(frameRef.current); };
  }, []);

  const requiredPicks = BET_TYPES[betType].picks;

  const togglePick = (id) => {
    if (phase !== 'BETTING') return;
    setPicks(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= requiredPicks) {
        return requiredPicks === 1 ? [id] : [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  useEffect(() => { setPicks([]); }, [betType]);

  const expectedMultiplier = picks.length === requiredPicks ? payoutMultiplier(betType, picks, card.entries) : 0;

  const newRace = () => {
    const next = buildRaceCard();
    setCard(next);
    setRunners(next.entries.map(e => ({ ...e, pos: 0, stamina: 100, rank: 0 })));
    setPicks([]); setFinishOrder([]); setPayoutInfo(null);
    setPhase('BETTING');
    setCommentary('新しいレースです。馬券を購入してください。');
  };

  const buyTicket = async () => {
    if (picks.length !== requiredPicks) { showToast(`${BET_TYPES[betType].label}は${requiredPicks}頭選択してください。`, 'error'); return; }
    const amount = parseInt(betAmount, 10);
    if (isNaN(amount) || amount < 100) { showToast('100G以上を指定してください。', 'error'); return; }
    if (balance < amount) { showToast('残高が足りません！', 'error'); return; }
    try { await updateBalance(-amount); } catch (e) { return; }

    ticketRef.current = { type: betType, picks: [...picks], amount, mult: payoutMultiplier(betType, picks, card.entries) };
    finishedRef.current = [];
    runnersRef.current = card.entries.map(e => ({
      ...e,
      pos: 0,
      stamina: 100 + (e.stamina - 85) * 0.6 + Math.random() * 8,
      burst: 0.9 + Math.random() * 0.25,
      finishAt: null,
    }));
    setRunners(runnersRef.current.map(r => ({ ...r, rank: 0 })));
    setFinishOrder([]); setPayoutInfo(null);
    setPhase('COUNTDOWN'); setCountdown(3);
    setCommentary('各馬ゲートイン完了。まもなく発走です。');
  };

  // カウントダウン
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) { setPhase('RACING'); setCommentary('スタートしました！'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // レース進行
  useEffect(() => {
    if (phase !== 'RACING') return;
    let tick = 0;
    const turfPenalty = { '良': 1, '稍重': 0.97, '重': 0.93, '不良': 0.89 }[card.weather.turf] || 1;

    const loop = () => {
      tick += 1;
      const list = runnersRef.current;
      list.forEach(h => {
        if (h.pos >= 100) return;
        const progress = h.pos / 100;
        const style = RUNNING_STYLES[h.style];
        const paceFactor = progress < 0.35 ? style.early : progress > 0.7 ? style.late : 1;
        const staminaFactor = 0.55 + (Math.max(0, h.stamina) / 100) * 0.6;
        const baseSpeed = (h.strength / 100) * 0.62;
        const luck = 0.82 + Math.random() * 0.4;
        const spurt = progress > 0.75 ? h.burst : 1;
        const move = baseSpeed * paceFactor * staminaFactor * luck * spurt * turfPenalty;
        h.pos = Math.min(100, h.pos + move);
        h.stamina = Math.max(0, h.stamina - (0.16 + (progress > 0.75 ? 0.28 : 0)) * (style.early > 1.1 ? 1.15 : 1));
        if (h.pos >= 100 && h.finishAt === null) {
          h.finishAt = tick + Math.random() * 0.4; // 写真判定用の微差
          finishedRef.current.push(h.id);
        }
      });

      const sorted = [...list].sort((a, b) => (b.pos - a.pos));
      const withRank = list.map(h => ({ ...h, rank: sorted.findIndex(s => s.id === h.id) + 1 }));
      setRunners(withRank);

      const leader = sorted[0];
      if (tick % 20 === 0 && leader) {
        const p = leader.pos;
        if (p < 25) setCommentary(`${leader.name}（${RUNNING_STYLES[leader.style].label}）がハナを切る展開！`);
        else if (p < 50) setCommentary(`${card.course.name}、${leader.name}が先頭で向正面へ。`);
        else if (p < 72) setCommentary(`3コーナー通過、後方勢が仕掛けどころを窺う！`);
        else if (p < 90) setCommentary(`直線に入った！${leader.name}が粘る、差し馬が外から迫る！`);
        else setCommentary(`ゴール前、激しい叩き合い！`);
      }

      if (list.every(h => h.pos >= 100)) {
        const order = [...list].sort((a, b) => (a.finishAt || 0) - (b.finishAt || 0));
        setFinishOrder(order);
        settle(order);
        setPhase('RESULT');
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = async (order) => {
    const ticket = ticketRef.current;
    if (!ticket) return;
    const ids = order.map(h => h.id);
    const [first, second, third] = ids;
    let hit = false;
    switch (ticket.type) {
      case 'WIN': hit = first === ticket.picks[0]; break;
      case 'PLACE': hit = [first, second, third].includes(ticket.picks[0]); break;
      case 'QUINELLA': hit = [first, second].sort().join() === [...ticket.picks].sort().join(); break;
      case 'EXACTA': hit = first === ticket.picks[0] && second === ticket.picks[1]; break;
      case 'WIDE': hit = ticket.picks.every(p => [first, second, third].includes(p)); break;
      default: hit = false;
    }
    const win = hit ? Math.floor(ticket.amount * ticket.mult) : 0;
    if (win > 0) {
      try { await updateBalance(win); } catch (e) { /* noop */ }
      setCommentary(`🎉 的中！払戻 ${win.toLocaleString()} G！`);
      showToast(`🏇 的中！+${win.toLocaleString()} G`, 'success');
      if (win >= 100000) emitNews(`🏇 ${playerName} が競馬で大的中！ ${win.toLocaleString()} G 獲得！`, 'race');
    } else {
      setCommentary('😢 残念、ハズレです…');
      showToast('ハズレ…次のレースへ', 'warning');
    }
    setPayoutInfo({ hit, win, ticket });
  };

  const laneCount = card.entries.length;
  const trackHeight = 480;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="w-full flex flex-wrap gap-3 justify-between items-center mb-5">
        <button onClick={onBack} disabled={phase === 'RACING'} className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-40"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold text-gray-300">
            {card.weather.icon} {card.weather.name} ／ 馬場 <span className={TURF_COLOR[card.weather.turf]}>{card.weather.turf}</span>
          </div>
          <div className="bg-black/60 px-5 py-2 rounded-full border border-amber-500/30 font-mono text-xl text-amber-300 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* 出馬表 */}
        <Panel className="xl:col-span-1 p-4">
          <div className="mb-3">
            <h3 className="text-lg font-black text-white">📋 出馬表</h3>
            <p className="text-[11px] text-emerald-300 font-bold">{card.course.name}</p>
          </div>

          <div className="grid grid-cols-3 gap-1 mb-3">
            {Object.entries(BET_TYPES).map(([key, val]) => (
              <button key={key} onClick={() => phase === 'BETTING' && setBetType(key)} disabled={phase !== 'BETTING'}
                className={`py-1.5 rounded-lg text-[11px] font-bold transition border ${betType === key ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/40 text-gray-400 border-white/10'}`}>
                {val.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mb-3">{BET_TYPES[betType].desc}（{requiredPicks}頭選択）</p>

          <div className="space-y-1.5 mb-4 max-h-[420px] overflow-y-auto pr-1">
            {card.entries.map(h => {
              const idx = picks.indexOf(h.id);
              const selected = idx >= 0;
              return (
                <button key={h.id} onClick={() => togglePick(h.id)} disabled={phase !== 'BETTING'}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl border-2 text-left text-sm transition ${selected ? 'border-amber-400 bg-amber-400/10' : 'border-transparent bg-black/40 hover:bg-black/60'} disabled:opacity-60`}>
                  <span className="w-7 h-7 flex justify-center items-center rounded-lg text-xs font-black shrink-0" style={{ backgroundColor: h.color, color: h.textColor }}>{h.id}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate text-[13px]">{h.name}</div>
                    <div className="text-gray-500 text-[10px]">{h.jockey}・{RUNNING_STYLES[h.style].label}・{h.condition}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-amber-300 font-bold text-sm">{h.odds.toFixed(1)}</div>
                    <div className="text-[10px] text-gray-500">{h.popularity}番人気</div>
                  </div>
                  {selected && requiredPicks > 1 && (
                    <span className="ml-1 text-[10px] bg-amber-400 text-black font-black rounded px-1">{idx === 0 ? '1着' : '2着'}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-black/40 p-4 rounded-xl border border-white/10">
            <label className="block text-[11px] text-gray-400 font-bold mb-2">購入金額 (G)</label>
            <input type="number" min="100" step="100" value={betAmount} onChange={e => setBetAmount(e.target.value)} disabled={phase !== 'BETTING'}
              className="w-full bg-black/60 text-white font-mono text-lg p-3 rounded-lg border border-white/10 focus:border-amber-400 outline-none mb-2 disabled:opacity-50" />
            <div className="flex gap-1.5 mb-3">
              {[500, 1000, 5000].map(v => (
                <button key={v} onClick={() => setBetAmount(String((parseInt(betAmount, 10) || 0) + v))} disabled={phase !== 'BETTING'}
                  className="flex-1 bg-white/5 hover:bg-white/15 text-gray-400 text-[11px] py-1 rounded transition disabled:opacity-40">+{v}</button>
              ))}
            </div>
            {expectedMultiplier > 0 && (
              <div className="text-[11px] text-gray-400 mb-3 text-center">
                的中時 <span className="text-amber-300 font-bold">{Math.floor((parseInt(betAmount, 10) || 0) * expectedMultiplier).toLocaleString()} G</span>
                <span className="text-gray-600">（{expectedMultiplier.toFixed(1)}倍）</span>
              </div>
            )}
            {phase === 'RESULT' ? (
              <GoldButton onClick={newRace} className="w-full py-3">次のレースへ</GoldButton>
            ) : (
              <GoldButton onClick={buyTicket} disabled={phase !== 'BETTING' || picks.length !== requiredPicks} className="w-full py-3">
                {phase === 'COUNTDOWN' ? `${countdown} 秒後 発走` : phase === 'RACING' ? 'レース中…' : '馬券を購入して発走'}
              </GoldButton>
            )}
          </div>
        </Panel>

        {/* コース */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="relative rounded-3xl overflow-hidden border-[10px] border-[#2a1c0c] shadow-2xl" style={{ height: trackHeight }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1e7a45 0%,#14663a 50%,#0d4a29 100%)' }} />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 58px,rgba(0,0,0,0.35) 58px,rgba(0,0,0,0.35) 60px)' }} />
            <div className="absolute left-[3%] top-0 bottom-0 w-1 bg-white/40" />
            <div className="absolute right-[5%] top-0 bottom-0 w-5 z-10" style={{ background: 'repeating-linear-gradient(0deg,#fff 0 10px,#111 10px 20px)' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap">GOAL</div>
            </div>

            {phase === 'COUNTDOWN' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                <div className="text-8xl font-black text-white animate-bounce">{countdown || 'GO!'}</div>
              </div>
            )}

            {runners.map((h, idx) => {
              const laneH = trackHeight / laneCount;
              const y = idx * laneH + laneH / 2 - 26;
              const x = 3 + (h.pos / 100) * 89;
              const isPick = picks.includes(h.id);
              return (
                <div key={h.id} className="absolute z-10 transition-all duration-75 ease-linear" style={{ left: `${x}%`, top: y }}>
                  <div className="flex flex-col items-center">
                    <div className={`text-2xl md:text-3xl ${phase === 'RACING' ? 'animate-bounce' : ''}`} style={{ animationDuration: '0.6s' }}>🐎</div>
                    <div className="w-6 h-6 -mt-1 flex justify-center items-center rounded-full text-[11px] font-black border-2 border-black/60" style={{ backgroundColor: h.color, color: h.textColor }}>{h.id}</div>
                    {isPick && <div className="text-amber-300 text-[10px] font-black">▲</div>}
                  </div>
                </div>
              );
            })}

            {phase === 'RACING' && (
              <div className="absolute bottom-2 left-3 right-3 space-y-0.5 z-20">
                {runners.map(h => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="text-white text-[10px] font-bold w-4">{h.id}</span>
                    <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, h.stamina)}%`, backgroundColor: h.stamina > 55 ? '#22c55e' : h.stamina > 25 ? '#eab308' : '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Panel className="p-5">
            {phase === 'RESULT' && finishOrder.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <h3 className="text-2xl font-black text-white">レース結果</h3>
                  {payoutInfo?.hit && <span className="bg-amber-400 text-black text-sm font-black px-3 py-1 rounded-full animate-pulse">🎉 的中！</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {finishOrder.slice(0, 4).map((h, i) => {
                    const medal = ['🥇', '🥈', '🥉', '4'][i];
                    const mine = picks.includes(h.id);
                    return (
                      <div key={h.id} className={`p-3 rounded-xl text-center border ${mine ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40'}`}>
                        <div className="text-xl">{medal}</div>
                        <div className="w-8 h-8 mx-auto my-1 flex justify-center items-center rounded-full text-xs font-black" style={{ backgroundColor: h.color, color: h.textColor }}>{h.id}</div>
                        <div className="text-[12px] text-white font-bold truncate">{h.name}</div>
                        <div className="text-[11px] text-amber-300">{h.odds.toFixed(1)}倍</div>
                      </div>
                    );
                  })}
                </div>
                {payoutInfo && (
                  <div className={`p-4 rounded-2xl border-2 text-center mb-3 ${payoutInfo.hit ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-black/40'}`}>
                    <div className="text-sm text-gray-400 font-bold mb-1">
                      {BET_TYPES[payoutInfo.ticket.type].label}／{payoutInfo.ticket.picks.join('-')}／{payoutInfo.ticket.amount.toLocaleString()}G
                    </div>
                    <div className={`text-3xl font-black ${payoutInfo.hit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {payoutInfo.hit ? `払戻 +${payoutInfo.win.toLocaleString()} G` : 'ハズレ'}
                    </div>
                  </div>
                )}
                <p className="text-center text-base font-bold text-white">{commentary}</p>
              </div>
            ) : (
              <div>
                <p className="text-lg md:text-xl font-bold text-white text-center mb-3">{commentary}</p>
                {phase === 'RACING' && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {[...runners].sort((a, b) => b.pos - a.pos).slice(0, 5).map((h, i) => (
                      <span key={h.id} className="text-[11px] px-3 py-1 rounded-full bg-black/50 border border-white/10 text-gray-300">
                        {i + 1}位 <span className="text-white font-bold">{h.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   英単語バイト
   ========================================================== */
function LaborView({ balance, updateBalance, onBack, showToast }) {
  const QUIZ_COUNT = 5;
  const [phase, setPhase] = useState('SELECT');
  const [level, setLevel] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [earned, setEarned] = useState(0);
  const inputRef = useRef(null);
  const scoreRef = useRef(0);
  const lockRef = useRef(false);

  const startQuiz = (lvl) => {
    setLevel(lvl);
    const pool = [...WORD_LEVELS[lvl].words].sort(() => Math.random() - 0.5).slice(0, QUIZ_COUNT);
    setQuestions(pool); setCurrentQ(0); setScore(0); scoreRef.current = 0;
    setInput(''); setFeedback(null); setTimeLeft(10); lockRef.current = false;
    setPhase('QUIZ');
  };

  const finishQuiz = useCallback(async (finalScore, lvl) => {
    const base = WORD_LEVELS[lvl].reward;
    const reward = Math.floor(base * (finalScore / QUIZ_COUNT) * (finalScore === QUIZ_COUNT ? 1.5 : 1));
    setEarned(reward);
    if (reward > 0) { try { await updateBalance(reward); } catch (e) { /* noop */ } }
    setPhase('RESULT');
  }, [updateBalance]);

  const handleAnswer = useCallback((ans) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const correct = (questions[currentQ]?.en || '').toLowerCase();
    const ok = ans.trim().toLowerCase() === correct && correct !== '';
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) { scoreRef.current += 1; setScore(scoreRef.current); }
    setTimeout(() => {
      setFeedback(null); setInput(''); setTimeLeft(10);
      if (currentQ + 1 >= QUIZ_COUNT) finishQuiz(scoreRef.current, level);
      else { setCurrentQ(q => q + 1); lockRef.current = false; }
    }, 850);
  }, [questions, currentQ, level, finishQuiz]);

  // タイマー（状態更新関数の中で副作用を起こさない実装に修正）
  useEffect(() => {
    if (phase !== 'QUIZ' || feedback) return;
    if (timeLeft <= 0) { handleAnswer(''); return; }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, feedback, handleAnswer]);

  useEffect(() => { if (phase === 'QUIZ' && inputRef.current) inputRef.current.focus(); }, [currentQ, phase]);

  const q = questions[currentQ];

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>

      {phase === 'SELECT' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-white mb-2">英単語バイト</h2>
            <p className="text-gray-400">日本語を見て英単語を入力しよう！<br />全問正解でボーナス報酬 ×1.5</p>
          </div>
          <div className="space-y-4">
            {WORD_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startQuiz(i)} className={`w-full p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 ${lv.bg}`}>
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <span className={`text-2xl font-black ${lv.color}`}>{lv.label}</span>
                    <p className="text-gray-400 text-sm mt-1">全{QUIZ_COUNT}問 / 1問10秒</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl md:text-3xl font-black ${lv.color}`}>最大 {Math.floor(lv.reward * 1.5).toLocaleString()} G</div>
                    <div className="text-gray-500 text-[11px]">全問正解ボーナス込み</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-6">※報酬は正解数に比例。参加費無料！</p>
        </div>
      )}

      {phase === 'QUIZ' && q && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 font-bold">{currentQ + 1} / {QUIZ_COUNT}問</span>
            <span className={`text-2xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>⏱ {timeLeft}秒</span>
            <span className={`text-sm font-bold ${WORD_LEVELS[level].color}`}>{WORD_LEVELS[level].label}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-8">
            <div className="h-2 rounded-full bg-amber-400 transition-all" style={{ width: `${(currentQ / QUIZ_COUNT) * 100}%` }} />
          </div>
          <Panel className={`p-10 text-center mb-6 border-2 ${feedback === 'correct' ? 'border-emerald-500' : feedback === 'wrong' ? 'border-red-500' : ''}`}>
            <p className="text-gray-400 text-xs font-bold mb-3 tracking-[0.3em]">日本語 → 英語</p>
            <p className="text-4xl md:text-5xl font-black text-white mb-2">{q.ja}</p>
            {feedback && (
              <p className={`text-xl font-black mt-4 ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>
                {feedback === 'correct' ? '✅ 正解！' : `❌ 不正解… 正解: ${q.en}`}
              </p>
            )}
          </Panel>
          <div className="flex gap-3">
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !feedback && handleAnswer(input)}
              placeholder="英単語を入力して Enter" disabled={!!feedback}
              className="flex-1 bg-black/50 text-white font-mono text-xl p-4 rounded-xl border-2 border-white/10 focus:outline-none focus:border-amber-400 disabled:opacity-50" />
            <GoldButton onClick={() => !feedback && handleAnswer(input)} disabled={!!feedback} className="px-6">回答</GoldButton>
          </div>
        </div>
      )}

      {phase === 'RESULT' && (
        <div className="text-center">
          <Panel gold className="p-10 mb-6">
            <div className="text-6xl mb-4">{score === QUIZ_COUNT ? '🏆' : score >= 3 ? '👍' : '😢'}</div>
            <h3 className="text-3xl font-black text-white mb-2">バイト終了！</h3>
            <p className="text-gray-400 mb-6">{WORD_LEVELS[level].label} / 全{QUIZ_COUNT}問</p>
            <div className="text-6xl font-black text-amber-300 mb-2">{score}<span className="text-2xl text-gray-400">/{QUIZ_COUNT}</span></div>
            {score === QUIZ_COUNT && <div className="bg-amber-500/10 border border-amber-500 rounded-xl p-3 mb-4 text-amber-300 font-bold">🎉 全問正解ボーナス ×1.5 適用！</div>}
            <div className="text-3xl font-black text-emerald-400">+{earned.toLocaleString()} G</div>
          </Panel>
          <div className="flex gap-4">
            <button onClick={() => setPhase('SELECT')} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition">レベル選択へ</button>
            <GoldButton onClick={() => startQuiz(level)} className="flex-1 py-4">もう一度！</GoldButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   マインスイーパー採掘
   ========================================================== */
function MiningView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [phase, setPhase] = useState('SELECT');
  const [levelIdx, setLevelIdx] = useState(null);
  const [board, setBoard] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [result, setResult] = useState(null);
  const [exploded, setExploded] = useState(null);
  const [safeCount, setSafeCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const busyRef = useRef(false);

  const lvl = levelIdx !== null ? MINE_LEVELS[levelIdx] : null;
  const totalSafe = lvl ? lvl.rows * lvl.cols - lvl.mines : 0;

  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => {
    if (phase !== 'PLAYING') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const generateBoard = (rows, cols, mines, firstRow, firstCol) => {
    const cells = Array(rows * cols).fill(0);
    const safeZone = new Set();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = firstRow + dr, c = firstCol + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) safeZone.add(r * cols + c);
    }
    let placed = 0, guard = 0;
    const maxMines = Math.min(mines, rows * cols - safeZone.size);
    while (placed < maxMines && guard < 100000) {
      guard++;
      const idx = Math.floor(Math.random() * rows * cols);
      if (cells[idx] !== -1 && !safeZone.has(idx)) { cells[idx] = -1; placed++; }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (cells[idx] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr * cols + nc] === -1) count++;
      }
      cells[idx] = count;
    }
    return cells;
  };

  const expandEmpty = (b, revArr, row, col, rows, cols) => {
    const queue = [[row, col]];
    const visited = new Set();
    while (queue.length) {
      const [r, c] = queue.shift();
      const idx = r * cols + c;
      if (visited.has(idx)) continue;
      visited.add(idx);
      if (b[idx] === -1) continue;
      revArr[idx] = true;
      if (b[idx] === 0) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !revArr[nr * cols + nc]) queue.push([nr, nc]);
        }
      }
    }
    return revArr;
  };

  const startGame = async (idx) => {
    const L = MINE_LEVELS[idx];
    if (busyRef.current) return;
    if (balance < L.cost) { showToast(`参加費 ${L.cost.toLocaleString()} G が足りません！`, 'error'); return; }
    busyRef.current = true;
    try { await updateBalance(-L.cost); } catch (e) { busyRef.current = false; return; }
    busyRef.current = false;
    setLevelIdx(idx);
    setBoard([]);
    setRevealed(Array(L.rows * L.cols).fill(false));
    setFlagged(Array(L.rows * L.cols).fill(false));
    setResult(null); setExploded(null); setSafeCount(0); setElapsed(0);
    setPhase('PLAYING');
    showToast(`${L.label} 開始！参加費 -${L.cost.toLocaleString()} G`, 'warning');
  };

  const handleCellClick = async (row, col) => {
    if (phase !== 'PLAYING' || result || !lvl) return;
    const idx = row * lvl.cols + col;
    if (revealed[idx] || flagged[idx]) return;

    let cur = board;
    if (cur.length === 0) {
      cur = generateBoard(lvl.rows, lvl.cols, lvl.mines, row, col);
      setBoard(cur);
    }

    if (cur[idx] === -1) {
      clearInterval(timerRef.current);
      const rev = [...revealed]; rev[idx] = true;
      setRevealed(rev); setExploded(idx); setResult('LOSE'); setPhase('RESULT');
      showToast('💥 爆発！参加費は没収です', 'error');
      emitNews(`💥 ${playerName} が${lvl.label}で爆発…`, 'loss');
      return;
    }

    const rev = expandEmpty(cur, [...revealed], row, col, lvl.rows, lvl.cols);
    setRevealed(rev);
    const opened = rev.filter(Boolean).length;
    setSafeCount(opened);

    if (opened >= totalSafe) {
      clearInterval(timerRef.current);
      setResult('WIN'); setPhase('RESULT');
      try { await updateBalance(lvl.reward); } catch (e) { /* noop */ }
      showToast(`⛏️ 採掘成功！+${lvl.reward.toLocaleString()} G`, 'success');
      emitNews(`⛏️ ${playerName} が${lvl.label}の採掘に成功！${lvl.reward.toLocaleString()} G 獲得！`, 'mining');
    }
  };

  const handleRightClick = (e, row, col) => {
    e.preventDefault();
    if (phase !== 'PLAYING' || result || !lvl) return;
    const idx = row * lvl.cols + col;
    if (revealed[idx]) return;
    setFlagged(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
  };

  const numberColors = ['', 'text-blue-500', 'text-emerald-600', 'text-red-500', 'text-purple-600', 'text-red-700', 'text-cyan-600', 'text-black', 'text-gray-500'];
  const progress = totalSafe > 0 ? (safeCount / totalSafe) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="w-full flex flex-wrap gap-3 justify-between items-center mb-6">
        <button onClick={() => { clearInterval(timerRef.current); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        {phase === 'PLAYING' && lvl && (
          <div className="flex items-center gap-4 text-sm">
            <span className={`font-bold ${lvl.color}`}>{lvl.label}</span>
            <span className="text-gray-400 font-mono">⏱ {elapsed}秒</span>
            <span className="text-amber-300 font-mono font-bold">{safeCount}/{totalSafe}</span>
            <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-amber-300 font-bold">{balance.toLocaleString()} G</div>
          </div>
        )}
      </div>

      {phase === 'SELECT' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 flex items-center justify-center gap-3"><Pickaxe size={34} className="text-amber-400" /> マインスイーパー採掘</h2>
            <p className="text-gray-400">地雷を避けて安全なマスを全て掘ればクリア。爆発すると参加費は没収。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MINE_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startGame(i)} disabled={balance < lv.cost}
                className={`p-6 rounded-2xl border-2 text-left transition-all hover:-translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed ${lv.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{lv.icon}</span>
                  <div>
                    <span className={`text-xl font-black ${lv.color}`}>{lv.label}</span>
                    <div className="text-gray-500 text-[11px]">{lv.rows}×{lv.cols} / 地雷{lv.mines}個</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div><div className="text-gray-400 text-[11px]">参加費</div><div className="text-red-400 font-black text-lg">-{lv.cost.toLocaleString()} G</div></div>
                  <div className="text-right"><div className="text-gray-400 text-[11px]">クリア報酬</div><div className={`font-black text-2xl ${lv.color}`}>+{lv.reward.toLocaleString()} G</div></div>
                </div>
                <div className="text-[11px] text-gray-600 mt-2">地雷密度 {Math.round((lv.mines / (lv.rows * lv.cols)) * 100)}%</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'PLAYING' && lvl && (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl mb-4">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1"><span>採掘進捗</span><span>{Math.round(progress)}%</span></div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Panel className="p-3 overflow-auto max-w-full">
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lvl.cols}, minmax(0,1fr))`, gap: 2 }}>
              {Array(lvl.rows * lvl.cols).fill(0).map((_, idx) => {
                const row = Math.floor(idx / lvl.cols), col = idx % lvl.cols;
                const isRev = revealed[idx], isFlag = flagged[idx];
                const num = board.length ? board[idx] : 0;
                return (
                  <button key={idx} onClick={() => handleCellClick(row, col)} onContextMenu={e => handleRightClick(e, row, col)}
                    className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-xs md:text-sm font-black rounded transition select-none ${isRev ? 'bg-slate-200' : 'bg-slate-600 hover:bg-slate-500 border border-slate-500'}`}>
                    {isFlag && !isRev ? '🚩' : isRev && num > 0 ? <span className={numberColors[num]}>{num}</span> : ''}
                  </button>
                );
              })}
            </div>
          </Panel>
          <div className="mt-4 text-[11px] text-gray-500 text-center">
            右クリック（モバイルは長押し）でフラグ ／ 残りフラグ {lvl.mines - flagged.filter(Boolean).length} 個
          </div>
        </div>
      )}

      {phase === 'RESULT' && lvl && (
        <div className="text-center max-w-md mx-auto">
          <Panel gold className={`p-10 mb-6 ${result === 'WIN' ? '' : 'border-red-500/50'}`}>
            <div className="text-6xl mb-4">{result === 'WIN' ? '⛏️' : '💥'}</div>
            <h3 className={`text-3xl font-black mb-2 ${result === 'WIN' ? 'text-amber-300' : 'text-red-400'}`}>{result === 'WIN' ? '採掘成功！' : '爆発！！'}</h3>
            <p className="text-gray-400 mb-4">{lvl.label} / {elapsed}秒</p>
            {result === 'WIN'
              ? <div className="text-4xl font-black text-emerald-400">+{lvl.reward.toLocaleString()} G</div>
              : <div className="text-2xl font-black text-red-400">参加費 {lvl.cost.toLocaleString()} G 没収</div>}
          </Panel>

          {board.length > 0 && (
            <Panel className="p-3 mb-6 overflow-auto">
              <p className="text-[11px] text-gray-500 mb-2">地雷の配置</p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lvl.cols}, minmax(0,1fr))`, gap: 2 }}>
                {board.map((cell, idx) => (
                  <div key={idx} className={`w-6 h-6 flex items-center justify-center text-[10px] font-black rounded ${idx === exploded ? 'bg-red-600' : cell === -1 ? 'bg-slate-800 text-red-400' : revealed[idx] ? 'bg-slate-300 text-slate-700' : 'bg-slate-600 text-slate-400'}`}>
                    {idx === exploded ? '💥' : cell === -1 ? '💣' : revealed[idx] && cell > 0 ? cell : ''}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="flex gap-4">
            <button onClick={() => { setPhase('SELECT'); setLevelIdx(null); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition">レベル選択へ</button>
            <GoldButton onClick={() => startGame(levelIdx)} disabled={balance < lvl.cost} className="flex-1 py-4">{result === 'WIN' ? 'もう一度！' : 'リベンジ！'}</GoldButton>
          </div>
        </div>
      )}
    </div>
  );
}

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
    if (result === 'WIN') emitNews(`✊ ${playerName} が ${opp} とのじゃんけんに勝利！ +${bet.toLocaleString()} G`, 'janken');
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
    if (isNaN(bet) || bet < 10) { showToast('賭け金は10G以上にしてください。', 'error'); return; }
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
    if ((room.bet || 0) > balance) { showToast(`賭け金 ${(room.bet || 0).toLocaleString()} G が足りません。`, 'error'); return; }
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
              <div>所持金: <span className="text-amber-300 font-bold">{balance.toLocaleString()} G</span></div>
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
                    <span className="text-amber-300 font-mono font-black">{(room.bet || 0).toLocaleString()} G</span>
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
        <div className="text-sm text-gray-400">賭け金: <span className="text-amber-300 font-black">{(currentRoom?.bet || 0).toLocaleString()} G</span></div>
        <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{balance.toLocaleString()} G</div>
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
                {gameResult.result === 'DRAW' ? '賭け金の移動なし' : `${gameResult.result === 'WIN' ? '+' : '-'}${gameResult.bet.toLocaleString()} G`}
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
    if (isNaN(amount) || amount < INVEST_MIN_AMOUNT) { showToast(`投資額は ${INVEST_MIN_AMOUNT.toLocaleString()}G 以上にしてください。`, 'error'); return; }
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
      showToast(`📈 ${target} に ${amount.toLocaleString()}G 投資（${fee.toLocaleString()}G 還元／元本 ${principal.toLocaleString()}G）`, 'success');
      if (amount >= 50000) emitNews(`📈 ${playerName} が ${target} に ${amount.toLocaleString()}G の大口投資！`, 'invest');
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
        showToast(`✅ ${inv.target} 株を売却 +${value.toLocaleString()}G（損益 +${profit.toLocaleString()}G）`, 'success');
        if (profit >= 20000) emitNews(`📈 ${playerName} が ${inv.target} 株で +${profit.toLocaleString()}G の利益確定！`, 'invest');
      } else {
        showToast(`📉 ${inv.target} 株を売却 ${value.toLocaleString()}G（損益 ${profit.toLocaleString()}G）`, 'warning');
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
          <p>・例）10,000G投資 → 1,000G還元／元本9,000G。投資先が+10%成長で元本+1%（9,090G）。</p>
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
              <span className="text-xl font-mono font-black text-amber-300">{balance.toLocaleString()} G</span>
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
              <div><span className="text-gray-500 text-[11px] block">投資先への還元</span><span className="text-cyan-300 font-mono font-bold">{previewFee.toLocaleString()} G</span></div>
              <div><span className="text-gray-500 text-[11px] block">運用元本</span><span className="text-emerald-400 font-mono font-bold">{(previewAmount - previewFee).toLocaleString()} G</span></div>
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
                    <div><span className="text-gray-500 block">元本</span><span className="text-white font-mono font-bold">{inv.principal.toLocaleString()}G</span></div>
                    <div><span className="text-gray-500 block">対象の成長</span><span className={`font-mono font-bold ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</span></div>
                    <div><span className="text-gray-500 block">評価額</span><span className="text-amber-300 font-mono font-bold">{value.toLocaleString()}G</span></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()}G</span>
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
                        <span className={`font-mono font-black ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()}G</span>
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
                  <span className="text-emerald-400 font-mono font-bold">+{(inv.fee || 0).toLocaleString()}G 受取済</span>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
