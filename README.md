# GORBO: 심장지킴이 🫀

반려견·반려묘 **심장병(이첨판 폐쇄부전 등) 홈케어 PWA**입니다.

**앱 바로 열기: https://plum98266-sketch.github.io/GORBO/** (휴대폰에서 열고 '홈 화면에 추가'하면 앱처럼 쓸 수 있습니다)
한국 마이크로 니치 분석 결과는 [docs/market-analysis.md](docs/market-analysis.md)에 있습니다.

## 기능 (MVP v0.1)
- **수면 호흡수(SRR) 측정**: 숨 쉴 때마다 탭하면 30초/60초 기준으로 분당 호흡수를 계산합니다. 진동 피드백을 줍니다.
- **경고 판단**: 기준(기본 30회, 아이별로 변경 가능) 초과 1회는 주의, 2회 연속이면 병원 연락을 안내합니다. 기준 이하라도 최근 평균이 평소보다 20% 이상 오르면 알려줍니다.
- **투약 체크**: 약 이름·용량·하루 최대 4회 시간을 등록하고, 오늘 체크리스트에서 복용 여부를 표시합니다.
- **증상 기록**: 기침, 식욕 저하, 무기력 등을 원탭으로 기록하고 메모를 남깁니다.
- **진료 리포트**: 14/30/90일 요약(평균·최저·최고 호흡수, 기준 초과 횟수, 투약 순응도, 증상, 그래프)을 보여주고 인쇄하거나 PDF로 저장합니다.
- 여러 마리 등록, JSON 백업/복원, 오프라인 동작(서비스 워커), 다크 모드.
- 홈 화면 설치 안내: 아이폰 Safari, 안드로이드 Chrome, 카카오톡·네이버 앱 안 브라우저를 구분해 각각 다른 안내를 보여줍니다.
- 링크 미리보기(OG) 이미지와 iOS·안드로이드용 PNG 아이콘 (`npm run icons`로 다시 생성)
- 로그인과 서버가 없습니다. 모든 데이터는 기기의 localStorage에만 저장됩니다.

## 실행
```bash
npm start      # http://localhost:8080
npm test       # 핵심 로직 단위 테스트 (node:test)
```
빌드 단계가 없는 정적 사이트라서 `app/` 폴더를 GitHub Pages, Netlify, Vercel 등에 그대로 올리면 배포됩니다.

## 배포
- **GitHub Pages (자동)**: `main`에 머지되면 `.github/workflows/deploy.yml`이 테스트를 돌린 뒤 `app/`을 Pages로 배포합니다.
  - 처음 한 번 **Settings → Pages → Source: GitHub Actions**를 선택해야 합니다.
  - 비공개 저장소는 GitHub Pro 이상 플랜에서만 Pages를 쓸 수 있습니다. 무료 플랜이면 저장소를 공개로 바꾸거나 Netlify/Vercel에 `app/` 폴더를 연결하세요.
- **claude.ai 미리보기**: `node scripts/build-preview.mjs`가 `dist-preview/`를 만듭니다. 이 빌드는 서비스 워커를 끄고, 미리보기에서 막히는 인쇄·파일 다운로드 버튼을 숨깁니다.

## 구조
```
app/
  index.html, styles.css, manifest.webmanifest, sw.js, icon.svg
  js/core.js    순수 로직 (호흡수 계산, 경고 판단, 순응도, 리포트), 테스트 대상
  js/store.js   localStorage 저장/불러오기
  js/config.js  베타 설정 (설문 주소, 버전)
  js/app.js     화면 렌더링과 이벤트
tests/core.test.mjs
scripts/build-preview.mjs   미리보기용 빌드
scripts/minimax-marketing.mjs  MiniMax 홍보 문구·이미지·영상(H3) 생성
.github/workflows/deploy.yml  테스트 + GitHub Pages 배포
docs/market-analysis.md
```

## 홍보 콘텐츠 만들기 (MiniMax)
`scripts/minimax-marketing.mjs`는 MiniMax API로 채널별 홍보 문구와 홍보 이미지를 만듭니다. API 키는 이 스크립트를 실행하는 컴퓨터에서만 쓰고, 앱(`app/`)에는 넣지 않습니다.
```bash
export MINIMAX_API_KEY=...            # https://platform.minimax.io 에서 발급
npm run marketing -- copy instagram --n 3          # cafe | instagram | blog | kakao | shorts
npm run marketing -- copy cafe --extra "말티즈 보호자 대상"
npm run marketing -- image --ratio 9:16 --n 2      # 기본 프롬프트 2종, --prompt로 직접 지정 가능
npm run marketing -- video --extra "포메라니안"      # H3: 15초 세로 영상 + 한국어 내레이션·효과음
npm run marketing -- video --image marketing-out/image-....jpeg --duration 10   # 이미지를 첫 장면으로
npm run marketing -- copy blog --dry-run           # API를 부르지 않고 보낼 요청만 확인
```
- `video`는 MiniMax H3 모델로 영상과 소리(내레이션·배경음·효과음)를 한 번에 만듭니다. `--prompt`가 없으면 LLM이 H3용 프롬프트(영어 장면 묘사 + 따옴표 안 한국어 내레이션 + `Sound:` 절)를 먼저 씁니다. 길이 4~15초, 해상도 768P(기본)·2K, 비율 기본 9:16. 실행 전에 예상 비용(768P 약 $0.08/초)을 보여 주고, 완성되면 `marketing-out/video-*.mp4`와 사용한 프롬프트(`.txt`)를 저장합니다.
- H3는 화면 속 한글 글자를 정확히 못 쓰므로 프롬프트에서 화면 글자를 빼도록 했습니다. 자막은 편집 앱(CapCut 등)에서 넣으세요.
- 결과는 `marketing-out/`에 저장되며 git에 올라가지 않습니다.
- 중국 계정은 `MINIMAX_BASE_URL=https://api.minimaxi.com`, 모델 변경은 `MINIMAX_MODEL`(기본 `MiniMax-M2.7`).
- 문구 프롬프트는 진단·치료 효과를 주장하지 않고 "진단을 대신하지 않는다"는 안내를 넣도록 되어 있습니다. 올리기 전에 직접 한 번 읽어 보세요.

## 베타 운영
베타 모집 글, 설문 문항, 4주 판단 기준은 [docs/beta-launch.md](docs/beta-launch.md)에 있습니다.
- 설정 → '베타 참여'에서 이름·메모가 빠진 익명 사용 요약(사용한 날, 7일 리텐션, 기록 개수)을 복사할 수 있습니다.
- `app/js/config.js`의 `FEEDBACK_URL`에 설문 주소를 넣으면 '의견 보내기' 버튼이 나타납니다.

## 다음 단계
1. 네이버 카페(강아지 심장병 보호자 모임)와 인스타그램 노견 계정에 베타를 배포하고 4주 지표를 확인합니다(설치 100명, 7일 리텐션 40%).
2. Capacitor로 앱스토어 출시: 투약·측정 로컬 푸시 알림
3. 가족 공유(클라우드 동기화)와 프리미엄 구독
4. 반려동물 당뇨(혈당 곡선·인슐린) 모듈 추가
