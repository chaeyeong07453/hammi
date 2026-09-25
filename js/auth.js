/* 회원가입 / 로그인 / 랭킹 (이 컴퓨터의 브라우저에만 저장) */
(function (global) {
  const { $, el, esc, route, header, sound } = App;
  const USERS_KEY = 'hammi.users', SESSION_KEY = 'hammi.session';

  // 아주 간단한 해시. 보안용이 아니라 비밀번호를 그대로 저장하지 않기 위한 용도
  function hash(str) {
    let h = 5381;
    for (const ch of 'hammi:' + str) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
  }

  const store = {
    all() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { return []; } },
    saveAll(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  };

  const Auth = {
    current() {
      const id = localStorage.getItem(SESSION_KEY);
      return id ? store.all().find(u => u.id === id) || null : null;
    },
    users() { return store.all(); },
    exists(id) { return store.all().some(u => u.id === id); },
    signup(id, pin) {
      id = id.trim();
      if (id.length < 1 || id.length > 10) return '이름은 1~10글자로 넣어 주세요.';
      if (!/^\d{4}$/.test(pin)) return '비밀번호는 숫자 4자리예요.';
      if (this.exists(id)) return '이미 있는 이름이에요. 다른 이름을 써 주세요.';
      const list = store.all();
      list.push({ id, pin: hash(pin), rec: {}, count: 0, created: Date.now(), last: Date.now() });
      store.saveAll(list);
      localStorage.setItem(SESSION_KEY, id);
      this.render();
      return null;
    },
    login(id, pin) {
      const u = store.all().find(x => x.id === id.trim());
      if (!u) return '그런 이름이 없어요. 회원가입을 먼저 해 주세요.';
      if (u.pin !== hash(pin)) return '비밀번호가 달라요. 다시 넣어 주세요.';
      u.last = Date.now(); this.save(u);
      localStorage.setItem(SESSION_KEY, u.id);
      this.render();
      return null;
    },
    logout() { localStorage.removeItem(SESSION_KEY); this.render(); },
    save(user) {
      const list = store.all();
      const i = list.findIndex(x => x.id === user.id);
      if (i >= 0) list[i] = user; else list.push(user);
      store.saveAll(list);
    },
    remove(id) { store.saveAll(store.all().filter(u => u.id !== id)); if (localStorage.getItem(SESSION_KEY) === id) this.logout(); },
    // 항목별 순위표. [{id, val}] 내림차순
    ranking(key) {
      return store.all()
        .map(u => ({ id: u.id, val: key === 'count' ? (u.count || 0) : u.rec[key] }))
        .filter(r => r.val != null && (key !== 'count' || r.val > 0))
        .sort((a, b) => b.val - a.val);
    },
    rankOf(key, id) { const i = this.ranking(key).findIndex(r => r.id === id); return i < 0 ? null : i + 1; },
    // 상단바 표시
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
    ['word', '낱말연습 타수', v => v + '타/분'], ['sentence', '짧은글 타수', v => v + '타/분'], ['long', '긴글 타수', v => v + '타/분'],
    ['rain', '낱말비 점수', v => v + '점'], ['mole', '두더지 점수', v => v + '점'], ['count', '연습 횟수', v => v + '번']
  ];
  Auth.RANK_KEYS = RANK_KEYS;

  /* ---------- 로그인 / 회원가입 화면 ---------- */
  route('login', (app, rest) => {
    const users = Auth.users();
    let mode = rest[0] === 'new' || !users.length ? 'signup' : 'login';
    let chosen = null;

    header(app, '👤 로그인', '이 컴퓨터에서 한 번 로그인하면 계속 로그인된 상태로 있어요.');
    const card = el('div', 'card');
    app.appendChild(card);

    function draw() {
      const tabs = `<div class="tabs">
        <button class="btn ${mode === 'login' ? 'on' : 'secondary'}" data-m="login">로그인</button>
        <button class="btn ${mode === 'signup' ? 'on' : 'secondary'}" data-m="signup">회원가입</button></div>`;
      if (mode === 'login') {
        card.innerHTML = tabs + `
          <h2>다시 만나 반가워요.</h2>
          <p class="lead">이름을 누르고 비밀번호 4자리를 넣어 주세요.</p>
          <div class="user-pick">${users.map(u => `<button class="user-btn ${chosen === u.id ? 'on' : ''}" data-id="${esc(u.id)}">${esc(u.id)}</button>`).join('')}</div>
          <div class="form-row"><label for="pin">비밀번호 (숫자 4자리)</label><input class="text-input pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-msg" id="msg"></div>
          <div class="btn-row"><button class="btn big" id="go">들어가기</button></div>`;
        card.querySelectorAll('.user-btn').forEach(b => b.onclick = () => { chosen = b.dataset.id; card.querySelectorAll('.user-btn').forEach(x => x.classList.toggle('on', x.dataset.id === chosen)); $('#pin').focus(); });
        $('#go').onclick = () => {
          if (!chosen) return msg('먼저 이름을 눌러 주세요.');
          const err = Auth.login(chosen, $('#pin').value);
          if (err) { msg(err); $('#pin').value = ''; $('#pin').focus(); sound.bad(); return; }
          sound.ok(); location.hash = '#/home';
        };
        if (users.length === 1) { chosen = users[0].id; card.querySelector('.user-btn').classList.add('on'); }
        $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });
        $('#pin').focus();
      } else {
        card.innerHTML = tabs + `
          <h2>나만의 연습 기록을 시작해요.</h2>
          <p class="lead">이름과 숫자 네 자리 비밀번호만 있으면 돼요. 전화번호나 이메일은 필요 없어요.</p>
          <div class="form-row"><label for="uid">이름 (부르는 이름이면 돼요)</label><input class="text-input" id="uid" type="text" maxlength="10" placeholder="예) 순자, 영수, 봄날" autocomplete="off"></div>
          <div class="form-row"><label for="pin">비밀번호 (숫자 4자리)</label><input class="text-input pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-row"><label for="pin2">비밀번호 한 번 더</label><input class="text-input pin" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
          <div class="form-msg" id="msg"></div>
          <div class="btn-row"><button class="btn big" id="go">만들고 시작하기</button></div>
          <div class="tips">기록은 이 브라우저에만 저장돼요. 비밀번호는 기억해 주세요. 잊어버리면 새 계정을 만들어야 해요.</div>`;
        $('#go').onclick = () => {
          const id = $('#uid').value, p1 = $('#pin').value, p2 = $('#pin2').value;
          if (p1 !== p2) return msg('비밀번호 두 개가 서로 달라요.');
          const err = Auth.signup(id, p1);
          if (err) { msg(err); sound.bad(); return; }
          sound.win(); location.hash = '#/home';
        };
        ['uid', 'pin', 'pin2'].forEach(i => $('#' + i).addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); }));
        $('#uid').focus();
      }
      card.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
      card.querySelectorAll('.pin').forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
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
    function draw() {
      const [, label, fmt] = RANK_KEYS.find(k => k[0] === key);
      const list = Auth.ranking(key);
      const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + '위';
      card.innerHTML = `
        <div class="tabs wrap">${RANK_KEYS.map(k => `<button class="btn sm ${k[0] === key ? 'on' : 'secondary'}" data-k="${k[0]}">${k[1]}</button>`).join('')}</div>
        <h2>${label}</h2>
        ${list.length ? `<table class="rank-table"><tbody>${list.map((r, i) => `<tr class="${me && r.id === me.id ? 'me' : ''}"><td class="pos">${medal(i)}</td><td class="name">${esc(r.id)}${me && r.id === me.id ? ' <small>(나)</small>' : ''}</td><td class="val">${fmt(r.val)}</td></tr>`).join('')}</tbody></table>`
          : `<p class="muted center" style="padding:20px">아직 기록이 없어요. 연습을 마치면 여기에 이름이 올라가요!</p>`}
        ${!me ? `<div class="btn-row"><a class="btn big accent" href="#/login">로그인하고 내 기록 올리기</a></div>` : ''}
        `;
      card.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { key = b.dataset.k; history.replaceState(null, '', '#/rank/' + key); draw(); });
    }
    draw();
  });

  global.Auth = Auth;
  document.addEventListener('DOMContentLoaded', () => Auth.render());
})(window);
