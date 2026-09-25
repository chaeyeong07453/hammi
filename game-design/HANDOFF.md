# 함미합삐 3D 게임 디자인 · 개발 연결 안내

**이 폴더는 독립적인 디자인 패키지입니다.** 기존 `js/games.js`, 라우터, 서버 코드는 수정하지 않았습니다. `index.html`을 HTTP 서버로 열면 두 게임과 화면 상태를 확인할 수 있습니다.

```sh
# hammi 프로젝트 루트에서
python3 -m http.server 8000 --bind 127.0.0.1
```

- 자동차: <http://localhost:8000/game-design/#race>
- 테니스: <http://localhost:8000/game-design/#tennis>
- 아래쪽 **화면 상태**에서 대기실, 상대 찾기, 성공, 실패, 결과 등을 선택합니다.
- 입력 후 Enter는 정해진 성공 디자인을 보여 줍니다. 입력값을 채점하거나 사전에서 검사하지 않습니다. 점수·시간·초대 코드는 예시입니다.

## 파일 선택

| 파일 | 용도 |
| --- | --- |
| `ui.js` + `styles.css` + `icons.js` | 실제 게임에 연결할 HUD, 입력창, 대기실, 피드백, 결과 UI |
| `scene.js` | GLB 로드, 카메라, 조명, 자동차·공 표시, 장식 애니메이션 |
| `models/*.glb` | Blender에서 만든 웹용 모델 5개, 합계 약 2.7 MB |
| `blender/hammi-play.blend` | 편집 가능한 원본과 자동차·테니스 미리보기 씬 |
| `blender/build_assets.py` | 원본과 GLB를 재생성하는 Blender 스크립트 |
| `vendor/` | Three.js 0.180.0, GLTFLoader, 의존 유틸리티와 MIT 라이선스 |
| `fixtures.js` + `demo.js` | **디자인 확인용 예시 상태와 컨트롤러** |
| `index.html` + `preview.css` | 독립 미리보기 페이지의 탭·상태 선택 UI |
| `previews/` | 실제 브라우저에서 촬영한 화면 |

제품 화면에는 `ui.js`, `styles.css`, `icons.js`, `scene.js`, `models/`, `vendor/`를 사용하세요. 미리보기 탭과 상태 선택기는 `preview.css`에 분리되어 있습니다. 게임 로직은 `demo.js` 대신 연결합니다.

## 화면 구성

**단어 드라이브** — 전방에서 자동차가 다가오는 3차선 도로, 거리와 관계없이 같은 크기의 HTML 단어 표지판, 1·2·3인 선택, 점수·순위, 초대 대기실과 상대 찾기. `claimedBy`가 있는 자동차와 단어는 숨깁니다. 내가 획득한 경우와 상대가 먼저 획득한 경우의 피드백을 따로 제공합니다.

**끝말 테니스** — 민트 코트, 살구색 테두리, 라켓을 든 곰 두 마리, 오가는 공. 컴퓨터·친구 상대 선택, 마지막 글자 강조, 입력할 첫 글자, 남은 시간·하트·단어 기록을 표시합니다. 없는 단어·첫 글자 오류·중복 단어·시간 초과·상대 차례 디자인을 제공합니다.

두 화면 모두 데스크톱에서는 오른쪽에 경기 정보를, 모바일에서는 경기장 아래에 표시합니다. 단어와 입력창은 HTML이므로 3D 모델의 원근 때문에 글자가 작아지지 않습니다. 모바일 단어 표지판은 겹치면 위아래로 배치됩니다. UI 본문은 짙은 보라색, 배경과 강조 면은 사용자가 지정한 6색입니다.

| Orchid | Lilac | Sky | Mint | Butter | Peach |
| --- | --- | --- | --- | --- | --- |
| `#e1b7fa` | `#b9a7f9` | `#b1d4fa` | `#b9ebea` | `#f0edc2` | `#f6c8ad` |

## 연결 방법

Three.js import map은 **모듈을 불러오기 전에 한 번만** 선언합니다. 아래 상대 경로는 프로젝트 루트의 HTML 기준이며 GitHub Pages의 `/hammi/` 하위 경로에서도 동작합니다. 번들러를 사용한다면 같은 버전의 `three` 패키지를 쓰고 import map을 생략할 수 있습니다.

```html
<link rel="stylesheet" href="./game-design/styles.css">
<script type="importmap">
{
  "imports": {
    "three": "./game-design/vendor/three.module.js",
    "three/addons/": "./game-design/vendor/"
  }
}
</script>
```

```js
import { mountGame } from './game-design/ui.js';

const view = mountGame(document.querySelector('#your-game-container'), {
  game: 'race', // 'race' | 'tennis'
  state: initialPresentationState, // 아래 필드 표 참고
  onEvent(event) {
    // 이 콜백에서 기존 게임 컨트롤러에 입력 의도를 전달합니다.
    // event.type === 'submit' → event.word
  }
});

// 서버/게임 엔진이 확정한 상태를 반영합니다.
view.setState({ players: updatedPlayers, targets: updatedTargets });
view.playEffect('success', claimedTargetId);
view.clearInput();
view.focusInput();

// 라우트를 떠나거나 다른 게임으로 교체할 때 필수입니다.
view.dispose();
```

`setState`는 최상위 필드만 병합하고 전달값을 복제합니다. 배열·`feedback`·`result`는 전체 객체로 교체하세요. `getState()`는 현재 표시 상태의 복사본을 반환합니다. 상태 변경 중 입력 DOM은 유지되므로 한글 조합이나 포커스가 매번 초기화되지 않습니다. 조합 중 Enter는 제출 이벤트를 보내지 않습니다.

### 공통 표시 상태

| 필드 | 값과 의미 |
| --- | --- |
| `phase` | 아래 화면 상태 중 하나 |
| `players` | 플레이어 배열. 로컬 사용자의 표시 ID는 `'me'`로 매핑 |
| `players[].id / name / color` | ID, 이름, `'lilac' \| 'mint' \| 'peach'` |
| `players[].score / subtitle` | 자동차 점수·보조 설명 |
| `players[].lives` | 테니스 생명, 0~3 |
| `players[].ready` | 대기실 준비 여부 |
| `roomCode` | 대기실에 표시할 문자열 |
| `feedback` | `null` 또는 `{ tone, title, message, icon }` |
| `feedback.tone` | `'success' \| 'error' \| 'warning' \| 'neutral'` |
| `feedback.icon` | 선택 사항: `check`, `sparkle`, `book`, `info`, `heart`, `clock`, `car`, `reset` 등 `icons.js` 키 |
| `motion` | 장식 움직임 허용, 기본 허용. OS 동작 줄이기 설정이 우선 |
| `previewMotion` | 예시 자동차 이동·공 왕복 루프. **실제 게임 연결 시 `false`** |
| `countdown` | `countdown` 화면의 숫자, 기본값 3. UI가 스스로 줄이지 않음 |
| `result` | 결과 화면 표시값. `{ title, subtitle, words, accuracy, score }` 또는 테니스의 `{ title, subtitle, words, accuracy, rally }` |

### 자동차 추가 필드

| 필드 | 값과 의미 |
| --- | --- |
| `playerCount` | `1 \| 2 \| 3` |
| `remaining` | 표시할 남은 시간, 정수 초. 타이머 진행은 게임 컨트롤러 담당 |
| `targets` | `{ id, word, points, lane, z, claimedBy? }` 배열 |
| `lane` | `0 / 1 / 2` → 왼쪽 / 가운데 / 오른쪽 |
| `z` | Three.js 월드 좌표. 기본 예시 `-1 / -12 / -6`; +Z로 이동하면 카메라에 접근 |
| `claimedBy` | 획득한 플레이어의 ID. 값이 있으면 해당 모델·단어를 숨김 |

동시에 3개 정도의 단어를 표시하는 구도입니다. 아주 긴 단어는 표지판에서 줄바꿈됩니다. 이름은 공간에 맞게 생략하고 `title`에 전체 문자열을 유지합니다. 순위는 받은 점수로 정렬합니다. 순위 옆 막대는 예시 최대 500점에 대한 장식 비율이므로 실제 경기의 목표 점수에 맞게 `ui.js`에서 변경하세요.

### 테니스 추가 필드

| 필드 | 값과 의미 |
| --- | --- |
| `opponent` | `'computer' \| 'friend'` |
| `turn` | `'me' \| 'opponent'`; 상대 차례에는 입력을 잠금 |
| `chain` | 검증을 마친 단어 문자열 배열, 마지막 5개를 표시 |
| `startLetter` | 다음 단어의 첫 글자. 두음법칙 등 처리 결과를 외부에서 전달 |
| `rally` | 표시할 랠리 수 |
| `seconds` | 현재 차례의 남은 정수 초 |
| `ballPosition` | 선택 사항 `[x, y, z]`, 실제 게임 엔진이 계산한 공 위치 |

단어 기록의 ‘나/상대’ 표시는 현재 예시용 교대 패턴입니다. 시작 플레이어·득실점 뒤 재시작 규칙이 정해지면 기록을 `{ word, playerId }` 형태로 확장하고 `ui.js`의 기록 렌더링에 연결하세요. 캐릭터는 스키닝/본 없이 만든 모델입니다. 타격 모션이 필요하면 Blender 원본의 팔·라켓 부품을 리깅하거나 별도 오브젝트로 내보내면 됩니다.

### 화면 상태

- 공통: `lobby`, `matching`, `countdown`, `playing`, `success`, `urgent`, `paused`, `reconnecting`, `result`
- 자동차: `claimed` — 상대가 먼저 획득
- 테니스: `waiting`, `invalid`, `wrong-start`, `duplicate`, `timeout`

상태 이름은 화면 표현용이며 상태 전이나 타이머를 실행하지 않습니다. `success`·`timeout` 화면에서 다음 입력을 열려면 컨트롤러가 `playing` 상태를 전달해야 합니다. `feedback: null`로 안내를 지울 수 있습니다.

### UI가 발생시키는 이벤트

모든 이벤트에 `game`이 포함됩니다.

| `type` | 추가 필드 / 연결할 동작 |
| --- | --- |
| `submit` | `word`: 공백 제거한 입력값. 검증·서버 제출 |
| `mode-change` | `playerCount` 또는 `opponent` |
| `ready` | 준비 / 시작 요청 |
| `find-opponent` / `cancel-match` | 실제 상대 찾기 / 취소 |
| `invite` | 실제 방 코드·초대 링크 처리 |
| `pause` / `resume` | 일시정지 의도. 온라인 경기의 정지 정책은 게임 컨트롤러가 결정 |
| `reconnect` | 재접속 요청 |
| `again` / `leave` | 다시 하기 / 나가기 |
| `help` | 게임 방법 열기 |
| `fullscreen-unavailable` | 전체 화면을 지원하지 않거나 요청이 거절됨 |

전체 화면 버튼은 브라우저 API를 직접 호출합니다. `Esc`는 전체 화면을 먼저 닫고, 일반 화면에서 경기장에 포커스가 있으면 `pause`/`resume` 의도를 보냅니다. 도움말·나가기·초대 모달의 예시 표현은 `demo.js`에 있습니다.

**게임 개발에서 연결할 부분:** 단어 생성과 수명, 서버에서 단어 선점 확정·전체 참가자에게 반영, 점수·종료 조건, 실제 매칭·초대·접속 복구, 사전 검증·중복과 두음법칙, 턴·시간·생명 계산, 컴퓨터 상대의 단어 선택. 이 디자인 패키지는 해당 규칙을 실행하지 않습니다.

## 3D 자산과 좌표

- 원본: Blender **5.2.2 LTS**에서 생성했습니다. `00 Asset Library`는 이름 있는 개별 부품, `01 Race Preview`와 `02 Tennis Preview`는 배치·조명이 있는 확인용 씬입니다.
- 컬렉션: `RaceWorld`, `Car`, `TennisWorld`, `TennisPlayer`, `TennisBall`.
- 내보낼 때만 같은 재질의 부품을 합쳐 그리기 호출을 줄입니다. `.blend` 안에는 개별 부품이 남습니다.
- GLB: Y가 위, +Z가 자동차 진행 방향. 원점은 자동차·곰의 바닥 중심, 공의 중심입니다.
- `CarPaint` 재질은 자동차 차체와 곰의 옷에 쓰며 인스턴스별로 복제·재색상 처리합니다.
- Three.js 모델 주소는 `import.meta.url` 기준 상대 경로입니다. `scene.js`와 `models/`의 상대 위치를 유지하세요.
- 모바일 픽셀 비율 상한 1.7, 뷰포트 밖/숨겨진 탭에서는 연속 렌더링 중단, OS 동작 줄이기 대응, WebGL 실패 안내를 포함합니다.
- GLB는 압축 디코더나 외부 텍스처가 필요 없습니다. 한글은 웹 폰트 또는 시스템 폰트로 표시합니다.

```sh
# 프로젝트 루트. 원본과 GLB를 덮어쓰므로 수동으로 편집한 원본은 먼저 별도 저장하세요.
"/Applications/Blender.app/Contents/MacOS/Blender" --background \
  --python game-design/blender/build_assets.py
```

직접 편집한 원본을 내보낼 때는 Asset Library에서 해당 컬렉션만 선택하고 glTF Binary(.glb), Selected Objects, +Y Up을 사용하세요. 프리뷰의 인스턴스·조명·카메라는 포함하지 않습니다.

기하 모델과 UI 아이콘은 이 프로젝트를 위해 직접 만들었습니다. Three.js의 라이선스는 `vendor/LICENSE`를 유지합니다. API 참고: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
