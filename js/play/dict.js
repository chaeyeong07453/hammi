/* 끝말잇기 사전: data/dict/{초성}.txt 조각을 필요할 때만 불러온다. 두음법칙과 컴퓨터 낱말 선택 포함 */
const BASE = new URL('../../data/dict/', import.meta.url);
const cache = new Map();

export const isHangulWord = w => /^[가-힣]{2,5}$/.test(w);
export const choIndex = ch => Math.floor((ch.charCodeAt(0) - 0xAC00) / 588);

export function shard(ch) {
  const i = choIndex(ch);
  if (!cache.has(i)) {
    cache.set(i, fetch(new URL(i + '.txt', BASE)).then(r => { if (!r.ok) throw new Error('dict ' + r.status); return r.text(); })
      .then(t => new Set(t.split('\n'))).catch(e => { cache.delete(i); throw e; }));
  }
  return cache.get(i);
}

// 두음법칙: 앞 글자로 올 때 바뀌는 소리
const DUEUM = {
  라:'나',래:'내',로:'노',뢰:'뇌',루:'누',르:'느',륵:'늑',름:'늠',릉:'능',랑:'낭',랍:'납',락:'낙',란:'난',람:'남',랭:'냉',
  량:'양',려:'여',력:'역',련:'연',렬:'열',렴:'염',렵:'엽',령:'영',례:'예',료:'요',룡:'용',류:'유',륙:'육',륜:'윤',률:'율',륭:'융',
  리:'이',린:'인',림:'임',립:'입',
  녀:'여',년:'연',념:'염',녕:'영',뇨:'요',뉴:'유',니:'이',닉:'익',님:'임'
};
const REVERSE = {};
Object.entries(DUEUM).forEach(([a, b]) => { (REVERSE[b] = REVERSE[b] || []).push(a); });

/** 마지막 글자로 시작할 수 있는 글자들 (두음법칙 양방향 허용) */
export function startOptions(last) {
  const s = new Set([last]);
  if (DUEUM[last]) s.add(DUEUM[last]);
  (REVERSE[last] || []).forEach(x => s.add(x));
  return [...s];
}

// 사이트 연습 낱말도 유효한 낱말로 인정
function siteWords() {
  const D = window.DATA || {};
  return [...(D.words ? D.words.easy.concat(D.words.hard) : []), ...(D.gameWords || [])].filter(isHangulWord);
}
let curated = null;
const curatedList = () => curated || (curated = [...new Set(siteWords())]);

/** 낱말 검사. 반환: { ok:true } 또는 { ok:false, reason:'format'|'start'|'duplicate'|'unknown'|'network' } */
export async function check(word, options, used) {
  word = (word || '').replace(/\s+/g, '');
  if (!isHangulWord(word)) return { ok: false, reason: 'format' };
  if (options && !options.includes(word[0])) return { ok: false, reason: 'start' };
  if (used && used.includes(word)) return { ok: false, reason: 'duplicate' };
  if (curatedList().includes(word)) return { ok: true, word };
  try { const set = await shard(word[0]); if (set.has(word)) return { ok: true, word }; }
  catch (e) { return { ok: false, reason: 'network' }; }
  return { ok: false, reason: 'unknown' };
}

/** 컴퓨터가 낼 낱말. level: 'easy' 친숙한 짧은 낱말만 / 'normal' 친숙한 낱말 우선 / 'hard' 사전 낱말 우선 */
export async function pick(options, used, level = 'normal') {
  const usedSet = new Set(used || []);
  const fits = w => (!options || options.includes(w[0])) && !usedSet.has(w);
  const maxLen = level === 'easy' ? 3 : 4;
  const easy = curatedList().filter(w => fits(w) && w.length <= maxLen);
  if (easy.length && (level !== 'hard' || Math.random() < .25)) return easy[Math.floor(Math.random() * easy.length)];
  if (level === 'easy') return null;
  const opts = options || [];
  for (const o of opts.slice().sort(() => Math.random() - .5)) {
    try {
      const set = await shard(o);
      const cand = [];
      for (const w of set) if (w[0] === o && w.length <= (level === 'hard' ? 4 : 3) && !usedSet.has(w)) { cand.push(w); if (cand.length > 600) break; }
      if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
    } catch (e) { /* 다음 후보 */ }
  }
  return easy.length ? easy[Math.floor(Math.random() * easy.length)] : null;
}

/** 낱말 뜻풀이 (data/mean/{초성}.json, 필요한 조각만 불러와 캐시) */
const MEAN_BASE = new URL('../../data/mean/', import.meta.url);
const meanCache = new Map();
export async function meaning(word) {
  if (!isHangulWord(word)) return null;
  const i = choIndex(word[0]);
  if (!meanCache.has(i)) {
    meanCache.set(i, fetch(new URL(i + '.json', MEAN_BASE)).then(r => { if (!r.ok) throw new Error('mean ' + r.status); return r.json(); })
      .catch(e => { meanCache.delete(i); throw e; }));
  }
  try { const m = await meanCache.get(i); return m[word] || null; } catch (e) { return null; }
}

/** 처음 공으로 던질 낱말 */
export function serveWord(used) {
  const usedSet = new Set(used || []);
  const cand = curatedList().filter(w => !usedSet.has(w) && w.length >= 2 && w.length <= 3 && !/[늠릇쁨]$/.test(w));
  return cand[Math.floor(Math.random() * cand.length)] || '사과';
}

export function preload(letters) { letters.forEach(l => shard(l).catch(() => {})); }
