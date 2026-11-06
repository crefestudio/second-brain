# 카카오톡 순차 처리

`kakaoWebhook`은 Firestore 트랜잭션으로 작업을 등록한 뒤 즉시 기존
`useCallback` 접수 응답을 반환한다. 분석이나 노션 저장을 기다리지 않는다.
처리·대기 작업이 없으면 `처리중입니다...`, 있으면 `순서대로 처리중입니다`를 사용한다.
등록 실패 시에는 접수 성공으로 응답하지 않는다.

사용자별 `kakaoQueueWorkers/{uid}`에 접수 순번, 미완료 개수, 작업자 임대를 저장한다.
`handleKakaoWebhookQueue`는 가장 작은 순번부터 분석과 저장을 끝낸 뒤 다음 작업으로
넘어간다. 다른 사용자는 독립적으로 처리한다. 상태는 pending → processing → done/error다.
완료 기록을 남겨 중복 이벤트가 같은 작업을 다시 실행하지 않도록 한다.

`recoverKakaoWebhookQueue`는 매분 활성 대기열을 확인한다. 작업자는 4분 뒤 새 작업을
시작하지 않고 남은 작업을 복구 실행에 넘긴다. 함수 제한은 540초, 임대는 660초로
실행 중인 작업을 다른 작업자가 빼앗지 않는다. 강제 종료 시 임대 만료 후 남은 pending을
처리한다. processing이었던 작업은 노션 저장 여부가 불확실하므로
`INTERRUPTED_REQUIRES_REVIEW` 오류로 남기고 자동 재저장하지 않는다.

기존 버전의 오류·대기 작업은 자동 재실행하지 않는다. 배포 전후의 이전 버전 작업과
새 작업자가 겹치지 않도록 트래픽이 없는 시점에 작업자를 먼저 배포하고 웹훅을 배포한다.
배포 함수: handleKakaoWebhookQueue, recoverKakaoWebhookQueue, kakaoWebhook.

콜백은 대기 시간이 1분을 넘어도 전송을 시도하며 요청 제한은 3초다.
카카오가 반환한 SUCCESS/FAIL/ERROR와 HTTP 상태로 수락 여부를 확인한다.
작업별 콜백은 한 번만 시도하며, 서버에서 임의로 만료를 판단하지 않는다.
콜백 만료·전송 실패로 저장 작업을 실패시키지 않는다. 장시간 대기한 작업은 노션에는
저장돼도 카카오 완료 답장이나 추가 질문을 받지 못할 수 있다.
연결 변경 검증은 각 작업과 기존 노션 쓰기 경로에서 유지한다.

검증: `npm --prefix functions run build`, `node --test functions/test/kakao-queue.test.cjs`.

카카오 CDN 첨부는 응답 본문의 파일 시그니처로 이미지 여부를 확인한다.
JPEG/PNG/GIF/WebP는 기존 이미지 분석을 유지하며 최대 20MiB까지만 버퍼링한다.
PDF 등 비이미지는 Base64 변환·AI 분석 없이 최대 200MiB까지 스트리밍으로
Storage의 `attachments/{uid}/`에 보관하고 노션 외부 파일 블록으로 첨부한다.
이미지와 파일 이름은 접수 시각의 한국 시간으로 `YYYYMMDDHHmm_Kakao.확장자`를 생성한다.
확장자는 파일 형식을 우선하며 알 수 없으면 Content-Disposition, URL의 확장자를 사용한다.
동일 분에 접수한 파일도 Storage 내부 UUID 경로가 달라 덮어쓰지 않는다.
일반 파일은 자료로 분류하고 템플릿의 기존 저장 대상 제한과 확인 흐름을 따른다.
확인 저장·노트 변환에서도 파일 블록을 보존한다. 첨부 파일은 노션에서 계속
참조하므로 임시 이미지 정리 대상으로 취급하지 않는다.
다운로드 제한 시간은 120초이며 실패한 업로드는 정리한다.
추가 검증: `node --test functions/test/kakao-attachment.test.cjs functions/test/scrapbook-image-save.test.cjs`.
