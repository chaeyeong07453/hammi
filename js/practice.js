/* 연습 모드: 낱말연습 / 짧은글연습 / 긴글연습 */
(function () {
  const { routes, $, el, shuffle, pick, esc, settings, sound, speak, route, header, statsBar, setStat, fmtTime, showResult, makeStats, paintTarget, paintHint, resetInput } = App;

  // 하위 메뉴 선택 화면
  function chooser(app, title, lead, options, cls) {
    header(app, title, lead);
    const card = el('div', 'card');
    card.innerHTML = `<h2>무엇을 연습할까요?</h2><div class="${cls || 'stage-list'}"></div>`;
    const list = card.querySelector('div');
    options.forEach(o => {
      const b = el('button', o.cls || 'stage-btn');
      b.innerHTML = o.html;
      b.onclick = () => { location.hash = o.href; };
      list.appendChild(b);
    });
    app.appendChild(card);
  }

  // 예전 주소(#/keys)로 들어오면 낱말연습으로 보냄
  route('keys', () => { location.replace('#/words'); });

  /* ================= 낱말 / 짧은글 공용 ================= */
  function runTyping(app, opt) {
    const items = opt.items;
    const stats = makeStats();
    let idx = 0, locked = false, timer = null;

    header(app, opt.title, opt.lead, opt.backLabel);
    $('.practice-head a', app).href = opt.backHref;
    const card = el('div', 'card');
    card.appendChild(statsBar([['진행', 'prog', `1 / ${items.length}`], ['타수 (타/분)', 'spm', 0], ['정확도', 'acc', '100%'], ['시간', 'time', '0분 0초']]));
    card.innerHTML += `<div class="progress"><div id="pbar"></div></div>
      <div class="target" id="target"></div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="여기에 똑같이 입력하세요">
      <div class="hint-bar" id="hint"></div>
      <div class="btn-row" style="margin:6px 0">
        <button class="btn sm secondary" id="btn-speak">${icon('sound')} 읽어주기</button>
        <button class="btn sm ghost" id="btn-skip">건너뛰기 ${icon('arrow')}</button>
      </div>
      <div id="kb"></div>`;
    app.appendChild(card);
    const kb = Keyboard.render($('#kb', card));
    kb.el.classList.toggle('hidden', !settings.data.keyboard);
    const input = $('#inp'), target = $('#target'), hint = $('#hint');

    function cur() { return items[idx]; }
    function show() {
      if (idx >= items.length) return finish();
      paintTarget(target, cur(), '');
      paintHint(hint, kb, Hangul.nextKey(cur(), ''));
      setStat('prog', `${idx + 1} / ${items.length}`);
      $('#pbar').style.width = (idx / items.length * 100) + '%';
      if (settings.data.speak) speak(cur());
      input.focus();
    }
    function update() {
      if (locked) return;
      stats.touch();
      if (!timer) timer = setInterval(() => { setStat('spm', stats.spm()); setStat('time', fmtTime(stats.elapsed())); }, 500);
      const v = input.value;
      paintTarget(target, cur(), v);
      stats.live(cur(), v);
      const nk = Hangul.nextKey(cur(), v);
      paintHint(hint, kb, nk);
      if (nk.wrong) hint.appendChild(el('span', 'msg bad', '틀렸어요. 지우고 다시!'));
      if (v === cur()) done();
    }
    function done() {
      if (locked) return;
      locked = true;
      const ok = stats.commit(cur(), input.value);
      setStat('acc', stats.acc() + '%'); setStat('spm', stats.spm());
      input.classList.add(ok ? 'ok' : 'bad');
      paintTarget(target, cur(), input.value);
      hint.innerHTML = '';
      hint.appendChild(el('span', 'msg ' + (ok ? 'ok' : 'bad'), ok ? '✔ 참 잘했어요!' : '조금 틀렸어요. 다음 낱말로 넘어가요'));
      kb.highlight(null);
      ok ? sound.ok() : sound.bad();
      setTimeout(() => { idx++; resetInput(input); locked = false; show(); }, ok ? 400 : 1100);
    }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); if (input.value.length) done(); }
    }
    function finish() {
      clearInterval(timer);
      const spm = stats.spm(), acc = stats.acc();
      showResult(app, {
        title: opt.title + ' 끝!',
        cheer: DATA.cheer(acc),
        stats: [['타수', spm + '타/분'], ['정확도', acc + '%'], ['걸린 시간', fmtTime(stats.elapsed())]],
        recordKey: acc >= 80 ? opt.recordKey : null, recordVal: spm,
        onAgain: () => location.reload(),
        backHref: opt.backHref, backLabel: opt.backLabel ? '📋 ' + opt.backLabel : undefined
      });
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', onKey);
    $('#btn-speak').onclick = () => { speak(cur()); input.focus(); };
    $('#btn-skip').onclick = () => { if (locked) return; locked = true; stats.commit(cur(), ''); setStat('acc', stats.acc() + '%'); idx++; resetInput(input); locked = false; show(); };
    show();
    return () => clearInterval(timer);
  }

  /* ================= 낱말연습 ================= */
  route('words', (app, rest) => {
    const level = rest[0];
    if (!DATA.words[level]) {
      chooser(app, '🍎 낱말연습', '화면에 나온 낱말을 똑같이 치면 자동으로 다음 낱말로 넘어가요.', [
        { href: '#/words/easy', html: `<span class="n">쉬운 낱말</span><span class="d">두세 글자의 친숙한 낱말 15개</span><span class="jm">가족 · 손주 · 김치 · 봄</span>` },
        { href: '#/words/hard', html: `<span class="n">긴 낱말</span><span class="d">받침과 겹자음이 많은 낱말 15개</span><span class="jm">된장찌개 · 감사합니다</span>` }
      ]);
      return;
    }
    return runTyping(app, {
      title: '🍎 낱말연습 · ' + (level === 'easy' ? '쉬운 낱말' : '긴 낱말'),
      lead: '낱말을 다 치면 저절로 다음으로 넘어가요. 틀리면 ← 지우기로 고쳐요.',
      items: pick(DATA.words[level], 15), recordKey: 'word', backHref: '#/words', backLabel: '낱말 고르기'
    });
  });

  /* ================= 짧은글연습 ================= */
  route('sentences', (app, rest) => {
    const kind = rest[0];
    if (!DATA.sentences[kind]) {
      chooser(app, '📝 짧은글연습', '한 문장을 다 치면 저절로 다음 문장으로 넘어가요. 엔터를 눌러도 넘어가요.', [
        { href: '#/sentences/proverb', html: `<span class="n">속담</span><span class="d">익숙한 우리 속담 10개</span><span class="jm">티끌 모아 태산</span>` },
        { href: '#/sentences/daily', html: `<span class="n">일상 문장</span><span class="d">마침표와 물음표가 있는 생활 문장 10개</span><span class="jm">오늘 날씨가 참 좋습니다.</span>` }
      ]);
      return;
    }
    return runTyping(app, {
      title: '📝 짧은글연습 · ' + (kind === 'proverb' ? '속담' : '일상 문장'),
      lead: '띄어쓰기와 문장 부호까지 똑같이 쳐 보세요.',
      items: pick(DATA.sentences[kind], 10), recordKey: 'sentence', backHref: '#/sentences', backLabel: '글 고르기'
    });
  });

  /* ================= 긴글연습 ================= */
  /* 내 글 저장소 (localStorage) */
  const myTexts = {
    key: 'hammi.mytexts',
    all() { try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (e) { return []; } },
    save(list) { localStorage.setItem(this.key, JSON.stringify(list)); },
    add(title, author, body) {
      const lines = body.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/g, '').replace(/\t/g, ' '));
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      while (lines.length && !lines[0]) lines.shift();
      const t = { id: 'my' + Date.now().toString(36), title: title.trim() || '내 글', author: author.trim(), lines, custom: true };
      const list = this.all(); list.unshift(t); this.save(list); return t;
    },
    remove(id) { this.save(this.all().filter(t => t.id !== id)); }
  };

  /* 함께 보는 글: GitHub 저장소의 이슈(라벨 text)를 공유 저장소로 사용 */
  const sharedTexts = {
    repo: 'chaeyeong07453/hammi', label: 'text', cacheKey: 'hammi.shared', ttl: 5 * 60 * 1000,
    parse(issue) {
      const raw = (issue.body || '').replace(/\r/g, '');
      let author = '';
      let lines = raw.split('\n').map(l => l.replace(/\s+$/g, '').replace(/\t/g, ' '));
      if (lines[0] && /^(지은이|작가|가수|작사)\s*[:：]/.test(lines[0])) { author = lines[0].split(/[:：]/).slice(1).join(':').trim(); lines.shift(); }
      while (lines.length && !lines[0]) lines.shift();
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return { id: 's' + issue.number, number: issue.number, title: issue.title.trim() || '제목 없음', author, lines, shared: true, by: issue.user && issue.user.login, url: issue.html_url };
    },
    cached() { try { return JSON.parse(localStorage.getItem(this.cacheKey)); } catch (e) { return null; } },
    async load(force) {
      const c = this.cached();
      if (!force && c && Date.now() - c.at < this.ttl) return c.list;
      const res = await fetch(`https://api.github.com/repos/${this.repo}/issues?labels=${this.label}&state=open&per_page=100`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) { if (c) return c.list; throw new Error('load failed ' + res.status); }
      const list = (await res.json()).filter(i => !i.pull_request).map(i => this.parse(i)).filter(t => t.lines.some(l => l));
      localStorage.setItem(this.cacheKey, JSON.stringify({ at: Date.now(), list }));
      return list;
    },
    async find(id) {
      const c = this.cached();
      const hit = c && c.list.find(t => t.id === id);
      if (hit) return hit;
      return (await this.load(true)).find(t => t.id === id) || null;
    },
    // GitHub 새 이슈 작성 페이지 주소 (제목·내용·라벨이 채워진 채로 열림)
    newUrl(title, author, body) {
      const b = (author.trim() ? `지은이: ${author.trim()}\n\n` : '') + body.replace(/\r/g, '');
      return `https://github.com/${this.repo}/issues/new?labels=${this.label}&title=${encodeURIComponent(title.trim() || '제목 없음')}&body=${encodeURIComponent(b)}`;
    }
  };

  // 내 글 입력 화면
  function customEditor(app) {
    header(app, '내 글로 연습하기', '좋아하는 노래 가사나 시를 넣어 두고 연습해요.', '글 고르기');
    $('.practice-head a', app).href = '#/long';
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="form-row"><label for="my-title">제목</label><input class="text-input" id="my-title" type="text" maxlength="40" placeholder="예) 고향의 봄"></div>
      <div class="form-row"><label for="my-author">지은이 (없어도 돼요)</label><input class="text-input" id="my-author" type="text" maxlength="30" placeholder="예) 이원수"></div>
      <div class="form-row"><label for="my-body">내용</label><textarea class="text-input" id="my-body" rows="10" placeholder="여기에 가사나 시를 붙여 넣으세요.\n한 줄씩 따라 치게 됩니다. 빈 줄은 그대로 두어도 괜찮아요."></textarea></div>
      <p class="muted" id="my-count">0줄</p>
      <div class="btn-row"><button class="btn big" id="my-save">저장하고 연습 시작</button><button class="btn big accent" id="my-share">모두에게 공유하기</button><a class="btn big secondary" href="#/long">취소</a></div>
      <div class="tips">붙여 넣기는 <b>Ctrl + V</b> (맥은 <b>⌘ + V</b>)예요. <b>저장</b>은 이 컴퓨터에만 남고, <b>모두에게 공유하기</b>는 GitHub 글쓰기 창이 열려요. 거기서 초록색 <b>Submit new issue</b> 단추를 누르면 잠시 뒤 모든 사람의 긴글연습 목록에 나타나요. (GitHub 로그인이 필요해요)</div>`;
    app.appendChild(card);
    const body = $('#my-body');
    body.addEventListener('input', () => { $('#my-count').textContent = body.value.split('\n').filter(l => l.trim()).length + '줄'; });
    $('#my-save').onclick = () => {
      if (!body.value.trim()) { body.focus(); body.classList.add('bad'); setTimeout(() => body.classList.remove('bad'), 800); return; }
      const t = myTexts.add($('#my-title').value, $('#my-author').value, body.value);
      location.hash = '#/long/' + t.id;
    };
    $('#my-share').onclick = () => {
      if (!body.value.trim()) { body.focus(); body.classList.add('bad'); setTimeout(() => body.classList.remove('bad'), 800); return; }
      window.open(sharedTexts.newUrl($('#my-title').value, $('#my-author').value, body.value), '_blank', 'noopener');
    };
    $('#my-title').focus();
  }

  route('long', (app, rest) => {
    if (rest[0] === 'new') return customEditor(app);
    // 공유 글은 불러온 뒤 같은 화면을 다시 그림
    if (/^s\d+$/.test(rest[0] || '') && !(sharedTexts.cached() || { list: [] }).list.some(t => t.id === rest[0])) {
      header(app, '📖 긴글연습', '', '글 고르기'); $('.practice-head a', app).href = '#/long';
      app.insertAdjacentHTML('beforeend', '<div class="card center muted" id="loading">글을 불러오는 중이에요…</div>');
      let alive = true;
      sharedTexts.find(rest[0]).then(t => { if (!alive) return; if (t) { app.innerHTML = ''; routes.long(app, rest); } else $('#loading').textContent = '이 글을 찾을 수 없어요. 지워졌을 수 있어요.'; })
        .catch(() => { if (alive) $('#loading').textContent = '인터넷 연결을 확인해 주세요.'; });
      return () => { alive = false; };
    }
    const text = DATA.longTexts.find(t => t.id === rest[0]) || myTexts.all().find(t => t.id === rest[0]) || (sharedTexts.cached() || { list: [] }).list.find(t => t.id === rest[0]);
    if (!text) {
      const mine = myTexts.all();
      const item = t => ({ cls: 'text-btn', href: '#/long/' + t.id, html: `<span class="t">${esc(t.title)}</span> <span class="a">${esc(t.author)}</span><span class="preview">${esc(t.lines.find(l => l) || '')}</span>` });
      header(app, '📖 긴글연습', '시와 이야기를 한 줄씩 따라 쳐요. 한 줄을 다 치면 다음 줄로 넘어가요.');
      const my = el('div', 'card');
      my.innerHTML = `<h2>내 글</h2><p class="lead">좋아하는 노래 가사나 시를 직접 넣어 연습할 수 있어요.</p><div class="text-list" id="my-list"></div>`;
      const ml = $('#my-list', my);
      const nb = el('button', 'text-btn new', `<span class="t">＋ 새 글 넣기</span><span class="preview">가사, 시, 편지… 무엇이든 좋아요</span>`);
      nb.onclick = () => { location.hash = '#/long/new'; };
      ml.appendChild(nb);
      mine.forEach(t => {
        const o = item(t); const b = el('button', o.cls); b.innerHTML = o.html; b.onclick = () => { location.hash = o.href; };
        const del = el('span', 'del', '🗑 지우기'); del.title = '이 글 지우기';
        del.onclick = ev => { ev.stopPropagation(); if (confirm(`「${t.title}」을(를) 지울까요?`)) { myTexts.remove(t.id); b.remove(); } };
        b.appendChild(del); ml.appendChild(b);
      });
      app.appendChild(my);
      // 함께 보는 글
      const sh = el('div', 'card');
      sh.innerHTML = `<h2>함께 보는 글</h2><p class="lead">누군가 공유한 글이에요. 인터넷이 연결되어 있으면 모두 같은 목록을 봐요.</p><div class="text-list" id="shared-list"><div class="muted">불러오는 중…</div></div>`;
      app.appendChild(sh);
      let alive = true;
      sharedTexts.load().then(list => {
        if (!alive) return;
        const sl = $('#shared-list', sh); sl.innerHTML = '';
        if (!list.length) { sl.innerHTML = '<div class="muted">아직 공유된 글이 없어요. 새 글 넣기에서 <b>모두에게 공유하기</b>를 눌러 보세요.</div>'; return; }
        list.forEach(t => { const o = item(t); const b = el('button', o.cls + ' shared'); b.innerHTML = o.html; b.onclick = () => { location.hash = o.href; }; sl.appendChild(b); });
      }).catch(() => { if (alive) $('#shared-list', sh).innerHTML = '<div class="muted">지금은 불러올 수 없어요. 인터넷 연결을 확인해 주세요.</div>'; });
      const card = el('div', 'card');
      card.innerHTML = `<h2>준비된 글</h2><div class="text-list"></div>`;
      const list = card.querySelector('.text-list');
      DATA.longTexts.forEach(t => { const o = item(t); const b = el('button', o.cls); b.innerHTML = o.html; b.onclick = () => { location.hash = o.href; }; list.appendChild(b); });
      app.appendChild(card);
      return () => { alive = false; };
    }
    const lines = text.lines;
    const typeIdx = lines.map((l, i) => l ? i : -1).filter(i => i >= 0);
    const stats = makeStats();
    let pos = 0, locked = false, timer = null;

    header(app, `📖 ${esc(text.title)}`, text.author ? esc(text.author) : '', '글 고르기');
    $('.practice-head a', app).href = '#/long';
    const card = el('div', 'card');
    card.appendChild(statsBar([['진행', 'prog', `1 / ${typeIdx.length}줄`], ['타수 (타/분)', 'spm', 0], ['정확도', 'acc', '100%'], ['시간', 'time', '0분 0초']]));
    card.innerHTML += `<div class="progress"><div id="pbar"></div></div>
      <div class="long-text" id="ltext">${lines.map((l, i) => `<div class="line ${l ? '' : 'blank'}" data-i="${i}">${esc(l)}</div>`).join('')}</div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="주황색 줄을 똑같이 입력하세요">
      <div class="hint-bar" id="hint"></div>
      <div class="btn-row" style="margin:6px 0">
        <button class="btn sm secondary" id="btn-speak">${icon('sound')} 이 줄 읽어주기</button>
        <button class="btn sm ghost" id="btn-skip">이 줄 건너뛰기 ${icon('arrow')}</button>
      </div>
      <div id="kb"></div>`;
    app.appendChild(card);
    const kb = Keyboard.render($('#kb', card));
    kb.el.classList.toggle('hidden', !settings.data.keyboard);
    const input = $('#inp'), hint = $('#hint');
    const lineEl = i => $(`.line[data-i="${i}"]`, card);
    const cur = () => lines[typeIdx[pos]];

    function show() {
      if (pos >= typeIdx.length) return finish();
      card.querySelectorAll('.line.cur').forEach(l => l.classList.remove('cur'));
      const le = lineEl(typeIdx[pos]);
      le.classList.add('cur');
      paintTarget(le, cur(), '');
      le.scrollIntoView({ block: 'center', behavior: 'smooth' });
      paintHint(hint, kb, Hangul.nextKey(cur(), ''));
      setStat('prog', `${pos + 1} / ${typeIdx.length}줄`);
      $('#pbar').style.width = (pos / typeIdx.length * 100) + '%';
      if (settings.data.speak) speak(cur());
      input.focus();
    }
    function update() {
      if (locked) return;
      stats.touch();
      if (!timer) timer = setInterval(() => { setStat('spm', stats.spm()); setStat('time', fmtTime(stats.elapsed())); }, 500);
      const v = input.value;
      paintTarget(lineEl(typeIdx[pos]), cur(), v);
      stats.live(cur(), v);
      const nk = Hangul.nextKey(cur(), v);
      paintHint(hint, kb, nk);
      if (nk.wrong) hint.appendChild(el('span', 'msg bad', '틀렸어요. 지우고 다시!'));
      if (v === cur()) done();
    }
    function done() {
      if (locked) return;
      locked = true;
      const ok = stats.commit(cur(), input.value);
      setStat('acc', stats.acc() + '%'); setStat('spm', stats.spm());
      const le = lineEl(typeIdx[pos]);
      paintTarget(le, cur(), input.value);
      input.classList.add(ok ? 'ok' : 'bad');
      ok ? sound.ok() : sound.bad();
      setTimeout(() => {
        le.classList.remove('cur'); le.classList.add('done'); le.textContent = cur();
        pos++; resetInput(input); locked = false; show();
      }, ok ? 300 : 900);
    }
    function finish() {
      clearInterval(timer);
      const spm = stats.spm(), acc = stats.acc();
      showResult(app, {
        title: `「${esc(text.title)}」 다 쳤어요!`,
        cheer: DATA.cheer(acc),
        stats: [['타수', spm + '타/분'], ['정확도', acc + '%'], ['걸린 시간', fmtTime(stats.elapsed())]],
        recordKey: acc >= 80 ? 'long' : null, recordVal: spm,
        onAgain: () => location.reload(), backHref: '#/long', backLabel: '📋 다른 글 고르기'
      });
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (input.value.length) done(); } });
    $('#btn-speak').onclick = () => { speak(cur()); input.focus(); };
    $('#btn-skip').onclick = () => { if (locked) return; input.value = ''; locked = true; stats.commit(cur(), ''); setStat('acc', stats.acc() + '%'); const le = lineEl(typeIdx[pos]); le.classList.remove('cur'); le.classList.add('done'); le.textContent = cur(); pos++; resetInput(input); locked = false; show(); };
    show();
    return () => clearInterval(timer);
  });
})();
