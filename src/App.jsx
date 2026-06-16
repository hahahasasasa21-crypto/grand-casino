import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw, TrendingDown, Briefcase, Lock, Star } from 'lucide-react';
import { firebaseConfig, appId } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Slot Constants ---
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

// 重み付きシンボルプール生成
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

// --- Horse Constants ---
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

// --- Labor: English Words ---
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

const INTEREST_RATE_30SEC = 0.001;
const INTEREST_INTERVAL = 30000;
const LOAN_INTEREST_RATE = 0.001;
const LOAN_INTERVAL = 1800000;

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
        calcOfflineInterest(d, docRef);
        calcLoanInterest(d, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000, bankBalance: 0, loanBalance: 0,
          creditScore: 100, lastInterestTime: now,
          createdAt: now, name: playerName, password: inputPassword
        });
        setBalance(10000); setBankBalance(0); setLoanBalance(0); setCreditScore(100);
      }
    });
    return () => unsub();
  }, [user, playerName]);

  // 銀行利子（30秒ごと）
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

  // ローン利息（30分ごと）
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
        if (data.password && data.password !== inputPassword) {
          showToast("パスワードが違います！", 'error'); return;
        }
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

  // =============================================
  // 銀行アクション（バグ修正済み）
  // =============================================
  const handleBankAction = async (action) => {
    const amount = parseInt(bankInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);

    if (action === 'DEPOSIT') {
      if (balance < amount) { showToast("所持金が足りません！", 'error'); return; }
      // 高額預金で信用度UP（預け入れ時のみ）
      // 5万以上: +3、1万以上: +1、それ以下: +0
      const creditBonus = amount >= 50000 ? 3 : amount >= 10000 ? 1 : 0;
      await updateDoc(docRef, {
        balance: increment(-amount),
        bankBalance: increment(amount),
        lastInterestTime: Date.now(),
        ...(creditBonus > 0 ? { creditScore: increment(creditBonus) } : {})
      });
      showToast(`🏦 ${amount.toLocaleString()} G 預け入れました。${creditBonus > 0 ? ` 信用度 +${creditBonus}` : ''}`, 'success');
    } else {
      if (bankBalance < amount) { showToast("銀行残高が足りません！", 'error'); return; }
      await updateDoc(docRef, {
        balance: increment(amount),
        bankBalance: increment(-amount)
      });
      showToast(`🏦 ${amount.toLocaleString()} G 引き出しました。`, 'success');
    }
    setBankInput('');
  };

  const handleLoan = async () => {
    const amount = parseInt(loanInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。", 'error'); return; }
    const maxLoan = Math.floor(creditScore * 1000);
    if (loanBalance + amount > maxLoan) {
      showToast(`上限 ${maxLoan.toLocaleString()} G まで借りられます！`, 'error'); return;
    }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    // 借入すると信用度DOWN（マイナス）
    await updateDoc(docRef, {
      balance: increment(amount),
      loanBalance: increment(amount),
      lastLoanTime: Date.now(),
      creditScore: increment(-5)   // 借入で信用度マイナス
    });
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
    // 返済で信用度UP（全額返済ボーナス大）
    const isFullRepay = amount >= loanBalance;
    const creditBonus = isFullRepay ? 10 : 3;
    await updateDoc(docRef, {
      balance: increment(-amount),
      loanBalance: increment(-amount),
      creditScore: increment(creditBonus)  // 返済で信用度プラス
    });
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
      showToast(`💸 ${target} へ ${amount.toLocaleString()} G 送金！`, 'success');
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch(e) { showToast("送金エラー", 'error'); }
  };

  const getCreditColor = s => s >= 150 ? 'text-emerald-400' : s >= 100 ? 'text-yellow-400' : s >= 50 ? 'text-orange-400' : 'text-red-400';
  const getCreditLabel = s => s >= 150 ? 'AAA' : s >= 120 ? 'AA' : s >= 100 ? 'A' : s >= 80 ? 'BBB' : s >= 60 ? 'BB' : s >= 40 ? 'B' : 'CCC';

  const toastColors = {
    info: 'bg-yellow-500 text-black',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-orange-500 text-white'
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
                  <input
                    type="text"
                    value={inputName}
                    onChange={e => setInputName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 focus:outline-none focus:border-yellow-500 text-center text-2xl font-bold transition-all"
                    placeholder="名前を入力"
                    maxLength={12}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1 flex items-center gap-1">
                    <Lock size={12} /> パスワード（数字3桁）
                  </label>
                  <input
                    type="password"
                    value={inputPassword}
                    onChange={e => setInputPassword(e.target.value.slice(0, 3))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 focus:outline-none focus:border-yellow-500 text-center text-3xl font-bold tracking-[1rem] transition-all"
                    placeholder="●●●"
                    maxLength={3}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <p className="text-xs text-gray-600 mt-1 text-center">
                    ※初めての方：任意の3桁数字を設定してください（次回以降はこれでログイン）
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.03] active:scale-95 text-xl"
              >
                入場・引き継ぎ
              </button>
            </div>
          </div>
        )}

        {/* ===== MENU ===== */}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <button onClick={() => setView('SLOT')} className="group relative overflow-hidden bg-gradient-to-br from-purple-950 to-indigo-950 p-7 rounded-3xl shadow-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 text-purple-500/10 group-hover:text-purple-400/20 transition-all duration-500"><PlaySquare size={130} /></div>
                <span className="bg-purple-500/10 text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino</span>
                <h2 className="text-2xl font-extrabold text-white mb-1 group-hover:text-purple-300 transition">SLOT MACHINE</h2>
                <p className="text-gray-400 text-sm">3×3マルチライン・リール演出強化</p>
              </button>

              <button onClick={() => setView('RACE')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-950 to-green-950 p-7 rounded-3xl shadow-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 text-emerald-500/10 group-hover:text-emerald-400/20 transition-all duration-500"><Trophy size={130} /></div>
                <span className="bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Racing</span>
                <h2 className="text-2xl font-extrabold text-white mb-1 group-hover:text-emerald-300 transition">VIRTUAL TURF</h2>
                <p className="text-gray-400 text-sm">8頭立て・天候・馬場状態あり</p>
              </button>

              <button onClick={() => setView('LABOR')} className="group relative overflow-hidden bg-gradient-to-br from-blue-950 to-cyan-950 p-7 rounded-3xl shadow-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 text-blue-500/10 group-hover:text-blue-400/20 transition-all duration-500"><Briefcase size={130} /></div>
                <span className="bg-blue-500/10 text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Labor</span>
                <h2 className="text-2xl font-extrabold text-white mb-1 group-hover:text-blue-300 transition">英単語バイト</h2>
                <p className="text-gray-400 text-sm">初級50G〜上級400G・堅実に稼ごう</p>
              </button>
            </div>

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
        {view === 'LABOR' && <LaborView balance={balance} updateBalance={updateBalance} onBack={() => setView('MENU')} showToast={showToast} />}

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

              {/* 信用度と借入ルール説明 */}
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

              {/* 信用度の増減ルール */}
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

              {/* 残高 */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[['所持金', balance, 'text-yellow-500'], ['預金残高', bankBalance, 'text-emerald-400'], ['ローン残高', loanBalance, 'text-red-400']].map(([label, val, color]) => (
                  <div key={label} className="bg-gray-950 p-4 rounded-xl border border-gray-900 text-center">
                    <span className="text-xs text-gray-400 block mb-1 font-bold">{label}</span>
                    <span className={`text-lg font-mono font-black ${color}`}>{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* 預金・引出 */}
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

              {/* 借入・返済 */}
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
// Component: Slot Machine（大幅改善版）
// ==========================================
function SlotMachine({ balance, updateBalance, onBack, showToast }) {
  const [bet, setBet] = useState(100);
  // 各リールの表示シンボルインデックス（スロットはリールごとに管理）
  const [reels, setReels] = useState([
    [0, 1, 2], // リール1: 上中下
    [3, 4, 5],
    [6, 7, 8],
  ]);
  // 確定したグリッド（3x3: row 0-2, col 0-2）
  const finalGridRef = useRef(Array(9).fill(0));
  const [displayGrid, setDisplayGrid] = useState(Array(9).fill(0));
  const [spinningCols, setSpinningCols] = useState([false, false, false]);
  const [slotStatus, setSlotStatus] = useState('IDLE'); // IDLE | SPINNING | STOPPING | RESULT
  const [winLines, setWinLines] = useState([]);
  const [winMessage, setWinMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [totalWin, setTotalWin] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [reelOffsets, setReelOffsets] = useState([0, 0, 0]);
  const [jackpotFlash, setJackpotFlash] = useState(false);

  const autoRef = useRef(false);
  const statusRef = useRef('IDLE');
  const animFrames = useRef([null, null, null]);
  const reelSpeedRef = useRef([0, 0, 0]);

  const LINES = [
    [0, 1, 2],   // 上横
    [3, 4, 5],   // 中横
    [6, 7, 8],   // 下横
    [0, 3, 6],   // 左縦
    [1, 4, 7],   // 中縦
    [2, 5, 8],   // 右縦
    [0, 4, 8],   // 左斜め
    [2, 4, 6],   // 右斜め
  ];

  // 重み付きランダムシンボル選択
  const randomSymbol = () => SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];

  // 確定グリッド計算（確率ベース）
  const generateFinalGrid = useCallback(() => {
    return Array(9).fill(0).map(() => randomSymbol());
  }, []);

  // リールアニメーション（各列独立）
  const spinReel = useCallback((colIndex, finalSymbols, stopDelay) => {
    return new Promise(resolve => {
      const startTime = performance.now();
      const duration = stopDelay; // ms

      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // リール回転演出：高速でシンボルを切り替え
        const speed = progress < 0.7 ? 1 : Math.max(0.1, 1 - (progress - 0.7) / 0.3); // 減速
        const tickRate = Math.floor(60 * speed);

        if (Math.floor(now / (1000 / Math.max(tickRate, 8))) % 2 === 0) {
          setDisplayGrid(prev => {
            const next = [...prev];
            for (let row = 0; row < 3; row++) {
              next[row * 3 + colIndex] = randomSymbol();
            }
            return next;
          });
        }

        setReelOffsets(prev => {
          const next = [...prev];
          next[colIndex] = (prev[colIndex] + speed * 8) % 100;
          return next;
        });

        if (progress < 1) {
          animFrames.current[colIndex] = requestAnimationFrame(tick);
        } else {
          // 最終シンボルを確定
          setDisplayGrid(prev => {
            const next = [...prev];
            for (let row = 0; row < 3; row++) {
              next[row * 3 + colIndex] = finalSymbols[row * 3 + colIndex];
            }
            return next;
          });
          setSpinningCols(prev => { const n = [...prev]; n[colIndex] = false; return n; });
          setReelOffsets(prev => { const n = [...prev]; n[colIndex] = 0; return n; });
          resolve();
        }
      };
      animFrames.current[colIndex] = requestAnimationFrame(tick);
    });
  }, []);

  const startSpin = useCallback(async () => {
    if (statusRef.current !== 'IDLE') return;
    if (balance < bet) { showToast("残高が足りません！", 'error'); autoRef.current = false; setAutoSpin(false); return; }

    statusRef.current = 'SPINNING';
    setSlotStatus('SPINNING');
    setWinLines([]); setWinMessage(''); setWinAmount(0); setJackpotFlash(false);
    setSpinCount(c => c + 1);
    await updateBalance(-bet);

    // 確定グリッドを事前生成
    const finalGrid = generateFinalGrid();
    finalGridRef.current = finalGrid;

    // 全リールをスピン中に
    setSpinningCols([true, true, true]);

    // リール停止タイミング（列ごとにずらす）
    const stopTimes = [900, 1400, 1900];
    const spinPromises = [0, 1, 2].map(col => spinReel(col, finalGrid, stopTimes[col]));
    await Promise.all(spinPromises);

    // 全リール停止後に判定
    statusRef.current = 'RESULT';
    setSlotStatus('RESULT');

    const grid = finalGridRef.current;
    let totalMult = 0;
    const hitLines = [];
    LINES.forEach(line => {
      const syms = line.map(i => SYMBOLS[grid[i]].sym);
      const match = PAYTABLE.find(p => p.combo[0] === syms[0] && p.combo[1] === syms[1] && p.combo[2] === syms[2]);
      if (match) {
        totalMult += match.mult;
        hitLines.push({ line, mult: match.mult, label: match.label, color: match.color, glow: match.glow });
      }
    });

    if (totalMult > 0) {
      const amount = bet * totalMult;
      setWinAmount(amount);
      setTotalWin(w => w + amount - bet);
      const top = hitLines.sort((a, b) => b.mult - a.mult)[0];
      setWinMessage(`${top.label} ×${totalMult}`);
      setWinLines(hitLines);
      await updateBalance(amount);
      if (totalMult >= 50) { setJackpotFlash(true); }
    } else {
      setWinMessage('LOSE');
      setTotalWin(w => w - bet);
    }

    const delay = autoRef.current ? (totalMult >= 30 ? 2000 : 800) : (totalMult > 0 ? 2500 : 1500);
    setTimeout(() => {
      statusRef.current = 'IDLE';
      setSlotStatus('IDLE');
      setWinMessage('');
      setWinLines([]);
      setJackpotFlash(false);
      if (autoRef.current) startSpin();
    }, delay);
  }, [balance, bet, updateBalance, generateFinalGrid, spinReel]);

  const toggleAuto = () => {
    const n = !autoSpin;
    autoRef.current = n;
    setAutoSpin(n);
    if (n && statusRef.current === 'IDLE') startSpin();
  };

  useEffect(() => () => {
    animFrames.current.forEach(f => f && cancelAnimationFrame(f));
  }, []);

  const isHighlighted = idx => winLines.some(wl => wl.line.includes(idx));
  const getWinGlow = idx => {
    const wl = winLines.find(w => w.line.includes(idx));
    return wl ? wl.glow : '';
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center">
      {/* ジャックポット演出 */}
      {jackpotFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute text-2xl animate-bounce" style={{
              left: `${Math.random() * 90}%`,
              top: `${Math.random() * 90}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }}>⭐</div>
          ))}
        </div>
      )}

      {/* ヘッダー */}
      <div className="w-full flex justify-between items-center mb-6">
        <button onClick={() => { autoRef.current = false; setAutoSpin(false); onBack(); }} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> 戻る</button>
        <div className="flex items-center gap-4">
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">SPINS</div><div className="font-mono text-yellow-400 font-bold">{spinCount}</div></div>
          <div className="text-center"><div className="text-xs text-gray-500 font-bold">NET</div><div className={`font-mono font-bold ${totalWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalWin >= 0 ? '+' : ''}{totalWin.toLocaleString()}</div></div>
          <div className="bg-gray-900/95 px-5 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
        </div>
      </div>

      {/* スロット本体 */}
      <div className={`bg-gradient-to-b from-gray-800 to-gray-950 p-6 rounded-[2rem] border-8 shadow-2xl w-full relative transition-all ${jackpotFlash ? 'border-yellow-500 shadow-yellow-500/30' : 'border-gray-900'}`}>

        {/* 勝利メッセージオーバーレイ */}
        {winMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className={`text-4xl md:text-5xl font-black drop-shadow-2xl text-center px-6 py-4 rounded-2xl
              ${winAmount > 0
                ? 'text-yellow-400 bg-black/80 border-2 border-yellow-500/50 animate-bounce'
                : 'text-gray-500 bg-black/60'}`}>
              {winMessage}
              {winAmount > 0 && (
                <div className="text-xl text-emerald-400 mt-1">+{winAmount.toLocaleString()} G</div>
              )}
            </div>
          </div>
        )}

        {/* リールグリッド */}
        <div className="relative mb-5">
          {/* ライン表示用オーバーレイ（当選ライン強調） */}
          <div className="grid grid-cols-3 gap-3">
            {displayGrid.map((symIdx, i) => {
              const sym = SYMBOLS[symIdx];
              const hl = isHighlighted(i);
              const glow = getWinGlow(i);
              const col = i % 3;
              const isSpinning = spinningCols[col];

              return (
                <div
                  key={i}
                  className={`bg-gradient-to-b from-white to-gray-100 rounded-xl flex items-center justify-center
                    h-24 md:h-28 shadow-inner transition-all duration-150 border-4 overflow-hidden relative
                    ${hl ? `border-yellow-400 shadow-lg ${glow} scale-105` : 'border-gray-200'}
                    ${isSpinning ? 'brightness-90' : ''}`}
                >
                  {/* スピン中のブラー演出 */}
                  {isSpinning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-60">
                      {[-1, 0, 1].map(offset => {
                        const offsetIdx = (symIdx + offset + SYMBOLS.length) % SYMBOLS.length;
                        return (
                          <span key={offset} className={`text-2xl ${offset === 0 ? 'text-3xl' : 'text-xl opacity-50'}`}>
                            {SYMBOLS[offsetIdx].sym === 'BAR' ? <span className="text-gray-800 font-black text-base">BAR</span> : SYMBOLS[offsetIdx].sym}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* 停止中のシンボル */}
                  {!isSpinning && (
                    <div className="flex flex-col items-center">
                      <span className={`text-4xl md:text-5xl ${hl ? 'drop-shadow-lg' : ''}`}>
                        {sym.name === 'BAR'
                          ? <span className="text-2xl font-black text-gray-800 tracking-tight">BAR</span>
                          : sym.sym
                        }
                      </span>
                    </div>
                  )}
                  {/* 当選セルのキラキラ */}
                  {hl && !isSpinning && (
                    <div className="absolute top-1 right-1">
                      <Star size={12} className="text-yellow-400 fill-yellow-400 animate-spin" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* スピン中のリール速度インジケーター */}
          <div className="flex gap-3 mt-2 justify-center">
            {[0, 1, 2].map(col => (
              <div key={col} className={`h-1 flex-1 rounded-full transition-all duration-200 ${spinningCols[col] ? 'bg-yellow-400 animate-pulse' : 'bg-gray-800'}`}></div>
            ))}
          </div>
        </div>

        {/* 当選ライン表示 */}
        {winLines.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {winLines.map((wl, i) => (
              <span key={i} className={`text-sm font-bold px-3 py-1.5 rounded-full bg-gray-900 border border-gray-700 ${wl.color} shadow-lg`}>
                {wl.label} ×{wl.mult}
              </span>
            ))}
          </div>
        )}

        {/* コントロール */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-950 p-5 rounded-xl border border-gray-800 gap-4">
          <div className="flex gap-3 items-center">
            <span className="text-gray-400 font-bold text-sm">BET</span>
            <select
              value={bet}
              onChange={e => setBet(Number(e.target.value))}
              disabled={slotStatus !== 'IDLE'}
              className="bg-gray-900 text-yellow-500 font-mono text-lg p-3 rounded-lg border border-gray-800 outline-none font-bold disabled:opacity-60"
            >
              {[10, 100, 500, 1000, 5000, 10000].map(v => (
                <option key={v} value={v}>{v.toLocaleString()}G</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 items-center">
            {/* ラッキーナンバー表示 */}
            <div className="text-xs text-gray-600 text-center hidden md:block">
              <div>RTP</div>
              <div className="text-gray-500 font-mono">~85%</div>
            </div>
            <button
              onClick={toggleAuto}
              className={`px-5 py-3 rounded-xl font-black transition active:scale-95 border text-sm ${
                autoSpin
                  ? 'bg-orange-600 border-orange-500 text-white shadow-orange-500/30 shadow-lg'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {autoSpin ? '🔄 AUTO' : 'AUTO'}
            </button>
            <button
              onClick={startSpin}
              disabled={slotStatus !== 'IDLE' || balance < bet}
              className={`bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300
                text-black font-black py-3 px-10 rounded-full text-xl shadow-lg shadow-yellow-500/20
                disabled:opacity-50 disabled:cursor-not-allowed transition-all transform
                hover:scale-105 active:scale-95 hover:shadow-yellow-400/40`}
            >
              {slotStatus === 'SPINNING' ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={18} className="animate-spin" /> SPIN
                </span>
              ) : 'SPIN'}
            </button>
          </div>
        </div>
      </div>

      {/* ペイテーブル */}
      <div className="mt-5 bg-gray-900/50 p-5 rounded-xl w-full border border-gray-800">
        <h3 className="text-gray-400 font-bold mb-3 text-center tracking-widest text-sm">
          PAYTABLE — 8ライン有効（横3・縦3・斜め2）
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          {PAYTABLE.map((p, i) => (
            <div key={i} className={`bg-black/50 p-2 rounded-lg text-center border border-gray-800 hover:border-gray-600 transition`}>
              <div className="text-lg mb-1">{p.combo.join('')}</div>
              <div className={`font-black ${p.color}`}>×{p.mult}</div>
              <div className="text-gray-600 text-xs mt-0.5">{p.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-xs text-gray-600">
          ※重み付き確率：7は最レア (weight:1) / チェリーは最多 (weight:30)
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Horse Racing
// ==========================================
function HorseRacing({ balance, updateBalance, onBack, showToast }) {
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

  const BET_TYPES = {
    WIN:   { label: '単勝', desc: '1着的中',   mult: (h) => h.odds },
    PLACE: { label: '複勝', desc: '3着以内',   mult: (h) => h.odds * 0.4 },
    SHOW:  { label: '馬連', desc: '2着以内',   mult: (h) => h.odds * 0.6 },
  };
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
            <input type="number" value={raceBet} onChange={e => setRaceBet(Number(e.target.value))}
              className="w-full bg-gray-900 text-white font-mono text-lg p-3 rounded-lg border border-gray-800 focus:border-yellow-500 outline-none mb-2" min="10" step="10" disabled={isRacing} />
            {selectedHorse && (
              <div className="text-xs text-gray-400 mb-3 text-center">
                的中時: <span className="text-yellow-400 font-bold">{Math.floor(raceBet * BET_TYPES[betType].mult(INITIAL_HORSES.find(h => h.id === selectedHorse))).toLocaleString()} G</span>
              </div>
            )}
            <button onClick={startRace} disabled={isRacing || !selectedHorse || balance < raceBet}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black py-3 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
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
// Component: Labor (英単語バイト)
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
    setQuestions(pool);
    setCurrentQ(0); setScore(0); setInput(''); setFeedback(null); setTimeLeft(10);
    setPhase('QUIZ');
  };

  useEffect(() => {
    if (phase !== 'QUIZ') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleAnswer(''); return 10; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, currentQ]);

  useEffect(() => {
    if (phase === 'QUIZ' && inputRef.current) inputRef.current.focus();
  }, [currentQ, phase]);

  const handleAnswer = (ans) => {
    clearInterval(timerRef.current);
    const correct = questions[currentQ]?.en?.toLowerCase();
    const isCorrect = ans.trim().toLowerCase() === correct;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore(s => s + 1);

    setTimeout(() => {
      setFeedback(null); setInput(''); setTimeLeft(10);
      if (currentQ + 1 >= QUIZ_COUNT) {
        finishQuiz(isCorrect ? score + 1 : score);
      } else {
        setCurrentQ(q => q + 1);
      }
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
              <button key={i} onClick={() => startQuiz(i)}
                className={`w-full p-6 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] hover:-translate-y-1 ${lv.bg}`}>
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
            {feedback && (
              <p className={`text-2xl font-black mt-4 ${feedback === 'correct' ? 'text-emerald-400' : 'text-red-400'}`}>
                {feedback === 'correct' ? '✅ 正解！' : '❌ 不正解... 正解: ' + q.en}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !feedback && handleAnswer(input)}
              placeholder="英単語を入力して Enter"
              disabled={!!feedback}
              className="flex-1 bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border-2 border-gray-800 focus:outline-none focus:border-yellow-500 disabled:opacity-50" />
            <button onClick={() => !feedback && handleAnswer(input)} disabled={!!feedback}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 rounded-xl transition active:scale-95 disabled:opacity-50">
              回答
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-3">スペルは完全一致（大文字小文字は不問）</p>
        </div>
      )}

      {phase === 'RESULT' && (
        <div className="text-center">
          <div className="bg-gray-900 p-10 rounded-3xl border border-gray-800 shadow-2xl mb-6">
            <div className="text-6xl mb-4">{score === QUIZ_COUNT ? '🏆' : score >= 3 ? '👍' : '😢'}</div>
            <h3 className="text-4xl font-black text-white mb-2">バイト終了！</h3>
            <p className="text-gray-400 mb-6">{WORD_LEVELS[level].label} / {QUIZ_COUNT}問中</p>
            <div className="text-7xl font-black text-yellow-400 mb-2">{score}<span className="text-3xl text-gray-400">/{QUIZ_COUNT}</span></div>
            <p className="text-gray-400 mb-6">正解</p>
            {score === QUIZ_COUNT && <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-3 mb-4 text-yellow-400 font-bold">🎉 全問正解ボーナス×1.5適用！</div>}
            <div className="text-4xl font-black text-emerald-400">+{totalEarned.toLocaleString()} G</div>
            <p className="text-gray-500 text-sm mt-1">獲得報酬</p>
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