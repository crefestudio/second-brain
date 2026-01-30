import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { _flog, _log, _valid } from 'src/lib/cf-common/cf-common';

// firebase
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PDFPageFormat } from '../note-platform.config';
import { AppLogStore } from '../stores/log.store';

export const FBFunctionsRegion = 'us-central1';
//export const FBFunctionsRegion = 'asia-northeast3';


// const supportedFormats = ["A0", "A1", "A2", "A3", "A4", "A5", "letter", "legal", "tabloid"];


@Injectable()
export class FBFunctionsService {
    private _app: any;
    constructor(
        private appLogStore: AppLogStore,
    ) {
        _log('FBAuthService::constructor')
        this._app = initializeApp(environment.firebaseConfig);

    }

    private async _call(functionName: string, params: any) {
        const app = initializeApp(environment.firebaseConfig);
        const functions = getFunctions(app, FBFunctionsRegion);
        const func = httpsCallable(functions, functionName);
        _valid(func);
        let resp;
        let result: any = {};
        try {
            resp = await func(params);
            result = (resp.data) as any;
        } catch(e: any) {
            _log('FBFunctionsService::_call firebase function call error', e);
            const errorCode = e.code || 'unknown';
            const message = this.getFriendlyErrorMessage(errorCode);
            console.error(`Firebase 함수 호출 오류 [${errorCode}]: ${message}`, e);
            // 필요 시 사용자에게 보여줄 메시지를 포함해 에러 throw
            this.appLogStore.log('userId', this._call.name, e);
            throw new Error(e);
        }
        return result;
    }

    private getFriendlyErrorMessage(code: string): string {
        switch (code) {
            case 'functions/deadline-exceeded':
                return '응답 시간이 초과되었습니다. 다시 시도해 주세요.';
            case 'functions/unavailable':
                return '서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.';
            case 'functions/permission-denied':
                return '권한이 없습니다. 로그인 상태를 확인해 주세요.';
            case 'functions/not-found':
                return '요청하신 리소스를 찾을 수 없습니다.';
            case 'functions/internal':
                return '처리 중 알 수 없는 오류가 발생했습니다.';
            case 'functions/invalid-argument':
                return '요청한 값이 올바르지 않습니다. 입력 내용을 확인해 주세요.';
            case 'functions/unauthenticated':
                return '인증되지 않은 사용자입니다. 로그인 후 이용해 주세요.';
            default:
                return '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        }
    }

    async listPublicPageOfNote(params: any) {
        return this._call('listPublicPageOfNote', params);
    }

    async generatePdf(htmlDocs: Array<string>, fileName: string, userId: string, width: number, height: number, pageFormat: PDFPageFormat) {
        const params = {
            htmlDocs: htmlDocs,
            format: pageFormat,
            width: width,
            height: height,
            fileName: fileName,
            userId: userId
        };
        return this._call('generatePdf', params);
    }
}