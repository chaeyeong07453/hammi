/* 3D 게임(단어 드라이브, 끝말 테니스) 라우트. 무거운 3D 모듈은 게임에 들어갈 때만 불러온다 */
(function () {
  const { $, el, route } = App;
  function mount(app, game, code) {
    const bar = el('div', 'play-bar');
    bar.innerHTML = `<a class="btn ghost" href="#/games">← 게임 목록</a><span class="muted">${game === 'race' ? '단어 드라이브' : '끝말 테니스'}${code ? ' · 초대 코드 ' + code : ''}</span>`;
    app.appendChild(bar);
    const root = el('div', 'play-root');
    app.appendChild(root);
    const loading = el('div', 'card center muted play-loading', '3D 경기장을 불러오는 중이에요… 처음 한 번은 조금 걸려요.');
    root.appendChild(loading);
    let dispose = null, alive = true;
    import(`./play/${game}.js`).then(m => {
      if (!alive) return;
      loading.remove();
      dispose = m.start(root, { code: code && /^[A-Z0-9]{4,8}$/i.test(code) ? code.toUpperCase() : null, onLeave: () => { location.hash = '#/games'; } });
    }).catch(e => {
      console.error(e);
      if (alive) loading.innerHTML = '게임을 불러오지 못했어요. 인터넷 연결을 확인하고 <a href="javascript:location.reload()">새로고침</a>해 주세요.';
    });
    return () => { alive = false; if (dispose) dispose(); };
  }
  route('race', (app, rest) => mount(app, 'race', rest[0]));
  route('tennis', (app, rest) => mount(app, 'tennis', rest[0]));
})();
