/* 연습 모드: 자리연습 / 낱말연습 / 짧은글연습 / 긴글연습 */
(function () {
  const { $, el, shuffle, pick, esc, settings, sound, speak, route, header, statsBar, setStat, fmtTime, showResult, makeStats, paintTarget, paintHint, resetInput } = App;

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

  /* ================= 자리연습 ================= */
  route('keys', (app, rest) => {
    const stages = DATA.keyStages;
    const stage = stages.find(s => s.id === rest[0]);
    if (!stage) {
      chooser(app, '⌨️ 자리연습', '글쇠 하나씩 눌러 보며 손가락 자리를 익혀요.', stages.map((s, i) => ({
        href: '#/keys/' + s.id,
        html: `<span class="n">${i + 1}단계 · ${s.name}</span><span class="d">${s.desc}</span><span class="jm">${s.jamos.join(' ')}</span>`
      })));
      return;
    }

    const TOTAL = 20;
    const seq = Array.from({ length: TOTAL }, (_, i) => stage.jamos[i < stage.jamos.length ? i : Math.floor(Math.random() * stage.jamos.length)]);
    // 앞부분은 순서대로, 뒷부분은 무작위
    const queue = seq.slice(0, stage.jamos.length).concat(shuffle(seq.slice(stage.jamos.length)));
    let idx = 0, correct = 0, wrong = 0, start = null, timer = null;

    header(app, `⌨️ 자리연습 · ${stage.name}`, stage.desc, '단계 고르기');
    $('.practice-head a', app).href = '#/keys';
    const card = el('div', 'card');
    card.appendChild(statsBar([['진행', 'prog', `0 / ${TOTAL}`], ['맞음', 'ok', 0], ['틀림', 'bad', 0], ['시간', 'time', '0분 0초']]));
    card.innerHTML += `<div class="progress"><div id="pbar"></div></div>
      <div class="target jamo" id="target"></div>
      <div class="hint-bar" id="hint"></div>
      <div id="kb"></div>
      <p class="muted center" style="margin-top:12px">노란색으로 반짝이는 글쇠를 누르세요. 화면 자판의 파란색은 왼손, 주황색은 오른손 자리예요.</p>`;
    app.appendChild(card);
    const kb = Keyboard.render($('#kb', card));
    kb.el.classList.toggle('hidden', !settings.data.keyboard);

    function show() {
      if (idx >= TOTAL) return finish();
      const j = queue[idx];
      $('#target').textContent = j;
      paintHint($('#hint'), kb, Object.assign({ unit: j }, Hangul.keyFor(j)));
      setStat('prog', `${idx} / ${TOTAL}`);
      $('#pbar').style.width = (idx / TOTAL * 100) + '%';
    }
    function onKey(e) {
      if (e.repeat) return;
      if (['ShiftLeft', 'ShiftRight', 'CapsLock', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'Lang1', 'Lang2', 'HangulMode'].includes(e.code) || e.key === 'HangulMode' || e.key === 'Shift') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (!start) { start = Date.now(); timer = setInterval(() => setStat('time', fmtTime(Date.now() - start)), 500); }
      const j = Hangul.jamoFromEvent(e);
      const target = queue[idx];
      const info = Hangul.keyFor(target);
      if (j === target) {
        correct++; sound.ok(); kb.flash(info.code, true);
        const msg = el('span', 'msg ok', '맞았어요!'); $('#hint').appendChild(msg);
        idx++; setStat('ok', correct);
        setTimeout(show, 200);
      } else {
        wrong++; sound.bad(); setStat('bad', wrong);
        const k = Hangul.keyFor(j); if (k) kb.flash(k.code, false);
        const old = $('#hint .msg'); if (old) old.remove();
        $('#hint').appendChild(el('span', 'msg bad', j ? `'${j}'를 누르셨어요. 다시 해 봐요` : '다시 해 봐요'));
      }
    }
    function finish() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      const acc = Math.round(correct / (correct + wrong) * 100);
      const i = stages.indexOf(stage);
      const next = stages[i + 1];
      showResult(app, {
        title: `${stage.name} 연습 끝!`,
        cheer: DATA.cheer(acc),
        stats: [['정확도', acc + '%'], ['틀린 횟수', wrong + '번'], ['걸린 시간', fmtTime(start ? Date.now() - start : 0)]],
        onAgain: () => { location.reload(); },
        backHref: next ? '#/keys/' + next.id : '#/keys',
        backLabel: next ? `➡️ 다음 단계 (${next.name})` : '📋 단계 고르기'
      });
    }
    document.addEventListener('keydown', onKey);
    show();
    return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
  });

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
        <button class="btn sm secondary" id="btn-speak">🔊 읽어주기</button>
        <button class="btn sm ghost" id="btn-skip">건너뛰기 ➡️</button>
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
  route('long', (app, rest) => {
    const text = DATA.longTexts.find(t => t.id === rest[0]);
    if (!text) {
      chooser(app, '📖 긴글연습', '시와 이야기를 한 줄씩 따라 쳐요. 한 줄을 다 치면 다음 줄로 넘어가요.',
        DATA.longTexts.map(t => ({ cls: 'text-btn', href: '#/long/' + t.id, html: `<span class="t">${t.title}</span> <span class="a">${t.author}</span><span class="preview">${esc(t.lines.find(l => l))}</span>` })), 'text-list');
      return;
    }
    const lines = text.lines;
    const typeIdx = lines.map((l, i) => l ? i : -1).filter(i => i >= 0);
    const stats = makeStats();
    let pos = 0, locked = false, timer = null;

    header(app, `📖 ${text.title}`, text.author ? text.author : '', '글 고르기');
    $('.practice-head a', app).href = '#/long';
    const card = el('div', 'card');
    card.appendChild(statsBar([['진행', 'prog', `1 / ${typeIdx.length}줄`], ['타수 (타/분)', 'spm', 0], ['정확도', 'acc', '100%'], ['시간', 'time', '0분 0초']]));
    card.innerHTML += `<div class="progress"><div id="pbar"></div></div>
      <div class="long-text" id="ltext">${lines.map((l, i) => `<div class="line ${l ? '' : 'blank'}" data-i="${i}">${esc(l)}</div>`).join('')}</div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="주황색 줄을 똑같이 입력하세요">
      <div class="hint-bar" id="hint"></div>
      <div class="btn-row" style="margin:6px 0">
        <button class="btn sm secondary" id="btn-speak">🔊 이 줄 읽어주기</button>
        <button class="btn sm ghost" id="btn-skip">이 줄 건너뛰기 ➡️</button>
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
        title: `「${text.title}」 다 쳤어요!`,
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
