import React, { useState, useMemo } from 'react';
import { ArrowLeft, User, Lock, Check, Crown, Briefcase, GraduationCap, Award, Building2 } from 'lucide-react';
import { Panel, GoldButton, SectionTitle, VipBadge, TopBadge, playSfx } from '../shared/ui';
import { ICONS, iconOf, TAG_ITEMS, tagItemOf } from '../shared/vip';
import { careerOf, rankOf, licenseOf, LICENSES, jobLabel, salaryOf } from '../games/work/jobs.js';
import { schoolOf, degreeTags, eduLevelOf, EDU_NAME } from '../games/school/schools.js';

/* ---------- 称号のしきい値 ---------- */
const CASINO_TIERS = [
  { n: 100, label: '🎰カジノ狂い', color: '#f87171' },
  { n: 1000, label: '🎰カジノの主', color: '#fb7185' },
  { n: 10000, label: '🎰伝説のギャンブラー', color: '#fbbf24' },
];
const WEALTH_TIERS = [
  { n: 1000000, label: '💰ミリオネア', color: '#fcd34d' },
  { n: 100000000, label: '💰億万長者', color: '#fbbf24' },
  { n: 1000000000000, label: '💰兆の支配者', color: '#fde68a' },
];
const SALARY_TIERS = [
  { n: 100, label: '💴時給・百', color: '#a3a3a3' },
  { n: 1000, label: '💴時給・千', color: '#93c5fd' },
  { n: 10000, label: '💴時給・一万', color: '#5eead4' },
  { n: 100000, label: '💴時給・十万', color: '#fbbf24' },
];

/* ==========================================================
   プロフィール
   ・アイコンはショップで買って設定
   ・名前の横につけるタグは最大3つ
   ・他人のプロフィールは VIP だけが中身まで見られる（VIP以外はアイコンのみ）
   ========================================================== */

export const MAX_TAGS = 3;
const fmt = (n) => Math.round(n || 0).toLocaleString();

/** その人が付けられるタグを全部あつめる */
export function availableTags({ job, edu = {}, licenses = [], vip, isTop, companies = [], name, stats = {}, netWorth = 0, ownedTags = [] }) {
  const out = [];
  // 買った称号
  (ownedTags || []).forEach(k => {
    const t = tagItemOf(k);
    if (t) out.push({ key: t.key, label: t.label, color: t.color });
  });
  // カジノをやり込んだ証
  CASINO_TIERS.forEach(t => {
    if ((stats.casinoPlays || 0) >= t.n) out.push({ key: `CAS_${t.n}`, label: t.label, color: t.color });
  });
  // 稼いだ証
  WEALTH_TIERS.forEach(t => {
    if ((netWorth || 0) >= t.n) out.push({ key: `RICH_${t.n}`, label: t.label, color: t.color });
  });
  // 15分ごとの給料（時給）
  const sal = salaryOf(job, eduLevelOf(edu), vip);
  SALARY_TIERS.forEach(t => {
    if (sal >= t.n) out.push({ key: `SAL_${t.n}`, label: t.label, color: t.color });
  });
  if (vip) out.push({ key: 'VIP', label: '👑VIP', color: '#fbbf24' });
  if (isTop) out.push({ key: 'TOP', label: '🏆長者番付1位', color: '#fde68a' });
  const c = careerOf(job?.key);
  if (c) {
    out.push({ key: `JOB_${c.key}`, label: `${c.icon}${c.name}`, color: '#93c5fd' });
    if (c.group) out.push({ key: 'YUTA_STAFF', label: '🌟YUTA職員', color: '#fbbf24' });
    out.push({ key: `RANK_${job.rank}`, label: `🎖️${rankOf(job.rank).name}`, color: '#c4b5fd' });
  }
  degreeTags(edu).forEach(t => out.push(t));
  const lv = eduLevelOf(edu);
  if (lv > 0) out.push({ key: `EDU_${lv}`, label: `🎓${EDU_NAME[lv]}`, color: '#5eead4' });
  (licenses || []).forEach(k => {
    const l = licenseOf(k);
    if (l) out.push({ key: `LIC_${k}`, label: `${l.icon}${l.name}`, color: '#a7f3d0' });
  });
  (companies || []).filter(x => x.owner === name).forEach(x => {
    out.push({ key: `CORP_${x.id}`, label: `🏢${x.name} 代表`, color: '#c7d2fe' });
  });
  return out;
}

export function TagChips({ tags = [], size = 'xs' }) {
  if (!tags.length) return null;
  return (
    <>
      {tags.map(t => (
        <span key={t.key}
          className={`${size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'} font-black rounded-md border shrink-0`}
          style={{ color: t.color, borderColor: t.color + '55', background: t.color + '18' }}>
          {t.label}
        </span>
      ))}
    </>
  );
}

export default function ProfileView({
  balance, onBack, showToast, playerName, vip, isTop,
  job, edu = {}, licenses = [], workExp = 0, companies = [], profile = {}, ownedIcons = [],
  ownedTags = [], stats = {}, netWorth = 0, onBuyIcon, onBuyTag, onSaveProfile, viewing, canSeeDetail = true,
}) {
  const [tab, setTab] = useState('ME');   // ME | ICON | TAG
  const [bio, setBio] = useState(profile.bio || '');
  const [busy, setBusy] = useState(false);

  const isOther = !!viewing;
  const data = viewing || { name: playerName, job, edu, licenses, workExp, profile, vip, isTop, stats, netWorth, ownedTags };
  const c = careerOf(data.job?.key);
  const lv = eduLevelOf(data.edu || {});
  const all = useMemo(
    () => availableTags({
      job: data.job, edu: data.edu, licenses: data.licenses, vip: data.vip, isTop: data.isTop,
      companies, name: data.name, stats: data.stats || {}, netWorth: data.netWorth || 0,
      ownedTags: data.ownedTags || [],
    }),
    [data, companies]);
  const chosen = (data.profile?.tags || []).map(k => all.find(t => t.key === k)).filter(Boolean);

  const toggleTag = async (key) => {
    const cur = profile.tags || [];
    let next;
    if (cur.includes(key)) next = cur.filter(x => x !== key);
    else {
      if (cur.length >= MAX_TAGS) { showToast(`タグは ${MAX_TAGS} 個までです。`, 'warning'); return; }
      next = [...cur, key];
    }
    await onSaveProfile({ tags: next });
    playSfx('click');
  };

  const setIcon = async (key) => {
    if (!ownedIcons.includes(key) && iconOf(key).price > 0) { showToast('先に購入してください。', 'warning'); return; }
    await onSaveProfile({ icon: key });
    playSfx('click');
  };

  const buyIcon = async (ic) => {
    if (busy) return;
    if (ownedIcons.includes(ic.key)) { setIcon(ic.key); return; }
    if (balance < ic.price) { showToast('所持金が足りません。', 'error'); return; }
    setBusy(true);
    try { await onBuyIcon(ic); playSfx('coin'); showToast(`${ic.icon} ${ic.name} を購入しました！`, 'success'); }
    finally { setBusy(false); }
  };

  /* ---------- 他人のプロフィール ---------- */
  if (isOther && !canSeeDetail) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"><ArrowLeft size={20} /> 戻る</button>
        <Panel className="p-8 text-center">
          <div className="text-7xl mb-3">{iconOf(data.profile?.icon).icon}</div>
          <h2 className="text-2xl font-black text-white mb-1">{data.name}</h2>
          <div className="flex flex-wrap justify-center gap-1 mb-4"><TagChips tags={chosen} size="sm" /></div>
          <div className="px-4 py-3 rounded-2xl bg-black/50 border border-amber-400/30">
            <Lock size={18} className="mx-auto text-amber-300 mb-1" />
            <p className="text-[12px] font-bold text-amber-200">VIP会員になると、他の人の経歴・学歴・資格まで見られます</p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition"><ArrowLeft size={20} /> {isOther ? '戻る' : 'メニューに戻る'}</button>
        {!isOther && <div className="bg-black/60 px-4 py-2 rounded-full border border-amber-500/30 font-mono text-lg text-amber-300 font-bold">{fmt(balance)} Y</div>}
      </div>

      {/* 名刺 */}
      <Panel gold className="p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-black/50 border-2 border-amber-400/40 flex items-center justify-center text-5xl shrink-0">
            {iconOf(data.profile?.icon).icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <h2 className="text-2xl font-black text-white truncate">{data.name}</h2>
              {data.isTop && <TopBadge size="xs" />}
              {data.vip && <VipBadge size="xs" />}
            </div>
            <div className="flex flex-wrap gap-1 mb-1"><TagChips tags={chosen} size="sm" /></div>
            <p className="text-[12px] text-gray-400">{c ? `${c.icon}${c.name}・${rankOf(data.job.rank).name}` : '無職'}　/　{EDU_NAME[lv]}</p>
          </div>
        </div>
        {data.profile?.bio && <p className="text-[12px] text-gray-300 mt-3 px-3 py-2 rounded-xl bg-black/40 border border-white/10 whitespace-pre-wrap">{data.profile.bio}</p>}
      </Panel>

      {/* 経歴 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Panel className="p-4">
          <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2 flex items-center gap-1.5"><Briefcase size={12} />職歴</div>
          {c ? (
            <>
              <div className="text-base font-black text-white">{c.icon} {c.name}</div>
              <div className="text-[11px] text-gray-500">{c.field}・{rankOf(data.job.rank).name}（経験 {fmt(data.job.exp)}）</div>
              {c.group && <div className="text-[11px] font-black text-amber-300 mt-1">🌟 YUTAPON グループ職員</div>}
            </>
          ) : <p className="text-[12px] text-gray-600">まだ就職していません</p>}
          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-gray-400">
            通算経験 <b className="text-emerald-300 font-mono">{fmt(data.workExp)}</b>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2 flex items-center gap-1.5"><GraduationCap size={12} />学歴</div>
          <div className="space-y-1">
            {[['hs', '高校'], ['voc', '専門'], ['uni', '大学']].map(([slot, label]) => {
              const r = (data.edu || {})[slot];
              const s = r ? schoolOf(r.key) : null;
              if (!s) return <div key={slot} className="text-[11px] text-gray-600">{label}：—</div>;
              return (
                <div key={slot} className="text-[12px] text-gray-300">
                  <span className="text-gray-500 font-bold">{label}：</span>
                  {s.icon}{s.name}
                  {r.graduated
                    ? <span className="text-emerald-300 font-bold"> 卒業（GPA {(r.gpa || 0).toFixed(1)}）</span>
                    : <span className="text-sky-300 font-bold"> 在学中</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-gray-400">
            学力 <b className="text-sky-300 font-mono">{fmt((data.edu || {}).study)}</b>
          </div>
        </Panel>
      </div>

      <Panel className="p-4 mb-4">
        <div className="text-[10px] font-black tracking-widest text-amber-200/60 mb-2 flex items-center gap-1.5">
          <Award size={12} />資格（{(data.licenses || []).length} / {LICENSES.length}）
        </div>
        <div className="flex flex-wrap gap-1">
          {(data.licenses || []).length === 0
            ? <span className="text-[12px] text-gray-600">まだありません</span>
            : (data.licenses || []).map(k => {
              const l = licenseOf(k);
              return l ? (
                <span key={k} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                  {l.icon}{l.name}
                </span>
              ) : null;
            })}
        </div>
      </Panel>

      {isOther ? null : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[{ k: 'ME', label: '自己紹介' }, { k: 'ICON', label: 'アイコン' }, { k: 'TAG', label: `タグ (${(profile.tags || []).length}/${MAX_TAGS})` }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`py-2.5 rounded-xl font-black text-[13px] border-2 transition
                  ${tab === t.k ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'ME' && (
            <Panel className="p-4">
              <label className="block text-[11px] font-black text-gray-400 tracking-widest mb-1.5">自己紹介（120文字まで）</label>
              <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 120))} rows={3}
                placeholder="よろしくおねがいします。"
                className="w-full bg-black/60 text-white text-sm p-3 rounded-xl border border-white/10 focus:border-amber-400 outline-none mb-2" />
              <GoldButton onClick={async () => { await onSaveProfile({ bio }); showToast('プロフィールを保存しました。', 'success'); }}
                className="w-full py-2.5">保存する</GoldButton>
            </Panel>
          )}

          {tab === 'ICON' && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ICONS.map(ic => {
                const owned = ic.price === 0 || ownedIcons.includes(ic.key);
                const active = (profile.icon || 'FREE_1') === ic.key;
                return (
                  <button key={ic.key} onClick={() => (owned ? setIcon(ic.key) : buyIcon(ic))} disabled={busy || (!owned && balance < ic.price)}
                    className={`p-3 rounded-2xl border-2 transition text-center disabled:opacity-40
                      ${active ? 'border-amber-400 bg-amber-400/15' : owned ? 'border-white/15 bg-black/40 hover:border-white/35' : 'border-white/10 bg-black/30'}`}>
                    <div className="text-3xl mb-1">{ic.icon}</div>
                    <div className="text-[10px] font-black text-white truncate">{ic.name}</div>
                    {active ? <div className="text-[9px] font-black text-amber-300">使用中</div>
                      : owned ? <div className="text-[9px] text-emerald-300 font-bold">所持</div>
                        : <div className="text-[9px] font-mono text-gray-400">{fmt(ic.price)}Y</div>}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'TAG' && (
            <Panel className="p-4">
              <p className="text-[11px] text-gray-500 mb-2">
                名前の横に表示されます。取った資格・出た学校・職業・VIP などから <b className="text-gray-300">最大 {MAX_TAGS} 個</b> 選べます。
              </p>
              {TAG_ITEMS.map(t => (
                (data.ownedTags || []).includes(t.key) ? null : (
                  <div key={t.key} className="mb-2 p-2.5 rounded-xl border flex items-center gap-2"
                    style={{ borderColor: t.color + '55', background: t.color + '10' }}>
                    <span className="text-xl">{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-black text-white">{t.name}</div>
                      <div className="text-[10px] text-gray-400">{t.desc}</div>
                    </div>
                    <button onClick={() => onBuyTag && onBuyTag(t)} disabled={busy || !vip || balance < t.price}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 text-black text-[11px] font-black shrink-0 disabled:opacity-30">
                      {vip ? `${fmt(t.price)} Y` : 'VIP限定'}
                    </button>
                  </div>
                )
              ))}
              {all.length === 0 ? (
                <p className="text-[12px] text-gray-600">まだ付けられるタグがありません。資格を取ったり就職したりすると増えます。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {all.map(t => {
                    const on = (profile.tags || []).includes(t.key);
                    return (
                      <button key={t.key} onClick={() => toggleTag(t.key)}
                        className={`text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1
                          ${on ? 'ring-2 ring-offset-0' : 'opacity-70 hover:opacity-100'}`}
                        style={{ color: t.color, borderColor: t.color + '66', background: t.color + (on ? '28' : '12') }}>
                        {on && <Check size={11} />}{t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
