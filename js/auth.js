/* 회원가입 / 로그인 / 랭킹. 계정은 Supabase에 저장되어 어느 컴퓨터에서든 같은 이름·비밀번호로 로그인된다 */
(function (global) {
  const { $, el, esc, route, header, sound } = App;
  const SB_URL = 'https://xavhkigxzoxysirilqnk.supabase.co/rest/v1';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmhraWd4em94eXNpcmlscW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMDUyMTUsImV4cCI6MjEwNTg4MTIxNX0.rITpU9JSawVgvLCzZqXgBWcCgeUbN-kKFJmmN_gdb2o';
  const SESSION_KEY = 'hammi.session', RECENT_KEY = 'hammi.recent', OLD_USERS_KEY = 'hammi.users', RANK_KEY = 'hammi.rank';
  const MSG = {
    name: '이름은 1~10글자로 넣어 주세요.', pin: '비밀번호는 숫자 4자리예요.', exists: '이미 있는 이름이에요. 다른 이름을 써 주세요.',
    nouser: '그런 이름이 없어요. 회원가입을 먼저 해 주세요.', token: '다시 로그인해 주세요.',
    network: '인터넷 연결을 확인해 주세요.', server: '지금은 서버가 준비되지 않았어요. 잠시 뒤 다시 해 주세요.'
  };

  async function rpc(name, args) {
    let res;
    try {
      res = await fetch(`${SB_URL}/rpc/${name}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
    } catch (e) { return { error: 'network' }; }
    if (!res.ok) return { error: 'server', status: res.status };
    try { return await res.json(); } catch (e) { return { error: 'server' }; }
  }
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } },
    set(s) { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); }
  };
  const recent = {
    get() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } },
    add(id) { const l = [id, ...this.get().filter(x => x !== id)].slice(0, 4); localStorage.setItem(RECENT_KEY, JSON.stringify(l)); }
  };
  // 예전 버전(이 컴퓨터에만 저장)의 기록을 같은 이름의 서버 계정으로 한 번 옮긴다
  function migrateOld(user) {
    try {
      const old = JSON.parse(localStorage.getItem(OLD_USERS_KEY) || '[]');
      const o = old.find(x => x.id === user.id); if (!o) return false;
      let changed = false;
      Object.entries(o.rec || {}).forEach(([k, v]) => { if (v != null && (user.rec[k] == null || v > user.rec[k])) { user.rec[k] = v; changed = true; } });
      if ((o.count || 0) > (user.count || 0)) { user.count = o.count; changed = true; }
      localStorage.setItem(OLD_USERS_KEY, JSON.stringify(old.filter(x => x.id !== user.id)));
      return changed;
    } catch (e) { return false; }
  }

  let saveTimer = null, rankCache = null;
  try { rankCache = JSON.parse(localStorage.getItem(RANK_KEY)); } catch (e) {}

  const Auth = {
    ready: false,
    current() { const s = session.get(); return s && s.id ? s : null; },
    recent() { return recent.get(); },
    async signup(id, pin) {
      const r = await rpc('account_signup', { p_id: (id || '').trim(), p_pin: pin });
      if (r.error) return MSG[r.error] || MSG.server;
      const u = { id: r.id, token: r.token, rec: r.rec || {}, count: r.count || 0 };
      if (migrateOld(u)) this.pushSave(u);
      session.set(u); recent.add(u.id); this.render(); return null;
    },
    async login(id, pin) {
      const r = await rpc('account_login', { p_id: (id || '').trim(), p_pin: pin });
      if (r.error) return r.error === 'pin' ? '비밀번호가 달라요. 다시 넣어 주세요.' : (MSG[r.error] || MSG.server);
      const u = { id: r.id, token: r.token, rec: r.rec || {}, count: r.count || 0 };
      if (migrateOld(u)) this.pushSave(u);
      session.set(u); recent.add(u.id); this.render(); return null;
    },
    logout() { session.set(null); this.render(); },
    // 기록 변경: 바로 이 컴퓨터에 반영하고, 잠시 뒤 서버에 저장
    save(user) { session.set(user); this.pushSave(user); },
    pushSave(user) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const r = await rpc('account_save', { p_id: user.id, p_token: user.token, p_rec: user.rec, p_count: user.count || 0 });
        if (r.error === 'token') { this.logout(); }
        else if (!r.error) { const s = session.get(); if (s && s.id === r.id) { s.rec = r.rec; s.count = r.count; session.set(s); } this.loadRanking(); }
      }, 600);
    },
    // 다른 컴퓨터에서 쌓인 기록을 가져온다
    async refresh() {
      const s = session.get(); if (!s) return;
      const r = await rpc('account_refresh', { p_id: s.id, p_token: s.token });
      if (r.error === 'token') { this.logout(); return; }
      if (!r.error) { s.rec = r.rec || {}; s.count = r.count || 0; session.set(s); this.render(); if (location.hash === '' || /^#\/home\/?$/.test(location.hash)) dispatchEvent(new HashChangeEvent('hashchange')); }
    },
    async loadRanking() {
      const r = await rpc('account_ranking');
      if (Array.isArray(r)) { rankCache = r; localStorage.setItem(RANK_KEY, JSON.stringify(r)); }
      return rankCache || [];
    },
    // 항목별 순위표 [{id, val}] 내림차순 (마지막으로 받아 둔 랭킹 + 내 최신 기록)
    ranking(key) {
      const list = (rankCache || []).map(u => ({ id: u.id, rec: u.rec || {}, count: u.count || 0 }));
      const me = this.current();
      if (me) { const i = list.findIndex(u => u.id === me.id); const mine = { id: me.id, rec: me.rec || {}, count: me.count || 0 }; if (i >= 0) list[i] = mine; else list.push(mine); }
      return list.map(u => ({ id: u.id, val: key === 'count' ? u.count : u.rec[key] }))
        .filter(r => r.val != null && (key !== 'count' || r.val > 0))
        .sort((a, b) => b.val - a.val);
    },
    rankOf(key, id) { const i = this.ranking(key).findIndex(r => r.id === id); return i < 0 ? null : i + 1; },
    render() {
      const box = $('#user-box'); if (!box) return;
      const u = this.current();
      box.innerHTML = u
        ? `<span class="user-name">${esc(u.id)}님</span><button class="btn sm ghost" id="btn-logout">나가기</button>`
        : `<a class="btn sm accent" href="#/login">${icon('user')} 로그인</a>`;
      const lo = $('#btn-logout'); if (lo) lo.onclick = () => { this.logout(); location.hash = '#/home'; if (location.hash === '#/home') dispatchEvent(new HashChangeEvent('hashchange')); };
    }
  };

  const RANK_KEYS = [
    ['word', '낱말 연습 타수', v => v + '타/분'], ['sentence', '짧은 글 타수', v => v + '타/분'], ['long', '긴 글 타수', v => v + '타/분'],
    ['rain', '낱말비 점수', v => v + '점'], ['mole', '두더지 점수', v => v + '점'], ['race', '단어 드라이브', v => v + '점'], ['tennis', '끝말 테니스', v => v + '회 랠리'], ['count', '연습 횟수', v => v + '번']
  ];
  Auth.RANK_KEYS = RANK_KEYS;

  /* ---------- 로그인 / 회원가입 화면 ---------- */
  route('login', (app, rest) => {
    let mode = rest[0] === 'new' ? 'signup' : 'login';
    let chosen = '';
    header(app, '로그인', '한 번 가입하면 어느 컴퓨터, 어느 휴대폰에서든 같은 이름과 비밀번호로 들어올 수 있어요.');
    const card = el('div', 'card');
    app.appendChild(card);
    const busy = (on, label) => { const b = $('#go'); if (!b) return; b.disabled = on; b.textContent = on ? '확인하는 중…' : label; };
    const pinOnly = i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); });

    function draw() {
      const tabs = `<div class="tabs">
        <button class="btn ${mode === 'login' ? 'on' : 'secondary'}" data-m="login">로그인</button>
        <button class="btn ${mode === 'signup' ? 'on' : 'secondary'}" data-m="signup">회원가입</button></div>`;
      if (mode === 'login') {
        const rec = recent.get();
        card.innerHTML = tabs + `
          <h2>다시 만나 반가워요.</h2>
          <p class="lead">이름과 비밀번호 4자리를 넣어 주세요.${rec.length ? ' 최근에 이 컴퓨터에서 쓴 이름은 눌러서 고를 수 있어요.' : ''}</p>
          ${rec.length ? `<div class="user-pick">${rec.map(n => `<button class="user-btn ${chosen === n ? 'on' : ''}" data-id="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
          <div class="form-row"><label for="uid">이름</label><input class="text-input" id="uid" type="text" maxlength="10" placeholder="예) 채영, 채민" autocomplete="off" value="${esc(chosen)}"></div>
          <div class="form-row"><label for="pin">비밀번호 (숫자 4자리)</label><input class="text-input pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-msg" id="msg"></div>
          <div class="btn-row"><button class="btn big" id="go">들어가기</button></div>
          <p class="muted center">처음이세요? 위의 <b>회원가입</b>을 눌러 주세요.</p>`;
        card.querySelectorAll('.user-btn').forEach(b => b.onclick = () => { chosen = b.dataset.id; $('#uid').value = chosen; card.querySelectorAll('.user-btn').forEach(x => x.classList.toggle('on', x.dataset.id === chosen)); $('#pin').focus(); });
        $('#uid').addEventListener('input', () => { chosen = $('#uid').value.trim(); card.querySelectorAll('.user-btn').forEach(x => x.classList.toggle('on', x.dataset.id === chosen)); });
        $('#go').onclick = async () => {
          const id = $('#uid').value.trim(), pin = $('#pin').value;
          if (!id) { $('#uid').focus(); return msg('이름을 넣어 주세요.'); }
          if (!/^\d{4}$/.test(pin)) { $('#pin').focus(); return msg(MSG.pin); }
          busy(true, '들어가기'); msg('');
          const err = await Auth.login(id, pin);
          busy(false, '들어가기');
          if (err) { msg(err); $('#pin').value = ''; $('#pin').focus(); sound.bad(); return; }
          sound.ok(); Auth.loadRanking(); location.hash = '#/home';
        };
        if (rec.length === 1 && !chosen) { chosen = rec[0]; $('#uid').value = chosen; card.querySelector('.user-btn').classList.add('on'); }
        ['uid', 'pin'].forEach(i => $('#' + i).addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); }));
        pinOnly($('#pin'));
        (chosen ? $('#pin') : $('#uid')).focus();
      } else {
        card.innerHTML = tabs + `
          <h2>나만의 연습 기록을 시작해요.</h2>
          <p class="lead">이름과 숫자 네 자리 비밀번호만 있으면 돼요. 전화번호나 이메일은 필요 없어요.</p>
          <div class="form-row"><label for="uid">이름 (부르는 이름이면 돼요)</label><input class="text-input" id="uid" type="text" maxlength="10" placeholder="예) 채영, 채민" autocomplete="off"></div>
          <div class="form-row"><label for="pin">비밀번호 (숫자 4자리)</label><input class="text-input pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-row"><label for="pin2">비밀번호 한 번 더</label><input class="text-input pin" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-msg" id="msg"></div>
          <div class="btn-row"><button class="btn big" id="go">만들고 시작하기</button></div>
          <div class="tips">비밀번호는 생일이나 기억하기 쉬운 숫자로 하세요. 이름은 다른 사람과 겹치면 쓸 수 없어요. 잊어버리면 새 이름으로 다시 만들어야 해요.</div>`;
        $('#go').onclick = async () => {
          const id = $('#uid').value, p1 = $('#pin').value, p2 = $('#pin2').value;
          if (!id.trim()) { $('#uid').focus(); return msg(MSG.name); }
          if (!/^\d{4}$/.test(p1)) { $('#pin').focus(); return msg(MSG.pin); }
          if (p1 !== p2) { $('#pin2').focus(); return msg('비밀번호 두 개가 서로 달라요.'); }
          busy(true, '만들고 시작하기'); msg('');
          const err = await Auth.signup(id, p1);
          busy(false, '만들고 시작하기');
          if (err) { msg(err); sound.bad(); return; }
          sound.win(); Auth.loadRanking(); location.hash = '#/home';
        };
        ['uid', 'pin', 'pin2'].forEach(i => $('#' + i).addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); }));
        card.querySelectorAll('.pin').forEach(pinOnly);
        $('#uid').focus();
      }
      card.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    }
    function msg(t) { const m = $('#msg'); if (m) m.textContent = t; }
    draw();
  });

  /* ---------- 랭킹 화면 ---------- */
  route('rank', (app, rest) => {
    const me = Auth.current();
    let key = RANK_KEYS.some(k => k[0] === rest[0]) ? rest[0] : 'word';
    header(app, '🏆 랭킹');
    const card = el('div', 'card');
    app.appendChild(card);
    let alive = true;
    function draw(loading) {
      const [, label, fmt] = RANK_KEYS.find(k => k[0] === key);
      const list = Auth.ranking(key);
      const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + '위';
      card.innerHTML = `
        <div class="tabs wrap">${RANK_KEYS.map(k => `<button class="btn sm ${k[0] === key ? 'on' : 'secondary'}" data-k="${k[0]}">${k[1]}</button>`).join('')}</div>
        <h2>${label}${loading ? ' <small class="muted" style="font-weight:500;font-size:.8rem">불러오는 중…</small>' : ''}</h2>
        ${list.length ? `<table class="rank-table"><tbody>${list.map((r, i) => `<tr class="${me && r.id === me.id ? 'me' : ''}"><td class="pos">${medal(i)}</td><td class="name">${esc(r.id)}${me && r.id === me.id ? ' <small>(나)</small>' : ''}</td><td class="val">${fmt(r.val)}</td></tr>`).join('')}</tbody></table>`
          : `<p class="muted center" style="padding:20px">${loading ? '' : '아직 기록이 없어요. 연습을 마치면 여기에 이름이 올라가요!'}</p>`}
        ${!me ? `<div class="btn-row"><a class="btn big accent" href="#/login">로그인하고 내 기록 올리기</a></div>` : ''}
        `;
      card.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { key = b.dataset.k; history.replaceState(null, '', '#/rank/' + key); draw(false); });
    }
    draw(true);
    Auth.loadRanking().then(() => { if (alive) draw(false); });
    return () => { alive = false; };
  });

  global.Auth = Auth;
  document.addEventListener('DOMContentLoaded', () => { Auth.render(); Auth.refresh(); Auth.loadRanking(); });
})(window);
