import { Injectable } from "@angular/core";
import { _flog, _log, _valid } from "../lib/cf-common/cf-common";
import { AppBaseStore } from '../services/store.service';

export interface PurchaseData {
    transactionId: string;  // 주문번호
    productId: string;     // 구매한 상품
    deviceId: string;    // 구매한 장치 / 유저 계정으로 쓸수 있는 지 판단필요
    appBundleId: string;
}

export class AppMember {
    _key: string = '';
    userId: string = '';
    email: string = '';
    displayName: string = '';
    photoURL?: string; // 현재는 로그인 시 프로바이더의 포토URL을 넣어줌.
    registDate?: string;
    updateDate?: string;
    isDelete: boolean = false; 
    isUserSetProfileImage: boolean = false; 

    signInAppId: string = '';
    lastLoginDate_blank?: string;
    lastLoginDate_drawingdiary?: string;
    lastLoginDate_drawingcalendar?: string;
    lastLoginDate_photocalendar?: string;
    lastLoginDate_journal?: string;
    lastLoginDate_minddiary?: string;
    lastLoginDate_esdiary?: string;
    
    // 상품 구매 정보
    isPremiumMember: Record<string, boolean> = {};  // appId map
    isDoneReqeustReview?: Record<string, boolean> = {};  // appId map : 리뷰 요청이 완료 되었는지, 더이상 요청하지 않음
    purchaseData: Record<string, PurchaseData> = {};
    purchasedProducts: Array<string> = [];

    lastCheckedNoticeDate: Record<string, Record<string, string>> = {}
    isReadEventNotice?: Record<string, any> = {};
}

@Injectable()
export class MemberStore extends AppBaseStore {

    constructor() {
        super();
    }

    async get(userId: string): Promise<AppMember> {
        _valid(userId);
        let resp = await this._api.getByFilter('AppMember', {userId: userId});
        return resp as AppMember;
    }

    create(userId: string, email: string, displayName: string, photoURL?: string, appId: string = '') {
        let member: AppMember = {
            _key: '',
            userId: userId,
            email: email,
            displayName: displayName,
            photoURL: photoURL,
            isPremiumMember: {},    // 프리미엄 여부
            purchaseData: {},       // 구매정보
            purchasedProducts: [],          // 구매내역 필터 
            signInAppId: '',            // 처음 가입한 앱
            isDelete: false,
            isUserSetProfileImage: false,
            lastCheckedNoticeDate: {}
        }
        return this._api.create('AppMember', member);
    }

    update(member: AppMember) {
        return this._api.update('AppMember', member._key, member);
    }

    delete(member: AppMember) {
        return this._api.delete('AppMember', member._key);
    }

    ///////////////////////////////

    // 모바일에서 회원을 바로 삭제할 수 없어서 이렇게 처리함
    async deleteFlag(member: AppMember, isDelete: boolean = true) {
        member.isDelete = isDelete;
        return this._api.update('AppMember', member._key, member);
    }

    // async isDelete(member: AppMember) {
    //     let _member: AppMember = await this._api.get('AppMember', member._key, false);
    //     return _member.isDelete;
    // } 

    public async isExistMemberOfDisplayName(displayName: string): Promise<boolean> {
        let resp = await this._api.getByFilter('AppMember', { displayName: displayName });
        _log('memberStore isExistMemberOfDisplayName resp =>', resp, resp !== undefined);
        return resp !== undefined
    }

    async updateToPremiumMember(member: AppMember, appId: string, purchaseData: PurchaseData) {
        _flog(this.updateToPremiumMember, arguments);
        // isPremiumMember를 true로 넣어준다.
        if (!member.isPremiumMember) {
            member.isPremiumMember = {};
        }
        member.isPremiumMember[appId] = true;
 
        // purchaseData를 넣어준다.
        if (purchaseData && purchaseData.productId) {
            if (!member.purchaseData) {
                member.purchaseData = {};
            }
            member.purchaseData[purchaseData.productId] = purchaseData;

            // 구매내역 필터를 넣어준다.
            if (!member.purchasedProducts) {
                member.purchasedProducts = [];
            }
            let index = member.purchasedProducts.findIndex(value => value == `${purchaseData.productId}_${purchaseData.transactionId}`);
            if (index > -1) {
                _log('이미 구매한 상품')
            } else {
                member.purchasedProducts.push(`${purchaseData.productId}_${purchaseData.transactionId}`);
            }
        }

        return this.update(member);
    }

    async getPurchasedMember(purchaseData: PurchaseData) : Promise<AppMember | null> {
        _flog(this.getPurchasedMember, arguments);
        _valid(purchaseData && purchaseData.productId && purchaseData.transactionId);
        if (!purchaseData || !purchaseData.productId || !purchaseData.transactionId) return null;
        // 필드가 array라면 쿼리도 array여야 함 // _listByFilter 참고
        let member: AppMember = await this._api.getByFilter('AppMember', { 
            purchasedProducts: [`${purchaseData.productId}_${purchaseData.transactionId}`] 
        });
        return member;
    }

    async updateLastLoginDate(member: AppMember, appId: string) {
        let _member = member as any;
        let lastLogin: string = appId == '' ? 'lastLoginDate_blank' : `lastLoginDate_${appId}`;
        _member[lastLogin] = new Date().toISOString();
        _log('updateLastLoginDate _member =>', _member);
        await this.update(_member);
    }
}