/* 미니게임: 낱말비(구절·문장) / 낱말 두더지 */
(function () {
  const { $, el, shuffle, esc, settings, records, sound, route, header, resetInput } = App;

  function levelPicker(container, title, desc, onPick) {
    const ov = el('div', 'overlay');
    ov.innerHTML = `<h2>${title}</h2><p class="muted" style="margin:0">${desc}</p><div class="level-pick">
      <button class="btn big" data-l="slow">느리게</button>
      <button class="btn big" data-l="normal">보통</button>
      <button class="btn big" data-l="fast">빠르게</button></div>`;
    ov.querySelectorAll('button').forEach(b => b.onclick = () => { ov.remove(); onPick(b.dataset.l); });
    container.appendChild(ov);
  }

  function gameOver(container, opt) {
    const isNew = records.set(opt.recordKey, opt.score, (a, b) => a > b);
    records.bump();
    const best = records.get(opt.recordKey);
    const u = records.user();
    const rank = u ? Auth.rankOf(opt.recordKey, u.id) : null;
    const ov = el('div', 'overlay');
    ov.innerHTML = `<h2>${opt.title}</h2>
      ${isNew && opt.score > 0 ? '<div class="new-record">🏆 새로운 최고 기록!</div>' : ''}
      <div class="score">${opt.score}점</div>
      <p class="muted" style="margin:0">${opt.detail || ''}<br>최고 기록 ${best}점${rank ? ` · <a href="#/rank/${opt.recordKey}">랭킹 ${rank}위</a>` : ''}</p>
      <div class="btn-row"><button class="btn big" id="g-again">다시 하기</button><a class="btn big secondary" href="#/home">처음으로</a></div>`;
    container.appendChild(ov);
    $('#g-again', ov).onclick = () => location.reload();
    $('#g-again', ov).focus();
  }

  /* ================= 낱말비 ================= */
  route('rain', app => {
    header(app, '🌧️ 낱말비', '하늘에서 내려오는 구절과 문장을 바닥에 닿기 전에 쳐서 없애요. 다 치면 저절로 사라져요.');
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="game-hud">
        <div class="stat"><div class="label">점수</div><div class="val" id="score">0</div></div>
        <div class="lives" id="lives"></div>
        <div class="stat"><div class="label">놓친 글</div><div class="val" id="missed">0</div></div>
      </div>
      <div class="game-area" id="area"><div class="ground"></div></div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="띄어쓰기까지 똑같이 치세요 (다 치면 자동)" style="margin-top:12px" disabled>`;
    app.appendChild(card);
    const area = $('#area'), input = $('#inp');
    const PARAMS = {
      slow: { fall: 24000, spawn: 5000, max: 4, pool: DATA.gamePhrases.filter(t => t.length <= 7) },
      normal: { fall: 17000, spawn: 4000, max: 5, pool: DATA.gamePhrases.filter(t => t.length <= 12) },
      fast: { fall: 12000, spawn: 3200, max: 5, pool: DATA.gamePhrases }
    };
    let words = [], lives = 5, score = 0, missed = 0, raf = null, spawnTimer = null, last = 0, running = false, p, seen = new Set();

    const drawLives = () => { $('#lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(5 - lives); };
    drawLives();

    function spawn() {
      if (!running || words.length >= p.max) return;
      // 화면에 있거나 이번 판에 이미 나온 낱말은 제외. 다 쓰면 처음부터 다시
      const onScreen = new Set(words.map(w => w.text));
      let cand = p.pool.filter(w => !onScreen.has(w) && !seen.has(w));
      if (!cand.length) { seen.clear(); cand = p.pool.filter(w => !onScreen.has(w)); }
      const text = cand[Math.floor(Math.random() * cand.length)];
      seen.add(text);
      const e = el('div', 'rain-word', esc(text));
      area.appendChild(e);
      const x = Math.random() * Math.max(0, area.clientWidth - e.offsetWidth - 20) + 10;
      e.style.left = x + 'px';
      words.push({ el: e, text, y: -e.offsetHeight, speed: area.clientHeight / p.fall * (0.85 + Math.random() * 0.3) });
    }
    function loop(ts) {
      if (!running) return;
      const dt = last ? ts - last : 0; last = ts;
      const limit = area.clientHeight - 14;
      words = words.filter(w => {
        w.y += w.speed * dt;
        w.el.style.transform = `translateY(${w.y}px)`;
        if (w.y > limit * 0.68) w.el.classList.add('danger');
        if (w.y + w.el.offsetHeight >= limit) {
          w.el.remove(); missed++; lives--; drawLives(); $('#missed').textContent = missed; sound.bad();
          if (lives <= 0) end();
          return false;
        }
        return true;
      });
      raf = requestAnimationFrame(loop);
    }
    function tryMatch(force) {
      const v = input.value.trim();
      if (!v) return;
      const norm = t => t.replace(/\s+/g, ' ').trim();
      const i = words.findIndex(w => norm(w.text) === norm(v));
      if (i >= 0) {
        const w = words[i]; words.splice(i, 1);
        w.el.classList.add('pop'); setTimeout(() => w.el.remove(), 220);
        score++; $('#score').textContent = score; sound.ok();
        resetInput(input);
      } else if (force) { sound.tick(); resetInput(input); }
    }
    function start(level) {
      p = PARAMS[level]; running = true; input.disabled = false; input.focus();
      spawn(); spawnTimer = setInterval(spawn, p.spawn); raf = requestAnimationFrame(loop);
    }
    function end() {
      running = false; cancelAnimationFrame(raf); clearInterval(spawnTimer);
      input.disabled = true; sound.lose();
      gameOver(area, { title: '낱말비 끝!', score, recordKey: 'rain', detail: `글 ${score}개를 없앴어요.` });
    }
    input.addEventListener('input', () => tryMatch(false));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryMatch(true); } });
    levelPicker(area, '낱말비', '느리게: 짧은 구절 · 보통: 조금 긴 구절 · 빠르게: 속담과 문장. 5개를 놓치면 끝나요.', start);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(spawnTimer); };
  });

  /* ================= 낱말 두더지 ================= */
  route('mole', app => {
    header(app, '🐹 낱말 두더지', '두더지가 들고 나온 낱말을 재빨리 쳐서 잡아요. 45초 동안 몇 마리나 잡을까요?');
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="game-hud">
        <div class="stat"><div class="label">점수</div><div class="val" id="score">0</div></div>
        <div class="stat"><div class="label">남은 시간</div><div class="val" id="time">45초</div></div>
        <div class="stat"><div class="label">놓침</div><div class="val" id="missed">0</div></div>
      </div>
      <div class="mole-area" id="area">
        <div class="mole-grid">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-i="${i}"><div class="mole word"></div></div>`).join('')}</div>
      </div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="두더지가 든 낱말을 치세요 (다 치면 자동)" style="margin-top:12px" disabled>`;
    app.appendChild(card);
    const area = $('#area'), input = $('#inp');
    const holes = [...card.querySelectorAll('.hole')];
    const SETS = {
      slow: { interval: 2600, stay: 6500, pool: DATA.gameWords.filter(w => w.length <= 2) },
      normal: { interval: 2000, stay: 5000, pool: DATA.gameWords.filter(w => w.length <= 3) },
      fast: { interval: 1500, stay: 3800, pool: DATA.gameWords }
    };
    const DURATION = 45;
    let running = false, score = 0, missed = 0, timeLeft = DURATION, popTimer = null, clock = null, level = 'normal', active = new Map(); // holeIdx -> {word, hideTimer}

    function hide(i, hit) {
      const a = active.get(i); if (!a) return;
      clearTimeout(a.hideTimer); active.delete(i);
      const h = holes[i];
      if (hit) { h.classList.add('hit'); setTimeout(() => h.classList.remove('hit', 'up'), 250); }
      else { h.classList.remove('up'); missed++; $('#missed').textContent = missed; }
    }
    function pop() {
      if (!running) return;
      const s = SETS[level];
      const free = holes.map((_, i) => i).filter(i => !active.has(i));
      if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)];
      const used = new Set([...active.values()].map(a => a.word));
      const cand = s.pool.filter(w => !used.has(w));
      const word = cand[Math.floor(Math.random() * cand.length)];
      holes[i].querySelector('.mole').textContent = word;
      holes[i].classList.add('up');
      active.set(i, { word, hideTimer: setTimeout(() => hide(i, false), s.stay) });
    }
    function tryMatch(force) {
      const v = input.value.trim();
      if (!v) return;
      const hit = [...active.entries()].find(([, a]) => a.word === v);
      if (hit) { score++; $('#score').textContent = score; sound.ok(); hide(hit[0], true); resetInput(input); }
      else if (force) { sound.bad(); active.forEach((_, i) => { holes[i].classList.add('wrong'); setTimeout(() => holes[i].classList.remove('wrong'), 260); }); resetInput(input); }
    }
    function start(l) {
      level = l; running = true; timeLeft = DURATION; input.disabled = false; input.focus();
      pop(); popTimer = setInterval(pop, SETS[level].interval);
      clock = setInterval(() => { timeLeft--; $('#time').textContent = timeLeft + '초'; if (timeLeft <= 5 && timeLeft > 0) sound.tick(); if (timeLeft <= 0) end(); }, 1000);
    }
    function end() {
      running = false; clearInterval(popTimer); clearInterval(clock); input.disabled = true;
      active.forEach((a, i) => { clearTimeout(a.hideTimer); holes[i].classList.remove('up'); }); active.clear();
      sound.win();
      gameOver(area, { title: '두더지 잡기 끝!', score, recordKey: 'mole', detail: `두더지 ${score}마리를 잡았어요. (놓침 ${missed}마리)` });
    }
    input.addEventListener('input', () => tryMatch(false));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryMatch(true); } });
    levelPicker(area, '낱말 두더지', '느리게: 한두 글자 낱말 · 보통: 세 글자까지 · 빠르게: 모든 낱말', start);
    return () => { running = false; clearInterval(popTimer); clearInterval(clock); active.forEach(a => clearTimeout(a.hideTimer)); };
  });
})();
