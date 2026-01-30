import { Injectable } from '@angular/core'; 
import { _flog, _log, _slog, _valid } from 'src/lib/cf-common/cf-common';

@Injectable()
export class CFTransactionService {
    private _transactions: any = {};
    private _transactionTimers: any = {};
    private _transactionExpiredTimes: any = {};

    constructor() {
        this._transactions = {};
    }

    public start(id: string, expiredTime: number =  10000) {
        // 같은 아이디로 동시에 프로세스를 진행할 수 없음
        if (this._transactions[id]) {
            _log('CFTransactionService::start drop id =>', id);
            return false;
        }
        
        this._transactions[id] = true;
        this._transactionExpiredTimes[id] = expiredTime;

        this._transactionTimers[id] = setTimeout(() => {
            _valid(this._transactions[id] == false, '내부오류: 비정상적인 transaction exit id => ' + id);
            this._transactions[id] = false;
        }, this._transactionExpiredTimes[id]);
        _log('CFTransactionService::start id, expiredTime, _transactions =>', id, expiredTime, this._transactions);
        return true;
    }
    
    public end(id: string) {
        this._transactions[id] = false;
        if (this._transactionTimers[id]) {
            clearTimeout(this._transactionTimers[id]);
        }
        _log('CFTransactionService::end id, _transactions =>', id, this._transactions);
    }

    public isIng(id?: string) {
        let isIng: boolean = false; 
        if (id) {
            isIng = this._transactions[id];
        } else {
            // 전체에서 체크하기, 하나라도 true면 true
            for(let key of Object.keys(this._transactions)) {
                if (this._transactions[key]) { isIng = true; break; }
            }
        }  
        //_log('CFTransactionService::isIng id, isIng, _transactions =>', id, isIng, this._transactions);
        if (isIng) {
            _log('CFTransactionService::isIng id, transactions =>', id, this._transactions);
        }
        return isIng;
    }
}