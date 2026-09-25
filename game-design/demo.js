/** Isolated mock controller. Replace this file with real game state in production. */
import { mountGame } from './ui.js';
import { sampleState, previewPhases } from './fixtures.js';
import { icon } from './icons.js';
let view, game, selectedPhase='playing';
let mode={playerCount:3,opponent:'computer'};
const root=document.querySelector('#game-root'),select=document.querySelector('#preview-state'),motion=document.querySelector('#preview-motion');
const dialog=document.querySelector('#preview-dialog');
document.querySelector('#brand-icon').innerHTML=icon('keyboard');
document.querySelector('[data-game-tab="race"]').innerHTML=icon('car')+'단어 드라이브';
document.querySelector('[data-game-tab="tennis"]').innerHTML=icon('racket')+'끝말 테니스';
function say(text){document.querySelector('#preview-event').textContent=text;}
function applyPhase(phase){selectedPhase=phase;select.value=phase;view.setState({...sampleState(game,phase,mode),motion:motion.checked});view.clearInput();if(phase==='playing')view.focusInput();}
function showDialog(title,body){document.querySelector('#dialog-body').innerHTML=`<h2>${title}</h2>${body}`;dialog.showModal();}
function route(){
 const next=location.hash==='#tennis'?'tennis':'race';
 if(next===game&&view)return;
 view?.dispose();game=next;selectedPhase='playing';
 select.innerHTML=previewPhases[game].map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
 document.querySelectorAll('[data-game-tab]').forEach(tab=>{if(tab.dataset.gameTab===game)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');});
 document.title=(game==='race'?'단어 드라이브':'끝말 테니스')+' · 함미합삐 3D 디자인';
 view=mountGame(root,{game,state:{...sampleState(game,'playing',mode),motion:motion.checked},onEvent:event=>{
  say(`디자인 이벤트 · ${event.type}${event.word?' · 입력: '+event.word:''} — 실제 게임 규칙과 서버는 연결하지 않았습니다.`);
  if(event.type==='mode-change'){mode={...mode,...event};applyPhase('lobby');}
  if(event.type==='ready'||event.type==='resume'||event.type==='again'||event.type==='reconnect')applyPhase('playing');
  if(event.type==='pause')applyPhase('paused');
  if(event.type==='find-opponent')applyPhase('matching');
  if(event.type==='cancel-match')applyPhase('lobby');
  if(event.type==='submit'){view.playEffect('success','sun');applyPhase('success');}
  if(event.type==='invite')showDialog('친구를 초대해요',`<p>대기실에서 초대 코드로 만나 함께 플레이하는 화면입니다.</p><p class="preview-dialog-note">디자인 예시 코드: <b>HAMMI</b><br>실제 초대와 매칭은 게임 개발 단계에서 연결됩니다.</p>`);
  if(event.type==='leave')showDialog('잠깐 쉬어 갈까요?',`<p>경기를 나가기 전 한 번 더 확인하는 화면입니다.</p><button class="gd-button" id="demo-lobby">대기실로 돌아가기</button>`);
  if(event.type==='help')showDialog(game==='race'?'단어 드라이브, 이렇게 즐겨요':'끝말 테니스, 이렇게 즐겨요',game==='race'?'<ol><li>다가오는 자동차 위의 단어를 확인해요.</li><li>입력하고 Enter를 누르세요.</li><li>먼저 입력한 한 사람이 점수를 얻어요.</li></ol><p>1명부터 3명까지 함께할 수 있어요.</p>':'<ol><li>상대 단어의 마지막 글자를 확인해요.</li><li>그 글자로 시작하는 낱말을 입력해요.</li><li>시간 안에 Enter를 눌러 공을 보내세요.</li></ol><p>사전에 있는 단어만 사용할 수 있어요. 공을 놓치면 생명 하나가 줄어요.</p>');
 }});
 window.hammiDesign={get view(){return view;},sampleState,applyPhase};
}
select.addEventListener('change',()=>applyPhase(select.value));
motion.addEventListener('change',()=>view.setState({motion:motion.checked}));
document.querySelector('#dialog-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target.id==='demo-lobby'){dialog.close();applyPhase('lobby');}});
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>view?.dispose(),{once:true});
route();
