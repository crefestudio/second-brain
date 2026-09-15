import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../../../services/auth.service';
import { _log } from '../../../../../../../lib/cf-common/cf-common';

interface CustomProduct {
    id: string;
    title: string;
    icon: string;
    description: string;
    price: string;
    premium?: boolean;
    categories: string[];
    badge?: 'NEW' | '예정';
    liked?: boolean;
}

@Component({
    selector: 'app-lifeup-customizing',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lifeup-customizing.component.html',
    styleUrl: './lifeup-customizing.component.scss'
})
export class LifeupCustomizingComponent implements OnInit {
    isLoading = true;
    memberUid: string = '';
    userId: string = '';
    kakaoUserId: string = '';
    notionAccessToken: string = '';

    selectedCategory = '전체';
    selectedProduct: CustomProduct | null = null;

    categories = ['전체', '라이프업', '자동화', '노션'];

    products: CustomProduct[] = [
        {
            id: 'lifeup-consulting',
            title: '라이프업 업무 활용 상담',
            icon: '💬',
            description: '라이프업을 내 업무 방식에 맞게 활용하는 방법을 함께 찾아드립니다.',
            price: '프리미엄 · 크레딧 사용',
            premium: true,
            categories: ['라이프업']
        },
        {
            id: 'project-template',
            title: '프로젝트 템플릿',
            icon: '📋',
            description: '내 프로젝트에 맞는 관리 구조와 템플릿을 만들어드립니다.',
            price: '프리미엄 · 크레딧 사용',
            premium: true,
            categories: ['라이프업', '노션']
        },
        {
            id: 'task-template',
            title: '할일 템플릿',
            icon: '✅',
            description: '나에게 맞는 할일 관리 방식으로 라이프업을 커스터마이징합니다.',
            price: '프리미엄 · 크레딧 사용',
            premium: true,
            categories: ['라이프업', '노션']
        },
        {
            id: 'area',
            title: '영역 (Area)',
            icon: '🗂️',
            description: '라이프업에 새로운 영역을 추가하거나 기존 영역을 변경합니다.',
            price: '프리미엄 · 크레딧 사용',
            premium: true,
            categories: ['라이프업']
        },
        {
            id: 'today-report-mail',
            title: '투데이 리포트 메일',
            icon: '📬',
            description: '라이프업에 기록한 내용을 매일 아침 메일로 받아보세요.',
            price: '1H 크레딧 + 커스텀 책정',
            categories: ['라이프업', '자동화'],
            badge: 'NEW'
        },
        {
            id: 'today-report-kakao',
            title: '투데이 리포트 카톡',
            icon: '💬',
            description: '매일 아침 라이프업의 주요 내용을 카카오톡으로 받아보세요.',
            price: '1H 크레딧 + 커스텀 책정',
            categories: ['라이프업', '자동화'],
            badge: '예정'
        },
        {
            id: 'widget',
            title: '위젯',
            icon: '🧩',
            description: '라이프업에 필요한 새로운 기능이나 위젯을 만들어드립니다.',
            price: '신청 후 비용 안내',
            categories: ['라이프업', '노션']
        },
        {
            id: 'automation',
            title: '업무 자동화',
            icon: '⚙️',
            description: '반복되는 업무를 줄일 수 있도록 노션과 서비스를 연결하고 자동화합니다.',
            price: '신청 후 비용 안내',
            categories: ['자동화', '노션']
        },
        {
            id: 'notion-template',
            title: '노션 템플릿 제작',
            icon: '📐',
            description: '원하는 목적과 사용 방식에 맞춰 나만의 노션 템플릿을 제작합니다.',
            price: '신청 후 비용 안내',
            categories: ['노션']
        },
        {
            id: 'notion-system',
            title: '노션 업무 시스템 상담',
            icon: '🧠',
            description: '업무 방식을 살펴보고 노션으로 관리하는 방법을 함께 설계합니다.',
            price: '신청 후 비용 안내',
            categories: ['노션']
        },
        {
            id: 'notion-problem',
            title: '노션 관련 문제 의뢰',
            icon: '🛠️',
            description: '수식, 데이터베이스, 관계형 등 노션에서 해결하기 어려운 문제를 도와드립니다.',
            price: '신청 후 비용 안내',
            categories: ['노션']
        },
        {
            id: 'free-request',
            title: '자유 요청',
            icon: '💡',
            description: '위 서비스에 없는 것도 괜찮습니다. 원하는 것을 자유롭게 요청해주세요.',
            price: '신청 후 비용 안내',
            categories: ['라이프업', '자동화', '노션']
        }
    ];

    constructor(private authService: AuthService) {
    }

    async ngOnInit() {
        try {
            await this.initData();
        } finally {
            this.isLoading = false;
        }
    }

    async initData() {
        await this.updateSession();
    }

    async updateSession() {
        await this.authService.updateSession();

        this.memberUid = this.authService.getMemberUid();
        this.userId = this.authService.getUserId();
        this.kakaoUserId = this.authService.getKakaoUserId();
        this.notionAccessToken = this.authService.getNotionAccessToken();

        _log(
            'updateSession memberUid, userId, kakaoUserId, notionAccessToken =>',
            this.memberUid,
            this.userId,
            this.kakaoUserId,
            this.notionAccessToken
        );
    }

    get filteredProducts() {
        if (this.selectedCategory === '전체') {
            return this.products;
        }

        return this.products.filter(product =>
            product.categories.includes(this.selectedCategory)
        );
    }

    selectCategory(category: string) {
        this.selectedCategory = category;
    }

    openProduct(product: CustomProduct) {
        this.selectedProduct = product;
        document.body.style.overflow = 'hidden';
    }

    closeProduct() {
        this.selectedProduct = null;
        document.body.style.overflow = '';
    }

    toggleLike(event: MouseEvent, product: CustomProduct) {
        event.stopPropagation();
        product.liked = !product.liked;
    }

    applyProduct() {
        if (!this.selectedProduct) {
            return;
        }

        console.log('상품 신청:', this.selectedProduct.id);
    }
}