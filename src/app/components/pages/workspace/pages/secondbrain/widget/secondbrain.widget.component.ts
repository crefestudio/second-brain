import { Component, AfterViewInit, ViewChild, ElementRef, HostListener, ViewChildren, QueryList } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../../../../services/auth.service';
import { EventListenerService, UserEvent } from '../../../../../../services/event-listener.service';

// import { NotionService } from '../../../../../../services/notion.service';
import { DataSet, Network, Node, Edge } from 'vis-network/standalone';

import { UserService, SecondBrainLocalSession } from '../../../../../../services/user.service';
import { _log } from '../../../../../../lib/cf-common/cf-common';


/*
=> 회원 가입 : notinable - user //특정 템플릿 구매자 확인 : notinable - user - (json - secondbrain - isPremiumMember / isCreatorCompanion) 

// - localhost 겹치는 문제 / 같은브라우저에서 호출 되는 문제 => 임베디드 바꾸기 기능으로 해결 / userId
// - email인증 : 프리미엄 구매자 확인을 위해 이메일 확인을 정확히 하기 위해 함 / 1회에 한함 / 이메일은 구매자 확인용    

////////////////////////////////////////////////////////////////////////

1. connect 
2. emial(phoneNumber) 
3. certification 
    - 서버에 
        - usersId 저장 
    - localstorage session 저장     -> accessKey
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

        - 없으면
            - 신규가입
                - session에 userId, accessKey 저장
                - 서버에 userId, accessKey 저장 
        => 3. 연결 확인
** checkConnect - 연결확인
    - accessToken있는지 확인 : session에 userId로 연결유무 확인
    - 있으면 5.그래프
    - 없으면 
        웹이면 4. 연결창 띄우기
        모바일앱이면 => 웹에서 연결작업을 진행해달라고 안내함

4. 연결하기 (브라우저창) 
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

// accessToken          : 이미 있는 값
// noteDatabaseId       : 이미 있는 값

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
    @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;
    @ViewChildren('input') inputs!: QueryList<ElementRef>;

    userId: string | null = null;
    notionAccessToken: string = '';

    // event
    events: UserEvent[] = [];
    private unsubscribe?: () => void;

    // toast
    isShowToast = false;
    toastMessage!: SafeHtml;

    //clientId: string | null = null;
    //clientKey: string | null = null;

    codeArray: string[] = ['', '', '', '', '', ''];

    state: string = 'loading';

    // state propery
    isEmailSending: boolean = false;
    isMenuOpen = false;
    isDisconnectConfirmOpen = false;
    isLogoutConfirmOpen = false;

    errorMessage: string = '';
    warnMessage: string = '';
    isVerifying: boolean = false;

    // form
    email: string = '';
    clientUrl: string = '';
    isCopied: boolean = false;
    // phoneNumber: string = '';
    // connectKey: string = '';

    //databaseData: any;
    //private config = inject<AppConfig>(APP_CONFIG);    
    //inputValue = '';
    pinnedNodeId: string | null = null;

    constructor(
        //private notionService: NotionService,
        private route: ActivatedRoute,
        private userService: UserService,
        private eventListenerService: EventListenerService,
        private sanitizer: DomSanitizer,
        private authService: AuthService
    ) { }

    get isWidgetMode(): boolean {
        return window.location.pathname.includes("/widget")
    }

    async ngOnInit() {
        document.body.classList.add('secondbrain-widget-page');
        // 위젯 모드이면 주소로 userId를 가져온다. 없을 수도 있음
        if (this.isWidgetMode) {
            this.userId = this.route.snapshot.paramMap.get('userId');

            this.route.paramMap.subscribe(params => {
                this.userId = params.get('userId');
                _log('widget route userId =>', this.userId);
            });
        }
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.init();
        }, 1);
    }

    async init() {
        this.initStateData();
        await this.stateProc();
    }

    async updateSession() {
        await this.authService.updateSession();
        this.userId = this.authService.getUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();
        _log('updateSession userId, notionAccessToken =>', this.userId, this.notionAccessToken);
        this.updatePurchaseInfo()
    }

    hasLifeupPurchase: boolean = false;
    purchaseInfo: any = null;
    async updatePurchaseInfo() {
        if (!this.userId) { return; }
        const result = await UserService.updatePurchaseInfo(this.userId);
        this.purchaseInfo = result.purchaseInfo;
        this.hasLifeupPurchase = result.isPurchaser;
    }


    ngOnDestroy() {
        // 🔥 컴포넌트 제거 시 리스너 해제
        this.unsubscribe?.();
        document.body.classList.remove('secondbrain-widget-page');

    }

    initEvent(userId: string) {
        // event
        this.unsubscribe = this.eventListenerService.listenUserEventsRealtime(userId, event => {
            this.onEvent(event);
        }
        );
    }

    onEvent(event: UserEvent) {
        if (!this.userId) return;

        // 위젯모드라면 로컬 세션을 체크해서 이벤트 처리를 막는다.
        if (this.isWidgetMode) {
            const session = UserService.getLocalSession(this.userId);
            if (!session?.accessKey) {
                return;
            }
        }

        this.showEventToast(event);

        if (event.eventType === 'generate-note-keyword' && event.status === 'completed') {
            this.updateGraphData();
            setTimeout(() => {
                this.showToast('키워드 추출작업이 완료되어 그래프를 다시 그립니다.');
            }, 1000);
        }
    }

    async updateGraphData() {
        if (!this.userId) { return; }
        // let session = this.getLocalSession(this.userId)
        // if(!session || !session.accessKey) { return; }
        // let userId: string = session.userId;
        // 1️⃣ API 호출
        const response: any = await this.userService.getKeywordGraphData(this.userId, this.currGraphType);
        _log('loadGraph response =>', response);
        if (!response) { return; }
        if (response.errorCode == 200) {
            return;
        }
        const data: { nodes: Node[]; edges: Edge[] } = await response;
        this.graphData.edges.update(data.edges);
        this.graphData.nodes.update(data.nodes);
    }

    showEventToast(event: UserEvent) {
        if (event.eventTitle) {
            this.showToast(event.eventTitle);
        }
    }

    showToast(message: string, duration = 3500) {
        this.toastMessage = this.sanitizer.bypassSecurityTrustHtml(message);;
        this.isShowToast = true;

        // hide
        setTimeout(() => {
            this.isShowToast = false;
        }, duration);
    }


    initStateData() {
        this.errorMessage = '';
        this.warnMessage = '';
        this.isVerifying = false;
        this.isEmailSending = false;
        this.codeArray = Array(6).fill('');
    }

    /*

        1. userId, accessKey 체크
        2. 



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

    // #main
    async stateProc(): Promise<boolean> {
        _log('stateProc mode =>', {
            isWidgetMode: this.isWidgetMode,
            userId: this.userId
        });

        this.showToast('세컨드브레인 위젯을 시작합니다.');

        if (this.isWidgetMode) {
            return await this.stateProcWidget();
        }
        return await this.stateProcWorkspace();
    }

    private async stateProcWidget(): Promise<boolean> {
        if (!this.userId) {
            this.state = 'connect-button';
            return false;
        }

        const session = UserService.getLocalSession(this.userId);

        if (!session?.accessKey) {
            this.showToast('이 장치의 인증 정보가 확인되지 않습니다.<br>보안을 위해 다시 인증해 주세요.');
            this.state = 'connect-button';
            UserService.clearLocalSession(this.userId);
            return false;
        }

        const user = await this.userService.checkUserAccessKey(this.userId, session.accessKey);

        _log('stateProcWidget user =>', user);

        if (!user?.userId) {
            this.state = 'connect-button';
            this.errorMessage = '인증 정보가 만료되었거나 확인되지 않습니다.<br>보안을 위해 다시 인증해 주세요.<br>(연결 유효기간: 1개월)';
            UserService.clearLocalSession(this.userId);
            return false;
        }

        this.initEvent(this.userId);

        const data = await UserService.getSecondBrainIntegration(this.userId);
        const hasIntegrationToken = !!data?.accessToken?.length;

        _log('stateProcWidget notion check =>', {
            userId: this.userId,
            hasIntegrationToken
        });

        if (!hasIntegrationToken) {
            this.state = 'connect-notion';
            return false;
        }

        this.state = 'graph';

        setTimeout(() => {
            this.loadGraph();
        }, 1);

        return true;
    }

    private async stateProcWorkspace(): Promise<boolean> {
        await this.updateSession();

        if (!this.userId || !this.hasLifeupPurchase) {
            this.state = 'connect-button';
            return false;
        }

        this.initEvent(this.userId);

        if (!this.notionAccessToken) {
            this.state = 'connect-notion';
            return false;
        }

        this.state = 'graph';

        setTimeout(() => {
            this.loadGraph();
        }, 1);

        return true;
    }


    // async stateProc(): Promise<boolean> {
    //     _log('stateProc userId =>', this.userId);
    //     this.showToast('세컨드브레인 위젯을 시작합니다.');

    //     if (!this.userId) {
    //         //this.showToast('연결정보가 확인되지 않아 재인증이 필요합니다.');
    //         this.state = 'connect-button';
    //         return false;
    //     }

    //     // clientKey 체크
    //     const session: SecondBrainLocalSession | null = UserService.getLocalSession(this.userId);
    //     if (!session || !session.accessKey) {
    //         this.showToast('이 장치의 인증 정보가 확인되지 않습니다.<br>보안을 위해 다시 인증해 주세요.');
    //         this.state = 'connect-button'; // 세션이 없는 상태
    //         UserService.clearLocalSession(this.userId);
    //         return false;
    //     }

    //     let userId = this.userId;           // from url
    //     let accessKey = session.accessKey;  // from localstorage

    //     // user 체크 
    //     // const user = await UserService.getUser(userId);
    //     // _log('stateProc userId, user =>', userId, user);
    //     // if (!user || !user.email || user.email.length == 0) {
    //     //     this.state = 'connect-button';
    //     //     this.errorMessage = '등록한 사용자정보를 확인 할 수 없어 연결을 초기화하였습니다.<br>문제가 지속될 경우 관리자(toto791@gmail.com)에 문의바랍니다.';
    //     //     this.clearLocalSession(this.userId); // 어차피 user못가져오니까 초기화 함
    //     //     return false;
    //     // }

    //     // user 체크 // accessKey 검증
    //     const user = await this.userService.checkUserAccessKey(userId, accessKey);
    //     _log('sesstionStateProc user =>', user);
    //     if (!user || !user.userId) {
    //         this.state = 'connect-button';
    //         this.errorMessage = '인증 정보가 만료되었거나 확인되지 않습니다.<br>보안을 위해 다시 인증해 주세요.<br>(연결 유효기간: 1개월)';
    //         UserService.clearLocalSession(this.userId); // 어차피 user못가져오니까 초기화 함
    //         return false;
    //     }

    //     this.initEvent(userId);

    //     // 노션 연결 체크 : 연결 정상인지? 연결 토큰, dbId등
    //     const data = await UserService.getSecondBrainIntegration(userId);
    //     _log('sesstionStateProc userId, data =>', userId, data);
    //     if (!(data && data.accessToken && data.accessToken.length > 0)) {
    //         // 연결창 띄우기
    //         this.state = 'connect-notion';
    //         // 노션 연결
    //         const encryptedUserId = await NACommonService.encrypt(session.userId); // 암호화해서 userId를 넘긴다.
    //         const baseUrl = window.location.origin;
    //         const serviceName = 'secondbrain';
    //         const setupPath = 'connect';
    //         const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encryptedUserId)}`;
    //         window.open(url, '_blank');
    //         return false;
    //     }

    //     this.state = 'graph';
    //     setTimeout(() => {
    //         this.loadGraph();
    //     }, 1);

    //     return true;
    // }

    async onClickConnectBtn() {
        this.initStateData();
        if (!this.isWidgetMode) {
            this.openWorkspaceConnect();
            return;
        }
        this.state = 'email-input';
        setTimeout(() => {
            this.emailInput.nativeElement.focus();
        }, 100);
    }

    private openWorkspaceConnect() {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/workspace/connect`;
        window.location.href = url;
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
        const result: { userId: string, accessKey: string, message?: string } | null =
            await this.userService.verifyCode(this.email, this.getVerificationCode());

        _log('submitCertificationNumber result =>', result);
        if (result && result.userId && result.accessKey) {
            _log('메일 인증 성공!', result.userId);

            // 만약에 accessKey를 못받으면.
            if (result.userId && result.accessKey) {
                // 로컬 스토리지나 상태 관리에 저장
                UserService.saveLocalSession(result.userId, { userId: result.userId, accessKey: result.accessKey });
                // 세션 단계로 넘어감   
                if (this.userId !== result.userId) {
                    this.userId = result.userId;
                    this.initStateData();
                    this.clientUrl = 'https://app.notionable.net/secondbrain/widget/' + this.userId;
                    this.state = 'change-client-url';
                } else {
                    await this.redoStateProc();
                }
            } else {
                this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다. code = 132';
            }

        } else if (!result || result.message) {
            console.warn('인증 실패');
            this.initStateData();
            this.errorMessage = result && result.message ? result.message : '인증에 실패하였습니다. 문제가 지속되면 관리자 ( toto791@gmail.com) 에게 문의바랍니다.';
        }
        this.isVerifying = false;
    }

    // session 단계에서 연결을 기다리는 중
    async onClickCheckConnecttBtn() {
        await this.redoStateProc();
    }

    async redoStateProc() {
        this.errorMessage = '';
        let isConnected = await this.stateProc();
        if (isConnected) {
            this.errorMessage = '';
        } else {
            //this.errorMessage = '아직 연결이 완됴되지 않았습니다.<br>연결작업에 문제가 있을 경우<a href="http://pf.kakao.com/_tGkqX/chat" target="_blank" style="color:#e26b34; text-decoration:none;">카카오 채널톡</a>으로 연락주시면 확인해드리겠습니다.';
        }
    }


    ///////////////////////////////////////////////////////////////////////////////////////////


    // async onClickGenerateNoteConcepts() {
    //     if (!this.clientId) { return; }
    //     let session = this.getLocalSession(this.clientId)
    //     if(!session || !session.userId) { return; }
    //     await this.userService.generateNoteConcepts(session.userId);
    // }





    goBackState() {
        if (this.state == 'email-input') {
            this.email = '';
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






    // // #graph
    // //userId: string, graphType: "note-keyword" | "keyword-only"
    graphData = {
        nodes: new DataSet<Node>(),
        edges: new DataSet<Edge>(),
    };
    currGraphType: string = "note-keyword";

    private network?: Network;
    async loadGraph(graphType: string = "note-keyword") {
        try {
            let graphTypeName = "";

            if (graphType === "note-keyword") {
                graphTypeName = "노트-키워드";
            } else if (graphType === "keyword-only") {
                graphTypeName = "키워드";
            }

            this.showToast(
                `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프 데이터를 불러오는 중입니다.`,
                2000
            );

            if (!this.userId || !this.graphContainer?.nativeElement) {
                return;
            }

            const session = UserService.getLocalSession(this.userId);
            if (!session?.userId) {
                return;
            }

            const userId = session.userId;
            const response: any = await this.userService.getKeywordGraphData(userId, graphType);

            if (!response) {
                return;
            }

            if (response.errorCode === 200) {
                this.state = "graph-nodata";
                return;
            }

            this.showToast(
                `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프 데이터를 분석하는 중입니다.`,
                2000
            );

            this.state = "graph";

            const graphData: { nodes: Node[]; edges: Edge[] } = response;

            const options = {
                autoResize: true,
                nodes: {
                    shape: "dot",
                    size: 8,
                    font: { size: 11, color: "#EEEEEE" },
                    color: {
                        highlight: "#007AFF",
                        hover: "#393E46"
                    }
                },
                edges: {
                    color: "#393E46",
                    smooth: {
                        enabled: true,
                        type: "dynamic",
                        roundness: 0.5
                    }
                },
                groups: {
                    page: {
                        shape: "image",
                        image: pageIcon,
                        size: 8
                    }
                },
                physics: {
                    enabled: true,
                    stabilization: {
                        iterations: 100
                    },
                    barnesHut: {
                        gravitationalConstant: -2000,
                        springLength: 120,
                        springConstant: 0.04,
                        damping: 0.9,
                        centralGravity: 0.3
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200
                }
            };

            this.network?.destroy();
            this.network = undefined;

            this.graphData.nodes.clear();
            this.graphData.edges.clear();

            this.graphData.nodes.add(graphData.nodes);
            this.graphData.edges.add(graphData.edges);

            this.showToast(
                `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프를 구성하는 중입니다.`,
                2000
            );

            requestAnimationFrame(() => {
                if (!this.graphContainer?.nativeElement) {
                    return;
                }

                const container = this.graphContainer.nativeElement;
                const rect = container.getBoundingClientRect();

                _log("graph container size =>", {
                    width: rect.width,
                    height: rect.height
                });

                this.showToast(
                    `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프를 그리고 있습니다.`,
                    2000
                );

                this.network = new Network(container, this.graphData, options);

                requestAnimationFrame(() => {
                    this.network?.setSize("100%", "100%");
                    this.network?.redraw();
                    this.network?.fit({ animation: false });
                });

                this.network.once("stabilized", () => {
                    this.showToast(
                        `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프 생성이 완료되었습니다.`,
                        2000
                    );
                });

                this.applyHoverHighlight(
                    this.network,
                    this.graphData.nodes,
                    this.graphData.edges
                );

                this.network.on("click", (params: any) => {
                    if (!params.nodes.length) {
                        return;
                    }

                    const nodeId = params.nodes[0];
                    const node: any = this.graphData.nodes.get(nodeId);

                    if (node?.group === "page" && node?.notionPageId) {
                        const cleanPageId = node.notionPageId.replace(/-/g, "");
                        const notionUrl = `https://www.notion.so/${cleanPageId}`;

                        window.open(notionUrl, "_blank");
                    }
                });

                this.network.on("hoverNode", (params: any) => {
                    const node: any = this.graphData.nodes.get(params.node);

                    if (node?.group === "page") {
                        container.style.cursor = "pointer";
                    }
                });

                this.network.on("blurNode", () => {
                    container.style.cursor = "default";
                });
            });
        } catch (err) {
            console.error("그래프 로드 중 오류 발생:", err);
            this.showToast("그래프를 불러오는 중 오류가 발생했습니다.", 3000);
        }
    }

    @HostListener('window:resize')
    onWindowResize() {
        requestAnimationFrame(() => {
            this.network?.setSize('100%', '100%');
            this.network?.redraw();
        });
    }

    // async loadGraph(graphType: string = "note-keyword") {
    //     try {
    //         let graphTypeName: string = '';
    //         if (graphType == 'note-keyword') graphTypeName = '노트-키워드';
    //         else if (graphType == 'keyword-only') graphTypeName = '키워드';

    //         this.showToast(
    //             `<span style="color:#7fb7ff">${graphTypeName}</span> 그래프를 그리는 중입니다. 잠시만 기다려주세요.`,
    //             2000
    //         );

    //         if (!this.userId) return;

    //         let session = UserService.getLocalSession(this.userId);
    //         if (!session || !session.userId) return;

    //         let userId: string = session.userId;

    //         const response: any = await this.userService.getKeywordGraphData(userId, graphType);

    //         if (!response) return;

    //         if (response.errorCode == 200) {
    //             this.state = 'graph-nodata';
    //             return;
    //         } else {
    //             this.state = 'graph';
    //         }

    //         const graphData: { nodes: Node[]; edges: Edge[] } = await response;

    //         const options = {

    //             nodes: {
    //                 shape: 'dot',
    //                 size: 8,
    //                 font: { size: 11, color: '#EEEEEE' },
    //                 color: {
    //                     highlight: '#007AFF',
    //                     hover: '#393E46'
    //                 }
    //             },

    //             edges: {
    //                 color: '#393E46',
    //                 smooth: {
    //                     enabled: true,
    //                     type: 'dynamic',
    //                     roundness: 0.5
    //                 }
    //             },

    //             groups: {
    //                 page: {
    //                     shape: 'image',
    //                     image: pageIcon,
    //                     size: 8,
    //                 }
    //             },

    //             physics: {
    //                 enabled: true,
    //                 stabilization: {
    //                     iterations: 200
    //                 },
    //                 barnesHut: {
    //                     gravitationalConstant: -2000,
    //                     springLength: 120,
    //                     springConstant: 0.04,
    //                     damping: 0.9,
    //                     centralGravity: 0.3
    //                 }
    //             },

    //             interaction: {
    //                 hover: true,
    //                 tooltipDelay: 200
    //             }
    //         };

    //         const network = new Network(
    //             this.graphContainer.nativeElement,
    //             this.graphData,
    //             options
    //         );

    //         this.graphData.nodes.clear();
    //         this.graphData.edges.clear();

    //         this.graphData.nodes.add(graphData.nodes);
    //         this.graphData.edges.add(graphData.edges);

    //         // highlight 기능 적용
    //         this.applyHoverHighlight(network, this.graphData.nodes, this.graphData.edges);

    //         // 클릭 → notion 페이지 이동
    //         network.on("click", (params: any) => {

    //             if (!params.nodes.length) return;

    //             const nodeId = params.nodes[0];
    //             const node: any = this.graphData.nodes.get(nodeId);

    //             if (node?.group === "page" && node?.notionPageId) {

    //                 const cleanPageId = node.notionPageId.replace(/-/g, "");
    //                 const notionUrl = `https://www.notion.so/${cleanPageId}`;

    //                 window.open(notionUrl, "_blank");
    //             }
    //         });

    //         // page hover → pointer
    //         network.on("hoverNode", (params: any) => {

    //             const node: any = this.graphData.nodes.get(params.node);

    //             if (node?.group === "page") {
    //                 this.graphContainer.nativeElement.style.cursor = "pointer";
    //             }

    //         });

    //         network.on("blurNode", () => {
    //             this.graphContainer.nativeElement.style.cursor = "default";
    //         });

    //     } catch (err) {

    //         console.error("그래프 로드 중 오류 발생:", err);

    //     }
    // }

    private applyHoverHighlight(
        network: Network,
        nodes: DataSet<Node>,
        edges: DataSet<Edge>
    ) {

        let pinnedNodeId: string | null = null;

        const highlightNode = (nodeId: string) => {

            const connectedNodes = network.getConnectedNodes(nodeId) as string[];

            const connectedSet = new Set([
                nodeId,
                ...connectedNodes
            ]);

            const connectedEdges = new Set(
                network.getConnectedEdges(nodeId)
            );

            const nodeUpdates: Node[] = [];
            const edgeUpdates: Edge[] = [];

            nodes.forEach((node) => {

                if (!node?.id) return;

                const nodeIdStr = node.id.toString();

                const isActive = connectedSet.has(nodeIdStr);

                nodeUpdates.push({
                    ...node,
                    hidden: !isActive
                });

            });

            edges.forEach((edge) => {

                const isActive = connectedEdges.has(edge.id as any);

                edgeUpdates.push({
                    ...edge,
                    hidden: !isActive
                });

            });

            nodes.update(nodeUpdates);
            edges.update(edgeUpdates);
        };

        const resetGraph = () => {

            const nodeReset: Node[] = [];
            const edgeReset: Edge[] = [];

            nodes.forEach((node) => {

                nodeReset.push({
                    ...node,
                    hidden: false
                });

            });

            edges.forEach((edge) => {

                edgeReset.push({
                    ...edge,
                    hidden: false
                });

            });

            nodes.update(nodeReset);
            edges.update(edgeReset);
        };

        // hover highlight
        network.on('hoverNode', (params) => {

            if (pinnedNodeId) return;

            highlightNode(params.node.toString());

        });

        // hover 해제
        network.on('blurNode', () => {

            if (pinnedNodeId) return;

            resetGraph();

        });

        // 클릭 pin
        network.on('click', (params) => {

            if (params.nodes.length) {

                const nodeId = params.nodes[0].toString();

                pinnedNodeId = nodeId;

                highlightNode(nodeId);

            } else {

                pinnedNodeId = null;

                resetGraph();
            }

        });

    }

    // async onSettings() {
    //     if (!this.session) { return; }

    //     this.isMenuOpen = false;
    //     _log('설정 클릭');

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
        if (index == 0) { return; }
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



    //////////////////////////////////////////////////////////////////////
    // menu

    openGraphMenu(event: MouseEvent) {
        event.stopPropagation();
        this.isMenuOpen = !this.isMenuOpen;
    }

    // 화면 아무 곳이나 클릭 시 닫힘
    @HostListener('document:click')
    closeAllOverlays() {
        this.isMenuOpen = false;
        this.isDisconnectConfirmOpen = false;
        this.isLogoutConfirmOpen = false;
    }

    async onClickGenerateNotionNoteKMDataBatch() {
        this.isMenuOpen = false;
        this.state = 'graph';

        this.showToast('AI 키워드 추출 작업을 시작했습니다.', 3000);

        setTimeout(() => {
            this.showToast('키워드 추출이 진행 중입니다. 한 번에 최대 5개의 노트를 처리하며 약 5분 정도 소요됩니다.', 3000);

            setTimeout(() => {
                this.showToast('키워드 추출이 완료되면 그래프가 자동으로 업데이트됩니다.', 3000);
            }, 4000);
        }, 4000);

        if (!this.userId) return;
        await this.userService.generateNotionNoteKMDataBatch(this.userId);
    }

    onClickSelectGraphType(graphType: string) {
        this.isMenuOpen = false;
        this.currGraphType = graphType;
        this.loadGraph(graphType);
    }


    onClickSettings() {
        this.isMenuOpen = false;
        // const baseUrl = window.location.origin;
        // const serviceName = 'secondbrain';
        // const setupPath = 'connect';

        // const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encrypted)}`;
        // window.open(url, '_blank');
    }

    onClickReloadGraph() {
        this.isMenuOpen = false;
        this.state = 'graph';
        setTimeout(() => {
            this.loadGraph(this.currGraphType);
        }, 1);
    }

    // notion 과 연결 끊기 
    onClickAPIDisconnect() {
        this.isMenuOpen = false;
        this.isDisconnectConfirmOpen = true; // 여기서 컨펌 오픈  
    }

    // 연결 끊기
    async confirmDisconnect() {
        if (!this.userId) return;

        this.isDisconnectConfirmOpen = false;
        this.email = '';
        this.initStateData();

        await UserService.removeSecondBrainIntegration(this.userId);

        if (this.isWidgetMode) {
            UserService.clearLocalSession(this.userId);
        }
        this.state = 'connect-button';
    }

    // 이 장치에서만 나가기 
    onClickLogout() {
        this.isMenuOpen = false;
        this.isLogoutConfirmOpen = true; // 여기서 컨펌 오픈          
    }

    confirmLogout() {
        if (!this.isWidgetMode || !this.userId) return;

        this.isLogoutConfirmOpen = false;
        this.state = 'connect-button';
        this.email = '';
        this.initStateData();

        UserService.clearLocalSession(this.userId);
    }

    cancelConfirm() {
        this.isDisconnectConfirmOpen = false;
        this.isLogoutConfirmOpen = false;
    }

    ////////////////////////////////////////////////////////

    copyUrl() {
        if (!this.clientUrl) return;
        this.isCopied = true;
        setTimeout(() => {
            this.isCopied = false;
        }, 3000);

        const input = document.createElement("input");
        input.value = this.clientUrl;
        document.body.appendChild(input);
        input.select();
        try {
            document.execCommand("copy");
        } catch (err) {
            console.error("복사 실패", err);
        }
        document.body.removeChild(input);
    }

    ////////////////////////////////////////////////////////

}

// 연결 해제, 설정, 