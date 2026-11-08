# 라이프업 커뮤니티

## 구성

- 기존 Angular 앱의 `/community` 경로를 사용한다.
- `community.notionable.net`의 루트(`/`)는 `/community`로 이동한다. 기존 앱 호스트의 루트 동작은 유지한다.
- Firebase 프로젝트와 Hosting 사이트는 기존 `notionable-secondbrain`을 사용한다. 이 구현에는 별도의 Hosting 사이트가 필요하지 않다.
- 기존 Google 로그인 또는 라이프업 구매 이메일 로그인을 재사용한다. 커뮤니티 가입은 별도 확인을 받아 저장하며 상품 구매·회원 등급과 무관하다.
- 같은 Firebase UID를 사용하지만 브라우저 로그인 저장소는 도메인마다 다르다. 앱에서 로그인했다고 커뮤니티 도메인까지 자동 로그인되는 SSO는 포함하지 않는다. 커뮤니티 첫 방문에는 같은 계정으로 로그인한다.

## 공간과 동작

| 묶음 | 방 |
| --- | --- |
| 시작하기 | 라이프업, 공지사항, 이벤트, 요청하기 (이야기 전용) |
| 소통 | 인사하기·알림 마당 (이야기), 묻고 답하기 (질문 답변) |
| 스터디 | 노션, GTD, 세컨드브레인, AI / 자동화 (둘 다) |
| 개발 | 카카오톡 비서, 루틴 관리, 커뮤니티, 위젯, 가계부 (둘 다) |

기본 목록은 제공된 노션 문서에 맞췄다. 방 정의는 `functions/src/community-model.ts`에서 서버와 화면이 공유한다.

- 가입한 멤버만 글, 답글, 멤버 목록을 조회하고 작성할 수 있다.
- 전체 글에는 인사하기·질문을 포함한 모든 방의 글이 최신순으로 나타난다. 방과 일반 피드/질문 답변 필터를 함께 사용할 수 있다.
- 방의 kind 설정은 feed(이야기), question(질문 답변), both(둘 다)이다. 단일 형식 방은 편집기 형식 선택을 잠그고 서버에서도 해당 형식을 적용한다. 관리자에게도 동일하다. both 방과 전체 글에만 전체/이야기/질문 답변 필터를 표시한다.
- 활용 가이드는 폐쇄해 피드와 상세 조회에서 제외하고 원본 데이터는 보존한다. 기존 development ID는 개발 섹션의 커뮤니티 방으로 유지한다.
- 질문 작성자만 답변을 채택·취소할 수 있다. 채택 답변을 수정하거나 삭제하면 채택 상태가 해제된다.
- 글·답글은 작성자 또는 기존 앱 운영자가 수정·삭제할 수 있다. 소개·공지·이벤트 방은 운영자만 글을 작성한다. 운영자 판정은 서버의 기존 `ADMIN_EMAILS`를 사용하며 회원 등급은 만들지 않았다.
- 멤버 프로필에는 이름·한 줄 소개·가입일만 공개한다. 이메일은 공개하지 않는다. 기존 글에는 작성 당시 이름이 남는다.
- 상단 알림에서 개인 알림함을 조회한다. 채팅은 아직 비활성 메뉴다.
- 본문은 일반 텍스트다. 이미지·파일 첨부, 리치 텍스트 편집, 검색, 신고·차단 관리 UI는 이번 구현에 포함하지 않았다.

## 저장과 접근 제어

`communityMembers`, `communityPosts/{postId}/comments`, `communityPosts/{postId}/likes`, `communityMemberPrivate`를 사용한다. 모든 접근은 `communityApi`를 거치며 기존 Firestore 규칙의 기본 거부로 브라우저 직접 접근은 차단된다.

서버는 Firebase ID 토큰과 취소 여부, 인증된 이메일, 계정 삭제 대기 상태, 커뮤니티 멤버 여부, 작성자·운영자 권한을 검사한다. 응답은 `private, no-store`이며 서비스 워커에 커뮤니티 API 응답을 저장하지 않는다.

쓰기에는 트랜잭션을 사용한다. 글·답글의 클라이언트 생성 ID는 응답 실패 후 재시도에도 유지되어 동일 요청이 중복 생성되지 않는다. 버전으로 오래된 수정·삭제 요청을 거부한다. 새 글은 10초, 새 답글은 2초 간격을 둔다. 공감은 사용자당 한 건이며 원하는 상태를 보내는 방식으로 재시도에 안전하다.

삭제한 글은 제목·본문을 비우고 비공개 처리한다. 그 글과 답글은 API에서 더 이상 조회할 수 없다. 삭제한 답글은 내용을 비우고 삭제 표시를 남긴다. 원문 이력이나 복구 기능은 제공하지 않는다. 하위 레코드와 작성자 ID는 보존되므로 별도의 개인정보 삭제·보존 정책이 필요할 경우 후속 정리 작업을 추가한다.

## 배포 및 도메인 연결

1. `npm run build --prefix functions`, `npm run build`로 빌드한다.
2. `firebase deploy --only firestore:indexes --project notionable-secondbrain`로 인덱스를 배포하고 READY 상태를 확인한다. 기존 Firestore 규칙 변경은 없다.
3. `firebase deploy --only "functions:communityApi,functions:requestPurchaseLoginCode,functions:verifyPurchaseLoginCode,hosting:notionable-secondbrain" --project notionable-secondbrain`을 실행한다. 구매 이메일 로그인 함수 두 개는 커뮤니티 출처의 CORS 허용을 위해 포함한다.
4. 기존 Hosting 사이트에 `community.notionable.net`을 **리디렉션이 아닌 콘텐츠 제공용 맞춤 도메인**으로 추가한다.
5. Cloudflare에서 Firebase가 제시하는 정확한 DNS 레코드를 등록한다. 초기 연결은 DNS only로 설정한다. 기존 홈페이지·앱 레코드는 유지한다.
6. Firebase Authentication → 설정 → 승인된 도메인에 `community.notionable.net`을 추가한다. HTTPS 인증서 발급 완료 후 Google 로그인과 구매 이메일 로그인을 실제 계정으로 확인한다.
7. `/`, `/community`, 글 상세 URL 새로고침과 비회원 접근 제한을 확인한다.

2026-11-08 운영 배포 완료: 웹 Hosting, `communityApi`, 구매 이메일 로그인 함수 2개를 배포했다. 커뮤니티 인덱스 5개가 모두 READY이며 전체 글·방·형식·방과 형식·멤버 조회를 운영 데이터베이스에서 읽기 전용으로 검증했다. Firebase Hosting 맞춤 도메인과 Authentication 승인 도메인에도 `community.notionable.net`을 등록했다.

Cloudflare 레코드는 `CNAME community → notionable-secondbrain.web.app`이다. 사용자가 DNS only(회색 구름)로 등록했고, 공개 DNS에서 CNAME과 Firebase IP `199.36.158.100`을 확인했다. Firebase 소유권 확인과 호스팅 연결이 완료되었으며 `https://community.notionable.net/`에서 HTTPS 정상 응답 및 최신 배포를 확인했다.

## 검증

서버 인증 테스트: `node --test functions/test/community-auth.test.cjs functions/test/community-login.test.cjs`

로컬 Firestore 에뮬레이터(8189, 프로젝트 `demo-community`, 저장소 `firestore.rules`) 실행 후 PowerShell에서:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8189'
node --test functions/test/community.test.cjs
# Playwright를 별도 경로에 설치한 환경에서는 PLAYWRIGHT_MODULE 환경 변수를 지정한다.
node scripts/test-community-ui.cjs
```

브라우저 검증은 실제 Angular 컴포넌트와 실제 커뮤니티 서버 로직을 로컬 Firestore에 연결한다. 로그인 신원만 테스트용으로 대체하며 운영 사용자·데이터에 요청하지 않는다. 테스트용 예시 글은 에뮬레이터에만 저장된다. 화면 캡처는 `tmp/community-preview/`에 생성된다.

### 2026-11-08 디자인 업데이트

커뮤니티 전용 화이트 테마, 데스크톱 피드 최대 768px·방 커버 최대 1024px/높이 160px(모바일 120px), 방별 컬러 말풍선 커버를 적용했습니다. Pretendard 가변 폰트는 public/fonts에 OFL 라이선스와 함께 포함해 외부 폰트 서버 의존성을 제거했습니다. 가입 문구의 강제 줄바꿈 제거 및 환영 메시지 변경을 반영했습니다. 프로덕션 빌드와 로컬 Firestore 기반 UI 통합 테스트 통과 후 Hosting에 배포했습니다.

## 관리자와 일반 멤버의 차이

| 기능 | 일반 멤버 | 관리자 |
| --- | --- | --- |
| 시작하기 3개 방 글 작성 | 불가 | 가능 |
| 글·댓글 수정/삭제 | 본인 작성분 | 모든 작성분 |
| 답변 채택/취소 | 본인 질문만 | 본인 질문만 |
| 가입, 방별 형식, 작성 간격 제한 | 적용 | 동일 적용 |

관리자는 서버 ADMIN_EMAILS에 등록된 인증 계정으로 판정한다. 별도 등급·관리 화면·멤버 차단 UI는 없다. 일반 멤버도 시작하기 글을 읽고 댓글·공감을 남길 수 있다. 개선 의견 및 오류 신고 링크는 개발 > 커뮤니티 방으로 이동한다.

## 2026-11-08 기존 서비스 영향 점검

- 기존 로그인/구매/워크스페이스/루틴/반복일정/카카오/웹훅 관련 회귀 테스트 54개 통과. 운영 계정 로그인 및 실제 동기화를 실행하는 E2E 검증은 아님.
- 운영 함수 전체 ACTIVE 확인. 루틴 스케줄은 11월 4일, 반복일정 스케줄은 커뮤니티 작업 이전인 11월 8일 09:17 UTC 배포 상태 유지.
- 최근 1시간 Cloud Run/Cloud Functions ERROR 이상 로그 0건 확인(첫 조회는 quota 429, 재조회 성공).
- 홈페이지/앱/로그인/워크스페이스/커뮤니티 URL HTTP 200 확인. 인증 후 화면과 업무 처리를 보장하는 검증은 아님.
- 기존 Firestore 규칙, 기존 인덱스, 자동화 로직은 변경하지 않음. 신규 커뮤니티 컬렉션 및 인덱스만 추가. 커뮤니티 라우트와 자산은 지연 로드.
- 공유 범위: Hosting 배포본, Firebase Auth 계정, 로그인 코드, 프로젝트 사용량 및 할당량. 커뮤니티는 완전 독립 서비스가 아님.
- 폰트 격리 보완: 전역 font-face 이름 Pretendard를 LifeupCommunityPretendard로 분리해 기존 앱 폰트 스택과의 충돌을 차단.
- 미완료: deleteAccountData에 communityMembers/communityMemberPrivate 및 작성 글·댓글의 삭제/익명화 정책이 연결되어 있지 않음. 앱 탈퇴 후 Auth 접근은 차단되지만 커뮤니티 프로필과 콘텐츠는 남을 수 있음. 정책 확정 및 별도 구현 필요.

## 테마와 관리자 표시

- 링크 섹션에는 라이프봇 앱만 표시한다. 비즈업 멤버십은 연결 주소가 없어 사용자 요청으로 제외했다.
- 계정 메뉴에서 화이트/다크 모드를 선택한다. 전용 localStorage 키 notionable.community.theme와 컴포넌트 호스트 클래스만 사용하므로 기존 앱의 테마나 document/body 클래스는 변경하지 않는다. 기본값은 화이트다.
- 요청하기와 알림 마당은 일반 멤버가 작성 가능한 이야기 방이다. AI / 자동화·위젯·가계부는 이야기와 질문 답변을 모두 허용한다.
- 관리자 계정은 toto791@gmail.com, crefestudio@gmail.com이다. 권한은 서버 인증 이메일로 판정하며, 공개 프로필/글/댓글에는 이메일 대신 서버에서 판정한 관리자 태그만 제공한다. 기존 글에도 표시하며 역할 조회는 최대 60초 캐시한다. 일반 멤버가 보낸 isAdmin 필드는 무시한다.
- 알림 마당에 홍보·반복·스팸·과도한 게시 제한 안내를 표시한다. 기존 게시 간격 제한과 관리자 수정/삭제 권한이 적용되며 자동 스팸 판별기는 추가하지 않았다.
## 커뮤니티 알림

| 사건 | 내부 알림 | 메일·중요한 톡 |
| --- | --- | --- |
| 관리자 새 글 | 작성 시점에 가입한 멤버 전체 | 수신 허용 회원 |
| 내 글의 새 댓글·답변 | 글 작성자 | 수신 허용 회원 |
| 내 답변 채택 | 답변 작성자 | 수신 허용 회원 |
| 관리자에 의한 내 글·댓글 수정/삭제 | 원 작성자 | 수신 허용 회원 |
| 내 글 공감 | 글 작성자 | 미발송 |

- 본인 행동은 본인에게 알리지 않는다. 글 수정은 관리자 새 글 알림을 재발송하지 않는다.
- 재시도, 공감 취소/재공감, 동일 답변 재채택은 같은 이벤트 ID로 중복을 방지한다.
- 가입 시 메일·톡 체크박스는 기본 선택이다. 둘 다 해제해도 가입할 수 있다.
- 기존 멤버는 다음 방문에서 수신 설정을 확인한다. 확인 전 외부 발송은 하지 않으며 내부 알림은 표시한다.
- 알림함은 최신 30개씩 조회하고 개별·모두 읽음·이전 알림을 지원한다. 활성 탭에서 읽지 않은 개수를 60초마다 갱신하며 알림함을 열면 즉시 조회한다.
- 설정은 communityMemberPrivate에만 저장한다. 발송 직전에도 수신 동의, 활성 회원 여부, 이메일 인증, 탈퇴 상태를 확인한다.
- 메일·톡에는 회원 전용 글 제목/본문을 담지 않고 로그인 후 확인 링크만 제공한다.
- 이벤트를 글·댓글 변경과 같은 트랜잭션에 기록한다. fanoutCommunityNotification이 개인 알림을 만들고 deliverCommunityNotification이 외부 채널에 전달한다.
- 메일은 communityMailQueue라는 별도 큐에서 1분마다 처리한다. 기존 메일과 일일 한도·발송 잠금을 공유하며 일반 메일 70건/일, 전체 100건/일 제한을 유지한다. 인증/구매 high 메일이 대기 중이면 커뮤니티 처리를 양보한다. 한도에 도달하면 발송이 지연될 수 있다.
- 메일 수신을 끄면 대기 중인 메일도 발송 직전 취소된다. 이미 보낸 알림은 회수하지 않는다.
- 운영 확인: communityNotificationEvents.completedAt, 개인 notifications.delivery, communityMailQueue.status, communityTalkDeliveries.status/taskId. 메일 queued는 큐 접수이며 실제 성공은 큐의 sent로 확인한다.
- 톡 실제 발송은 현재 꺼져 있다. 설정 전 알림을 활성화 후 일괄 재발송하지 않는다.

### 카카오 챗봇 Event API 설정 안내

1. 기존 봇에 비즈니스 인증 채널·비즈앱·월렛을 연결한다. 수신자는 채널을 친구 추가해야 한다.
2. 별도 알림 블록에 이벤트 이름 community_notification을 등록한다. 필수 파라미터는 두지 않는다. 기존 카카오 수집 스킬을 호출하지 않는 독립 블록으로 구성한다. 텍스트 말풍선:

    {{#current.event.data.text}}
    {{#current.event.data.url}}

3. 챗봇 변경을 배포하고 REST API 키를 Firebase Secret Manager에 등록한다. 키를 소스나 채팅에 저장하지 않는다.

    firebase functions:secrets:set COMMUNITY_KAKAO_REST_API_KEY --project notionable-secondbrain

4. functions/.env.notionable-secondbrain의 공개 설정:

    COMMUNITY_KAKAO_ENABLED=true
    COMMUNITY_KAKAO_BOT_ID=실제_봇_ID
    COMMUNITY_KAKAO_EVENT_NAME=community_notification

5. communityApi, deliverCommunityNotification, processCommunityNotificationDelivery를 재배포한다. 수신 시험 계정에서 먼저 검증한다. 미설정/false 상태에서는 카카오 API를 호출하지 않는다.
6. 수신자는 라이프봇 앱에서 기존 카카오 연결을 완료하고 채널에 메시지를 한 번 보낸다. 현재 소유 워크스페이스와 양방향 연결, 최근 캡처 기록의 명시적 사용자 키 타입을 확인한다. 연결이나 키 타입을 확인할 수 없으면 발송하지 않는다.
7. SUCCESS는 요청 접수다. taskId로 결과를 조회해 실제 성공을 확인한다. POST 응답이 끊기거나 작업이 중단돼 결과가 불명확하면 review로 보류하고 자동 재전송하지 않는다. 성공 메시지는 건당 과금되므로 월렛·사용량을 확인한다.

공식 안내: https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/event-api

### 알림 배포 확인 (2026-11-08)

- 내부 알림·메일 및 가입/계정 수신 설정 배포 완료. 알림 관련 함수 4개 ACTIVE, 정기 처리 ENABLED(1분), community.notionable.net 최신 번들 HTTP 200 확인.
- communityMailQueue 인덱스 READY. 자동 테스트 83개 통과 및 알림 화면 브라우저 검사 완료. 실제 수신자 대상 메일·톡 발송 시험은 수행하지 않음.
- 카카오 Event API는 설정 대기 상태로 비활성화되어 있으며, 위 설정 안내를 완료한 뒤 활성화해야 함.

## 관리자 글 공유 (2026-11-08)

- 새 글 작성 시 관리자만 이메일 뉴스레터·카카오톡·인스타그램 공유 준비를 선택할 수 있습니다. 기본값은 모두 해제입니다. 일반 회원 요청은 서버에서도 거부합니다.
- 이메일 뉴스레터: 메일 수신을 허용하고 설정을 확인한 기존 커뮤니티 회원에게 HTML 본문과 텍스트 대체 본문을 보냅니다. 선택하지 않으면 기존의 간단한 관리자 새 글 메일을 보냅니다. 같은 알림 ID와 메일 큐 키를 사용하므로 둘을 동시에 보내지 않습니다. 수신 거부는 대기 메일에도 적용됩니다.
- 선택한 뉴스레터 내용은 최초 게시 시점의 스냅샷입니다. 재시도·글 수정은 재발송하지 않고, 이미 보낸 내용은 수정/회수되지 않습니다. 발송 한도는 기존 커뮤니티 메일과 동일합니다.
- 카카오톡: 선택한 관리자 글만 톡 수신 동의 및 채널 연결이 있는 회원에게 전달합니다. 현재 Event API 설정 전이라 발송되지 않습니다. 설정 전에 올린 글을 나중에 소급 발송하지 않습니다. 채널 전체 친구에게 일괄 발송하는 기능은 아닙니다.
- 인스타그램: 선택한 글의 상세 화면에서 작성자 본인인 관리자에게 공유 준비 버튼이 나타납니다. 1080×1080 JPEG 표지를 저장하고 최대 2,200자 캡션을 복사할 수 있습니다. 긴 본문은 줄이고 회원 로그인 링크를 붙입니다. 준비 화면은 현재 글 내용을 사용합니다. 외부 게시 버튼을 자동으로 누르거나 API로 등록하지 않습니다.
- 회원 알림 선택 문구는 ‘기본 알림 메일로 받기’, ‘중요한 알림 문자 또는 카카오톡으로 받기’입니다. SMS 발송 업체·전화번호 수집은 연결되지 않았으며 문자 발송은 아직 하지 않습니다.
- 유튜브: 공식 Data API 리소스 목록에 커뮤니티 글 게시 기능이 없어 자동 게시 옵션을 비활성화했습니다. https://developers.google.com/youtube/data/reference/rest

### 인스타그램 notionable_net 연결 준비

1. notionable_net을 비즈니스 또는 크리에이터 프로페셔널 계정으로 준비합니다.
2. Meta 개발자 앱에 Instagram API를 추가하고 Instagram Login 경로를 구성합니다. 기본 계정 접근과 콘텐츠 게시 권한을 설정합니다. 개발 모드에서는 앱 역할/테스터 계정으로 먼저 검증합니다.
3. 계정 인증·동의 후 계정 ID 및 액세스 토큰을 서버 비밀 저장소로 관리합니다. 비밀 키나 토큰을 커뮤니티 글·코드·채팅에 입력하지 않습니다.
4. 실제 자동 게시 연결 시 공개적으로 접근 가능한 게시용 이미지 저장소와 media 생성 → media_publish 처리, 결과 확인 및 중복 방지를 추가합니다. 현재는 이미지/캡션 준비까지만 구현되어 있어 계정 연결만으로 자동 게시가 켜지지는 않습니다.
5. Meta 앱 권한/심사 요구 사항은 운영 범위에 따라 확인합니다. 공식 안내: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/ 및 https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
