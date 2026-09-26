/* 연습 모드: 낱말 연습 / 짧은 글 연습 / 긴 글 연습 */
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

  // 예전 주소(#/keys)로 들어오면 낱말 연습으로 보냄
  route('keys', () => { location.replace('#/words'); });

  /* ================= 낱말 / 짧은 글 공용 ================= */
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

  /* ================= 낱말 연습 ================= */
  route('words', (app, rest) => {
    const level = rest[0];
    if (!DATA.words[level]) {
      chooser(app, '🍎 낱말 연습', '화면에 나온 낱말을 똑같이 치면 자동으로 다음 낱말로 넘어가요.', [
        { href: '#/words/easy', html: `<span class="n">쉬운 낱말</span><span class="d">두세 글자의 친숙한 낱말 15개</span><span class="jm">가족 · 손주 · 김치 · 봄</span>` },
        { href: '#/words/hard', html: `<span class="n">긴 낱말</span><span class="d">받침과 겹자음이 많은 낱말 15개</span><span class="jm">된장찌개 · 감사합니다</span>` }
      ]);
      return;
    }
    return runTyping(app, {
      title: '🍎 낱말 연습 · ' + (level === 'easy' ? '쉬운 낱말' : '긴 낱말'),
      lead: '낱말을 다 치면 저절로 다음으로 넘어가요. 틀리면 ← 지우기로 고쳐요.',
      items: pick(DATA.words[level], 15), recordKey: 'word', backHref: '#/words', backLabel: '낱말 고르기'
    });
  });

  /* ================= 짧은 글 연습 ================= */
  route('sentences', (app, rest) => {
    const kind = rest[0];
    if (!DATA.sentences[kind]) {
      chooser(app, '📝 짧은 글 연습', '한 문장을 다 치면 저절로 다음 문장으로 넘어가요. 엔터를 눌러도 넘어가요.', [
        { href: '#/sentences/proverb', html: `<span class="n">속담</span><span class="d">익숙한 우리 속담 10개</span><span class="jm">티끌 모아 태산</span>` },
        { href: '#/sentences/daily', html: `<span class="n">일상 문장</span><span class="d">마침표와 물음표가 있는 생활 문장 10개</span><span class="jm">오늘 날씨가 참 좋습니다.</span>` }
      ]);
      return;
    }
    return runTyping(app, {
      title: '📝 짧은 글 연습 · ' + (kind === 'proverb' ? '속담' : '일상 문장'),
      lead: '띄어쓰기와 문장 부호까지 똑같이 쳐 보세요.',
      items: pick(DATA.sentences[kind], 10), recordKey: 'sentence', backHref: '#/sentences', backLabel: '글 고르기'
    });
  });

  /* ================= 긴 글 연습 ================= */
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

  /* 함께 보는 글: Supabase(무료 DB)에 저장. 누구나 올리고, 올릴 때 정한 비밀번호 4자리로 지울 수 있음 */
  const sharedTexts = {
    url: 'https://xavhkigxzoxysirilqnk.supabase.co/rest/v1',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmhraWd4em94eXNpcmlscW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMDUyMTUsImV4cCI6MjEwNTg4MTIxNX0.rITpU9JSawVgvLCzZqXgBWcCgeUbN-kKFJmmN_gdb2o',
    cacheKey: 'hammi.shared', ttl: 2 * 60 * 1000,
    headers(extra) { return Object.assign({ apikey: this.key, Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' }, extra || {}); },
    hash(pin) { let h = 5381; for (const ch of 'share:' + pin) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h.toString(36); },
    splitLines(body) {
      const lines = body.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/g, '').replace(/\t/g, ' '));
      while (lines.length && !lines[0]) lines.shift();
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return lines;
    },
    parse(row) { return { id: 's' + row.id, dbId: row.id, title: (row.title || '').trim() || '제목 없음', author: (row.author || '').trim(), writer: (row.writer || '').trim(), owner: (row.owner || '').trim(), body: (row.body || '').replace(/\r/g, ''), lines: this.splitLines(row.body || ''), shared: true, created: row.created_at }; },
    me() { const u = window.Auth && Auth.current(); return u && u.id ? { id: u.id, token: u.token || '' } : null; },
    isOwner(t) { const u = this.me(); return !!(u && t.owner && t.owner === u.id); },
    cached() { try { return JSON.parse(localStorage.getItem(this.cacheKey)); } catch (e) { return null; } },
    async load(force) {
      const c = this.cached();
      if (!force && c && Date.now() - c.at < this.ttl) return c.list;
      let res = await fetch(`${this.url}/shared_texts?select=id,title,author,body,writer,owner,created_at&order=created_at.desc&limit=200`, { headers: this.headers() });
      // owner 열이 아직 없는 서버(SQL v2 미적용)면 예전 열만으로 다시 읽음
      if (res.status === 400) res = await fetch(`${this.url}/shared_texts?select=id,title,author,body,writer,created_at&order=created_at.desc&limit=200`, { headers: this.headers() });
      if (!res.ok) { if (c) return c.list; throw new Error('load failed ' + res.status); }
      const list = (await res.json()).map(r => this.parse(r)).filter(t => t.lines.some(l => l));
      localStorage.setItem(this.cacheKey, JSON.stringify({ at: Date.now(), list }));
      return list;
    },
    async find(id) {
      const c = this.cached();
      const hit = c && c.list.find(t => t.id === id);
      if (hit) return hit;
      return (await this.load(true)).find(t => t.id === id) || null;
    },
    async add(title, author, body, pin, writer) {
      const u = this.me();
      const payload = { title: title.trim() || '제목 없음', author: author.trim(), body: body.replace(/\r/g, ''), pin: pin ? this.hash(pin) : '', writer: (writer || '').trim() };
      if (u) payload.owner = u.id;
      let res = await fetch(`${this.url}/shared_texts`, { method: 'POST', headers: this.headers({ Prefer: 'return=representation' }), body: JSON.stringify(payload) });
      if (res.status === 400 && payload.owner) { delete payload.owner; res = await fetch(`${this.url}/shared_texts`, { method: 'POST', headers: this.headers({ Prefer: 'return=representation' }), body: JSON.stringify(payload) }); }
      if (!res.ok) throw new Error('add failed ' + res.status);
      const row = (await res.json())[0];
      localStorage.removeItem(this.cacheKey);
      return this.parse(row);
    },
    // 권한 인자: 내 계정(토큰) 또는 비밀번호. pin이 비면 계정으로만
    authArgs(pin) { const u = this.me(); return { p_pin: pin ? this.hash(pin) : '', p_owner: u ? u.id : '', p_token: u ? u.token : '' }; },
    async rpc(name, args) { return fetch(`${this.url}/rpc/${name}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(args) }); },
    async remove(dbId, pin) {
      let res = await this.rpc('shared_text_delete', { p_id: dbId, ...this.authArgs(pin) });
      // 서버에 새 함수가 아직 없으면 예전 방식(비밀번호만)으로
      if (res.status === 404) { if (!pin) return false; res = await this.rpc('delete_shared_text', { p_id: dbId, p_pin: this.hash(pin) }); }
      if (!res.ok) throw new Error('remove failed ' + res.status);
      const ok = (await res.json()) === true;
      if (ok) localStorage.removeItem(this.cacheKey);
      return ok;
    },
    async update(dbId, pin, title, author, body) {
      const res = await this.rpc('shared_text_update', { p_id: dbId, ...this.authArgs(pin), p_title: title.trim() || '제목 없음', p_author: author.trim(), p_body: body.replace(/\r/g, '') });
      if (res.status === 404) throw new Error('not-ready');
      if (!res.ok) throw new Error('update failed ' + res.status);
      const ok = (await res.json()) === true;
      if (ok) localStorage.removeItem(this.cacheKey);
      return ok;
    }
  };

  // 내 글 입력 화면 (editing: 고칠 공유 글이면 그 글)
  function customEditor(app, editing) {
    const me = sharedTexts.me();
    const owner = editing && sharedTexts.isOwner(editing);
    header(app, editing ? '공유한 글 고치기' : '내 글로 연습하기', editing ? '고친 내용은 모든 사람의 목록에 바로 반영돼요.' : '좋아하는 노래 가사나 시를 넣어 두고 연습해요.', '글 고르기');
    $('.practice-head a', app).href = '#/long';
    const card = el('div', 'card');
    const pinLabel = editing
      ? (owner ? '비밀번호 (내가 올린 글이라 넣지 않아도 돼요)' : '올릴 때 정한 비밀번호 (숫자 4자리)')
      : (me ? '지우기 비밀번호 (숫자 4자리, 로그인 중이라 넣지 않아도 돼요)' : '지우기 비밀번호 (숫자 4자리, 모두에게 공유할 때만)');
    card.innerHTML = `
      <div class="form-row"><label for="my-title">제목</label><input class="text-input" id="my-title" type="text" maxlength="40" placeholder="예) 고향의 봄"></div>
      <div class="form-row"><label for="my-author">지은이 (없어도 돼요)</label><input class="text-input" id="my-author" type="text" maxlength="30" placeholder="예) 이원수"></div>
      <div class="form-row"><label for="my-body">내용</label><textarea class="text-input" id="my-body" rows="10" placeholder="여기에 가사나 시를 붙여 넣으세요.\n한 줄씩 따라 치게 됩니다. 빈 줄은 그대로 두어도 괜찮아요."></textarea></div>
      <p class="muted" id="my-count">0줄</p>
      <div class="form-row"><label for="my-pin">${pinLabel}</label><input class="text-input pin" id="my-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off"></div>
      <div class="form-msg" id="my-msg"></div>
      <div class="btn-row">${editing
        ? `<button class="btn big accent" id="my-update">고친 내용 저장</button><a class="btn big secondary" href="#/long">취소</a>`
        : `<button class="btn big" id="my-save">이 컴퓨터에만 저장</button><button class="btn big accent" id="my-share">모두에게 공유하기</button><a class="btn big secondary" href="#/long">취소</a>`}</div>
      <div class="tips">${editing
        ? '고친 글은 저장하는 순간 모든 사람에게 새 내용으로 보여요. 목록에서 다시 고치거나 지울 수도 있어요.'
        : `붙여 넣기는 <b>Ctrl + V</b> (맥은 <b>⌘ + V</b>)예요. <b>이 컴퓨터에만 저장</b>은 나만 보고, <b>모두에게 공유하기</b>는 이 사이트에 들어오는 모든 사람의 긴 글 연습 목록에 바로 올라가요. ${me ? '로그인한 채로 올린 글은 나중에 내 계정으로 언제든 고치거나 지울 수 있어요. 비밀번호는 다른 컴퓨터에서 로그인 없이 지우고 싶을 때만 필요해요.' : '공유한 글은 올릴 때 정한 비밀번호 4자리로 고치거나 지울 수 있어요.'}`}</div>`;
    app.appendChild(card);
    const body = $('#my-body');
    const countLines = () => { $('#my-count').textContent = body.value.split('\n').filter(l => l.trim()).length + '줄'; };
    body.addEventListener('input', countLines);
    if (editing) { $('#my-title').value = editing.title; $('#my-author').value = editing.author; body.value = editing.body != null ? editing.body : editing.lines.join('\n'); countLines(); }
    const pinEl = $('#my-pin');
    pinEl.addEventListener('input', () => { pinEl.value = pinEl.value.replace(/\D/g, '').slice(0, 4); });
    const msg = t => { $('#my-msg').textContent = t; };
    const shake = () => { body.focus(); body.classList.add('bad'); setTimeout(() => body.classList.remove('bad'), 800); };
    if (!editing) {
      $('#my-save').onclick = () => {
        if (!body.value.trim()) { shake(); return; }
        const t = myTexts.add($('#my-title').value, $('#my-author').value, body.value);
        location.hash = '#/long/' + t.id;
      };
      $('#my-share').onclick = async () => {
        if (!body.value.trim()) { shake(); return msg('내용을 넣어 주세요.'); }
        if (pinEl.value && !/^\d{4}$/.test(pinEl.value)) { pinEl.focus(); return msg('비밀번호는 숫자 4자리예요.'); }
        if (!me && !pinEl.value) { pinEl.focus(); return msg('지우기 비밀번호를 숫자 4자리로 넣어 주세요. (로그인하면 없어도 돼요)'); }
        const btn = $('#my-share'); btn.disabled = true; btn.textContent = '올리는 중…'; msg('');
        try {
          const t = await sharedTexts.add($('#my-title').value, $('#my-author').value, body.value, pinEl.value, me ? me.id : '');
          location.hash = '#/long/' + t.id;
        } catch (e) {
          btn.disabled = false; btn.textContent = '모두에게 공유하기';
          msg('지금은 올릴 수 없어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
        }
      };
    } else {
      $('#my-update').onclick = async () => {
        if (!body.value.trim()) { shake(); return msg('내용을 넣어 주세요.'); }
        if (!owner && !/^\d{4}$/.test(pinEl.value)) { pinEl.focus(); return msg('올릴 때 정한 비밀번호 4자리를 넣어 주세요.'); }
        const btn = $('#my-update'); btn.disabled = true; btn.textContent = '저장하는 중…'; msg('');
        try {
          const ok = await sharedTexts.update(editing.dbId, pinEl.value, $('#my-title').value, $('#my-author').value, body.value);
          if (ok) { location.hash = '#/long/' + editing.id; return; }
          msg(owner ? '이 글을 고칠 권한이 없어요. 다시 로그인하거나 비밀번호를 넣어 주세요.' : '비밀번호가 달라요. 다시 넣어 주세요.');
        } catch (e) {
          msg(e.message === 'not-ready' ? '지금은 서버가 준비되지 않아 고칠 수 없어요. 잠시 뒤 다시 해 주세요.' : '지금은 저장할 수 없어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
        }
        btn.disabled = false; btn.textContent = '고친 내용 저장';
      };
    }
    $('#my-title').focus();
  }

  route('long', (app, rest) => {
    if (rest[0] === 'new') return customEditor(app);
    if (rest[0] === 'edit' && /^s\d+$/.test(rest[1] || '')) {
      header(app, '공유한 글 고치기', '', '글 고르기'); $('.practice-head a', app).href = '#/long';
      app.insertAdjacentHTML('beforeend', '<div class="card center muted" id="loading">글을 불러오는 중이에요…</div>');
      let alive = true;
      sharedTexts.find(rest[1]).then(t => { if (!alive) return; if (t) { app.innerHTML = ''; customEditor(app, t); } else $('#loading').textContent = '이 글을 찾을 수 없어요. 지워졌을 수 있어요.'; })
        .catch(() => { if (alive) $('#loading').textContent = '인터넷 연결을 확인해 주세요.'; });
      return () => { alive = false; };
    }
    // 공유 글은 불러온 뒤 같은 화면을 다시 그림
    if (/^s\d+$/.test(rest[0] || '') && !(sharedTexts.cached() || { list: [] }).list.some(t => t.id === rest[0])) {
      header(app, '📖 긴 글 연습', '', '글 고르기'); $('.practice-head a', app).href = '#/long';
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
      header(app, '📖 긴 글 연습', '시와 이야기를 한 줄씩 따라 쳐요. 한 줄을 다 치면 다음 줄로 넘어가요.');
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
      sh.innerHTML = `<h2>함께 보는 글</h2><p class="lead">누군가 공유한 글이에요. 어느 컴퓨터에서 열어도 모두 같은 목록을 봐요.</p><div class="text-list" id="shared-list"><div class="muted">불러오는 중…</div></div>`;
      app.appendChild(sh);
      let alive = true;
      sharedTexts.load().then(list => {
        if (!alive) return;
        const sl = $('#shared-list', sh); sl.innerHTML = '';
        if (!list.length) { sl.innerHTML = '<div class="muted">아직 공유된 글이 없어요. 새 글 넣기에서 <b>모두에게 공유하기</b>를 눌러 보세요.</div>'; return; }
        list.forEach(t => {
          const o = item(t); const b = el('button', o.cls + ' shared'); b.innerHTML = o.html; b.onclick = () => { location.hash = o.href; };
          if (t.writer) b.querySelector('.a').textContent += (t.author ? ' · ' : '') + t.writer + '님이 올림';
          const owner = sharedTexts.isOwner(t);
          if (owner) b.classList.add('mine');
          const acts = el('span', 'acts');
          const edit = el('span', 'del edit', '✏️ 고치기'); edit.title = owner ? '내가 올린 글 고치기' : '이 글 고치기 (올릴 때 정한 비밀번호 필요)';
          edit.onclick = ev => { ev.stopPropagation(); location.hash = '#/long/edit/' + t.id; };
          const del = el('span', 'del', '🗑 지우기'); del.title = owner ? '내가 올린 글 지우기' : '이 글 지우기 (올릴 때 정한 비밀번호 필요)';
          del.onclick = async ev => {
            ev.stopPropagation();
            let pin = '';
            if (owner) { if (!confirm(`내가 올린 「${t.title}」을(를) 지울까요?`)) return; }
            else { pin = prompt(`「${t.title}」을(를) 지우려면 올릴 때 정한 비밀번호 4자리를 넣어 주세요.`); if (pin == null) return; pin = pin.trim(); }
            try { if (await sharedTexts.remove(t.dbId, pin)) { b.remove(); if (!sl.querySelector('.text-btn')) sl.innerHTML = '<div class="muted">아직 공유된 글이 없어요.</div>'; } else alert(owner ? '지울 권한이 없어요. 다시 로그인해 주세요.' : '비밀번호가 달라요.'); }
            catch (e) { alert('지금은 지울 수 없어요. 인터넷 연결을 확인해 주세요.'); }
          };
          acts.appendChild(edit); acts.appendChild(del); b.appendChild(acts); sl.appendChild(b);
        });
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
