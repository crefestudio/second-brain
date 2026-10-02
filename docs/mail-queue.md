# 메일 발송 관리

모든 서버 Resend 발송은 `functions/src/mail-queue.ts`를 거친다. 고객 관리 수동 발송은 수신자별로 대기열에 등록하고, `processMailQueue`가 1분마다 처리한다. 이메일 인증은 같은 대기열에 기록한 후 요청 안에서 바로 발송한다.

## 한도와 시간

- 우선 `high`: 인증, 구매 안내 및 운영 알림. 전체 일일 한도 100건이 남아 있으면 즉시 발송한다.
- 보통 `normal`: 고객 관리 수동 발송, 하루 70건.
- 수신 주소 1개가 1건이다. 보통 70건을 모두 사용해도 우선 메일은 전체 100건까지 발송한다.
- `mailDailyUsage/{UTC 날짜}`를 트랜잭션으로 예약한다. 집계 경계는 한국시간 오전 9시이며, 한도에 걸린 대기 메일은 다음 집계일 오전 10시부터 재시도한다.
- 카운터는 발송 시도 예약을 포함한다. 실패해도 보수적으로 예약을 유지하므로 실제 성공 건수보다 높을 수 있다.
- 도입 이전 발송, Resend 대시보드에서 직접 보낸 메일, 다른 서비스가 같은 계정으로 보낸 메일은 이 카운터에 포함되지 않는다. 공급자 한도 거절 시 공통 발송을 다음 오전 10시까지 보류한다. 월간 한도는 공급자에서 풀릴 때까지 매일 재확인한다.

## 재시도와 보안

Firestore 전역 lease로 여러 함수의 동시 발송을 직렬화하고 요청 간 1초 간격을 유지한다. 발송 직전 일반 메일의 수신 차단을 다시 검사한다. 서버 발송 경로만 대기열에 쓸 수 있으며 조회 API는 관리자 인증을 요구한다. 기존 Firestore의 기본 거부 규칙이 대기열·카운터·메일 본문에 적용된다.

수동 발송은 요청 ID와 수신 주소, 구매 발송은 구매 기록 ID와 메일 종류·수신 주소로 중복 등록을 막는다. 공급자에는 동일한 대기열 ID의 idempotency key를 전달한다. 응답이 불명확한 발송은 23시간까지만 같은 키로 재시도하고 이후 `확인 필요`로 남겨 자동 중복 발송을 방지한다. Resend idempotency 보존 시간은 24시간이다: https://resend.com/docs/dashboard/emails/idempotency-keys

성공·실패·취소·만료된 메일은 본문을 제거한다. 관리 API는 대기 중 메일의 본문도 반환하지 않는다. 인증은 즉시 발송하지 못하면 요청을 실패 처리하고 대기 메일을 취소한다. 만료된 인증번호를 다음 날 보내지 않는다.

`발송됨`은 공급자의 접수 성공이며 최종 수신함 도착을 뜻하지 않는다. 반송/수신 확인 웹훅은 이 기능의 범위에 포함하지 않는다. 구매 기록에는 대기열 ID를 남기고, 실제 발송 상태는 메일 발송 관리에서 확인한다.

## 배포 및 확인

먼저 `firestore.indexes.json`의 mailQueue 복합 인덱스가 준비되어야 한다. 기존 원격 인덱스를 삭제하지 않는다.

관련 함수: `processMailQueue`, `listMailQueue`, `sendLifeupCustomerMail`, `requestPurchaseLoginCode`, `sendVerificationEmail`, `latpeedPaymentWebhook`, `createCareRequest`, `sendTemplateConnectRequest`.

검증: Functions 빌드, Angular 빌드, `node --test functions/test/mail-queue.test.cjs`. 테스트는 가짜 공급자를 사용하며 실메일을 발송하지 않는다.
