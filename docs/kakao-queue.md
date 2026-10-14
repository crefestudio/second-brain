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
