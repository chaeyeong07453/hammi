/* 미니게임: 낱말비 / 글쇠 두더지 */
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
    header(app, '🌧️ 낱말비', '떨어지는 낱말을 바닥에 닿기 전에 쳐서 없애요. 다 치면 저절로 사라져요.');
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="game-hud">
        <div class="stat"><div class="label">점수</div><div class="val" id="score">0</div></div>
        <div class="lives" id="lives"></div>
        <div class="stat"><div class="label">놓친 낱말</div><div class="val" id="missed">0</div></div>
      </div>
      <div class="game-area" id="area"><div class="ground"></div></div>
      <input class="type-input" id="inp" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="낱말을 치고 엔터 (다 치면 자동)" style="margin-top:12px" disabled>`;
    app.appendChild(card);
    const area = $('#area'), input = $('#inp');
    const PARAMS = { slow: { fall: 30000, spawn: 4500, max: 5 }, normal: { fall: 19000, spawn: 3200, max: 6 }, fast: { fall: 12000, spawn: 2300, max: 7 } };
    let words = [], lives = 5, score = 0, missed = 0, raf = null, spawnTimer = null, last = 0, running = false, p, seen = new Set();

    const drawLives = () => { $('#lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(5 - lives); };
    drawLives();

    function spawn() {
      if (!running || words.length >= p.max) return;
      // 화면에 있거나 이번 판에 이미 나온 낱말은 제외. 다 쓰면 처음부터 다시
      const onScreen = new Set(words.map(w => w.text));
      let cand = DATA.gameWords.filter(w => !onScreen.has(w) && !seen.has(w));
      if (!cand.length) { seen.clear(); cand = DATA.gameWords.filter(w => !onScreen.has(w)); }
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
      const i = words.findIndex(w => w.text === v);
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
      gameOver(area, { title: '낱말비 끝!', score, recordKey: 'rain', detail: `낱말 ${score}개를 없앴어요.` });
    }
    input.addEventListener('input', () => tryMatch(false));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryMatch(true); } });
    levelPicker(area, '낱말비', '낱말이 떨어지는 빠르기를 고르세요. 5개를 놓치면 끝나요.', start);
    return () => { running = false; cancelAnimationFrame(raf); clearInterval(spawnTimer); };
  });

  /* ================= 글쇠 두더지 ================= */
  route('mole', app => {
    header(app, '🐹 글쇠 두더지', '두더지가 들고 나온 글자의 글쇠를 재빨리 누르세요. 45초 동안 몇 마리나 잡을까요?');
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="game-hud">
        <div class="stat"><div class="label">점수</div><div class="val" id="score">0</div></div>
        <div class="stat"><div class="label">남은 시간</div><div class="val" id="time">45초</div></div>
        <div class="stat"><div class="label">놓침</div><div class="val" id="missed">0</div></div>
      </div>
      <div class="mole-area" id="area">
        <div class="mole-grid">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-i="${i}"><div class="mole"></div></div>`).join('')}</div>
      </div>
      <p class="muted center" style="margin-top:12px">이 게임은 글자를 입력하는 칸이 없어요. 자판만 누르면 돼요. (한글/영어 어느 쪽이든 괜찮아요)</p>`;
    app.appendChild(card);
    const area = $('#area');
    const holes = [...card.querySelectorAll('.hole')];
    const SETS = {
      slow: { interval: 2300, stay: 2600, jamos: DATA.keyStages[0].jamos },
      normal: { interval: 1600, stay: 1900, jamos: DATA.keyStages[0].jamos.concat(DATA.keyStages[1].jamos) },
      fast: { interval: 1100, stay: 1400, jamos: DATA.keyStages[4].jamos }
    };
    const DURATION = 45;
    let running = false, score = 0, missed = 0, timeLeft = DURATION, popTimer = null, clock = null, active = new Map(); // holeIdx -> {jamo, hideTimer}

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
      const used = new Set([...active.values()].map(a => a.jamo));
      const cand = s.jamos.filter(j => !used.has(j));
      const jamo = cand[Math.floor(Math.random() * cand.length)];
      holes[i].querySelector('.mole').textContent = jamo;
      holes[i].classList.add('up');
      active.set(i, { jamo, hideTimer: setTimeout(() => hide(i, false), s.stay) });
    }
    function onKey(e) {
      if (!running || e.repeat || ['Tab', 'Escape'].includes(e.key) || e.target.closest('input, textarea, #settings') || (e.target.closest('button, a') && ['Enter', ' '].includes(e.key))) return;
      if (['ShiftLeft', 'ShiftRight', 'CapsLock', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'].includes(e.code) || e.key === 'Shift' || e.key === 'HangulMode') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      const j = Hangul.jamoFromEvent(e);
      const hit = [...active.entries()].find(([, a]) => a.jamo === j);
      if (hit) { score++; $('#score').textContent = score; sound.ok(); hide(hit[0], true); }
      else { sound.bad(); active.forEach((_, i) => { holes[i].classList.add('wrong'); setTimeout(() => holes[i].classList.remove('wrong'), 260); }); }
    }
    let level = 'normal';
    function start(l) {
      level = l; running = true; timeLeft = DURATION;
      document.addEventListener('keydown', onKey);
      pop(); popTimer = setInterval(pop, SETS[level].interval);
      clock = setInterval(() => { timeLeft--; $('#time').textContent = timeLeft + '초'; if (timeLeft <= 5 && timeLeft > 0) sound.tick(); if (timeLeft <= 0) end(); }, 1000);
    }
    function end() {
      running = false; clearInterval(popTimer); clearInterval(clock);
      document.removeEventListener('keydown', onKey);
      active.forEach((a, i) => { clearTimeout(a.hideTimer); holes[i].classList.remove('up'); }); active.clear();
      sound.win();
      gameOver(area, { title: '두더지 잡기 끝!', score, recordKey: 'mole', detail: `두더지 ${score}마리를 잡았어요. (놓침 ${missed}마리)` });
    }
    levelPicker(area, '글쇠 두더지', '느리게: 가운뎃줄 글쇠만 · 보통: 가운뎃줄+윗줄 · 빠르게: 모든 글쇠', start);
    return () => { running = false; clearInterval(popTimer); clearInterval(clock); document.removeEventListener('keydown', onKey); active.forEach(a => clearTimeout(a.hideTimer)); };
  });
})();
