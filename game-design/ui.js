import { GameScene } from './scene.js';
import { icon, escape as esc, avatar } from './icons.js';

const CONFIG = {
 race:{eyebrow:'01 · 함께 달리는 타자 시간',title:'단어 드라이브',description:'다가오는 단어를 먼저 입력해요. 가장 빠른 한 사람이 점수를 가져가요.',scene:'파스텔 가든',icon:'car'},
 tennis:{eyebrow:'02 · 한 단어씩 주고받는 즐거움',title:'끝말 테니스',description:'끝 글자로 시작하는 단어를 이어서, 돌아오는 공을 받아쳐요.',scene:'햇살 테니스 클럽',icon:'racket'}
};
const OVERLAYS = new Set(['lobby','matching','countdown','paused','reconnecting','result']);
const INPUT_PHASES = new Set(['playing','urgent','invalid','wrong-start','duplicate','claimed']);
const time = s => `${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.max(0,s)%60).padStart(2,'0')}`;
const hearts = count => `<span class="gd-hearts" aria-label="남은 생명 ${count}개">${[0,1,2].map(i=>icon('heart',i<count?'gd-heart-full':'gd-heart-empty')).join('')}</span>`;

/** Host supplies all authoritative state. This view only emits UI intentions. */
export function mountGame(root, { game='race', state, onEvent=()=>{} } = {}) {
 if(!CONFIG[game])throw new Error('Unknown game: '+game);
 if(!state)throw new Error('mountGame requires a presentation state. See HANDOFF.md.');
 const c=CONFIG[game];let current=structuredClone(state);let disposed=false;let composing=false;
 root.classList.add('game-design');root.dataset.game=game;
 root.innerHTML=`
  <div class="gd-heading"><div><span class="gd-eyebrow">${c.eyebrow}</span><h1>${c.title}<span class="gd-title-icon">${icon(c.icon)}</span></h1><p>${c.description}</p></div>
   <div class="gd-mode" role="group" aria-label="${game==='race'?'참가 인원':'상대 선택'}"><span>${game==='race'?'함께 달릴 인원':'누구와 칠까요?'}</span><div class="gd-segment" data-ui="modes"></div></div>
  </div>
  <div class="gd-layout"><section class="gd-arena" aria-label="${c.title} 경기 화면">
   <div class="gd-matchbar" data-ui="matchbar"></div>
   <div class="gd-stage" data-ui="stage">
    <div class="gd-canvas" data-ui="canvas" role="img" aria-label="${game==='race'?'자동차가 다가오는 파스텔 3차선 도로':'곰 캐릭터가 공을 주고받는 3D 테니스 코트'}"></div>
    <div class="gd-load" data-ui="loading"><span class="gd-loader"></span>작은 경기장을 준비하고 있어요</div>
    <div class="gd-stage-top"><span class="gd-location">${icon('leaf')} ${c.scene}</span><div><button class="gd-icon-btn" data-action="help" aria-label="게임 방법 보기">${icon('info')}</button><button class="gd-icon-btn" data-action="fullscreen" aria-label="경기장 크게 보기">${icon('expand')}</button></div></div>
    <div class="gd-word-layer" data-ui="words"></div>
    <div class="gd-court-word" data-ui="courtword"></div>
    <div class="gd-scene-footer"><span>${icon(c.icon)} ${game==='race'?'모두에게 같은 단어가 보여요':'한 단어가, 다음 공이 돼요'}</span><span>HAMMI PLAY</span></div>
    <div class="gd-feedback" data-ui="feedback" role="status" aria-live="polite"></div>
    <div class="gd-overlay" data-ui="overlay" hidden></div>
   </div>
   <form class="gd-input-area" data-ui="form" autocomplete="off">
    <div class="gd-input-caption"><label for="gd-word-${game}" data-ui="inputlabel"></label><span>${game==='race'?'한글로 입력해 주세요':'사전에 있는 낱말로 이어 주세요'}</span></div>
    <div class="gd-input-row"><span class="gd-input-prefix" data-ui="prefix">${icon('keyboard')}</span><input id="gd-word-${game}" data-ui="input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="gd-input-note-${game}"><kbd class="gd-enter">Enter ↵</kbd><button type="submit" class="gd-submit">${game==='race'?'입력':'받아치기'} ${icon('arrow')}</button></div>
    <div class="gd-input-note" id="gd-input-note-${game}" data-ui="inputnote"></div>
   </form>
  </section>
  <aside class="gd-sidebar" aria-label="경기 정보"><div data-ui="side"></div><div class="gd-tip">${icon(game==='race'?'keyboard':'book')}<div><strong>${game==='race'?'빠르기보다, 정확하게.':'끝 글자를 눈여겨봐요.'}</strong><p>${game==='race'?'오타가 나도 괜찮아요.<br>고치고 다시 달려 보세요.':'소나기의 마지막 글자 ‘기’.<br>기차, 기린처럼 이어 주세요.'}</p></div></div><button class="gd-button gd-pause" data-action="pause">${icon('pause')} 잠깐 멈춤</button><button class="gd-leave" data-action="leave">경기 나가기 ${icon('arrow')}</button></aside></div>
  <div class="gd-bottom-note">${icon('heart')} 잘하는 것보다 중요한 건, 함께 즐기는 마음.</div>`;
 const $=name=>root.querySelector(`[data-ui="${name}"]`);
 const emit=(type,detail={})=>onEvent({type,game,...detail});
 const renderPlayers = () => current.players.map(p=>`<div class="gd-competitor ${p.id==='me'?'is-me':''}">${avatar(p.color,p.name)}<div><strong><span class="gd-player-name" title="${esc(p.name)}">${esc(p.name)}</span> ${p.id==='me'&&p.name!=='나'?'<span class="gd-me-tag">나</span>':''}</strong><span>${game==='race'?esc(p.subtitle):hearts(p.lives)}</span></div>${game==='race'?`<b>${esc(p.score)}<small>점</small></b>`:''}</div>`).join(game==='tennis'?'<span class="gd-vs">VS</span>':'');
 function render() {
  if(disposed)return;
  $('modes').innerHTML=(game==='race'?[[1,'1명'],[2,'2명'],[3,'3명']]:[['computer','컴퓨터'],['friend','친구와']]).map(([v,label])=>`<button type="button" data-action="mode" data-value="${v}" class="${(game==='race'?current.playerCount:current.opponent)===v?'is-selected':''}" aria-pressed="${(game==='race'?current.playerCount:current.opponent)===v}">${label}</button>`).join('');
  $('matchbar').innerHTML=`<div class="gd-competitors">${renderPlayers()}</div><div class="gd-timer ${current.phase==='urgent'?'is-urgent':''}">${icon('clock')}<div><span>${game==='race'?'남은 시간':current.turn==='me'?'받아칠 시간':'상대의 차례'}</span><strong>${game==='race'?time(current.remaining):current.seconds+'<small>초</small>'}</strong></div></div>`;
  if(game==='race') {
   $('words').innerHTML=current.targets.map(t=>`<div class="gd-word-sign ${t.claimedBy?'is-claimed':''}" data-target="${esc(t.id)}" ${t.claimedBy?'hidden':''}><span>${esc(t.points)}점</span><strong>${esc(t.word)}</strong><i></i></div>`).join('');
   $('courtword').hidden=true;
   $('side').innerHTML=`<section class="gd-side-card"><div class="gd-side-title">${icon('cup')}<h2>지금의 레이스</h2><span class="gd-live-dot" aria-hidden="true"></span></div><p class="gd-side-sub">${current.players.length===1?'나의 속도로 달려요':current.players.length+'명이 함께 달리고 있어요'}</p><div class="gd-leaderboard">${[...current.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="gd-rank ${p.id==='me'?'is-me':''}"><span class="gd-rank-number">${i+1}</span>${avatar(p.color,p.name)}<div><strong>${esc(p.name)}${p.id==='me'&&p.name!=='나'?' <small>나</small>':''}</strong><div class="gd-rank-track"><i style="width:${Math.max(4,Math.min(100,p.score/500*100))}%" class="gd-fill-${esc(p.color)}"></i></div></div><b>${esc(p.score)}<small>점</small></b></div>`).join('')}</div><div class="gd-rule">${icon('sparkle')} 먼저 입력한 한 사람이 획득!</div></section><section class="gd-side-card gd-round-info"><span class="gd-eyebrow">오늘의 작은 도전</span><strong>한 단어 더, 한 걸음 더.</strong><p>같은 길을 달려도<br>나만의 속도로 즐겨요.</p><div class="gd-route-decoration" aria-hidden="true"><span></span><span></span><span></span>${icon('car')}</div></section>`;
  } else {
   $('words').innerHTML='';$('courtword').hidden=false;
   const last=current.chain.at(-1)||'';
   $('courtword').innerHTML=`<span class="gd-turn-pill">${icon(current.turn==='me'?'racket':'clock')} ${current.turn==='me'?'내 차례예요':'상대의 차례예요'}</span><div class="gd-last-word"><span>${current.turn==='me'?'상대가 보낸 단어':'내가 보낸 단어'}</span><strong>${esc(last.slice(0,-1))}<em>${esc(last.slice(-1))}</em></strong>${icon('arrow')}<b>${esc(current.startLetter)}</b></div>`;
   $('side').innerHTML=`<section class="gd-side-card"><div class="gd-side-title">${icon('racket')}<h2>이어지는 랠리</h2><b class="gd-rally-count">${esc(current.rally)}<small>회</small></b></div><p class="gd-side-sub">한 단어씩, 여기까지 왔어요.</p><ol class="gd-chain">${current.chain.slice(-5).map((word,i,arr)=>`<li class="${i===arr.length-1?'is-latest':''}"><span class="gd-chain-dot"></span><span>${esc(word.slice(0,-1))}<b>${esc(word.slice(-1))}</b></span><small>${i===arr.length-1?'방금 전':i%2?'나':'상대'}</small></li>`).join('')}</ol><div class="gd-next-letter"><span>다음 시작 글자</span><strong>${esc(current.startLetter)}</strong>${icon('arrow')}</div></section><section class="gd-side-card gd-tennis-rules"><h3>${icon('book')} 함께 지키는 약속</h3><p>실제로 있는 낱말만 사용해요.</p><p>한 번 쓴 단어는 다시 쓰지 않아요.</p><p>놓친 공 하나에 생명 하나가 줄어요.</p></section>`;
  }
  const feedback=current.feedback;
  $('feedback').hidden=!feedback;
  if(feedback)$('feedback').innerHTML=`<div class="gd-feedback-icon">${icon(feedback.icon||'check')}</div><div><strong>${esc(feedback.title)}</strong><p>${esc(feedback.message)}</p></div>`;
  $('feedback').dataset.tone=feedback?.tone||'neutral';
  const disabled=!INPUT_PHASES.has(current.phase)||(game==='tennis'&&current.turn!=='me');
  $('input').disabled=disabled;root.querySelector('.gd-submit').disabled=disabled;
  $('input').setAttribute('aria-invalid',String(['invalid','wrong-start','duplicate'].includes(current.phase)));
  $('input').placeholder=game==='race'?'예: 햇살':`‘${current.startLetter}’로 시작하는 낱말`;
  $('inputlabel').innerHTML=game==='race'?`${icon('keyboard')} 보이는 단어를 입력하세요`:`${icon('racket')} ‘${esc(current.startLetter)}’로 시작하는 단어를 받아쳐요`;
  $('prefix').innerHTML=game==='race'?icon('keyboard'):esc(current.startLetter);
  $('inputnote').innerHTML=`<span>${icon(game==='race'?'check':'heart')} ${game==='race'?'단어를 입력하고 Enter를 눌러요.':'입력하고 Enter를 누르면 공을 보내요.'}</span><span><kbd>Esc</kbd> 잠깐 멈춤</span>`;
  const overlay=OVERLAYS.has(current.phase);$('overlay').hidden=!overlay;
  if(overlay)renderOverlay();
  root.dataset.phase=current.phase;scene.update(current);
 }
 function renderOverlay() {
  const ov=$('overlay');ov.setAttribute('role','region');ov.setAttribute('aria-label','경기 상태');
  let content='';
  if(current.phase==='lobby')content=`<div class="gd-overlay-emblem">${icon(c.icon)}</div><span class="gd-eyebrow">함께할 준비 되셨나요?</span><h2>${game==='race'?'우리, 같이 달려요.':'가볍게 한 게임 칠까요?'}</h2><p>${game==='race'?'최대 3명이 같은 도로에서 만나요.':'컴퓨터와 연습하거나 친구와 랠리를 즐겨요.'}</p><div class="gd-lobby-players">${current.players.map(p=>`<div>${avatar(p.color,p.name)}<strong>${esc(p.name)}</strong><span class="${p.ready?'is-ready':''}">${p.ready?'준비 완료':'기다리는 중'}</span></div>`).join('')}</div>${(game==='race'?current.playerCount>1:current.opponent==='friend')?`<div class="gd-room-code"><span>초대 코드</span><strong>${esc(current.roomCode)}</strong><button class="gd-button" data-action="invite">${icon('link')} 초대하기</button></div>`:''}<button class="gd-button gd-primary" data-action="ready">${icon('check')} 준비하고 시작하기</button>`;
  if(current.phase==='countdown')content=`<span class="gd-eyebrow">손끝을 가볍게 준비해요</span><div class="gd-countdown">${esc(current.countdown ?? 3)}</div><h2>곧 시작해요!</h2><p>${game==='race'?'단어를 보고, 입력하고, Enter.':'끝 글자를 보고, 낱말을 잇고, Enter.'}</p>`;
  if(current.phase==='paused')content=`<div class="gd-overlay-emblem">${icon('pause')}</div><h2>잠깐, 쉬어 가요.</h2><p>손목을 가볍게 풀고<br>준비되면 다시 이어가요.</p><button class="gd-button gd-primary" data-action="resume">${icon('play')} 이어 하기</button><button class="gd-leave" data-action="leave">경기 나가기</button>`;
  if(current.phase==='reconnecting')content=`<div class="gd-overlay-emblem">${icon('users')}</div><h2>다시 만나는 중이에요.</h2><p>연결 상태를 확인하고 있어요.<br>잠시만 기다려 주세요.</p><button class="gd-button" data-action="reconnect">다시 연결하기 ${icon('reset')}</button>`;
  if(current.phase==='matching')content=`<div class="gd-overlay-emblem">${icon('users')}</div><span class="gd-eyebrow">새로운 친구를 만날 시간</span><h2>함께할 상대를 찾고 있어요.</h2><p>${game==='race'?'같은 길을 달릴 드라이버를 기다려요.':'한 단어씩 주고받을 상대를 기다려요.'}</p><button class="gd-button" data-action="cancel-match">찾기 취소</button>`;
  if(current.phase==='result')content=`<div class="gd-overlay-emblem gd-trophy">${icon('cup')}</div><span class="gd-eyebrow">함께해서 더 즐거웠던 시간</span><h2>${esc(current.result.title)}</h2><p>${esc(current.result.subtitle)}</p><div class="gd-result-stats"><div><span>${game==='race'?'획득 점수':'최고 랠리'}</span><strong>${esc(game==='race'?current.result.score:current.result.rally)}<small>${game==='race'?'점':'회'}</small></strong></div><div><span>입력한 단어</span><strong>${esc(current.result.words)}<small>개</small></strong></div><div><span>정확도</span><strong>${esc(current.result.accuracy)}<small>%</small></strong></div></div><button class="gd-button gd-primary" data-action="again">${icon('reset')} 한 번 더 즐기기</button>`;
  if(current.phase==='lobby'&&(game==='race'?current.playerCount>1:current.opponent==='friend'))content+=`<button class="gd-leave gd-find-match" data-action="find-opponent">${icon('users')} 새로운 상대 찾기</button>`;
  ov.innerHTML=`<div class="gd-overlay-card">${content}</div>`;
 }
 function placeWords(anchors) {
  const placed=[],width=$('stage').clientWidth;
  const elements=new Map([...$('words').children].map(el=>[el.dataset.target,el]));
  // Keep the actual words in HTML, readable at every distance. Stagger nearby labels.
  [...anchors].sort((a,b)=>b.y-a.y).forEach(a=>{
   const el=elements.get(a.id);if(!el||el.hidden)return;
   const w=el.offsetWidth,h=el.offsetHeight,x=Math.max(w/2+9,Math.min(width-w/2-9,a.x));
   let bottom=a.y,collision;
   do{collision=placed.find(r=>x+w/2+8>r.left&&x-w/2-8<r.right&&bottom>r.top-9&&bottom-h<r.bottom+9);if(collision)bottom=collision.top-10;}while(collision);
   el.style.left=x+'px';el.style.top=bottom+'px';el.style.visibility=a.visible?'visible':'hidden';
   el.style.setProperty('--gd-stem',Math.max(0,a.y-bottom)+'px');
   placed.push({left:x-w/2,right:x+w/2,top:bottom-h,bottom});
  });
 }
 const scene=new GameScene($('canvas'),game,{
  onAnchors:placeWords,
  onReady:()=>{$('loading').hidden=true;root.dataset.ready='true';},
  onError:()=>{$('loading').innerHTML=`${icon('info')}<strong>3D 화면을 불러오지 못했어요.</strong><span>Chrome이나 Safari의 최신 버전에서 다시 열어 주세요.</span>`;$('loading').classList.add('has-error');root.dataset.ready='error';}
 });
 const controller=new AbortController();const options={signal:controller.signal};
 root.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return;
  const action=b.dataset.action;
  if(action==='fullscreen') {try {if(document.fullscreenElement)await document.exitFullscreen();else await root.querySelector('.gd-arena').requestFullscreen();}catch{emit('fullscreen-unavailable');}return;}
  if(action==='help') {emit('help');return;}
  if(action==='mode') {emit('mode-change',game==='race'?{playerCount:Number(b.dataset.value)}:{opponent:b.dataset.value});return;}
  emit(action);
 },options);
 $('input').addEventListener('compositionstart',()=>{composing=true;},options);
 $('input').addEventListener('compositionend',()=>{composing=false;},options);
 $('form').addEventListener('submit',event=>{event.preventDefault();if(composing||$('input').disabled||!$('input').value.trim())return;emit('submit',{word:$('input').value.trim()});},options);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.fullscreenElement){event.preventDefault();emit(current.phase==='paused'?'resume':'pause');}},options);
 render();
 return {
  setState(patch) {current={...current,...structuredClone(patch)};render();},
  getState() {return structuredClone(current);},
  clearInput() {$('input').value='';},
  focusInput() {if(!$('input').disabled)$('input').focus({preventScroll:true});},
  playEffect(kind,targetId) {scene.playEffect(kind,targetId);},
  dispose() {disposed=true;controller.abort();scene.dispose();root.innerHTML='';root.classList.remove('game-design');delete root.dataset.ready;},
  scene
 };
}
