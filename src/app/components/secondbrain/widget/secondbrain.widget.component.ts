import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
=> 회원 가입 : notinable - user //특정 템플릿 구매자 확인 : notinable - user - (json - secondbrain - isPremiumMember / isCreatorCompanion) 
=> 노션 연결 : notinable - user - secondbrain - noteDatabaseId
=> 장치 연결 : notinable - user - secondbrain - client
        => clientId별로 accessToken

<ui state>
-> loading
-> email-input          -> 메일 입력
-> email-certification  -> 메일 인증창
-> embed주소 바꾸기 단계
-> connect-button        
-> connect-notion      -> 연결 확인
-> graph

-> no-session        
-> member               userId
-> client-connected     clientId / clientKey    
-> notion-connected     notionNoteDbId


// - localhost 겹치는 문제 / 같은브라우저에서 호출 되는 문제 => 임베디드 바꾸기 기능으로 해결 / clientId
// - email인증 : 프리미엄 구매자 확인을 위해 이메일 확인을 정확히 하기 위해 함 / 1회에 한함 / 이메일은 구매자 확인용    

////////////////////////////////////////////////////////////////////////

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
const pageIcon = `data:image/svg+xml;utf8,
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'>
  <rect x='0' y='0' width='10' height='10' fill='%23ffff00'/>
</svg>`;



export interface SecondBrainLocalSession {
    userId: string;
    clientKey: string;
}

@Component({
    selector: 'app-secondbrain-widget',
    standalone: true,
    templateUrl: './secondbrain.widget.component.html',
    imports: [CommonModule, FormsModule],
    styleUrls: ['./secondbrain.widget.component.css']
})
export class SecondBrainWidgetComponent implements AfterViewInit {
    @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;
    @ViewChild('codeInput0') codeInput0!: ElementRef<HTMLInputElement>;
    @ViewChildren('input') inputs!: QueryList<ElementRef>;

    clientId: string | null = null;
    //userId: string | null = null;
    //clientKey: string | null = null;

    codeArray: string[] = ['', '', '', '', '', ''];

    state: string = 'loading';

    // state propery
    isEmailSending: boolean = false;
    isGraphMenuOpen = false;
    isDisconnectConfirmOpen = false;
    errorMessage: string = '';
    warnMessage: string = '';
    isVerifying: boolean = false;

    // form
    email: string = '';
    // phoneNumber: string = '';
    // connectKey: string = '';

    //databaseData: any;
    //private config = inject<AppConfig>(APP_CONFIG);    
    //inputValue = '';

    constructor(private notionService: NotionService, private route: ActivatedRoute, private userService: UserService) { }

    async ngOnInit() {
        // 1️⃣ snapshot 방식 (컴포넌트 생성 시 한 번만)
        //this.userId = this.route.snapshot.paramMap.get('userId');
        this.clientId = this.route.snapshot.paramMap.get('clientId');
        console.log('snapshot clientId =>', this.clientId);

        // 2️⃣ observable 방식 (URL 변경 시 자동 업데이트)
        this.route.paramMap.subscribe(params => {
            //this.userId = params.get('userId');
            this.clientId = params.get('clientId');
            console.log('subscribe clientId =>', this.clientId);
        });
    }
    
    ngAfterViewInit() {
        setTimeout(() => {
            this.init();
        }, 1);
    }

    init() {
        this.initStateData();
        this.stateProc();
    }

    initStateData() {
        this.errorMessage = '';
        this.warnMessage = '';
        this.isVerifying = false;
        this.isEmailSending = false;
        this.codeArray = Array(6).fill('');
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

// <ui state>
// -> loading
// -> connect-button        
// -> email-input          -> 메일 입력     // 비회원 일떄
// -> email-certification  -> 메일 인증창   => userId (없으면 생성) / client 새로 생성                      
// -> change-client-url
// -> connect-client        
// -> connect-notion      -> 연결 확인     => notionDbId// accessToken     // 비연결일때 
// -> graph                                => clientId     


// <연결 state>
// -> no-member        
// -> no-user               userId           
// -> client-connected     clientId
// -> notion-connected     연결여부체크

    // #main
    async stateProc(): Promise<boolean> {
        _log('stateProc clientId =>', this.clientId);
        if (!this.clientId) {
            this.state = 'connect-button';
            return false;
        }

        // clientKey 체크
        const session: SecondBrainLocalSession | null = this.getLocalSession(this.clientId);        
        if (!session || !session.userId || !session.clientKey) {
            this.state = 'connect-button'; // 세션이 없는 상태
            this.clearLocalSession(this.clientId);
            return false;
        }
        let userId = session.userId;        // from localstorage
        let clientKey = session.clientKey;  // from localstorage
        let clientId = this.clientId;       // from url

        // user 체크 
        const user = await UserService.getUser(userId);
        _log('stateProc userId, user =>', userId, user);
        if (!user || !user.email || user.email.length == 0) {
            this.state = 'connect-button';
            this.errorMessage = '등록한 사용자정보를 확인 할 수 없어 연결을 초기화하였습니다.<br>문제가 지속될 경우 관리자(toto791@gmail.com)에 문의바랍니다.';
            this.clearLocalSession(this.clientId); // 어차피 user못가져오니까 초기화 함
            return false;
        }

        // client 체크 // clientKey 검증
        const client = await this.userService.getSecondBrainClient(userId, clientId, clientKey);
        _log('sesstionStateProc client =>', client);
        if (!client || !client.clientId) {
            this.state = 'connect-button';
            this.errorMessage = '이 장치의 연결이 해지되었습니다.<br>보안을 위해 연결 유효기간은 한 장치당 1개월입니다.<br>다시 연결하려면 이메일 인증을 진행해 주세요.';
            this.clearLocalSession(this.clientId); // 어차피 user못가져오니까 초기화 함
            return false;
        }

        // 노션 연결 체크 : 연결 정상인지? 연결 토큰, dbId등
        const data = await UserService.getSecondBrainIntegration(userId);
        _log('sesstionStateProc userId, data =>', userId, data);
        if (!(data && data.accessToken && data.accessToken.length > 0 && data.noteDatabaseId && data.noteDatabaseId.length > 0)) {
            // 연결창 띄우기
            this.state = 'connect-notion';
            // 노션 연결
            const encryptedUserId = await NACommonService.encrypt(session.userId); // 암호화해서 userId를 넘긴다.
            const baseUrl = window.location.origin;
            const serviceName = 'secondbrain';
            const setupPath = 'connect';
            const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;
            window.open(url, '_blank');
            return false;
        }

        this.state = 'graph';
        setTimeout(() => {
            this.loadGraph();
        }, 1);

        return true;
    }

    async onClickConnectBtn() {
        this.initStateData();
        this.state = 'email-input';
    }
    
    focusFirstCodeInput() {
        setTimeout(() => {
            if (this.codeInput0) {
                // disabled 풀린 다음 포커스 주는 게 안전
                this.codeInput0.nativeElement.focus();
            } else {
                alert('11')
            }
        }, 1000);
    }

    async onSubmitEmail() {
        this.isEmailSending = true;
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
            const _email = this.email.trim().toLowerCase();
            let isSuccess = await this.userService.sendVerificationEmail(_email);
            if (!isSuccess) {
                this.errorMessage = '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
                return;
            }
            this.isEmailSending = false;

            // 5️⃣ 인증 단계로 전환
            this.state = 'email-certification';
            this.initStateData(); // this.email초기화 하면 안됨
            this.focusFirstCodeInput();    

        } catch (e) {
            this.errorMessage = '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
        } finally {

        }
    }

        // 이메일 인증번호 확인
    async submitCertificationNumber() {
        this.isVerifying = true;
        this.errorMessage = '';
        
        if (!this.email) { return; }
        const result: any = await this.userService.verifyCode(this.email, this.getVerificationCode());

        _log('submitCertificationNumber result =>', result);
        if (result && result.userId && result.clientId && result.clientKey) {
            console.log('메일 인증 성공!', result.userId, result.clientId);
            // 로컬 스토리지나 상태 관리에 저장
            this.saveLocalSession(result.clientId, { userId: result.userId, clientKey: result.clientKey });
            this.clientId = result.clientId;
  
            // 세션 단계로 넘어감   
            this.initStateData();
            this.state = 'change-client-url';
        } else if (result.message) {
            console.warn('인증 실패');
            this.errorMessage = result.message;
        }
        this.isVerifying = false;
    }

    // session 단계에서 연결을 기다리는 중
    async onClickCheckConnecttBtn() {
        this.errorMessage = '';
        let isConnected = await this.stateProc();
        if (isConnected) {
            this.errorMessage = '';
        } else {
            this.errorMessage = '아직 연결이 완됴되지 않았습니다.<br>연결작업에 문제가 있을 경우 toto791@gmail.com으로 연락주시면 확인해드리겠습니다.';
        }
    }


    ///////////////////////////////////////////////////////////////////////////////////////////



    // test button

    async onClickGenerateNotionNoteKMDataBatch() {
        if (!this.clientId) { return; }
        let session = this.getLocalSession(this.clientId)
        if(!session || !session.userId) { return; }
        await this.userService.generateNotionNoteKMDataBatch(session.userId);
    }

    // async onClickGenerateNoteConcepts() {
    //     if (!this.clientId) { return; }
    //     let session = this.getLocalSession(this.clientId)
    //     if(!session || !session.userId) { return; }
    //     await this.userService.generateNoteConcepts(session.userId);
    // }

    
    getLocalSession(clientId: string): SecondBrainLocalSession | null {
        // const clientKey = localStorage.getItem(clientId);
        // _log('getLocalSession clientKey =>', clientKey);
        // if (!clientKey) return null;

        let raw = localStorage.getItem(clientId);
        _log('getLocalSession raw =>', raw);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            _log('getLocalSession parsed =>', parsed);

            // 구조 체크
            if (
                typeof parsed !== 'object' ||
                !parsed.userId || !parsed.clientKey 
            ) {
                return null;
            }

            _log('getLocalSession parsed2 =>', parsed);

            return {
                userId: parsed.userId ? String(parsed.userId) : '', 
                clientKey: parsed.clientKey ? String(parsed.clientKey) : ''
            };
        } catch {
            return null;
        }
    }

    saveLocalSession(clientId: string, session: SecondBrainLocalSession): void {
        localStorage.setItem(
            clientId,
            JSON.stringify(session)
        );
    }

    clearLocalSession(clientId: string): void {
        localStorage.removeItem(clientId);
    }

    goBackState() {
        if (this.state == 'email-input') {
            this.initStateData();
            this.state = 'connect-button';
        }
        if (this.state == 'email-certification') {
            this.email = '';
            this.initStateData();
            this.state = 'email-input';
        }
    }

    goGraph() {
        this.init();
    }

    // private getSampleGraphData(): { nodes: Node[]; edges: Edge[] } {
    //     const nodes: Node[] = [
    //         // --- MAIN ---
    //         { id: "gtd", label: "Getting Things Done", group: "main" },
    //         { id: "projects", label: "Projects", group: "main" },
    //         { id: "next_actions", label: "Next Actions", group: "main" },

    //         // --- SECONDARY ---
    //         { id: "areas", label: "Areas of Focus", group: "secondary" },
    //         { id: "waiting", label: "Waiting For", group: "secondary" },
    //         { id: "someday", label: "Someday / Maybe", group: "secondary" },
    //         { id: "reference", label: "Reference", group: "secondary" },
    //         { id: "review", label: "Weekly Review", group: "secondary" },
    //     ];

    //     const edges: Edge[] = [
    //         { from: "gtd", to: "projects" },
    //         { from: "gtd", to: "next_actions" },
    //         { from: "gtd", to: "areas" },

    //         { from: "projects", to: "next_actions" },
    //         { from: "projects", to: "waiting" },
    //         { from: "projects", to: "reference" },

    //         { from: "next_actions", to: "review" },
    //         { from: "review", to: "someday" },
    //     ];

    //     return { nodes, edges };
    // }


    private applyHoverHighlight(
        network: Network,
        nodes: DataSet<Node>,
        edges: DataSet<Edge>
    ) {
        network.on('hoverNode', (params) => {
            const nodeId = params.node;
            const connectedNodeIds = network.getConnectedNodes(nodeId) as string[];
            const connectedEdgeIds = network.getConnectedEdges(nodeId);

            const nodeUpdates: Node[] = [];
            const edgeUpdates: Edge[] = [];

            nodes.forEach((node) => {
                if (!node || !node.id) return;
                const nodeIdStr = node.id.toString(); // 항상 string
                const isActive = nodeIdStr === nodeId.toString() || connectedNodeIds.includes(nodeIdStr);

                nodeUpdates.push({
                    id: node.id,
                    hidden: !isActive, // 연결 안된 노드는 숨기기
                    color: {
                        ...(node.color as any || {}),
                        opacity: 1 // hidden이면 완전히 안보이므로 opacity 유지
                    }
                });
            });

            edges.forEach((edge) => {
                const isActive = connectedEdgeIds.includes(edge.id as any);

                edgeUpdates.push({
                    id: edge.id,
                    hidden: !isActive, // 연결 안된 엣지도 숨기기
                    color: {
                        ...(edge.color as any || {}),
                        opacity: 1
                    }
                });
            });

            nodes.update(nodeUpdates);
            edges.update(edgeUpdates);
        });

        network.on('blurNode', () => {
            const nodeReset: Node[] = [];
            const edgeReset: Edge[] = [];

            nodes.forEach((node) => {
                nodeReset.push({
                    id: node.id,
                    hidden: false, // 모두 보이기
                    color: {
                        ...(node.color as any || {}),
                        opacity: 1
                    }
                });
            });

            edges.forEach((edge) => {
                edgeReset.push({
                    id: edge.id,
                    hidden: false, // 모두 보이기
                    color: {
                        ...(edge.color as any || {}),
                        opacity: 1
                    }
                });
            });

            nodes.update(nodeReset);
            edges.update(edgeReset);
        });
    }



    // #graph
    //userId: string, graphType: "note-keyword" | "keyword-only"

    async loadGraph(graphType: "note-keyword" | "keyword-only" = "note-keyword") {
        try {
            if (!this.clientId) { return; }
            let session = this.getLocalSession(this.clientId)
            if(!session || !session.userId) { return; }
            let userId: string = session.userId;
            // 1️⃣ API 호출
            const response: any = await this.userService.getKeywordGraphData(userId, graphType);
            _log('loadGraph response =>', response);
            if (!response) { return; }
            if (response.errorCode == 200) {
                this.state = 'graph-nodata';                
                return;
            } else {
                this.state = 'graph';
            }
            // if(response.message) {
            //     this.warnMessage = response.message;
            // }
            const graphData: { nodes: Node[]; edges: Edge[] } = await response;

            // // 2️⃣ vis-network용 DataSet 생성
            // const nodesDS = new vis.DataSet(graphData.nodes);
            // const edgesDS = new vis.DataSet(graphData.edges);

            // const data = { nodes: nodesDS, edges: edgesDS };
            //     nodes: new DataSet<Node>(graphData.nodes),
            //     edges: new DataSet<Edge>(graphData.edges),
            // };

            const data = {
                nodes: new DataSet<Node>(graphData.nodes),
                edges: new DataSet<Edge>(graphData.edges),
            };

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
                    // keyword: {
                    //     color: {
                    //         background: '#8B5DFF', // 배경색 유지
                    //         border: '#8B5DFF'      // 배경보다 조금 밝은 정도
                    //     }
                    // },
                    page: {
                        shape: 'image',
                        image: pageIcon,
                        size: 8,
                    }
                }, 
                physics: {
                    enabled: true,  // physics 계속 켬
                    stabilization: false, // 초기 안정화는 끄거나 최소화
                    barnesHut: {
                        gravitationalConstant: -2000,
                        springLength: 150,
                        springConstant: 0.02, // 낮추면 느리고 부드럽게 움직임
                        damping: 0.4,          // 높으면 요동 감소, 낮으면 더 움직임
                        centralGravity: 0.1,   // 중심으로 모이는 힘
                    },
                    minVelocity: 0.1,          // 아주 작은 움직임도 유지
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200
                }
            };

            // --- 네트워크 생성 ---
            const network = new Network(this.graphContainer.nativeElement, data, options);

            // 🔥 hover 강조 적용
            this.applyHoverHighlight(network, data.nodes, data.edges);
        } catch (err) {
            console.error("그래프 로드 중 오류 발생:", err);
        }
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
        this.state = 'connect-button';
        if (this.clientId) {
            const session = this.getLocalSession(this.clientId);
            if (session && session.userId && session.clientKey) {
                await UserService.deleteSecondBrainClientKey(session.userId, this.clientId);
                this.clearLocalSession(this.clientId); // 어차피 user못가져오니까 초기화 함
            } 
        }
    }

    cancelDisconnect() {
        this.isDisconnectConfirmOpen = false;
    }

    ////////////////////////////////////////////////////////
    // 인증 숫자 6개
    onInputNumber(event: any, index: number) {
        const value = event.target.value;

        // 숫자만 허용
        if (/^[0-9]$/.test(value)) {
            this.codeArray[index] = value;

            // 다음 input으로 자동 포커스
            const nextInput = event.target.nextElementSibling;
            if (nextInput) {
                nextInput.focus();
            } 
        } else {
            event.target.value = ''; // 숫자가 아니면 초기화
        }
        
        if (index == 5) {
            this.submitCertificationNumber();
        }
    }

    

    onBackspace(event: any, index: number) {
        _log('onBackspace index =>', index);
        if(index == 0) { return; }
        //if (!this.codeArray[index]) {
            const prevInput = event.target.previousElementSibling;
            if (prevInput) prevInput.focus();
        //} else {
            this.codeArray[index] = '';
        //}
    }

    getVerificationCode(): string {
        return this.codeArray.join('');
    }

    // async createNewClient(userId: string, clientId: string, clientKey: string) {
    //     // 로컬 스토리지나 상태 관리에 저장
    //     this.saveLocalSession(clientId, clientKey);
    // }

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