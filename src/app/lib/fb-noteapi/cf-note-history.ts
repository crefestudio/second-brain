import { EventEmitter } from '@angular/core'; 
import { CFHelper, _log, _slog, _valid } from '../cf-common/cf-common'
import { CFNoteAPI, NPPage } from './cf-noteapi'

/*
    외부에서 할일 
        1. 페이지 전환 시 setState 호출
        2. onLoadHistory 받아서 page.add -> del, del -> add, update -> restore

    // add, delete 는 역산이 되니 그대로 저장하는데 
    // objects update는 과거를 저장해야 함

    // load history
    // page add -> page delete
    // page delete -> page add
    // pdate update -> 방금 일어나 object의 행위를 되돌릴 순 없어// 그 행위 !!
*/

export enum NPNoteHistoryAction {
    addPage = 'addPage',
    deletePage = 'deletePage',
    repositionPage = 'repositionPage',
    updatePage = 'updatePage' 
}

export enum NPNoteHistoryObjectAction {
    added = 'added',
    removed = 'removed',
    updated = 'updated',
    updatedObjects = 'updatedObjects',
    erased = 'erased',  // active object 없음
    reorder = 'reorder', // active object 있음 
    //group = 'group'
}

export interface INPNoteHistory {
    action: NPNoteHistoryAction,
    pageNumber: number,
    objectAction?: NPNoteHistoryObjectAction,

    currObject?: any,     // object에 대한 변경 시 데이타
    beforeObject?: any,           
    currPage?: NPPage,     // redo에 필요  
    beforePage?: NPPage,    // undo에 필요

    currObjectKey? : string,

    beforePageNumber?: number // reposition undo/redo
    //activeObjects? : Array<any> // Active Selection 
}

export class CFNoteHistory {
    constructor(
        public api: CFNoteAPI
    ) {

    }
    private _historyUndo: Array<INPNoteHistory> = [];
    private _historyRedo: Array<INPNoteHistory> = [];
    
    // state
    // private _beforePage?: NPPage;
    // private _beforeNumber: number = 0;

    public onUndoHistory = new EventEmitter<INPNoteHistory>();
    public onRedoHistory = new EventEmitter<INPNoteHistory>();

    //private _isStart: boolean = false;

    // start() {
    //     this.clear();
    //     //this.setState(pageNumber,  page);
    //     //this._isStart = true;
    // }

    clear() {
        this._historyUndo = [];
        this._historyRedo = [];
        // this._beforePage = undefined;
        // this._beforeNumber = 0;
    }

    // 유저의 페이지 전환 시(페이지가 render될 떄) 호출됨 / 가장 마지막 상태값을 가지고 있음
    // 페이지가 갱신되면 호출 됨 
    // setState(pageNumber: number, page: NPPage) {
    //     // this._beforeNumber = pageNumber;
    //     // this._beforePage =  CFHelper.object.clone(page); // 이 시점에 복사를 해서 이후 값 변경을 방지함
    //     // _log('CFNoteHistory::setState pageNumber, objects =>', pageNumber, this._currPage?.objects.length, this._currPage);
    // }

    // 이렇게 복잡한건 결국 데이타의 양을 최소화 하기 위해서 임 !!
    public push(action: NPNoteHistoryAction, pageNumber: number, objectAction?:NPNoteHistoryObjectAction, 
            currObject?: any, beforePage?: NPPage, currPage?: NPPage, beforePageNumber?: number) {
        _log('_pushHistory action, objectAction, currObject, currPage, beforePage =>', action, objectAction, currObject, currPage, beforePage);
        let history: INPNoteHistory = {
            action: action,
            objectAction: objectAction,
            pageNumber: pageNumber,
            beforePageNumber: beforePageNumber
        }

        if (action == NPNoteHistoryAction.updatePage) {
            _valid(objectAction);

            // active selection이면 activeObjects를 저장 / 수정일때만 발생함 / add, remove는 그냥 개별 object로 처리 하고 있음 
            // if (history.objectAction == NPNoteHistoryObjectAction.ativeSelection) {
            //     history.activeObjects = CFHelper.json.deepClone(activeObjects);
            // }

            // 현재 object 넣기
            if (objectAction == NPNoteHistoryObjectAction.added || 
                objectAction == NPNoteHistoryObjectAction.removed || 
                objectAction == NPNoteHistoryObjectAction.updated) {
                _valid(currObject);
                history.currObject = CFHelper.json.deepClone(currObject);
            }
            
            // beforeObject
            if (objectAction == NPNoteHistoryObjectAction.updated) {    // 이전 object, 현재 object, 
                _log('push currObject, beforePage, currPage =>', currObject, beforePage, currPage);
                _valid(currObject && beforePage);
                if (!beforePage || !currObject) { return; }     
                _valid(currObject._key);

                let beforeObject = beforePage.objects.find((item: any) => item._key == currObject._key);
                _valid(beforeObject);
                history.beforeObject = CFHelper.json.deepClone(beforeObject);
            }

            // 여러개 currObject, beforeObject
            if ( objectAction == NPNoteHistoryObjectAction.updatedObjects ||
                 objectAction == NPNoteHistoryObjectAction.erased ||
                 objectAction == NPNoteHistoryObjectAction.reorder) {
                _log('push currObject, beforePage, currPage =>', currObject, beforePage, currPage);
                _valid(currObject && beforePage);
                if (!beforePage || !currObject) { return; }  

                // before objects
                let beforeObjects = [];
                for(let object of currObject) {
                    let beforeObject = beforePage.objects.find((_object: any) => _object._key == object._key);
                    _valid(beforeObject);
                    beforeObjects.push(CFHelper.json.deepClone(beforeObject));
                }
                history.beforeObject = beforeObjects;   // beforeObject에 이전 selection objects를 저장한다.

                // curr objects
                let currObjects = [];
                for(let object of currObject) {
                    currObjects.push(CFHelper.json.deepClone(object));
                }
                history.currObject = currObjects;   // currObject에 현재 selection objects를 저장한다.
            }

            // currPage, beforePage
            if ( objectAction == NPNoteHistoryObjectAction.reorder ||
                 objectAction == NPNoteHistoryObjectAction.removed) {
                _valid(currPage && beforePage);
                if (!currPage || !beforePage) { return; }
                history.currPage = this.api.clonePage(currPage);
                history.beforePage = this.api.clonePage(beforePage);
                _log('_pushHistory::erasing history =>', history);
            }           
        } else if (action == NPNoteHistoryAction.addPage || action == NPNoteHistoryAction.deletePage || action == NPNoteHistoryAction.repositionPage) {
            _valid(currPage);
            if (currPage) {
                history.currPage = this.api.clonePage(currPage);
                _log('CFNoteHistory::push::addPage history.currPage, history.currPage.objects =>', history.currPage, history.currPage.objects.length);
            }
        } 
        // else if (action == NPNoteHistoryAction.deletePage) {
        //     _valid(currPage);
        //     // 복사
        //     if (currPage) {
        //         history.currPage = this.api.clonePage(currPage);
        //         _log('CFNoteHistory::push::deletePage history.currPage, history.currPage.objects =>', history.currPage, history.currPage.objects.length);
        //     }
        // }

        // undo에 넣고
        this._historyUndo.push(history);
        _log('CFNoteHistory::push _historyUndo =>', this._historyUndo);
       
        // 새로운 undo가 들어오면 리두는 끝
        this._historyRedo = [];
    }

    copyHistory(history: INPNoteHistory) {  
        let _history: INPNoteHistory = CFHelper.json.deepClone(history);
        if (history.beforePage) {
            _history.beforePage = this.api.clonePage(history.beforePage);
        }
        if (history.currPage) {
            _history.currPage = this.api.clonePage(history.currPage);
        }
        return _history;
    }

    // push(history: INPNoteHistory) {
    //     if (history.action == NPNoteHistoryAction.updatePage) {
    //         _log('CFNoteHistory::push _currPage =>', this._currPage);
    //         _valid(this._currPage) 
    //         if (!this._currPage) { return; }
      
    //         if (history.objectAction == NPNoteHistoryObjectAction.updated) {
    //             history.beforeObject = this._currPage.objects.find((item: any) => item.key == history.object.key); 
    //         } else if (history.objectAction == NPNoteHistoryObjectAction.objects) {
    //             history.beforePage = this._currPage;
    //         }
    //         if (history.page) {
    //             this.setState(history.pageNumber, history.page);
    //         }
    //     }

    //     // undo에 넣고
    //     this._historyUndo.push(history);
    //     _log('CFNoteHistory::push _historyUndo =>', this._historyUndo);
       
    //     // 새로운 undo가 들어오면 리두는 끝
    //     this._historyRedo = [];
    // }

    // 현재 화면 상태로 넣어줌
    // private _pushCurrState(history: INPNoteHistory, list: Array<INPNoteHistory>, isRedo: boolean = false) {
    //     _valid(this._currPage);
    //     // if (!this._isStart) { 
    //     //     _log('CFNoteHistory::push 히스토리가 중단되어 저장 안하고 pass함')
    //     //     return; 
    //     // }
        
    //     // 페이지 수정 /삭제는 그대로 저장 / 페이지 수정은 이전 상태를 저장해야 함
    //     if (history.action == NPNoteHistoryAction.updatePage) {
    //         //_valid(this._currPageNumber == history.pageNumber);
    //         _valid(this._currPage);
    //         if (this._currPage /*&& this._currPageNumber == history.pageNumber*/) {
    //             history.page = this._currPage[history.pageNumber];
    //         }
    //     }
    //     list.push(history);
    //     if (isRedo) {
    //         _log('CFNoteHistory::_push::redo pageNumber, objects =>', history.pageNumber, history.page.objects.length);
    //     } else {
    //         _log('CFNoteHistory::_push::save pageNumber, objects =>', history.pageNumber, history.page.objects.length);
    //     }

    // }

    async undo() {
        if (!this.enableUndo()) { return; }

        let history = this._historyUndo.pop();
        // 데이타를 복사해서 보내지 않으면 page적용되고 값이 바뀌어 버림
        _valid(history);
        if (!history) { return; }

        this._historyRedo.push(history);
        let _history = this.copyHistory(history);

        _log('CFNoteHistory::undo1 undo, redo, history =>', this._historyUndo, this._historyRedo[0].currPage?.objects.length, _history.currPage?.objects.length, history.currPage?.objects.length);
        this.onUndoHistory.emit(_history);   // undo
        _log('CFNoteHistory::undo2 undo, redo, history =>', this._historyUndo, this._historyRedo[0].currPage?.objects.length, _history.currPage?.objects.length, history.currPage?.objects.length);
    }

    async redo() {
        if (!this.enableRedo()) { 
            _log('CFNoteHistory::redo _historyRedo =>', this._historyRedo);
            return; 
        }

        let history = this._historyRedo.pop();
        // 데이타를 복사해서 보내지 않으면 page적용되고 값이 바뀌어 버림
        _valid(history);
        if (!history) { return; }

        this._historyUndo.push(history);
        let _history = this.copyHistory(history);
       
        _log('CFNoteHistory::redo1 undo, redo, history =>', this._historyUndo, this._historyRedo, history);
        this.onRedoHistory.emit(_history);   // redo
        _log('CFNoteHistory::redo2 undo, redo, history =>', this._historyUndo, this._historyRedo, history);
    }

    enableUndo() {
        return this._historyUndo && this._historyUndo.length > 0;
    }

    enableRedo() {
        return this._historyRedo && this._historyRedo.length > 0;
    }

    // private _loadHistory(history: INPNoteHistory) {
    //     _log('CFNoteHistory::_loadHistory pageNumber, objects =>', history.pageNumber, history.page.objects.length);
    //     this.onLoadHistory.emit(history);
    // }
}


// /**
//  * Override the initialize function for the _initHistory();
//  */
// // fabric.Canvas.prototype.initialize = (function(originalFn) {
// //   return function(...args) {
// //     originalFn.call(this, ...args);
// //     this._initHistory();
// //     return this;
// //   };
// // })(fabric.Canvas.prototype.initialize);

// /**
//  * Override the dispose function for the _historyDispose();
//  */
// fabric.Canvas.prototype.dispose = (function (originalFn) {
//     return function (...args) {
//         originalFn.call(this, ...args);
//         this._historyDispose();
//         return this;
//     };
// })(fabric.Canvas.prototype.dispose);

// /**
//  * Returns current state of the string of the canvas
//  */
// fabric.Canvas.prototype._historyNext = function () {
//     return JSON.stringify(this.toDatalessJSON(this.extraProps));
// }

// /**
//  * Returns an object with fabricjs event mappings
//  */
// fabric.Canvas.prototype._historyEvents = function () {
//     return {
//         'object:added': this._historySaveAction,
//         'object:removed': this._historySaveAction,
//         'object:modified': this._historySaveAction,
//         'object:skewing': this._historySaveAction,
//         // toto : 지우개 undo를 위해서 추가 함 
//         'erasing:end': this._historySaveAction,
//     }
// }

// /**
//  * Initialization of the plugin
//  */
// fabric.Canvas.prototype.initHistory = function () {
//     this.historyUndo = [];
//     this.historyRedo = [];
//     //this.extraProps = ['selectable', 'editable'];
//     this.historyNextState = this._historyNext();  // 현재의 상태, 다음에 저장할 값

//     this._historyDispose();
//     this.on(this._historyEvents());
// }

// /**
//  * Clear undo and redo history stacks
//  */
// fabric.Canvas.prototype.clearHistory = function () {
//     this.historyUndo = [];
//     this.historyRedo = [];
//     this.fire('history:clear');
// }

// /**
// * 현재 시점을 기록해두는게 포함 됨
// */
// fabric.Canvas.prototype.startHistory = function () {
//     this._historyDispose();
//     this.on(this._historyEvents());

//     this.historyUndo = [];
//     this.historyRedo = [];
//     //this.extraProps = ['selectable', 'editable'];
//     this.historyNextState = this._historyNext();  // 현재의 상태, 다음에 저장할 값
// }

// fabric.Canvas.prototype.stopHistory = function () {
//     this._historyDispose();
//     this.historyUndo = [];
//     this.historyRedo = [];
// }

// fabric.Canvas.prototype.pushHistory = function () {
//     this._historySaveAction();
// }


// /**
//  * Remove the custom event listeners
//  */
// fabric.Canvas.prototype._historyDispose = function () {
//     this.off(this._historyEvents())
// }

// /**
//  * It pushes the state of the canvas into history stack
//  */
// fabric.Canvas.prototype._historySaveAction = function () {
//     console.log('fabric.Canvas.prototype._historySaveAction historyProcessing =>', this.historyProcessing);
//     if (this.historyProcessing) {
//         return;
//     }

//     //console.log('_historySaveAction this.historyRedo.length ', this.historyRedo.length)

//     // toto : undo중에 새로운 object event 발생 시 redo날림
//     if (this.historyRedo.length > 0) {
//         this.historyRedo = [];
//     }

//     const json = this.historyNextState;
//     this.historyUndo.push(json);
//     console.log('fabric.Canvas.prototype._historySaveAction json =>', json);
//     this.historyNextState = this._historyNext();
//     this.fire('history:append', { json: json });
// }

// fabric.Canvas.prototype.enableUndo = function () {
//     return this.historyUndo && this.historyUndo.length > 0;
// }
// /**
//  * Undo to latest history. 
//  * Pop the latest state of the history. Re-render.
//  * Also, pushes into redo history.
//  */
// fabric.Canvas.prototype.undo = function (callback) {
//     console.log('fabric.Canvas.prototype.undo historyUndo =>', this.historyUndo.length);

//     if (!this.enableUndo()) {
//         return;
//     }
//     // The undo process will render the new states of the objects
//     // Therefore, object:added and object:modified events will triggered again
//     // To ignore those events, we are setting a flag.
//     this.historyProcessing = true;

//     const history = this.historyUndo.pop();

//     if (history) {
//         // var jsonHistory = JSON.parse(history);
//         // console.log('fabric.Canvas.prototype.undo jsonHistory =>', jsonHistory);
//         // if (jsonHistory.objects && jsonHistory.objects.length == 0) {
//         //   alert(history)
//         //   var obj = {"version":"5.2.1","objects":[]};
//         //   this.historyUndo.push(JSON.stringify(obj));
//         //   return;
//         // } 
//         // Push the current state to the redo history
//         this.historyRedo.push(this._historyNext());
//         this.historyNextState = history;
//         this._loadHistory(history, 'history:undo', callback);
//     } else {
//         this.historyProcessing = false;
//     }
// }

// /**
//  * Redo to latest undo history.
//  */

// fabric.Canvas.prototype.enableRedo = function () {
//     return this.historyRedo && this.historyRedo.length > 0;
// }

// fabric.Canvas.prototype.redo = function (callback) {
//     console.log('fabric.Canvas.prototype.redo historyUndo =>', this.historyUndo.length);
//     // The undo process will render the new states of the objects
//     // Therefore, object:added and object:modified events will triggered again
//     // To ignore those events, we are setting a flag.
//     this.historyProcessing = true;
//     const history = this.historyRedo.pop();
//     if (history) {
//         // Every redo action is actually a new action to the undo history
//         this.historyUndo.push(this._historyNext());
//         this.historyNextState = history;
//         this._loadHistory(history, 'history:redo', callback);
//     } else {
//         this.historyProcessing = false;
//     }
// }

// fabric.Canvas.prototype._loadHistory = function (history, event, callback) {
//     var that = this;
//     console.log('fabric.Canvas.prototype._loadHistory history =>', history);

//     this.loadFromJSON(history, function () {
//         that.renderAll();
//         that.fire(event);
//         that.historyProcessing = false;
//         if (callback && typeof callback === 'function') callback();
//     });
// }

