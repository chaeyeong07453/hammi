const paths = {
 car:'<path d="m5 8 2-4h10l2 4M4 8h16v10H4zM4 13h16M7 10h1m8 0h1M6 18v2m12-2v2"/>',
 racket:'<ellipse cx="14" cy="8" rx="6" ry="7" transform="rotate(35 14 8)"/><path d="m10 14-7 8m1-3 2 2M11 4l7 5m-9-2 7 5m-4-9-3 7m6-6-3 8"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10"/>',
 pause:'<path d="M8 5v14M16 5v14"/>', play:'<path d="m8 4 12 8-12 8Z"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 cup:'<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4v3"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-17a3 3 0 0 1 0 6m1 4a6 6 0 0 1 4 6"/>',
 check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 link:'<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 0 2-2a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 2) scale(.9)"/>',
 sparkle:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 leaf:'<path d="M20 3C8 2 2 9 6 16c7 5 14-2 14-13ZM3 21 15 9"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
 book:'<path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
 volume:'<path d="M11 4 6 8H3v8h3l5 4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'
};
export const icon = (name, cls='') => `<svg class="gd-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function avatar(tone='lilac', name='곰') {
 return `<span class="gd-avatar gd-avatar-${escape(tone)}" role="img" aria-label="${escape(name)} 캐릭터"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="17" cy="18" r="8" fill="#fffdf9"/><circle cx="43" cy="18" r="8" fill="#fffdf9"/><ellipse cx="30" cy="32" rx="21" ry="19" fill="#fffdf9"/><circle cx="23" cy="29" r="2" fill="#453956"/><circle cx="37" cy="29" r="2" fill="#453956"/><ellipse cx="30" cy="37" rx="7" ry="5" fill="#f6c8ad"/><path d="m28 35 2 2 2-2" fill="none" stroke="#725370" stroke-width="1.5"/><ellipse cx="18" cy="36" rx="3" ry="2" fill="#ebbad5"/><ellipse cx="42" cy="36" rx="3" ry="2" fill="#ebbad5"/></svg></span>`;
}
