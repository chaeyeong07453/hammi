/* 앱 골격: 라우터, 설정, 소리, 기록, 홈 화면 */
(function (global) {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  /* ---------- 설정 ---------- */
  const settings = {
    data: { size: 'normal', sound: true, keyboard: true, speak: false },
    load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('hammi.settings') || '{}')); } catch (e) {} this.apply(); },
    save() { localStorage.setItem('hammi.settings', JSON.stringify(this.data)); this.apply(); },
    apply() { document.documentElement.dataset.size = this.data.size; }
  };

  /* ---------- 기록 ---------- */
  // 로그인한 사람이 있으면 그 사람 계정에, 없으면 이 브라우저 공용(손님)으로 저장
  const records = {
    user() { return window.Auth ? Auth.current() : null; },
    get(key) {
      const u = this.user(); if (u) return u.rec[key] == null ? null : u.rec[key];
      try { return JSON.parse(localStorage.getItem('hammi.rec.' + key)); } catch (e) { return null; }
    },
    // 더 좋은 기록이면 저장하고 true
    set(key, val, better) {
      const prev = this.get(key);
      if (prev != null && !better(val, prev)) return false;
      const u = this.user();
      if (u) { u.rec[key] = val; Auth.save(u); }
      else localStorage.setItem('hammi.rec.' + key, JSON.stringify(val));
      return true;
    },
    // 연습/게임을 하나 마칠 때마다 횟수 증가
    bump() { const u = this.user(); if (u) { u.count = (u.count || 0) + 1; u.last = Date.now(); Auth.save(u); } }
  };

  /* ---------- 소리 ---------- */
  let ctx = null;
  function beep(freq, dur, type, vol) {
    if (!settings.data.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = vol || 0.08;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) {}
  }
  const sound = {
    ok() { beep(880, 0.12); },
    bad() { beep(180, 0.25, 'square', 0.05); },
    tick() { beep(600, 0.05, 'triangle', 0.04); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25), i * 120)); },
    lose() { [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'square', 0.05), i * 180)); }
  };

  /* ---------- 읽어주기 ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 0.85;
    speechSynthesis.speak(u);
  }

  /* ---------- 라우터 ---------- */
  const routes = {};
  let cleanup = null;
  function route(name, fn) { routes[name] = fn; }
  function navigate() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const [name, ...rest] = hash.split('/');
    const app = $('#app');
    app.innerHTML = '';
    window.scrollTo(0, 0);
    const fn = routes[name] || routes.home;
    const r = fn(app, rest);
    if (typeof r === 'function') cleanup = r;
  }
  window.addEventListener('hashchange', navigate);

  /* ---------- 공용 UI ---------- */
  function header(app, title, lead, back) {
    const h = el('div', 'practice-head');
    h.innerHTML = `<div><h1>${title}</h1>${lead ? `<p class="lead" style="margin:0">${lead}</p>` : ''}</div>`;
    const b = el('a', 'btn ghost', '← ' + (back || '처음으로'));
    b.href = '#/home';
    h.appendChild(b);
    app.appendChild(h);
    return h;
  }

  function statsBar(items) {
    const s = el('div', 'stats');
    items.forEach(([label, id, init]) => {
      s.innerHTML += `<div class="stat"><div class="label">${label}</div><div class="val" id="st-${id}">${init}</div></div>`;
    });
    return s;
  }
  function setStat(id, v) { const e = $('#st-' + id); if (e) e.textContent = v; }

  function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}분 ${s % 60}초`; }

  // 결과 화면
  function showResult(app, opts) {
    app.innerHTML = '';
    const card = el('div', 'card result');
    const isNew = opts.recordKey ? records.set(opts.recordKey, opts.recordVal, opts.better || ((a, b) => a > b)) : false;
    records.bump();
    const u = records.user();
    const rank = u && opts.recordKey ? Auth.rankOf(opts.recordKey, u.id) : null;
    card.innerHTML = `
      <h1>${opts.title}</h1>
      ${isNew ? '<div class="new-record">🏆 새로운 최고 기록!</div>' : ''}
      ${rank ? `<div class="rank-note">현재 <a href="#/rank/${opts.recordKey}">랭킹 ${rank}위</a></div>` : (!u && opts.recordKey ? `<div class="rank-note muted"><a href="#/login">로그인</a>하면 기록이 내 이름으로 저장되고 랭킹에 올라가요</div>` : '')}
      <div class="cheer">${opts.cheer}</div>
      <div class="big-stats">${opts.stats.map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="btn-row">
        <button class="btn big" id="res-again">🔁 다시 하기</button>
        <a class="btn big secondary" href="${opts.backHref || '#/home'}">${opts.backLabel || '🏠 처음으로'}</a>
      </div>`;
    app.appendChild(card);
    $('#res-again').onclick = opts.onAgain;
    if (opts.win !== false) sound.win();
    $('#res-again').focus();
  }

  /* ---------- 타자 통계 계산기 ---------- */
  function makeStats() {
    return {
      start: null, strokes: 0, chars: 0, correct: 0, curStrokes: 0,
      touch() { if (!this.start) this.start = Date.now(); },
      elapsed() { return this.start ? Date.now() - this.start : 0; },
      // 완료된 한 항목 반영. 글자별 비교
      commit(target, typed) {
        const t = [...target], u = [...typed];
        let c = 0;
        for (let i = 0; i < t.length; i++) if (u[i] === t[i]) { c++; this.strokes += Hangul.strokes(t[i]); }
        this.chars += t.length; this.correct += c; this.curStrokes = 0;
        return c === t.length && u.length === t.length;
      },
      // 입력 중인 항목의 맞은 앞부분 (실시간 타수용)
      live(target, typed) {
        const t = Hangul.toKeys(target), u = Hangul.toKeys(typed);
        let i = 0; while (i < u.length && i < t.length && u[i] === t[i]) i++;
        this.curStrokes = i;
      },
      spm() { const m = this.elapsed() / 60000; return m < 0.05 ? 0 : Math.round((this.strokes + this.curStrokes) / m); },
      acc() { return this.chars ? Math.round(this.correct / this.chars * 100) : 100; }
    };
  }

  // 목표 문자열을 글자별 span으로 표시하고 입력과 비교해 색칠
  function paintTarget(container, target, typed) {
    const t = [...target], u = [...typed];
    container.innerHTML = t.map((ch, i) => {
      let cls = 'ch';
      if (i < u.length) {
        if (u[i] === ch) cls += ' ok';
        else if (i === u.length - 1 && Hangul.isSyllable(ch) && Hangul.toKeys(ch).join('').startsWith(Hangul.toKeys(u[i]).join(''))) cls += ' cur'; // 조합 중
        else cls += ' bad';
      } else if (i === u.length) cls += ' cur';
      return `<span class="${cls}">${esc(ch)}</span>`;
    }).join('');
  }

  // 다음 키 힌트 표시
  function paintHint(bar, kb, info) {
    if (!info) { bar.innerHTML = ''; kb && kb.highlight(null); return; }
    const hand = info.finger.startsWith('왼') ? 'left' : info.finger.startsWith('오') ? 'right' : '';
    bar.innerHTML =
      `<span class="muted">다음 글쇠</span><span class="hint-key">${info.shift ? '⇧ + ' : ''}${esc(info.label)}</span>` +
      (info.finger ? `<span class="finger ${hand}">${info.finger}</span>` : '');
    kb && kb.highlight(info.code, info.shift);
  }

  // 입력 후 IME 조합을 끝내고 값을 비운다
  function resetInput(input) {
    input.blur(); input.value = ''; input.classList.remove('ok', 'bad');
    setTimeout(() => input.focus(), 0);
  }

  /* ---------- 홈 ---------- */
  route('home', app => {
    const best = k => records.get(k);
    const w = best('word'), s = best('sentence'), l = best('long'), r = best('rain'), m = best('mole');
    const u = records.user();
    app.innerHTML = `
      <div class="hero">
        <h1>👵👴 함미합삐 타자연습</h1>
        <p class="lead">${u ? `👋 <b>${esc(u.id)}</b>님, 오늘도 반가워요! 지금까지 ${u.count || 0}번 연습했어요.` : '천천히, 즐겁게, 매일 조금씩. 자판과 친해지는 연습장입니다.'}</p>
        ${u ? '' : '<a class="btn accent" href="#/login">👤 로그인하고 내 기록 남기기</a>'}
      </div>
      <div class="menu-grid">
        <a class="menu-card" href="#/keys"><span class="icon">⌨️</span><span class="title">1단계 · 자리연습</span><span class="desc">글쇠 하나씩, 손가락 자리부터 익혀요</span></a>
        <a class="menu-card" href="#/words"><span class="icon">🍎</span><span class="title">2단계 · 낱말연습</span><span class="desc">일상에서 쓰는 쉬운 낱말을 쳐 봐요</span></a>
        <a class="menu-card" href="#/sentences"><span class="icon">📝</span><span class="title">3단계 · 짧은글연습</span><span class="desc">속담과 일상 문장을 한 줄씩</span></a>
        <a class="menu-card" href="#/long"><span class="icon">📖</span><span class="title">4단계 · 긴글연습</span><span class="desc">시와 이야기를 한 줄 한 줄 따라 쳐요</span></a>
        <a class="menu-card game" href="#/rain"><span class="icon">🌧️</span><span class="title">게임 · 낱말비</span><span class="desc">떨어지는 낱말을 바닥에 닿기 전에!</span></a>
        <a class="menu-card game" href="#/mole"><span class="icon">🐹</span><span class="title">게임 · 글쇠 두더지</span><span class="desc">두더지가 든 글쇠를 재빨리 눌러요</span></a>
        <a class="menu-card rank" href="#/rank"><span class="icon">🏆</span><span class="title">랭킹</span><span class="desc">이 컴퓨터에서 누가 제일 잘 치나 겨뤄 봐요</span></a>
      </div>
      <div class="card">
        <h2>🏆 ${u ? esc(u.id) + '님의' : '나의'} 최고 기록 ${u ? '' : '<small class="muted" style="font-weight:500;font-size:.8rem">(로그인 전에는 손님 기록)</small>'}</h2>
        <div class="records">
          <div class="record"><div class="label">낱말연습 타수</div><div class="val">${w ? w + '타/분' : '-'}</div></div>
          <div class="record"><div class="label">짧은글 타수</div><div class="val">${s ? s + '타/분' : '-'}</div></div>
          <div class="record"><div class="label">긴글 타수</div><div class="val">${l ? l + '타/분' : '-'}</div></div>
          <div class="record"><div class="label">낱말비 점수</div><div class="val">${r != null ? r + '점' : '-'}</div></div>
          <div class="record"><div class="label">두더지 점수</div><div class="val">${m != null ? m + '점' : '-'}</div></div>
        </div>
      </div>
      <div class="tips">💡 <b>시작 전에 확인하세요</b>
        <ul>
          <li>자판이 <b>한글</b>로 되어 있는지 확인하세요. (한/영 키 또는 키보드 오른쪽 아래 표시)</li>
          <li>왼손 검지는 <b>ㄹ</b>, 오른손 검지는 <b>ㅓ</b> 위에 올려 두세요. 두 글쇠에는 작은 돌기가 있어요.</li>
          <li>글자가 작으면 위쪽 <b>⚙️ 설정</b>에서 글자 크기를 키울 수 있어요.</li>
        </ul>
      </div>`;
  });

  /* ---------- 설정 패널 ---------- */
  function initSettings() {
    const panel = $('#settings');
    const render = () => {
      const d = settings.data;
      panel.innerHTML = `
        <div class="card" style="margin:0">
          <div class="setting-row"><span class="label">글자 크기</span>
            ${[['normal','보통'],['large','크게'],['xlarge','아주 크게']].map(([v, l]) => `<button class="btn sm ${d.size === v ? 'on' : 'secondary'}" data-k="size" data-v="${v}">${l}</button>`).join('')}
          </div>
          <div class="setting-row"><span class="label">효과음</span>
            <button class="btn sm ${d.sound ? 'on' : 'secondary'}" data-k="sound" data-v="1">켜기</button>
            <button class="btn sm ${!d.sound ? 'on' : 'secondary'}" data-k="sound" data-v="0">끄기</button>
          </div>
          <div class="setting-row"><span class="label">화면 자판</span>
            <button class="btn sm ${d.keyboard ? 'on' : 'secondary'}" data-k="keyboard" data-v="1">보이기</button>
            <button class="btn sm ${!d.keyboard ? 'on' : 'secondary'}" data-k="keyboard" data-v="0">숨기기</button>
          </div>
          <div class="setting-row"><span class="label">낱말 읽어주기</span>
            <button class="btn sm ${d.speak ? 'on' : 'secondary'}" data-k="speak" data-v="1">켜기</button>
            <button class="btn sm ${!d.speak ? 'on' : 'secondary'}" data-k="speak" data-v="0">끄기</button>
          </div>
        </div>`;
      panel.querySelectorAll('button').forEach(b => b.onclick = () => {
        const k = b.dataset.k, v = b.dataset.v;
        settings.data[k] = k === 'size' ? v : v === '1';
        settings.save(); render();
        document.querySelectorAll('.kbd').forEach(kb => kb.classList.toggle('hidden', !settings.data.keyboard));
        if (k === 'sound' && settings.data.sound) sound.ok();
      });
    };
    render();
    $('#btn-settings').onclick = () => { panel.classList.toggle('open'); render(); };
  }

  global.App = { $, el, shuffle, pick, esc, settings, records, sound, speak, route, header, statsBar, setStat, fmtTime, showResult, makeStats, paintTarget, paintHint, resetInput };

  document.addEventListener('DOMContentLoaded', () => { settings.load(); initSettings(); navigate(); });
})(window);
