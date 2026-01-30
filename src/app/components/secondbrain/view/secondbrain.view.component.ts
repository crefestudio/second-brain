import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';
import { NotionService } from '../../../services/notion.service';
//import { DataSet, Network, Node, Edge } from 'vis-network/standalone';

import { NACommonService } from '../../../services/common.service';


const NotionLifeUpConnedtKey = "NotionLifeUpConnedtKey";

@Component({
    selector: 'app-secondbrain-view',
    standalone: true,  
    templateUrl: './secondbrain.view.component.html',
    imports: [ CommonModule, FormsModule],
    styleUrls: ['./secondbrain.view.component.css']
})
export class SecondBrainViewComponent implements AfterViewInit {
    @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;
    
    state: string = 'connect'; // ready -> phoneNumber -> connectKey
    phoneNumber: string = '';
    connectKey: string | null = null;

    databaseData: any;
    private config = inject<AppConfig>(APP_CONFIG);

    
    inputValue = '';
 
    constructor(private notionService: NotionService, private router: Router) { }

    async ngOnInit() {
        this.connectKey = localStorage.getItem(NotionLifeUpConnedtKey);

        // try {
        //     this.databaseData = await this.notionService.getDatabase();
        //     console.log(this.databaseData);
        // } catch (err) {
        //     console.error(err);
        // }
    }

    // Connect 버튼 클릭
    onSubmitConnect() {
        this.state = 'phoneNumber';
    }

    // 뒤로가기 클릭 시 connect 화면으로 이동
    // goBackToConnect() {
    //     this.state = 'ready';
    // }

    goBackState() {
        if (this.state == 'phoneNumber') {
            this.phoneNumber = '';
            this.state = 'connect';
        } else if (this.state == 'connectKey') {
            this.connectKey ='';
            this.state = 'phoneNumber';
        }
    }

    // 입력 후 확인
    saveKey() {
        // if(this.inputValue.trim()) {
        // localStorage.setItem(NotionLifeupTemplateKey, this.inputValue.trim());
        // this.templateKey = this.inputValue.trim();
        // this.showConnectInput = false;
        // // 이후 그래프 렌더 로직 호출 가능
        // }
    }

    goToConnectPage() {
        // Angular 라우터로 이동
        this.router.navigate(['/secondbrain/connect']);
    }

    formatPhoneNumber() {
        if (!this.phoneNumber) return;

        // 숫자만 남김
        let digits = this.phoneNumber.replace(/\D/g, '');

        // 최대 11자리 제한
        if (digits.length > 11) {
            digits = digits.slice(0, 11);
        }

        if (digits.length <= 3) {
            this.phoneNumber = digits;
        } else if (digits.length <= 7) {
            this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        } else {
            this.phoneNumber = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
        }
    }



    ngAfterViewInit() {
        // // --- 노드 데이터 ---
        // const nodesArray: Node[] = [
        // { id: 1, label: "Jean Valjean", group: "main" },
        // { id: 2, label: "Javert", group: "secondary" },
        // { id: 3, label: "Fantine", group: "secondary" },
        // { id: 4, label: "Cosette", group: "main" },
        // { id: 5, label: "Marius", group: "secondary" }
        // ];

        // // --- 엣지 데이터 ---
        // const edgesArray: Edge[] = [
        // { from: 1, to: 2 },
        // { from: 1, to: 3 },
        // { from: 1, to: 4 },
        // { from: 4, to: 5 },
        // { from: 2, to: 3 },
        // ];

        // // DataSet으로 변환
        // const nodes = new DataSet<Node>(nodesArray);
        // const edges = new DataSet<Edge>(edgesArray);

        // const data = { nodes, edges };

        // // --- 옵션 설정 ---
        // const options = {
        //    nodes: {
        //         shape: 'dot',
        //         size: 8,
        //         font: { size: 11, color: '#EEEEEE' },  // 다크모드 글자색
        //         color: {
        //             // background: '#00CFFF',   // 기본 노드 색상
        //             // border: '#00CFFF',
        //             highlight: '#007AFF',    // 클릭/선택 시 Apple 블루
        //             hover: '#393E46'         // 마우스 올렸을 때
        //         }
        //     },
        //     edges: {
        //         color: '#393E46',             // 다크톤 엣지
        //         smooth: {
        //             enabled: true,
        //             type: 'dynamic',
        //             roundness: 0.5
        //         }
        //     },
        //     groups: {
        //         main: { 
        //             color: { 
        //                 background: '#00ADB5', 
        //                 border: '#00ADB5' 
        //             } 
        //         },
        //         secondary: { 
        //             color: { 
        //                 background: '#555B66', 
        //                 border: '#555B66' 
        //             } 
        //         }
        //     },       
        //     physics: {
        //         enabled: true,
        //         stabilization: false,
        //         barnesHut: {
        //         gravitationalConstant: -3000,
        //         springLength: 150,
        //         springConstant: 0.1
        //         }
        //     },
            
        //     interaction: {
        //         hover: true,
        //         tooltipDelay: 200
        //     }
        // };

        // // --- 네트워크 생성 ---
        // new Network(this.graphContainer.nativeElement, data, options);
    }
    
    openSettings() {
        const baseUrl = window.location.origin;
        const serviceName = 'secondbrain';
        const setupPath = 'setup';
        const url = `${baseUrl}/${serviceName}/${setupPath}`;
        window.open(url, '_blank'); // 새 탭에서 열기
    }

    async onSubmitPhoneNumber() {
        if (!this.phoneNumber) {
            alert('휴대폰 번호를 입력해주세요.');
            return;
        }

        // 1. 숫자만 추출
        const normalized = this.phoneNumber.replace(/\D/g, '');

        // 2. 전화번호 검증
        const isValid = /^010\d{8}$/.test(normalized);
        if (!isValid) {
            alert('휴대폰 번호 형식이 올바르지 않습니다.');
            return;
        }

        // 3. 암호화
        const encrypted = await NACommonService.encrypt(normalized);

        // 4. URL 이동
        const baseUrl = window.location.origin;
        const serviceName = 'secondbrain';
        const setupPath = 'connect';

        const url = `${baseUrl}/${serviceName}/${setupPath}?token=${encodeURIComponent(encrypted)}`;
        window.open(url, '_blank');

        this.state = 'connectKey'
    }

    // 최종 연결키 입력
    onSubmitConnectKey() {

    }
}
  
