/** Clearly labelled design fixtures, never authoritative game state. */
const players = [
  { id:'me', name:'나', subtitle:'보라 드라이버', color:'lilac', score:350, lives:3, ready:true },
  { id:'p2', name:'봄날', subtitle:'민트 드라이버', color:'mint', score:250, lives:3, ready:true },
  { id:'p3', name:'구름', subtitle:'살구 드라이버', color:'peach', score:200, lives:2, ready:false }
];
export function sampleState(game='race', phase='playing', options={}) {
 if(phase==='matching')options={...options,playerCount:Math.max(2,options.playerCount||3),opponent:'friend'};
 if(phase==='claimed')options={...options,playerCount:Math.max(2,options.playerCount||3)};
 const state = { phase, motion:true, previewMotion:true, playerCount:options.playerCount || 3, opponent:options.opponent || 'computer', roomCode:'HAMMI', remaining:84, duration:90, feedback:null, players:structuredClone(players), targets:[
  {id:'sun',word:'햇살',points:50,lane:0,z:-1},
  {id:'picnic',word:'소풍',points:50,lane:1,z:-12},
  {id:'spring',word:'봄바람',points:70,lane:2,z:-6}
 ], turn:'me', chain:['사과','과자','자전거','거미','미소','소나기'], startLetter:'기', rally:6, seconds:12, turnDuration:15, result:{ title:'멋진 드라이브였어요!', subtitle:'한 단어씩, 즐거운 한 바퀴를 완주했어요.', score:350, words:7, accuracy:98 } };
 state.players=state.players.slice(0,state.playerCount);
 if(['lobby','matching','countdown'].includes(phase)){state.remaining=90;state.players.forEach(p=>p.score=0);}
 if(game==='tennis') {
  state.players=[structuredClone(players[0]),{...players[1],name:state.opponent==='computer'?'곰돌 코치':'봄날',subtitle:state.opponent==='computer'?'컴퓨터 상대':'함께하는 친구',color:'peach'}];
  state.result={title:'좋은 랠리였어요!',subtitle:'마음이 통하는 한 단어, 또 함께 이어 볼까요?',rally:12,words:7,accuracy:100};
 }
 if(phase==='success') {
  state.feedback={tone:'success',title:game==='race'?'내가 먼저 찾았어요!':'멋진 받아치기!',message:game==='race'?'햇살 · +50점':'기차 → 다음은 ‘차’',icon:'sparkle'};
  if(game==='race') {state.targets[0].claimedBy='me';state.players[0].score=400;}
  else {state.chain.push('기차');state.startLetter='차';state.turn='opponent';}
 }
 if(phase==='claimed') {state.targets[0].claimedBy='p2';state.players[1].score=300;state.feedback={tone:'neutral',title:'봄날님이 한발 먼저!',message:'다음 단어를 향해 달려 볼까요?',icon:'car'};}
 if(phase==='invalid') state.feedback={tone:'error',title:'사전에서 찾지 못한 단어예요',message:'‘기’로 시작하는 다른 낱말을 입력해 주세요.',icon:'book'};
 if(phase==='wrong-start') state.feedback={tone:'error',title:'이번에는 ‘기’로 시작해요',message:'끝 글자를 확인하고 다시 받아쳐 보세요.',icon:'info'};
 if(phase==='duplicate') state.feedback={tone:'error',title:'이미 사용한 단어예요',message:'새로운 낱말로 랠리를 이어 주세요.',icon:'reset'};
 if(phase==='timeout') {state.seconds=0;state.players[0].lives=2;state.feedback={tone:'error',title:'아쉽게 공을 놓쳤어요',message:'생명 1개가 줄었어요. 다음 공을 준비해요!',icon:'heart'};}
 if(phase==='waiting') {state.turn='opponent';state.feedback={tone:'neutral',title:'상대가 생각하는 중이에요',message:'곧 돌아올 공을 기다려 주세요.',icon:'clock'};}
 if(phase==='urgent') {state.seconds=3;state.remaining=10;state.feedback={tone:'warning',title:'천천히, 끝까지 집중해요',message:game==='tennis'?'‘기’로 시작하는 단어를 받아쳐요.':'마지막 단어까지 달려 볼까요?',icon:'clock'};}
 return state;
}
export const previewPhases = {
 race:[['playing','경기 중'],['lobby','대기실'],['matching','상대 찾기'],['countdown','시작 전'],['success','단어 획득'],['claimed','상대가 먼저'],['urgent','마지막 10초'],['paused','일시정지'],['reconnecting','연결 대기'],['result','결과']],
 tennis:[['playing','내 차례'],['lobby','대기실'],['matching','상대 찾기'],['countdown','시작 전'],['success','받아치기 성공'],['waiting','상대 차례'],['invalid','없는 단어'],['wrong-start','첫 글자 오류'],['duplicate','중복 단어'],['urgent','마지막 3초'],['timeout','생명 감소'],['paused','일시정지'],['reconnecting','연결 대기'],['result','결과']]
};
