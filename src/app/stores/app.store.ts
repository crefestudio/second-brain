import { Injectable } from "@angular/core";
import { AppBaseStore } from 'src/_note-platform/services/store.service';
import { _log } from 'src/lib/cf-common/cf-common';

/*
    App
        config
            stageUrl
            version
        signupPopup
            contentHrml
            isShow
*/

@Injectable()
export class AppStore extends AppBaseStore {
    constructor() {
        super();
    }
    
    async get(key: string) {
        return this._api.get('App', key);
    }

    async getHolidays() {
        // 데이타 생성 코드
        // let holidays = {   '2024': {     '1': { '1': '새해' },     '2': {       '9': '설날 연휴',       '10': '설날',       '11': '설날 연휴',       '12': '대체공휴일'     },     '3': { '1': '삼일절' },     '5': {       '5': '어린이날',       '6': '대체공휴일',       '15': '부처님 오신 날'     },     '6': { '6': '현충일' },     '8': { '15': '광복절' },     '9': {       '16': '추석 연휴',       '17': '추석',       '18': '추석 연휴'     },     '10': {       '3': '개천절',       '9': '한글날'     },     '12': { '25': '성탄절' }   },   '2025': {     '1': {       '1': '새해',       '28': '설날 연휴',       '29': '설날',       '30': '설날 연휴'     },     '3': {       '1': '삼일절',       '3': '대체공휴일'     },     '5': {       '5': '어린이날, 부처님 오신 날',       '6': '대체공휴일'     },     '6': { '6': '현충일' },     '8': { '15': '광복절' },     '10': {       '3': '개천절',       '5': '추석 연휴',       '6': '추석',       '7': '추석 연휴',       '8': '대체공휴일',       '9': '한글날'     },     '12': { '25': '성탄절' }   },   '2026': {     '1': { '1': '새해' },     '2': {       '16': '설날 연휴',       '17': '설날',       '18': '설날 연휴'     },     '3': {       '1': '삼일절',       '2': '대체공휴일'     },     '5': {       '5': '어린이날',       '8': '부처님 오신 날'     },     '6': { '6': '현충일' },     '8': {       '15': '광복절',       '17': '대체공휴일'     },     '9': {       '24': '추석 연휴',       '25': '추석',       '26': '추석 연휴',       '27': '대체공휴일'     },     '10': {       '3': '개천절',       '5': '대체공휴일',       '9': '한글날'     },     '12': { '25': '성탄절' }   } } 
        // await this._api.set('App', 'holidays', holidays); // for test
        // return {};

        let holidays: any = await this._api.get('App', 'holidays');
        _log('AppStore::getData holidays =>', holidays);
        return holidays;
    }  

    async getVersion() {
        return this._api.get('App', 'version');
    }

    async getSignupPopup() {
        return this._api.get('App', 'signupPopup');
    }
}