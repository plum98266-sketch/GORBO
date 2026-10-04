# POB Map 검증 계획 (가칭)

## 한 줄 정의
해외 K-pop 팬을 위해, 컴백마다 **매장별 예약 특전(POB)·마감일·해외배송 여부**를 영어로 가장 먼저 정리해 주고, **장수 제한 없는 포토카드 바인더**를 주는 앱.

## 왜 이 각도인가
- 팬들은 같은 앨범을 매장마다 다른 특전 카드 때문에 여러 곳에서 삽니다. 특전 정보는 한국 매장 공지(한국어)에 가장 먼저 올라옵니다.
- 기존 컬렉션 앱의 불만: 새 카드 정보 누락, 500장 이상 유료화(Bibliocards), 비싼 구독(Bias Room 연 50달러), 튕김.
- 특전 정보는 **글(매장명·카드 구성·마감일·배송 국가)로 정리**하면 되고, 공식 카드 이미지를 복제하지 않아도 됩니다. 저작권 리스크가 낮습니다.
- 컴백 일정 트래커(kpopcb, KPOPsync)는 있지만, 여러 한국 매장의 특전을 한곳에 비교해 주는 곳은 드뭅니다.

## 소개 페이지
- 주소: https://plum98266-sketch.github.io/GORBO/kpop/ (main 머지 후 배포)
- `kpop/index.html` 맨 아래 `WAITLIST_URL`에 신청 폼 주소를 넣으면 신청 버튼이 켜집니다.

## 대기자 신청 폼 (구글 폼으로 5분이면 만듦)
폼 제목: `POB Map waitlist`
1. Email (필수, 단답형, 이메일 형식 검사)
2. Which groups do you collect? (필수, 단답형) — 예시 문구: `e.g. SEVENTEEN, aespa, ENHYPEN`
3. Where do you live? (필수, 드롭다운) — US / Canada / UK / EU / Japan / Southeast Asia / Latin America / Other
4. How do you track your photocards now? (객관식) — App (which one?) / Spreadsheet / Notes app / I don't track / Other
5. How many albums do you buy per comeback? (객관식) — 1 / 2–3 / 4–9 / 10+
6. What annoys you most about collecting? (선택, 장문형)
7. Would you pay for extras (alerts for every group, price history, no ads)? (객관식) — No, free only / Maybe $1–2 a month / Yes, $3–5 a month / One-time purchase only

설정: "응답 1회로 제한"은 끄기(로그인 강요 방지), 응답 시트를 구글 시트로 연결.

## 홍보 채널 (돈 안 드는 순서)
1. Reddit: r/kpophelp, r/kpoppers, 그룹별 서브레딧 (규칙상 홍보 금지인 곳은 질문 글 형태로, 운영진 허락 후)
2. X(트위터): 포카 거래 계정들이 쓰는 해시태그 `#wts #wtt #photocard` 근처에서 "POB 정리 스레드"를 직접 올리고 끝에 링크
3. TikTok: "POB 비교" 짧은 영상 (화면 녹화 + 자막만으로 가능)
4. 핵심 전략: **실제 컴백 1건의 POB 정리를 무료로 먼저 공개**해서 쓸모를 보여주고 링크를 거는 것

## 판단 기준 (2주)
| 지표 | 계속 | 재검토 |
|---|---|---|
| 대기자 | 300명 이상 | 50명 미만 |
| "유료 의향(1–5달러)" 응답 | 20% 이상 | 5% 미만 |
| POB 정리 글 반응 | 저장·공유가 꾸준함 | 반응 없음 |

## 사용자님이 K-pop을 잘 모를 때의 보완책
- 처음엔 **글로벌 팬덤이 큰 5~8개 그룹**만 다룹니다.
- 대기자 설문의 "어느 그룹?" 응답으로 다룰 그룹을 정합니다. 팬이 원하는 곳만 하면 됩니다.
- 팬 제보 버튼으로 누락된 특전을 받는 구조로 운영 부담을 나눕니다.
- 한국 매장 공지를 매일 확인하는 일은 제가 정리 형식과 체크리스트를 만들어 드릴 수 있습니다.
