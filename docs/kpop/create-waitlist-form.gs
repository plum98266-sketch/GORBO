/**
 * POB Map 대기자 신청 구글 폼을 자동으로 만든다.
 *
 * 사용법
 * 1. https://script.google.com 접속 → "새 프로젝트"
 * 2. 기존 내용을 지우고 이 파일 전체를 붙여 넣기 → 저장(디스크 아이콘)
 * 3. 위쪽 함수 선택이 createPobMapWaitlist 인지 확인 → "실행"
 * 4. 권한 요청이 뜨면 본인 계정 선택 → "고급" → "(안전하지 않음)으로 이동" → "허용"
 *    (내가 만든 스크립트라 구글 검증을 받지 않았다는 안내일 뿐이다)
 * 5. 아래 "실행 로그"에 나온 Share link(https://forms.gle/...)를 복사해서 전달
 */
function createPobMapWaitlist() {
  const form = FormApp.create('POB Map — Waitlist');

  form.setDescription(
    "POB Map shows every K-pop comeback's pre-order benefits from Korean and global stores — " +
    'which store, which card, the deadline, and whether it ships to you — in English, as soon as they\'re announced.\n\n' +
    "Join the waitlist and we'll let you know when it launches. Takes 30 seconds.\n" +
    'Independent fan tool, not affiliated with any agency or store.'
  );
  form.setConfirmationMessage("You're on the list! We'll email you when POB Map launches.");
  form.setLimitOneResponsePerUser(false); // 켜면 구글 로그인을 요구해서 해외 팬이 이탈한다
  form.setAllowResponseEdits(false);
  form.setProgressBar(false);

  // 이메일은 로그인 없이 직접 입력받는다 (형식 검사 포함)
  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextIsEmail()
      .setHelpText('Please enter a valid email address.')
      .build());

  form.addTextItem()
    .setTitle('Which groups do you collect?')
    .setHelpText('e.g. SEVENTEEN, aespa, ENHYPEN')
    .setRequired(true);

  form.addListItem()
    .setTitle('Where do you live?')
    .setChoiceValues(['United States', 'Canada', 'United Kingdom', 'Europe (EU)', 'Japan',
      'Southeast Asia', 'Latin America', 'Other'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How do you track your photocards now?')
    .setChoiceValues(['An app', 'A spreadsheet', 'Notes app', "I don't track them"])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('How many albums do you usually buy per comeback?')
    .setChoiceValues(['1', '2–3', '4–9', '10+']);

  form.addParagraphTextItem()
    .setTitle('What annoys you most about collecting or pre-ordering?');

  form.addMultipleChoiceItem()
    .setTitle('Would you pay for extras like alerts for every group, price history, or no ads?')
    .setChoiceValues(['No, free only', 'Maybe $1–2 a month', 'Yes, $3–5 a month',
      "I'd prefer a one-time purchase"]);

  // 응답을 구글 시트로 자동 정리
  const sheet = SpreadsheetApp.create('POB Map — Waitlist responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // 새 구글 폼은 "게시"해야 응답을 받는다. 지원되지 않는 계정이면 건너뛴다.
  try {
    form.setPublished(true);
  } catch (e) {
    Logger.log('Publish step skipped (' + e.message + '). Open the edit link and press "Publish" if you see it.');
  }
  form.setAcceptingResponses(true);

  const publicUrl = form.getPublishedUrl();
  let shareUrl = publicUrl;
  try {
    shareUrl = form.shortenFormUrl(publicUrl);
  } catch (e) {
    // 단축 실패 시 긴 주소를 그대로 쓴다
  }

  Logger.log('Share link (send this): ' + shareUrl);
  Logger.log('Edit link (only for you): ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
}
