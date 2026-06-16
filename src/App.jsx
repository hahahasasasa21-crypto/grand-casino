import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { firebaseConfig, appId } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Constants ---
const SYMBOLS = [
  { sym: '🍒', name: 'CHERRY', color: 'text-red-500' },
  { sym: '🍋', name: 'LEMON', color: 'text-yellow-400' },
  { sym: '🍊', name: 'ORANGE', color: 'text-orange-400' },
  { sym: '🍇', name: 'GRAPE', color: 'text-purple-500' },
  { sym: '🔔', name: 'BELL', color: 'text-yellow-300' },
  { sym: '🍉', name: 'MELON', color: 'text-green-400' },
  { sym: '💎', name: 'DIAMOND', color: 'text-blue-400' },
  { sym: 'BAR', name: 'BAR', color: 'text-gray-300' },
  { sym: '7️⃣', name: 'SEVEN', color: 'text-red-600' },
];

const PAYTABLE = [
  { combo: ['7️⃣','7️⃣','7️⃣'], mult: 100, label: 'JACKPOT!!!', color: 'text-red-400' },
  { combo: ['BAR','BAR','BAR'], mult: 50, label: 'BIG BONUS!!', color: 'text-yellow-300' },
  { combo: ['💎','💎','💎'], mult: 30, label: 'MEGA WIN!', color: 'text-blue-400' },
  { combo: ['🍉','🍉','🍉'], mult: 20, label: 'SUPER WIN!', color: 'text-green-400' },
  { combo: ['🔔','🔔','🔔'], mult: 10, label: 'WIN!', color: 'text-yellow-400' },
  { combo: ['🍇','🍇','🍇'], mult: 5, label: 'WIN!', color: 'text-purple-400' },
  { combo: ['🍊','🍊','🍊'], mult: 4, label: 'WIN!', color: 'text-orange-400' },
  { combo: ['🍋','🍋','🍋'], mult: 3, label: 'WIN!', color: 'text-yellow-400' },
  { combo: ['🍒','🍒','🍒'], mult: 3, label: 'WIN!', color: 'text-red-400' },
];

// 3×3ライン定義
const WIN_LINES = [
  [0,1,2],   // 上横
  [3,4,5],   // 中横
  [6,7,8],   // 下横
  [0,4,8],   // 左斜め
  [2,4,6],   // 右斜め
  [0,3,6],   // 左縦
  [1,4,7],   // 中縦
  [2,5,8],   // 右縦
  [0,1,2,3,4,5,6,7,8].slice(0,3), // dummy
];

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

const INTEREST_RATE_30SEC = 0.001;
const INTEREST_INTERVAL = 30000;
const LOAN_INTEREST_RATE = 0.001; // 30分ごとに0.1%
const LOAN_INTERVAL = 1800000; // 30分

export default function App() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [inputName, setInputName] = useState('');
  const [balance, setBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [loanBalance, setLoanBalance] = useState(0);
  const [creditScore, setCreditScore] = useState(100);
  const [lastInterestTime, setLastInterestTime] = useState(Date.now());
  const [lastLoanTime, setLastLoanTime] = useState(Date.now());
  const [view, setView] = useState('LOGIN');
  const [loadingMsg, setLoadingMsg] = useState('通信を確立中...');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('info');
  const [rankingData, setRankingData] = useState([]);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [bankInput, setBankInput] = useState('');
  const [loanInput, setLoanInput] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
        showToast("認証エラーが発生しました。", 'error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingMsg('');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !playerName) return;
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setBalance(data.balance);
        setBankBalance(data.bankBalance || 0);
        setLoanBalance(data.loanBalance || 0);
        setCreditScore(data.creditScore || 100);
        setLastInterestTime(data.lastInterestTime || Date.now());
        setLastLoanTime(data.lastLoanTime || Date.now());
        calculateOfflineInterest(data, docRef);
        calculateLoanInterest(data, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000,
          bankBalance: 0,
          loanBalance: 0,
          creditScore: 100,
          lastInterestTime: now,
          lastLoanTime: now,
          createdAt: now,
          name: playerName
        });
        setBalance(10000);
        setBankBalance(0);
        setLoanBalance(0);
        setCreditScore(100);
      }
    });
    return () => unsubscribe();
  }, [user, playerName]);

  useEffect(() => {
    if (!user || !playerName || bankBalance <= 0) return;
    const timer = setInterval(() => {
      const safeName = encodeURIComponent(playerName);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
      const interest = Math.floor(bankBalance * INTEREST_RATE_30SEC);
      if (interest > 0) {
        const creditBonus = bankBalance > 100000 ? 0.5 : 0;
        updateDoc(docRef, {
          bankBalance: increment(interest),
          lastInterestTime: Date.now(),
          creditScore: increment(creditBonus)
        });
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
        updateDoc(docRef, {
          loanBalance: increment(interest),
          lastLoanTime: Date.now()
        });
        showToast(`💸 ローン利息 +${interest.toLocaleString()} G 発生！`, 'warning');
      }
    }, LOAN_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, loanBalance]);

  useEffect(() => {
    if (!user || (view !== 'RANKING' && view !== 'MENU')) return;
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const players = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const total = (data.balance || 0) + (data.bankBalance || 0) - (data.loanBalance || 0);
        players.push({
          name: data.name || decodeURIComponent(doc.id),
          balance: data.balance || 0,
          bankBalance: data.bankBalance || 0,
          loanBalance: data.loanBalance || 0,
          creditScore: data.creditScore || 100,
          total
        });
      });
      players.sort((a, b) => b.total - a.total);
      setRankingData(players.slice(0, 10));
    });
    return () => unsubscribe();
  }, [user, view]);

  const calculateOfflineInterest = async (data, docRef) => {
    const now = Date.now();
    const lastTime = data.lastInterestTime || now;
    const diffMs = now - lastTime;
    if (diffMs >= INTEREST_INTERVAL && (data.bankBalance || 0) > 0) {
      const periods = Math.floor(diffMs / INTEREST_INTERVAL);
      let currentBank = data.bankBalance;
      let totalInterest = 0;
      for (let i = 0; i < periods; i++) {
        const interest = Math.floor(currentBank * INTEREST_RATE_30SEC);
        totalInterest += interest;
        currentBank += interest;
      }
      if (totalInterest > 0) {
        await updateDoc(docRef, { bankBalance: increment(totalInterest), lastInterestTime: now });
        showToast(`🏦 不在中に利子 +${totalInterest.toLocaleString()} G！`, 'success');
      }
    }
  };

  const calculateLoanInterest = async (data, docRef) => {
    const now = Date.now();
    const lastTime = data.lastLoanTime || now;
    const diffMs = now - lastTime;
    if (diffMs >= LOAN_INTERVAL && (data.loanBalance || 0) > 0) {
      const periods = Math.floor(diffMs / LOAN_INTERVAL);
      let currentLoan = data.loanBalance;
      let totalInterest = 0;
      for (let i = 0; i < periods; i++) {
        const interest = Math.floor(currentLoan * LOAN_INTEREST_RATE);
        totalInterest += interest;
        currentLoan += interest;
      }
      if (totalInterest > 0) {
        await updateDoc(docRef, { loanBalance: increment(totalInterest), lastLoanTime: now });
        showToast(`💸 不在中にローン利息 +${totalInterest.toLocaleString()} G！`, 'warning');
      }
    }
  };

  const updateBalance = async (amount) => {
    try {
      const safeName = encodeURIComponent(playerName);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
      await updateDoc(docRef, { balance: increment(amount) });
    } catch (e) {
      console.error("Balance update error", e);
    }
  };

  const showToast = (msg, type = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleLogin = () => {
    if (inputName.trim().length < 2) { showToast("名前は2文字以上で入力してください。", 'error'); return; }
    setPlayerName(inputName.trim());
    setView('MENU');
  };

  const claimRelief = () => {
    if (balance < 100 && bankBalance < 100) {
      updateBalance(1000);
      showToast("【救済】1000Gを受け取りました！", 'success');
    } else {
      showToast("まだ資産があります！", 'error');
    }
  };

  const handleBankAction = async (action) => {
    const amount = parseInt(bankInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    if (action === 'DEPOSIT') {
      if (balance < amount) { showToast("手元の所持金が足りません！", 'error'); return; }
      const creditBonus = amount > 50000 ? 2 : amount > 10000 ? 1 : 0;
      await updateDoc(docRef, { balance: increment(-amount), bankBalance: increment(amount), lastInterestTime: Date.now(), creditScore: increment(creditBonus) });
      showToast(`🏦 ${amount.toLocaleString()} G 預け入れました。`, 'success');
    } else if (action === 'WITHDRAW') {
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
    if (loanBalance + amount > maxLoan) { showToast(`信用度上限により ${maxLoan.toLocaleString()} G までしか借りられません！`, 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    await updateDoc(docRef, { balance: increment(amount), loanBalance: increment(amount), lastLoanTime: Date.now(), creditScore: increment(-5) });
    showToast(`💰 ${amount.toLocaleString()} G 借入しました。30分毎に0.1%の利息が発生します。`, 'warning');
    setLoanInput('');
  };

  const handleRepay = async () => {
    const amount = parseInt(loanInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
    if (loanBalance < amount) { showToast("返済額がローン残高を超えています！", 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    const creditBonus = amount >= loanBalance ? 10 : 3;
    await updateDoc(docRef, { balance: increment(-amount), loanBalance: increment(-amount), creditScore: increment(creditBonus) });
    showToast(`✅ ${amount.toLocaleString()} G 返済しました！信用度が上がりました。`, 'success');
    setLoanInput('');
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    const target = transferTarget.trim();
    if (!target || target === playerName) { showToast("自分以外のプレイヤー名を入力してください。", 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast("送金金額を正しく入力してください。", 'error'); return; }
    if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
    try {
      const targetSafeName = encodeURIComponent(target);
      const targetDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', targetSafeName);
      const targetSnap = await getDoc(targetDocRef);
      if (!targetSnap.exists()) { showToast(`プレイヤー「${target}」が見つかりません。`, 'error'); return; }
      const selfSafeName = encodeURIComponent(playerName);
      const selfDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', selfSafeName);
      const batch = writeBatch(db);
      batch.update(selfDocRef, { balance: increment(-amount) });
      batch.update(targetDocRef, { balance: increment(amount) });
      await batch.commit();
      showToast(`💸 ${target} 様へ ${amount.toLocaleString()} G 送金しました！`, 'success');
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch (e) {
      showToast("送金処理中にエラーが発生しました。", 'error');
    }
  };

  const getCreditColor = (score) => {
    if (score >= 150) return 'text-emerald-400';
    if (score >= 100) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getCreditLabel = (score) => {
    if (score >= 150) return 'AAA';
    if (score >= 120) return 'AA';
    if (score >= 100) return 'A';
    if (score >= 80) return 'BBB';
    if (score >= 60) return 'BB';
    if (score >= 40) return 'B';
    return 'CCC';
  };

  if (loadingMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <RefreshCw className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="font-bold text-lg">{loadingMsg}</p>
      </div>
    );
  }

  const toastColors = {
    info: 'bg-yellow-500 text-black border-yellow-400',
    success: 'bg-emerald-500 text-white border-emerald-400',
    error: 'bg-red-500 text-white border-red-400',
    warning: 'bg-orange-500 text-white border-orange-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {toastMsg && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border font-bold max-w-sm text-center ${toastColors[toastType]}`}>
          <AlertCircle size={20} />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex-grow">
        {view === 'LOGIN' && (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="mb-8 text-center">
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 mb-2">GRAND CASINO</h1>
              <h2 className="text-2xl font-bold text-gray-500 tracking-widest">& TURF ONLINE</h2>
            </div>
            <div className="bg-gray-900/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md text-center">
              <p className="mb-6 text-gray-300 font-medium">
                プレイヤー名を入力して入場してください<br/>
                <span className="text-sm text-yellow-500/80">※同じ名前を入力すると口座・所持金を引き継げます</span>
              </p>
              <input type="text" value={inputName} onChange={(e)=>setInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 mb-6 focus:outline-none focus:border-yellow-500 text-center text-2xl font-bold transition-all"
                placeholder="登録名・引き継ぎ名" maxLength={12} />
              <button onClick={handleLogin} className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.03] active:scale-95 text-xl">
                入場・引き継ぎ
              </button>
            </div>
          </div>
        )}

        {view === 'MENU' && (
          <div className="p-6 md:p-12 max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-10 border-b border-gray-800 pb-8 gap-6">
              <div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 mb-1">GRAND CASINO</h1>
                <p className="text-gray-400 font-medium">おかえりなさい、<span className="text-white font-bold">{playerName}</span> 様</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="bg-gray-900/90 border border-gray-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                  <Coins className="text-yellow-500" size={20} />
                  <div>
                    <span className="text-xs text-gray-400 font-bold block">所持金</span>
                    <span className="font-mono text-lg font-black text-yellow-400">{balance.toLocaleString()} G</span>
                  </div>
                </div>
                <div className="bg-gray-900/90 border border-gray-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                  <Landmark className="text-emerald-400" size={20} />
                  <div>
                    <span className="text-xs text-gray-400 font-bold block">銀行残高</span>
                    <span className="font-mono text-lg font-black text-emerald-400">{bankBalance.toLocaleString()} G</span>
                  </div>
                </div>
                {loanBalance > 0 && (
                  <div className="bg-gray-900/90 border border-red-800 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl">
                    <TrendingDown className="text-red-400" size={20} />
                    <div>
                      <span className="text-xs text-gray-400 font-bold block">ローン残高</span>
                      <span className="font-mono text-lg font-black text-red-400">{loanBalance.toLocaleString()} G</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <button onClick={() => setView('SLOT')} className="group relative overflow-hidden bg-gradient-to-br from-purple-950 to-indigo-950 p-8 rounded-3xl shadow-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 text-purple-500/10 group-hover:text-purple-400/20 transition-all duration-500 scale-110"><PlaySquare size={160} /></div>
                <span className="bg-purple-500/10 text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino Game</span>
                <h2 className="text-3xl font-extrabold text-white mb-1 group-hover:text-purple-300 transition">SLOT MACHINE</h2>
                <p className="text-purple-400 text-sm font-bold mb-3">3×3 マルチライン対応</p>
                <p className="text-gray-400 text-sm leading-relaxed">8ラインの本格スロット。連続スピン可能。JACKPOTで100倍！</p>
              </button>

              <button onClick={() => setView('RACE')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-950 to-green-950 p-8 rounded-3xl shadow-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 text-emerald-500/10 group-hover:text-emerald-400/20 transition-all duration-500 scale-110"><Trophy size={160} /></div>
                <span className="bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Sport Betting</span>
                <h2 className="text-3xl font-extrabold text-white mb-1 group-hover:text-emerald-300 transition">VIRTUAL TURF</h2>
                <p className="text-emerald-400 text-sm font-bold mb-3">8頭立て 本格競馬</p>
                <p className="text-gray-400 text-sm leading-relaxed">馬体重・騎手・馬場状態を考慮したリアルシミュレーション。</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setView('BANK')} className="flex items-center justify-between p-6 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Landmark size={24} /></div>
                  <div className="text-left">
                    <span className="font-bold text-white block">グランドバンク</span>
                    <span className="text-xs text-emerald-400 font-semibold">預金・借入・信用度管理</span>
                  </div>
                </div>
                <ChevronRight className="text-gray-500" size={20} />
              </button>

              <button onClick={() => setView('TRANSFER')} className="flex items-center justify-between p-6 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Send size={24} /></div>
                  <div className="text-left">
                    <span className="font-bold text-white block">オンライン送金</span>
                    <span className="text-xs text-gray-400">他プレイヤーへ資金を譲渡</span>
                  </div>
                </div>
                <ChevronRight className="text-gray-500" size={20} />
              </button>

              <button onClick={() => setView('RANKING')} className="flex items-center justify-between p-6 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400"><Trophy size={24} /></div>
                  <div className="text-left">
                    <span className="font-bold text-white block">長者番付</span>
                    <span className="text-xs text-gray-400">オンライン富豪トップ10</span>
                  </div>
                </div>
                <ChevronRight className="text-gray-500" size={20} />
              </button>
            </div>

            <div className="mt-8 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
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
        )}

        {view === 'SLOT' && <SlotMachine balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} />}
        {view === 'RACE' && <HorseRacing balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} />}

        {view === 'BANK' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><Landmark size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">GRAND BANK</h2>
                  <p className="text-sm text-emerald-400 font-semibold">預金: 30秒ごと +0.1% ／ ローン: 30分ごと +0.1%</p>
                </div>
              </div>

              {/* 信用度 */}
              <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-gray-400">信用スコア</span>
                  <span className={`text-2xl font-black ${getCreditColor(creditScore)}`}>{getCreditLabel(creditScore)} ({Math.floor(creditScore)})</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
                  <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all" style={{width: `${Math.min(100, (creditScore / 200) * 100)}%`}}></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                  <div>借入上限: <span className="text-white font-bold">{Math.floor(creditScore * 1000).toLocaleString()} G</span></div>
                  <div>借入残高: <span className="text-red-400 font-bold">{loanBalance.toLocaleString()} G</span></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">※高額預金で上昇・借入で低下・1日経過でも低下します</p>
              </div>

              {/* 残高 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-900 text-center">
                  <span className="text-xs text-gray-400 block mb-1 font-bold">所持金</span>
                  <span className="text-lg font-mono font-black text-yellow-500">{balance.toLocaleString()}</span>
                </div>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-900 text-center">
                  <span className="text-xs text-gray-400 block mb-1 font-bold">預金残高</span>
                  <span className="text-lg font-mono font-black text-emerald-400">{bankBalance.toLocaleString()}</span>
                </div>
                <div className="bg-gray-950 p-4 rounded-xl border border-red-900 text-center">
                  <span className="text-xs text-gray-400 block mb-1 font-bold">ローン残高</span>
                  <span className="text-lg font-mono font-black text-red-400">{loanBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* 預金操作 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 font-bold mb-2">💰 預金・引出 金額 (G)</label>
                <div className="relative mb-3">
                  <input type="number" value={bankInput} onChange={e => setBankInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-emerald-500 shadow-inner" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button onClick={() => setBankInput(balance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition">所持金全額</button>
                    <button onClick={() => setBankInput(bankBalance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition text-emerald-400">預金全額</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleBankAction('DEPOSIT')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black transition active:scale-95">預け入れる</button>
                  <button onClick={() => handleBankAction('WITHDRAW')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-black border border-gray-700 transition active:scale-95">引き出す</button>
                </div>
              </div>

              {/* ローン操作 */}
              <div className="border-t border-gray-800 pt-4">
                <label className="block text-sm text-gray-400 font-bold mb-2">🏦 借入・返済 金額 (G)</label>
                <div className="relative mb-3">
                  <input type="number" value={loanInput} onChange={e => setLoanInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-red-500 shadow-inner" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button onClick={() => setLoanInput(loanBalance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-2 py-1 rounded font-bold transition text-red-400">全額返済</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleLoan} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded-xl font-black transition active:scale-95">借入する</button>
                  <button onClick={handleRepay} disabled={loanBalance <= 0} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-xl font-black transition active:scale-95 disabled:opacity-40">返済する</button>
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center">※借入は30分ごとに0.1%の利息が発生します。信用度が低下すると借入上限が下がります。</p>
              </div>
            </div>
          </div>
        )}

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
              <div className="bg-gray-950 p-4 rounded-xl border border-gray-900 mb-6 flex justify-between items-center">
                <span className="text-sm text-gray-400 font-bold">ご利用可能な所持金</span>
                <span className="text-xl font-mono font-black text-yellow-500">{balance.toLocaleString()} G</span>
              </div>
              <div className="space-y-4 mb-8">
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

        {view === 'RANKING' && (
          <div className="p-6 md:p-12 max-w-3xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-6">
                <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-400"><Trophy size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">LEADERBOARD</h2>
                  <p className="text-sm text-gray-400">純資産ランキング (所持金 ＋ 預金 − ローン)</p>
                </div>
              </div>
              <div className="space-y-3">
                {rankingData.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">プレイヤーがまだ存在しません。</p>
                ) : (
                  rankingData.map((player, index) => {
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
                              <span>手元: {player.balance.toLocaleString()}G</span>
                              <span>銀行: {player.bankBalance.toLocaleString()}G</span>
                              {player.loanBalance > 0 && <span className="text-red-400">ローン: -{player.loanBalance.toLocaleString()}G</span>}
                              <span className={getCreditColor(player.creditScore)}>{getCreditLabel(player.creditScore)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-xl font-black text-yellow-500">{player.total.toLocaleString()} G</span>
                      </div>
                    );
                  })
                )}
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
// Component: Slot Machine (3×3)
// ==========================================
function SlotMachine({ balance, updateBalance, onBack, showToast }) {
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState(Array(9).fill(0));
  const [spinning, setSpinning] = useState(Array(9).fill(false));
  const [slotStatus, setSlotStatus] = useState('IDLE');
  const [winLines, setWinLines] = useState([]);
  const [winMessage, setWinMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [totalWin, setTotalWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const spinningRef = useRef(Array(9).fill(false));
  const reqRef = useRef(null);
  const autoRef = useRef(false);

  const LINES = [
    [0,1,2], [3,4,5], [6,7,8],   // 横3本
    [0,3,6], [1,4,7], [2,5,8],   // 縦3本
    [0,4,8], [2,4,6],             // 斜め2本
  ];

  const startSpin = async () => {
    if (balance < bet) {
      showToast("残高が足りません！", 'error');
      autoRef.current = false;
      setAutoSpin(false);
      return;
    }
    await updateBalance(-bet);
    spinningRef.current = Array(9).fill(true);
    setSpinning(Array(9).fill(true));
    setSlotStatus('SPINNING');
    setWinLines([]);
    setWinMessage('');
    setWinAmount(0);
    setSpinCount(c => c + 1);

    let lastTime = performance.now();
    const spinLoop = (time) => {
      if (time - lastTime > 50) {
        setGrid(prev => {
          const next = [...prev];
          for (let i = 0; i < 9; i++) {
            if (spinningRef.current[i]) next[i] = (next[i] + 1) % SYMBOLS.length;
          }
          return next;
        });
        lastTime = time;
      }
      if (spinningRef.current.some(s => s)) reqRef.current = requestAnimationFrame(spinLoop);
    };
    reqRef.current = requestAnimationFrame(spinLoop);

    // 自動停止（列ごとに遅延）
    for (let col = 0; col < 3; col++) {
      await new Promise(r => setTimeout(r, 600 + col * 400));
      for (let row = 0; row < 3; row++) {
        spinningRef.current[row * 3 + col] = false;
      }
      setSpinning([...spinningRef.current]);
    }
  };

  useEffect(() => {
    if (slotStatus === 'SPINNING' && !spinning.includes(true)) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      evaluateWin();
    }
  }, [spinning, slotStatus]);

  const evaluateWin = () => {
    let totalMultiplier = 0;
    const hitLines = [];

    LINES.forEach((line, lineIdx) => {
      const syms = line.map(i => SYMBOLS[grid[i]].sym);
      const match = PAYTABLE.find(p => p.combo[0] === syms[0] && p.combo[1] === syms[1] && p.combo[2] === syms[2]);
      if (match) {
        totalMultiplier += match.mult;
        hitLines.push({ line, mult: match.mult, label: match.label, color: match.color });
      }
    });

    if (totalMultiplier > 0) {
      const amount = bet * totalMultiplier;
      setWinAmount(amount);
      setTotalWin(w => w + amount - bet);
      const topWin = hitLines.sort((a,b) => b.mult - a.mult)[0];
      setWinMessage(`${topWin.label} ×${totalMultiplier}`);
      setWinLines(hitLines);
      updateBalance(amount);
    } else {
      setWinMessage('LOSE');
      setTotalWin(w => w - bet);
    }

    setSlotStatus('RESULT');
    setTimeout(() => {
      setSlotStatus('IDLE');
      setWinMessage('');
      setWinLines([]);
      if (autoRef.current) startSpin();
    }, autoRef.current ? 1000 : 2500);
  };

  const toggleAuto = () => {
    const next = !autoSpin;
    autoRef.current = next;
    setAutoSpin(next);
    if (next && slotStatus === 'IDLE') startSpin();
  };

  useEffect(() => { return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); }; }, []);

  const isHighlighted = (idx) => winLines.some(wl => wl.line.includes(idx));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={() => { autoRef.current = false; setAutoSpin(false); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 font-bold">SPINS</div>
            <div className="font-mono text-yellow-400 font-bold">{spinCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 font-bold">NET</div>
            <div className={`font-mono font-bold ${totalWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalWin >= 0 ? '+' : ''}{totalWin.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-gray-800 to-gray-950 p-6 rounded-[2rem] border-8 border-gray-900 shadow-2xl w-full relative">
        {winMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className={`text-5xl md:text-7xl font-black drop-shadow-lg ${winAmount > 0 ? 'text-yellow-400 animate-bounce' : 'text-gray-500'} bg-black/60 px-6 py-3 rounded-2xl`}>
              {winMessage}
              {winAmount > 0 && <div className="text-2xl text-center text-emerald-400">+{winAmount.toLocaleString()} G</div>}
            </div>
          </div>
        )}

        {/* 3×3 Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {grid.map((symIdx, i) => {
            const sym = SYMBOLS[symIdx];
            const highlighted = isHighlighted(i);
            return (
              <div key={i} className={`bg-white rounded-xl flex items-center justify-center h-24 md:h-32 text-4xl md:text-5xl font-black shadow-inner transition-all border-4 ${highlighted ? 'border-yellow-400 shadow-yellow-400/50 shadow-lg scale-105' : 'border-gray-200'} ${spinning[i] ? 'animate-pulse' : ''}`}>
                <span className={sym.name === 'BAR' ? 'text-2xl md:text-3xl font-black text-gray-800' : ''}>
                  {sym.sym}
                </span>
              </div>
            );
          })}
        </div>

        {/* Win Lines Display */}
        {winLines.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {winLines.map((wl, i) => (
              <span key={i} className={`text-sm font-bold px-3 py-1 rounded-full bg-gray-900 border border-gray-700 ${wl.color}`}>
                {wl.label} ×{wl.mult}
              </span>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-950 p-5 rounded-xl border border-gray-800 gap-4">
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 font-bold">BET</span>
            <select value={bet} onChange={e=>setBet(Number(e.target.value))} disabled={slotStatus !== 'IDLE'}
              className="bg-gray-900 text-yellow-500 font-mono text-lg p-3 rounded-lg border border-gray-800 outline-none font-bold">
              <option value="10">10G</option>
              <option value="100">100G</option>
              <option value="500">500G</option>
              <option value="1000">1,000G</option>
              <option value="5000">5,000G</option>
              <option value="10000">10,000G</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={toggleAuto} className={`px-6 py-3 rounded-xl font-black transition active:scale-95 border ${autoSpin ? 'bg-orange-600 border-orange-500 text-white animate-pulse' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
              {autoSpin ? 'AUTO ON' : 'AUTO'}
            </button>
            <button onClick={startSpin} disabled={slotStatus !== 'IDLE' || balance < bet}
              className="bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black py-3 px-10 rounded-full text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
              SPIN
            </button>
          </div>
        </div>
      </div>

      {/* Paytable */}
      <div className="mt-6 bg-gray-900/50 p-5 rounded-xl w-full border border-gray-800">
        <h3 className="text-gray-400 font-bold mb-3 text-center tracking-widest text-sm">PAYTABLE — 8ライン有効（横3・縦3・斜め2）</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          {PAYTABLE.map((p, i) => (
            <div key={i} className="bg-black/50 p-2 rounded text-center">
              <div className="text-lg">{p.combo[0]}{p.combo[1]}{p.combo[2]}</div>
              <div className={`font-bold ${p.color}`}>×{p.mult}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Horse Racing (Enhanced)
// ==========================================
function HorseRacing({ balance, updateBalance, onBack, showToast }) {
  const [horses, setHorses] = useState(INITIAL_HORSES.map(h => ({ ...h, position: 0, speed: 0, stamina: 100 })));
  const [selectedHorse, setSelectedHorse] = useState(null);
  const [betType, setBetType] = useState('WIN'); // WIN, PLACE, SHOW
  const [raceBet, setRaceBet] = useState(100);
  const [isRacing, setIsRacing] = useState(false);
  const [racePhase, setRacePhase] = useState('BETTING'); // BETTING, COUNTDOWN, RACING, RESULT
  const [countdown, setCountdown] = useState(3);
  const [raceResult, setRaceResult] = useState(null);
  const [finishOrder, setFinishOrder] = useState([]);
  const [weather, setWeather] = useState('晴れ');
  const [trackCondition, setTrackCondition] = useState('良');
  const [commentary, setCommentary] = useState('馬を選んでベットしてください');
  const frameRef = useRef(null);

  const BET_TYPES = {
    WIN: { label: '単勝', desc: '1着的中', mult: (h) => h.odds },
    PLACE: { label: '複勝', desc: '3着以内', mult: (h) => h.odds * 0.4 },
    SHOW: { label: '馬連', desc: '2着以内', mult: (h) => h.odds * 0.6 },
  };

  const WEATHERS = ['晴れ', '曇り', '雨', '霧'];
  const TRACK_CONDITIONS = { '晴れ': '良', '曇り': '稍重', '雨': '重', '霧': '不良' };

  const startRace = async () => {
    if (!selectedHorse) { showToast("予想する馬を選択してください", 'error'); return; }
    if (balance < raceBet) { showToast("残高が足りません！", 'error'); return; }
    const newWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    setWeather(newWeather);
    setTrackCondition(TRACK_CONDITIONS[newWeather]);
    await updateBalance(-raceBet);
    setRacePhase('COUNTDOWN');
    setCountdown(3);
    setFinishOrder([]);
    setRaceResult(null);
    setHorses(INITIAL_HORSES.map(h => ({ ...h, position: 0, speed: 0, stamina: 100 + Math.random() * 20 })));
  };

  useEffect(() => {
    if (racePhase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      setRacePhase('RACING');
      setIsRacing(true);
      setCommentary('各馬一斉にスタート！');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [racePhase, countdown]);

  useEffect(() => {
    if (!isRacing) return;
    let currentHorses = horses.map(h => ({ ...h }));
    let finished = [];

    const raceLoop = () => {
      const progress = currentHorses[0]?.position || 0;

      currentHorses = currentHorses.map(horse => {
        if (horse.position >= 100) return horse;
        const oddsFactor = 2.5 / horse.odds;
        const staminaFactor = horse.stamina / 100;
        const weatherPenalty = horse.condition === trackCondition ? 1.05 : trackCondition === '重' ? 0.85 : 0.95;
        const spurt = progress > 70 && Math.random() > 0.95 ? Math.random() * 1.5 : 0;
        const baseSpeed = (0.5 + Math.random() * 0.6) * oddsFactor * staminaFactor * weatherPenalty + spurt;
        const newPos = Math.min(100, horse.position + baseSpeed);
        const newStamina = Math.max(0, horse.stamina - 0.3 - (spurt > 0 ? 2 : 0));

        if (newPos >= 100 && !finished.find(f => f.id === horse.id)) {
          finished.push({ ...horse, position: 100 });
        }
        return { ...horse, position: newPos, stamina: newStamina, speed: baseSpeed };
      });

      setHorses([...currentHorses]);

      // 実況コメント
      const leader = [...currentHorses].sort((a,b) => b.position - a.position)[0];
      if (leader) {
        const p = leader.position;
        if (p < 20) setCommentary(`スタート！${leader.name}が先手を取る！`);
        else if (p < 40) setCommentary(`${leader.name}が先頭！後続を引き離しにかかる！`);
        else if (p < 60) setCommentary(`レース中盤！${leader.name}をマークする各馬！`);
        else if (p < 80) setCommentary(`残り400m！${leader.name}が逃げる！追い込み勢が動き出した！`);
        else setCommentary(`最終直線！${leader.name}が粘る！差し馬が猛追！`);
      }

      if (finished.length >= INITIAL_HORSES.length || currentHorses.every(h => h.position >= 100)) {
        setIsRacing(false);
        setRacePhase('RESULT');
        const order = [...currentHorses].sort((a, b) => b.position - a.position);
        setFinishOrder(order);
        const winner = order[0];
        setRaceResult(winner);

        const selected = INITIAL_HORSES.find(h => h.id === selectedHorse);
        let won = false;
        if (betType === 'WIN' && order[0].id === selectedHorse) won = true;
        if (betType === 'PLACE' && order.slice(0,3).find(h => h.id === selectedHorse)) won = true;
        if (betType === 'SHOW' && order.slice(0,2).find(h => h.id === selectedHorse)) won = true;

        if (won && selected) {
          const mult = BET_TYPES[betType].mult(selected);
          const winAmount = Math.floor(raceBet * mult);
          updateBalance(winAmount);
          setCommentary(`🎉 的中！${winAmount.toLocaleString()} G 獲得！`);
        } else {
          setCommentary(`😢 残念...ハズレ`);
        }
        return;
      }
      frameRef.current = requestAnimationFrame(raceLoop);
    };
    frameRef.current = requestAnimationFrame(raceLoop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isRacing]);

  const conditionColor = { '良': 'text-emerald-400', '稍重': 'text-yellow-400', '重': 'text-orange-400', '不良': 'text-red-400' };

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
        {/* 出馬表 */}
        <div className="xl:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
          <h3 className="text-lg font-bold mb-2 text-white border-b border-gray-700 pb-2">📋 出馬表</h3>

          {/* 馬場状態 */}
          <div className="bg-gray-950 rounded-xl p-3 mb-4 text-xs grid grid-cols-2 gap-1">
            <div>天候: <span className="text-white font-bold">{weather}</span></div>
            <div>馬場: <span className={`font-bold ${conditionColor[trackCondition]}`}>{trackCondition}</span></div>
          </div>

          {/* 賭け式 */}
          <div className="flex gap-1 mb-4">
            {Object.entries(BET_TYPES).map(([key, val]) => (
              <button key={key} onClick={() => !isRacing && setBetType(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${betType === key ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                {val.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            {INITIAL_HORSES.map(h => (
              <button key={h.id} onClick={() => !isRacing && setSelectedHorse(h.id)} disabled={isRacing}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl transition-all border-2 text-left text-sm ${selectedHorse === h.id ? 'border-yellow-500 bg-gray-800' : 'border-transparent hover:bg-gray-800 bg-gray-950/50'}`}>
                <span className="w-7 h-7 flex justify-center items-center rounded-lg text-xs font-black shadow-md flex-shrink-0" style={{backgroundColor: h.color, color: h.textColor}}>{h.id}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate">{h.name}</div>
                  <div className="text-gray-500 text-xs">{h.jockey} / {h.weight}kg</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-yellow-400 font-bold">{h.odds.toFixed(1)}</div>
                  <div className={`text-xs ${conditionColor[h.condition] || 'text-white'}`}>{h.condition}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <label className="block text-xs text-gray-400 font-bold mb-2">BET額 (G) — {BET_TYPES[betType].desc}</label>
            <input type="number" value={raceBet} onChange={e => setRaceBet(Number(e.target.value))}
              className="w-full bg-gray-900 text-white font-mono text-lg p-3 rounded-lg border border-gray-800 focus:border-yellow-500 outline-none mb-3"
              min="10" step="10" disabled={isRacing} />
            {selectedHorse && (
              <div className="text-xs text-gray-400 mb-3 text-center">
                的中時: <span className="text-yellow-400 font-bold">{Math.floor(raceBet * BET_TYPES[betType].mult(INITIAL_HORSES.find(h => h.id === selectedHorse))).toLocaleString()} G</span>
              </div>
            )}
            <button onClick={startRace} disabled={isRacing || !selectedHorse || balance < raceBet}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black py-3 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
              {racePhase === 'COUNTDOWN' ? `${countdown}秒後にスタート` : isRacing ? 'レース中...' : '出走する'}
            </button>
          </div>
        </div>

        {/* レース画面 */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {/* コース */}
          <div className="bg-gradient-to-b from-emerald-800 via-green-700 to-emerald-900 rounded-2xl relative overflow-hidden border-4 border-gray-800 shadow-2xl" style={{height: '520px'}}>
            {/* 馬場模様 */}
            <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(0,0,0,0.3) 60px, rgba(0,0,0,0.3) 62px)'}}></div>

            {/* ゴール線 */}
            <div className="absolute right-[5%] top-0 bottom-0 w-6 z-10" style={{background: 'repeating-linear-gradient(0deg, white 0px, white 10px, black 10px, black 20px)'}}>
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded whitespace-nowrap">GOAL</div>
            </div>

            {/* スタート線 */}
            <div className="absolute left-[3%] top-0 bottom-0 w-1 bg-white/50 z-10"></div>

            {/* カウントダウン */}
            {racePhase === 'COUNTDOWN' && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50">
                <div className="text-9xl font-black text-white animate-bounce drop-shadow-lg">{countdown || 'GO!'}</div>
              </div>
            )}

            {/* 馬 */}
            {horses.map((h, idx) => {
              const trackHeight = 520;
              const laneHeight = trackHeight / INITIAL_HORSES.length;
              const y = idx * laneHeight + laneHeight / 2 - 24;
              const x = Math.min(h.position, 93);
              const isSelected = h.id === selectedHorse;
              return (
                <div key={h.id} className="absolute flex items-center transition-all duration-75 ease-linear z-10"
                  style={{ left: `${x}%`, top: `${y}px` }}>
                  <div className="flex flex-col items-center">
                    <div className={`text-3xl drop-shadow-lg ${isRacing && isSelected ? 'animate-bounce' : ''}`}>🐎</div>
                    <div className="w-6 h-6 -mt-1 flex justify-center items-center rounded-full text-xs font-black shadow-xl border-2 border-gray-800"
                      style={{backgroundColor: h.color, color: h.textColor}}>{h.id}</div>
                    {isSelected && <div className="text-yellow-400 text-xs font-black drop-shadow-lg">▲</div>}
                  </div>
                </div>
              );
            })}

            {/* スタミナバー */}
            {isRacing && (
              <div className="absolute bottom-2 left-4 right-4 space-y-0.5">
                {horses.map((h, idx) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="text-white text-xs font-bold w-4">{h.id}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${h.stamina}%`,
                        backgroundColor: h.stamina > 60 ? '#22c55e' : h.stamina > 30 ? '#eab308' : '#ef4444'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 実況・結果 */}
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
            {racePhase === 'RESULT' && finishOrder.length > 0 ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-2xl font-black text-white">レース結果</h3>
                  {finishOrder[0].id === selectedHorse && betType === 'WIN' && (
                    <span className="bg-yellow-500 text-black text-sm font-black px-3 py-1 rounded-full animate-pulse">🎉 的中！</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {finishOrder.slice(0, 4).map((h, i) => {
                    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
                    const isWin = h.id === selectedHorse;
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
                <button onClick={() => { setRacePhase('BETTING'); setSelectedHorse(null); }} className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">
                  次のレースへ
                </button>
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