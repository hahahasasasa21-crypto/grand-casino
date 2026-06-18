import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch, addDoc, query, orderBy, limit, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw, TrendingDown, Briefcase, Lock, Star, Newspaper, Pickaxe, BookOpen, History, Bomb, Scissors, Hand, Square, TrendingUp, BarChart2 } from 'lucide-react';
import { firebaseConfig, appId } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== 競馬イベント設定 ====================
const HORSE_RACING_EVENT_ACTIVE = false;

// ==================== スロット定数 ====================
const SYMBOLS = [
  { sym: '🍒', name: 'CHERRY', color: 'text-red-500', weight: 30 },
  { sym: '🍋', name: 'LEMON', color: 'text-yellow-400', weight: 25 },
  { sym: '🍊', name: 'ORANGE', color: 'text-orange-400', weight: 20 },
  { sym: '🍇', name: 'GRAPE', color: 'text-purple-500', weight: 15 },
  { sym: '🔔', name: 'BELL', color: 'text-yellow-300', weight: 10 },
  { sym: '🍉', name: 'MELON', color: 'text-green-400', weight: 8 },
  { sym: '💎', name: 'DIAMOND', color: 'text-blue-400', weight: 5 },
  { sym: 'BAR', name: 'BAR', color: 'text-gray-300', weight: 3 },
  { sym: '7️⃣', name: 'SEVEN', color: 'text-red-600', weight: 1 },
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

// ==================== 英単語定数 ====================
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

// ==================== 採掘定数 ====================
const MINE_LEVELS = [
  { label: '浅坑道', cost: 200, rows: 6, cols: 8, mines: 8, reward: 800, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: '⛏️' },
  { label: '中層坑道', cost: 500, rows: 8, cols: 10, mines: 18, reward: 2500, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '🪨' },
  { label: '深層坑道', cost: 1500, rows: 10, cols: 12, mines: 40, reward: 8000, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: '💣' },
  { label: '地獄坑道', cost: 5000, rows: 10, cols: 14, mines: 65, reward: 30000, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '☠️' },
];

// ==================== 金融定数 ====================
const INTEREST_RATE_30MIN = 0.001;
const INTEREST_INTERVAL = 1800000;
const LOAN_INTEREST_RATE = 0.003;
const LOAN_INTERVAL = 900000;

// ==================== ニュースを投稿するユーティリティ ====================
async function postNews(db, appId, message, type = 'info') {
  try {
    const newsRef = collection(db, 'artifacts', appId, 'public', 'data', 'news');
    await addDoc(newsRef, { message, type, createdAt: Date.now() });
  } catch (e) { console.error('news post error', e); }
}

// ==================== 投資ユーティリティ ====================
async function updateStockPriceForTarget(db, appId, targetName, gambleNet) {
  try {
    const safeTarget = encodeURIComponent(targetName);
    const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'stocks', safeTarget);
    const snap = await getDoc(stockRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const base = data.baseInvestment || 1;
    let changeRate = Math.max(-0.8, Math.min(0.8, (gambleNet / base) * 0.5));
    const newPrice = Math.max(0.01, (data.currentPrice || 1.0) * (1 + changeRate));
    const priceHistory = [...(data.priceHistory || []), { price: newPrice, at: Date.now() }].slice(-50);
    await updateDoc(stockRef, { currentPrice: newPrice, priceHistory, lastUpdated: Date.now() });
  } catch (e) { console.error('stock price update error', e); }
}

// ==================== ポーカーユーティリティ ====================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardKey(c) { return `${c.rank}${c.suit}`; }

function evaluateHand(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return { rank: 0, name: '---', best: [] };
  const combos = getCombinations(all, 5);
  let best = null;
  for (const combo of combos) {
    const score = scoreHand(combo);
    if (!best || score.rank > best.rank || (score.rank === best.rank && compareKickers(score.tiebreak, best.tiebreak) > 0)) {
      best = { ...score, best: combo };
    }
  }
  return best;
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === k) return [arr];
  const [first, ...rest] = arr;
  return [...getCombinations(rest, k - 1).map(c => [first, ...c]), ...getCombinations(rest, k)];
}

function compareKickers(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function scoreHand(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = new Set(suits).size === 1;
  const isStraight = checkStraight(vals);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const groupCounts = groups.map(g => g[1]);

  if (isFlush && isStraight) {
    if (vals[0] === 14 && vals[1] === 13) return { rank: 9, name: 'ロイヤルフラッシュ', tiebreak: vals };
    return { rank: 8, name: 'ストレートフラッシュ', tiebreak: vals };
  }
  if (groupCounts[0] === 4) {
    const quad = +groups[0][0]; const kicker = vals.filter(v => v !== quad);
    return { rank: 7, name: 'フォーカード', tiebreak: [quad, ...kicker] };
  }
  if (groupCounts[0] === 3 && groupCounts[1] === 2) {
    return { rank: 6, name: 'フルハウス', tiebreak: [+groups[0][0], +groups[1][0]] };
  }
  if (isFlush) return { rank: 5, name: 'フラッシュ', tiebreak: vals };
  if (isStraight) return { rank: 4, name: 'ストレート', tiebreak: vals };
  if (groupCounts[0] === 3) {
    const trip = +groups[0][0]; const kickers = vals.filter(v => v !== trip);
    return { rank: 3, name: 'スリーカード', tiebreak: [trip, ...kickers] };
  }
  if (groupCounts[0] === 2 && groupCounts[1] === 2) {
    const p1 = +groups[0][0]; const p2 = +groups[1][0];
    const hi = Math.max(p1, p2); const lo = Math.min(p1, p2);
    const kicker = vals.find(v => v !== p1 && v !== p2);
    return { rank: 2, name: 'ツーペア', tiebreak: [hi, lo, kicker] };
  }
  if (groupCounts[0] === 2) {
    const pair = +groups[0][0]; const kickers = vals.filter(v => v !== pair);
    return { rank: 1, name: 'ワンペア', tiebreak: [pair, ...kickers] };
  }
  return { rank: 0, name: 'ハイカード', tiebreak: vals };
}

function checkStraight(sortedVals) {
  if (sortedVals[0] - sortedVals[4] === 4 && new Set(sortedVals).size === 5) return true;
  if (JSON.stringify(sortedVals) === JSON.stringify([14,5,4,3,2])) return true;
  return false;
}

// ==================== メインApp ====================
export default function App() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [balance, setBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [loanBalance, setLoanBalance] = useState(0);
  const [creditScore, setCreditScore] = useState(100);
  const [lastInterestTime, setLastInterestTime] = useState(Date.now());
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

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { showToast("認証エラー", 'error'); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoadingMsg(''); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !playerName) return;
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setBalance(d.balance);
        setBankBalance(d.bankBalance || 0);
        setLoanBalance(d.loanBalance || 0);
        setCreditScore(d.creditScore || 100);
        setLastInterestTime(d.lastInterestTime || Date.now());
        setTransferHistory(d.transferHistory || []);
        calcOfflineInterest(d, docRef);
        calcLoanInterest(d, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000, bankBalance: 0, loanBalance: 0,
          creditScore: 100, lastInterestTime: now,
          createdAt: now, name: playerName, password: inputPassword,
          transferHistory: []
        });
        setBalance(10000); setBankBalance(0); setLoanBalance(0); setCreditScore(100);
        setTransferHistory([]);
      }
    });
    return () => unsub();
  }, [user, playerName]);

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

  useEffect(() => {
    if (!user || !playerName || bankBalance <= 0) return;
    const timer = setInterval(() => {
      const safeName = encodeURIComponent(playerName);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
      const interest = Math.floor(bankBalance * INTEREST_RATE_30MIN);
      if (interest > 0) {
        updateDoc(docRef, { bankBalance: increment(interest), lastInterestTime: Date.now() });
        showToast(`🏦 銀行利子 +${interest.toLocaleString()} G！`, 'success');
      }
    }, INTEREST_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, bankBalance]);

  useEffect(() => {
    if (!user || !playerName || loanBalance <= 0) return;
    const timer = setInterval(() => {
      const safeName = encodeURIComponent(playerName);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
      const interest = Math.floor(loanBalance * LOAN_INTEREST_RATE);
      if (interest > 0) {
        updateDoc(docRef, { loanBalance: increment(interest), creditScore: increment(-1) });
        showToast(`💸 ローン利息 +${interest.toLocaleString()} G！ 信用度 -1`, 'warning');
      }
    }, LOAN_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, loanBalance]);

  useEffect(() => {
    if (!user || (view !== 'RANKING' && view !== 'MENU')) return;
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsub = onSnapshot(collRef, snap => {
      const players = [];
      snap.forEach(d => {
        const data = d.data();
        players.push({
          name: data.name || decodeURIComponent(d.id),
          balance: data.balance || 0, bankBalance: data.bankBalance || 0,
          loanBalance: data.loanBalance || 0, creditScore: data.creditScore || 100,
          total: (data.balance||0) + (data.bankBalance||0) - (data.loanBalance||0)
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
      const periods = Math.floor(diff / INTEREST_INTERVAL);
      let bank = data.bankBalance, total = 0;
      for (let i = 0; i < periods; i++) { const int = Math.floor(bank * INTEREST_RATE_30MIN); total += int; bank += int; }
      if (total > 0) {
        await updateDoc(docRef, { bankBalance: increment(total), lastInterestTime: now });
        showToast(`🏦 不在中に利子 +${total.toLocaleString()} G！`, 'success');
      }
    }
  };

  const calcLoanInterest = async (data, docRef) => {
    const now = Date.now();
    const diff = now - (data.lastLoanTime || now);
    if (diff >= LOAN_INTERVAL && (data.loanBalance || 0) > 0) {
      const periods = Math.floor(diff / LOAN_INTERVAL);
      let loan = data.loanBalance, total = 0;
      for (let i = 0; i < periods; i++) { const int = Math.floor(loan * LOAN_INTEREST_RATE); total += int; loan += int; }
      if (total > 0) {
        await updateDoc(docRef, { loanBalance: increment(total), lastLoanTime: now, creditScore: increment(-periods) });
        showToast(`💸 不在中にローン利息 +${total.toLocaleString()} G！ 信用度 -${periods}`, 'warning');
      }
    }
  };

  const updateBalance = async (amount) => {
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(amount) });
  };

  const updateBalanceWithStock = async (amount) => {
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(amount) });
    if (amount !== 0) await updateStockPriceForTarget(db, appId, playerName, amount);
  };

  const addTransferHistory = async (entry) => {
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    const snap = await getDoc(docRef);
    const current = snap.exists() ? (snap.data().transferHistory || []) : [];
    const updated = [entry, ...current].slice(0, 30);
    await updateDoc(docRef, { transferHistory: updated });
  };

  const showToast = (msg, type = 'info') => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleLogin = async () => {
    if (inputName.trim().length < 2) { showToast("名前は2文字以上で入力してください。", 'error'); return; }
    if (!/^\d{3}$/.test(inputPassword)) { showToast("パスワードは3桁の数字を入力してください。", 'error'); return; }
    const safeName = encodeURIComponent(inputName.trim());
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.password && data.password !== inputPassword) { showToast("パスワードが違います！", 'error'); return; }
        if (!data.password) await updateDoc(docRef, { password: inputPassword });
      }
    } catch(e) { console.error(e); }
    setPlayerName(inputName.trim());
    setView('MENU');
  };

  const handleBankAction = async (action) => {
    const amount = parseInt(bankInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    if (action === 'DEPOSIT') {
      if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
      const creditBonus = amount >= 50000 ? 3 : amount >= 10000 ? 1 : 0;
      await updateDoc(docRef, {
        balance: increment(-amount), bankBalance: increment(amount), lastInterestTime: Date.now(),
        ...(creditBonus > 0 ? { creditScore: increment(creditBonus) } : {})
      });
      showToast(`🏦 ${amount.toLocaleString()} G 預け入れました。${creditBonus > 0 ? ` 信用度 +${creditBonus}` : ''}`, 'success');
    } else {
      if (bankBalance < amount) { showToast("銀行残高が足りません！", 'error'); return; }
      await updateDoc(docRef, { balance: increment(amount), bankBalance: increment(-amount) });
      showToast(`🏦 ${amount.toLocaleString()} G 引き出しました。`, 'success');
    }
    setBankInput('');
  };

  const handleLoan = async () => {
    const amount = parseInt(loanInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    const maxLoan = Math.floor(creditScore * 1000);
    if (loanBalance + amount > maxLoan) { showToast(`上限 ${maxLoan.toLocaleString()} G まで借りられます！`, 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(amount), loanBalance: increment(amount), lastLoanTime: Date.now(), creditScore: increment(-5) });
    showToast(`💰 ${amount.toLocaleString()} G 借入しました。信用度 -5`, 'warning');
    setLoanInput('');
  };

  const handleRepay = async () => {
    const amount = parseInt(loanInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
    if (loanBalance < amount) { showToast("返済額がローン残高を超えています！", 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(-amount), loanBalance: increment(-amount), creditScore: increment(15) });
    showToast(`✅ ${amount.toLocaleString()} G 返済！信用度 +15`, 'success');
    setLoanInput('');
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    const target = transferTarget.trim();
    if (!target || target === playerName) { showToast("自分以外のプレイヤー名を入力してください。", 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast("金額を正しく入力してください。", 'error'); return; }
    if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
    try {
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(target));
      const targetSnap = await getDoc(targetRef);
      if (!targetSnap.exists()) { showToast(`「${target}」が見つかりません。`, 'error'); return; }
      const selfRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', encodeURIComponent(playerName));
      const batch = writeBatch(db);
      batch.update(selfRef, { balance: increment(-amount) });
      batch.update(targetRef, { balance: increment(amount) });
      await batch.commit();
      const now = Date.now();
      await addTransferHistory({ type: 'SENT', to: target, amount, at: now });
      const targetCurrentSnap = await getDoc(targetRef);
      const targetHistory = targetCurrentSnap.exists() ? (targetCurrentSnap.data().transferHistory || []) : [];
      const targetUpdated = [{ type: 'RECEIVED', from: playerName, amount, at: now }, ...targetHistory].slice(0, 30);
      await updateDoc(targetRef, { transferHistory: targetUpdated });
      if (amount >= 50000) await postNews(db, appId, `💸 ${playerName} → ${target} への大口送金 ${amount.toLocaleString()} G が執行された！`, 'transfer');
      showToast(`💸 ${target} へ ${amount.toLocaleString()} G 送金！`, 'success');
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch(e) { showToast("送金エラー", 'error'); }
  };

  const emitNews = useCallback((msg, type) => { postNews(db, appId, msg, type); }, []);

  const getCreditColor = s => s >= 150 ? 'text-emerald-400' : s >= 100 ? 'text-yellow-400' : s >= 50 ? 'text-orange-400' : 'text-red-400';
  const getCreditLabel = s => s >= 150 ? 'AAA' : s >= 120 ? 'AA' : s >= 100 ? 'A' : s >= 80 ? 'BBB' : s >= 60 ? 'BB' : s >= 40 ? 'B' : 'CCC';

  const toastColors = {
    info: 'bg-yellow-500 text-black', success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white', warning: 'bg-orange-500 text-white'
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const newsTypeStyle = {
    info: 'text-blue-400', success: 'text-emerald-400', warning: 'text-orange-400',
    error: 'text-red-400', jackpot: 'text-yellow-300 font-black', transfer: 'text-purple-400',
    mining: 'text-amber-400', loss: 'text-red-400', janken: 'text-pink-400',
    invest: 'text-teal-400', poker: 'text-green-300', blackjack: 'text-lime-300',
  };

  if (loadingMsg) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <RefreshCw className="animate-spin text-yellow-500 mb-4" size={48} />
      <p className="font-bold text-lg">{loadingMsg}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {toastMsg && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold max-w-sm text-center ${toastColors[toastType]}`}>
          <AlertCircle size={20} /><span>{toastMsg}</span>
        </div>
      )}

      <div className="flex-grow">
        {/* ===== LOGIN ===== */}
        {view === 'LOGIN' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="mb-8 text-center">
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 mb-2">YUTAPON CASINO</h1>
              <h2 className="text-2xl font-bold text-gray-500 tracking-widest">& TURF ONLINE</h2>
            </div>
            <div className="bg-gray-900/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md">
              <div className="mb-6 text-center space-y-2">
                <p className="text-gray-300 font-medium">プレイヤー名とパスワードを入力してください</p>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm">
                  <p className="text-yellow-400 font-bold mb-1">📋 初回登録と引き継ぎ</p>
                  <p className="text-yellow-300/80 text-xs">
                    ・<span className="font-bold">初回：</span>名前＋パスワードを設定してそのまま登録<br/>
                    ・<span className="font-bold">引き継ぎ：</span>登録済みの名前＋同じパスワードでログイン<br/>
                    ・パスワードは<span className="font-bold text-yellow-400">数字3桁</span>（例：123）
                  </p>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">プレイヤー名</label>
                  <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 focus:outline-none focus:border-yellow-500 text-center text-2xl font-bold transition-all"
                    placeholder="名前を入力" maxLength={12} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1 flex items-center gap-1"><Lock size={12} /> パスワード（数字3桁）</label>
                  <input type="password" value={inputPassword} onChange={e => setInputPassword(e.target.value.slice(0, 3))} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 focus:outline-none focus:border-yellow-500 text-center text-3xl font-bold tracking-[1rem] transition-all"
                    placeholder="●●●" maxLength={3} inputMode="numeric" pattern="[0-9]*" />
                </div>
              </div>
              <button onClick={handleLogin} className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.03] active:scale-95 text-xl">
                入場・引き継ぎ
              </button>
            </div>
          </div>
        )}

        {/* ===== MENU ===== */}
        {view === 'MENU' && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6 gap-4">
              <div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-1">YUTAPON CASINO</h1>
                <p className="text-gray-400 font-medium">おかえりなさい、<span className="text-white font-bold">{playerName}</span> 様</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-gray-900/90 border border-gray-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                  <Coins className="text-yellow-500" size={20} />
                  <div><span className="text-xs text-gray-400 font-bold block">所持金</span><span className="font-mono text-lg font-black text-yellow-400">{balance.toLocaleString()} G</span></div>
                </div>
                <div className="bg-gray-900/90 border border-gray-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                  <Landmark className="text-emerald-400" size={20} />
                  <div><span className="text-xs text-gray-400 font-bold block">銀行残高</span><span className="font-mono text-lg font-black text-emerald-400">{bankBalance.toLocaleString()} G</span></div>
                </div>
                {loanBalance > 0 && (
                  <div className="bg-gray-900/90 border border-red-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                    <TrendingDown className="text-red-400" size={20} />
                    <div><span className="text-xs text-gray-400 font-bold block">ローン残高</span><span className="font-mono text-lg font-black text-red-400">{loanBalance.toLocaleString()} G</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-5">
                {/* カジノ */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">🎰 カジノ</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setView('SLOT')} className="group relative overflow-hidden bg-gradient-to-br from-purple-950 to-indigo-950 p-6 rounded-3xl shadow-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-purple-500/10 group-hover:text-purple-400/20 transition-all duration-500"><PlaySquare size={110} /></div>
                      <span className="bg-purple-500/10 text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-purple-300 transition">SLOT MACHINE</h2>
                      <p className="text-gray-400 text-sm">3×3マルチライン・高配当</p>
                    </button>
                    <button onClick={() => setView('ROULETTE')} className="group relative overflow-hidden bg-gradient-to-br from-red-950 to-rose-950 p-6 rounded-3xl shadow-2xl border border-red-500/20 hover:border-red-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-red-500/10 group-hover:text-red-400/20 transition-all duration-500">
                        <span className="text-[110px] select-none leading-none">🎡</span>
                      </div>
                      <span className="bg-red-500/10 text-red-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-red-300 transition">ROULETTE</h2>
                      <p className="text-gray-400 text-sm">数字1〜20・倍率は数字の値</p>
                    </button>
                    <button onClick={() => setView('BLACKJACK')} className="group relative overflow-hidden bg-gradient-to-br from-slate-950 to-gray-900 p-6 rounded-3xl shadow-2xl border border-lime-500/20 hover:border-lime-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-lime-500/10 group-hover:text-lime-400/20 transition-all duration-500">
                        <span className="text-[110px] select-none leading-none">🂡</span>
                      </div>
                      <span className="bg-lime-500/10 text-lime-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-lime-300 transition">BLACKJACK</h2>
                      <p className="text-gray-400 text-sm">ディーラー対戦・21を目指せ</p>
                    </button>
                    {HORSE_RACING_EVENT_ACTIVE ? (
                      <button onClick={() => setView('RACE')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-950 to-green-950 p-6 rounded-3xl shadow-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all transform hover:-translate-y-1 text-left">
                        <span className="bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Racing</span>
                        <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-emerald-300 transition">VIRTUAL TURF</h2>
                        <p className="text-gray-400 text-sm">8頭立て・天候・馬場状態あり</p>
                      </button>
                    ) : (
                      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-950 p-6 rounded-3xl shadow-2xl border border-gray-800 text-left opacity-60 cursor-not-allowed select-none">
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-3xl z-10">
                          <Lock size={32} className="text-gray-500 mb-2" />
                          <span className="text-gray-400 font-black text-lg">イベント期間外</span>
                        </div>
                        <span className="bg-gray-700/50 text-gray-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Racing</span>
                        <h2 className="text-xl font-extrabold text-gray-600 mb-1">VIRTUAL TURF</h2>
                        <p className="text-gray-700 text-sm">8頭立て・天候・馬場状態あり</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 対戦 */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">🤜 オンライン対戦</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setView('JANKEN')} className="group relative overflow-hidden bg-gradient-to-br from-pink-950 to-rose-950 p-6 rounded-3xl shadow-2xl border border-pink-500/20 hover:border-pink-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-pink-500/10 group-hover:text-pink-400/20 transition-all duration-500">
                        <span className="text-9xl select-none">✊</span>
                      </div>
                      <span className="bg-pink-500/10 text-pink-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Online Battle</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-pink-300 transition">オンラインじゃんけん</h2>
                      <p className="text-gray-400 text-sm">ルーム制・2人対戦・チャットあり</p>
                    </button>
                    {/* ポーカーボタン */}
                    <button onClick={() => setView('POKER')} className="group relative overflow-hidden bg-gradient-to-br from-green-950 to-emerald-950 p-6 rounded-3xl shadow-2xl border border-green-500/20 hover:border-green-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-green-500/10 group-hover:text-green-400/20 transition-all duration-500">
                        <span className="text-9xl select-none leading-tight">🃏</span>
                      </div>
                      <span className="bg-green-500/10 text-green-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Online Battle</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-green-300 transition">テキサスホールデム</h2>
                      <p className="text-gray-400 text-sm">2〜6人対戦・ブラインド制・本格ポーカー</p>
                    </button>
                  </div>
                </div>

                {/* 労働 */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">⛏️ 労働</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setView('LABOR')} className="group relative overflow-hidden bg-gradient-to-br from-blue-950 to-cyan-950 p-6 rounded-3xl shadow-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-500/10 group-hover:text-blue-400/20 transition-all duration-500"><BookOpen size={110} /></div>
                      <span className="bg-blue-500/10 text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Study</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-blue-300 transition">英単語バイト</h2>
                      <p className="text-gray-400 text-sm">初級50G〜上級400G・参加費無料</p>
                    </button>
                    <button onClick={() => setView('MINING')} className="group relative overflow-hidden bg-gradient-to-br from-amber-950 to-yellow-950 p-6 rounded-3xl shadow-2xl border border-amber-500/20 hover:border-amber-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-amber-500/10 group-hover:text-amber-400/20 transition-all duration-500"><Pickaxe size={110} /></div>
                      <span className="bg-amber-500/10 text-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Mining</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-amber-300 transition">マインスイーパー採掘</h2>
                      <p className="text-gray-400 text-sm">参加費あり・爆発で報酬没収！最大30,000G</p>
                    </button>
                  </div>
                </div>

                {/* サービス */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <button onClick={() => setView('BANK')} className="flex items-center justify-between p-5 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Landmark size={22} /></div>
                      <div className="text-left"><span className="font-bold text-white block">グランドバンク</span><span className="text-xs text-emerald-400">預金・借入・信用度</span></div>
                    </div>
                    <ChevronRight className="text-gray-500" size={20} />
                  </button>
                  <button onClick={() => setView('TRANSFER')} className="flex items-center justify-between p-5 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Send size={22} /></div>
                      <div className="text-left"><span className="font-bold text-white block">オンライン送金</span><span className="text-xs text-gray-400">他プレイヤーへ送金</span></div>
                    </div>
                    <ChevronRight className="text-gray-500" size={20} />
                  </button>
                  <button onClick={() => setView('INVEST')} className="flex items-center justify-between p-5 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-teal-800/50 transition transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400"><TrendingUp size={22} /></div>
                      <div className="text-left"><span className="font-bold text-white block">株式投資</span><span className="text-xs text-teal-400">プレイヤー株を売買</span></div>
                    </div>
                    <ChevronRight className="text-gray-500" size={20} />
                  </button>
                  <button onClick={() => setView('RANKING')} className="flex items-center justify-between p-5 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Trophy size={22} /></div>
                      <div className="text-left"><span className="font-bold text-white block">長者番付</span><span className="text-xs text-gray-400">トップ10ランキング</span></div>
                    </div>
                    <ChevronRight className="text-gray-500" size={20} />
                  </button>
                </div>

                <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800/80 flex justify-center items-center">
                  <div className="flex gap-8">
                    <div className="text-center">
                      <span className="text-xs text-gray-400 uppercase font-bold tracking-widest block mb-1">純資産</span>
                      <span className="text-2xl font-black font-mono text-yellow-500">{(balance + bankBalance - loanBalance).toLocaleString()} G</span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-400 uppercase font-bold tracking-widest block mb-1">信用度</span>
                      <span className={`text-2xl font-black font-mono ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右：ニュース + 送受金履歴 */}
              <div className="space-y-4">
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <Newspaper size={16} className="text-yellow-400" />
                    <span className="text-yellow-400 font-black text-sm tracking-widest">CASINO NEWS</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                    {newsItems.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-8">ニュースはまだありません</p>
                    ) : newsItems.map(item => (
                      <div key={item.id} className="flex gap-2 text-xs">
                        <span className="text-gray-600 shrink-0">{formatTime(item.createdAt)}</span>
                        <span className={newsTypeStyle[item.type] || 'text-gray-300'}>{item.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <History size={16} className="text-blue-400" />
                    <span className="text-blue-400 font-black text-sm tracking-widest">送受金履歴</span>
                  </div>
                  <div className="h-52 overflow-y-auto p-3 space-y-2">
                    {transferHistory.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-8">履歴はまだありません</p>
                    ) : transferHistory.slice(0, 20).map((h, i) => (
                      <div key={i} className={`flex justify-between items-center text-xs p-2 rounded-lg ${h.type === 'SENT' ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                        <div>
                          <span className={`font-bold ${h.type === 'SENT' ? 'text-red-400' : 'text-emerald-400'}`}>{h.type === 'SENT' ? `→ ${h.to}` : `← ${h.from}`}</span>
                          <span className="text-gray-600 ml-2">{formatTime(h.at)}</span>
                        </div>
                        <span className={`font-mono font-black ${h.type === 'SENT' ? 'text-red-400' : 'text-emerald-400'}`}>{h.type === 'SENT' ? '-' : '+'}{h.amount.toLocaleString()}G</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'SLOT' && <SlotMachine balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'ROULETTE' && <RouletteView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'BLACKJACK' && <BlackjackView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'LABOR' && <LaborView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} />}
        {view === 'MINING' && <MiningView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'JANKEN' && <JankenView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} db={db} appId={appId} />}
        {view === 'POKER' && <PokerView balance={balance} updateBalance={updateBalanceWithStock} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} db={db} appId={appId} />}
        {view === 'INVEST' && <InvestView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} db={db} appId={appId} />}

        {/* ===== BANK ===== */}
        {view === 'BANK' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><Landmark size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">GRAND BANK</h2>
                  <p className="text-sm text-emerald-400 font-semibold">預金: 30分 +0.1% ／ ローン: 15分 +0.3%（信用度-1）</p>
                </div>
              </div>
              <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-400">信用スコア</span>
                  <span className={`text-2xl font-black ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all" style={{width: `${Math.min(100, (creditScore / 200) * 100)}%`}}></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>借入上限: <span className="text-white font-bold">{Math.floor(creditScore * 1000).toLocaleString()} G</span></div>
                  <div>借入残高: <span className="text-red-400 font-bold">{loanBalance.toLocaleString()} G</span></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[['所持金', balance, 'text-yellow-500'], ['預金残高', bankBalance, 'text-emerald-400'], ['ローン残高', loanBalance, 'text-red-400']].map(([label, val, color]) => (
                  <div key={label} className="bg-gray-950 p-4 rounded-xl border border-gray-900 text-center">
                    <span className="text-xs text-gray-400 block mb-1 font-bold">{label}</span>
                    <span className={`text-lg font-mono font-black ${color}`}>{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <label className="block text-sm text-gray-400 font-bold mb-2">💰 預金・引出</label>
                <div className="relative mb-3">
                  <input type="number" value={bankInput} onChange={e => setBankInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-emerald-500" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button onClick={() => setBankInput(balance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition">所持金</button>
                    <button onClick={() => setBankInput(bankBalance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition text-emerald-400">預金</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleBankAction('DEPOSIT')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black transition active:scale-95">預け入れる</button>
                  <button onClick={() => handleBankAction('WITHDRAW')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-black border border-gray-700 transition active:scale-95">引き出す</button>
                </div>
              </div>
              <div className="border-t border-gray-800 pt-5">
                <label className="block text-sm text-gray-400 font-bold mb-2">🏦 借入・返済</label>
                <div className="relative mb-3">
                  <input type="number" value={loanInput} onChange={e => setLoanInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-red-500" />
                  <div className="absolute right-3 top-3">
                    <button onClick={() => setLoanInput(loanBalance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition text-red-400">全額返済</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLoan} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded-xl font-black transition active:scale-95">借入する（信用度-5）</button>
                  <button onClick={handleRepay} disabled={loanBalance <= 0} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-xl font-black transition active:scale-95 disabled:opacity-40">返済する（信用度+15）</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== TRANSFER ===== */}
        {view === 'TRANSFER' && (
          <div className="p-6 md:p-12 max-w-2xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-6">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400"><Send size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">ONLINE TRANSFER</h2>
                  <p className="text-sm text-gray-400">他のプレイヤーへ安全に送金します</p>
                </div>
              </div>
              <div className="bg-gray-950 p-4 rounded-xl border border-gray-900 mb-6 flex justify-between">
                <span className="text-sm text-gray-400 font-bold">所持金</span>
                <span className="text-xl font-mono font-black text-yellow-500">{balance.toLocaleString()} G</span>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">送金先プレイヤー名</label>
                  <input type="text" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} placeholder="相手の登録名"
                    className="w-full bg-gray-950 text-white font-bold p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">送金金額 (G)</label>
                  <div className="relative">
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="金額を入力"
                      className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-blue-500" />
                    <button onClick={() => setTransferAmount(balance.toString())} className="absolute right-3 top-3.5 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1.5 rounded font-bold transition">全額</button>
                  </div>
                </div>
              </div>
              <button onClick={handleTransfer} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black transition active:scale-95 text-lg flex items-center justify-center gap-2">
                <Send size={20} /> 安全に送金を実行する
              </button>
            </div>
          </div>
        )}

        {/* ===== RANKING ===== */}
        {view === 'RANKING' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-6">
                <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-400"><Trophy size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">LEADERBOARD</h2>
                  <p className="text-sm text-gray-400">純資産ランキング (所持金＋預金−ローン)</p>
                </div>
              </div>
              <div className="space-y-3">
                {rankingData.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">プレイヤーがまだ存在しません。</p>
                ) : rankingData.map((player, index) => {
                  const isSelf = player.name === playerName;
                  const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                  return (
                    <div key={player.name} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelf ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-950/60 border-gray-800 hover:bg-gray-900/60'}`}>
                      <div className="flex items-center gap-4">
                        <span className="w-8 text-center text-xl font-bold">{rankBadge}</span>
                        <div>
                          <span className={`font-bold text-lg block ${isSelf ? 'text-yellow-400' : 'text-white'}`}>
                            {player.name} {isSelf && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded ml-1 font-black">YOU</span>}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500 font-semibold">
                            <span>手元:{player.balance.toLocaleString()}G</span>
                            <span>銀行:{player.bankBalance.toLocaleString()}G</span>
                            {player.loanBalance > 0 && <span className="text-red-400">ローン:{player.loanBalance.toLocaleString()}G</span>}
                            <span className={getCreditColor(player.creditScore)}>{getCreditLabel(player.creditScore)}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xl font-black text-yellow-500">{player.total.toLocaleString()} G</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="py-6 border-t border-gray-900 text-center text-xs text-gray-600">
        © 2026 GRAND CASINO & TURF. All Rights Reserved.
      </footer>
    </div>
  );
}

// ==========================================
// Component: BlackjackView（ブラックジャック・ディーラー対戦）
// ==========================================
function BlackjackView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const SUITS_BJ = ['♠', '♥', '♦', '♣'];
  const RANKS_BJ = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const BET_OPTIONS = [100, 500, 1000, 5000, 10000];

  const [phase, setPhase] = useState('BETTING'); // BETTING -> PLAYER_TURN -> DEALER_TURN -> RESULT
  const [bet, setBet] = useState(500);
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [revealDealer, setRevealDealer] = useState(false);
  const [resultInfo, setResultInfo] = useState(null); // { outcome, payout, net, label }
  const [canDouble, setCanDouble] = useState(false);
  const [doubled, setDoubled] = useState(false);
  const [netStreak, setNetStreak] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const totalLossRef = useRef(0);

  const buildDeck = () => {
    const d = [];
    for (const suit of SUITS_BJ) for (const rank of RANKS_BJ) d.push({ suit, rank });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  };

  const cardValue = (rank) => {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank, 10);
  };

  const handTotal = (hand) => {
    let total = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  };

  const isBlackjack = (hand) => hand.length === 2 && handTotal(hand) === 21;
  const isBust = (hand) => handTotal(hand) > 21;
  const isSoft = (hand) => {
    const raw = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
    const aces = hand.filter(c => c.rank === 'A').length;
    return raw > 21 ? false : (aces > 0 && handTotal(hand) !== raw - (aces > 0 ? 0 : 0)) || (aces > 0 && raw <= 21 && raw !== handTotal(hand));
  };

  const dealCard = (currentDeck) => {
    const newDeck = [...currentDeck];
    const card = newDeck.pop();
    return { card, newDeck };
  };

  const startHand = async () => {
    if (bet <= 0 || bet > balance) { showToast('ベット額が不正です。残高を確認してください。', 'error'); return; }
    await updateBalance(-bet);
    let d = deck.length < 15 ? buildDeck() : [...deck];

    let pHand = [], dHand = [];
    let res;
    res = dealCard(d); pHand.push(res.card); d = res.newDeck;
    res = dealCard(d); dHand.push(res.card); d = res.newDeck;
    res = dealCard(d); pHand.push(res.card); d = res.newDeck;
    res = dealCard(d); dHand.push(res.card); d = res.newDeck;

    setDeck(d);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setRevealDealer(false);
    setResultInfo(null);
    setDoubled(false);
    setCanDouble(balance - bet >= bet);
    setHandCount(c => c + 1);

    const playerBJ = isBlackjack(pHand);
    const dealerBJ = isBlackjack(dHand);
    if (playerBJ || dealerBJ) {
      setPhase('DEALER_TURN');
      setTimeout(() => finishHand(pHand, dHand, d, bet, false), 700);
    } else {
      setPhase('PLAYER_TURN');
    }
  };

  const handleHit = () => {
    if (phase !== 'PLAYER_TURN') return;
    const { card, newDeck } = dealCard(deck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(newDeck);
    setCanDouble(false);
    if (isBust(newHand)) {
      setPhase('DEALER_TURN');
      setTimeout(() => finishHand(newHand, dealerHand, newDeck, doubled ? bet * 2 : bet, doubled), 500);
    } else if (handTotal(newHand) === 21) {
      handleStand(newHand, newDeck);
    }
  };

  const handleStand = (handOverride, deckOverride) => {
    if (phase !== 'PLAYER_TURN' && !handOverride) return;
    const pHand = handOverride || playerHand;
    const d = deckOverride || deck;
    setPhase('DEALER_TURN');
    setRevealDealer(true);
    setTimeout(() => playDealerTurn(pHand, d), 600);
  };

  const handleDouble = () => {
    if (!canDouble || phase !== 'PLAYER_TURN') return;
    setDoubled(true);
    setCanDouble(false);
    updateBalance(-bet);
    const { card, newDeck } = dealCard(deck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(newDeck);
    setPhase('DEALER_TURN');
    setRevealDealer(true);
    if (isBust(newHand)) {
      setTimeout(() => finishHand(newHand, dealerHand, newDeck, bet * 2, true), 700);
    } else {
      setTimeout(() => playDealerTurn(newHand, newDeck, true), 700);
    }
  };

  const playDealerTurn = (pHand, d, wasDoubled = false) => {
    let dHand = [...dealerHand];
    let currentDeck = [...d];
    const step = () => {
      if (isBust(pHand)) { finishHand(pHand, dHand, currentDeck, wasDoubled ? bet * 2 : bet, wasDoubled); return; }
      if (handTotal(dHand) < 17) {
        const { card, newDeck } = dealCard(currentDeck);
        dHand = [...dHand, card];
        currentDeck = newDeck;
        setDealerHand([...dHand]);
        setDeck([...currentDeck]);
        setTimeout(step, 600);
      } else {
        finishHand(pHand, dHand, currentDeck, wasDoubled ? bet * 2 : bet, wasDoubled);
      }
    };
    setTimeout(step, 400);
  };

  const finishHand = (pHand, dHand, finalDeck, totalBetUsed, wasDoubled) => {
    setRevealDealer(true);
    const pTotal = handTotal(pHand);
    const dTotal = handTotal(dHand);
    const pBJ = isBlackjack(pHand);
    const dBJ = isBlackjack(dHand);
    const pBust = isBust(pHand);
    const dBust = isBust(dHand);

    let outcome, payout, label;
    if (pBust) {
      outcome = 'LOSE'; payout = 0; label = 'バースト...';
    } else if (pBJ && dBJ) {
      outcome = 'PUSH'; payout = totalBetUsed; label = '両者ブラックジャック・プッシュ';
    } else if (pBJ) {
      outcome = 'BLACKJACK'; payout = Math.floor(totalBetUsed * 2.5); label = 'ブラックジャック！';
    } else if (dBJ) {
      outcome = 'LOSE'; payout = 0; label = 'ディーラーブラックジャック';
    } else if (dBust) {
      outcome = 'WIN'; payout = totalBetUsed * 2; label = 'ディーラーバースト！';
    } else if (pTotal > dTotal) {
      outcome = 'WIN'; payout = totalBetUsed * 2; label = '勝利！';
    } else if (pTotal < dTotal) {
      outcome = 'LOSE'; payout = 0; label = '敗北...';
    } else {
      outcome = 'PUSH'; payout = totalBetUsed; label = 'プッシュ（引き分け）';
    }

    const net = payout - totalBetUsed;
    if (payout > 0) updateBalance(payout);
    setTotalNet(t => t + net);
    setNetStreak(s => net > 0 ? Math.max(1, s + 1) : net < 0 ? Math.min(-1, s - 1) : 0);

    if (net > 0) {
      totalLossRef.current = 0;
      if (net >= 50000) emitNews(`🂡 ${playerName} がブラックジャックで大勝ち！ +${net.toLocaleString()} G！`, 'blackjack');
    } else if (net < 0) {
      totalLossRef.current += Math.abs(net);
      if (totalLossRef.current >= 100000) {
        emitNews(`💸 ${playerName} がブラックジャックで ${totalLossRef.current.toLocaleString()} G の大負けを記録...`, 'loss');
        totalLossRef.current = 0;
      }
    }

    setResultInfo({ outcome, payout, net, label, pTotal, dTotal });
    setPhase('RESULT');
  };

  const resetToBetting = () => {
    setPhase('BETTING');
    setPlayerHand([]);
    setDealerHand([]);
    setRevealDealer(false);
    setResultInfo(null);
    setDoubled(false);
  };

  const CardFace = ({ card, hidden = false }) => {
    if (hidden) return (
      <div className="w-16 h-24 md:w-20 md:h-28 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl border-2 border-blue-600 flex items-center justify-center shadow-xl">
        <span className="text-blue-400 text-2xl">🂠</span>
      </div>
    );
    const isRed = card.suit === '♥' || card.suit === '♦';
    return (
      <div className="w-16 h-24 md:w-20 md:h-28 bg-white rounded-xl border-2 border-gray-200 flex flex-col items-center justify-center shadow-xl">
        <span className={`font-black leading-none text-lg md:text-xl ${isRed ? 'text-red-500' : 'text-gray-900'}`}>{card.rank}</span>
        <span className={`leading-none text-2xl md:text-3xl ${isRed ? 'text-red-500' : 'text-gray-900'}`}>{card.suit}</span>
      </div>
    );
  };

  const dealerVisibleTotal = revealDealer ? handTotal(dealerHand) : (dealerHand.length > 0 ? cardValue(dealerHand[0].rank) : 0);
  const playerTotalNow = handTotal(playerHand);

  const resultColor = resultInfo
    ? resultInfo.outcome === 'BLACKJACK' ? 'border-yellow-500 bg-yellow-500/10'
    : resultInfo.outcome === 'WIN' ? 'border-emerald-500 bg-emerald-500/10'
    : resultInfo.outcome === 'PUSH' ? 'border-gray-600 bg-gray-800/40'
    : 'border-red-500 bg-red-500/10'
    : '';
  const resultTextColor = resultInfo
    ? resultInfo.outcome === 'BLACKJACK' ? 'text-yellow-400'
    : resultInfo.outcome === 'WIN' ? 'text-emerald-400'
    : resultInfo.outcome === 'PUSH' ? 'text-gray-300'
    : 'text-red-400'
    : '';

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">HANDS</div><div className="font-mono text-lime-400 font-bold">{handCount}</div></div>
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString()}</div></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-green-950/60 to-gray-950 rounded-[2rem] border-4 border-lime-900/40 shadow-2xl p-6 md:p-8">
        <div className="text-center mb-3">
          <span className="text-2xl">🂡</span>
          <h2 className="text-2xl font-black text-lime-300 tracking-widest">BLACKJACK</h2>
        </div>

        {/* ディーラー */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-gray-400 font-bold text-sm">DEALER</span>
            {dealerHand.length > 0 && (
              <span className="text-gray-300 font-mono font-bold text-sm">
                {revealDealer ? dealerVisibleTotal : `${dealerVisibleTotal} + ?`}
              </span>
            )}
          </div>
          <div className="flex gap-2 justify-center min-h-[7rem] items-center flex-wrap">
            {dealerHand.length === 0 ? (
              <p className="text-gray-600 text-sm">ベットしてゲームを開始してください</p>
            ) : dealerHand.map((c, i) => (
              <CardFace key={i} card={c} hidden={i === 1 && !revealDealer} />
            ))}
          </div>
        </div>

        {/* プレイヤー */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-blue-300 font-bold text-sm">YOU ({playerName})</span>
            {playerHand.length > 0 && (
              <span className={`font-mono font-bold text-sm ${playerTotalNow > 21 ? 'text-red-400' : 'text-white'}`}>{playerTotalNow}</span>
            )}
          </div>
          <div className="flex gap-2 justify-center min-h-[7rem] items-center flex-wrap">
            {playerHand.map((c, i) => <CardFace key={i} card={c} />)}
          </div>
        </div>
      </div>

      {/* ベッティング */}
      {phase === 'BETTING' && (
        <div className="mt-6 bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <label className="block text-sm text-gray-400 font-bold mb-3">ベット額を選択</label>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {BET_OPTIONS.map(v => (
              <button key={v} onClick={() => setBet(v)} disabled={v > balance}
                className={`py-2.5 rounded-xl font-black text-sm transition disabled:opacity-30 ${bet === v ? 'bg-lime-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                {v >= 1000 ? `${v / 1000}K` : v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} min={10} step={10}
              className="flex-1 bg-gray-950 text-white font-mono text-lg p-3 rounded-xl border border-gray-800 focus:outline-none focus:border-lime-500" />
            <span className="text-gray-500 text-sm">所持金: <span className="text-yellow-400 font-bold">{balance.toLocaleString()} G</span></span>
          </div>
          <button onClick={startHand} disabled={bet <= 0 || bet > balance}
            className="w-full bg-gradient-to-r from-lime-500 to-green-600 text-black font-black py-4 rounded-xl text-lg shadow-lg disabled:opacity-40 transition transform hover:scale-[1.02] active:scale-95">
            🂡 カードを配る（{bet.toLocaleString()} G）
          </button>
        </div>
      )}

      {/* アクションパネル */}
      {phase === 'PLAYER_TURN' && (
        <div className="mt-6 bg-gray-900 rounded-2xl border border-lime-500/30 p-5">
          <p className="text-center text-lime-400 font-black text-sm mb-4">どうしますか？</p>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={handleHit} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition active:scale-95">ヒット</button>
            <button onClick={() => handleStand()} className="bg-gray-700 hover:bg-gray-600 text-white font-black py-4 rounded-xl transition active:scale-95">スタンド</button>
            <button onClick={handleDouble} disabled={!canDouble} className="bg-orange-600 hover:bg-orange-500 disabled:opacity-30 text-white font-black py-4 rounded-xl transition active:scale-95">ダブル</button>
          </div>
        </div>
      )}

      {phase === 'DEALER_TURN' && (
        <div className="mt-6 bg-gray-900 rounded-2xl border border-gray-800 p-5 text-center">
          <p className="text-gray-400 font-bold flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin text-lime-400" /> ディーラーがプレイ中...</p>
        </div>
      )}

      {/* 結果 */}
      {phase === 'RESULT' && resultInfo && (
        <div className={`mt-6 rounded-2xl border-2 p-6 text-center ${resultColor}`}>
          <h3 className={`text-3xl font-black mb-2 ${resultTextColor}`}>{resultInfo.label}</h3>
          <p className="text-gray-400 text-sm mb-3">あなた: {resultInfo.pTotal} ／ ディーラー: {resultInfo.dTotal}</p>
          <div className={`text-4xl font-black mb-4 ${resultInfo.net > 0 ? 'text-emerald-400' : resultInfo.net < 0 ? 'text-red-400' : 'text-gray-300'}`}>
            {resultInfo.net > 0 ? '+' : ''}{resultInfo.net.toLocaleString()} G
          </div>
          <button onClick={resetToBetting} className="w-full bg-lime-600 hover:bg-lime-500 text-black font-black py-4 rounded-xl text-lg transition active:scale-95">
            もう一度ベットする
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: PokerView（テキサスホールデム）
// ==========================================
function PokerView({ balance, updateBalance, onBack, showToast, playerName, emitNews, db, appId }) {
  const SMALL_BLIND = 100;
  const BIG_BLIND = 200;
  const MIN_BUY_IN = 2000;
  const MAX_BUY_IN = 50000;
  const ACTION_TIMEOUT = 30;

  const [phase, setPhase] = useState('LOBBY');
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [createBuyIn, setCreateBuyIn] = useState(5000);
  const [joinBuyIn, setJoinBuyIn] = useState(5000);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [betInput, setBetInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(ACTION_TIMEOUT);
  const [showdown, setShowdown] = useState(null);
  const [lastAction, setLastAction] = useState('');
  const [winnerMsg, setWinnerMsg] = useState('');

  const timerRef = useRef(null);
  const roomUnsubRef = useRef(null);
  const chatUnsubRef = useRef(null);
  const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pokerRooms');

  // ─── ロビー：ルーム一覧 ───
  useEffect(() => {
    if (phase !== 'LOBBY') return;
    const q = query(roomsRef, orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list);
    });
    return () => unsub();
  }, [phase]);

  // ─── ルーム購読 ───
  useEffect(() => {
    if (!roomId) return;
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId);
    const unsub = onSnapshot(rRef, snap => {
      if (!snap.exists()) { handleLeave(); return; }
      setRoomData(snap.data());
    });
    roomUnsubRef.current = unsub;
    return () => unsub();
  }, [roomId]);

  // ─── チャット購読 ───
  useEffect(() => {
    if (!roomId) return;
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId, 'chat');
    const q = query(chatRef, orderBy('createdAt', 'asc'), limit(60));
    const unsub = onSnapshot(q, snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
    });
    chatUnsubRef.current = unsub;
    return () => unsub();
  }, [roomId]);

  // ─── アクションタイマー ───
  useEffect(() => {
    if (!roomData || roomData.status !== 'PLAYING') return;
    const myIdx = roomData.seats.findIndex(s => s && s.name === playerName);
    if (myIdx < 0) return;
    if (roomData.currentTurn !== myIdx) { setTimeLeft(ACTION_TIMEOUT); return; }
    clearInterval(timerRef.current);
    setTimeLeft(ACTION_TIMEOUT);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleFold();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [roomData?.currentTurn, roomData?.status]);

  // ─── ショーダウン検出 ───
  useEffect(() => {
    if (roomData?.status === 'SHOWDOWN') {
      setShowdown(roomData.showdownResult || null);
    } else {
      setShowdown(null);
    }
  }, [roomData?.status]);

  // ─── ルーム作成 ───
  const handleCreateRoom = async () => {
    if (createBuyIn < MIN_BUY_IN || createBuyIn > MAX_BUY_IN) {
      showToast(`バイイン額は ${MIN_BUY_IN.toLocaleString()}〜${MAX_BUY_IN.toLocaleString()} Gで設定してください`, 'error'); return;
    }
    if (balance < createBuyIn) { showToast('残高が足りません！', 'error'); return; }
    try {
      await updateBalance(-createBuyIn);
      const rRef = doc(roomsRef);
      const seat0 = { name: playerName, chips: createBuyIn, holeCards: [], bet: 0, status: 'ACTIVE', isAllIn: false };
      const seats = [seat0, null, null, null, null, null];
      await setDoc(rRef, {
        host: playerName, seats, status: 'WAITING',
        pot: 0, communityCards: [], deck: [],
        currentTurn: -1, dealerIdx: 0,
        street: 'PREFLOP', currentBet: 0, lastRaiser: -1,
        minBuyIn: MIN_BUY_IN, maxBuyIn: MAX_BUY_IN,
        smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND,
        createdAt: Date.now(), showdownResult: null,
        actionLog: [],
      });
      setRoomId(rRef.id);
      setPhase('ROOM');
      showToast('ルームを作成しました！', 'success');
    } catch(e) { showToast('作成エラー', 'error'); }
  };

  // ─── ルーム参加 ───
  const handleJoinRoom = async (room) => {
    if (room.seats.filter(Boolean).length >= 6) { showToast('満席です', 'error'); return; }
    if (room.seats.some(s => s && s.name === playerName)) { showToast('すでに参加中です', 'error'); return; }
    if (joinBuyIn < room.minBuyIn || joinBuyIn > room.maxBuyIn) {
      showToast(`バイイン額は ${room.minBuyIn.toLocaleString()}〜${room.maxBuyIn.toLocaleString()} Gです`, 'error'); return;
    }
    if (balance < joinBuyIn) { showToast('残高が足りません！', 'error'); return; }
    try {
      await updateBalance(-joinBuyIn);
      const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', room.id);
      const snap = await getDoc(rRef);
      const data = snap.data();
      const newSeats = [...data.seats];
      const emptyIdx = newSeats.findIndex(s => s === null);
      if (emptyIdx < 0) { showToast('満席になりました', 'error'); await updateBalance(joinBuyIn); return; }
      newSeats[emptyIdx] = { name: playerName, chips: joinBuyIn, holeCards: [], bet: 0, status: 'ACTIVE', isAllIn: false };
      await updateDoc(rRef, { seats: newSeats });
      setRoomId(room.id);
      setPhase('ROOM');
      showToast('ルームに参加しました！', 'success');
    } catch(e) { showToast('参加エラー', 'error'); }
  };

  // ─── ゲーム開始（ホストのみ） ───
  const handleStartGame = async () => {
    if (!roomData) return;
    const activePlayers = roomData.seats.filter(Boolean);
    if (activePlayers.length < 2) { showToast('2人以上必要です', 'error'); return; }
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId);
    await startNewRound(rRef, roomData.seats, 0);
  };

  const startNewRound = async (rRef, seats, dealerIdx) => {
    const deck = createDeck();
    const activePlayers = seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
    if (activePlayers.length < 2) {
      await updateDoc(rRef, { status: 'WAITING' });
      return;
    }
    const newSeats = seats.map(s => s ? { ...s, holeCards: [], bet: 0, status: 'ACTIVE', isAllIn: false } : null);

    // 有効プレイヤーのみでディーラー・ブラインド決定
    const ap = activePlayers;
    const dealerSeat = ap[dealerIdx % ap.length];
    const sbSeat = ap[(dealerIdx + 1) % ap.length];
    const bbSeat = ap[(dealerIdx + 2) % ap.length];

    // ホールカード配布
    for (let i = 0; i < 2; i++) {
      for (const idx of ap) {
        if (newSeats[idx]) newSeats[idx].holeCards.push(deck.pop());
      }
    }

    // スモールブラインド
    const sbChips = Math.min(SMALL_BLIND, newSeats[sbSeat].chips);
    newSeats[sbSeat].chips -= sbChips;
    newSeats[sbSeat].bet = sbChips;

    // ビッグブラインド
    const bbChips = Math.min(BIG_BLIND, newSeats[bbSeat].chips);
    newSeats[bbSeat].chips -= bbChips;
    newSeats[bbSeat].bet = bbChips;

    const pot = sbChips + bbChips;
    const firstTurnIdx = ap[(dealerIdx + 3) % ap.length];

    await updateDoc(rRef, {
      seats: newSeats, deck: deck.map(c => ({ suit: c.suit, rank: c.rank })),
      status: 'PLAYING', pot, communityCards: [],
      currentTurn: firstTurnIdx, dealerIdx: dealerIdx % ap.length,
      dealerSeat, sbSeat, bbSeat,
      street: 'PREFLOP', currentBet: BIG_BLIND, lastRaiser: bbSeat,
      showdownResult: null, actionLog: [`SB: ${newSeats[sbSeat].name} +${sbChips}G`, `BB: ${newSeats[bbSeat].name} +${bbChips}G`],
    });
  };

  // ─── 自分のシート番号 ───
  const myIdx = roomData ? roomData.seats.findIndex(s => s && s.name === playerName) : -1;
  const mySeat = myIdx >= 0 ? roomData.seats[myIdx] : null;
  const isMyTurn = roomData && roomData.currentTurn === myIdx && roomData.status === 'PLAYING';

  // ─── コール金額 ───
  const callAmount = roomData && mySeat ? Math.max(0, roomData.currentBet - (mySeat.bet || 0)) : 0;

  // ─── アクション実行 ───
  const executeAction = async (actionType, amount = 0) => {
    if (!isMyTurn || !roomData) return;
    clearInterval(timerRef.current);
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId);
    const snap = await getDoc(rRef);
    const data = snap.data();
    const newSeats = data.seats.map(s => s ? { ...s } : null);
    const me = newSeats[myIdx];
    let newPot = data.pot;
    let newCurrentBet = data.currentBet;
    let newLastRaiser = data.lastRaiser;
    const log = [...(data.actionLog || [])];

    if (actionType === 'FOLD') {
      me.status = 'FOLDED';
      log.push(`${me.name}: フォールド`);
    } else if (actionType === 'CHECK') {
      log.push(`${me.name}: チェック`);
    } else if (actionType === 'CALL') {
      const actual = Math.min(callAmount, me.chips);
      me.chips -= actual; me.bet += actual; newPot += actual;
      if (me.chips === 0) me.isAllIn = true;
      log.push(`${me.name}: コール ${actual.toLocaleString()}G`);
    } else if (actionType === 'RAISE' || actionType === 'BET') {
      const raiseTotal = Math.min(amount, me.chips + me.bet);
      const addBet = raiseTotal - me.bet;
      me.chips -= addBet; me.bet = raiseTotal; newPot += addBet;
      newCurrentBet = raiseTotal;
      newLastRaiser = myIdx;
      if (me.chips === 0) me.isAllIn = true;
      log.push(`${me.name}: ${actionType === 'RAISE' ? 'レイズ' : 'ベット'} ${raiseTotal.toLocaleString()}G`);
    } else if (actionType === 'ALLIN') {
      const allInBet = me.bet + me.chips;
      newPot += me.chips; me.bet = allInBet; me.chips = 0; me.isAllIn = true;
      if (allInBet > newCurrentBet) { newCurrentBet = allInBet; newLastRaiser = myIdx; }
      log.push(`${me.name}: オールイン ${allInBet.toLocaleString()}G`);
    }

    newSeats[myIdx] = me;

    // 次のプレイヤーを決定
    const ap = newSeats.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const activePlayers = ap.filter(i => newSeats[i].status === 'ACTIVE' || newSeats[i].isAllIn);
    const foldedOrOut = ap.filter(i => newSeats[i].status === 'FOLDED');

    // 1人だけ残ったら即ウィン
    const stillIn = ap.filter(i => newSeats[i].status !== 'FOLDED');
    if (stillIn.length === 1) {
      const winnerIdx = stillIn[0];
      const winner = newSeats[winnerIdx];
      winner.chips += newPot;
      const wMsg = `🏆 ${winner.name} がウィン！ +${newPot.toLocaleString()} G`;
      log.push(wMsg);
      await updateDoc(rRef, { seats: newSeats, pot: 0, status: 'WAITING', currentTurn: -1, actionLog: log });
      await updateBalance(newPot);
      setWinnerMsg(wMsg);
      emitNews(`🃏 ポーカー: ${winner.name} が ${newPot.toLocaleString()} G のポットを獲得！`, 'poker');
      setTimeout(() => setWinnerMsg(''), 5000);
      return;
    }

    // 次のターンを決定
    const nextTurn = getNextTurn(ap, myIdx, newSeats, newCurrentBet, newLastRaiser, data.street);
    if (nextTurn === -1) {
      // ストリートを進める
      await advanceStreet(rRef, { ...data, seats: newSeats, pot: newPot, currentBet: newCurrentBet, lastRaiser: newLastRaiser, actionLog: log });
    } else {
      await updateDoc(rRef, { seats: newSeats, pot: newPot, currentBet: newCurrentBet, lastRaiser: newLastRaiser, currentTurn: nextTurn, actionLog: log });
    }
    setLastAction(actionType);
    setBetInput('');
  };

  const getNextTurn = (ap, currentIdx, seats, currentBet, lastRaiser, street) => {
    const order = [...ap];
    const myPos = order.indexOf(currentIdx);
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(myPos + i) % order.length];
      const seat = seats[candidate];
      if (!seat || seat.status === 'FOLDED' || seat.isAllIn) continue;
      if (candidate === lastRaiser) return -1; // ラウンド終了
      if (seat.bet < currentBet) return candidate; // まだコールしていない
      return candidate;
    }
    return -1;
  };

  const advanceStreet = async (rRef, data) => {
    const newSeats = data.seats.map(s => s ? { ...s, bet: 0 } : null);
    const ap = newSeats.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const stillIn = ap.filter(i => newSeats[i].status !== 'FOLDED');

    const snap = await getDoc(rRef);
    const freshData = snap.data();
    const deck = freshData.deck || [];
    const communityCards = [...(freshData.communityCards || [])];
    const log = [...(data.actionLog || [])];
    let newStreet = data.street;
    let newCommunity = [...communityCards];
    let newDeck = [...deck];
    let allInCount = ap.filter(i => newSeats[i].isAllIn).length;
    let activeCount = ap.filter(i => newSeats[i].status === 'ACTIVE' && !newSeats[i].isAllIn).length;

    if (data.street === 'PREFLOP') {
      newCommunity.push(...newDeck.splice(0, 3));
      newStreet = 'FLOP';
      log.push('--- FLOP ---');
    } else if (data.street === 'FLOP') {
      newCommunity.push(newDeck.splice(0, 1)[0]);
      newStreet = 'TURN';
      log.push('--- TURN ---');
    } else if (data.street === 'TURN') {
      newCommunity.push(newDeck.splice(0, 1)[0]);
      newStreet = 'RIVER';
      log.push('--- RIVER ---');
    } else if (data.street === 'RIVER') {
      // ショーダウン
      await doShowdown(rRef, { ...data, seats: newSeats, deck: newDeck, communityCards: newCommunity, actionLog: log });
      return;
    }

    // 全員がオールインなら全ボードを自動めくり
    if (activeCount <= 1 && newStreet !== 'SHOWDOWN') {
      while (newCommunity.length < 5 && newDeck.length >= 1) {
        if (newCommunity.length === 3) { newCommunity.push(...newDeck.splice(0, 1)); log.push('--- TURN ---'); }
        else if (newCommunity.length === 4) { newCommunity.push(...newDeck.splice(0, 1)); log.push('--- RIVER ---'); }
      }
      if (newCommunity.length >= 5) {
        await doShowdown(rRef, { ...data, seats: newSeats, deck: newDeck, communityCards: newCommunity, actionLog: log });
        return;
      }
    }

    const firstAction = ap.find(i => newSeats[i].status === 'ACTIVE' && !newSeats[i].isAllIn) ?? -1;
    await updateDoc(rRef, {
      seats: newSeats, deck: newDeck, communityCards: newCommunity,
      street: newStreet, currentBet: 0, lastRaiser: firstAction,
      currentTurn: firstAction, actionLog: log,
    });
  };

  const doShowdown = async (rRef, data) => {
    const ap = data.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
    const stillIn = ap.filter(i => data.seats[i].status !== 'FOLDED');
    const communityCards = data.communityCards || [];
    const log = [...(data.actionLog || [])];
    log.push('--- SHOWDOWN ---');

    const results = stillIn.map(idx => {
      const seat = data.seats[idx];
      const hand = evaluateHand(seat.holeCards, communityCards);
      log.push(`${seat.name}: ${hand.name}`);
      return { idx, seat, hand };
    });

    results.sort((a, b) => {
      if (b.hand.rank !== a.hand.rank) return b.hand.rank - a.hand.rank;
      return compareKickers(b.hand.tiebreak, a.hand.tiebreak);
    });

    const newSeats = data.seats.map(s => s ? { ...s } : null);
    let pot = data.pot;
    const winners = [results[0]];
    // タイ判定
    for (let i = 1; i < results.length; i++) {
      if (results[i].hand.rank === results[0].hand.rank &&
          compareKickers(results[i].hand.tiebreak, results[0].hand.tiebreak) === 0) {
        winners.push(results[i]);
      }
    }

    const share = Math.floor(pot / winners.length);
    let myGain = 0;
    for (const w of winners) {
      newSeats[w.idx].chips += share;
      if (w.seat.name === playerName) myGain += share;
      log.push(`🏆 ${w.seat.name} (${w.hand.name}) +${share.toLocaleString()}G`);
    }
    if (myGain > 0) await updateBalance(myGain);

    const showdownResult = {
      results: results.map(r => ({ name: r.seat.name, handName: r.hand.name, holeCards: r.seat.holeCards, rank: r.hand.rank })),
      winners: winners.map(w => w.seat.name), pot
    };

    const winMsg = `🃏 ポーカーショーダウン: ${winners.map(w => w.seat.name).join('&')} が ${pot.toLocaleString()} G獲得 (${results[0].hand.name})`;
    emitNews(winMsg, 'poker');

    await updateDoc(rRef, {
      seats: newSeats, pot: 0, status: 'SHOWDOWN',
      showdownResult, actionLog: log, communityCards: data.communityCards,
    });

    setTimeout(async () => {
      const freshSnap = await getDoc(rRef);
      const freshData = freshSnap.data();
      const remainingSeats = freshData.seats.map(s => (s && s.chips > 0) ? s : null);
      const activeCt = remainingSeats.filter(Boolean).length;
      if (activeCt >= 2) {
        const newDealerIdx = ((freshData.dealerIdx || 0) + 1);
        await startNewRound(rRef, remainingSeats, newDealerIdx);
      } else {
        await updateDoc(rRef, { seats: remainingSeats, status: 'WAITING' });
      }
    }, 5000);
  };

  const handleFold = () => executeAction('FOLD');
  const handleCheck = () => executeAction('CHECK');
  const handleCall = () => executeAction('CALL');
  const handleBet = () => {
    const amt = parseInt(betInput);
    if (isNaN(amt) || amt <= 0) { showToast('ベット額を入力してください', 'error'); return; }
    const type = roomData.currentBet > (mySeat?.bet || 0) ? 'RAISE' : 'BET';
    executeAction(type, amt);
  };
  const handleAllIn = () => executeAction('ALLIN');

  // ─── 返金してルームを出る ───
  const handleLeave = async () => {
    clearInterval(timerRef.current);
    if (roomUnsubRef.current) roomUnsubRef.current();
    if (chatUnsubRef.current) chatUnsubRef.current();

    if (roomId && roomData && myIdx >= 0 && mySeat) {
      try {
        const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId);
        const snap = await getDoc(rRef);
        if (snap.exists()) {
          const data = snap.data();
          const newSeats = data.seats.map(s => s ? { ...s } : null);
          const myChips = newSeats[myIdx]?.chips || 0;
          if (myChips > 0) await updateBalance(myChips);
          newSeats[myIdx] = null;
          const remaining = newSeats.filter(Boolean).length;
          if (remaining === 0) {
            await deleteDoc(rRef);
          } else {
            await updateDoc(rRef, { seats: newSeats, status: remaining < 2 ? 'WAITING' : data.status });
          }
        }
      } catch(e) { console.error(e); }
    }
    setRoomId(null); setRoomData(null); setPhase('LOBBY');
    setChatMessages([]); setShowdown(null); setWinnerMsg('');
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !roomId) return;
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'pokerRooms', roomId, 'chat');
    await addDoc(chatRef, { sender: playerName, message: chatInput.trim(), createdAt: Date.now() });
    setChatInput('');
  };

  // ─── カード表示ヘルパー ───
  const CardDisplay = ({ card, hidden = false, small = false }) => {
    if (!card) return null;
    const isRed = card.suit === '♥' || card.suit === '♦';
    const size = small ? 'w-8 h-12 text-xs' : 'w-11 h-16 text-sm';
    if (hidden) return (
      <div className={`${size} bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 flex items-center justify-center shadow-lg`}>
        <span className="text-blue-400 text-lg">🂠</span>
      </div>
    );
    return (
      <div className={`${size} bg-white rounded-lg border-2 border-gray-200 flex flex-col items-center justify-center shadow-lg`}>
        <span className={`font-black leading-none ${isRed ? 'text-red-500' : 'text-gray-900'} ${small ? 'text-xs' : 'text-sm'}`}>{card.rank}</span>
        <span className={`leading-none ${isRed ? 'text-red-500' : 'text-gray-900'} ${small ? 'text-base' : 'text-xl'}`}>{card.suit}</span>
      </div>
    );
  };

  const formatChatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const streetLabel = { PREFLOP: 'プリフロップ', FLOP: 'フロップ', TURN: 'ターン', RIVER: 'リバー', SHOWDOWN: 'ショーダウン' };

  // ─── ロビー ───
  if (phase === 'LOBBY') return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
      <div className="text-center mb-8">
        <h2 className="text-4xl font-black text-white mb-2 flex items-center justify-center gap-3">🃏 テキサスホールデム 🃏</h2>
        <p className="text-gray-400">オンライン2〜6人対戦 · ブラインド SB:{SMALL_BLIND.toLocaleString()} / BB:{BIG_BLIND.toLocaleString()} G</p>
      </div>

      {/* ルール説明 */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 mb-6 text-xs text-gray-300">
        <p className="text-green-400 font-black text-sm mb-2">🃏 ゲームの流れ</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <p>・プレフロップ → フロップ → ターン → リバー</p>
          <p>・コミュニティ5枚＋ホール2枚で最強5枚を作る</p>
          <p>・各ストリートでフォールド / コール / レイズ可能</p>
          <p>・バイインしたチップが増減します。退室時に返金</p>
          <p>・30秒以内に行動しないと自動フォールド</p>
          <p>・SB:{SMALL_BLIND}G / BB:{BIG_BLIND}G の強制ベット</p>
        </div>
      </div>

      {/* ルーム作成 */}
      <div className="bg-gradient-to-br from-green-950 to-emerald-950 border border-green-500/30 rounded-3xl p-6 mb-6 shadow-2xl">
        <h3 className="text-lg font-black text-white mb-4">🆕 新しいルームを作る</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400 font-bold block mb-1">バイイン額 (G)</label>
            <input type="number" value={createBuyIn} onChange={e => setCreateBuyIn(Number(e.target.value))}
              className="w-full bg-gray-950 text-white font-mono text-xl p-3 rounded-xl border border-gray-800 focus:outline-none focus:border-green-500"
              min={MIN_BUY_IN} max={MAX_BUY_IN} step={1000} />
            <p className="text-gray-600 text-xs mt-1">{MIN_BUY_IN.toLocaleString()} 〜 {MAX_BUY_IN.toLocaleString()} G</p>
          </div>
          <div className="text-gray-500 text-sm">
            <div>所持金: <span className="text-yellow-400 font-bold">{balance.toLocaleString()} G</span></div>
          </div>
          <button onClick={handleCreateRoom} disabled={balance < createBuyIn}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-3 px-6 rounded-xl transition disabled:opacity-40 active:scale-95">
            作成
          </button>
        </div>
      </div>

      {/* ルーム一覧 */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <span className="text-green-400 font-black text-sm tracking-widest">🔍 参加可能なルーム</span>
          <span className="ml-auto text-xs text-gray-500">{rooms.filter(r => r.status === 'WAITING' && r.seats.filter(Boolean).length < 6).length} 件</span>
        </div>
        <div className="p-3 space-y-2 min-h-[80px]">
          {rooms.filter(r => r.status === 'WAITING' && r.host !== playerName && r.seats.filter(Boolean).length < 6).length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">参加できるルームがありません</p>
          ) : rooms.filter(r => r.status === 'WAITING' && r.host !== playerName && r.seats.filter(Boolean).length < 6).map(room => (
            <div key={room.id} className="bg-gray-950 p-4 rounded-xl border border-gray-800 hover:border-green-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-white font-bold">{room.host}</span>
                  <span className="text-gray-500 text-xs ml-2">のルーム</span>
                  <span className="text-gray-500 text-xs ml-2">({room.seats.filter(Boolean).length}/6人)</span>
                </div>
                <span className="text-green-400 text-xs font-bold">{streetLabel[room.street] || 'WAITING'}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">バイイン額</label>
                  <input type="number" value={joinBuyIn} onChange={e => setJoinBuyIn(Number(e.target.value))}
                    className="w-full bg-gray-900 text-white font-mono p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
                    min={room.minBuyIn} max={room.maxBuyIn} step={500} />
                </div>
                <span className="text-gray-600 text-xs">{room.minBuyIn?.toLocaleString()}〜{room.maxBuyIn?.toLocaleString()} G</span>
                <button onClick={() => handleJoinRoom(room)} disabled={balance < joinBuyIn}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-black px-5 py-2.5 rounded-xl transition active:scale-95">
                  参加
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── ゲーム画面 ───
  if (!roomData) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-green-400" size={40} />
    </div>
  );

  const isHost = roomData.host === playerName;
  const activePlayers = roomData.seats.filter(Boolean);
  const allHandNames = ['ハイカード','ワンペア','ツーペア','スリーカード','ストレート','フラッシュ','フルハウス','フォーカード','ストレートフラッシュ','ロイヤルフラッシュ'];

  // 自分のハンド強度を表示
  const myHandInfo = mySeat && mySeat.holeCards?.length === 2 && roomData.communityCards?.length >= 3
    ? evaluateHand(mySeat.holeCards, roomData.communityCards)
    : null;

  return (
    <div className="p-3 md:p-5 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={handleLeave} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
          <ArrowLeft size={18} /> {isHost ? '解散して退室' : '退室 (チップ返金)'}
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black px-3 py-1 rounded-full ${
            roomData.status === 'PLAYING' ? 'bg-green-600/20 text-green-400 border border-green-500/40' :
            roomData.status === 'SHOWDOWN' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40' :
            'bg-gray-700/20 text-gray-400 border border-gray-700'}`}>
            {roomData.status === 'PLAYING' ? streetLabel[roomData.street] || 'PLAYING' :
             roomData.status === 'SHOWDOWN' ? 'SHOWDOWN' : '待機中'}
          </span>
          {mySeat && <div className="bg-gray-900/95 px-4 py-2 rounded-full border border-gray-800 font-mono text-lg text-yellow-500 font-bold">
            {mySeat.chips.toLocaleString()} チップ
          </div>}
        </div>
      </div>

      {/* ウィナーメッセージ */}
      {winnerMsg && (
        <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-2xl p-4 mb-4 text-center font-black text-yellow-400 text-xl animate-bounce">
          {winnerMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ポーカーテーブル */}
        <div className="lg:col-span-2 space-y-4">
          {/* ポットとコミュニティカード */}
          <div className="bg-gradient-to-b from-green-900/40 to-green-950/40 rounded-3xl border border-green-700/30 p-5 shadow-2xl">
            <div className="text-center mb-4">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">ポット</span>
              <div className="text-4xl font-black text-yellow-400 font-mono">{roomData.pot.toLocaleString()} G</div>
            </div>

            {/* コミュニティカード */}
            <div className="flex justify-center gap-2 mb-4">
              {[0,1,2,3,4].map(i => (
                <div key={i}>
                  {roomData.communityCards?.[i] ? (
                    <CardDisplay card={roomData.communityCards[i]} />
                  ) : (
                    <div className="w-11 h-16 bg-green-900/20 rounded-lg border-2 border-dashed border-green-800/30"></div>
                  )}
                </div>
              ))}
            </div>

            {/* 自分のハンド評価 */}
            {myHandInfo && (
              <div className="text-center">
                <span className="text-xs bg-green-600/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full font-bold">
                  現在の手: {myHandInfo.name}
                </span>
              </div>
            )}
          </div>

          {/* シート一覧 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {roomData.seats.map((seat, idx) => {
              if (!seat) return (
                <div key={idx} className="bg-gray-900/30 rounded-2xl border border-dashed border-gray-800 p-3 text-center min-h-[100px] flex items-center justify-center">
                  <span className="text-gray-700 text-xs">空席</span>
                </div>
              );
              const isMe = seat.name === playerName;
              const isDealer = idx === roomData.dealerSeat;
              const isSB = idx === roomData.sbSeat;
              const isBB = idx === roomData.bbSeat;
              const isCurrentTurn = idx === roomData.currentTurn && roomData.status === 'PLAYING';
              const isFolded = seat.status === 'FOLDED';
              return (
                <div key={idx} className={`rounded-2xl border p-3 transition-all ${
                  isFolded ? 'bg-gray-900/20 border-gray-800 opacity-50' :
                  isCurrentTurn ? 'bg-yellow-500/10 border-yellow-500/60 shadow-lg shadow-yellow-500/10' :
                  isMe ? 'bg-blue-900/20 border-blue-500/30' :
                  'bg-gray-900 border-gray-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${isFolded ? 'bg-gray-600' : isCurrentTurn ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                      <span className={`font-bold text-sm truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>{seat.name}</span>
                      {isMe && <span className="text-xs bg-blue-500/20 text-blue-400 px-1 rounded">YOU</span>}
                    </div>
                    <div className="flex gap-1">
                      {isDealer && <span className="text-xs bg-white text-black px-1.5 py-0.5 rounded font-black">D</span>}
                      {isSB && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-black">SB</span>}
                      {isBB && <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-black">BB</span>}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-yellow-400 mb-2">{seat.chips.toLocaleString()} G</div>
                  {seat.bet > 0 && <div className="text-xs text-gray-400">ベット: <span className="text-white font-bold">{seat.bet.toLocaleString()}G</span></div>}
                  {seat.isAllIn && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-black">ALLIN</span>}
                  {isFolded && <span className="text-xs text-gray-600 font-bold">FOLDED</span>}
                  {/* ホールカード表示 */}
                  {seat.holeCards?.length === 2 && (
                    <div className="flex gap-1 mt-2">
                      {isMe ? (
                        seat.holeCards.map((c, ci) => <CardDisplay key={ci} card={c} small />)
                      ) : (
                        roomData.status === 'SHOWDOWN' && seat.status !== 'FOLDED' ? (
                          seat.holeCards.map((c, ci) => <CardDisplay key={ci} card={c} small />)
                        ) : (
                          <>
                            <CardDisplay card={null} hidden small />
                            <CardDisplay card={null} hidden small />
                          </>
                        )
                      )}
                    </div>
                  )}
                  {isCurrentTurn && (
                    <div className={`text-xs font-black mt-1 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                      {isMe ? `⏱ ${timeLeft}秒` : '考え中...'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* アクションパネル */}
          {roomData.status === 'WAITING' && isHost && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 text-center">
              <p className="text-gray-400 mb-3">{activePlayers.length >= 2 ? 'ゲームを開始できます' : 'あと' + (2 - activePlayers.length) + '人の参加を待っています'}</p>
              <button onClick={handleStartGame} disabled={activePlayers.length < 2}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-black py-3 px-10 rounded-xl transition active:scale-95 text-lg">
                🃏 ゲームスタート！
              </button>
            </div>
          )}

          {roomData.status === 'WAITING' && !isHost && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 text-center">
              <p className="text-gray-500">ホストのゲーム開始を待っています...</p>
            </div>
          )}

          {isMyTurn && roomData.status === 'PLAYING' && (
            <div className="bg-gray-900 rounded-2xl border border-green-500/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-400 font-black text-sm">あなたのターン</span>
                <span className={`text-lg font-black font-mono ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>⏱ {timeLeft}秒</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                <div className={`h-2 rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-green-400'}`}
                  style={{ width: `${(timeLeft / ACTION_TIMEOUT) * 100}%` }}></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {callAmount === 0 ? (
                  <button onClick={handleCheck} className="bg-gray-700 hover:bg-gray-600 text-white font-black py-2.5 rounded-xl transition active:scale-95">チェック</button>
                ) : (
                  <button onClick={handleCall} className="bg-blue-700 hover:bg-blue-600 text-white font-black py-2.5 rounded-xl transition active:scale-95">
                    コール<br/><span className="text-xs font-normal">{callAmount.toLocaleString()}G</span>
                  </button>
                )}
                <button onClick={handleFold} className="bg-gray-800 hover:bg-gray-700 text-red-400 font-black py-2.5 rounded-xl border border-red-500/20 transition active:scale-95">フォールド</button>
                <button onClick={handleAllIn} className="bg-red-700 hover:bg-red-600 text-white font-black py-2.5 rounded-xl transition active:scale-95">
                  オールイン<br/><span className="text-xs font-normal">{mySeat?.chips.toLocaleString()}G</span>
                </button>
                <button onClick={handleBet} disabled={!betInput || parseInt(betInput) <= 0}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black font-black py-2.5 rounded-xl transition active:scale-95">
                  {roomData.currentBet > (mySeat?.bet || 0) ? 'レイズ' : 'ベット'}
                </button>
              </div>
              <div className="flex gap-2">
                <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
                  placeholder={roomData.currentBet > 0 ? `最小 ${(roomData.currentBet * 2).toLocaleString()}G` : `最小 ${BIG_BLIND.toLocaleString()}G`}
                  className="flex-1 bg-gray-950 text-white font-mono p-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-yellow-500" />
                <div className="flex gap-1">
                  {[0.25, 0.5, 0.75, 1].map(frac => (
                    <button key={frac} onClick={() => setBetInput(Math.floor(roomData.pot * frac).toString())}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs px-2 py-1 rounded-lg transition">
                      {frac * 100}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ショーダウン結果 */}
          {roomData.status === 'SHOWDOWN' && showdown && (
            <div className="bg-yellow-500/10 border-2 border-yellow-500/60 rounded-2xl p-5">
              <h3 className="text-xl font-black text-yellow-400 mb-3 text-center">🏆 ショーダウン</h3>
              <div className="space-y-2">
                {showdown.results.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl ${showdown.winners.includes(r.name) ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-900'}`}>
                    <div className="flex items-center gap-2">
                      {showdown.winners.includes(r.name) && <span className="text-yellow-400">🏆</span>}
                      <span className="font-bold text-white">{r.name}</span>
                      <span className="text-green-400 text-sm font-bold">{r.handName}</span>
                    </div>
                    <div className="flex gap-1">
                      {(r.holeCards || []).map((c, ci) => <CardDisplay key={ci} card={c} small />)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center mt-3 text-sm text-gray-400">
                次のゲームを自動で開始します...
              </div>
            </div>
          )}

          {/* アクションログ */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">アクションログ</p>
            {(roomData.actionLog || []).slice(-8).map((log, i) => (
              <p key={i} className={`text-xs ${log.includes('🏆') ? 'text-yellow-400 font-bold' : log.startsWith('---') ? 'text-gray-500 font-bold' : 'text-gray-400'}`}>{log}</p>
            ))}
          </div>
        </div>

        {/* チャット */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
            <span className="text-green-400 font-black text-sm tracking-widest">💬 ルームチャット</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">チャットを始めましょう！</p>
            ) : chatMessages.map(msg => (
              <div key={msg.id} className={`text-xs ${msg.sender === playerName ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-[90%] px-3 py-2 rounded-2xl ${msg.sender === playerName ? 'bg-green-600/80 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'}`}>
                  {msg.sender !== playerName && <div className="text-green-400 font-bold text-xs mb-0.5">{msg.sender}</div>}
                  <div>{msg.message}</div>
                  <div className="text-xs opacity-50 mt-0.5">{formatChatTime(msg.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="メッセージを入力..." maxLength={100}
              className="flex-1 bg-gray-950 text-white text-sm p-2 rounded-lg border border-gray-800 focus:outline-none focus:border-green-500" />
            <button onClick={sendChat} className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg transition active:scale-95"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: InvestView（株式投資）
// ==========================================
function InvestView({ balance, updateBalance, onBack, showToast, playerName, emitNews, db, appId }) {
  const [players, setPlayers] = useState([]);
  const [myStocks, setMyStocks] = useState({});
  const [stockPrices, setStockPrices] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [investAmount, setInvestAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [tab, setTab] = useState('MARKET');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsub = onSnapshot(collRef, snap => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const name = data.name || decodeURIComponent(d.id);
        if (name !== playerName) list.push({ name, balance: data.balance || 0 });
      });
      setPlayers(list); setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const stocksRef = collection(db, 'artifacts', appId, 'public', 'data', 'stocks');
    const unsub = onSnapshot(stocksRef, snap => {
      const prices = {};
      snap.forEach(d => { prices[decodeURIComponent(d.id)] = d.data(); });
      setStockPrices(prices);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const safeMe = encodeURIComponent(playerName);
    const portfolioRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', safeMe);
    const unsub = onSnapshot(portfolioRef, snap => {
      if (snap.exists()) setMyStocks(snap.data().holdings || {});
      else setMyStocks({});
    });
    return () => unsub();
  }, [playerName]);

  const handleBuy = async () => {
    const amount = parseInt(investAmount);
    if (!selectedPlayer) { showToast('投資先を選んでください', 'error'); return; }
    if (isNaN(amount) || amount < 100) { showToast('100G以上で投資してください', 'error'); return; }
    if (amount > balance) { showToast('残高が足りません！', 'error'); return; }
    const safeTarget = encodeURIComponent(selectedPlayer);
    const safeMe = encodeURIComponent(playerName);
    try {
      const dividend = Math.floor(amount * 0.1);
      const investedAmount = amount - dividend;
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'stocks', safeTarget);
      const stockSnap = await getDoc(stockRef);
      let currentPrice = 1.0, baseInvestment = investedAmount, totalShares = 0;
      if (stockSnap.exists()) {
        const sd = stockSnap.data();
        currentPrice = sd.currentPrice || 1.0;
        baseInvestment = (sd.baseInvestment || 0) + investedAmount;
        totalShares = sd.totalShares || 0;
      }
      const sharesBought = investedAmount / currentPrice;
      const newTotalShares = totalShares + sharesBought;
      const selfRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeMe);
      await updateDoc(selfRef, { balance: increment(-amount) });
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeTarget);
      const targetSnap = await getDoc(targetRef);
      if (targetSnap.exists()) await updateDoc(targetRef, { balance: increment(dividend) });
      const priceHistory = stockSnap.exists() ? [...(stockSnap.data().priceHistory || []), { price: currentPrice, at: Date.now() }].slice(-50) : [{ price: 1.0, at: Date.now() }];
      await setDoc(stockRef, { targetName: selectedPlayer, currentPrice, baseInvestment, totalShares: newTotalShares, priceHistory, lastUpdated: Date.now() }, { merge: true });
      const portfolioRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', safeMe);
      const portSnap = await getDoc(portfolioRef);
      const holdings = portSnap.exists() ? (portSnap.data().holdings || {}) : {};
      const existing = holdings[selectedPlayer] || { shares: 0, avgBuyPrice: 0 };
      const newShares = existing.shares + sharesBought;
      const newAvg = ((existing.shares * existing.avgBuyPrice) + (sharesBought * currentPrice)) / newShares;
      holdings[selectedPlayer] = { shares: newShares, avgBuyPrice: newAvg };
      await setDoc(portfolioRef, { holdings }, { merge: true });
      showToast(`📈 ${selectedPlayer} 株 ${sharesBought.toFixed(2)}株 購入！配当 ${dividend.toLocaleString()}G を送付`, 'success');
      emitNews(`📈 ${playerName} が ${selectedPlayer} 株に ${amount.toLocaleString()} G 投資！`, 'invest');
      setInvestAmount('');
    } catch(e) { showToast('投資エラー', 'error'); }
  };

  const handleSell = async (targetName) => {
    const sharesToSell = parseFloat(sellAmount);
    const holding = myStocks[targetName];
    if (!holding || holding.shares <= 0) { showToast('保有株がありません', 'error'); return; }
    if (isNaN(sharesToSell) || sharesToSell <= 0 || sharesToSell > holding.shares) {
      showToast(`売却株数は 0〜${holding.shares.toFixed(2)} の範囲で入力してください`, 'error'); return;
    }
    const stockData = stockPrices[targetName];
    if (!stockData) { showToast('株価データがありません', 'error'); return; }
    const currentPrice = stockData.currentPrice || 1.0;
    const sellValue = Math.floor(sharesToSell * currentPrice);
    try {
      const safeMe = encodeURIComponent(playerName);
      const safeTarget = encodeURIComponent(targetName);
      const selfRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeMe);
      await updateDoc(selfRef, { balance: increment(sellValue) });
      const portfolioRef = doc(db, 'artifacts', appId, 'public', 'data', 'portfolios', safeMe);
      const portSnap = await getDoc(portfolioRef);
      const latestHoldings = portSnap.exists() ? { ...(portSnap.data().holdings || {}) } : {};
      const latestHolding = latestHoldings[targetName];
      if (!latestHolding) { showToast('保有株データが見つかりません', 'error'); return; }
      const newShares = latestHolding.shares - sharesToSell;
      if (newShares < 0.001) delete latestHoldings[targetName];
      else latestHoldings[targetName] = { ...latestHolding, shares: newShares };
      await setDoc(portfolioRef, { holdings: latestHoldings });
      const stockRef = doc(db, 'artifacts', appId, 'public', 'data', 'stocks', safeTarget);
      const stockSnap = await getDoc(stockRef);
      if (stockSnap.exists()) {
        const newTotal = Math.max(0, (stockSnap.data().totalShares || 0) - sharesToSell);
        await updateDoc(stockRef, { totalShares: newTotal });
      }
      const profit = sellValue - Math.floor(sharesToSell * holding.avgBuyPrice);
      showToast(`📉 ${targetName} 株売却 +${sellValue.toLocaleString()} G (${profit >= 0 ? '+' : ''}${profit.toLocaleString()} G)`, profit >= 0 ? 'success' : 'warning');
      setSellAmount(''); setSelectedPlayer(null);
    } catch(e) { showToast('売却エラー', 'error'); }
  };

  const getStockChangeColor = (current, avg) => {
    if (!avg || avg === 0) return 'text-gray-400';
    return current >= avg ? 'text-emerald-400' : 'text-red-400';
  };

  const getStockTrend = (history) => {
    if (!history || history.length < 2) return 0;
    const prev = history[history.length - 2]?.price || history[0].price;
    const curr = history[history.length - 1]?.price;
    return ((curr - prev) / prev) * 100;
  };

  const MiniChart = ({ history, color }) => {
    if (!history || history.length < 2) return <span className="text-gray-600 text-xs">データなし</span>;
    const prices = history.slice(-20).map(h => h.price);
    const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
    const w = 80, h = 30;
    const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  };

  const myHoldings = Object.entries(myStocks).filter(([, h]) => h.shares > 0.001);
  const totalPortfolioValue = myHoldings.reduce((sum, [name, h]) => sum + h.shares * (stockPrices[name]?.currentPrice || h.avgBuyPrice), 0);
  const totalCost = myHoldings.reduce((sum, [, h]) => sum + h.shares * h.avgBuyPrice, 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"><ArrowLeft size={20} /> メニューに戻る</button>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3"><TrendingUp className="text-teal-400" size={30} /> 株式投資市場</h2>
          <p className="text-gray-400 text-sm mt-1">プレイヤーの株を購入・ギャンブル勝率で株価が変動します</p>
        </div>
        <div className="bg-gray-900/90 border border-gray-800 px-4 py-3 rounded-2xl">
          <span className="text-xs text-gray-400 font-bold block">所持金</span>
          <span className="font-mono text-xl font-black text-yellow-400">{balance.toLocaleString()} G</span>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        {[['MARKET', '📈 マーケット'], ['PORTFOLIO', '💼 ポートフォリオ']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${tab === key ? 'bg-teal-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'MARKET' && (
        <div className="space-y-4">
          {loading && <p className="text-gray-500 text-center py-12">読み込み中...</p>}
          {!loading && players.length === 0 && <p className="text-gray-500 text-center py-12">他のプレイヤーがまだいません</p>}
          {players.map(p => {
            const stock = stockPrices[p.name];
            const currentPrice = stock?.currentPrice || 1.0;
            const trend = getStockTrend(stock?.priceHistory);
            const myHolding = myStocks[p.name];
            const isSelected = selectedPlayer === p.name;
            return (
              <div key={p.name} className={`bg-gray-900 rounded-2xl border transition-all ${isSelected ? 'border-teal-500/60' : 'border-gray-800 hover:border-gray-700'}`}>
                <div className="p-4 cursor-pointer" onClick={() => setSelectedPlayer(isSelected ? null : p.name)}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center font-black text-white text-xl flex-shrink-0">{p.name.charAt(0)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-black text-lg">{p.name}</span>
                          {myHolding && myHolding.shares > 0.001 && <span className="bg-teal-500/20 text-teal-400 text-xs px-2 py-0.5 rounded-full font-bold">保有中</span>}
                        </div>
                        <div className="text-gray-500 text-xs">発行済株: {(stock?.totalShares || 0).toFixed(2)} 株</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden md:block"><MiniChart history={stock?.priceHistory} color={trend >= 0 ? '#34d399' : '#f87171'} /></div>
                      <div className="text-right">
                        <div className="text-white font-mono font-black text-xl">{currentPrice.toFixed(2)}</div>
                        <div className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="border-t border-gray-800 p-4 bg-gray-950/50 rounded-b-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-teal-400 font-black text-sm mb-3">📈 株を購入する</p>
                        <div className="flex gap-2 mb-2">
                          <input type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)} placeholder="投資額 (G)" min="100"
                            className="flex-1 bg-gray-900 text-white font-mono p-3 rounded-xl border border-gray-700 focus:outline-none focus:border-teal-500" />
                          <button onClick={handleBuy} disabled={!investAmount || parseInt(investAmount) < 100 || parseInt(investAmount) > balance}
                            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-black px-4 rounded-xl transition active:scale-95">購入</button>
                        </div>
                        <div className="flex gap-1">
                          {[1000, 5000, 10000, 50000].map(v => (
                            <button key={v} onClick={() => setInvestAmount(v.toString())} disabled={v > balance}
                              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-1.5 rounded-lg transition disabled:opacity-30">
                              {v >= 1000 ? v/1000 + 'K' : v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-red-400 font-black text-sm mb-3">📉 株を売却する</p>
                        {myHolding && myHolding.shares > 0.001 ? (
                          <>
                            <div className="flex gap-2 mb-2">
                              <input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder={`売却株数 (max ${myHolding.shares.toFixed(2)})`}
                                className="flex-1 bg-gray-900 text-white font-mono p-3 rounded-xl border border-gray-700 focus:outline-none focus:border-red-500" />
                              <button onClick={() => handleSell(p.name)} disabled={!sellAmount || parseFloat(sellAmount) <= 0}
                                className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-black px-4 rounded-xl transition active:scale-95">売却</button>
                            </div>
                            <button onClick={() => setSellAmount(myHolding.shares.toFixed(4))} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-1.5 rounded-lg transition">全株売却</button>
                          </>
                        ) : (
                          <div className="text-gray-600 text-sm text-center py-8 bg-gray-900 rounded-xl border border-gray-800">この株を保有していません</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'PORTFOLIO' && (
        <div>
          {myHoldings.length === 0 ? (
            <div className="text-center py-20">
              <BarChart2 size={48} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">保有株式はまだありません</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <span className="text-xs text-gray-400 font-bold block mb-1">評価総額</span>
                  <span className="text-xl font-mono font-black text-teal-400">{Math.floor(totalPortfolioValue).toLocaleString()} G</span>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <span className="text-xs text-gray-400 font-bold block mb-1">投資総額</span>
                  <span className="text-xl font-mono font-black text-gray-300">{Math.floor(totalCost).toLocaleString()} G</span>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <span className="text-xs text-gray-400 font-bold block mb-1">含み損益</span>
                  <span className={`text-xl font-mono font-black ${totalPortfolioValue >= totalCost ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalPortfolioValue >= totalCost ? '+' : ''}{Math.floor(totalPortfolioValue - totalCost).toLocaleString()} G
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {myHoldings.map(([targetName, holding]) => {
                  const stock = stockPrices[targetName];
                  const currentPrice = stock?.currentPrice || holding.avgBuyPrice;
                  const currentValue = Math.floor(holding.shares * currentPrice);
                  const cost = Math.floor(holding.shares * holding.avgBuyPrice);
                  const profit = currentValue - cost;
                  return (
                    <div key={targetName} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center font-black text-white">{targetName.charAt(0)}</div>
                          <div>
                            <span className="text-white font-black text-lg">{targetName}</span>
                            <div className="text-gray-500 text-xs">{holding.shares.toFixed(2)} 株</div>
                          </div>
                        </div>
                        <div className={`text-2xl font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()} G</div>
                      </div>
                      <div className="flex gap-2">
                        <input type="number" value={selectedPlayer === targetName ? sellAmount : ''} onChange={e => { setSelectedPlayer(targetName); setSellAmount(e.target.value); }}
                          onFocus={() => setSelectedPlayer(targetName)} placeholder={`売却株数 (最大 ${holding.shares.toFixed(2)})`}
                          className="flex-1 bg-gray-950 text-white font-mono text-sm p-3 rounded-xl border border-gray-700 focus:outline-none focus:border-red-500" />
                        <button onClick={() => { setSelectedPlayer(targetName); setSellAmount(holding.shares.toFixed(4)); }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-3 rounded-xl transition">全株</button>
                        <button onClick={() => handleSell(targetName)} disabled={selectedPlayer !== targetName || !sellAmount || parseFloat(sellAmount) <= 0}
                          className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-black px-4 rounded-xl transition active:scale-95">売却</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: Janken（オンラインじゃんけん）
// ==========================================
function JankenView({ balance, updateBalance, onBack, showToast, playerName, emitNews, db, appId }) {
  const JANKEN_HANDS = [
    { id: 'rock', label: 'グー', emoji: '✊', beats: 'scissors' },
    { id: 'scissors', label: 'チョキ', emoji: '✌️', beats: 'paper' },
    { id: 'paper', label: 'パー', emoji: '🖐️', beats: 'rock' },
  ];
  const [phase, setPhase] = useState('LOBBY');
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [myHand, setMyHand] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [betAmount, setBetAmount] = useState(100);
  const [createBet, setCreateBet] = useState(100);
  const [gameResult, setGameResult] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [handLocked, setHandLocked] = useState(false);

  const timerRef = useRef(null);
  const roomUnsubRef = useRef(null);
  const chatUnsubRef = useRef(null);
  const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms');

  useEffect(() => {
    if (phase !== 'LOBBY') return;
    const q = query(roomsRef, orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setRooms(list);
    });
    return () => unsub();
  }, [phase]);

  useEffect(() => {
    if (!roomId) return;
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
    const unsub = onSnapshot(rRef, snap => {
      if (!snap.exists()) { leaveRoom(); return; }
      const data = snap.data();
      setCurrentRoom(data);
      if (data.guest && data.host !== playerName) setOpponentName(data.host);
      else if (data.guest && data.host === playerName) setOpponentName(data.guest);
      if (data.hostHand && data.guestHand && phase !== 'RESULT') resolveGame(data);
    });
    roomUnsubRef.current = unsub;
    return () => unsub();
  }, [roomId, phase]);

  useEffect(() => {
    if (!roomId) return;
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId, 'chat');
    const q = query(chatRef, orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
    });
    chatUnsubRef.current = unsub;
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); if (!handLocked) { const random = JANKEN_HANDS[Math.floor(Math.random() * 3)]; submitHand(random.id, true); } return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const createRoom = async () => {
    if (createBet <= 0 || createBet > balance) { showToast("ベット額が不正です。", 'error'); return; }
    try {
      const rRef = doc(roomsRef);
      await setDoc(rRef, { host: playerName, guest: null, hostHand: null, guestHand: null, bet: createBet, status: 'WAITING', createdAt: Date.now() });
      setRoomId(rRef.id); setIsHost(true); setPhase('ROOM');
    } catch(e) { showToast("ルーム作成エラー", 'error'); }
  };

  const joinRoom = async (room) => {
    if (room.guest) { showToast("このルームは満員です。", 'error'); return; }
    if (room.host === playerName) { showToast("自分のルームには入れません。", 'error'); return; }
    if (room.bet > balance) { showToast(`ベット額が足りません。`, 'error'); return; }
    try {
      const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', room.id);
      await updateDoc(rRef, { guest: playerName, status: 'PLAYING' });
      setRoomId(room.id); setBetAmount(room.bet); setIsHost(false); setOpponentName(room.host); setPhase('ROOM');
    } catch(e) { showToast("参加エラー", 'error'); }
  };

  const startGame = async () => {
    if (!currentRoom?.guest) { showToast("相手の参加を待っています...", 'info'); return; }
    setMyHand(null); setHandLocked(false); setGameResult(null);
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
    await updateDoc(rRef, { hostHand: null, guestHand: null, status: 'PLAYING' });
    setPhase('PLAYING');
  };

  const guestStartGame = async () => { setMyHand(null); setHandLocked(false); setGameResult(null); setPhase('PLAYING'); };

  const submitHand = async (handId, isTimeout = false) => {
    if (handLocked && !isTimeout) return;
    setMyHand(handId); setHandLocked(true);
    clearInterval(timerRef.current);
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
    const field = isHost ? 'hostHand' : 'guestHand';
    await updateDoc(rRef, { [field]: handId });
  };

  const resolveGame = async (data) => {
    if (phase === 'RESULT') return;
    const hh = data.hostHand, gh = data.guestHand;
    const myHandId = isHost ? hh : gh, opHand = isHost ? gh : hh;
    const myHandData = JANKEN_HANDS.find(h => h.id === myHandId);
    const opHandData = JANKEN_HANDS.find(h => h.id === opHand);
    let result = 'DRAW';
    if (myHandData && opHandData) {
      if (myHandData.beats === opHand) result = 'WIN';
      else if (opHandData.beats === myHandId) result = 'LOSE';
    }
    const bet = data.bet || 0;
    if (result === 'WIN') await updateBalance(bet);
    else if (result === 'LOSE') await updateBalance(-bet);
    const oppName = isHost ? data.guest : data.host;
    if (result === 'WIN') emitNews(`✊ ${playerName} が ${oppName} とのじゃんけんで勝利！ +${bet.toLocaleString()} G！`, 'janken');
    setGameResult({ result, myHand: myHandId, opHand, myLabel: myHandData?.label || '？', opLabel: opHandData?.label || '？', bet });
    setPhase('RESULT');
    try {
      const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
      await updateDoc(rRef, { status: 'DONE' });
    } catch(e) {}
  };

  const leaveRoom = async () => {
    if (roomUnsubRef.current) roomUnsubRef.current();
    if (chatUnsubRef.current) chatUnsubRef.current();
    if (isHost && roomId) {
      try {
        const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
        await deleteDoc(rRef);
      } catch(e) {}
    }
    setRoomId(null); setCurrentRoom(null); setMyHand(null); setHandLocked(false);
    setGameResult(null); setIsHost(false); setOpponentName(''); setChatMessages([]);
    setPhase('LOBBY'); clearInterval(timerRef.current);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !roomId) return;
    const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId, 'chat');
    await addDoc(chatRef, { sender: playerName, message: chatInput.trim(), createdAt: Date.now() });
    setChatInput('');
  };

  const rematch = async () => {
    if (!currentRoom) return;
    setMyHand(null); setHandLocked(false); setGameResult(null);
    const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'jankenRooms', roomId);
    await updateDoc(rRef, { hostHand: null, guestHand: null, status: 'PLAYING' });
    setPhase('PLAYING');
  };

  const formatChatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  if (phase === 'LOBBY') return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
      <div className="text-center mb-8">
        <h2 className="text-4xl font-black text-white mb-2">✊ オンラインじゃんけん ✌️</h2>
        <p className="text-gray-400">リアルタイム2人対戦 · 30秒制限</p>
      </div>
      <div className="bg-gradient-to-br from-pink-950 to-rose-950 border border-pink-500/30 rounded-3xl p-6 mb-6 shadow-2xl">
        <h3 className="text-lg font-black text-white mb-4">🆕 新しいルームを作る</h3>
        <div className="flex gap-3 items-center mb-4">
          <input type="number" value={createBet} onChange={e => setCreateBet(Number(e.target.value))}
            className="flex-1 bg-gray-950 text-white font-mono text-xl p-3 rounded-xl border border-gray-800 focus:outline-none focus:border-pink-500" min="10" step="10" />
          <span className="text-gray-500 text-sm">所持金: <span className="text-yellow-400 font-bold">{balance.toLocaleString()} G</span></span>
        </div>
        <button onClick={createRoom} disabled={createBet <= 0 || createBet > balance}
          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black py-3 rounded-xl transition disabled:opacity-40 active:scale-95">
          ルームを作成する
        </button>
      </div>
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900">
          <span className="text-pink-400 font-black text-sm">🔍 参加可能なルーム</span>
        </div>
        <div className="p-3 space-y-2 min-h-[80px]">
          {rooms.filter(r => !r.guest && r.status === 'WAITING' && r.host !== playerName).length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">参加できるルームはありません</p>
          ) : rooms.filter(r => !r.guest && r.status === 'WAITING' && r.host !== playerName).map(room => (
            <div key={room.id} className="flex items-center justify-between bg-gray-950 p-4 rounded-xl border border-gray-800">
              <div><span className="text-white font-bold">{room.host}</span><span className="text-gray-500 text-xs ml-2">のルーム</span></div>
              <div className="flex items-center gap-4">
                <span className="text-yellow-400 font-mono font-black">{room.bet?.toLocaleString()} G</span>
                <button onClick={() => joinRoom(room)} className="bg-pink-600 hover:bg-pink-500 text-white text-sm font-black px-4 py-2 rounded-lg transition active:scale-95">参加する</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={leaveRoom} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"><ArrowLeft size={18} /> {isHost ? 'ルームを解散' : 'ルームを退出'}</button>
        <div className="bg-gray-900/95 px-4 py-2 rounded-full border border-gray-800 font-mono text-lg text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {phase === 'ROOM' && (
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border border-gray-800 p-8 text-center">
              <h3 className="text-2xl font-black text-white mb-6">🎮 ルーム待機中</h3>
              <div className="flex justify-around items-center mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2"><span className="text-2xl">👤</span></div>
                  <div className="text-white font-bold">{isHost ? playerName : currentRoom?.host || '...'}</div>
                  <div className="text-xs text-pink-400">HOST</div>
                </div>
                <div className="text-4xl text-gray-600">VS</div>
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${currentRoom?.guest ? 'bg-blue-500/20' : 'bg-gray-800 animate-pulse'}`}>
                    <span className="text-2xl">{currentRoom?.guest ? '👤' : '⏳'}</span>
                  </div>
                  <div className={`font-bold ${currentRoom?.guest ? 'text-white' : 'text-gray-600'}`}>{currentRoom?.guest || '待機中...'}</div>
                  <div className="text-xs text-blue-400">GUEST</div>
                </div>
              </div>
              {isHost ? (
                <button onClick={startGame} disabled={!currentRoom?.guest} className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black py-4 rounded-xl text-lg transition disabled:opacity-40 active:scale-95">
                  {currentRoom?.guest ? '✊ ゲームスタート！' : '相手の参加を待っています...'}
                </button>
              ) : (
                <button onClick={guestStartGame} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black py-4 rounded-xl text-lg transition active:scale-95">✊ 準備OK！</button>
              )}
            </div>
          )}
          {phase === 'PLAYING' && (
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white font-bold">あなた: <span className="text-pink-400">{playerName}</span></div>
                <div className={`text-4xl font-black ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>⏱ {timeLeft}</div>
                <div className="text-white font-bold">相手: <span className="text-blue-400">{opponentName || '...'}</span></div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 mb-6">
                <div className={`h-3 rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{width: `${(timeLeft / 30) * 100}%`}} />
              </div>
              <p className="text-center text-gray-400 font-bold mb-6">{handLocked ? `${JANKEN_HANDS.find(h=>h.id===myHand)?.emoji} 手を出しました！` : '手を選んでください！'}</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {JANKEN_HANDS.map(hand => (
                  <button key={hand.id} onClick={() => submitHand(hand.id)} disabled={handLocked}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-4 transition-all transform active:scale-95 font-black
                      ${myHand === hand.id ? 'border-yellow-400 bg-yellow-400/20 scale-105' : handLocked ? 'border-gray-700 bg-gray-900 opacity-40 cursor-not-allowed' : 'border-gray-700 bg-gray-900 hover:border-pink-400 hover:bg-pink-400/10 cursor-pointer'}`}>
                    <span className="text-5xl mb-2">{hand.emoji}</span>
                    <span className="text-white">{hand.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {phase === 'RESULT' && gameResult && (
            <div className={`bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border-4 p-8 text-center ${gameResult.result === 'WIN' ? 'border-yellow-500' : gameResult.result === 'LOSE' ? 'border-red-500' : 'border-gray-700'}`}>
              <div className="text-7xl mb-4">{gameResult.result === 'WIN' ? '🏆' : gameResult.result === 'LOSE' ? '😢' : '🤝'}</div>
              <h3 className={`text-5xl font-black mb-6 ${gameResult.result === 'WIN' ? 'text-yellow-400' : gameResult.result === 'LOSE' ? 'text-red-400' : 'text-gray-400'}`}>
                {gameResult.result === 'WIN' ? '勝ち！' : gameResult.result === 'LOSE' ? '負け...' : 'あいこ！'}
              </h3>
              {gameResult.result !== 'DRAW' && (
                <div className={`text-3xl font-black mb-6 ${gameResult.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gameResult.result === 'WIN' ? `+${gameResult.bet.toLocaleString()} G` : `-${gameResult.bet.toLocaleString()} G`}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={rematch} className={`flex-1 text-white font-black py-4 rounded-xl text-lg transition active:scale-95 ${gameResult.result === 'WIN' ? 'bg-yellow-600' : gameResult.result === 'LOSE' ? 'bg-red-700' : 'bg-gray-700'}`}>もう一度！</button>
                <button onClick={leaveRoom} className="flex-1 bg-gray-800 text-white py-4 rounded-xl font-bold transition">退出</button>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden flex flex-col" style={{height: '480px'}}>
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-900"><span className="text-pink-400 font-black text-sm">💬 チャット</span></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`text-xs ${msg.sender === playerName ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-[85%] px-3 py-2 rounded-2xl ${msg.sender === playerName ? 'bg-pink-600/80 text-white' : 'bg-gray-800 text-gray-200'}`}>
                  {msg.sender !== playerName && <div className="text-pink-400 font-bold text-xs mb-0.5">{msg.sender}</div>}
                  <div>{msg.message}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="メッセージ..." maxLength={100} className="flex-1 bg-gray-950 text-white text-sm p-2 rounded-lg border border-gray-800 focus:outline-none focus:border-pink-500" />
            <button onClick={sendChat} className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-2 rounded-lg transition"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Slot Machine
// ==========================================
function SlotMachine({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [bet, setBet] = useState(100);
  const [displayGrid, setDisplayGrid] = useState(Array(9).fill(0));
  const finalGridRef = useRef(Array(9).fill(0));
  const [spinningCols, setSpinningCols] = useState([false, false, false]);
  const [slotStatus, setSlotStatus] = useState('IDLE');
  const [winLines, setWinLines] = useState([]);
  const [winMessage, setWinMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [totalWin, setTotalWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [jackpotFlash, setJackpotFlash] = useState(false);

  const autoRef = useRef(false);
  const statusRef = useRef('IDLE');
  const animFrames = useRef([null, null, null]);
  const totalLossRef = useRef(0);

  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const randomSymbol = () => SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
  const generateFinalGrid = useCallback(() => Array(9).fill(0).map(() => randomSymbol()), []);

  const spinReel = useCallback((colIndex, finalSymbols, stopDelay) => {
    return new Promise(resolve => {
      const startTime = performance.now();
      const tick = (now) => {
        const elapsed = now - startTime, progress = Math.min(elapsed / stopDelay, 1);
        if (Math.floor(now / (1000 / Math.max((1 - Math.max(0, progress - 0.7) / 0.3) * 60, 8))) % 2 === 0) {
          setDisplayGrid(prev => { const next = [...prev]; for (let row = 0; row < 3; row++) next[row * 3 + colIndex] = randomSymbol(); return next; });
        }
        if (progress < 1) { animFrames.current[colIndex] = requestAnimationFrame(tick); }
        else {
          setDisplayGrid(prev => { const next = [...prev]; for (let row = 0; row < 3; row++) next[row * 3 + colIndex] = finalSymbols[row * 3 + colIndex]; return next; });
          setSpinningCols(prev => { const n = [...prev]; n[colIndex] = false; return n; });
          resolve();
        }
      };
      animFrames.current[colIndex] = requestAnimationFrame(tick);
    });
  }, []);

  const startSpin = useCallback(async () => {
    if (statusRef.current !== 'IDLE') return;
    if (balance < bet) { showToast("残高が足りません！", 'error'); autoRef.current = false; setAutoSpin(false); return; }
    statusRef.current = 'SPINNING'; setSlotStatus('SPINNING');
    setWinLines([]); setWinMessage(''); setWinAmount(0); setJackpotFlash(false);
    setSpinCount(c => c + 1);
    await updateBalance(-bet);
    const finalGrid = generateFinalGrid();
    finalGridRef.current = finalGrid;
    setSpinningCols([true, true, true]);
    await Promise.all([0, 1, 2].map(col => spinReel(col, finalGrid, [900, 1400, 1900][col])));
    statusRef.current = 'RESULT'; setSlotStatus('RESULT');
    const grid = finalGridRef.current;
    let totalMult = 0;
    const hitLines = [];
    LINES.forEach(line => {
      const syms = line.map(i => SYMBOLS[grid[i]].sym);
      const match = PAYTABLE.find(p => p.combo[0] === syms[0] && p.combo[1] === syms[1] && p.combo[2] === syms[2]);
      if (match) { totalMult += match.mult; hitLines.push({ line, mult: match.mult, label: match.label, color: match.color, glow: match.glow }); }
    });
    if (totalMult > 0) {
      const amount = bet * totalMult;
      setWinAmount(amount); setTotalWin(w => w + amount - bet);
      const top = hitLines.sort((a, b) => b.mult - a.mult)[0];
      setWinMessage(`${top.label} ×${totalMult}`); setWinLines(hitLines);
      await updateBalance(amount); totalLossRef.current = 0;
      if (totalMult >= 50) setJackpotFlash(true);
      if (amount >= 100000) emitNews(`🎰 ${playerName} がスロットで大勝ち！ ${amount.toLocaleString()} G 獲得！！`, 'jackpot');
    } else {
      setWinMessage('LOSE'); totalLossRef.current += bet;
      if (totalLossRef.current >= 100000) { emitNews(`💸 ${playerName} がスロットで ${totalLossRef.current.toLocaleString()} G の大負けを記録...`, 'loss'); totalLossRef.current = 0; }
      setTotalWin(w => w - bet);
    }
    const delay = autoRef.current ? (totalMult >= 30 ? 2000 : 800) : (totalMult > 0 ? 2500 : 1500);
    setTimeout(() => {
      statusRef.current = 'IDLE'; setSlotStatus('IDLE');
      setWinMessage(''); setWinLines([]); setJackpotFlash(false);
      if (autoRef.current) startSpin();
    }, delay);
  }, [balance, bet, updateBalance, generateFinalGrid, spinReel, playerName, emitNews]);

  const toggleAuto = () => { const n = !autoSpin; autoRef.current = n; setAutoSpin(n); if (n && statusRef.current === 'IDLE') startSpin(); };
  useEffect(() => () => { animFrames.current.forEach(f => f && cancelAnimationFrame(f)); }, []);
  const isHighlighted = idx => winLines.some(wl => wl.line.includes(idx));
  const getWinGlow = idx => { const wl = winLines.find(w => w.line.includes(idx)); return wl ? wl.glow : ''; };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center">
      {jackpotFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>
          {[...Array(20)].map((_, i) => (<div key={i} className="absolute text-2xl animate-bounce" style={{ left: `${Math.random() * 90}%`, top: `${Math.random() * 90}%`, animationDelay: `${Math.random() * 0.5}s` }}>⭐</div>))}
        </div>
      )}
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={() => { autoRef.current = false; setAutoSpin(false); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">SPINS</div><div className="font-mono text-yellow-400 font-bold">{spinCount}</div></div>
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${totalWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalWin >= 0 ? '+' : ''}{totalWin.toLocaleString()}</div></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>
      <div className={`bg-gradient-to-b from-gray-800 to-gray-950 p-6 rounded-[2rem] border-8 shadow-2xl w-full relative transition-all ${jackpotFlash ? 'border-yellow-500 shadow-yellow-500/30' : 'border-gray-900'}`}>
        {winMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className={`text-4xl md:text-5xl font-black drop-shadow-2xl text-center px-6 py-4 rounded-2xl ${winAmount > 0 ? 'text-yellow-400 bg-black/80 border-2 border-yellow-500/50 animate-bounce' : 'text-gray-500 bg-black/60'}`}>
              {winMessage}{winAmount > 0 && <div className="text-xl text-emerald-400 mt-1">+{winAmount.toLocaleString()} G</div>}
            </div>
          </div>
        )}
        <div className="relative mb-5">
          <div className="grid grid-cols-3 gap-3">
            {displayGrid.map((symIdx, i) => {
              const sym = SYMBOLS[symIdx]; const hl = isHighlighted(i); const glow = getWinGlow(i); const col = i % 3; const isSpinning = spinningCols[col];
              return (
                <div key={i} className={`bg-gradient-to-b from-white to-gray-100 rounded-xl flex items-center justify-center h-24 md:h-28 shadow-inner transition-all duration-150 border-4 overflow-hidden relative ${hl ? `border-yellow-400 shadow-lg ${glow} scale-105` : 'border-gray-200'} ${isSpinning ? 'brightness-90' : ''}`}>
                  {isSpinning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-60">
                      {[-1, 0, 1].map(offset => { const oi = (symIdx + offset + SYMBOLS.length) % SYMBOLS.length; return <span key={offset} className={`text-2xl ${offset === 0 ? 'text-3xl' : 'text-xl opacity-50'}`}>{SYMBOLS[oi].sym === 'BAR' ? <span className="text-gray-800 font-black text-base">BAR</span> : SYMBOLS[oi].sym}</span>; })}
                    </div>
                  )}
                  {!isSpinning && (
                    <div className="flex flex-col items-center">
                      <span className={`text-4xl md:text-5xl ${hl ? 'drop-shadow-lg' : ''}`}>{sym.name === 'BAR' ? <span className="text-2xl font-black text-gray-800 tracking-tight">BAR</span> : sym.sym}</span>
                    </div>
                  )}
                  {hl && !isSpinning && <div className="absolute top-1 right-1"><Star size={12} className="text-yellow-400 fill-yellow-400 animate-spin" /></div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-950 p-5 rounded-xl border border-gray-800 gap-4">
          <select value={bet} onChange={e => setBet(Number(e.target.value))} disabled={slotStatus !== 'IDLE'} className="bg-gray-900 text-yellow-500 font-mono text-lg p-3 rounded-lg border border-gray-800 outline-none font-bold disabled:opacity-60">
            {[10, 100, 500, 1000, 5000, 10000].map(v => <option key={v} value={v}>{v.toLocaleString()}G</option>)}
          </select>
          <div className="flex gap-3 items-center">
            <button onClick={toggleAuto} className={`px-5 py-3 rounded-xl font-black transition active:scale-95 border text-sm ${autoSpin ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>{autoSpin ? '🔄 AUTO' : 'AUTO'}</button>
            <button onClick={startSpin} disabled={slotStatus !== 'IDLE' || balance < bet} className="bg-gradient-to-r from-yellow-500 to-yellow-400 text-black font-black py-3 px-10 rounded-full text-xl shadow-lg shadow-yellow-500/20 disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95">
              {slotStatus === 'SPINNING' ? <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPIN</span> : 'SPIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Labor - 英単語バイト
// ==========================================
function LaborView({ balance, updateBalance, onBack, showToast }) {
  const [phase, setPhase] = useState('SELECT');
  const [level, setLevel] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [totalEarned, setTotalEarned] = useState(0);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const QUIZ_COUNT = 5;

  const startQuiz = (lvl) => {
    setLevel(lvl);
    const pool = [...WORD_LEVELS[lvl].words].sort(() => Math.random() - 0.5).slice(0, QUIZ_COUNT);
    setQuestions(pool); setCurrentQ(0); setScore(0); setInput(''); setFeedback(null); setTimeLeft(10); setPhase('QUIZ');
  };

  useEffect(() => {
    if (phase !== 'QUIZ') return;
    timerRef.current = setInterval(() => { setTimeLeft(t => { if (t <= 1) { handleAnswer(''); return 10; } return t - 1; }); }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, currentQ]);

  useEffect(() => { if (phase === 'QUIZ' && inputRef.current) inputRef.current.focus(); }, [currentQ, phase]);

  const handleAnswer = (ans) => {
    clearInterval(timerRef.current);
    const correct = questions[currentQ]?.en?.toLowerCase();
    const isCorrect = ans.trim().toLowerCase() === correct;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore(s => s + 1);
    setTimeout(() => {
      setFeedback(null); setInput(''); setTimeLeft(10);
      if (currentQ + 1 >= QUIZ_COUNT) { finishQuiz(isCorrect ? score + 1 : score); } else { setCurrentQ(q => q + 1); }
    }, 800);
  };

  const finishQuiz = async (finalScore) => {
    const reward = Math.floor(WORD_LEVELS[level].reward * (finalScore / QUIZ_COUNT) * (finalScore === QUIZ_COUNT ? 1.5 : 1));
    setTotalEarned(reward);
    if (reward > 0) await updateBalance(reward);
    setPhase('RESULT');
  };

  const q = questions[currentQ];
  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
      {phase === 'SELECT' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-white mb-2">英単語バイト</h2>
            <p className="text-gray-400">日本語を見て英単語を入力しよう！全問正解でボーナス×1.5！</p>
          </div>
          <div className="space-y-4">
            {WORD_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startQuiz(i)} className={`w-full p-6 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] ${lv.bg}`}>
                <div className="flex justify-between items-center">
                  <div><span className={`text-2xl font-black ${lv.color}`}>{lv.label}</span><p className="text-gray-400 text-sm mt-1">全{QUIZ_COUNT}問 / 10秒制限</p></div>
                  <div className="text-right"><div className={`text-3xl font-black ${lv.color}`}>最大 {Math.floor(lv.reward * 1.5).toLocaleString()} G</div></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'QUIZ' && q && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 font-bold">{currentQ + 1} / {QUIZ_COUNT}問</span>
            <span className={`text-2xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>⏱ {timeLeft}秒</span>
          </div>
          <div className={`bg-gray-900 p-10 rounded-3xl border-2 text-center mb-6 transition-all ${feedback === 'correct' ? 'border-emerald-500 bg-emerald-500/10' : feedback === 'wrong' ? 'border-red-500 bg-red-500/10' : 'border-gray-800'}`}>
            <p className="text-5xl font-black text-white mb-2">{q.ja}</p>
            {feedback && <p className={`text-2xl font-black mt-4 ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback === 'correct' ? '✅ 正解！' : '❌ 不正解... 正解: ' + q.en}</p>}
          </div>
          <div className="flex gap-3">
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !feedback && handleAnswer(input)} placeholder="英単語を入力して Enter" disabled={!!feedback}
              className="flex-1 bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border-2 border-gray-800 focus:outline-none focus:border-yellow-500 disabled:opacity-50" />
            <button onClick={() => !feedback && handleAnswer(input)} disabled={!!feedback} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 rounded-xl transition active:scale-95 disabled:opacity-50">回答</button>
          </div>
        </div>
      )}
      {phase === 'RESULT' && (
        <div className="text-center">
          <div className="bg-gray-900 p-10 rounded-3xl border border-gray-800 shadow-2xl mb-6">
            <div className="text-6xl mb-4">{score === QUIZ_COUNT ? '🏆' : score >= 3 ? '👍' : '😢'}</div>
            <h3 className="text-4xl font-black text-white mb-2">バイト終了！</h3>
            <div className="text-7xl font-black text-yellow-400 mb-2">{score}<span className="text-3xl text-gray-400">/{QUIZ_COUNT}</span></div>
            <div className="text-4xl font-black text-emerald-400">+{totalEarned.toLocaleString()} G</div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setPhase('SELECT')} className="flex-1 bg-gray-800 text-white py-4 rounded-xl font-bold transition">レベル選択へ</button>
            <button onClick={() => startQuiz(level)} className="flex-1 bg-yellow-500 text-black py-4 rounded-xl font-black transition">もう一度！</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: Mining - マインスイーパー採掘
// ==========================================
function MiningView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [phase, setPhase] = useState('SELECT');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [board, setBoard] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [explodedCell, setExplodedCell] = useState(null);
  const [safeCells, setSafeCells] = useState(0);
  const [totalSafe, setTotalSafe] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  const generateBoard = (rows, cols, mines, firstRow, firstCol) => {
    const cells = Array(rows * cols).fill(0);
    const safeZone = new Set();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = firstRow + dr, c = firstCol + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) safeZone.add(r * cols + c);
    }
    let placed = 0;
    while (placed < mines) {
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

  const expandEmpty = (board, revealedArr, row, col, rows, cols) => {
    const queue = [[row, col]], visited = new Set();
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const idx = r * cols + c;
      if (visited.has(idx)) continue;
      visited.add(idx); revealedArr[idx] = true;
      if (board[idx] === 0) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !revealedArr[nr * cols + nc]) queue.push([nr, nc]);
        }
      }
    }
    return revealedArr;
  };

  const startGame = async (lvlIdx) => {
    const lvl = MINE_LEVELS[lvlIdx];
    if (balance < lvl.cost) { showToast(`参加費 ${lvl.cost.toLocaleString()} G が足りません！`, 'error'); return; }
    await updateBalance(-lvl.cost);
    setSelectedLevel(lvlIdx);
    setBoard([]); setRevealed(Array(lvl.rows * lvl.cols).fill(false)); setFlagged(Array(lvl.rows * lvl.cols).fill(false));
    setGameResult(null); setExplodedCell(null); setSafeCells(0); setTotalSafe(lvl.rows * lvl.cols - lvl.mines);
    setElapsedTime(0); setPhase('PLAYING');
  };

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleCellClick = async (row, col) => {
    if (phase !== 'PLAYING' || gameResult) return;
    const lvl = MINE_LEVELS[selectedLevel];
    const idx = row * lvl.cols + col;
    if (revealed[idx] || flagged[idx]) return;
    let currentBoard = board;
    if (board.length === 0) { currentBoard = generateBoard(lvl.rows, lvl.cols, lvl.mines, row, col); setBoard(currentBoard); }
    if (currentBoard[idx] === -1) {
      clearInterval(timerRef.current);
      const newRevealed = [...revealed]; newRevealed[idx] = true;
      setRevealed(newRevealed); setExplodedCell(idx); setGameResult('LOSE'); setPhase('RESULT');
      emitNews(`💥 ${playerName} が${lvl.label}で爆発！`, 'loss'); return;
    }
    let newRevealed = [...revealed];
    newRevealed = expandEmpty(currentBoard, newRevealed, row, col, lvl.rows, lvl.cols);
    setRevealed(newRevealed);
    const newSafe = newRevealed.filter(Boolean).length;
    setSafeCells(newSafe);
    if (newSafe >= totalSafe) {
      clearInterval(timerRef.current);
      await updateBalance(lvl.reward); setGameResult('WIN'); setPhase('RESULT');
      emitNews(`⛏️ ${playerName} が${lvl.label}の採掘に成功！${lvl.reward.toLocaleString()} G 獲得！`, 'mining');
    }
  };

  const handleRightClick = (e, row, col) => {
    e.preventDefault();
    if (phase !== 'PLAYING' || gameResult) return;
    const lvl = MINE_LEVELS[selectedLevel];
    const idx = row * lvl.cols + col;
    if (revealed[idx]) return;
    const newFlagged = [...flagged]; newFlagged[idx] = !newFlagged[idx]; setFlagged(newFlagged);
  };

  const numberColors = ['', 'text-blue-500', 'text-emerald-500', 'text-red-500', 'text-purple-600', 'text-red-700', 'text-cyan-500', 'text-black', 'text-gray-500'];
  const lvl = selectedLevel !== null ? MINE_LEVELS[selectedLevel] : null;
  const progress = totalSafe > 0 ? (safeCells / totalSafe) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={() => { clearInterval(timerRef.current); setPhase('SELECT'); setSelectedLevel(null); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        {phase === 'PLAYING' && lvl && (
          <div className="flex items-center gap-4">
            <span className={`font-bold text-sm ${lvl.color}`}>{lvl.label}</span>
            <span className="text-gray-400 font-mono">⏱ {elapsedTime}秒</span>
            <span className="text-amber-400 font-mono font-bold">{safeCells}/{totalSafe} 安全</span>
            <div className="bg-gray-900/95 px-4 py-2 rounded-full border border-gray-800 font-mono text-lg text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
          </div>
        )}
      </div>
      {phase === 'SELECT' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-white mb-2 flex items-center justify-center gap-3"><Pickaxe size={36} className="text-amber-400" /> マインスイーパー採掘</h2>
            <p className="text-gray-400">地雷を避けながら安全なマスを掘り進めよう！</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MINE_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startGame(i)} disabled={balance < lv.cost}
                className={`p-6 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] disabled:opacity-40 ${lv.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{lv.icon}</span>
                  <div><span className={`text-xl font-black ${lv.color}`}>{lv.label}</span><div className="text-gray-500 text-xs">{lv.rows}×{lv.cols}マス / 地雷{lv.mines}個</div></div>
                </div>
                <div className="flex justify-between items-center">
                  <div><div className="text-gray-400 text-xs">参加費</div><div className="text-red-400 font-black text-lg">-{lv.cost.toLocaleString()} G</div></div>
                  <div className="text-right"><div className="text-gray-400 text-xs">クリア報酬</div><div className={`font-black text-2xl ${lv.color}`}>+{lv.reward.toLocaleString()} G</div></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 'PLAYING' && lvl && (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl mb-4">
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{width: `${progress}%`}}></div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-2xl overflow-auto max-w-full">
            <div style={{display: 'grid', gridTemplateColumns: `repeat(${lvl.cols}, 1fr)`, gap: '2px'}}>
              {Array(lvl.rows * lvl.cols).fill(0).map((_, idx) => {
                const row = Math.floor(idx / lvl.cols), col = idx % lvl.cols;
                const isRevealed = revealed[idx], isFlagged = flagged[idx];
                const isMine = board.length > 0 && board[idx] === -1;
                const isExploded = idx === explodedCell;
                const num = board.length > 0 ? board[idx] : 0;
                return (
                  <button key={idx} onClick={() => handleCellClick(row, col)} onContextMenu={(e) => handleRightClick(e, row, col)}
                    className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-xs md:text-sm font-black rounded transition-all select-none
                      ${isExploded ? 'bg-red-600 text-white scale-110' : ''}
                      ${isRevealed && !isExploded ? isMine ? 'bg-red-900/40 text-red-500' : 'bg-gray-800 text-gray-200 border border-gray-700' : !isRevealed ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600 cursor-pointer' : ''}`}
                    style={{ minWidth: '2rem' }}>
                    {isExploded ? '💥' : isFlagged && !isRevealed ? '🚩' : isRevealed && isMine ? '💣' : isRevealed && num > 0 ? <span className={numberColors[num]}>{num}</span> : isRevealed ? '' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {phase === 'RESULT' && lvl && (
        <div className="text-center max-w-md mx-auto">
          <div className={`p-10 rounded-3xl border shadow-2xl mb-6 ${gameResult === 'WIN' ? 'bg-amber-500/10 border-amber-500' : 'bg-red-500/10 border-red-500'}`}>
            <div className="text-7xl mb-4">{gameResult === 'WIN' ? '⛏️' : '💥'}</div>
            <h3 className={`text-4xl font-black mb-2 ${gameResult === 'WIN' ? 'text-amber-400' : 'text-red-400'}`}>{gameResult === 'WIN' ? '採掘成功！' : '爆発！！'}</h3>
            {gameResult === 'WIN' && <div className="text-5xl font-black text-emerald-400 mb-2">+{lvl.reward.toLocaleString()} G</div>}
            {gameResult === 'LOSE' && <div className="text-3xl font-black text-red-400 mb-2">参加費 {lvl.cost.toLocaleString()} G 没収</div>}
          </div>
          <div className="flex gap-4">
            <button onClick={() => { setPhase('SELECT'); setSelectedLevel(null); }} className="flex-1 bg-gray-800 text-white py-4 rounded-xl font-bold transition">レベル選択へ</button>
            <button onClick={() => startGame(selectedLevel)} disabled={balance < lvl.cost} className={`flex-1 text-white py-4 rounded-xl font-black transition disabled:opacity-40 ${gameResult === 'WIN' ? 'bg-amber-600' : 'bg-red-700'}`}>
              {gameResult === 'WIN' ? 'もう一度！' : 'リベンジ！'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: RouletteView
// ==========================================
function RouletteView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const ROULETTE_ZONES = [
    { value: 1, label: '×1', color: '#16a34a', bgClass: 'bg-green-600', textClass: 'text-green-400', borderClass: 'border-green-500', weight: 12 },
    { value: 3, label: '×3', color: '#2563eb', bgClass: 'bg-blue-600', textClass: 'text-blue-400', borderClass: 'border-blue-500', weight: 9 },
    { value: 5, label: '×5', color: '#7c3aed', bgClass: 'bg-purple-700', textClass: 'text-purple-400', borderClass: 'border-purple-500', weight: 6 },
    { value: 10, label: '×10', color: '#b45309', bgClass: 'bg-amber-700', textClass: 'text-amber-400', borderClass: 'border-amber-500', weight: 4 },
    { value: 20, label: '×20', color: '#be123c', bgClass: 'bg-rose-700', textClass: 'text-rose-400', borderClass: 'border-rose-500', weight: 2 },
  ];
  const WHEEL_SLOTS = React.useMemo(() => {
    const arr = ROULETTE_ZONES.flatMap(z => Array(z.weight).fill(z.value));
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, []);
  const TOTAL_SLOTS = WHEEL_SLOTS.length;
  const [bets, setBets] = useState({ 1: 0, 3: 0, 5: 0, 10: 0, 20: 0 });
  const [betInput, setBetInput] = useState({ 1: '', 3: '', 5: '', 10: '', 20: '' });
  const [phase, setPhase] = useState('BETTING');
  const [resultZone, setResultZone] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [totalBetAmount, setTotalBetAmount] = useState(0);
  const [spinHistory, setSpinHistory] = useState([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [waitCountdown, setWaitCountdown] = useState(9);
  const canvasRef = React.useRef(null);
  const animRef = React.useRef(null);
  const autoRef = React.useRef(false);
  const waitTimerRef = React.useRef(null);
  const angleRef = React.useRef(0);
  const phaseRef = React.useRef('BETTING');
  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

  const drawWheel = React.useCallback((currentAngle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 10;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fillStyle = '#1f2937'; ctx.fill();
    const sliceAngle = (Math.PI * 2) / TOTAL_SLOTS;
    WHEEL_SLOTS.forEach((val, i) => {
      const zone = ROULETTE_ZONES.find(z => z.value === val);
      const startA = currentAngle + i * sliceAngle - Math.PI / 2;
      const endA = startA + sliceAngle;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, startA, endA); ctx.closePath();
      ctx.fillStyle = zone.color; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      const midA = startA + sliceAngle / 2;
      const tx = cx + (R * 0.70) * Math.cos(midA), ty = cy + (R * 0.70) * Math.sin(midA);
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(midA + Math.PI / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = `bold ${Math.max(10, Math.floor(R * 0.078))}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(val.toString(), 0, 0); ctx.restore();
    });
    const hubR = R * 0.16;
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2); ctx.fillStyle = '#1f2937'; ctx.fill();
    const ptrY = cy - R - 3;
    ctx.beginPath(); ctx.moveTo(cx, ptrY + 2); ctx.lineTo(cx - 11, ptrY + 20); ctx.lineTo(cx + 11, ptrY + 20); ctx.closePath();
    ctx.fillStyle = '#f59e0b'; ctx.fill();
  }, [WHEEL_SLOTS, TOTAL_SLOTS]);

  React.useEffect(() => { drawWheel(0); }, [drawWheel]);
  React.useEffect(() => { autoRef.current = autoSpin; }, [autoSpin]);
  React.useEffect(() => { phaseRef.current = phase; }, [phase]);

  const handleBetChange = (value, inputVal) => {
    setBetInput(prev => ({ ...prev, [value]: inputVal }));
    const num = parseInt(inputVal);
    setBets(prev => ({ ...prev, [value]: isNaN(num) || num < 0 ? 0 : num }));
  };

  const clearBets = () => { setBets({ 1: 0, 3: 0, 5: 0, 10: 0, 20: 0 }); setBetInput({ 1: '', 3: '', 5: '', 10: '', 20: '' }); };

  const startWaitCountdown = React.useCallback((currentBets, currentBalance) => {
    setPhase('WAIT'); phaseRef.current = 'WAIT'; setWaitCountdown(9);
    let count = 9;
    waitTimerRef.current = setInterval(() => {
      count -= 1; setWaitCountdown(count);
      if (count <= 0) { clearInterval(waitTimerRef.current); if (autoRef.current) executeSpin(currentBets, currentBalance); else { setPhase('BETTING'); phaseRef.current = 'BETTING'; } }
    }, 1000);
  }, []);

  const executeSpin = React.useCallback(async (currentBets, currentBalance) => {
    const bet = currentBets || bets, bal = currentBalance || balance;
    const total = Object.values(bet).reduce((a, b) => a + b, 0);
    if (total <= 0) { showToast('賭け金を設定してください！', 'error'); setPhase('BETTING'); return; }
    if (total > bal) { showToast('残高が足りません！', 'error'); setPhase('BETTING'); setAutoSpin(false); return; }
    await updateBalance(-total); setTotalBetAmount(total); setPhase('SPINNING'); phaseRef.current = 'SPINNING'; setResultZone(null); setWinAmount(0);
    const winSlotIdx = Math.floor(Math.random() * TOTAL_SLOTS);
    const winValue = WHEEL_SLOTS[winSlotIdx];
    const winZone = ROULETTE_ZONES.find(z => z.value === winValue);
    const sliceAngle = (Math.PI * 2) / TOTAL_SLOTS;
    const targetOffset = -winSlotIdx * sliceAngle + sliceAngle * 0.5 * (Math.random() - 0.5);
    const extraRotations = (5 + Math.floor(Math.random() * 3)) * Math.PI * 2;
    const targetAngle = angleRef.current + extraRotations + targetOffset - (angleRef.current % (Math.PI * 2));
    const startAngle = angleRef.current, startTime = performance.now(), duration = 4000 + Math.random() * 1500;
    const animate = (now) => {
      const elapsed = now - startTime, rawT = Math.min(elapsed / duration, 1), t = 1 - Math.pow(1 - rawT, 3);
      const currentAngle = startAngle + (targetAngle - startAngle) * t;
      angleRef.current = currentAngle; drawWheel(currentAngle);
      if (rawT < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        drawWheel(targetAngle);
        const betOnWinner = bet[winValue] || 0, payout = betOnWinner * winValue;
        if (payout > 0) updateBalance(payout);
        setResultZone(winZone); setWinAmount(payout); setPhase('RESULT'); phaseRef.current = 'RESULT';
        setSpinHistory(prev => [{ value: winValue, payout, net: payout - total, bet: total }, ...prev].slice(0, 10));
        if (payout > 0 && payout - total >= 50000) emitNews(`🎡 ${playerName} がルーレットで大勝利！×${winValue}エリア +${(payout - total).toLocaleString()} G！`, 'jackpot');
        if (autoRef.current) setTimeout(() => startWaitCountdown(bet, bal - total + payout), 1200);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [bets, balance, updateBalance, WHEEL_SLOTS, TOTAL_SLOTS, drawWheel, playerName, emitNews, showToast, startWaitCountdown]);

  const spin = () => { if (phase !== 'BETTING') return; executeSpin(bets, balance); };
  const toggleAutoSpin = () => {
    const next = !autoSpin; setAutoSpin(next); autoRef.current = next;
    if (!next) { clearInterval(waitTimerRef.current); if (phaseRef.current === 'WAIT') { setPhase('BETTING'); phaseRef.current = 'BETTING'; } }
    else if (phaseRef.current === 'BETTING') executeSpin(bets, balance);
  };
  React.useEffect(() => { return () => { if (animRef.current) cancelAnimationFrame(animRef.current); clearInterval(waitTimerRef.current); }; }, []);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="w-full flex justify-between items-center mb-5">
        <button onClick={() => { if (animRef.current) cancelAnimationFrame(animRef.current); clearInterval(waitTimerRef.current); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance?.toLocaleString() || 0} G</div>
      </div>
      <div className="flex flex-col xl:flex-row gap-5 items-stretch">
        <div className="xl:w-[55%] flex flex-col gap-4">
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border border-gray-800 shadow-2xl p-5 flex flex-col items-center gap-4 flex-1">
            <div className="relative w-full flex justify-center">
              <canvas ref={canvasRef} width={480} height={480} className="w-full max-w-[480px] h-auto rounded-full border-4 border-gray-700 shadow-2xl" />
              {phase === 'SPINNING' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/30 rounded-full w-24 h-24 flex flex-col items-center justify-center"><RefreshCw className="text-yellow-400 animate-spin mb-1" size={32} /></div>
                </div>
              )}
              {phase === 'WAIT' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/50 rounded-full w-28 h-28 flex flex-col items-center justify-center border-2 border-yellow-500/40">
                    <span className="text-yellow-400 text-4xl font-black leading-none">{waitCountdown}</span>
                  </div>
                </div>
              )}
            </div>
            {phase === 'RESULT' && resultZone && (
              <div className={`w-full max-w-[480px] p-5 rounded-2xl border-4 text-center ${winAmount > 0 ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-900/80'}`}>
                <div className={`text-2xl font-black ${resultZone.textClass}`}>{resultZone.value} エリア当選</div>
                {winAmount > 0 ? (
                  <div className="text-3xl font-black text-emerald-400">+{winAmount.toLocaleString()} G</div>
                ) : <div className="text-2xl font-black text-red-400">ハズレ</div>}
                {!autoSpin && (
                  <button onClick={() => { setPhase('BETTING'); setResultZone(null); setWinAmount(0); }} className="mt-3 w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black py-2.5 rounded-xl transition">もう一度！</button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="xl:w-[45%] flex flex-col">
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border border-gray-800 p-5 shadow-2xl flex flex-col flex-1">
            <h3 className="text-xl font-black text-white mb-4">🎡 ROULETTE BET</h3>
            <div className="space-y-2.5 flex-1 overflow-y-auto mb-4">
              {ROULETTE_ZONES.map(zone => (
                <div key={zone.value} className={`p-3 rounded-xl border-2 ${bets[zone.value] > 0 ? `${zone.borderClass} bg-gray-950` : 'border-gray-800 bg-gray-950/60'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ backgroundColor: zone.color }}>{zone.value}</div>
                    <div className="flex-1"><div className={`font-black text-sm ${zone.textClass}`}>{zone.label} エリア</div></div>
                  </div>
                  <input type="number" value={betInput[zone.value]} onChange={e => handleBetChange(zone.value, e.target.value)} placeholder="0" disabled={phase !== 'BETTING'}
                    className="w-full bg-gray-900 text-white font-mono text-base p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-yellow-500 disabled:opacity-50" min="0" step="100" />
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm font-bold">合計ベット</span>
                <span className="font-mono text-xl font-black text-yellow-400">{totalBet.toLocaleString()} G</span>
              </div>
              <div className="flex gap-2">
                <button onClick={clearBets} disabled={phase !== 'BETTING'} className="bg-gray-800 text-gray-300 font-bold py-3 px-4 rounded-xl transition disabled:opacity-40">クリア</button>
                <button onClick={spin} disabled={phase !== 'BETTING' || totalBet <= 0 || totalBet > balance}
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black py-3 rounded-xl text-lg disabled:opacity-50 transition hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                  {phase === 'SPINNING' ? <><RefreshCw size={18} className="animate-spin" /> SPINNING...</> : phase === 'WAIT' ? `${waitCountdown}秒後` : '🎡 SPIN！'}
                </button>
              </div>
              <button onClick={toggleAutoSpin}
                className={`w-full py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center gap-2 ${autoSpin ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                <RefreshCw size={16} className={autoSpin ? 'animate-spin' : ''} />
                {autoSpin ? 'オートスピン ON' : 'オートスピン OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}