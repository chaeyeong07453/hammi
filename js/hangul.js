/* 한글 자모 분해 및 2벌식 자판 매핑 */
(function (global) {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  // 두 번 눌러서 만드는 겹자모 (한 번에 한 키씩)
  const COMPOUND = {
    'ㅘ':['ㅗ','ㅏ'], 'ㅙ':['ㅗ','ㅐ'], 'ㅚ':['ㅗ','ㅣ'],
    'ㅝ':['ㅜ','ㅓ'], 'ㅞ':['ㅜ','ㅔ'], 'ㅟ':['ㅜ','ㅣ'], 'ㅢ':['ㅡ','ㅣ'],
    'ㄳ':['ㄱ','ㅅ'], 'ㄵ':['ㄴ','ㅈ'], 'ㄶ':['ㄴ','ㅎ'], 'ㄺ':['ㄹ','ㄱ'],
    'ㄻ':['ㄹ','ㅁ'], 'ㄼ':['ㄹ','ㅂ'], 'ㄽ':['ㄹ','ㅅ'], 'ㄾ':['ㄹ','ㅌ'],
    'ㄿ':['ㄹ','ㅍ'], 'ㅀ':['ㄹ','ㅎ'], 'ㅄ':['ㅂ','ㅅ']
  };

  // 자모 -> 물리 키 (KeyboardEvent.code)
  const JAMO_KEY = {
    'ㅂ':['KeyQ',false], 'ㅈ':['KeyW',false], 'ㄷ':['KeyE',false], 'ㄱ':['KeyR',false], 'ㅅ':['KeyT',false],
    'ㅛ':['KeyY',false], 'ㅕ':['KeyU',false], 'ㅑ':['KeyI',false], 'ㅐ':['KeyO',false], 'ㅔ':['KeyP',false],
    'ㅁ':['KeyA',false], 'ㄴ':['KeyS',false], 'ㅇ':['KeyD',false], 'ㄹ':['KeyF',false], 'ㅎ':['KeyG',false],
    'ㅗ':['KeyH',false], 'ㅓ':['KeyJ',false], 'ㅏ':['KeyK',false], 'ㅣ':['KeyL',false],
    'ㅋ':['KeyZ',false], 'ㅌ':['KeyX',false], 'ㅊ':['KeyC',false], 'ㅍ':['KeyV',false],
    'ㅠ':['KeyB',false], 'ㅜ':['KeyN',false], 'ㅡ':['KeyM',false],
    'ㅃ':['KeyQ',true], 'ㅉ':['KeyW',true], 'ㄸ':['KeyE',true], 'ㄲ':['KeyR',true], 'ㅆ':['KeyT',true],
    'ㅒ':['KeyO',true], 'ㅖ':['KeyP',true]
  };

  const CHAR_KEY = {
    ' ':['Space',false], '.':['Period',false], ',':['Comma',false], '?':['Slash',true], '!':['Digit1',true],
    '/':['Slash',false], ';':['Semicolon',false], "'":['Quote',false], '-':['Minus',false], '=':['Equal',false],
    ':':['Semicolon',true], '"':['Quote',true], '(':['Digit9',true], ')':['Digit0',true], '~':['Backquote',true],
    '%':['Digit5',true], '\n':['Enter',false]
  };
  for (let i = 0; i <= 9; i++) CHAR_KEY[String(i)] = ['Digit' + i, false];
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(97 + i);
    CHAR_KEY[ch] = ['Key' + ch.toUpperCase(), false];
    CHAR_KEY[ch.toUpperCase()] = ['Key' + ch.toUpperCase(), true];
  }

  // 키 -> 자모
  const KEY_JAMO = {};
  Object.keys(JAMO_KEY).forEach(j => {
    const [code, shift] = JAMO_KEY[j];
    KEY_JAMO[(shift ? 'S:' : '') + code] = j;
  });

  const FINGER = {
    KeyQ:'왼손 새끼', KeyA:'왼손 새끼', KeyZ:'왼손 새끼', Digit1:'왼손 새끼', Backquote:'왼손 새끼',
    KeyW:'왼손 약지', KeyS:'왼손 약지', KeyX:'왼손 약지', Digit2:'왼손 약지',
    KeyE:'왼손 중지', KeyD:'왼손 중지', KeyC:'왼손 중지', Digit3:'왼손 중지',
    KeyR:'왼손 검지', KeyF:'왼손 검지', KeyV:'왼손 검지', KeyT:'왼손 검지', KeyG:'왼손 검지', KeyB:'왼손 검지', Digit4:'왼손 검지', Digit5:'왼손 검지',
    KeyY:'오른손 검지', KeyH:'오른손 검지', KeyN:'오른손 검지', KeyU:'오른손 검지', KeyJ:'오른손 검지', KeyM:'오른손 검지', Digit6:'오른손 검지', Digit7:'오른손 검지',
    KeyI:'오른손 중지', KeyK:'오른손 중지', Comma:'오른손 중지', Digit8:'오른손 중지',
    KeyO:'오른손 약지', KeyL:'오른손 약지', Period:'오른손 약지', Digit9:'오른손 약지',
    KeyP:'오른손 새끼', Semicolon:'오른손 새끼', Slash:'오른손 새끼', Quote:'오른손 새끼', Digit0:'오른손 새끼',
    Minus:'오른손 새끼', Equal:'오른손 새끼', BracketLeft:'오른손 새끼', BracketRight:'오른손 새끼', Enter:'오른손 새끼', Backspace:'오른손 새끼',
    Space:'엄지', ShiftLeft:'왼손 새끼', ShiftRight:'오른손 새끼'
  };

  function isSyllable(ch) { const c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3; }
  function isJamo(ch) { const c = ch.charCodeAt(0); return c >= 0x3131 && c <= 0x3163; }

  // 한 글자를 자모 배열로 (겹자모는 개별 키로 분리)
  function splitChar(ch) {
    if (isSyllable(ch)) {
      const code = ch.charCodeAt(0) - 0xAC00;
      const cho = CHO[Math.floor(code / 588)];
      const jung = JUNG[Math.floor((code % 588) / 28)];
      const jong = JONG[code % 28];
      const out = [cho];
      out.push(...(COMPOUND[jung] || [jung]));
      if (jong) out.push(...(COMPOUND[jong] || [jong]));
      return out;
    }
    if (isJamo(ch)) return COMPOUND[ch] ? COMPOUND[ch].slice() : [ch];
    return [ch];
  }

  // 문자열 -> 키 입력 단위 배열
  function toKeys(str) {
    const out = [];
    for (const ch of str) out.push(...splitChar(ch));
    return out;
  }

  function strokes(str) { return toKeys(str).length; }

  // 키 입력 단위 -> {code, shift, finger, label}
  function keyFor(unit) {
    const k = JAMO_KEY[unit] || CHAR_KEY[unit];
    if (!k) return null;
    return { code: k[0], shift: k[1], finger: FINGER[k[0]] || '', label: unit === ' ' ? '띄어쓰기' : unit };
  }

  // 목표 문자열과 현재 입력을 비교해 다음에 눌러야 할 키 정보를 준다
  function nextKey(target, typed) {
    const t = toKeys(target), u = toKeys(typed);
    let i = 0;
    while (i < u.length && i < t.length && u[i] === t[i]) i++;
    if (i < u.length) return { wrong: true, code: 'Backspace', shift: false, finger: '오른손 새끼', label: '지우기(←)' };
    if (i >= t.length) return { done: true, code: 'Enter', shift: false, finger: '오른손 새끼', label: '엔터(↵)' };
    return Object.assign({ unit: t[i] }, keyFor(t[i]) || { code: '', shift: false, finger: '', label: t[i] });
  }

  // 키보드 이벤트 -> 자모
  function jamoFromEvent(e) {
    if (e.code && KEY_JAMO[(e.shiftKey ? 'S:' : '') + e.code]) return KEY_JAMO[(e.shiftKey ? 'S:' : '') + e.code];
    if (e.key && isJamo(e.key)) return e.key;
    if (e.key && /^[a-zA-Z]$/.test(e.key)) {
      const code = 'Key' + e.key.toUpperCase();
      return KEY_JAMO[(e.key === e.key.toUpperCase() ? 'S:' : '') + code] || KEY_JAMO[code] || null;
    }
    return null;
  }

  global.Hangul = { CHO, JUNG, JONG, COMPOUND, JAMO_KEY, KEY_JAMO, FINGER, splitChar, toKeys, strokes, keyFor, nextKey, jamoFromEvent, isSyllable, isJamo };
})(window);
