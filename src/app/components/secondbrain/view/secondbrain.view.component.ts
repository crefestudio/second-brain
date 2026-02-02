import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, AfterViewInit, ViewChild, ElementRef, HostListener, ViewChildren, QueryList } from '@angular/core';
import { Router } from '@angular/router';

//import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';
import { NotionService } from '../../../services/notion.service';
import { DataSet, Network, Node, Edge } from 'vis-network/standalone';

// import { NACommonService } from '../../../services/common.service';
// import { StaticCommonHelper } from '../../../lib/static-common-helper';
import { UserService } from '../../../services/user.service';
import { _log } from '../../../lib/cf-common/cf-common';
import { NACommonService } from '../../../services/common.service';

/*

1. connect 
2. emial(phoneNumber) 
3. certification 
    - 서버에 
        - usersId 저장
        - clientId 저장
    - localstorage session 저장     -> userID, clientId // 로컬 설정을 위해, 화면 크기 등 clientId가 필요함
4. api-connectKey 
    - connected client에 추가  

----------------------------------
1. ready
    session:userId 체크 
    - 있으면 : 이 장치에서 이메일 인증이 된 상태 => 3. 연결확인 
    - 없으면 : => 2. 이메일 인증
2. email - 이메일 인증
    - 가입자이면 : 인증 되면 서버에 userId 체크
        - 있으면 
            - client만 추가
                - session에 userId, clientId 저장
                - 서버에 clientId 저장 
        - 없으면
            - 신규가입
                - session에 userId, clientId 저장
                - 서버에 userId, clientId 저장 
        => 3. 연결 확인
** checkConnect - 연결확인
    - accessToken있는지 확인 : session에 userId로 연결유무 확인
    - 있으면 5.그래프
    - 없으면 
        웹이면 4. 연결창 띄우기
        모바일앱이면 => 웹에서 연결작업을 진행해달라고 안내함

4. 연결하기 (브라우저창) // userId, clientId가지고 url
    -> 서버에서 노션 연결작업 후 userId -> accessToken저장
   
5. 그래프
  - accessToken요청 // 이 장치에서 연결이 된 상태 ( 관리에서 이 장치 삭제 했을 수도 있으니) => 그래프
    - 못가져오면
        => 웹이라면 노션 연결 작업 완료 => session에 clientId저장  
        => 모바일엡이라면





*/

/*
    user : integration - secondbrain (accessToken) - client (장치별 설정)

*/


const SB_LOCAL_SESSION_KEY = 'SB_LOCAL_SESSION';
export interface SecondBrainLocalSession {
    userId: string;
    clientId: string;
}

@Component({
    selector: 'app-secondbrain-view',
    standalone: true,
    templateUrl: './secondbrain.view.component.html',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./secondbrain.view.component.css']
})
export class SecondBrainViewComponent implements AfterViewInit {
    @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;
    @ViewChildren('input') inputs!: QueryList<ElementRef>;

    codeArray: string[] = ['', '', '', '', '', ''];


    /*    
    state
    -> null
    -> nosession    
    -> session      
    -> email
    -> email-certification -> 연결창 띄움 
    -> graph
*/

    state: string = '';
    isGraphMenuOpen = false;
    isDisconnectConfirmOpen = false;
    errorMessage: string = '';
    warnMessage: string = '';
    isVerifying: boolean = false;

    // form
    email: string = '';
    // phoneNumber: string = '';
    // connectKey: string = '';

    // key
    session: SecondBrainLocalSession | null = null;

    //databaseData: any;
    //private config = inject<AppConfig>(APP_CONFIG);    
    //inputValue = '';

    constructor(private notionService: NotionService, private router: Router, private userService: UserService) { }

    async ngOnInit() {

    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.init();
        }, 1);
    }

    init() {
        this.errorMessage = '';
        this.warnMessage = '';
        this.sesstionStateProc();
    }

    /*
          session:userId 체크 
        - 있으면 : 이 장치에서 이메일 인증이 된 상태 => 3. 연결확인 
        - 없으면 : => 2. 이메일 인증
    */
    // noSessionStateProc() {
    //     const session = this.getLocalSession();
    //     if (session && session.userId) {
    //         this.session = session;
    //         this.sesstionStateProc();
    //     } else {
    //         this.state = 'nosession'; // 세션이 없는 상태
    //     }
    
    //     //this.state = 'email-certification';
    //     _log('sessionProc state, session =>', this.state, this.session);
    // }

    /*
        checkConnect - 연결확인
        -  session에 userId로 연결유무 확인 (accessToken 유무)
        - 있으면 5.그래프
        - 없으면 
            웹이면 4. 연결창 띄우기
            모바일앱이면 => 웹에서 연결작업을 진행해달라고 안내함
    */
    async sesstionStateProc(): Promise<boolean> { 
        // 세션 체크
        const session = this.getLocalSession();
        if (session && session.userId && session.clientId) {
            this.session = session;
        } else {
            this.state = 'nosession'; // 세션이 없는 상태
            return false;
        }

        // 셔션의 유효성 체크 - userId
        let userId = this.session?.userId;
        let clientId = this.session?.clientId;

        /*
        1. userId -> user.email가져오기 => 메인 인증 완료됨
            => 안되면, nosession 메일 인증 필요
        2. userId -> user.integrations.scondbrain.accessToken 가져오기 => 연결도 완료됨
            => 안되면, session 연결창 띄우기
        3. clientId -> user.integrations.scondbrain.client 정보 => 이 클라언트도 유효함
            => 안되면, client 추가
        
        * client 삭제
        
        */

        // user 체크 
        const user = await UserService.getUser(userId);
        _log('sesstionStateProc userId, user =>', userId, user);
        if (!user || !user.email || user.email.length == 0) {
            this.state = 'nosession';
            this.errorMessage = '등록한 사용자정보를 확인 할 수 없어 연결을 초기화하였습니다.<br>문제가 지속될 경우 관리자(toto791@gmail.com)에 문의바랍니다.';
            this.clearLocalSession(); // 어차피 user못가져오니까 초기화 함
            return false;
        }

        // client 체크 
        const client = await UserService.getSecondBrainClient(userId, clientId);
        _log('sesstionStateProc client =>', client);
        if (!client || client.revoked) {
            this.state = 'nosession';
            this.errorMessage = '등록한 장치의 연결정보를 확인 할 수 없어 연결을 초기화하였습니다.<br>문제가 지속될 경우 관리자(toto791@gmail.com)에 문의바랍니다.';
            this.clearLocalSession(); // 어차피 user못가져오니까 초기화 함
            return false;
        }

        // 노션 연결 체크 : 연결 정상인지? 연결 토큰, dbId등
        const data = await UserService.getSecondBrainIntegration(userId);
        _log('sesstionStateProc userId, data =>', userId, data);

        if (!(data && data.accessToken && data.accessToken.length > 0 && data.noteDatabaseId && data.noteDatabaseId.length > 0)) {
            // 연결창 띄우기
            this.state = 'session';

            // 4. URL 이동
            const encrypted = await NACommonService.encrypt(this.session.userId); 
            const baseUrl = window.location.origin;
            const serviceName = 'secondbrain';
            const setupPath = 'connect';
            const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encrypted)}`;
            window.open(url, '_blank');
            return false;
        }

        // graph
        this.graphState();
//        this.state = 'dev';

        return true;       
    }

    async onClickSyncNoteKeywords() {
        if (!this.session || !this.session.userId) { return; }
        await this.userService.syncNoteKeywords(this.session?.userId);
    }

    async onClickGenerateNoteConcepts() {
        if (!this.session || !this.session.userId) { return; }
        await this.userService.generateNoteConcepts(this.session?.userId);
    }

    graphState() {
        this.state = 'graph';
        setTimeout(() => {
            this.loadGraph();
        }, 1);
    }

    //////////////////////////////////////////////////////

    onClickConnectBtn() {
        if (this.state == 'nosession') {
            this.state = 'email';
            this.errorMessage = '';
            this.isVerifying = false;
        } else if (this.state == 'session') {
            // 연결창 띄우기
            this.sesstionStateProc();
        }
    }

    async onSubmitEmail() {
        this.errorMessage = '';
        // 1️⃣ 이메일 입력 여부
        if (!this.email) {
            this.errorMessage = '이메일을 입력해 주세요.';
            return;
        }

        // 2️⃣ 이메일 포맷 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.errorMessage = '이메일 형식이 올바르지 않습니다.';
            return;
        }

        try {
            // 4️⃣ 인증번호 이메일 발송 API 호출
            let isSuccess = await this.userService.sendVerificationEmail(this.email);
            if (!isSuccess) {
                this.errorMessage = '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
                return;
            }

            // 5️⃣ 인증 단계로 전환
            this.state = 'email-certification';
            this.codeArray = Array(6).fill('');
        } catch (e) {
            this.errorMessage = '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
        } finally {

        }
    }

    getLocalSession(): SecondBrainLocalSession | null {
        const raw = localStorage.getItem(SB_LOCAL_SESSION_KEY);
        _log('getLocalSession raw =>', raw);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            _log('getLocalSession parsed =>', parsed);

            // 구조 체크
            if (
                typeof parsed !== 'object' ||
                !parsed.userId ||
                !parsed.clientId
            ) {
                return null;
            }

            _log('getLocalSession parsed2 =>', parsed);

            return {
                userId: String(parsed.userId),
                clientId: parsed.clientId ? String(parsed.clientId) : ''
            };
        } catch {
            return null;
        }
    }

    saveLocalSession(session: SecondBrainLocalSession): void {
        localStorage.setItem(
            SB_LOCAL_SESSION_KEY,
            JSON.stringify(session)
        );
    }

    clearLocalSession(): void {
        localStorage.removeItem(SB_LOCAL_SESSION_KEY);
        this.session = null;
    }

    /*    
    state
    -> null
    -> nosession    email
    -> session      connect
    -> email        
    -> email-certification
    -> graph
*/
    
    goBackState() {
        if (this.state == 'email') {
            this.email = '';
            this.state = 'nosession';
        } 
        if (this.state == 'email-certification') {
            this.email = '';
            this.codeArray = Array(6).fill('');
            this.state = 'email';
        } 

    }

    goGraph() {
        this.init();
    }

    loadGraph() {
        // --- 노드 데이터 ---
        const nodesArray: Node[] = [
            { id: 1, label: "Jean Valjean", group: "main" },
            { id: 2, label: "Javert", group: "secondary" },
            { id: 3, label: "Fantine", group: "secondary" },
            { id: 4, label: "Cosette", group: "main" },
            { id: 5, label: "Marius", group: "secondary" }
        ];

        // --- 엣지 데이터 ---
        const edgesArray: Edge[] = [
            { from: 1, to: 2 },
            { from: 1, to: 3 },
            { from: 1, to: 4 },
            { from: 4, to: 5 },
            { from: 2, to: 3 },
        ];

        // DataSet으로 변환
        const nodes = new DataSet<Node>(nodesArray);
        const edges = new DataSet<Edge>(edgesArray);

        const data = { nodes, edges };

        // --- 옵션 설정 ---
        const options = {
            nodes: {
                shape: 'dot',
                size: 8,
                font: { size: 11, color: '#EEEEEE' },  // 다크모드 글자색
                color: {
                    // background: '#00CFFF',   // 기본 노드 색상
                    // border: '#00CFFF',
                    highlight: '#007AFF',    // 클릭/선택 시 Apple 블루
                    hover: '#393E46'         // 마우스 올렸을 때
                }
            },
            edges: {
                color: '#393E46',             // 다크톤 엣지
                smooth: {
                    enabled: true,
                    type: 'dynamic',
                    roundness: 0.5
                }
            },
            groups: {
                main: {
                    color: {
                        background: '#00ADB5',
                        border: '#00ADB5'
                    }
                },
                secondary: {
                    color: {
                        background: '#555B66',
                        border: '#555B66'
                    }
                }
            },
            physics: {
                enabled: true,
                stabilization: false,
                barnesHut: {
                    gravitationalConstant: -3000,
                    springLength: 150,
                    springConstant: 0.1
                }
            },

            interaction: {
                hover: true,
                tooltipDelay: 200
            }
        };

        // --- 네트워크 생성 ---
        new Network(this.graphContainer.nativeElement, data, options);
    }

    openGraphMenu(event: MouseEvent) {
        event.stopPropagation();
        this.isGraphMenuOpen = !this.isGraphMenuOpen;
    }

    // 화면 아무 곳이나 클릭 시 닫힘
    @HostListener('document:click')
    closeAllOverlays() {
        this.isGraphMenuOpen = false;
        this.isDisconnectConfirmOpen = false;
    }

    // async onSettings() {
    //     if (!this.session) { return; }

    //     this.isGraphMenuOpen = false;
    //     console.log('설정 클릭');

    //     const baseUrl = window.location.origin;
    //     const serviceName = 'secondbrain';
    //     const setupPath = 'setup';

    //     const userId = this.session.userId; // localStorage에서 읽어온 값
    //     if (!userId) { return; }
    //     const clientId = this.session.clientId; // localStorage에서 읽어온 값
    //     if (!clientId) { return; }

    //     const encrypted = await NACommonService.encrypt(userId);
    //     const url = `${baseUrl}/${serviceName}/${setupPath}?userId=${encodeURIComponent(userId)}&clientId=${encodeURIComponent(clientId)}`;
    //     window.open(url, '_blank'); // 새 탭에서 열기
    // }

    // client연결 끊기
    onClickDisconnect() {
        this.isGraphMenuOpen = false;
        this.isDisconnectConfirmOpen = true; // 여기서 컨펌 오픈  
    }

    // 연결 끊기
    async confirmDisconnect() {
        this.isDisconnectConfirmOpen = false;
        this.state = 'nosession';
        const session = this.getLocalSession();
        if (session && session.userId && session.clientId) {
            await UserService.deleteSecondBrainClient(session.userId, session.clientId);
        }
        this.clearLocalSession(); // 어차피 user못가져오니까 초기화 함
    }

    cancelDisconnect() {
        this.isDisconnectConfirmOpen = false;
    }

    ////////////////////////////////////////////////////////
    // 인증 숫자 6개
    onInputNumber(event: any, index: number) {
        _log('onInputNumber i =>', index);
        const value = event.target.value;

        // 숫자만 허용
        if (!/^\d$/.test(value)) {
            event.target.value = ''; // 직접 input 클리어
            this.codeArray[index] = '';
            return;
        }

        this.codeArray[index] = value; // 직접 배열에 세팅

        // 다음 input으로 포커스 이동
        if (index < this.codeArray.length - 1) {
            const nextInput = event.target.nextElementSibling;
            if (nextInput) nextInput.focus();
        } 

        if (index == 5) {
            this.submitCertificationNumber();
        }
    }

    onBackspace(event: any, index: number) {
        // 뒤로가기 시 이전 input으로 이동
        if (this.codeArray[index] === '' && index > 0) {
            const prevInput = event.target.previousElementSibling;
            if (prevInput) prevInput.focus();
        }
    }

    getVerificationCode(): string {
        return this.codeArray.join('');
    }

    // 이메일 인증번호 확인
    async submitCertificationNumber() {
        this.isVerifying = true;
        this.errorMessage = '';
        if (!this.email) { return; }
        const result: any = await this.userService.verifyCode(this.email, this.getVerificationCode());
        
        _log('submitCertificationNumber result =>', result);
        if (result && result.userId && result.clientId) {
            console.log('메일 인증 성공!', result.userId, result.clientId);
            this.createNewClient(result.userId, result.clientId);
           
            // 세션 단계로 넘어감   
            this.sesstionStateProc();            
        } else if (result.message) {
            console.warn('인증 실패');
            this.errorMessage = result.message;
        }
        this.isVerifying = false;
    }

    async createNewClient(userId: string, clientId: string) {
        // 로컬 스토리지나 상태 관리에 저장
        this.saveLocalSession({ userId: userId, clientId: clientId });
    }

    // session 단계에서 연결을 기다리는 중
    async onClickCheckConnecttBtn() {
        this.errorMessage = '';        
        let isConnected = await this.sesstionStateProc();
        if (isConnected) {
            this.errorMessage = '';        
        } else {
            this.errorMessage = '아직 연결이 완됴되지 않았습니다.<br>연결작업에 문제가 있을 경우 toto791@gmail.com으로 연락주시면 확인해드리겠습니다.';
        }
    }
    ////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // goToConnectPage() {
    //     // Angular 라우터로 이동
    //     this.router.navigate(['/secondbrain/connect']);
    // }
   
    // formatPhoneNumber() {
    //     if (!this.phoneNumber) return;

    //     // 숫자만 남김
    //     let digits = this.phoneNumber.replace(/\D/g, '');

    //     // 최대 11자리 제한
    //     if (digits.length > 11) {
    //         digits = digits.slice(0, 11);
    //     }

    //     if (digits.length <= 3) {
    //         this.phoneNumber = digits;
    //     } else if (digits.length <= 7) {
    //         this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    //     } else {
    //         this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    //     }
    // }

    // async onSubmitPhoneNumber() {
    //     if (!this.phoneNumber) {
    //         alert('휴대폰 번호를 입력해주세요.');
    //         return;
    //     }

    //     // 1. 숫자만 추출
    //     const normalized = this.phoneNumber.replace(/\D/g, '');

    //     // 2. 전화번호 검증
    //     const isValid = /^010\d{8}$/.test(normalized);
    //     if (!isValid) {
    //         alert('휴대폰 번호 형식이 올바르지 않습니다.');
    //         return;
    //     }

    //     // 3. 암호화
    //     const encrypted = await NACommonService.encrypt(normalized);

    //     // 4. URL 이동
    //     const baseUrl = window.location.origin;
    //     const serviceName = 'secondbrain';
    //     const setupPath = 'connect';

    //     const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encrypted)}`;
    //     window.open(url, '_blank');

    //     this.state = 'connectKey'
    // }   



    // 최종 키 등록
    // async onSubmitConnectKey() {
    //     let isSuccess = await this.createConnect();
    //     if (isSuccess) {
    //         this.state = 'success';
    //     }
    // }

    // 2f6eea79-fd8c-8175-887a-00272dc9bd80
    // validateConnectKey(connectKey: string): {
    //     valid: boolean;
    //     reason?: string;
    // } {
    //     if (!connectKey || !connectKey.trim()) {
    //         return { valid: false, reason: '연결키를 입력해주세요.' };
    //     }

    //     if (connectKey.length !== 36) {
    //         return { valid: false, reason: '연결키 형식이 올바르지 않습니다.' };
    //     }

    //     const UUID_REGEX_LOOSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    //     if (!UUID_REGEX_LOOSE.test(connectKey)) {
    //         return { valid: false, reason: '유효하지 않은 연결키입니다.' };
    //     }

    //     const INVALID_KEYS = [
    //         '00000000-0000-0000-0000-000000000000',
    //     ];

    //     if (INVALID_KEYS.includes(connectKey)) {
    //         return { valid: false, reason: '사용할 수 없는 연결키입니다.' };
    //     }

    //     return { valid: true };
    // }

    // async createConnect(): Promise<boolean> {
    //     _log('createConnect phoneNumber, connectKey =>', this.phoneNumber, this.connectKey);
    //     if (!this.phoneNumber || this.phoneNumber.length == 0) { return false; }
    //     if (!this.connectKey || !this.connectKey.trim()) {
    //         this.state = 'connect';
    //         return false;
    //     }
    //     const result = this.validateConnectKey(this.connectKey);
    //     _log('createConnect result =>', result);

    //     if (!result.valid) {
    //         alert(result.reason);
    //         return false;
    //     }

    //     let embedId: string = StaticCommonHelper.generateShortId();
    //     let userId: string | null = await UserService.getUserIdByPhoneNumber(this.phoneNumber);
    //     if (!userId) {
    //         _log('createConnect userId =>', userId);
    //         return false;
    //     }
    //     _log('createConnect userId =>', userId);

    //     // 로컬에 session 저장
    //     this.saveLocalSession({ userId: userId, embedId: embedId, connectKey: this.connectKey });

    //     const result2: any = await UserService.createSecondBrainIntegrationData({
    //         userId,
    //         embedId,
    //     });

    //     console.log('createConnect result =>', result2);

    //     if (!result2.success) {
    //         this.state = 'fail';
    //         return false;
    //     }
    //     //////////////////////////////////////////
    //     //  createSecondBrainIntegrationData      // userId, embedId

    //     // // embedId저장
    //     // await UserService.saveEmbedInfo({
    //     //     userId,
    //     //     embedId,
    //     //     origin: window.location.origin,
    //     //     userAgent: navigator.userAgent,
    //     // });

    //     // // note db id 등록 
    //     // const data = await UserService.getSecondBrainIntegration(userId);
    //     // _log('createConnect data =>', data);

    //     // if (!data || !data.accessToken) {
    //     //     this.state = 'fail';
    //     //     return false;
    //     // }
    //     // // note db 등록
    //     // let dbId = await NotionService.getDatabaseIdByDatabaseName(data.accessToken,'note');
    //     // _log('createConnect dbId =>', dbId);
    //     return true;
    // }

    

}

// 연결 해제, 설정, 