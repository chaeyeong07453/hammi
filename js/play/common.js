/* 두 게임이 함께 쓰는 도우미 */
export const COLORS = ['lilac', 'mint', 'peach'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const roomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const isCode = s => /^[A-Z0-9]{4,8}$/.test(s || '');
export function makeMe() {
  const u = window.Auth && Auth.current();
  const n = Math.floor(10 + Math.random() * 90);
  return { id: 'u' + Math.random().toString(36).slice(2, 9), name: u ? u.id : '손님' + n };
}
export const inviteLink = (game, code) => `${location.origin}${location.pathname}#/${game}/${code}`;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 간단한 안내 창. buttons: [{label, value, primary}] → Promise<value> */
export function dialog({ title, html, buttons = [{ label: '닫기', value: null, primary: true }] }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'play-dialog';
    wrap.innerHTML = `<div class="play-dialog-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="play-dialog-body">${html}</div><div class="play-dialog-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? '' : 'secondary'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    wrap.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) close(buttons[+b.dataset.i].value); else if (e.target === wrap) close(null); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    const first = wrap.querySelector('button'); if (first) first.focus();
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

export const HELP = {
  race: '<ol><li>다가오는 자동차 위의 단어를 확인해요.</li><li>입력하고 Enter를 누르세요.</li><li>먼저 입력한 한 사람이 점수를 얻어요.</li></ol><p>1명부터 3명까지 함께할 수 있어요. 2명 이상을 고르면 초대 코드가 생겨요. 친구가 같은 코드로 들어오면 같은 도로에서 만나요.</p><p>90초 동안 달려요. 오타가 나도 괜찮아요. 고치고 다시 입력하면 돼요.</p>',
  tennis: '<ol><li>상대 단어의 마지막 글자를 확인해요.</li><li>그 글자로 시작하는 낱말을 입력해요.</li><li>시간 안에 Enter를 눌러 공을 보내세요.</li></ol><p>사전에 있는 단어만 쓸 수 있고, 한 번 쓴 단어는 다시 쓸 수 없어요. 시간 안에 못 치면 생명이 하나 줄어요. 생명 3개가 다 없어지면 끝나요.</p><p>두음법칙도 괜찮아요. ‘력’으로 끝나면 ‘역’으로 시작해도 돼요.</p>'
};
