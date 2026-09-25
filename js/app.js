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
    const group = ['keys', 'words', 'sentences', 'long', 'practice'].includes(name) ? 'practice' : ['rain', 'mole', 'games'].includes(name) ? 'games' : name;
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === group) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    app.dataset.page = name;
    app.innerHTML = '';
    window.scrollTo(0, 0);
    const fn = routes[name] || routes.home;
    const r = fn(app, rest);
    const heading = $('h1', app);
    document.title = (heading ? heading.innerText.replace(/\s+/g, ' ').trim() + ' · ' : '') + '함미합삐 타자연습';
    if (heading) { heading.tabIndex = -1; if (!app.contains(document.activeElement)) heading.focus({ preventScroll: true }); }
    app.querySelectorAll('.type-input').forEach(input => input.setAttribute('aria-label', input.placeholder || '연습 글 입력'));
    if (typeof r === 'function') cleanup = r;
  }
  window.addEventListener('hashchange', navigate);

  /* ---------- 공용 UI ---------- */
  function header(app, title, lead, back) {
    const h = el('div', 'practice-head');
    title = title.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');
    h.innerHTML = `<div><span class="eyebrow">나의 속도로, 한 걸음씩</span><h1>${title}</h1>${lead ? `<p class="lead" style="margin:0">${lead}</p>` : ''}</div>`;
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
        <button class="btn big" id="res-again">${icon('arrow')} 다시 하기</button>
        <a class="btn big secondary" href="${opts.backHref || '#/home'}">${opts.backLabel || '처음으로'}</a>
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

  /* ---------- 홈과 연습 둘러보기 ---------- */
  const courses = [
    { route: 'keys', name: '자리연습', desc: '손가락을 어디에 둘까요?<br> 글쇠 하나부터 차근차근.', icon: 'keyboard', tone: 'peach', detail: '자판과 친해지기' },
    { route: 'words', name: '낱말연습', desc: '봄, 가족, 안녕하세요.<br> 익숙한 낱말로 가볍게.', icon: 'type', tone: 'sage', detail: '낱말 15개씩' },
    { route: 'sentences', name: '짧은글연습', desc: '마음에 남는 한마디를<br> 한 줄씩 따라 써요.', icon: 'lines', tone: 'lavender', detail: '문장 10개씩' },
    { route: 'long', name: '긴글연습', desc: '좋아하는 시와 이야기로<br> 타자의 즐거움을 길게.', icon: 'book', tone: 'sand', detail: '내 글로도 연습 가능' }
  ];
  function courseCards() {
    return `<div class="course-grid">${courses.map((c, i) => `
      <a class="course-card ${c.tone}" href="#/${c.route}">
        <div class="course-top"><span class="course-icon">${c.icon === 'type' ? '<span class="type-symbol">가</span>' : icon(c.icon)}</span><span class="course-step">0${i + 1}<span>단계</span></span></div>
        <h3>${c.name}</h3><p>${c.desc}</p>
        <div class="course-bottom"><span>${c.detail}</span><span class="round-arrow">${icon('arrow')}</span></div>
      </a>`).join('')}</div>`;
  }
  function gameCards() {
    return `<div class="game-grid">
      <a class="game-card rain-card" href="#/rain">
        <div class="game-copy"><span class="eyebrow">낱말을 톡톡</span><h3>낱말비</h3><p>하늘에서 내려오는 낱말을<br>사라지기 전에 쳐 보세요.</p><span class="game-link">게임 시작 ${icon('arrow')}</span></div>
        <div class="rain-art" aria-hidden="true"><span class="rain-stroke one"></span><span class="rain-stroke two"></span><span class="rain-stroke three"></span><span class="word-tile tile-one">봄</span><span class="word-tile tile-two">하늘</span><span class="word-tile tile-three">나무</span></div>
      </a>
      <a class="game-card mole-card" href="#/mole">
        <div class="game-copy"><span class="eyebrow">손끝으로 쏙쏙</span><h3>글쇠 두더지</h3><p>쏙 올라오는 글쇠를 톡!<br>45초 동안 가볍게 즐겨요.</p><span class="game-link">게임 시작 ${icon('arrow')}</span></div>
        <div class="mole-art" aria-hidden="true"><div class="mole-shadow"></div><div class="mini-mole"><i class="mole-ear left"></i><i class="mole-ear right"></i><i class="mole-eye left"></i><i class="mole-eye right"></i><i class="mole-nose"></i><span class="mole-key">ㄱ</span></div><span class="mole-spark">✦</span></div>
      </a>
    </div>`;
  }
  function guideContent() {
    return `<div class="guide-grid">
      <div><span class="guide-number">01</span><h3>한글로 준비하기</h3><p>한/영 키를 눌러 입력 언어를 한글로 바꿔 주세요.</p></div>
      <div><span class="guide-number">02</span><h3>손가락 제자리 찾기</h3><p>왼손 검지는 <kbd>ㄹ</kbd>, 오른손 검지는 <kbd>ㅓ</kbd>. 작은 돌기가 느껴질 거예요.</p></div>
      <div><span class="guide-number">03</span><h3>편안하게 맞추기</h3><p>위쪽 ‘화면 설정’에서 글자를 키우고, 낱말 읽어주기를 켤 수 있어요.</p></div>
    </div>`;
  }
  route('home', app => {
    const u = records.user();
    const recordItems = [['word', '낱말연습', '타/분'], ['sentence', '짧은글', '타/분'], ['long', '긴글', '타/분'], ['rain', '낱말비', '점'], ['mole', '글쇠 두더지', '점']];
    app.innerHTML = `
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <span class="hero-eyebrow"><span class="status-dot"></span> 천천히, 즐겁게. 나의 속도로.</span>
          <h1 id="hero-title">오늘도,<br><span>한 글자 더.</span></h1>
          <p class="hero-description">${u ? `<b>${esc(u.id)}님, 반가워요.</b><br>오늘도 나를 위한 작은 배움을 시작해요.` : '한 글자씩 익숙해지는 즐거움.<br>부담 없이 시작하는 나만의 타자 시간.'}</p>
          <div class="hero-actions"><a class="btn hero-cta" href="#/keys">타자연습 시작하기 ${icon('arrow')}</a><a class="text-link" href="#/guide">처음 오셨나요?</a></div>
          <p class="hero-note">${icon('check')} ${u ? `지금까지 ${u.count || 0}번의 연습을 함께했어요` : '가입 없이도 바로 연습할 수 있어요'}</p>
        </div>
        <div class="hero-visual">
          <img src="assets/typing-still-life.jpg" width="1536" height="1024" alt="따뜻한 햇살 아래 크림색 키보드와 작은 테라코타 화분" fetchpriority="high">
          <span class="image-caption">A LITTLE PRACTICE, EVERY DAY.</span>
          <div class="hero-sticker"><span class="sticker-icon">${icon('leaf')}</span><span>잘하는 것보다 중요한 건,<br><strong>오늘도 해보는 마음.</strong></span></div>
        </div>
      </section>
      <div class="welcome-strip"><span class="welcome-icon">${icon('keyboard')}</span><p><strong>처음이어도 괜찮아요.</strong><span> 자리연습부터 한 걸음씩 함께해요.</span></p><a href="#/keys">첫 연습 시작 ${icon('arrow')}</a></div>
      <section class="home-section" aria-labelledby="practice-title">
        <div class="section-heading"><div><span class="eyebrow">기초부터 차근차근</span><h2 id="practice-title">어디부터 시작할까요?</h2></div><span class="section-aside">내게 맞는 연습을 골라 보세요.</span></div>
        ${courseCards()}
      </section>
      <section class="home-section games-section" aria-labelledby="games-title">
        <div class="section-heading"><div><span class="eyebrow">조금 더 신나게</span><h2 id="games-title">놀다 보면, 어느새 익숙하게.</h2></div><span class="section-aside">가볍게 즐기는 타자게임</span></div>
        ${gameCards()}
      </section>
      <section class="record-section" aria-labelledby="record-title">
        <div class="section-heading"><div><span class="eyebrow">작은 연습이 쌓이는 곳</span><h2 id="record-title">${u ? esc(u.id) + '님의' : '나의'} 최고 기록</h2></div><a class="text-link" href="#/rank">우리의 기록 보기 ${icon('arrow')}</a></div>
        <div class="records">${recordItems.map(([key, label, unit]) => { const value = records.get(key); return `<div class="record"><span class="label">${label}</span><div class="val">${value == null ? '<span class="empty-record">—</span>' : value}<span class="record-unit">${unit}</span></div></div>`; }).join('')}</div>
        <p class="record-note">${icon(u ? 'shield' : 'user')} ${u ? '오늘의 연습도 내 이름으로 차곡차곡 쌓여요.' : '지금은 손님 기록이에요. <a href="#/login">로그인</a>하면 내 이름으로 모을 수 있어요.'}</p>
      </section>
      <details class="home-guide"><summary><span>${icon('bulb')} 시작 전, 이것만 알아두세요</span><span class="guide-plus" aria-hidden="true">+</span></summary>${guideContent()}</details>`;
  });
  route('practice', app => {
    header(app, '어디부터 시작할까요?', '처음이라면 자리연습부터. 익숙해졌다면 원하는 연습을 골라 보세요.');
    app.insertAdjacentHTML('beforeend', courseCards());
  });
  route('games', app => {
    header(app, '놀다 보면, 어느새 익숙하게.', '빠르기를 직접 고르고, 내 속도로 즐기는 타자게임.');
    app.insertAdjacentHTML('beforeend', gameCards());
  });
  route('guide', app => {
    header(app, '시작은 가볍게, 내 속도로.', '키보드가 처음이어도 괜찮아요. 하나씩 함께 익혀 봐요.');
    app.insertAdjacentHTML('beforeend', `<div class="card guide-page">${guideContent()}<div class="btn-row"><a class="btn big" href="#/keys">자리연습 시작하기 ${icon('arrow')}</a></div><p class="muted center">실제 키보드가 있는 컴퓨터에서 연습하면 더 편해요.</p></div>`);
  });

  /* ---------- 설정 패널 ---------- */
  function initSettings() {
    const panel = $('#settings');
    const render = () => {
      const d = settings.data;
      panel.innerHTML = `
        <div class="card settings-card" style="margin:0"><div class="settings-heading"><div><span class="eyebrow">나에게 편안하게</span><h2>화면과 소리 설정</h2></div><button class="btn sm ghost" id="settings-close" aria-label="설정 닫기">${icon('close')}</button></div>
          <div class="setting-row"><span class="label">글자 크기</span>
            ${[['normal','보통'],['large','크게'],['xlarge','아주 크게']].map(([v, l]) => `<button class="btn sm ${d.size === v ? 'on' : 'secondary'}" aria-pressed="${d.size === v}" data-k="size" data-v="${v}">${l}</button>`).join('')}
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
      panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k, v = b.dataset.v;
        settings.data[k] = k === 'size' ? v : v === '1';
        settings.save(); render();
        panel.querySelector(`[data-k="${k}"][data-v="${v}"]`).focus();
        document.querySelectorAll('.kbd').forEach(kb => kb.classList.toggle('hidden', !settings.data.keyboard));
        if (k === 'sound' && settings.data.sound) sound.ok();
      });
      panel.querySelectorAll('[data-k]:not([data-k="size"])').forEach(b => b.setAttribute('aria-pressed', String(d[b.dataset.k] === (b.dataset.v === '1'))));
      $('#settings-close').onclick = () => { toggleSettings(false); $('#btn-settings').focus(); };
    };
    render();
    function toggleSettings(force) {
      const open = panel.classList.toggle('open', force);
      $('#btn-settings').setAttribute('aria-expanded', String(open));
      render();
      if (open) panel.querySelector('button').focus();
    }
    $('#btn-settings').onclick = () => toggleSettings(!panel.classList.contains('open'));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.classList.contains('open')) { toggleSettings(false); $('#btn-settings').focus(); }
    });
  }

  global.App = { $, el, shuffle, pick, esc, settings, records, sound, speak, route, header, statsBar, setStat, fmtTime, showResult, makeStats, paintTarget, paintHint, resetInput };

  document.addEventListener('DOMContentLoaded', () => {
    settings.load(); initSettings(); navigate();
    $('.skip-link').addEventListener('click', e => { e.preventDefault(); $('#main-content').focus(); });
  });
})(window);
