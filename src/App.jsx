import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw, TrendingDown, Briefcase, Lock, Star, Newspaper, Pickaxe, BookOpen, History, Bomb, Spade } from 'lucide-react';
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

// ==================== 競馬定数 ====================
const INITIAL_HORSES = [
  { id: 1, name: 'シンボリルドルフ', odds: 2.5, jockey: '岡部幸雄', color: '#ffffff', textColor: '#000000', weight: 56, condition: '良', popularity: 1 },
  { id: 2, name: 'トウカイテイオー', odds: 3.2, jockey: '安田隆行', color: '#1a1a1a', textColor: '#ffffff', weight: 55, condition: '良', popularity: 2 },
  { id: 3, name: 'オグリキャップ', odds: 5.0, jockey: '武豊', color: '#dc2626', textColor: '#ffffff', weight: 57, condition: '稍重', popularity: 3 },
  { id: 4, name: 'ディープインパクト', odds: 1.8, jockey: '武豊', color: '#2563eb', textColor: '#ffffff', weight: 56, condition: '良', popularity: 4 },
  { id: 5, name: 'ゴールドシップ', odds: 15.0, jockey: '内田博幸', color: '#ca8a04', textColor: '#000000', weight: 58, condition: '重', popularity: 5 },
  { id: 6, name: 'ナリタブライアン', odds: 8.0, jockey: '南井克巳', color: '#16a34a', textColor: '#ffffff', weight: 55, condition: '良', popularity: 6 },
  { id: 7, name: 'テイエムオペラオー', odds: 6.0, jockey: '和田竜二', color: '#9333ea', textColor: '#ffffff', weight: 56, condition: '稍重', popularity: 7 },
  { id: 8, name: 'スペシャルウィーク', odds: 12.0, jockey: '武豊', color: '#0891b2', textColor: '#ffffff', weight: 54, condition: '良', popularity: 8 },
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
const INTEREST_RATE_30SEC = 0.001;
const INTEREST_INTERVAL = 30000;
const LOAN_INTEREST_RATE = 0.001;
const LOAN_INTERVAL = 1800000;

// ==================== ニュース投稿ユーティリティ ====================
async function postNews(db, appId, message, type = 'info') {
  try {
    const newsRef = collection(db, 'artifacts', appId, 'public', 'data', 'news');
    await addDoc(newsRef, { message, type, createdAt: Date.now() });
  } catch (e) { console.error('news post error', e); }
}

// ==================== カード定数（ブラックジャック・ポーカー共用） ====================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_COLORS = { '♠': 'text-gray-100', '♥': 'text-red-400', '♦': 'text-red-400', '♣': 'text-gray-100' };

function createDeck(count = 1) {
  const deck = [];
  for (let d = 0; d < count; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handTotal(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// ==================== トランプカード描画コンポーネント ====================
function PlayingCard({ card, hidden = false, small = false }) {
  const sizeClass = small ? 'w-10 h-14 text-xs' : 'w-14 h-20 text-sm md:w-16 md:h-24 md:text-base';
  if (hidden) {
    return (
      <div className={`${sizeClass} rounded-lg border-2 border-gray-600 bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center shadow-xl`}>
        <span className="text-2xl opacity-50">🂠</span>
      </div>
    );
  }
  const colorClass = SUIT_COLORS[card.suit];
  return (
    <div className={`${sizeClass} rounded-lg border-2 border-gray-500 bg-gradient-to-br from-white to-gray-100 flex flex-col justify-between p-1 shadow-xl select-none`}>
      <div className={`font-black leading-none ${colorClass} ${small ? 'text-xs' : 'text-sm'}`}>{card.rank}<br/>{card.suit}</div>
      <div className={`text-center font-black ${colorClass} ${small ? 'text-base' : 'text-xl'}`}>{card.suit}</div>
      <div className={`font-black leading-none text-right rotate-180 ${colorClass} ${small ? 'text-xs' : 'text-sm'}`}>{card.rank}<br/>{card.suit}</div>
    </div>
  );
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
      const interest = Math.floor(bankBalance * INTEREST_RATE_30SEC);
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
        updateDoc(docRef, { loanBalance: increment(interest) });
        showToast(`💸 ローン利息 +${interest.toLocaleString()} G！`, 'warning');
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
          balance: data.balance || 0,
          bankBalance: data.bankBalance || 0,
          loanBalance: data.loanBalance || 0,
          creditScore: data.creditScore || 100,
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
      for (let i = 0; i < periods; i++) { const int = Math.floor(bank * INTEREST_RATE_30SEC); total += int; bank += int; }
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
        await updateDoc(docRef, { loanBalance: increment(total), lastLoanTime: now });
        showToast(`💸 不在中にローン利息 +${total.toLocaleString()} G！`, 'warning');
      }
    }
  };

  const updateBalance = async (amount) => {
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(amount) });
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

  const claimRelief = () => {
    if (balance < 100 && bankBalance < 100) {
      updateBalance(1000); showToast("【救済】1000Gを受け取りました！", 'success');
    } else showToast("まだ資産があります！", 'error');
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
    const isFullRepay = amount >= loanBalance;
    const creditBonus = isFullRepay ? 10 : 3;
    await updateDoc(docRef, { balance: increment(-amount), loanBalance: increment(-amount), creditScore: increment(creditBonus) });
    showToast(`✅ ${amount.toLocaleString()} G 返済！信用度 +${creditBonus}`, 'success');
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
      if (amount >= 50000) {
        await postNews(db, appId, `💸 ${playerName} → ${target} への大口送金 ${amount.toLocaleString()} G が執行された！`, 'transfer');
      }
      showToast(`💸 ${target} へ ${amount.toLocaleString()} G 送金！`, 'success');
      setTransferTarget(''); setTransferAmount('');
    } catch(e) { showToast("送金エラー", 'error'); }
  };

  const emitNews = useCallback((msg, type) => { postNews(db, appId, msg, type); }, []);

  const getCreditColor = s => s >= 150 ? 'text-emerald-400' : s >= 100 ? 'text-yellow-400' : s >= 50 ? 'text-orange-400' : 'text-red-400';
  const getCreditLabel = s => s >= 150 ? 'AAA' : s >= 120 ? 'AA' : s >= 100 ? 'A' : s >= 80 ? 'BBB' : s >= 60 ? 'BB' : s >= 40 ? 'B' : 'CCC';

  const toastColors = { info: 'bg-yellow-500 text-black', success: 'bg-emerald-500 text-white', error: 'bg-red-500 text-white', warning: 'bg-orange-500 text-white' };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const newsTypeStyle = {
    info: 'text-blue-400', success: 'text-emerald-400', warning: 'text-orange-400', error: 'text-red-400',
    jackpot: 'text-yellow-300 font-black', transfer: 'text-purple-400', mining: 'text-amber-400', loss: 'text-red-400',
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
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 mb-2">GRAND CASINO</h1>
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
                  <p className="text-xs text-gray-600 mt-1 text-center">※初めての方：任意の3桁数字を設定してください</p>
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
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-1">GRAND CASINO</h1>
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

                    {HORSE_RACING_EVENT_ACTIVE ? (
                      <button onClick={() => setView('RACE')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-950 to-green-950 p-6 rounded-3xl shadow-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all transform hover:-translate-y-1 text-left">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-emerald-500/10 group-hover:text-emerald-400/20 transition-all duration-500"><Trophy size={110} /></div>
                        <span className="bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Racing</span>
                        <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-emerald-300 transition">VIRTUAL TURF</h2>
                        <p className="text-gray-400 text-sm">8頭立て・天候・馬場状態あり</p>
                      </button>
                    ) : (
                      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-950 p-6 rounded-3xl shadow-2xl border border-gray-800 text-left opacity-60 cursor-not-allowed select-none">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 text-gray-700"><Trophy size={110} /></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-3xl z-10">
                          <Lock size={32} className="text-gray-500 mb-2" />
                          <span className="text-gray-400 font-black text-lg">イベント期間外</span>
                          <span className="text-gray-600 text-xs mt-1">開催まで暫くお待ちください</span>
                        </div>
                        <span className="bg-gray-700/50 text-gray-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Racing</span>
                        <h2 className="text-xl font-extrabold text-gray-600 mb-1">VIRTUAL TURF</h2>
                        <p className="text-gray-700 text-sm">8頭立て・天候・馬場状態あり</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* オンラインゲーム（NEW） */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">🃏 オンラインゲーム</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => setView('BLACKJACK')} className="group relative overflow-hidden bg-gradient-to-br from-green-950 to-emerald-950 p-6 rounded-3xl shadow-2xl border border-green-500/20 hover:border-green-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-2 -mr-2 text-green-500/10 group-hover:text-green-400/20 transition-all duration-500 text-8xl font-black select-none">21</div>
                      <span className="bg-green-500/10 text-green-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Card Game</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-green-300 transition">BLACKJACK</h2>
                      <p className="text-gray-400 text-sm">21を目指せ・ブラックジャックで1.5倍</p>
                    </button>

                    <button onClick={() => setView('POKER')} className="group relative overflow-hidden bg-gradient-to-br from-red-950 to-rose-950 p-6 rounded-3xl shadow-2xl border border-red-500/20 hover:border-red-500/40 transition-all transform hover:-translate-y-1 text-left">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 text-red-500/10 group-hover:text-red-400/20 transition-all duration-500 text-9xl font-black select-none">♠</div>
                      <span className="bg-red-500/10 text-red-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Card Game</span>
                      <h2 className="text-xl font-extrabold text-white mb-1 group-hover:text-red-300 transition">TEXAS POKER</h2>
                      <p className="text-gray-400 text-sm">テキサスホールデム・対ディーラー戦</p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <button onClick={() => setView('RANKING')} className="flex items-center justify-between p-5 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Trophy size={22} /></div>
                      <div className="text-left"><span className="font-bold text-white block">長者番付</span><span className="text-xs text-gray-400">トップ10ランキング</span></div>
                    </div>
                    <ChevronRight className="text-gray-500" size={20} />
                  </button>
                </div>

                {/* 純資産・救済 */}
                <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
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
                  {balance < 100 && bankBalance < 100 && (
                    <button onClick={claimRelief} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold border border-red-500/30 transition">
                      救済資金 1,000G を申請する
                    </button>
                  )}
                </div>
              </div>

              {/* 右：ニュースのみ */}
              <div className="space-y-4">
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <Newspaper size={16} className="text-yellow-400" />
                    <span className="text-yellow-400 font-black text-sm tracking-widest">CASINO NEWS</span>
                  </div>
                  <div className="h-96 overflow-y-auto p-3 space-y-2 scrollbar-hide">
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
              </div>
            </div>
          </div>
        )}

        {view === 'SLOT' && <SlotMachine balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'RACE' && HORSE_RACING_EVENT_ACTIVE && <HorseRacing balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'LABOR' && <LaborView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} />}
        {view === 'MINING' && <MiningView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'BLACKJACK' && <BlackjackView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}
        {view === 'POKER' && <TexasPokerView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} playerName={playerName} emitNews={emitNews} />}

        {/* ===== BANK ===== */}
        {view === 'BANK' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><Landmark size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">GRAND BANK</h2>
                  <p className="text-sm text-emerald-400 font-semibold">預金: 30秒 +0.1% ／ ローン: 30分 +0.1%</p>
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
              <div className="bg-gray-950/60 rounded-xl border border-gray-800 p-4 mb-5 text-xs grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-gray-400 font-bold mb-1">📈 信用度UP</p>
                  <p className="text-emerald-400">・1万G以上預金 <span className="text-white font-bold">+1</span></p>
                  <p className="text-emerald-400">・5万G以上預金 <span className="text-white font-bold">+3</span></p>
                  <p className="text-emerald-400">・ローン返済 <span className="text-white font-bold">+3</span></p>
                  <p className="text-emerald-400">・全額一括返済 <span className="text-white font-bold">+10</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-400 font-bold mb-1">📉 信用度DOWN</p>
                  <p className="text-red-400">・ローン借入 <span className="text-white font-bold">-5</span></p>
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
                  <button onClick={handleRepay} disabled={loanBalance <= 0} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-xl font-black transition active:scale-95 disabled:opacity-40">返済する（信用度UP）</button>
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center">※借入は30分毎0.1%利息。高額預金で信用度UP・借入で信用度DOWN</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== TRANSFER（送金履歴を統合） ===== */}
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
              <button onClick={handleTransfer} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black transition active:scale-95 text-lg flex items-center justify-center gap-2 mb-8">
                <Send size={20} /> 安全に送金を実行する
              </button>

              {/* 送受金履歴（統合） */}
              <div className="border-t border-gray-800 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <History size={16} className="text-blue-400" />
                  <span className="text-blue-400 font-black text-sm tracking-widest">送受金履歴</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {transferHistory.length === 0 ? (
                    <p className="text-gray-600 text-xs text-center py-6">履歴はまだありません</p>
                  ) : transferHistory.slice(0, 20).map((h, i) => (
                    <div key={i} className={`flex justify-between items-center text-xs p-2.5 rounded-lg ${h.type === 'SENT' ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                      <div>
                        <span className={`font-bold ${h.type === 'SENT' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {h.type === 'SENT' ? `→ ${h.to}` : `← ${h.from}`}
                        </span>
                        <span className="text-gray-600 ml-2">{formatTime(h.at)}</span>
                      </div>
                      <span className={`font-mono font-black ${h.type === 'SENT' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {h.type === 'SENT' ? '-' : '+'}{h.amount.toLocaleString()}G
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
// Component: Slot Machine（変更なし）
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
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / stopDelay, 1);
        const speed = progress < 0.7 ? 1 : Math.max(0.1, 1 - (progress - 0.7) / 0.3);
        if (Math.floor(now / (1000 / Math.max(speed * 60, 8))) % 2 === 0) {
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
    let totalMult = 0; const hitLines = [];
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
    setTimeout(() => { statusRef.current = 'IDLE'; setSlotStatus('IDLE'); setWinMessage(''); setWinLines([]); setJackpotFlash(false); if (autoRef.current) startSpin(); }, delay);
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
          {[...Array(20)].map((_, i) => <div key={i} className="absolute text-2xl animate-bounce" style={{ left: `${Math.random() * 90}%`, top: `${Math.random() * 90}%`, animationDelay: `${Math.random() * 0.5}s` }}>⭐</div>)}
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
              {winMessage}
              {winAmount > 0 && <div className="text-xl text-emerald-400 mt-1">+{winAmount.toLocaleString()} G</div>}
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
          <div className="flex gap-3 mt-2 justify-center">
            {[0, 1, 2].map(col => <div key={col} className={`h-1 flex-1 rounded-full transition-all duration-200 ${spinningCols[col] ? 'bg-yellow-400 animate-pulse' : 'bg-gray-800'}`}></div>)}
          </div>
        </div>
        {winLines.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {winLines.map((wl, i) => <span key={i} className={`text-sm font-bold px-3 py-1.5 rounded-full bg-gray-900 border border-gray-700 ${wl.color} shadow-lg`}>{wl.label} ×{wl.mult}</span>)}
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-950 p-5 rounded-xl border border-gray-800 gap-4">
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 font-bold text-sm">BET</span>
            <select value={bet} onChange={e => setBet(Number(e.target.value))} disabled={slotStatus !== 'IDLE'} className="bg-gray-900 text-yellow-500 font-mono text-lg p-3 rounded-lg border border-gray-800 outline-none font-bold disabled:opacity-60">
              {[10, 100, 500, 1000, 5000, 10000].map(v => <option key={v} value={v}>{v.toLocaleString()}G</option>)}
            </select>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={toggleAuto} className={`px-5 py-3 rounded-xl font-black transition active:scale-95 border text-sm ${autoSpin ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}>{autoSpin ? '🔄 AUTO' : 'AUTO'}</button>
            <button onClick={startSpin} disabled={slotStatus !== 'IDLE' || balance < bet} className="bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black py-3 px-10 rounded-full text-xl shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
              {slotStatus === 'SPINNING' ? <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> SPIN</span> : 'SPIN'}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 bg-gray-900/50 p-5 rounded-xl w-full border border-gray-800">
        <h3 className="text-gray-400 font-bold mb-3 text-center tracking-widest text-sm">PAYTABLE — 8ライン有効</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          {PAYTABLE.map((p, i) => (
            <div key={i} className="bg-black/50 p-2 rounded-lg text-center border border-gray-800">
              <div className="text-lg mb-1">{p.combo.join('')}</div>
              <div className={`font-black ${p.color}`}>×{p.mult}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Blackjack
// ==========================================
function BlackjackView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [bet, setBet] = useState(100);
  const [betInput, setBetInput] = useState('100');
  const [phase, setPhase] = useState('BET'); // BET | PLAYING | DEALER | RESULT
  const [result, setResult] = useState(''); // WIN | LOSE | PUSH | BLACKJACK
  const [dealerRevealed, setDealerRevealed] = useState(false);
  const [splitHands, setSplitHands] = useState(null);
  const [splitIndex, setSplitIndex] = useState(0);
  const [doubledDown, setDoubledDown] = useState(false);
  const [netWin, setNetWin] = useState(0);

  const freshDeck = () => createDeck(6);

  const drawCard = (d) => {
    const newDeck = [...d];
    const card = newDeck.pop();
    return { card, newDeck };
  };

  const startGame = async () => {
    const betAmt = parseInt(betInput);
    if (isNaN(betAmt) || betAmt <= 0) { showToast("有効なBET額を入力してください", 'error'); return; }
    if (balance < betAmt) { showToast("残高が足りません！", 'error'); return; }
    setBet(betAmt);
    await updateBalance(-betAmt);

    let d = freshDeck();
    let { card: p1, newDeck: d1 } = drawCard(d);
    let { card: de1, newDeck: d2 } = drawCard(d1);
    let { card: p2, newDeck: d3 } = drawCard(d2);
    let { card: de2, newDeck: d4 } = drawCard(d3);

    const pHand = [p1, p2];
    const dHand = [de1, de2];
    setDeck(d4);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setDealerRevealed(false);
    setSplitHands(null);
    setSplitIndex(0);
    setDoubledDown(false);
    setResult('');

    // ブラックジャック判定
    if (handTotal(pHand) === 21) {
      if (handTotal(dHand) === 21) {
        setDealerRevealed(true);
        setPhase('RESULT'); setResult('PUSH');
        await updateBalance(betAmt);
        setNetWin(w => w + 0);
        showToast("引き分け（PUSH）", 'info');
      } else {
        setDealerRevealed(true);
        setPhase('RESULT'); setResult('BLACKJACK');
        const win = Math.floor(betAmt * 2.5);
        await updateBalance(win);
        setNetWin(w => w + win - betAmt);
        showToast(`🃏 BLACKJACK! +${(win - betAmt).toLocaleString()} G！`, 'success');
        if (win >= 50000) emitNews(`🃏 ${playerName} がブラックジャックで ${win.toLocaleString()} G 獲得！`, 'jackpot');
      }
    } else {
      setPhase('PLAYING');
    }
  };

  const hit = async () => {
    let { card, newDeck } = drawCard(deck);
    setDeck(newDeck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    if (handTotal(newHand) > 21) {
      setDealerRevealed(true);
      setPhase('RESULT'); setResult('BUST');
      setNetWin(w => w - bet);
      showToast("バスト！負けです...", 'error');
    }
  };

  const stand = async () => {
    setDealerRevealed(true);
    setPhase('DEALER');
    // ディーラーのドロー
    let dHand = [...dealerHand];
    let d = [...deck];
    while (handTotal(dHand) < 17) {
      let { card, newDeck } = drawCard(d);
      dHand = [...dHand, card];
      d = newDeck;
    }
    setDeck(d);
    setDealerHand(dHand);

    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dHand);
    let res, payout = 0;

    if (dTotal > 21 || pTotal > dTotal) {
      res = 'WIN'; payout = bet * 2;
    } else if (pTotal === dTotal) {
      res = 'PUSH'; payout = bet;
    } else {
      res = 'LOSE'; payout = 0;
    }

    setResult(res);
    setPhase('RESULT');
    if (payout > 0) await updateBalance(payout);
    const profit = payout - bet;
    setNetWin(w => w + profit);
    if (res === 'WIN') showToast(`✅ 勝利！ +${bet.toLocaleString()} G！`, 'success');
    else if (res === 'PUSH') showToast("引き分け（PUSH）", 'info');
    else showToast("負けです...", 'error');
    if (payout >= 100000) emitNews(`🃏 ${playerName} がブラックジャックで ${payout.toLocaleString()} G 獲得！`, 'jackpot');
  };

  const doubleDown = async () => {
    if (balance < bet) { showToast("残高が足りません！", 'error'); return; }
    await updateBalance(-bet);
    setDoubledDown(true);
    let { card, newDeck } = drawCard(deck);
    setDeck(newDeck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);

    if (handTotal(newHand) > 21) {
      setDealerRevealed(true);
      setPhase('RESULT'); setResult('BUST');
      setNetWin(w => w - bet * 2);
      showToast("バスト！（ダブル）", 'error');
      return;
    }

    // スタンドと同じ処理
    setDealerRevealed(true);
    let dHand = [...dealerHand];
    let d = [...newDeck];
    while (handTotal(dHand) < 17) {
      let { card: dc, newDeck: nd } = drawCard(d);
      dHand = [...dHand, dc];
      d = nd;
    }
    setDeck(d);
    setDealerHand(dHand);

    const pTotal = handTotal(newHand);
    const dTotal = handTotal(dHand);
    let res, payout = 0;
    if (dTotal > 21 || pTotal > dTotal) { res = 'WIN'; payout = bet * 4; }
    else if (pTotal === dTotal) { res = 'PUSH'; payout = bet * 2; }
    else { res = 'LOSE'; payout = 0; }

    setResult(res);
    setPhase('RESULT');
    if (payout > 0) await updateBalance(payout);
    setNetWin(w => w + payout - bet * 2);
    if (res === 'WIN') showToast(`✅ ダブルダウン勝利！ +${(bet * 2).toLocaleString()} G！`, 'success');
    else if (res === 'PUSH') showToast("引き分け（PUSH）", 'info');
    else showToast("ダブルダウン負け...", 'error');
  };

  const pTotal = handTotal(playerHand);
  const dTotal = handTotal(dealerHand);
  const canDouble = phase === 'PLAYING' && playerHand.length === 2 && balance >= bet;

  const resultConfig = {
    BLACKJACK: { label: '🃏 BLACKJACK!', color: 'text-yellow-400', bg: 'border-yellow-500 bg-yellow-500/10' },
    WIN: { label: '✅ WIN!', color: 'text-emerald-400', bg: 'border-emerald-500 bg-emerald-500/10' },
    PUSH: { label: '🤝 PUSH', color: 'text-blue-400', bg: 'border-blue-500 bg-blue-500/10' },
    LOSE: { label: '❌ LOSE', color: 'text-red-400', bg: 'border-red-500 bg-red-500/10' },
    BUST: { label: '💥 BUST!', color: 'text-red-400', bg: 'border-red-500 bg-red-500/10' },
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${netWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netWin >= 0 ? '+' : ''}{netWin.toLocaleString()}</div></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-green-950 to-gray-950 rounded-3xl border border-green-900/50 shadow-2xl p-6">
        {/* ディーラー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">DEALER</span>
            {dealerRevealed && <span className="text-lg font-black text-white">{dTotal}</span>}
          </div>
          <div className="flex gap-2 flex-wrap min-h-24">
            {dealerHand.map((card, i) => (
              <PlayingCard key={i} card={card} hidden={!dealerRevealed && i === 1} />
            ))}
          </div>
        </div>

        {/* 区切り */}
        <div className="border-t border-green-900/50 mb-6"></div>

        {/* プレイヤー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">YOU</span>
            <span className={`text-lg font-black ${pTotal > 21 ? 'text-red-400' : pTotal === 21 ? 'text-yellow-400' : 'text-white'}`}>{pTotal}</span>
          </div>
          <div className="flex gap-2 flex-wrap min-h-24">
            {playerHand.map((card, i) => (
              <PlayingCard key={i} card={card} />
            ))}
          </div>
        </div>

        {/* 結果表示 */}
        {phase === 'RESULT' && result && resultConfig[result] && (
          <div className={`border-2 rounded-2xl p-6 text-center mb-6 ${resultConfig[result].bg}`}>
            <div className={`text-4xl font-black mb-2 ${resultConfig[result].color}`}>{resultConfig[result].label}</div>
            {result === 'BLACKJACK' && <div className="text-emerald-400 font-bold">BET × 1.5 獲得！</div>}
            {result === 'WIN' && <div className="text-emerald-400 font-bold">+{bet.toLocaleString()} G 獲得！</div>}
            {result === 'PUSH' && <div className="text-blue-300 font-bold">BETが返ってきました</div>}
            {(result === 'LOSE' || result === 'BUST') && <div className="text-red-300 font-bold">-{bet.toLocaleString()} G</div>}
          </div>
        )}

        {/* アクションパネル */}
        {phase === 'BET' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-bold text-sm shrink-0">BET額</span>
              <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)} className="flex-1 bg-gray-950 text-white font-mono text-xl p-3 rounded-xl border border-gray-800 focus:outline-none focus:border-green-500" min="10" />
              <div className="flex gap-1">
                {[100, 500, 1000, 5000].map(v => (
                  <button key={v} onClick={() => setBetInput(v.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1.5 rounded font-bold transition">{v >= 1000 ? v/1000+'k' : v}</button>
                ))}
              </div>
            </div>
            <button onClick={startGame} disabled={balance < parseInt(betInput || 0)} className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-black py-4 rounded-2xl text-xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
              ディール！
            </button>
          </div>
        )}

        {phase === 'PLAYING' && (
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={hit} className="flex-1 min-w-24 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-lg transition active:scale-95">
              HIT
            </button>
            <button onClick={stand} className="flex-1 min-w-24 bg-red-700 hover:bg-red-600 text-white font-black py-4 rounded-2xl text-lg transition active:scale-95">
              STAND
            </button>
            {canDouble && (
              <button onClick={doubleDown} className="flex-1 min-w-24 bg-yellow-600 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl text-lg transition active:scale-95">
                DOUBLE
              </button>
            )}
          </div>
        )}

        {phase === 'RESULT' && (
          <button onClick={() => setPhase('BET')} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-black py-4 rounded-2xl text-lg transition active:scale-95">
            次のゲームへ
          </button>
        )}
      </div>

      {/* ルール */}
      <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
        <p className="text-gray-300 font-bold mb-2">📖 ルール</p>
        <p>・21を超えずにディーラーより高い数字を目指す</p>
        <p>・ブラックジャック（A＋10点札）：BET × 1.5 ボーナス</p>
        <p>・ダブルダウン：最初の2枚のみ。BETを2倍にして1枚引く</p>
        <p>・ディーラーは17以上でスタンド</p>
      </div>
    </div>
  );
}

// ==========================================
// Component: Texas Poker
// ==========================================

// ポーカーハンド評価
function evaluateHand(cards) {
  // 5枚のベストハンドを評価（ホールデム：手札2枚＋コミュニティ5枚から5枚選ぶ）
  const allCombos = getCombinations(cards, 5);
  let best = null;
  for (const combo of allCombos) {
    const rank = rankHand(combo);
    if (!best || rank.score > best.score) best = rank;
  }
  return best;
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function rankHand(cards) {
  const ranks = cards.map(c => RANKS.indexOf(c.rank));
  const suits = cards.map(c => c.suit);
  const sortedRanks = [...ranks].sort((a, b) => b - a);

  const rankCounts = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = new Set(suits).size === 1;

  // Aを1として扱う（A-2-3-4-5のストレート）
  let isStraight = false;
  const uniqueRanks = [...new Set(sortedRanks)];
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) isStraight = true;
    // A-2-3-4-5
    if (JSON.stringify(uniqueRanks) === JSON.stringify([12, 3, 2, 1, 0])) isStraight = true;
  }

  const high = sortedRanks[0];

  if (isFlush && isStraight && high === 12 && sortedRanks[4] === 8) return { score: 9000000, label: 'ロイヤルフラッシュ 👑', tier: 9 };
  if (isFlush && isStraight) return { score: 8000000 + high, label: 'ストレートフラッシュ', tier: 8 };
  if (counts[0] === 4) return { score: 7000000 + high, label: 'フォーカード', tier: 7 };
  if (counts[0] === 3 && counts[1] === 2) return { score: 6000000 + high, label: 'フルハウス', tier: 6 };
  if (isFlush) return { score: 5000000 + high, label: 'フラッシュ', tier: 5 };
  if (isStraight) return { score: 4000000 + high, label: 'ストレート', tier: 4 };
  if (counts[0] === 3) return { score: 3000000 + high, label: 'スリーカード', tier: 3 };
  if (counts[0] === 2 && counts[1] === 2) return { score: 2000000 + high, label: 'ツーペア', tier: 2 };
  if (counts[0] === 2) return { score: 1000000 + high, label: 'ワンペア', tier: 1 };
  return { score: high, label: 'ハイカード', tier: 0 };
}

const POKER_PAYOUTS = [
  { tier: 9, label: 'ロイヤルフラッシュ', mult: 100 },
  { tier: 8, label: 'ストレートフラッシュ', mult: 50 },
  { tier: 7, label: 'フォーカード', mult: 20 },
  { tier: 6, label: 'フルハウス', mult: 10 },
  { tier: 5, label: 'フラッシュ', mult: 6 },
  { tier: 4, label: 'ストレート', mult: 4 },
  { tier: 3, label: 'スリーカード', mult: 3 },
  { tier: 2, label: 'ツーペア', mult: 2 },
  { tier: 1, label: 'ワンペア（J以上）', mult: 1 },
];

function TexasPokerView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [phase, setPhase] = useState('BET'); // BET | PREFLOP | FLOP | TURN | RIVER | SHOWDOWN
  const [deck, setDeck] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [community, setCommunity] = useState([]);
  const [bet, setBet] = useState(100);
  const [betInput, setBetInput] = useState('100');
  const [pot, setPot] = useState(0);
  const [playerResult, setPlayerResult] = useState(null);
  const [dealerResult, setDealerResult] = useState(null);
  const [gameResult, setGameResult] = useState(null); // WIN | LOSE | PUSH
  const [netWin, setNetWin] = useState(0);
  const [foldLoss, setFoldLoss] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [currentBetTotal, setCurrentBetTotal] = useState(0);

  const startGame = async () => {
    const betAmt = parseInt(betInput);
    if (isNaN(betAmt) || betAmt <= 0) { showToast("有効なBET額を入力", 'error'); return; }
    if (balance < betAmt * 2) { showToast("残高が足りません（アンティ＋コール分が必要）", 'error'); return; }
    setBet(betAmt);
    await updateBalance(-betAmt); // アンティ
    setPot(betAmt);
    setCurrentBetTotal(betAmt);
    setGameResult(null);
    setPlayerResult(null);
    setDealerResult(null);
    setFoldLoss(false);
    setRaiseAmount(0);

    let d = createDeck(1);
    const pCards = [d.pop(), d.pop()];
    const dCards = [d.pop(), d.pop()];
    setDeck(d);
    setPlayerCards(pCards);
    setDealerCards(dCards);
    setCommunity([]);
    setPhase('PREFLOP');
  };

  const dealFlop = async (extraBet = 0) => {
    if (extraBet > 0) {
      if (balance < extraBet) { showToast("残高が足りません！", 'error'); return; }
      await updateBalance(-extraBet);
      setPot(p => p + extraBet);
      setCurrentBetTotal(t => t + extraBet);
    }
    let d = [...deck];
    const flop = [d.pop(), d.pop(), d.pop()];
    setDeck(d);
    setCommunity(flop);
    setPhase('FLOP');
  };

  const dealTurn = async (extraBet = 0) => {
    if (extraBet > 0) {
      if (balance < extraBet) { showToast("残高が足りません！", 'error'); return; }
      await updateBalance(-extraBet);
      setPot(p => p + extraBet);
      setCurrentBetTotal(t => t + extraBet);
    }
    let d = [...deck];
    const turn = d.pop();
    setDeck(d);
    setCommunity(c => [...c, turn]);
    setPhase('TURN');
  };

  const dealRiver = async (extraBet = 0) => {
    if (extraBet > 0) {
      if (balance < extraBet) { showToast("残高が足りません！", 'error'); return; }
      await updateBalance(-extraBet);
      setPot(p => p + extraBet);
      setCurrentBetTotal(t => t + extraBet);
    }
    let d = [...deck];
    const river = d.pop();
    setDeck(d);
    const newCommunity = [...community, river];
    setCommunity(newCommunity);
    setPhase('RIVER');
  };

  const showdown = async (extraBet = 0) => {
    let finalPot = pot;
    if (extraBet > 0) {
      if (balance < extraBet) { showToast("残高が足りません！", 'error'); return; }
      await updateBalance(-extraBet);
      finalPot = pot + extraBet;
      setPot(finalPot);
    }

    const allCommunity = community.length < 5 ? [...community, ...Array(5 - community.length).fill(null)].filter(Boolean) : community;

    // リバーが来ていない場合は最後まで展開
    let d = [...deck];
    let finalCommunity = [...community];
    while (finalCommunity.length < 5) {
      finalCommunity.push(d.pop());
    }
    setDeck(d);
    setCommunity(finalCommunity);

    const pHand = evaluateHand([...playerCards, ...finalCommunity]);
    const dHand = evaluateHand([...dealerCards, ...finalCommunity]);
    setPlayerResult(pHand);
    setDealerResult(dHand);

    let res, payout = 0;
    if (pHand.score > dHand.score) {
      res = 'WIN'; payout = finalPot * 2;
    } else if (pHand.score === dHand.score) {
      res = 'PUSH'; payout = finalPot;
    } else {
      res = 'LOSE'; payout = 0;
    }

    setGameResult(res);
    setPhase('SHOWDOWN');
    if (payout > 0) await updateBalance(payout);
    const profit = payout - finalPot;
    setNetWin(w => w + profit);

    if (res === 'WIN') showToast(`✅ 勝利！ +${(finalPot).toLocaleString()} G！`, 'success');
    else if (res === 'PUSH') showToast("引き分け", 'info');
    else showToast("負けです...", 'error');
    if (payout >= 100000) emitNews(`♠️ ${playerName} がテキサスポーカーで ${payout.toLocaleString()} G 獲得！`, 'jackpot');
  };

  const fold = () => {
    setFoldLoss(true);
    setPhase('SHOWDOWN');
    setGameResult('FOLD');
    setNetWin(w => w - currentBetTotal);
    showToast(`フォールド。-${currentBetTotal.toLocaleString()} G`, 'warning');
  };

  const phaseLabel = { PREFLOP: 'プリフロップ', FLOP: 'フロップ', TURN: 'ターン', RIVER: 'リバー', SHOWDOWN: 'ショーダウン' };

  const betOptions = [bet, bet * 2];
  const callAmount = bet;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${netWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netWin >= 0 ? '+' : ''}{netWin.toLocaleString()}</div></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-red-950 to-gray-950 rounded-3xl border border-red-900/30 shadow-2xl p-6">

        {/* フェーズ表示 */}
        {phase !== 'BET' && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'].map(p => (
                <div key={p} className={`text-xs px-2 py-1 rounded font-bold transition-all ${phase === p ? 'bg-red-700 text-white' : ['PREFLOP','FLOP','TURN','RIVER','SHOWDOWN'].indexOf(p) < ['PREFLOP','FLOP','TURN','RIVER','SHOWDOWN'].indexOf(phase) ? 'bg-gray-800 text-gray-400' : 'bg-gray-900 text-gray-600'}`}>
                  {phaseLabel[p] || p}
                </div>
              ))}
            </div>
            <div className="text-yellow-400 font-black">POT: {pot.toLocaleString()} G</div>
          </div>
        )}

        {/* ディーラーハンド（ショーダウン時のみ表示） */}
        {phase !== 'BET' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">DEALER</span>
              {phase === 'SHOWDOWN' && dealerResult && (
                <span className={`text-sm font-black px-2 py-1 rounded ${gameResult === 'LOSE' ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 bg-gray-800'}`}>{dealerResult.label}</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {dealerCards.map((card, i) => (
                <PlayingCard key={i} card={card} hidden={phase !== 'SHOWDOWN' && !foldLoss} />
              ))}
            </div>
          </div>
        )}

        {/* コミュニティカード */}
        {community.length > 0 && (
          <div className="mb-4">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest block mb-2">COMMUNITY</span>
            <div className="flex gap-2 flex-wrap">
              {community.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </div>
        )}

        {/* 区切り */}
        {phase !== 'BET' && <div className="border-t border-red-900/30 mb-4"></div>}

        {/* プレイヤーハンド */}
        {phase !== 'BET' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">YOU</span>
              {phase === 'SHOWDOWN' && playerResult && (
                <span className={`text-sm font-black px-2 py-1 rounded ${gameResult === 'WIN' ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-400 bg-gray-800'}`}>{playerResult.label}</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {playerCards.map((card, i) => <PlayingCard key={i} card={card} />)}
            </div>
          </div>
        )}

        {/* 結果 */}
        {phase === 'SHOWDOWN' && (
          <div className={`border-2 rounded-2xl p-5 text-center mb-5 ${gameResult === 'WIN' ? 'border-yellow-500 bg-yellow-500/10' : gameResult === 'PUSH' ? 'border-blue-500 bg-blue-500/10' : 'border-red-500 bg-red-500/10'}`}>
            {gameResult === 'FOLD' ? (
              <div className="text-red-400 text-3xl font-black">🏳️ フォールド</div>
            ) : (
              <>
                <div className={`text-4xl font-black mb-1 ${gameResult === 'WIN' ? 'text-yellow-400' : gameResult === 'PUSH' ? 'text-blue-400' : 'text-red-400'}`}>
                  {gameResult === 'WIN' ? '🏆 WIN!' : gameResult === 'PUSH' ? '🤝 PUSH' : '❌ LOSE'}
                </div>
                {gameResult === 'WIN' && <div className="text-emerald-400 font-bold">+{pot.toLocaleString()} G 獲得！</div>}
                {gameResult === 'PUSH' && <div className="text-blue-300 font-bold">BETが返ってきました</div>}
                {gameResult === 'LOSE' && <div className="text-red-300 font-bold">-{pot.toLocaleString()} G</div>}
              </>
            )}
          </div>
        )}

        {/* アクションパネル */}
        {phase === 'BET' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-bold text-sm shrink-0">アンティ</span>
              <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)} className="flex-1 bg-gray-950 text-white font-mono text-xl p-3 rounded-xl border border-gray-800 focus:outline-none focus:border-red-500" min="10" />
              <div className="flex gap-1">
                {[100, 500, 1000, 5000].map(v => (
                  <button key={v} onClick={() => setBetInput(v.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1.5 rounded font-bold transition">{v >= 1000 ? v/1000+'k' : v}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">※アンティを払ってゲーム開始。各ストリートでコール/レイズ/フォールドを選択</p>
            <button onClick={startGame} disabled={balance < parseInt(betInput || 0)} className="w-full bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white font-black py-4 rounded-2xl text-xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
              ♠️ ゲーム開始
            </button>
          </div>
        )}

        {phase === 'PREFLOP' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm">フロップを見る？</p>
            <div className="flex gap-3">
              <button onClick={() => dealFlop(bet)} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                コール ({bet.toLocaleString()} G)
              </button>
              <button onClick={() => dealFlop(bet * 2)} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 rounded-xl transition active:scale-95">
                レイズ ({(bet * 2).toLocaleString()} G)
              </button>
              <button onClick={fold} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                フォールド
              </button>
            </div>
          </div>
        )}

        {phase === 'FLOP' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm">ターンを見る？</p>
            <div className="flex gap-3">
              <button onClick={() => dealTurn(0)} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                チェック (無料)
              </button>
              <button onClick={() => dealTurn(bet)} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                ベット ({bet.toLocaleString()} G)
              </button>
              <button onClick={fold} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                フォールド
              </button>
            </div>
          </div>
        )}

        {phase === 'TURN' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm">リバーを見る？</p>
            <div className="flex gap-3">
              <button onClick={() => dealRiver(0)} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                チェック (無料)
              </button>
              <button onClick={() => dealRiver(bet)} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                ベット ({bet.toLocaleString()} G)
              </button>
              <button onClick={fold} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                フォールド
              </button>
            </div>
          </div>
        )}

        {phase === 'RIVER' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm">ショーダウン！</p>
            <div className="flex gap-3">
              <button onClick={() => showdown(0)} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition active:scale-95">
                チェック → ショーダウン
              </button>
              <button onClick={() => showdown(bet)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl transition active:scale-95">
                最後にベット ({bet.toLocaleString()} G)
              </button>
              <button onClick={fold} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-black py-3 rounded-xl transition active:scale-95">
                フォールド
              </button>
            </div>
          </div>
        )}

        {phase === 'SHOWDOWN' && (
          <button onClick={() => { setPhase('BET'); setCommunity([]); setPlayerCards([]); setDealerCards([]); setPot(0); setCurrentBetTotal(0); }} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-black py-4 rounded-2xl text-lg transition active:scale-95">
            次のゲームへ
          </button>
        )}
      </div>

      {/* ペイアウト表 */}
      <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
        <p className="text-gray-300 font-bold text-sm mb-3">📖 ハンドランク</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {[
            { label: 'ロイヤルフラッシュ 👑', sub: '最強の一手' },
            { label: 'ストレートフラッシュ', sub: '同スーツの連番5枚' },
            { label: 'フォーカード', sub: '同ランク4枚' },
            { label: 'フルハウス', sub: 'スリー＋ペア' },
            { label: 'フラッシュ', sub: '同スーツ5枚' },
            { label: 'ストレート', sub: '連番5枚' },
            { label: 'スリーカード', sub: '同ランク3枚' },
            { label: 'ツーペア', sub: 'ペア×2' },
            { label: 'ワンペア', sub: '同ランク2枚' },
            { label: 'ハイカード', sub: '役なし' },
          ].map((h, i) => (
            <div key={i} className="bg-gray-950/50 p-2 rounded-lg border border-gray-800">
              <div className="text-gray-200 font-bold">{h.label}</div>
              <div className="text-gray-500">{h.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Horse Racing（変更なし）
// ==========================================
function HorseRacing({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
  const [horses, setHorses] = useState(INITIAL_HORSES.map(h => ({...h, position: 0, speed: 0, stamina: 100})));
  const [selectedHorse, setSelectedHorse] = useState(null);
  const [betType, setBetType] = useState('WIN');
  const [raceBet, setRaceBet] = useState(100);
  const [isRacing, setIsRacing] = useState(false);
  const [racePhase, setRacePhase] = useState('BETTING');
  const [countdown, setCountdown] = useState(3);
  const [raceResult, setRaceResult] = useState(null);
  const [finishOrder, setFinishOrder] = useState([]);
  const [weather, setWeather] = useState('晴れ');
  const [trackCondition, setTrackCondition] = useState('良');
  const [commentary, setCommentary] = useState('馬を選んでベットしてください');
  const frameRef = useRef(null);
  const BET_TYPES = { WIN: { label: '単勝', desc: '1着的中', mult: (h) => h.odds }, PLACE: { label: '複勝', desc: '3着以内', mult: (h) => h.odds * 0.4 }, SHOW: { label: '馬連', desc: '2着以内', mult: (h) => h.odds * 0.6 } };
  const WEATHERS = ['晴れ', '曇り', '雨', '霧'];
  const TRACK_CONDITIONS = {'晴れ': '良', '曇り': '稍重', '雨': '重', '霧': '不良'};
  const conditionColor = {'良': 'text-emerald-400', '稍重': 'text-yellow-400', '重': 'text-orange-400', '不良': 'text-red-400'};
  const startRace = async () => {
    if (!selectedHorse) { showToast("予想する馬を選択してください", 'error'); return; }
    if (balance < raceBet) { showToast("残高が足りません！", 'error'); return; }
    const nw = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    setWeather(nw); setTrackCondition(TRACK_CONDITIONS[nw]);
    await updateBalance(-raceBet);
    setRacePhase('COUNTDOWN'); setCountdown(3); setFinishOrder([]); setRaceResult(null);
    setHorses(INITIAL_HORSES.map(h => ({...h, position: 0, speed: 0, stamina: 100 + Math.random() * 20})));
  };
  useEffect(() => {
    if (racePhase !== 'COUNTDOWN') return;
    if (countdown <= 0) { setRacePhase('RACING'); setIsRacing(true); setCommentary('各馬一斉にスタート！'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [racePhase, countdown]);
  useEffect(() => {
    if (!isRacing) return;
    let cur = horses.map(h => ({...h}));
    let finished = [];
    const loop = () => {
      const prog = cur[0]?.position || 0;
      cur = cur.map(horse => {
        if (horse.position >= 100) return horse;
        const oddsFactor = 2.5 / horse.odds;
        const stFactor = horse.stamina / 100;
        const wpFactor = horse.condition === trackCondition ? 1.05 : trackCondition === '重' ? 0.85 : 0.95;
        const spurt = prog > 70 && Math.random() > 0.95 ? Math.random() * 1.5 : 0;
        const move = (0.5 + Math.random() * 0.6) * oddsFactor * stFactor * wpFactor + spurt;
        const newPos = Math.min(100, horse.position + move);
        const newSt = Math.max(0, horse.stamina - 0.3 - (spurt > 0 ? 2 : 0));
        if (newPos >= 100 && !finished.find(f => f.id === horse.id)) finished.push({...horse, position: 100});
        return {...horse, position: newPos, stamina: newSt, speed: move};
      });
      setHorses([...cur]);
      const leader = [...cur].sort((a, b) => b.position - a.position)[0];
      if (leader) {
        const p = leader.position;
        if (p < 20) setCommentary(`スタート！${leader.name}が先手を取る！`);
        else if (p < 40) setCommentary(`${leader.name}が先頭！後続を引き離す！`);
        else if (p < 60) setCommentary(`レース中盤！${leader.name}をマークする各馬！`);
        else if (p < 80) setCommentary(`残り400m！追い込み勢が動き出した！`);
        else setCommentary(`最終直線！${leader.name}が粘る！差し馬が猛追！`);
      }
      if (finished.length >= INITIAL_HORSES.length || cur.every(h => h.position >= 100)) {
        setIsRacing(false); setRacePhase('RESULT');
        const order = [...cur].sort((a, b) => b.position - a.position);
        setFinishOrder(order); setRaceResult(order[0]);
        const sel = INITIAL_HORSES.find(h => h.id === selectedHorse);
        let won = false;
        if (betType === 'WIN' && order[0].id === selectedHorse) won = true;
        if (betType === 'PLACE' && order.slice(0, 3).find(h => h.id === selectedHorse)) won = true;
        if (betType === 'SHOW' && order.slice(0, 2).find(h => h.id === selectedHorse)) won = true;
        if (won && sel) {
          const wa = Math.floor(raceBet * BET_TYPES[betType].mult(sel));
          updateBalance(wa);
          if (wa >= 100000) emitNews(`🏇 ${playerName} が競馬で大勝ち！ ${wa.toLocaleString()} G 獲得！`, 'jackpot');
          setCommentary(`🎉 的中！${wa.toLocaleString()} G 獲得！`);
        } else setCommentary(`😢 残念...ハズレ`);
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isRacing]);
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={onBack} disabled={isRacing} className="flex items-center gap-2 text-gray-400 hover:text-white transition disabled:opacity-50"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-sm font-bold text-gray-400">{weather} / <span className={conditionColor[trackCondition] || 'text-white'}>{trackCondition}</span></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
          <h3 className="text-lg font-bold mb-2 text-white border-b border-gray-700 pb-2">📋 出馬表</h3>
          <div className="bg-gray-950 rounded-xl p-3 mb-3 text-xs grid grid-cols-2 gap-1">
            <div>天候: <span className="text-white font-bold">{weather}</span></div>
            <div>馬場: <span className={`font-bold ${conditionColor[trackCondition]}`}>{trackCondition}</span></div>
          </div>
          <div className="flex gap-1 mb-3">
            {Object.entries(BET_TYPES).map(([key, val]) => (
              <button key={key} onClick={() => !isRacing && setBetType(key)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${betType === key ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>{val.label}</button>
            ))}
          </div>
          <div className="space-y-2 mb-4">
            {INITIAL_HORSES.map(h => (
              <button key={h.id} onClick={() => !isRacing && setSelectedHorse(h.id)} disabled={isRacing} className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition-all border-2 text-left text-sm ${selectedHorse === h.id ? 'border-yellow-500 bg-gray-800' : 'border-transparent hover:bg-gray-800 bg-gray-950/50'}`}>
                <span className="w-7 h-7 flex justify-center items-center rounded-lg text-xs font-black flex-shrink-0" style={{backgroundColor: h.color, color: h.textColor}}>{h.id}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{h.name}</div>
                  <div className="text-gray-500 text-xs">{h.jockey}/{h.weight}kg</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-yellow-400 font-bold">{h.odds.toFixed(1)}</div>
                  <div className={`text-xs ${conditionColor[h.condition] || 'text-white'}`}>{h.condition}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <label className="block text-xs text-gray-400 font-bold mb-2">BET額 — {BET_TYPES[betType].desc}</label>
            <input type="number" value={raceBet} onChange={e => setRaceBet(Number(e.target.value))} className="w-full bg-gray-900 text-white font-mono text-lg p-3 rounded-lg border border-gray-800 focus:border-yellow-500 outline-none mb-2" min="10" step="10" disabled={isRacing} />
            {selectedHorse && <div className="text-xs text-gray-400 mb-3 text-center">的中時: <span className="text-yellow-400 font-bold">{Math.floor(raceBet * BET_TYPES[betType].mult(INITIAL_HORSES.find(h => h.id === selectedHorse))).toLocaleString()} G</span></div>}
            <button onClick={startRace} disabled={isRacing || !selectedHorse || balance < raceBet} className="w-full bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black py-3 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
              {racePhase === 'COUNTDOWN' ? `${countdown}秒後スタート` : isRacing ? 'レース中...' : '出走する'}
            </button>
          </div>
        </div>
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-gradient-to-b from-emerald-800 via-green-700 to-emerald-900 rounded-2xl relative overflow-hidden border-4 border-gray-800 shadow-2xl" style={{height: '520px'}}>
            <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(0,0,0,0.3) 60px,rgba(0,0,0,0.3) 62px)'}}></div>
            <div className="absolute right-[5%] top-0 bottom-0 w-6 z-10" style={{background: 'repeating-linear-gradient(0deg,white 0px,white 10px,black 10px,black 20px)'}}>
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded whitespace-nowrap">GOAL</div>
            </div>
            <div className="absolute left-[3%] top-0 bottom-0 w-1 bg-white/50 z-10"></div>
            {racePhase === 'COUNTDOWN' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
                <div className="text-9xl font-black text-white animate-bounce drop-shadow-lg">{countdown || 'GO!'}</div>
              </div>
            )}
            {horses.map((h, idx) => {
              const laneH = 520 / INITIAL_HORSES.length, y = idx * laneH + laneH / 2 - 24, x = Math.min(h.position, 93);
              const isSel = h.id === selectedHorse;
              return (
                <div key={h.id} className="absolute flex items-center transition-all duration-75 ease-linear z-10" style={{left: `${x}%`, top: `${y}px`}}>
                  <div className="flex flex-col items-center">
                    <div className={`text-3xl drop-shadow-lg ${isRacing && isSel ? 'animate-bounce' : ''}`}>🐎</div>
                    <div className="w-6 h-6 -mt-1 flex justify-center items-center rounded-full text-xs font-black shadow-xl border-2 border-gray-800" style={{backgroundColor: h.color, color: h.textColor}}>{h.id}</div>
                    {isSel && <div className="text-yellow-400 text-xs font-black">▲</div>}
                  </div>
                </div>
              );
            })}
            {isRacing && (
              <div className="absolute bottom-2 left-4 right-4 space-y-0.5">
                {horses.map(h => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="text-white text-xs font-bold w-4">{h.id}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width: `${h.stamina}%`, backgroundColor: h.stamina > 60 ? '#22c55e' : h.stamina > 30 ? '#eab308' : '#ef4444'}}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            {racePhase === 'RESULT' && finishOrder.length > 0 ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-2xl font-black text-white">レース結果</h3>
                  {finishOrder[0].id === selectedHorse && betType === 'WIN' && <span className="bg-yellow-500 text-black text-sm font-black px-3 py-1 rounded-full animate-pulse">🎉 的中！</span>}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {finishOrder.slice(0, 4).map((h, i) => {
                    const medals = ['🥇', '🥈', '🥉', '4️⃣']; const isWin = h.id === selectedHorse;
                    return (
                      <div key={h.id} className={`p-3 rounded-xl text-center border ${isWin ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-950'}`}>
                        <div className="text-2xl">{medals[i]}</div>
                        <div className="w-8 h-8 mx-auto my-1 flex justify-center items-center rounded-full text-xs font-black" style={{backgroundColor: h.color, color: h.textColor}}>{h.id}</div>
                        <div className="text-xs text-white font-bold truncate">{h.name}</div>
                        <div className="text-xs text-yellow-400">{h.odds.toFixed(1)}倍</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center text-lg font-bold mt-4 text-white">{commentary}</p>
                <button onClick={() => { setRacePhase('BETTING'); setSelectedHorse(null); }} className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">次のレースへ</button>
              </div>
            ) : (
              <p className="text-xl font-bold text-white text-center animate-pulse">{commentary}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Labor（変更なし）
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
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { handleAnswer(''); return 10; } return t - 1; });
    }, 1000);
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
            <p className="text-gray-400">日本語を見て英単語を入力しよう！<br/>全問正解でボーナス報酬×1.5！</p>
          </div>
          <div className="space-y-4">
            {WORD_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startQuiz(i)} className={`w-full p-6 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] hover:-translate-y-1 ${lv.bg}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className={`text-2xl font-black ${lv.color}`}>{lv.label}</span>
                    <p className="text-gray-400 text-sm mt-1">全{QUIZ_COUNT}問 / 1問ずつ10秒制限</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-black ${lv.color}`}>最大 {Math.floor(lv.reward * 1.5).toLocaleString()} G</div>
                    <div className="text-gray-500 text-xs">全問正解ボーナス含む</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-6">※報酬は正解数に比例します。参加費無料！</p>
        </div>
      )}
      {phase === 'QUIZ' && q && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 font-bold">{currentQ + 1} / {QUIZ_COUNT}問</span>
            <span className={`text-2xl font-black ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>⏱ {timeLeft}秒</span>
            <span className={`text-sm font-bold ${WORD_LEVELS[level].color}`}>{WORD_LEVELS[level].label}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 mb-8">
            <div className="h-2 rounded-full bg-yellow-500 transition-all" style={{width: `${(currentQ / QUIZ_COUNT) * 100}%`}}></div>
          </div>
          <div className={`bg-gray-900 p-10 rounded-3xl border-2 text-center mb-6 transition-all ${feedback === 'correct' ? 'border-emerald-500 bg-emerald-500/10' : feedback === 'wrong' ? 'border-red-500 bg-red-500/10' : 'border-gray-800'}`}>
            <p className="text-gray-400 text-sm font-bold mb-3 tracking-widest">日本語 → 英語</p>
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
            <p className="text-gray-400 mb-6">{WORD_LEVELS[level].label} / {QUIZ_COUNT}問中</p>
            <div className="text-7xl font-black text-yellow-400 mb-2">{score}<span className="text-3xl text-gray-400">/{QUIZ_COUNT}</span></div>
            {score === QUIZ_COUNT && <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-3 mb-4 text-yellow-400 font-bold">🎉 全問正解ボーナス×1.5適用！</div>}
            <div className="text-4xl font-black text-emerald-400">+{totalEarned.toLocaleString()} G</div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setPhase('SELECT')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition">レベル選択に戻る</button>
            <button onClick={() => startQuiz(level)} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-xl font-black transition">もう一度！</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: Mining（変更なし）
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
  const [startTime, setStartTime] = useState(null);
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
    const queue = [[row, col]];
    const visited = new Set();
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      const idx = r * cols + c;
      if (visited.has(idx)) continue;
      visited.add(idx);
      revealedArr[idx] = true;
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
    setBoard([]);
    setRevealed(Array(lvl.rows * lvl.cols).fill(false));
    setFlagged(Array(lvl.rows * lvl.cols).fill(false));
    setGameResult(null); setExplodedCell(null); setSafeCells(0);
    setTotalSafe(lvl.rows * lvl.cols - lvl.mines);
    setStartTime(Date.now()); setElapsedTime(0);
    setPhase('PLAYING');
    showToast(`${lvl.label} 開始！参加費 -${lvl.cost.toLocaleString()} G`, 'warning');
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
    if (board.length === 0) {
      currentBoard = generateBoard(lvl.rows, lvl.cols, lvl.mines, row, col);
      setBoard(currentBoard);
    }
    if (currentBoard[idx] === -1) {
      clearInterval(timerRef.current);
      const newRevealed = [...revealed]; newRevealed[idx] = true;
      setRevealed(newRevealed); setExplodedCell(idx); setGameResult('LOSE'); setPhase('RESULT');
      showToast('💥 爆発！報酬没収！', 'error');
      emitNews(`💥 ${playerName} が${lvl.label}で爆発！報酬没収...`, 'loss');
      return;
    }
    let newRevealed = [...revealed];
    newRevealed = expandEmpty(currentBoard, newRevealed, row, col, lvl.rows, lvl.cols);
    setRevealed(newRevealed);
    const newSafe = newRevealed.filter(Boolean).length;
    setSafeCells(newSafe);
    if (newSafe >= totalSafe) {
      clearInterval(timerRef.current);
      const reward = lvl.reward;
      await updateBalance(reward);
      setGameResult('WIN'); setPhase('RESULT');
      showToast(`⛏️ 採掘成功！+${reward.toLocaleString()} G！`, 'success');
      if (reward >= 100000) emitNews(`⛏️ ${playerName} が${lvl.label}を完全クリア！${reward.toLocaleString()} G 獲得！`, 'mining');
      else emitNews(`⛏️ ${playerName} が${lvl.label}の採掘に成功！${reward.toLocaleString()} G 獲得！`, 'mining');
    }
  };

  const handleRightClick = (e, row, col) => {
    e.preventDefault();
    if (phase !== 'PLAYING' || gameResult) return;
    const lvl = MINE_LEVELS[selectedLevel];
    const idx = row * lvl.cols + col;
    if (revealed[idx]) return;
    const newFlagged = [...flagged]; newFlagged[idx] = !newFlagged[idx];
    setFlagged(newFlagged);
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
            <p className="text-gray-400">地雷を避けながら安全なマスを掘り進めよう！<br/>爆発すると報酬は没収されます。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MINE_LEVELS.map((lv, i) => (
              <button key={i} onClick={() => startGame(i)} disabled={balance < lv.cost}
                className={`p-6 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] hover:-translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed ${lv.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{lv.icon}</span>
                  <div>
                    <span className={`text-xl font-black ${lv.color}`}>{lv.label}</span>
                    <div className="text-gray-500 text-xs">{lv.rows}×{lv.cols}マス / 地雷{lv.mines}個</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div><div className="text-gray-400 text-xs">参加費</div><div className="text-red-400 font-black text-lg">-{lv.cost.toLocaleString()} G</div></div>
                  <div className="text-right"><div className="text-gray-400 text-xs">クリア報酬</div><div className={`font-black text-2xl ${lv.color}`}>+{lv.reward.toLocaleString()} G</div></div>
                </div>
                <div className="mt-3 w-full bg-gray-900/50 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-current opacity-30" style={{width: `${(lv.mines / (lv.rows * lv.cols)) * 100}%`}}></div>
                </div>
                <div className="text-xs text-gray-600 mt-1">地雷密度 {Math.round((lv.mines / (lv.rows * lv.cols)) * 100)}%</div>
              </button>
            ))}
          </div>
          <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p className="text-gray-300 font-bold mb-2">📖 遊び方</p>
            <p>・マスをクリックして掘り進めます。数字は周囲の地雷数。</p>
            <p>・右クリック（長押し）でフラグを立てられます。</p>
            <p>・全ての安全なマスを開けるとクリア！報酬を獲得。</p>
            <p>・地雷を踏むと即爆発！参加費も報酬も没収されます。</p>
          </div>
        </div>
      )}

      {phase === 'PLAYING' && lvl && (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1"><span>採掘進捗</span><span>{Math.round(progress)}%</span></div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{width: `${progress}%`}}></div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-2xl overflow-auto max-w-full">
            <div style={{display: 'grid', gridTemplateColumns: `repeat(${lvl.cols}, 1fr)`, gap: '2px'}}>
              {Array(lvl.rows * lvl.cols).fill(0).map((_, idx) => {
                const row = Math.floor(idx / lvl.cols); const col = idx % lvl.cols;
                const isRevealed = revealed[idx]; const isFlagged = flagged[idx];
                const isMine = board.length > 0 && board[idx] === -1;
                const isExploded = idx === explodedCell;
                const num = board.length > 0 ? board[idx] : 0;
                return (
                  <button key={idx} onClick={() => handleCellClick(row, col)} onContextMenu={(e) => handleRightClick(e, row, col)}
                    className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-xs md:text-sm font-black rounded transition-all select-none
                      ${isExploded ? 'bg-red-600 text-white scale-110 z-10 relative' : ''}
                      ${isRevealed && !isExploded ? isMine ? 'bg-red-900/40 text-red-500' : 'bg-gray-800 text-gray-200 border border-gray-700' : !isRevealed ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 cursor-pointer' : ''}`}
                    style={{ minWidth: '2rem' }}>
                    {isExploded ? '💥' : isFlagged && !isRevealed ? '🚩' : isRevealed && isMine ? '💣' : isRevealed && num > 0 ? <span className={numberColors[num]}>{num}</span> : isRevealed ? '' : ''}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">右クリック（モバイルは長押し）でフラグ設置 ／ フラグ残り {lvl.mines - flagged.filter(Boolean).length} 個</div>
        </div>
      )}

      {phase === 'RESULT' && lvl && (
        <div className="text-center max-w-md mx-auto">
          <div className={`p-10 rounded-3xl border shadow-2xl mb-6 ${gameResult === 'WIN' ? 'bg-amber-500/10 border-amber-500' : 'bg-red-500/10 border-red-500'}`}>
            <div className="text-7xl mb-4">{gameResult === 'WIN' ? '⛏️' : '💥'}</div>
            <h3 className={`text-4xl font-black mb-2 ${gameResult === 'WIN' ? 'text-amber-400' : 'text-red-400'}`}>{gameResult === 'WIN' ? '採掘成功！' : '爆発！！'}</h3>
            <p className="text-gray-400 mb-4">{lvl.label} / {elapsedTime}秒</p>
            {gameResult === 'WIN' && <div><div className="text-5xl font-black text-emerald-400 mb-2">+{lvl.reward.toLocaleString()} G</div><p className="text-gray-400 text-sm">採掘報酬を獲得しました！</p></div>}
            {gameResult === 'LOSE' && <div><div className="text-3xl font-black text-red-400 mb-2">参加費 {lvl.cost.toLocaleString()} G 没収</div><p className="text-gray-400 text-sm">地雷を踏んでしまいました...</p></div>}
          </div>
          {board.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 mb-6 overflow-auto">
              <p className="text-xs text-gray-500 mb-2">地雷の場所</p>
              <div style={{display: 'grid', gridTemplateColumns: `repeat(${lvl.cols}, 1fr)`, gap: '2px'}}>
                {board.map((cell, idx) => {
                  const isExploded = idx === explodedCell; const isRev = revealed[idx];
                  return (
                    <div key={idx} className={`w-7 h-7 flex items-center justify-center text-xs font-black rounded ${isExploded ? 'bg-red-600' : cell === -1 ? 'bg-gray-800 text-red-400' : isRev ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 text-gray-500'}`}>
                      {isExploded ? '💥' : cell === -1 ? '💣' : isRev && cell > 0 ? cell : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={() => { setPhase('SELECT'); setSelectedLevel(null); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition">レベル選択へ</button>
            <button onClick={() => startGame(selectedLevel)} disabled={balance < lvl.cost} className={`flex-1 text-white py-4 rounded-xl font-black transition disabled:opacity-40 ${gameResult === 'WIN' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-700 hover:bg-red-600'}`}>
              {gameResult === 'WIN' ? 'もう一度！' : 'リベンジ！'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}