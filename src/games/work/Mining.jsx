import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Pickaxe } from 'lucide-react';
import { Panel, GoldButton } from '../../shared/ui';

/* ==========================================================
   マインスイーパー採掘（YUTAPON WORKS の危険手当つき現場）
   ========================================================== */
const MINE_LEVELS = [
  { label: '浅坑道', cost: 200, rows: 6, cols: 8, mines: 8, reward: 800, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: '⛏️' },
  { label: '中層坑道', cost: 500, rows: 8, cols: 10, mines: 18, reward: 2500, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '🪨' },
  { label: '深層坑道', cost: 1500, rows: 10, cols: 12, mines: 40, reward: 8000, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: '💣' },
  { label: '地獄坑道', cost: 5000, rows: 10, cols: 14, mines: 65, reward: 30000, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '☠️' },
];

export default function MiningView({ balance, updateBalance, onBack, showToast, playerName, emitNews }) {
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
    if (balance < L.cost) { showToast(`参加費 ${L.cost.toLocaleString()} Y が足りません！`, 'error'); return; }
    busyRef.current = true;
    try { await updateBalance(-L.cost); } catch (e) { busyRef.current = false; return; }
    busyRef.current = false;
    setLevelIdx(idx);
    setBoard([]);
    setRevealed(Array(L.rows * L.cols).fill(false));
    setFlagged(Array(L.rows * L.cols).fill(false));
    setResult(null); setExploded(null); setSafeCount(0); setElapsed(0);
    setPhase('PLAYING');
    showToast(`${L.label} 開始！参加費 -${L.cost.toLocaleString()} Y`, 'warning');
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
      if (lvl.label === '地獄坑道') emitNews(`💥 ${playerName} が${lvl.label}で爆発…`, 'loss');
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
      showToast(`⛏️ 採掘成功！+${lvl.reward.toLocaleString()} Y`, 'success');
      if (lvl.label === '地獄坑道') emitNews(`⛏️ ${playerName} が${lvl.label}の採掘に成功！${lvl.reward.toLocaleString()} Y 獲得！`, 'mining');
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
            <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-amber-300 font-bold">{balance.toLocaleString()} Y</div>
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
                  <div><div className="text-gray-400 text-[11px]">参加費</div><div className="text-red-400 font-black text-lg">-{lv.cost.toLocaleString()} Y</div></div>
                  <div className="text-right"><div className="text-gray-400 text-[11px]">クリア報酬</div><div className={`font-black text-2xl ${lv.color}`}>+{lv.reward.toLocaleString()} Y</div></div>
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
              ? <div className="text-4xl font-black text-emerald-400">+{lvl.reward.toLocaleString()} Y</div>
              : <div className="text-2xl font-black text-red-400">参加費 {lvl.cost.toLocaleString()} Y 没収</div>}
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
