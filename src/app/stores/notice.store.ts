import { Injectable } from "@angular/core";
import { FBOrderDirection } from "src/lib/fb-noteapi/cf-fb-store-api";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { AppMember, MemberStore } from './member.store';
import { _flog, _log, _valid } from 'src/lib/cf-common/cf-common';
import { NoticeType } from 'src/lib/fb-noteapi/cf-noteapi';
import { AppIds } from '../note-platform.config';

export enum EventNoticeIds {
    newSkin = 'newSkin',
    reqeustReview = 'reqeustReview'
}

export enum NoticeCategory {
    public = 'public',
    myActivity = 'myActivity',
    tip = 'tip'
}

// export enum NoticeType {
//     update = 'update',          // 업데이트 알림
//     diary = 'diary',            // 일기 쓰기 알림
//     gift = 'gift',              // 회원 혜택
//     event = 'event',            // 이벤트
//     operation = 'operation',    // 운영공지
//     product = 'product'         // 새상품
// }

export interface AppNotice {
    _key: string,
    category: NoticeCategory,
    date: string,
    detail: string,
    tags: Array<string>
    text: string,
    title: string,
    type: string,
    onlyPremium?: boolean;
    isShow?: boolean;
}

export let NoticeCategoryTitle = {
    'public': '새소식',
    'myActivity': '내 활동',
    'tip': 'Tips'
}

export interface AppEventNotice {
    _key: string,
    id: string,
    title: string,
    isShow: boolean;
    url?: string;    
    tags?: Array<string>;
}

@Injectable()
export class NoticeStore extends AppBaseStore {
    constructor(public memberStore: MemberStore) {
        super();
    }

    async list(appId:string, category: NoticeCategory, isPremiumMember: boolean, type?: NoticeType, lastDocRef: any = null) {
        _flog(this.list, arguments);
        let useCache: boolean = true;
        let filters: any = { tags: [appId], category: category };
        if (type !== undefined) {
            filters['type'] = type;
        }
        let list: Array<AppNotice> = await this._api.listByFilter('AppNotice', filters, false, useCache, useCache, 'date', FBOrderDirection.desc, 100);
        _log('NoticeStore:list list =>', list);

        // onlyPremium
        list = list.filter(item => item.isShow !== false);
        list = isPremiumMember ? list : list.filter(item => !item.onlyPremium);
        return list;
    }
    // async _getLastCheckedDate(appId: string, userId: string) {
    //     let member = await this._api.getByFilter('AppMember', {userId: userId});
    //     // update date
    //     return member.lastCheckedNoticeDate[appId];
    // }

    async updateLastCheckedDate(appId: string, category: NoticeCategory, date: string, userId: string) {
        _flog(this.updateLastCheckedDate, arguments);
        // get member
        let member = await this._api.getByFilter('AppMember', {userId: userId});
        if (!member.lastCheckedNoticeDate) {
            member.lastCheckedNoticeDate = {};
        }
        if (!member.lastCheckedNoticeDate[appId]) {
            member.lastCheckedNoticeDate[appId] = {};
        }

        // update date
        member.lastCheckedNoticeDate[appId][category] = date;

        // write
        this._api.update('AppMember', (member as AppMember)._key, { lastCheckedNoticeDate: member.lastCheckedNoticeDate });
        
    }

    async hasNewNotice(member: AppMember, appId: string, category: NoticeCategory) {
        _flog(this.hasNewNotice, arguments);
        
        // limit 1
        let list: Array<AppNotice> = await this._api.listByFilter('AppNotice', { tags: [appId] }, false, true, true, 'date', 
            FBOrderDirection.desc, 1);
        _log('hasNewNotice list =>', list);
        if (!list || list.length == 0) { return false; }
        
        let notice: AppNotice = list[0];
        let lastDate = notice.date;

        if (!member.lastCheckedNoticeDate || !member.lastCheckedNoticeDate[appId] || 
            !member.lastCheckedNoticeDate[appId][category]) {
            _log('hasNewNotice member =>', member);
            return true;
        }
        
        let userLastDate = member.lastCheckedNoticeDate[appId][category];
        _log('hasNewNotice userLastDate =>', userLastDate);
        let result;
        try {            
            const userDate = new Date(userLastDate.replace(/\./g, '-'));
            const _lastDate = new Date(lastDate.replace(/\./g, '-'));
            result = userDate < _lastDate;
            _log('hasNewNotice userLastDate, lastDate, result =>', userLastDate, lastDate, result);
        } catch(e) {
            _valid(false);
            result = true;
            _log('hasNewNotice:fail result =>', result);
        }
        return result;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 #event noti                                */
    /* -------------------------------------------------------------------------- */

    // 최근 1개를 대상으로 함
    async getEventNotice(member: AppMember, appId: AppIds) {
        _flog(this.getEventNotice, arguments);
        let list: Array<AppEventNotice> = await this._api.listByFilter('AppEventNotice', { tags: [appId] }, false, false, false, 'registDate', FBOrderDirection.desc, 100);
        _log('getEventNotice list =>', list);
        if (!list || list.length == 0) { return undefined; }

        // 안읽은 것만 필터링
        let notice = list.filter((_notice) => (!member || !member.isReadEventNotice || !member.isReadEventNotice[_notice.id]) || !member.isReadEventNotice[_notice.id][appId]);
        _log('getEventNotice notice =>', notice);        
        //_valid(notice.length > 0);
        return notice[0];
    }

    async doneEventNotice(eventId: EventNoticeIds, member: AppMember, appId: AppIds) {
        _flog(this.doneEventNotice, arguments);
        try {
            if (!member.isReadEventNotice) {
                member.isReadEventNotice = {};
            }
            if (!member.isReadEventNotice[eventId]) {
                member.isReadEventNotice[eventId] = {};
            }
            // 그림달력 migration
            if (member.isReadEventNotice[eventId] === true) {
                member.isReadEventNotice[eventId] = {
                    'drawingcalendar': true
                };
            }
            member.isReadEventNotice[eventId][appId] = true;
        } catch(e) {
            _log('doneEventNotice e =>', e);            
        }
        
        return this.memberStore.update(member);
    }

    async doneReqeustReview(member: AppMember, appId: AppIds) {
        _flog(this.doneReqeustReview, arguments);
        if (!member.isDoneReqeustReview) {
            member.isDoneReqeustReview = {};
        }
        member.isDoneReqeustReview[appId] = true;
        return this.memberStore.update(member);
    }

    isAvailableEventNotice(eventId: EventNoticeIds, member: AppMember, appId: AppIds) {
        return member.isReadEventNotice && member.isReadEventNotice[eventId] ? !member.isReadEventNotice[eventId][appId] : true;
    }

    isAvailableRequestReview(member: AppMember, appId: AppIds) {
        _flog(this.isAvailableRequestReview, arguments);
        return member.isDoneReqeustReview ? !member.isDoneReqeustReview[appId] : true;
    }
}