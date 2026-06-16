import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment, collection, writeBatch } from 'firebase/firestore';
import { Coins, Trophy, ArrowLeft, AlertCircle, PlaySquare, Landmark, Send, ChevronRight, RefreshCw } from 'lucide-react';
import { firebaseConfig, appId } from './firebaseConfig';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Constants ---
const SYMBOLS = ['🍒', '🔔', '🍉', '🍇', '💎', 'BAR', '7️⃣'];
const INITIAL_HORSES = [
  { id: 1, name: 'シンボリルドルフ', odds: 2.5, color: 'bg-white text-black', position: 0 },
  { id: 2, name: 'トウカイテイオー', odds: 3.2, color: 'bg-gray-800 text-white', position: 0 },
  { id: 3, name: 'オグリキャップ', odds: 5.0, color: 'bg-red-500 text-white', position: 0 },
  { id: 4, name: 'ディープインパクト', odds: 1.8, color: 'bg-blue-500 text-white', position: 0 },
  { id: 5, name: 'ゴールドシップ', odds: 15.0, color: 'bg-yellow-400 text-black', position: 0 },
];

const INTEREST_RATE_30SEC = 0.001;
const INTEREST_INTERVAL = 30000;

export default function App() {
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [inputName, setInputName] = useState('');
  const [balance, setBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [lastInterestTime, setLastInterestTime] = useState(Date.now());
  const [view, setView] = useState('LOGIN');
  const [loadingMsg, setLoadingMsg] = useState('通信を確立中...');
  const [toastMsg, setToastMsg] = useState('');
  const [rankingData, setRankingData] = useState([]);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [bankInput, setBankInput] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
        showToast("認証エラーが発生しました。");
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
        setLastInterestTime(data.lastInterestTime || Date.now());
        calculateOfflineInterest(data, docRef);
      } else {
        const now = Date.now();
        setDoc(docRef, {
          balance: 10000,
          bankBalance: 0,
          lastInterestTime: now,
          createdAt: now,
          name: playerName
        });
        setBalance(10000);
        setBankBalance(0);
        setLastInterestTime(now);
      }
    }, (error) => {
      console.error("Firestore error:", error);
      showToast("データの同期に失敗しました。");
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
        updateDoc(docRef, {
          bankBalance: increment(interest),
          lastInterestTime: Date.now()
        });
        showToast(`🏦 銀行利子 +${interest} G が付与されました！`);
      }
    }, INTEREST_INTERVAL);
    return () => clearInterval(timer);
  }, [user, playerName, bankBalance]);

  useEffect(() => {
    if (!user || (view !== 'RANKING' && view !== 'MENU')) return;
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'players');
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const players = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const total = (data.balance || 0) + (data.bankBalance || 0);
        players.push({
          name: data.name || decodeURIComponent(doc.id),
          balance: data.balance || 0,
          bankBalance: data.bankBalance || 0,
          total: total
        });
      });
      players.sort((a, b) => b.total - a.total);
      setRankingData(players.slice(0, 10));
    }, (error) => {
      console.error("Ranking snapshot error:", error);
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
        await updateDoc(docRef, {
          bankBalance: increment(totalInterest),
          lastInterestTime: now
        });
        showToast(`🏦 不労所得！不在の間に利子 +${totalInterest} G が貯まりました！`);
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
      showToast("残高の更新に失敗しました。");
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleLogin = () => {
    if (inputName.trim().length < 2) {
      showToast("名前は2文字以上で入力してください。");
      return;
    }
    setPlayerName(inputName.trim());
    setView('MENU');
  };

  const claimRelief = () => {
    if (balance < 100 && bankBalance < 100) {
      updateBalance(1000);
      showToast("【救済】1000Gを受け取りました！がんばりましょう！");
    } else {
      showToast("まだ資金、または銀行口座に資産があります！");
    }
  };

  const handleBankAction = async (action) => {
    const amount = parseInt(bankInput);
    if (isNaN(amount) || amount <= 0) { showToast("有効な数値を入力してください。"); return; }
    const safeName = encodeURIComponent(playerName);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', safeName);
    if (action === 'DEPOSIT') {
      if (balance < amount) { showToast("手元の所持金が足りません！"); return; }
      await updateDoc(docRef, { balance: increment(-amount), bankBalance: increment(amount), lastInterestTime: Date.now() });
      showToast(`🏦 銀行に ${amount} G 預け入れました。`);
    } else if (action === 'WITHDRAW') {
      if (bankBalance < amount) { showToast("銀行残高が足りません！"); return; }
      await updateDoc(docRef, { balance: increment(amount), bankBalance: increment(-amount), lastInterestTime: Date.now() });
      showToast(`🏦 銀行から ${amount} G 引き出しました。`);
    }
    setBankInput('');
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    const target = transferTarget.trim();
    if (!target || target === playerName) { showToast("自分以外の有効なプレイヤー名を入力してください。"); return; }
    if (isNaN(amount) || amount <= 0) { showToast("送金金額を正しく入力してください。"); return; }
    if (balance < amount) { showToast("送金するための所持金が足りません！"); return; }
    try {
      const targetSafeName = encodeURIComponent(target);
      const targetDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', targetSafeName);
      const targetSnap = await getDoc(targetDocRef);
      if (!targetSnap.exists()) { showToast(`プレイヤー「${target}」が見つかりません。`); return; }
      const selfSafeName = encodeURIComponent(playerName);
      const selfDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', selfSafeName);
      const batch = writeBatch(db);
      batch.update(selfDocRef, { balance: increment(-amount) });
      batch.update(targetDocRef, { balance: increment(amount) });
      await batch.commit();
      showToast(`💸 ${target} 様へ ${amount} G 送金しました！`);
      setTransferTarget(''); setTransferAmount(''); setView('MENU');
    } catch (e) {
      console.error("Transfer error:", e);
      showToast("送金処理中にエラーが発生しました。");
    }
  };

  if (loadingMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <RefreshCw className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="font-bold text-lg">{loadingMsg}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {toastMsg && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500 text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-yellow-400 font-bold max-w-sm text-center">
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
              <input
                type="text" value={inputName} onChange={(e)=>setInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full p-4 rounded-xl bg-gray-950 text-white border-2 border-gray-800 mb-6 focus:outline-none focus:border-yellow-500 text-center text-2xl font-bold transition-all shadow-inner"
                placeholder="登録名・引き継ぎ名" maxLength={12}
              />
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
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="bg-gray-900/90 border border-gray-800 px-6 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-xl w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Coins className="text-yellow-500" size={20} />
                    <span className="text-xs text-gray-400 font-bold block">所持金</span>
                  </div>
                  <span className="font-mono text-xl font-black text-yellow-400">{balance.toLocaleString()} G</span>
                </div>
                <div className="bg-gray-900/90 border border-gray-800 px-6 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-xl w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Landmark className="text-emerald-400" size={20} />
                    <span className="text-xs text-gray-400 font-bold block">銀行残高</span>
                  </div>
                  <span className="font-mono text-xl font-black text-emerald-400">{bankBalance.toLocaleString()} G</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <button onClick={() => setView('SLOT')} className="group relative overflow-hidden bg-gradient-to-br from-purple-950 to-indigo-950 p-8 rounded-3xl shadow-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 text-purple-500/10 group-hover:text-purple-400/20 transition-all duration-500 scale-110">
                  <PlaySquare size={160} />
                </div>
                <span className="bg-purple-500/10 text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Casino Game</span>
                <h2 className="text-3xl font-extrabold text-white mb-3 group-hover:text-purple-300 transition">SLOT MACHINE</h2>
                <p className="text-gray-400 text-base leading-relaxed">一瞬の目押しで大金をつかみ取れ。ボーナスフラグ、特殊配当を完備した本格派スロット。</p>
              </button>

              <button onClick={() => setView('RACE')} className="group relative overflow-hidden bg-gradient-to-br from-emerald-950 to-green-950 p-8 rounded-3xl shadow-2xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all transform hover:-translate-y-1 text-left">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 text-emerald-500/10 group-hover:text-emerald-400/20 transition-all duration-500 scale-110">
                  <Trophy size={160} />
                </div>
                <span className="bg-emerald-500/10 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Sport Betting</span>
                <h2 className="text-3xl font-extrabold text-white mb-3 group-hover:text-emerald-300 transition">VIRTUAL TURF</h2>
                <p className="text-gray-400 text-base leading-relaxed">リアルタイムシミュレーション。血統とオッズを見極め、競馬界の頂点へ賭けろ。</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setView('BANK')} className="flex items-center justify-between p-6 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition transform hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><Landmark size={24} /></div>
                  <div className="text-left">
                    <span className="font-bold text-white block">グランドバンク</span>
                    <span className="text-xs text-emerald-400 font-semibold">30秒毎に +0.1% 利子発生</span>
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
                    <span className="font-bold text-white block">長者番付（ランキング）</span>
                    <span className="text-xs text-gray-400">オンライン富豪トップ10</span>
                  </div>
                </div>
                <ChevronRight className="text-gray-500" size={20} />
              </button>
            </div>

            <div className="mt-12 bg-gray-900/50 p-6 rounded-2xl border border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-gray-400 uppercase font-bold tracking-widest block mb-1">Your Total Wealth</span>
                <span className="text-2xl font-black font-mono text-yellow-500">{(balance + bankBalance).toLocaleString()} G</span>
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
          <div className="p-6 md:p-12 max-w-2xl mx-auto">
            <button onClick={() => setView('MENU')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"><ArrowLeft size={20} /> メニューに戻る</button>
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 p-8 rounded-3xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><Landmark size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black text-white">GRAND BANK</h2>
                  <p className="text-sm text-emerald-400 font-semibold">現在の金利: 30秒ごとに +0.1%複利</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-900">
                  <span className="text-xs text-gray-400 block mb-1 font-bold">手元の所持金</span>
                  <span className="text-xl font-mono font-black text-yellow-500">{balance.toLocaleString()} G</span>
                </div>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-900">
                  <span className="text-xs text-gray-400 block mb-1 font-bold">預金残高</span>
                  <span className="text-xl font-mono font-black text-emerald-400">{bankBalance.toLocaleString()} G</span>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm text-gray-400 font-bold mb-2">取引金額 (G)</label>
                <div className="relative">
                  <input type="number" value={bankInput} onChange={e => setBankInput(e.target.value)} placeholder="金額を入力"
                    className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-emerald-500 shadow-inner" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button onClick={() => setBankInput(balance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1 rounded font-bold transition">所持金全額</button>
                    <button onClick={() => setBankInput(bankBalance.toString())} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1 rounded font-bold transition text-emerald-400">預金全額</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => handleBankAction('DEPOSIT')} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black transition transform active:scale-95 text-lg">預け入れる</button>
                <button onClick={() => handleBankAction('WITHDRAW')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-black border border-gray-700 transition transform active:scale-95 text-lg">引き出す</button>
              </div>
              <p className="text-center text-xs text-gray-500 mt-6 leading-relaxed">
                ※銀行に預けている間のみ、30秒ごとに預金残高の0.1%が利子として発生します。<br/>
                ログアウト中も次回ログイン時に自動計算されて付与されます。
              </p>
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
                  <p className="text-sm text-gray-400">他のプレイヤーへ安全にゴールドを直接送金します</p>
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
                    className="w-full bg-gray-950 text-white font-bold p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-blue-500 shadow-inner" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 font-bold mb-2">送金金額 (G)</label>
                  <div className="relative">
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="金額を入力"
                      className="w-full bg-gray-950 text-white font-mono text-xl p-4 rounded-xl border border-gray-800 focus:outline-none focus:border-blue-500 shadow-inner" />
                    <button onClick={() => setTransferAmount(balance.toString())} className="absolute right-3 top-3.5 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-1.5 rounded font-bold transition">全額</button>
                  </div>
                </div>
              </div>
              <button onClick={handleTransfer} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black transition transform active:scale-95 text-lg flex items-center justify-center gap-2">
                <Send size={20} /> 安全に送金を実行する
              </button>
              <p className="text-center text-xs text-gray-500 mt-6">※一度送信された資金は元に戻せません。</p>
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
                  <p className="text-sm text-gray-400">総資産ランキング (所持金 ＋ 預金)</p>
                </div>
              </div>
              <div className="space-y-3">
                {rankingData.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">プレイヤーがまだ存在しません。</p>
                ) : (
                  rankingData.map((player, index) => {
                    const isSelf = player.name === playerName;
                    let rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                    return (
                      <div key={player.name} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelf ? 'bg-yellow-500/10 border-yellow-500' : 'bg-gray-950/60 border-gray-800 hover:bg-gray-900/60'}`}>
                        <div className="flex items-center gap-4">
                          <span className="w-8 text-center text-xl font-bold">{rankBadge}</span>
                          <div>
                            <span className={`font-bold text-lg block ${isSelf ? 'text-yellow-400' : 'text-white'}`}>
                              {player.name} {isSelf && <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded ml-1 font-black">YOU</span>}
                            </span>
                            <div className="flex items-center gap-4 text-xs text-gray-500 font-semibold">
                              <span>手元: {player.balance.toLocaleString()}G</span>
                              <span>銀行: {player.bankBalance.toLocaleString()}G</span>
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
// Component: Slot Machine
// ==========================================
function SlotMachine({ balance, updateBalance, onBack, showToast }) {
  const [bet, setBet] = useState(100);
  const [reels, setReels] = useState([0, 0, 0]);
  const [isSpinning, setIsSpinning] = useState([false, false, false]);
  const [slotStatus, setSlotStatus] = useState('IDLE');
  const [winMessage, setWinMessage] = useState('');
  const [winAmount, setWinAmount] = useState(0);
  const isSpinningRef = useRef([false, false, false]);
  const reqRef = useRef(null);

  const getDisplaySymbols = (index) => {
    const prev = (index - 1 + SYMBOLS.length) % SYMBOLS.length;
    const next = (index + 1) % SYMBOLS.length;
    return [SYMBOLS[prev], SYMBOLS[index], SYMBOLS[next]];
  };

  const startSpin = async () => {
    if (balance < bet) { showToast("残高が足りません！"); return; }
    await updateBalance(-bet);
    isSpinningRef.current = [true, true, true];
    setIsSpinning([true, true, true]);
    setSlotStatus('SPINNING');
    setWinMessage(''); setWinAmount(0);
    let lastTime = performance.now();
    const spinLoop = (time) => {
      if (time - lastTime > 60) {
        setReels(prev => {
          const next = [...prev];
          if (isSpinningRef.current[0]) next[0] = (next[0] + 1) % SYMBOLS.length;
          if (isSpinningRef.current[1]) next[1] = (next[1] + 1) % SYMBOLS.length;
          if (isSpinningRef.current[2]) next[2] = (next[2] + 1) % SYMBOLS.length;
          return next;
        });
        lastTime = time;
      }
      if (isSpinningRef.current.some(s => s)) reqRef.current = requestAnimationFrame(spinLoop);
    };
    reqRef.current = requestAnimationFrame(spinLoop);
  };

  const stopReel = (idx) => {
    isSpinningRef.current[idx] = false;
    setIsSpinning([...isSpinningRef.current]);
  };

  useEffect(() => {
    if (slotStatus === 'SPINNING' && !isSpinning.includes(true)) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      const s1 = SYMBOLS[reels[0]], s2 = SYMBOLS[reels[1]], s3 = SYMBOLS[reels[2]];
      let multiplier = 0, msg = '';
      if (s1 === s2 && s2 === s3) {
        if (s1 === '7️⃣') { multiplier = 100; msg = 'JACKPOT!!!'; }
        else if (s1 === 'BAR') { multiplier = 50; msg = 'BIG BONUS!!'; }
        else if (s1 === '💎') { multiplier = 30; msg = 'MEGA WIN!'; }
        else if (s1 === '🍉') { multiplier = 20; msg = 'SUPER WIN!'; }
        else if (s1 === '🔔') { multiplier = 10; msg = 'WIN!'; }
        else if (s1 === '🍇') { multiplier = 5; msg = 'WIN!'; }
        else if (s1 === '🍒') { multiplier = 3; msg = 'WIN!'; }
      } else if (s1 === '🍒' && s2 === '🍒') { multiplier = 2; msg = 'CHERRY x2'; }
        else if (s1 === '🍒') { multiplier = 1; msg = 'CHERRY x1'; }
      if (multiplier > 0) {
        const amount = bet * multiplier;
        setWinAmount(amount); setWinMessage(msg); updateBalance(amount);
      } else { setWinAmount(0); setWinMessage('LOSE...'); }
      setSlotStatus('RESULT');
      setTimeout(() => { setSlotStatus('IDLE'); setWinMessage(''); }, 3000);
    }
  }, [isSpinning, slotStatus, reels, bet, updateBalance]);

  useEffect(() => { return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); }; }, []);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> メニューに戻る</button>
        <div className="bg-gray-900/95 px-6 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
      </div>
      <div className="bg-gradient-to-b from-gray-800 to-gray-950 p-8 rounded-[2rem] border-8 border-gray-900 shadow-2xl w-full relative">
        {winMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className={`text-6xl md:text-8xl font-black drop-shadow-lg ${winAmount > 0 ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`}>{winMessage}</div>
          </div>
        )}
        <div className="bg-black p-4 md:p-8 rounded-2xl flex justify-between gap-2 md:gap-4 relative overflow-hidden border-4 border-gray-950 shadow-inner">
          <div className="absolute top-1/2 left-0 w-full h-1 md:h-2 bg-red-500/50 z-20 shadow-[0_0_15px_red] transform -translate-y-1/2"></div>
          {[0,1,2].map(idx => (
            <div key={idx} className="flex-1 bg-white flex flex-col items-center justify-center text-5xl md:text-7xl h-48 md:h-72 overflow-hidden rounded-lg shadow-inner relative">
              <div className="flex flex-col h-[300%] absolute top-0 w-full transition-transform duration-75">
                {getDisplaySymbols(reels[idx]).map((sym, i) => (
                  <div key={i} className={`h-1/3 flex items-center justify-center w-full ${i===1 ? 'z-10 scale-110' : 'opacity-40 scale-90'}`}>{sym}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-8 gap-4">
          {[0,1,2].map(idx => (
            <button key={idx} disabled={!isSpinning[idx]} onClick={() => stopReel(idx)}
              className={`flex-1 py-4 md:py-6 text-xl md:text-2xl font-black rounded-xl uppercase tracking-widest transition-all ${isSpinning[idx] ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_6px_0_#7f1d1d] active:shadow-none active:translate-y-1' : 'bg-gray-800 text-gray-600 border border-gray-700'}`}>
              STOP
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center bg-gray-950 p-6 rounded-xl border border-gray-800 gap-4">
          <div className="flex gap-4 items-center w-full md:w-auto">
            <span className="text-gray-400 font-bold tracking-widest">BET</span>
            <select value={bet} onChange={e=>setBet(Number(e.target.value))} disabled={slotStatus !== 'IDLE'}
              className="bg-gray-900 text-yellow-500 font-mono text-xl p-3 rounded-lg border border-gray-800 outline-none flex-1 md:flex-none text-center font-bold">
              <option value="10">10 G</option>
              <option value="100">100 G</option>
              <option value="500">500 G</option>
              <option value="1000">1000 G</option>
              <option value="5000">5000 G</option>
            </select>
          </div>
          <button onClick={startSpin} disabled={slotStatus !== 'IDLE' || balance < bet}
            className="w-full md:w-auto bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black py-4 px-12 rounded-full text-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 animate-pulse">
            SPIN
          </button>
        </div>
      </div>
      <div className="mt-8 bg-gray-900/50 p-6 rounded-xl w-full border border-gray-800">
        <h3 className="text-gray-400 font-bold mb-4 text-center tracking-widest">PAYTABLE</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm md:text-base">
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">7️⃣7️⃣7️⃣</span> : x100</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">BAR x3</span> : x50</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">💎💎💎</span> : x30</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">🍉🍉🍉</span> : x20</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">🔔🔔🔔</span> : x10</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">🍇🍇🍇</span> : x5</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">🍒🍒🍒</span> : x3</div>
          <div className="bg-black/50 p-2 rounded text-center"><span className="text-xl">🍒 Any</span> : x1~2</div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: Horse Racing
// ==========================================
function HorseRacing({ balance, updateBalance, onBack, showToast }) {
  const [horses, setHorses] = useState(INITIAL_HORSES);
  const [selectedHorse, setSelectedHorse] = useState(null);
  const [raceBet, setRaceBet] = useState(100);
  const [isRacing, setIsRacing] = useState(false);
  const [raceResult, setRaceResult] = useState(null);

  const startRace = async () => {
    if (!selectedHorse) { showToast("予想する馬を選択してください"); return; }
    if (balance < raceBet) { showToast("残高が足りません！"); return; }
    await updateBalance(-raceBet);
    setIsRacing(true); setRaceResult(null);
    setHorses(INITIAL_HORSES.map(h => ({ ...h, position: 0 })));
  };

  useEffect(() => {
    if (!isRacing) return;
    let animationFrameId;
    let currentHorses = horses.map(h => ({ ...h }));
    const raceLoop = () => {
      let isFinished = false;
      currentHorses = currentHorses.map(horse => {
        const baseSpeed = 0.8;
        const oddsFactor = 3 / horse.odds;
        const randomSpurt = Math.random() > 0.98 ? Math.random() * 2 : 0;
        const moveAmount = (baseSpeed * oddsFactor * Math.random()) + (Math.random() * 0.8) + randomSpurt;
        const newPos = Math.min(100, horse.position + moveAmount);
        if (newPos >= 100) isFinished = true;
        return { ...horse, position: newPos };
      });
      setHorses([...currentHorses]);
      if (isFinished) {
        setIsRacing(false);
        const winner = currentHorses.reduce((prev, current) => (prev.position > current.position) ? prev : current);
        setRaceResult(winner);
        if (winner.id === selectedHorse) {
          const winAmount = Math.floor(raceBet * winner.odds);
          updateBalance(winAmount);
        }
      } else {
        animationFrameId = requestAnimationFrame(raceLoop);
      }
    };
    animationFrameId = requestAnimationFrame(raceLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRacing]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition" disabled={isRacing}><ArrowLeft size={20} /> メニューに戻る</button>
        <div className="bg-gray-900/95 px-6 py-2 rounded-full border border-gray-800 font-mono text-xl text-yellow-500 font-bold">{balance.toLocaleString()} G</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col h-full">
          <h3 className="text-xl font-bold mb-4 text-white border-b border-gray-800 pb-3 flex items-center justify-between">
            <span>出馬表 (単勝)</span><span className="text-sm font-normal text-gray-400">オッズ</span>
          </h3>
          <div className="space-y-3 mb-8 flex-1">
            {horses.map(h => (
              <button key={h.id} onClick={() => !isRacing && setSelectedHorse(h.id)} disabled={isRacing}
                className={`w-full flex justify-between items-center p-3 rounded-xl transition-all border-2 text-left ${selectedHorse === h.id ? 'border-yellow-500 bg-gray-800' : 'border-transparent hover:bg-gray-800 bg-gray-950/50'} ${isRacing && 'opacity-75 cursor-not-allowed'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex justify-center items-center rounded-lg text-sm font-black shadow-md ${h.color}`}>{h.id}</span>
                  <span className="font-bold text-white">{h.name}</span>
                </div>
                <span className="font-mono text-yellow-400 font-bold text-lg">{h.odds.toFixed(1)}</span>
              </button>
            ))}
          </div>
          <div className="bg-gray-950 p-5 rounded-xl border border-gray-800">
            <label className="block text-sm text-gray-400 font-bold mb-2">BET額 (G)</label>
            <input type="number" value={raceBet} onChange={e => setRaceBet(Number(e.target.value))}
              className="w-full bg-gray-900 text-white font-mono text-xl p-3 rounded-lg border border-gray-800 focus:border-yellow-500 outline-none mb-4"
              min="10" step="10" disabled={isRacing} />
            <button onClick={startRace} disabled={isRacing || !selectedHorse || balance < raceBet}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black py-4 rounded-xl text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95">
              {isRacing ? 'レース中...' : '出走する'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-gradient-to-b from-emerald-800 to-green-950 rounded-2xl p-2 md:p-6 h-[400px] md:h-[450px] relative overflow-hidden border-8 border-gray-900 shadow-2xl flex flex-col justify-between">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,0,0,0.2) 40px, rgba(0,0,0,0.2) 80px)'}}></div>
            <div className="absolute right-[8%] top-0 bottom-0 w-4 bg-white/30 border-x-2 border-white z-0 flex flex-col justify-around text-white/50 text-xs font-black overflow-hidden">
              <span>G</span><span>O</span><span>A</span><span>L</span>
            </div>
            {horses.map((h) => (
              <div key={h.id} className="relative flex-1 flex items-center border-b border-green-950/30 last:border-0 z-10 w-[92%]">
                <div className="absolute flex items-center transition-all duration-75 ease-linear" style={{ left: `${h.position}%`, transform: 'translateX(-50%)' }}>
                  <div className="flex flex-col items-center">
                    <span className="text-4xl drop-shadow-lg">🐎</span>
                    <div className={`w-6 h-6 -mt-2 flex justify-center items-center rounded-full text-xs font-black shadow-xl border border-gray-800 z-20 ${h.color}`}>{h.id}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 p-6 rounded-2xl text-center min-h-[120px] flex flex-col justify-center border border-gray-800 shadow-xl">
            {raceResult ? (
              <div>
                <h3 className="text-3xl font-black text-white mb-2">勝者: <span className="text-yellow-400">{raceResult.id}番 {raceResult.name}</span> !!</h3>
                {raceResult.id === selectedHorse ? (
                  <p className="text-2xl font-bold text-green-400 animate-pulse mt-2">🎉 見事的中！ <span className="font-mono text-3xl">{Math.floor(raceBet * raceResult.odds).toLocaleString()}</span> G 獲得！</p>
                ) : (
                  <p className="text-xl text-gray-500 mt-2 font-bold">無念... ハズレ</p>
                )}
              </div>
            ) : isRacing ? (
              <p className="text-2xl font-black text-white tracking-widest animate-pulse">各馬一斉にスタート！白熱のレース展開！！</p>
            ) : (
              <p className="text-xl text-gray-500 font-bold">馬を選んでベットし、レースを開始してください</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}