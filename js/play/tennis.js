/* 끝말 테니스: 상대 낱말의 끝 글자로 시작하는 낱말을 시간 안에 받아친다. 컴퓨터 또는 친구(온라인, 방장이 심판) */
import { mountGame } from '../../game-design/ui.js';
import { joinRoom } from './net.js';
import { check, pick, serveWord, startOptions, preload, meaning } from './dict.js';
import { COLORS, roomCode, makeMe, inviteLink, dialog, copyText, esc, HELP } from './common.js';

const LIVES = 3, MAX_PLAYERS = 6;
// 난이도: 차례 시간, 컴퓨터 생각 시간, 컴퓨터가 공을 놓칠 확률
const LEVELS = { easy: { seconds: 30, delay: [1500, 3500], miss: .15 }, normal: { seconds: 20, delay: [1200, 3000], miss: 0 }, hard: { seconds: 12, delay: [700, 1500], miss: 0 } };
const BALL = { me: [-1.8, 1.3, 5.6], opp: [1.4, 1.3, -6], mid: [0, 4.3, 0] };

export function start(root, { code: initialCode = null, onLeave = () => {} } = {}) {
  const { records, sound } = window.App;
  const me = makeMe();
  let disposed = false;
  let phase = 'lobby', opponent = initialCode ? 'friend' : 'computer', code = initialCode || '', countdown = 3, feedback = null, result = null;
  let difficulty = 'normal';
  const LV = () => LEVELS[difficulty] || LEVELS.normal;
  let chain = [], chainBy = [], options = null, turn = me.id, lastBy = null, rally = 0, best = 0, seconds = LV().seconds, myWords = 0, myWrong = 0, meanings = {};
  let players = [{ id: me.id, name: me.name, color: COLORS[0], lives: LIVES, ready: false }];
  const COMP = { id: 'computer', name: '곰돌 코치', color: COLORS[2], lives: LIVES, ready: true };
  let room = null, hostId = null, prevHost = null, joining = false, checking = false;
  let clock = null, cdTimer = null, fbTimer = null, compTimer = null, ballRaf = 0;
  const ballPos = BALL.me.slice();

  const isOnline = () => !!room;
  const isHost = () => !room || hostId === me.id;
  const meP = () => players.find(p => p.id === me.id);
  const oppP = () => players.find(p => p.id !== me.id);
  // 차례 순서: 접속 순서대로 돌아가며, 생명이 남은 사람만. 컴퓨터 모드는 나 → 컴퓨터
  const order = () => (isOnline() || players.length > 1) ? players : [meP(), COMP];
  const alive = () => order().filter(p => p && p.lives > 0);
  const nextAfter = id => { const o = order(); const i = o.findIndex(p => p.id === id); const a = alive(); if (!a.length) return null; for (let k = 1; k <= o.length; k++) { const c = o[(i + k) % o.length]; if (c && c.lives > 0) return c.id; } return a[0].id; };
  const nameOf = id => id === me.id ? me.name : (players.find(p => p.id === id) || (id === COMP.id ? COMP : null) || {}).name || '상대';
  // 건너편 곰에 보여 줄 '지금의 상대': 내 차례면 공을 보낸 사람, 아니면 차례인 사람
  const foe = () => { const id = turn === me.id ? lastBy : turn; const p = players.find(x => x.id === id && x.id !== me.id) || (id === COMP.id ? COMP : null); return p || oppP() || (opponent === 'computer' ? COMP : null); };

  /* ---------- 표시 상태 ---------- */
  function toView() {
    const last = chain[chain.length - 1] || '';
    const list = players.length > 1 ? players : players.concat(opponent === 'computer' ? [COMP] : [{ id: 'wait', name: '기다리는 중', color: COLORS[2], lives: LIVES, ready: false }]);
    const f = foe();
    const dispId = id => id === me.id ? 'me' : id;
    return {
      phase, opponent, roomCode: code, countdown, feedback, result, motion: true, previewMotion: false, difficulty, meanings,
      turn: turn === me.id ? 'me' : 'opponent', turnId: dispId(turn), turnName: nameOf(turn),
      lastById: lastBy == null ? null : dispId(lastBy), lastByName: lastBy == null ? null : nameOf(lastBy),
      foe: f ? { id: dispId(f.id), name: f.name, color: f.color || COLORS[2] } : null,
      chain: chain.slice(), chainBy: chainBy.map(id => id == null ? '' : id === me.id ? '나' : nameOf(id)),
      startLetter: options ? options.join('/') : (last ? last.slice(-1) : '·'), rally, seconds,
      players: list.map((p, i) => ({ id: p.id === me.id ? 'me' : p.id, name: p.name, color: p.color || COLORS[i % 3], score: 0, subtitle: '', lives: p.lives, ready: p.ready })),
      targets: [], remaining: 0, playerCount: 2, ballPosition: ballPos
    };
  }
  const view = mountGame(root, { game: 'tennis', state: toView(), onEvent: handle });
  function sync() { if (disposed) return; view.setState(toView()); view.scene.state.ballPosition = ballPos; loadMeanings(); }
  const meaningPending = new Set();
  function loadMeanings() {
    chain.slice(-6).forEach(w => {
      if (w in meanings || meaningPending.has(w)) return;
      meaningPending.add(w);
      meaning(w).then(m => { meaningPending.delete(w); if (disposed) return; meanings[w] = m || ''; if (m && chain.includes(w)) view.setState({ meanings: { ...meanings } }); }).catch(() => meaningPending.delete(w));
    });
  }
  function say(fb, ms = 3000) {
    feedback = fb; clearTimeout(fbTimer);
    if (fb && ms) fbTimer = setTimeout(() => { if (feedback === fb) { feedback = null; sync(); } }, ms);
    sync();
  }
  // 공 이동 연출
  function flyBall(from, to, ms = 800) {
    cancelAnimationFrame(ballRaf);
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      ballPos[0] = from[0] + (to[0] - from[0]) * e; ballPos[2] = from[2] + (to[2] - from[2]) * e;
      ballPos[1] = from[1] + (to[1] - from[1]) * e + Math.sin(t * Math.PI) * 3;
      view.scene.state.ballPosition = ballPos; view.scene.invalidate();
      if (t < 1 && !disposed) ballRaf = requestAnimationFrame(step);
    };
    ballRaf = requestAnimationFrame(step);
  }

  /* ---------- 규칙 (혼자/컴퓨터, 또는 방장) ---------- */
  function setTurn(id) { turn = id; seconds = LV().seconds; }
  function serve(toId) {
    // 새 공: 시스템이 낱말을 던져 준다
    const w = serveWord(chain); chain.push(w); chainBy.push(null); lastBy = null; options = startOptions(w.slice(-1)); preload(options);
    setTurn(toId); flyBall(BALL.opp, toId === me.id ? BALL.me : BALL.opp);
    broadcast();
  }
  function broadcast(extra) {
    if (room && isHost()) room.send({ t: 'ts', chain, chainBy, options, turn, lastBy, rally, seconds, lives: Object.fromEntries(players.map(p => [p.id, p.lives])), phase, ...extra });
  }
  function startClock() {
    clearInterval(clock);
    clock = setInterval(() => {
      if (!['playing', 'urgent', 'waiting', 'invalid', 'wrong-start', 'duplicate'].includes(phase)) return; // 시간 초과 처리 중(timeout)에는 멈춘다
      if (turn === COMP.id || seconds <= 0) return; // 컴퓨터 차례는 타이머 없음
      seconds--;
      if (seconds <= 3 && seconds > 0 && turn === me.id) sound.tick();
      if (seconds <= 0) { if (isHost()) timeout(turn); return; }
      if (turn === me.id && seconds <= 5 && phase === 'playing') phase = 'urgent';
      broadcast(); sync();
    }, 1000);
  }
  function timeout(id) {
    const p = players.find(x => x.id === id) || (id === COMP.id ? COMP : null); if (!p) return;
    p.lives = Math.max(0, p.lives - 1);
    if (id === me.id) sound.bad();
    const fb = id === me.id
      ? { tone: 'error', title: '아쉽게 공을 놓쳤어요', message: p.lives ? `생명 ${p.lives}개 남았어요. 새 공을 준비해요!` : '생명을 모두 잃었어요.', icon: 'heart' }
      : { tone: 'success', title: `${p.name}님이 공을 놓쳤어요!`, message: p.lives ? '새 공으로 이어 가요.' : (alive().filter(x => x.id !== id).length <= 1 ? '내가 이겼어요!' : `${p.name}님은 여기까지. 남은 사람끼리 이어 가요.`), icon: 'heart' };
    if (room) room.send({ t: 'fb', loser: id, fb, lives: p.lives });
    phase = 'timeout'; say(fb);
    if (alive().length <= 1) { setTimeout(() => finish(), 1500); return; }
    // 놓친 사람이 아직 살아 있으면 다시 받고, 탈락했으면 다음 사람이 받는다. 컴퓨터가 놓치면 내가 받는다
    const toId = id === COMP.id ? me.id : (p.lives > 0 ? id : nextAfter(id));
    setTimeout(() => { if (disposed || phase === 'result') return; phase = 'playing'; serve(toId); sync(); if (turn === me.id) view.focusInput(); }, 1600);
  }
  async function submit(word, byId) {
    if (turn !== byId || checking) return;
    checking = true;
    const r = await check(word, options, chain);
    checking = false;
    if (disposed) return;
    if (!r.ok) {
      const map = {
        format: { phase: 'invalid', fb: { tone: 'error', title: '두 글자 이상 한글 낱말이어야 해요', message: '띄어쓰기 없이 낱말 하나만 넣어 주세요.', icon: 'info' } },
        start: { phase: 'wrong-start', fb: { tone: 'error', title: `이번에는 ‘${(options || []).join('/')}’로 시작해요`, message: '끝 글자를 확인하고 다시 받아쳐 보세요.', icon: 'info' } },
        duplicate: { phase: 'duplicate', fb: { tone: 'error', title: '이미 사용한 단어예요', message: '새로운 낱말로 랠리를 이어 주세요.', icon: 'reset' } },
        unknown: { phase: 'invalid', fb: { tone: 'error', title: '사전에서 찾지 못한 단어예요', message: `‘${(options || []).join('/')}’로 시작하는 다른 낱말을 입력해 주세요.`, icon: 'book' } },
        network: { phase: 'invalid', fb: { tone: 'warning', title: '사전을 불러오지 못했어요', message: '인터넷 연결을 확인하고 다시 눌러 주세요.', icon: 'info' } }
      };
      const e = map[r.reason];
      if (byId === me.id) { myWrong++; sound.bad(); phase = e.phase; say(e.fb); view.focusInput(); }
      else if (room) room.send({ t: 'reject', to: byId, phase: e.phase, fb: e.fb });
      return;
    }
    accept(r.word, byId);
  }
  function accept(word, byId) {
    chain.push(word); chainBy.push(byId); lastBy = byId; rally++; best = Math.max(best, rally);
    options = startOptions(word.slice(-1)); preload(options);
    const nextId = nextAfter(byId) || me.id;
    setTurn(nextId);
    flyBall(byId === me.id ? BALL.me : BALL.opp, nextId === me.id ? BALL.me : BALL.opp);
    view.playEffect('success');
    if (byId === me.id) { myWords++; sound.ok(); phase = 'waiting'; say({ tone: 'success', title: '멋진 받아치기!', message: `${word} → 다음은 ‘${options.join('/')}’${nextId !== me.id && alive().length > 2 ? ` (${nameOf(nextId)}님 차례)` : ''}`, icon: 'sparkle' }); }
    else if (nextId === me.id) { phase = 'playing'; say({ tone: 'neutral', title: `${nameOf(byId)}님이 받아쳤어요`, message: `${word} → 이번에는 ‘${options.join('/')}’`, icon: 'racket' }); view.focusInput(); }
    else { phase = 'waiting'; say({ tone: 'neutral', title: `${nameOf(byId)}님이 받아쳤어요`, message: `${word} → ${nameOf(nextId)}님 차례예요`, icon: 'racket' }); }
    broadcast();
    if (nextId === COMP.id) computerTurn();
  }
  function computerTurn() {
    clearTimeout(compTimer);
    const [d0, d1] = LV().delay, delay = d0 + Math.random() * (d1 - d0);
    seconds = Math.ceil(delay / 1000); sync();
    compTimer = setTimeout(async () => {
      if (disposed || turn !== COMP.id) return;
      const w = Math.random() < LV().miss ? null : await pick(options, chain, difficulty);
      if (disposed || turn !== COMP.id) return;
      if (!w) { timeout(COMP.id); return; }
      accept(w, COMP.id);
    }, delay);
  }
  function beginCountdown() {
    phase = 'countdown'; countdown = 3; feedback = null; result = null;
    chain = []; chainBy = []; lastBy = null; options = null; rally = 0; best = 0; myWords = 0; myWrong = 0; meanings = {}; players.forEach(p => { p.lives = LIVES; }); COMP.lives = LIVES;
    sync(); clearInterval(cdTimer);
    cdTimer = setInterval(() => { countdown--; if (countdown <= 0) { clearInterval(cdTimer); play(); } else { sound.tick(); sync(); } }, 1000);
  }
  function play() {
    phase = 'playing'; feedback = null;
    if (isHost()) { serve(isOnline() ? (nextAfter(me.id) || me.id) : me.id); }
    sync(); if (turn === me.id) { view.clearInput(); view.focusInput(); }
    startClock();
  }
  function finish(reason) {
    if (phase === 'result') return;
    clearInterval(clock); clearTimeout(compTimer);
    phase = 'result';
    if (room && isHost()) room.send({ t: 'end', lives: Object.fromEntries(players.map(p => [p.id, p.lives])), best, reason });
    showResult(reason);
  }
  function showResult(reason) {
    const mine = meP() || { lives: 0 };
    const others = order().filter(p => p && p.id !== me.id);
    const survivors = alive();
    const won = mine.lives > 0 && others.length > 0 && others.every(p => p.lives <= 0);
    const acc = myWords + myWrong ? Math.round(myWords / (myWords + myWrong) * 100) : 100;
    const winner = survivors.length === 1 ? survivors[0] : null;
    const title = reason === 'host-left' ? '상대가 나가서 경기가 끝났어요' : reason === 'others-left' ? '모두 나가서 경기가 끝났어요' : won ? '🏆 이겼어요!' : mine.lives <= 0 ? '아쉽지만 다음에 또!' : '좋은 랠리였어요!';
    const subtitle = won ? `${others.map(p => p.name).join(', ')}님이 공을 다 놓쳤어요. 최고 랠리 ${best}회!` : winner && winner.id !== me.id ? `${winner.name}님이 이겼어요. 최고 랠리 ${best}회!` : `마음이 통하는 한 단어, 또 함께 이어 볼까요?`;
    result = { title, subtitle, rally: best, words: myWords, accuracy: acc };
    records.set('tennis', best, (a, b) => a > b); records.bump();
    won ? sound.win() : sound.lose(); feedback = null; sync();
  }

  /* ---------- 온라인 ---------- */
  async function enterRoom(c, matching) {
    if (joining) return; joining = true;
    code = c; phase = matching ? 'matching' : 'lobby';
    say({ tone: 'neutral', title: '방에 연결하는 중이에요', message: '잠시만 기다려 주세요.', icon: 'users' }, 0);
    try {
      room = await joinRoom({ game: 'tennis', code: c, me, onMembers, onMessage });
      if (disposed) { room.leave(); return; }
      if (feedback && feedback.title === '방에 연결하는 중이에요') feedback = null;
      sync();
    } catch (e) {
      room = null; code = ''; phase = 'lobby'; opponent = 'computer';
      say({ tone: 'error', title: '방에 들어가지 못했어요', message: '인터넷 연결을 확인하고 다시 눌러 주세요.', icon: 'info' }, 4000);
    } finally { joining = false; }
  }
  async function leaveRoom() {
    if (room) { const r = room; room = null; try { await r.leave(); } catch (e) {} }
    hostId = null; code = ''; players = players.filter(p => p.id === me.id); players.forEach(p => { p.ready = false; });
  }
  function onMembers(list) {
    if (disposed) return;
    prevHost = hostId; hostId = list[0] ? list[0].id : null;
    const byId = new Map(players.map(p => [p.id, p]));
    const inGame = !['lobby', 'matching', 'result'].includes(phase);
    const gone = inGame ? players.filter(p => !list.find(m => m.id === p.id)) : [];
    players = list.slice(0, MAX_PLAYERS).map((m, i) => { const p = byId.get(m.id) || { id: m.id, name: m.name, lives: LIVES }; p.name = m.name; p.ready = !!m.ready; p.color = i === 0 ? COLORS[0] : [COLORS[2], COLORS[1], 'orchid', 'sky', 'butter'][(i - 1) % 5]; return p; });
    if (inGame) { // 경기 중에는 새로 들어온 사람은 다음 판부터
      players = players.filter(p => byId.has(p.id) || p.id === me.id);
    }
    if (!players.find(p => p.id === me.id)) players.unshift({ id: me.id, name: me.name, color: COLORS[0], lives: LIVES, ready: false });
    if (phase === 'matching' && players.length >= 2) { phase = 'lobby'; say({ tone: 'success', title: '함께 칠 친구를 만났어요!', message: '준비 버튼을 누르면 시작해요.', icon: 'users' }); }
    if (inGame && prevHost && prevHost !== me.id && !list.find(m => m.id === prevHost)) { clearInterval(cdTimer); finish('host-left'); return; }
    if (inGame && gone.length) {
      if (alive().length <= 1) { finish(alive().length && alive()[0].id === me.id ? 'others-left' : 'host-left'); return; }
      say({ tone: 'neutral', title: `${gone.map(g => g.name).join(', ')}님이 나갔어요`, message: '남은 사람끼리 이어 가요.', icon: 'users' });
      if (isHost() && gone.some(g => g.id === turn)) { const n = nextAfter(gone[0].id) || me.id; phase = 'playing'; serve(n); }
      broadcast();
    }
    if (phase === 'lobby' && isHost() && players.length >= 2 && players.every(p => p.ready)) { room.send({ t: 'start', difficulty }); beginCountdown(); return; }
    sync();
  }
  function onMessage(m) {
    if (disposed || !room) return;
    if (m.t === 'start' && m.from === hostId) { if (LEVELS[m.difficulty]) difficulty = m.difficulty; beginCountdown(); return; }
    if (m.t === 'ts' && m.from === hostId && !isHost()) {
      const wasTurn = turn, oldLen = chain.length;
      chain = m.chain; chainBy = m.chainBy || chain.map(() => null); options = m.options; turn = m.turn; lastBy = m.lastBy == null ? null : m.lastBy; rally = m.rally; best = Math.max(best, rally); seconds = m.seconds;
      players.forEach(p => { if (m.lives[p.id] != null) p.lives = m.lives[p.id]; });
      if (chain.length > oldLen) {
        const word = chain[chain.length - 1], by = chainBy[chainBy.length - 1];
        if (by === me.id) { /* 내 낱말이 인정됨 */ myWords++; sound.ok(); phase = 'waiting'; flyBall(BALL.me, BALL.opp); view.playEffect('success'); say({ tone: 'success', title: '멋진 받아치기!', message: `${word} → 다음은 ‘${(options || []).join('/')}’${turn !== me.id && alive().length > 2 ? ` (${nameOf(turn)}님 차례)` : ''}`, icon: 'sparkle' }); }
        else if (turn === me.id) { phase = 'playing'; flyBall(BALL.opp, BALL.me); say({ tone: 'neutral', title: by == null ? '새 공이 왔어요' : `${nameOf(by)}님이 받아쳤어요`, message: `${word} → 이번에는 ‘${(options || []).join('/')}’`, icon: 'racket' }); view.focusInput(); }
        else { phase = 'waiting'; if (by != null) { flyBall(BALL.opp, BALL.opp); say({ tone: 'neutral', title: `${nameOf(by)}님이 받아쳤어요`, message: `${word} → ${nameOf(turn)}님 차례예요`, icon: 'racket' }); } }
      } else if (!['timeout', 'invalid', 'wrong-start', 'duplicate'].includes(phase)) phase = turn === me.id ? (seconds <= 5 ? 'urgent' : 'playing') : 'waiting';
      sync(); return;
    }
    if (m.t === 'submit' && isHost()) { submit(m.word, m.from); return; }
    if (m.t === 'reject' && m.to === me.id) { myWrong++; sound.bad(); phase = m.phase; say(m.fb); view.focusInput(); return; }
    if (m.t === 'fb' && !isHost()) {
      const p = players.find(x => x.id === m.loser); if (p) p.lives = m.lives;
      const mine = m.loser === me.id; if (mine) sound.bad();
      phase = 'timeout';
      say(mine ? { tone: 'error', title: '아쉽게 공을 놓쳤어요', message: m.lives ? `생명 ${m.lives}개 남았어요. 새 공을 준비해요!` : '생명을 모두 잃었어요.', icon: 'heart' }
               : { tone: 'success', title: `${(p || {}).name || '상대'}님이 공을 놓쳤어요!`, message: m.lives ? '새 공으로 이어 가요.' : (alive().length <= 1 ? '내가 이겼어요!' : `${(p || {}).name || '상대'}님은 여기까지. 남은 사람끼리 이어 가요.`), icon: 'heart' });
      return;
    }
    if (m.t === 'end' && m.from === hostId && !isHost()) { players.forEach(p => { if (m.lives[p.id] != null) p.lives = m.lives[p.id]; }); best = Math.max(best, m.best || 0); clearInterval(clock); phase = 'result'; showResult(m.reason); }
  }

  /* ---------- UI 이벤트 ---------- */
  async function handle(ev) {
    if (disposed) return;
    switch (ev.type) {
      case 'difficulty-change': {
        if (phase !== 'lobby' && phase !== 'matching' || !LEVELS[ev.difficulty]) return;
        if (room && !isHost()) { difficulty = ev.difficulty; say({ tone: 'neutral', title: '난이도는 방장이 정해요', message: '방장이 고른 난이도로 시작해요.', icon: 'info' }); return; }
        difficulty = ev.difficulty; seconds = LV().seconds; sync(); return;
      }
      case 'mode-change': {
        if (phase !== 'lobby' && phase !== 'matching') return;
        opponent = ev.opponent;
        if (opponent === 'computer') { await leaveRoom(); phase = 'lobby'; sync(); }
        else if (!room) enterRoom(roomCode(), false); else sync();
        return;
      }
      case 'ready': {
        if (phase !== 'lobby') return;
        if (joining) { say({ tone: 'neutral', title: '아직 방에 연결하는 중이에요', message: '연결이 끝나면 다시 눌러 주세요.', icon: 'clock' }); return; }
        if (!room) { beginCountdown(); return; }
        meP().ready = true; await room.track({ ready: true });
        if (phase !== 'lobby') return;
        if (players.length < 2) say({ tone: 'neutral', title: '친구를 기다리고 있어요', message: '초대 코드를 알려 주면 같은 코트에서 만나요.', icon: 'users' }, 6000);
        sync(); return;
      }
      case 'find-opponent': { await leaveRoom(); opponent = 'friend'; enterRoom('QUICK', true); return; }
      case 'cancel-match': { await leaveRoom(); opponent = 'computer'; phase = 'lobby'; sync(); return; }
      case 'invite': {
        if (!code || joining) return;
        const link = inviteLink('tennis', code); const ok = await copyText(link);
        dialog({ title: '친구를 초대해요', html: `<p>친구에게 이 코드를 알려 주세요.</p><p class="play-code">${esc(code)}</p><p>또는 이 주소를 보내면 바로 들어올 수 있어요.</p><p class="play-link">${esc(link)}</p><p class="muted">${ok ? '주소를 복사해 두었어요. 카톡에 붙여 넣기만 하면 돼요.' : '주소를 길게 눌러 복사하세요.'}</p>` });
        return;
      }
      case 'submit': {
        if (turn !== me.id || !['playing', 'urgent', 'invalid', 'wrong-start', 'duplicate'].includes(phase)) return;
        view.clearInput();
        if (isHost()) submit(ev.word, me.id); else room.send({ t: 'submit', word: ev.word });
        return;
      }
      case 'pause': {
        if (!['playing', 'urgent', 'waiting', 'invalid', 'wrong-start', 'duplicate'].includes(phase)) return;
        if (room) { say({ tone: 'neutral', title: '친구와 치는 중이라 멈출 수 없어요', message: '경기가 끝나면 쉬어 가요.', icon: 'info' }); return; }
        clearInterval(clock); clearTimeout(compTimer); phase = 'paused'; sync(); return;
      }
      case 'resume': {
        if (phase !== 'paused') return;
        phase = turn === me.id ? 'playing' : 'waiting'; sync(); startClock();
        if (turn === COMP.id) computerTurn(); else view.focusInput();
        return;
      }
      case 'again': { if (room) { meP().ready = false; phase = 'lobby'; await room.track({ ready: false }); sync(); } else beginCountdown(); return; }
      case 'leave': {
        const v = await dialog({ title: '경기를 나갈까요?', html: '<p>지금 나가면 이번 랠리는 저장되지 않아요.</p>', buttons: [{ label: '계속 치기', value: false, primary: true }, { label: '나가기', value: true }] });
        if (v) onLeave(); return;
      }
      case 'help': { dialog({ title: '끝말 테니스, 이렇게 즐겨요', html: HELP.tennis }); return; }
      case 'reconnect': { if (code) { const c = code; await leaveRoom(); enterRoom(c, false); } return; }
      case 'fullscreen-unavailable': { say({ tone: 'neutral', title: '이 기기에서는 전체 화면을 열 수 없어요', message: '지금 화면 그대로 즐겨요.', icon: 'info' }); return; }
    }
  }

  if (initialCode) enterRoom(initialCode, false);
  return () => { disposed = true; clearInterval(clock); clearInterval(cdTimer); clearTimeout(fbTimer); clearTimeout(compTimer); cancelAnimationFrame(ballRaf); leaveRoom(); view.dispose(); };
}
