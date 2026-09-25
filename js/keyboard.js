/* 화면 자판 */
(function (global) {
  const ROWS = [
    [['Backquote','`','~'],['Digit1','1','!'],['Digit2','2','@'],['Digit3','3','#'],['Digit4','4','$'],['Digit5','5','%'],['Digit6','6','^'],['Digit7','7','&'],['Digit8','8','*'],['Digit9','9','('],['Digit0','0',')'],['Minus','-','_'],['Equal','=','+'],['Backspace','← 지우기','',2]],
    [['Tab','Tab','',1.5],['KeyQ','ㅂ','ㅃ'],['KeyW','ㅈ','ㅉ'],['KeyE','ㄷ','ㄸ'],['KeyR','ㄱ','ㄲ'],['KeyT','ㅅ','ㅆ'],['KeyY','ㅛ',''],['KeyU','ㅕ',''],['KeyI','ㅑ',''],['KeyO','ㅐ','ㅒ'],['KeyP','ㅔ','ㅖ'],['BracketLeft','[','{'],['BracketRight',']','}'],['Backslash','\\','|',1.5]],
    [['CapsLock','Caps','',1.8],['KeyA','ㅁ',''],['KeyS','ㄴ',''],['KeyD','ㅇ',''],['KeyF','ㄹ',''],['KeyG','ㅎ',''],['KeyH','ㅗ',''],['KeyJ','ㅓ',''],['KeyK','ㅏ',''],['KeyL','ㅣ',''],['Semicolon',';',':'],['Quote',"'",'"'],['Enter','엔터 ↵','',2.2]],
    [['ShiftLeft','Shift ⇧','',2.4],['KeyZ','ㅋ',''],['KeyX','ㅌ',''],['KeyC','ㅊ',''],['KeyV','ㅍ',''],['KeyB','ㅠ',''],['KeyN','ㅜ',''],['KeyM','ㅡ',''],['Comma',',','<'],['Period','.','>'],['Slash','/','?'],['ShiftRight','Shift ⇧','',2.4]],
    [['Space','띄어쓰기 (스페이스)','',8]]
  ];
  const LATIN = { KeyQ:'Q',KeyW:'W',KeyE:'E',KeyR:'R',KeyT:'T',KeyY:'Y',KeyU:'U',KeyI:'I',KeyO:'O',KeyP:'P',KeyA:'A',KeyS:'S',KeyD:'D',KeyF:'F',KeyG:'G',KeyH:'H',KeyJ:'J',KeyK:'K',KeyL:'L',KeyZ:'Z',KeyX:'X',KeyC:'C',KeyV:'V',KeyB:'B',KeyN:'N',KeyM:'M' };
  const HAND = {}; // code -> 'left' | 'right'
  Object.keys(Hangul.FINGER).forEach(c => { HAND[c] = Hangul.FINGER[c].startsWith('왼') ? 'left' : Hangul.FINGER[c].startsWith('오') ? 'right' : 'thumb'; });

  function render(container) {
    container.classList.add('kbd');
    container.innerHTML = '';
    ROWS.forEach(row => {
      const r = document.createElement('div');
      r.className = 'kbd-row';
      row.forEach(([code, main, shift, w]) => {
        const k = document.createElement('div');
        k.className = 'key hand-' + (HAND[code] || 'none');
        k.dataset.code = code;
        if (w) k.style.flex = w;
        if (code === 'KeyF' || code === 'KeyJ') k.classList.add('bump');
        k.innerHTML =
          (shift ? `<span class="k-shift">${shift}</span>` : '') +
          `<span class="k-main">${main}</span>` +
          (LATIN[code] ? `<span class="k-latin">${LATIN[code]}</span>` : '');
        r.appendChild(k);
      });
      container.appendChild(r);
    });
    return {
      el: container,
      highlight(code, shift) {
        container.querySelectorAll('.key.hint, .key.hint-shift').forEach(k => k.classList.remove('hint', 'hint-shift'));
        if (!code) return;
        const k = container.querySelector(`.key[data-code="${code}"]`);
        if (k) k.classList.add('hint');
        if (shift) {
          // 반대 손 시프트를 추천
          const hand = HAND[code];
          const s = container.querySelector(`.key[data-code="${hand === 'left' ? 'ShiftRight' : 'ShiftLeft'}"]`);
          if (s) s.classList.add('hint-shift');
        }
      },
      press(code) {
        const k = container.querySelector(`.key[data-code="${code}"]`);
        if (!k) return;
        k.classList.add('pressed');
        setTimeout(() => k.classList.remove('pressed'), 150);
      },
      flash(code, ok) {
        const k = container.querySelector(`.key[data-code="${code}"]`);
        if (!k) return;
        const cls = ok ? 'ok' : 'bad';
        k.classList.add(cls);
        setTimeout(() => k.classList.remove(cls), 300);
      }
    };
  }

  global.Keyboard = { render };
})(window);
