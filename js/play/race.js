/* 단어 드라이브: 다가오는 자동차의 단어를 먼저 치는 사람이 점수를 얻는다. 1~3명, 온라인 대전은 방장이 심판 */
import { mountGame } from '../../game-design/ui.js';
import { joinRoom } from './net.js';
import { COLORS, roomCode, makeMe, inviteLink, dialog, copyText, esc, HELP } from './common.js';

const DURATION = 90, MAX_TARGETS = 3, SPAWN_MS = 3600, Z_START = -32, Z_END = 9, SNAP_MS = 250;
const pointsFor = w => w.length <= 2 ? 30 : w.length === 3 ? 50 : 70;

export function start(root, { code: initialCode = null, onLeave = () => {} } = {}) {
  const { records, sound } = window.App;
  const me = makeMe();
  let disposed = false;
  let phase = 'lobby', playerCount = initialCode ? 2 : 1, code = initialCode || '', remaining = DURATION, countdown = 3, feedback = null, result = null;
  let players = [{ id: me.id, name: me.name, color: COLORS[0], score: 0, ready: false, words: 0, wrong: 0 }];
  let targets = [], pool = [], room = null, hostId = null, prevHost = null, joining = false;
  let raf = 0, lastT = 0, spawnAt = 0, clock = null, cdTimer = null, fbTimer = null, snapAt = 0, seq = 0, elapsed = 0, liveTargets = [];

  const isOnline = () => !!room;
  const isHost = () => !room || hostId === me.id;
  const meP = () => players.find(p => p.id === me.id);

  /* ---------- 표시 상태 ---------- */
  function toView() {
    return {
      phase, playerCount, roomCode: code, remaining, countdown, feedback, result, motion: true, previewMotion: false,
      players: players.map((p, i) => ({ id: p.id === me.id ? 'me' : p.id, name: p.name, color: p.color || COLORS[i % 3], score: p.score, subtitle: ({ lilac: '보라 드라이버', mint: '민트 드라이버', peach: '살구 드라이버' })[p.color || COLORS[i % 3]], ready: p.ready, lives: 3 })),
      targets: targets.map(t => ({ id: t.id, word: t.word, points: t.points, lane: t.lane, z: t.z, claimedBy: t.claimedBy }))
    };
  }
  const view = mountGame(root, { game: 'race', state: toView(), onEvent: handle });
  function sync() { if (disposed) return; view.setState(toView()); liveTargets = view.scene.state.targets || []; }
  function say(fb, ms = 2600) {
    feedback = fb; clearTimeout(fbTimer);
    if (fb && ms) fbTimer = setTimeout(() => { if (feedback === fb) { feedback = null; sync(); } }, ms);
    sync();
  }

  /* ---------- 경기 진행 (방장 또는 혼자) ---------- */
  function nextWord() {
    if (!pool.length) pool = window.App.shuffle(window.DATA.gameWords.filter(w => w.length <= 4));
    const onScreen = new Set(targets.map(t => t.word));
    for (let i = 0; i < pool.length; i++) if (!onScreen.has(pool[i])) return pool.splice(i, 1)[0];
    return pool.pop();
  }
  function spawn() {
    if (targets.length >= MAX_TARGETS) return;
    const used = new Set(targets.map(t => t.lane));
    const lanes = [0, 1, 2].filter(l => !used.has(l));
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const word = nextWord();
    const speed = (2.5 + Math.min(1.3, elapsed / DURATION * 1.6)) * (0.9 + Math.random() * 0.2);
    targets.push({ id: 't' + (++seq), word, points: pointsFor(word), lane, z: Z_START, speed });
    sync();
  }
  // 경기 진행(방장/혼자): 탭이 뒤로 가도 멈추지 않도록 타이머로 돌린다
  let sim = null, lastSim = 0;
  function simStep() {
    if (disposed || !(phase === 'playing' || phase === 'urgent') || !isHost()) return;
    const now = performance.now();
    const dt = lastSim ? Math.min((now - lastSim) / 1000, 1) : 0; lastSim = now;
    elapsed += dt;
    targets.forEach(t => { if (!t.claimedBy) t.z += t.speed * dt; });
    const before = targets.length;
    targets = targets.filter(t => t.claimedBy || t.z < Z_END);
    let changed = targets.length !== before;
    if (now - spawnAt > SPAWN_MS && targets.length < MAX_TARGETS) { spawnAt = now; spawn(); changed = false; }
    if (changed) sync(); else pushZ();
    if (room && now - snapAt > SNAP_MS) { snapAt = now; room.send({ t: 'snap', targets, scores: Object.fromEntries(players.map(p => [p.id, p.score])), remaining, phase }); }
  }
  function pushZ() { targets.forEach(t => { const lt = liveTargets.find(x => x.id === t.id); if (lt) lt.z = t.z; }); }
  // 화면 보간(손님): 스냅샷 사이에 자동차를 부드럽게 움직인다
  function tick(now) {
    raf = 0; if (disposed) return;
    const running = phase === 'playing' || phase === 'urgent';
    if (!running) { lastT = 0; return; }
    if (!isHost()) {
      const dt = lastT ? Math.min((now - lastT) / 1000, .1) : 0; lastT = now;
      targets.forEach(t => { if (!t.claimedBy) t.z += t.speed * dt; });
    }
    pushZ();
    raf = requestAnimationFrame(tick);
  }
  function startClock() {
    clearInterval(clock);
    clock = setInterval(() => {
      if (!(phase === 'playing' || phase === 'urgent')) return;
      remaining--;
      if (remaining <= 10 && remaining > 0) { if (phase !== 'urgent') { phase = 'urgent'; say({ tone: 'warning', title: '마지막 10초!', message: '끝까지 집중해요.', icon: 'clock' }, 0); } sound.tick(); }
      if (remaining <= 0) { if (isHost()) finish(); return; }
      sync();
    }, 1000);
  }
  function beginCountdown() {
    phase = 'countdown'; countdown = 3; feedback = null; result = null;
    players.forEach(p => { p.score = 0; p.words = 0; p.wrong = 0; });
    targets = []; pool = []; remaining = DURATION; elapsed = 0; seq = 0; sync();
    clearInterval(cdTimer);
    cdTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) { clearInterval(cdTimer); play(); } else { sound.tick(); sync(); }
    }, 1000);
  }
  function play() {
    phase = 'playing'; feedback = null; lastT = 0; spawnAt = performance.now() - SPAWN_MS + 600;
    sync(); view.clearInput(); view.focusInput();
    lastSim = 0; clearInterval(sim); sim = setInterval(simStep, 50);
    raf = requestAnimationFrame(tick);
    startClock();
  }
  function resolveSubmit(word, byId) {
    const norm = w => w.replace(/\s+/g, '');
    const t = targets.find(x => !x.claimedBy && norm(x.word) === norm(word));
    const p = players.find(x => x.id === byId);
    if (!p) return;
    if (t) {
      t.claimedBy = byId; p.score += t.points; p.words++;
      setTimeout(() => { targets = targets.filter(x => x !== t); sync(); }, 500);
      if (room) room.send({ t: 'claim', targetId: t.id, by: byId, word: t.word, points: t.points, scores: Object.fromEntries(players.map(x => [x.id, x.score])) });
      showClaim(t, byId);
    } else if (byId === me.id) wrongInput(word);
    else if (room) room.send({ t: 'wrong', to: byId });
  }
  function showClaim(t, byId) {
    view.playEffect('success', t.id);
    if (byId === me.id) { sound.ok(); say({ tone: 'success', title: '내가 먼저 찾았어요!', message: `${t.word} · +${t.points}점`, icon: 'sparkle' }); }
    else { const p = players.find(x => x.id === byId); say({ tone: 'neutral', title: `${p ? p.name : '친구'}님이 한발 먼저!`, message: `${t.word} · 다음 단어를 향해 달려요.`, icon: 'car' }); }
  }
  function wrongInput(word) {
    const p = meP(); if (p) p.wrong++;
    sound.bad();
    say({ tone: 'error', title: '지금 보이는 단어가 아니에요', message: `‘${word}’ 대신 자동차 위 단어를 다시 봐 주세요.`, icon: 'info' });
  }
  function finish(reason) {
    if (phase === 'result') return;
    cancelAnimationFrame(raf); raf = 0; clearInterval(clock); clearInterval(sim);
    phase = 'result'; targets = [];
    const scores = Object.fromEntries(players.map(p => [p.id, p.score]));
    if (room && isHost()) room.send({ t: 'end', scores, reason });
    showResult(reason);
  }
  function showResult(reason) {
    const p = meP() || { score: 0, words: 0, wrong: 0 };
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(x => x.id === me.id) + 1;
    const acc = p.words + p.wrong ? Math.round(p.words / (p.words + p.wrong) * 100) : 100;
    let title, subtitle;
    if (reason === 'host-left') { title = '방장이 나가서 경기가 끝났어요'; subtitle = '지금까지의 점수를 저장했어요.'; }
    else if (players.length > 1) { title = rank === 1 ? '🏆 1등이에요!' : `${rank}등으로 들어왔어요`; subtitle = rank === 1 ? '가장 먼저 단어를 찾아냈어요.' : `1등 ${sorted[0].name}님 ${sorted[0].score}점. 다음엔 더 빨리!`; }
    else { title = p.score >= 500 ? '멋진 드라이브였어요!' : p.score >= 250 ? '잘 달렸어요!' : '첫 드라이브를 마쳤어요'; subtitle = p.score >= 250 ? '한 단어씩, 즐거운 한 바퀴를 완주했어요.' : '천천히 해도 괜찮아요. 한 번 더 달려 볼까요?'; }
    result = { title, subtitle, score: p.score, words: p.words, accuracy: acc };
    records.set('race', p.score, (a, b) => a > b); records.bump();
    sound.win(); feedback = null; sync();
  }

  /* ---------- 온라인 ---------- */
  async function enterRoom(c, matching) {
    if (joining) return; joining = true;
    code = c; phase = matching ? 'matching' : 'lobby';
    say({ tone: 'neutral', title: '방에 연결하는 중이에요', message: '잠시만 기다려 주세요.', icon: 'users' }, 0);
    try {
      room = await joinRoom({ game: 'race', code: c, me, onMembers, onMessage, onStatus: s => { if (s === 'CLOSED' && !disposed && phase !== 'result') say({ tone: 'warning', title: '연결이 끊겼어요', message: '인터넷을 확인하고 다시 들어와 주세요.', icon: 'info' }, 0); } });
      if (disposed) { room.leave(); return; }
      if (feedback && feedback.title === '방에 연결하는 중이에요') feedback = null;
      sync();
    } catch (e) {
      room = null; code = ''; phase = 'lobby'; playerCount = 1;
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
    players = list.map((m, i) => { const p = byId.get(m.id) || { id: m.id, name: m.name, score: 0, words: 0, wrong: 0 }; p.name = m.name; p.ready = !!m.ready; p.color = COLORS[i % 3]; return p; });
    if (!players.find(p => p.id === me.id)) players.unshift({ id: me.id, name: me.name, color: COLORS[0], score: 0, ready: false, words: 0, wrong: 0 });
    if (phase === 'matching' && players.length >= 2) { phase = 'lobby'; say({ tone: 'success', title: '함께 달릴 친구를 만났어요!', message: '준비 버튼을 누르면 시작해요.', icon: 'users' }); }
    if ((phase === 'playing' || phase === 'urgent' || phase === 'countdown') && prevHost && prevHost !== hostId && prevHost !== me.id && !list.find(m => m.id === prevHost)) { clearInterval(cdTimer); finish('host-left'); return; }
    if (phase === 'lobby' && isHost() && players.length >= 2 && players.every(p => p.ready)) { room.send({ t: 'start' }); beginCountdown(); return; }
    sync();
  }
  function onMessage(m) {
    if (disposed || !room) return;
    if (m.t === 'start' && m.from === hostId) { beginCountdown(); return; }
    if (m.t === 'snap' && m.from === hostId && !isHost()) {
      const mine = new Map(targets.map(t => [t.id, t]));
      targets = m.targets.map(t => { const l = mine.get(t.id); if (l) { l.z = t.z; l.speed = t.speed; l.claimedBy = t.claimedBy; return l; } return { ...t }; });
      players.forEach(p => { if (m.scores[p.id] != null) p.score = m.scores[p.id]; });
      remaining = m.remaining; lastT = performance.now();
      if (m.phase === 'urgent' && phase === 'playing') phase = 'urgent';
      sync(); if (!raf) raf = requestAnimationFrame(tick); return;
    }
    if (m.t === 'submit' && isHost()) { resolveSubmit(m.word, m.from); return; }
    if (m.t === 'claim' && !isHost()) {
      const t = targets.find(x => x.id === m.targetId) || { id: m.targetId, word: m.word, points: m.points };
      t.claimedBy = m.by; players.forEach(p => { if (m.scores[p.id] != null) p.score = m.scores[p.id]; });
      if (m.by === me.id) { const p = meP(); if (p) p.words++; }
      setTimeout(() => { targets = targets.filter(x => x.id !== m.targetId); sync(); }, 500);
      showClaim(t, m.by); return;
    }
    if (m.t === 'wrong' && m.to === me.id) { wrongInput(''); return; }
    if (m.t === 'end' && m.from === hostId && !isHost()) {
      players.forEach(p => { if (m.scores[p.id] != null) p.score = m.scores[p.id]; });
      cancelAnimationFrame(raf); raf = 0; clearInterval(clock); clearInterval(sim); phase = 'result'; targets = []; showResult(m.reason);
    }
  }

  /* ---------- UI 이벤트 ---------- */
  async function handle(ev) {
    if (disposed) return;
    switch (ev.type) {
      case 'mode-change': {
        if (phase !== 'lobby' && phase !== 'matching') return;
        playerCount = ev.playerCount;
        if (playerCount === 1) { await leaveRoom(); phase = 'lobby'; sync(); }
        else if (!room) enterRoom(roomCode(), false);
        else sync();
        return;
      }
      case 'ready': {
        if (phase !== 'lobby') return;
        if (joining) { say({ tone: 'neutral', title: '아직 방에 연결하는 중이에요', message: '연결이 끝나면 다시 눌러 주세요.', icon: 'clock' }); return; }
        if (!room) { beginCountdown(); return; }
        const p = meP(); p.ready = true;
        await room.track({ ready: true });
        if (players.length < 2) say({ tone: 'neutral', title: '친구를 기다리고 있어요', message: '초대 코드를 알려 주면 같은 도로에서 만나요.', icon: 'users' }, 0);
        else if (!players.every(x => x.ready)) say({ tone: 'neutral', title: '준비 완료!', message: '다른 친구가 준비하면 바로 출발해요.', icon: 'check' }, 0);
        sync(); return;
      }
      case 'find-opponent': { await leaveRoom(); playerCount = Math.max(2, playerCount); enterRoom('QUICK', true); return; }
      case 'cancel-match': { await leaveRoom(); playerCount = 1; phase = 'lobby'; sync(); return; }
      case 'invite': {
        if (!code || joining) return;
        const link = inviteLink('race', code); const ok = await copyText(link);
        dialog({ title: '친구를 초대해요', html: `<p>친구에게 이 코드를 알려 주세요.</p><p class="play-code">${esc(code)}</p><p>또는 이 주소를 보내면 바로 들어올 수 있어요.</p><p class="play-link">${esc(link)}</p><p class="muted">${ok ? '주소를 복사해 두었어요. 카톡에 붙여 넣기만 하면 돼요.' : '주소를 길게 눌러 복사하세요.'}</p>` });
        return;
      }
      case 'submit': {
        if (!(phase === 'playing' || phase === 'urgent')) return;
        view.clearInput();
        if (isHost()) resolveSubmit(ev.word, me.id); else room.send({ t: 'submit', word: ev.word });
        return;
      }
      case 'pause': {
        if (!(phase === 'playing' || phase === 'urgent')) return;
        if (room) { say({ tone: 'neutral', title: '함께 달리는 중이라 멈출 수 없어요', message: '경기가 끝나면 쉬어 가요.', icon: 'info' }); return; }
        phase = 'paused'; cancelAnimationFrame(raf); raf = 0; lastT = 0; lastSim = 0; sync(); return;
      }
      case 'resume': { if (phase !== 'paused') return; phase = remaining <= 10 ? 'urgent' : 'playing'; lastSim = 0; sync(); view.focusInput(); raf = requestAnimationFrame(tick); return; }
      case 'again': { if (room) { const p = meP(); p.ready = false; phase = 'lobby'; players.forEach(x => { x.score = 0; }); await room.track({ ready: false }); sync(); } else beginCountdown(); return; }
      case 'leave': {
        const v = await dialog({ title: '경기를 나갈까요?', html: '<p>지금 나가면 이번 경기 점수는 저장되지 않아요.</p>', buttons: [{ label: '계속 달리기', value: false, primary: true }, { label: '나가기', value: true }] });
        if (v) onLeave(); return;
      }
      case 'help': { dialog({ title: '단어 드라이브, 이렇게 즐겨요', html: HELP.race }); return; }
      case 'reconnect': { if (code) { const c = code; await leaveRoom(); enterRoom(c, false); } return; }
      case 'fullscreen-unavailable': { say({ tone: 'neutral', title: '이 기기에서는 전체 화면을 열 수 없어요', message: '지금 화면 그대로 즐겨요.', icon: 'info' }); return; }
    }
  }

  if (initialCode) enterRoom(initialCode, false);
  return () => { disposed = true; cancelAnimationFrame(raf); clearInterval(clock); clearInterval(sim); clearInterval(cdTimer); clearTimeout(fbTimer); leaveRoom(); view.dispose(); };
}
