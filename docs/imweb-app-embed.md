# 아임웹 마이웹 연결

구매자 다운로드 안내는 `https://app.notionable.net/download/lifeup`을 직접 제공합니다. 이 페이지는 로그인 없이 열리며, 구매 이메일 인증을 완료하면 Firebase에 로그인되고 구매 확인 후 다운로드 안내가 표시됩니다. 이미 로그인한 사용자는 현재 계정에 구매를 연결합니다. 같은 앱 도메인에서 워크스페이스로 이동할 때 로그인 상태를 이어서 사용합니다. 아임웹 회원 전용 `/app`을 거칠 필요가 없으며, 노션 그래프 위젯의 기존 accessKey 인증은 그대로 유지합니다.

`imweb-app-embed.html` 전체를 아임웹 `/app` 페이지의 코드 위젯에 붙여 넣고 마이웹 메뉴를 이 페이지에 연결합니다. iframe 하나에서 기존 Angular 앱이 실행됩니다. 앱 내부 메뉴는 기존 라우터로 이동합니다. 네임서버 변경은 필요하지 않습니다.

| 홈페이지 주소 | iframe 시작 경로 |
| --- | --- |
| `/app` | `/workspace/home` |
| `/app?menu=routine&sub=dashboard` | `/workspace/routine/dashboard` |
| `/app?page=download&sub=lifeup` | `/download/lifeup` |
| `/app?menu=studio&sub=template` | `/workspace/studio/template` |
| `/app?page=mypage&sub=subscription` | `/mypage/subscription` |
| `/app?page=download&sub=lifeup&sub2=3333` | `/download/lifeup/3333` |

`menu`는 워크스페이스 경로에만 사용하며 `/workspace/{menu}/{sub}`로 변환합니다. 워크스페이스 밖의 화면은 `page`를 사용하며 `/{page}/{sub}/{sub2}`로 변환합니다. 새 화면을 추가해도 임베드 코드의 목록을 바꿀 필요가 없습니다. 각 값은 URL 경로 한 칸에 사용할 수 있는 문자만 허용하므로 외부 URL이나 상위 경로는 iframe 대상으로 받을 수 없습니다.

홈페이지 쿼리는 시작 화면을 지정합니다. 앱 내부에서 화면을 이동하면 상단 주소도 현재 화면에 맞는 `menu` 또는 `page` 값으로 갱신됩니다. 예를 들어 루틴 화면에서 스튜디오 템플릿 화면으로 이동하면 `/app?menu=studio&sub=template`으로 바뀌며, 구매 정보 화면은 `/app?page=mypage&sub=subscription`으로 바뀝니다. 홈으로 이동하면 `/app`으로 정리됩니다. 새로고침해도 현재 주소가 가리키는 화면을 다시 엽니다.

## 높이와 스크롤

iframe의 고정 최소 높이(1000px/800px)를 제거하고, 코드 위젯의 화면상 위치부터 보이는 화면 하단까지 높이를 계산합니다. 창 크기 변경·스크롤·모바일 키보드에 따른 visualViewport 변화에도 갱신합니다. 앱의 workspace는 iframe 높이에 고정되고 콘텐츠와 사이드바가 각각 필요한 경우 스크롤됩니다. secondbrain 그래프와 토스트는 해당 영역 안에 배치됩니다.

아임웹 `/app` 페이지에서 코드 위젯을 담는 섹션의 상하 여백은 0으로 설정하세요. 푸터나 다른 섹션이 남아 있으면 홈페이지 자체의 스크롤은 남습니다. 이 페이지를 앱 전용으로 사용할 경우 페이지 설정에서 불필요한 하단 섹션/푸터를 숨기세요. 다른 홈페이지 영역이 잘리지 않도록 코드에서 body 스크롤을 강제로 막지는 않습니다. 별도 외부 위젯도 iframe 높이 자체가 실제 화면보다 길면 부모 페이지에서 높이를 조정해야 합니다.

## 앱 인증 — 구매 이메일 또는 Google

이 코드는 경로 매핑과 기존 CHECK_AUTH → AUTH 회원 식별 정보 전달을 제공합니다. 송신 대상은 app.notionable.net의 해당 iframe으로 제한합니다. 앱은 memberUID를 로그인 증명으로 사용하지 않으며 수신부는 비활성 상태입니다. 계정 박스는 사이드바 하단에 고정되며 위로 열리는 메뉴에서 계정 설정과 로그아웃을 사용할 수 있습니다.

Firebase 세션이 없으면 `/login`에서 구매 이메일 인증번호를 요청하고 입력합니다. 서버가 이메일 소유 및 유료 라이프업 구매 내역을 확인하고 Firebase 커스텀 토큰을 발급합니다. 이미 Google 계정에 연결된 워크스페이스는 같은 Firebase UID를 유지하며, 신규 계정은 서버에서 생성·연결합니다. Google 로그인도 계속 사용할 수 있습니다. 로그인 후에는 처음 요청했던 화면(다운로드 포함)으로 돌아갑니다.

인증번호는 앱 전용 컬렉션에 해시로 저장하고 10분 만료, 5회 실패 제한, 한 번 사용, 발송 간격 1분, 이메일당 시간당 5회/IP당 시간당 30회 제한을 적용합니다. 앱 로그인은 기존 위젯의 `email_verifications`, `accessKey`, 로컬 저장된 위젯 키를 변경하지 않습니다. 위젯 키로 앱 전체에 로그인할 수도 없습니다.

Firebase SDK가 세션을 유지합니다. 브라우저 저장소 제한이나 데이터 삭제, 로그아웃, 다른 기기에서는 다시 인증이 필요할 수 있습니다. 아임웹 로그아웃과 앱 로그아웃은 서로 다른 세션입니다. 홈페이지의 회원 UID만으로 앱 계정을 변경하거나 Firebase 로그인을 해제하지 않습니다.

기존 송신 코드는 `window.MEMBER_UID`를 전달하는 것으로 확인했습니다. 아임웹 memberUID 자동 로그인은 서버에서 로그인 상태를 검증할 수 있는 증명이 추가로 필요합니다. memberUID, localStorage 값, postMessage의 origin만으로 Firebase 토큰을 발급하면 안 됩니다. 회원 조회 API에서 해당 회원이 존재한다는 사실도 현재 방문자가 그 회원이라는 증명은 아닙니다.

삽입 시 기존 공통 스크립트의 `CHECK_AUTH` message 리스너를 제거합니다. 기존의 origin 검사 없는 리스너가 남아 있으면 새 리스너의 제한이 소용없습니다. 같은 스크립트에 있던 `_btn_buy` 구매 버튼의 Latpeed 이동 코드는 그대로 유지합니다. 새 iframe 코드에는 결제 클릭 처리 코드를 중복해서 넣지 않았습니다.

배포 대상은 새 함수 `requestPurchaseLoginCode`, `verifyPurchaseLoginCode`와 앱 Hosting입니다. 기존 위젯 인증 함수와 Firestore 권한 규칙의 변경은 필요 없습니다. 커스텀 토큰 발급을 위해 함수 런타임 서비스 계정에 자기 계정의 `iam.serviceAccounts.signBlob` 권한이 있어야 합니다. 실제 구매 이메일로 인증 메일 수신 → 로그인 → 새로고침 → 위젯 기존 인증 유지까지 확인합니다.

아임웹 API 비밀키는 코드 위젯에 넣지 않습니다. iframe과 postMessage는 운영 도메인 기준으로 구성하며 localhost는 개발 환경에서만 사용합니다.
