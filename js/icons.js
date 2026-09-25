/* A small, local icon set: no network or icon library required. */
(function (global) {
  const paths = {
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    leaf: '<path d="M20 3c-7 0-15 2-15 9a6 6 0 0 0 6 6c7 0 9-8 9-15ZM4 21 15 10"/>',
    book: '<path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
    lines: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    cup: '<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    bulb: '<path d="M9 18h6m-5 3h4M8 15a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    rain: '<path d="M7 14a4 4 0 1 1 0-8 6 6 0 0 1 11 0 4 4 0 0 1-1 8M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
    mole: '<path d="M5 19V11a7 7 0 0 1 14 0v8M2 20h20"/><circle cx="9" cy="11" r=".7"/><circle cx="15" cy="11" r=".7"/><path d="m10 15 2 1 2-1"/>',
    sound: '<path d="M11 4 6 8H3v8h3l5 4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'
  };
  global.icon = (name, cls = '') => `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.keyboard}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = global.icon(node.dataset.icon); });
})(window);
