import { _log, _valid, isArrayOfStrings, isJSON, CFDate, CFHelper, _flog } from '../cf-common/cf-common';
import {
    collection, addDoc, setDoc, updateDoc, serverTimestamp, getDoc, where, getDocs, query, orderBy,
    limit, doc, deleteDoc,
    QueryDocumentSnapshot
} from "firebase/firestore/lite";
import { environment } from 'src/environments/environment';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';

export enum FBOrderDirection {
    asc = 'asc',
    desc = 'desc'
}

export class CFFBStoreAPI {
    static _self: CFFBStoreAPI;
    public db: any;
    constructor(_db: any) {
        if (_db) {
            this.db = _db;
        }
    }

    static getInstance(db?: any) {
        if (!CFFBStoreAPI._self) {
            _valid(db);
            CFFBStoreAPI._self = new CFFBStoreAPI(db);
        }
        return CFFBStoreAPI._self;
    }

    // 1.key가 없으면 문서를 만들고 _key 값을 넣는다. 
    // 주의) 이미 _key가 있으면 교체 됨
    // 2. 파라미터에 key값을 넣으면 해당 키값으로 문서를 만들고 _key에 key를 부여 한다. 
    // 3. 그냥 _key 필드, registeDate가 필요 없다면 set 함수를 쓰면 됨 
    async create(colPath: string, entity: any, key?: string): Promise<any> {
        try {
            let _data = CFHelper.json.deepClone(entity);
            _data = CFHelper.object.replaceUndefinedWithValue(_data, '');
            let params = {
                ..._data,
                registDate: serverTimestamp(),
                updateDate: serverTimestamp()
            };
            let docRef;
            if (key) {
                docRef = doc(this.db, `${colPath}/${key}`);
                params['_key'] = key;
                await setDoc(docRef, params);
            } else {
                docRef = await addDoc(collection(this.db, colPath), params);
                await updateDoc(docRef, {
                    _key: docRef.id
                });
            }
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                let data = snapshot.data();
                this._convertLocalDate(data);
                _log(`>>>>>>>>>> CFFBStoreAPI::create ${colPath} ${JSON.stringify(entity)}   =>   ${JSON.stringify(data)}`);
                return data;
            } else {
                _log(`>>>>>>>>>> CFFBStoreAPI::create ${colPath} ${JSON.stringify(entity)}   =>   EMPTY`);
                throw new Error();
            }
        } catch (error: any) {
            _log(`>>>>>>>>>> CFFBStoreAPI::create ${colPath} ${JSON.stringify(entity)}   =>   ${error}`);
            //reject(error);
            throw new Error(error);
        }
    }

    async createNode(entityName: string, entity: any): Promise<any> {
        try {
            let docRef = await addDoc(collection(this.db, entityName), {
                ...entity,
                registDate: serverTimestamp(),
                updateDate: serverTimestamp()
            });
            await updateDoc(docRef, {
                _key: docRef.id
            });
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                let data = snapshot.data();
                this._convertLocalDate(data);
                _log(`>>>>>>>>>> CFFBStoreAPI::post ${entityName} ${JSON.stringify(entity)}   =>   ${JSON.stringify(data)}`);
                return data;
            } else {
                _log(`>>>>>>>>>> CFFBStoreAPI::post ${entityName} ${JSON.stringify(entity)}   =>   EMPTY`);
                throw new Error();
            }
        } catch (error: any) {
            _log(`>>>>>>>>>> CFFBStoreAPI::post ${entityName} ${JSON.stringify(entity)}   =>   ${error}`);
            throw new Error(error);
        }
    }

    async get(entityName: string, key: any, userCache: boolean = true): Promise<any> {
        return this.getByPath(`${entityName}/${key}`, userCache, userCache);
    }

    async getByPath(docPath: string, saveCache: boolean = true, useCache: boolean = true, cacheTimeout = 2000) {
        return this._commandProcessWithCache(this._getByPath, 'getByPath', { docPath: docPath }, docPath, saveCache, useCache, cacheTimeout);
    }

    async listByFilter(entityName: string, filters: any, withString: boolean = false, saveCache: boolean = true, useCache: boolean = true,
        orderFieldName?: string | Array<string>, orderDir: FBOrderDirection = FBOrderDirection.desc, _limit: number = 1000, cacheTimeout = 2000): Promise<Array<any>> {

        //    return this._listByFilter(entityName, filters, withString, orderFieldName, orderDir, _limit);
        let params = {
            entityName: entityName,
            filters: filters,
            withString: withString,
            orderFieldName: orderFieldName,
            orderDir: orderDir,
            _limit: _limit,
            //lastDocRef: lastDocRef
        };
        let docKey = `${entityName}:${JSON.stringify(filters)}`;
        return this._commandProcessWithCache(this._listByFilter, 'listByFilter', params, docKey, saveCache, useCache, cacheTimeout);
    }

    private _cache: any = {};
    private _waitPool: any = {};
    private async _commandProcessWithCache(process: any, commandName: string, params: any, docKey: string, saveCache: boolean = true, useCache: boolean = true, cacheTimeout = 2000) {
        if (!this._cache[commandName]) { this._cache[commandName] = {} }
        if (!this._waitPool[commandName]) { this._waitPool[commandName] = {} }
        _log('_commandProcessWithCache docKey, _cacheGetByPath[docKey] =>', docKey, this._cache[commandName][docKey]);

        // get cache
        if (useCache) {
            if (this._cache[commandName][docKey] == 'Proceeding') {
                return new Promise((resolve, reject) => {
                    if (!this._waitPool[commandName][docKey]) {
                        this._waitPool[commandName][docKey] = [];
                    }
                    this._waitPool[commandName][docKey].push(resolve);
                    _log('_commandProcessWithCache docPath, _waitPool[commandName][docPath] =>', docKey, this._waitPool[commandName][docKey]);
                });
            } else if (this._cache[commandName][docKey]) {
                _log(`_commandProcessWithCache::cache CFFBStoreAPI::${commandName}(cache) ${docKey} =>   ${JSON.stringify(this._cache[commandName][docKey])}`);
                return this._cache[commandName][docKey];
            } else {
                this._cache[commandName][docKey] = 'Proceeding';
                _log('_commandProcessWithCache wait, docPath, _cache[commandName][docPath] =>', docKey, this._cache[commandName][docKey]);
            }
        }

        // command process
        let result = await process.call(this, params);
        _log('cache::_commandProcessWithCache result =>', result);
        
        // save cache
        if (saveCache) {
            this._cache[commandName][docKey] = result;
            _log('cache::_commandProcessWithCache 1');
            _log('_commandProcessWithCache::save docPath, _cache[commandName][docPath] =>', docKey, this._cache[commandName][docKey]);
            if (this._waitPool[commandName][docKey] && this._waitPool[commandName][docKey].length > 0) {
                for (let resolve of this._waitPool[commandName][docKey]) {
                    _log('cache::_commandProcessWithCache 2');
                    resolve(result);
                    _log('_commandProcessWithCache::resolve docKey, result =>', docKey, result);
                }
            }
            setTimeout(() => {
                delete this._cache[commandName][docKey];
            }, cacheTimeout);
        } else {
            delete this._cache[commandName][docKey];
        }
        return result;
    }

    private async _getByPath(params: any) {
        let docPath: string = params['docPath'];
        let result;
        try {
            //let _doc = doc(this.db, docPath);
            let snapshot = await getDoc(doc(this.db, docPath));
            if (snapshot) {
                result = snapshot.data();
                _log(`>>>>>>>>>> CFFBStoreAPI::getByPath ${docPath}   =>   ${JSON.stringify(result)}`);
            } else {
                result = false;
                _log(`>>>>>>>>>> CFFBStoreAPI::getByPath ${docPath}   =>   empty`);
            }
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::getByPath ${docPath}   =>   ${JSON.stringify(error)}`);
            result = false;
            throw error;
        }
        this._convertLocalDate(result);
        return result;
    }

    async getByFilter(entityName: string, filters: any): Promise<any | undefined > {
        let result: Array<any> = await this.listByFilter(entityName, filters);
        _log('cache::getByFilter result =>', result);
        _valid(result.length <= 1);
        return result && result.length > 0 ? result[0] : undefined ;
        // let result;
        // try {
        //     let keys = Object.keys(filters);
        //     let wheres: any = [];
        //     Object.keys(filters).map(key => {
        //         if (filters[key] === undefined) { return; }; 
        //         wheres.push( where( key, '==', filters[key]));
        //     }); 
        //     let collectionRef = collection(this.db, entityName);
        //     if (converter) {
        //         collectionRef = collectionRef.withConverter(converter);
        //     }
        //     const _query: any = query(collectionRef, ...wheres);
        //     let snapshot = await getDocs(_query);
        //     if (snapshot) {
        //         let dataList = Array.from(snapshot.docs, (doc) => doc.data());
        //         result = dataList[0];
        //         _log(`>>>>>>>>>> CFFBStoreAPI::getByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${result}`);
        //     } else {
        //         result = false;
        //         _log(`>>>>>>>>>> CFFBStoreAPI::getByFilter ${entityName} - ${JSON.stringify(filters)}   =>   empty`); 
        //     }
        // } catch(error) {
        //     _log(`>>>>>>>>>> CFFBStoreAPI::getByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
        //     result = false;
        //     throw error;
        // }
        // this._convertLocalDate(result);
        // return result;
    }

    // .where('status', 'in', ['value1', 'value2']) or
    private async _listByFilter(params: any): Promise<Array<any> /*|  { list: Array<any>, lastDocRef: any | null }*/> {
        _flog(this._listByFilter, arguments);
        let entityName: string = params['entityName'];
        let filters: any = params['filters'];
        let withString: boolean = params['withString'];
        let orderFieldName: string | Array<string> = params['orderFieldName'];
        let orderDir: FBOrderDirection = params['orderDir'];
        let _limit: number = params['_limit'];
        //let lastDocRef: any = params['lastDocRef'];

        let list: Array<any> = [];

        try {
            let wheres: any = [];
            Object.keys(filters).map(key => {
                if (filters[key] === undefined) { return; };
                // field의 유형이 array일 때 이렇게 해야 하는데, 여기서 필드의 유형을 알수가 없다.
                // in과 array-contains-any를 구별 할 수 없다. 하지만 in을 쓸일이 없으니 값이 array경우는 필드로 array로 간주한다.
                if (key && typeof filters[key] == "object" && filters[key].condition && filters[key].filed) {
                    wheres.push(where(key, filters[key].condition, filters[key]));
                } else if (Array.isArray(filters[key])) {
                    wheres.push(where(key, 'array-contains-any', filters[key]));
                } else {
                    wheres.push(where(key, '==', filters[key]));
                }
            });

            // order / direction
            if (orderFieldName) {
                if (Array.isArray(orderFieldName)) {
                    for (let filedName of orderFieldName) {
                        wheres.push(orderBy(filedName, orderDir));
                    }
                } else {
                    wheres.push(orderBy(orderFieldName, orderDir));
                }
            }

            wheres.push(limit(_limit));

            let _query: any = query(collection(this.db, entityName), ...wheres);
            // if (lastDocRef) {
            //     _query = _query.startAfter(lastDocRef);
            // }           
            let snapshot = await getDocs(_query);
            if (snapshot) {
                // result = Array.from(snapshot.docs, (doc) => {
                //     return this._saveDocToDoc(doc.data(), withString);;
                // });
                for (let doc of snapshot.docs) {
                    let data = await this._saveDocToDoc(doc.data(), withString);
                    list.push(data);
                }
                //lastDocRef = snapshot.docs[snapshot.docs.length - 1];
                _log(`>>>>>>>>>> CFFBStoreAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(list)}`);
            } else {
                _log(`>>>>>>>>>> CFFBStoreAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   empty`);
                //lastDocRef = null;
                throw new Error();
            }
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::listByFilter error : ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);
            list = [];
            throw error;
        }
        return list;
        //return lastDocRef?  { list: list, lastDocRef: lastDocRef } : list;
    }


    // updateDoc을 쓰고 있음, 데이타 일부 패치
    async update(entityName: string, key: string, data: any) {
        return this._setUpdate(entityName, key, data, false);
    }

    async set(entityName: string, key: string, data: any) {
        return this._setUpdate(entityName, key, data, true);
    }

    async _setUpdate(entityName: string, key: string, data: any, isSet: boolean = true) {
        _log('CFFBStoreAPI::update node, key, data =>', entityName, key, data);
        let _data = CFHelper.json.deepClone(data);
        _data = CFHelper.object.replaceUndefinedWithValue(_data, '');
        // update date
        if (_data && _data.updateDate) {
            _data.updateDate = serverTimestamp();
        }

        try {
            const docRef = doc(this.db, `${entityName}/${key}`);
            if (isSet) {
                await setDoc(docRef, _data);
            } else {
                await updateDoc(docRef, _data);
            }
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                _data = snapshot.data();
                _log(`>>>>>>>>>> CFFBStoreAPI::update ${entityName} ${_data.updateDate}`);
                this._convertLocalDate(_data);
                _log(`>>>>>>>>>> CFFBStoreAPI::update ${entityName} ${JSON.stringify(_data)}   =>   ${JSON.stringify(_data)}`);
                // return data;
            } else {
                _log(`>>>>>>>>>> CFFBStoreAPI::update ${entityName} ${JSON.stringify(_data)}   =>   EMPTY`);
                throw new Error();
            }
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::update error => ${JSON.stringify(error)}`);
            //reject(error);
            throw error;
        }
        return _data;
    }

    // setDoc을 쓰고 있음, 데이타 전체를 교체함
    //let _template: any = await this.api.updateByNode(`NPPageTemplate/${template._key}/objects/${objectIndex}`, object);
    async setByNode(docPath: string, data: any, withString: boolean = false, exceptStringFields: Array<string> = [], isRemoveImageUrlToken = false, userId?: string, seq?: number) {
        _log('CFFBStoreAPI::setByNode docPath, data, seq =>', docPath, data, seq);
        return this._setUpdateByNode(true, docPath, data, withString, exceptStringFields, isRemoveImageUrlToken, userId, seq);
    }

    async updateByNode(docPath: string, data: any, withString: boolean = false, exceptStringFields: Array<string> = [], isRemoveImageUrlToken = false, userId?: string, seq?: number) {
        _log('CFFBStoreAPI::updateByNode docPath, data, seq =>', docPath, data);
        return this._setUpdateByNode(false, docPath, data, withString, exceptStringFields, isRemoveImageUrlToken, userId, seq);
    }

    async _setUpdateByNode(isSet: boolean, docPath: string, data: any, withString: boolean = false, exceptStringFields: Array<string> = [], isRemoveImageUrlToken = false, userId?: string, seq?: number) {
        _log('CFFBStoreAPI::_setUpdateByNode docPath, data =>', docPath, data);
        let _data = CFHelper.json.deepClone(data);
        try {
            _data = this._docToSaveDoc(_data, withString, exceptStringFields, isRemoveImageUrlToken, userId);   //  서버시간으로 변경 됨
            if (seq !== undefined) { _data.seq = seq; }

            const docRef = doc(this.db, docPath);
            if (isSet) {
                await setDoc(docRef, _data);
            } else {
                await updateDoc(docRef, _data);
            }
            _log(`>>>>>>>>>> CFFBStoreAPI::updateByNode isSet: ${isSet} ${docPath} ${JSON.stringify(_data)}   =>   생략`);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                _data = snapshot.data();
                this._convertLocalDate(_data);
                _log(`>>>>>>>>>> CFFBStoreAPI::updateByNode isSet: ${isSet} ${docPath} ${JSON.stringify(data)}   =>   ${JSON.stringify(data)}`);
                //return data;
            } else {
                _log(`>>>>>>>>>> CFFBStoreAPI::updateByNode isSet: ${isSet} ${docPath} ${JSON.stringify(data)}   =>   EMPTY`);
                throw new Error();
            }
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::updateByNode isSet: ${isSet} error => ${JSON.stringify(error)}`);
            //reject(error);
            throw error;
        }
        return _data;
    }

    async delete(entityName: string, key: string) {
        let result: any;
        try {
            await deleteDoc(doc(this.db, entityName, key));
            _log(`>>>>>>>>>> CFFBStoreAPI::delete ${entityName}/${key}`);
            result = true;
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::delete error => ${JSON.stringify(error)}`);
            result = false;
            throw (error);
        }
        return result;
    }

    async deleteByNode(docPath: string) {
        let result: any;
        try {
            await deleteDoc(doc(this.db, docPath));
            _log(`>>>>>>>>>> CFFBStoreAPI::deleteByNode ${docPath}`);
            result = true;
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::deleteByNode error => ${JSON.stringify(error)}`);
            result = false;
            throw (error);
        }
        return result;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 #collection                                */
    /* -------------------------------------------------------------------------- */

    async getCollection(colPath: string, userId: string, withString: boolean = false, userCache: boolean = true) {
        _flog(this.getCollection, arguments);
        return await this.listByFilter(colPath, { userId: userId }, withString, userCache, userCache, 'seq', FBOrderDirection.asc, 1000);
        //return await this.listByFilter(colPath, {}, withString);
    }

    // objectIndex는 중요함 / object의 UI상 순서를 나타냄

    // objects, pages 의 생성
    // objects, pages 의 수정

    // NPPageTemplate/${template._key}/objects/${objectIndex}
    // NPNoteContent/${noteContent._key}/pages
    // NPNoteContent/${noteContent._key}/pages/${pageNumber-1}/objects/${objectIndex}

    async setCollection(colPath: string, docs: Array<any>, withString: boolean = false, exceptStringFields: Array<string> = [], isRemoveImageUrlToken: boolean = false, userId: string) {
        _log('CFFBStoreAPI::setCollection colPath, data =>', colPath, docs);
        await this.deleteCollection(colPath, userId); // 해당 주소에 데이타가 없으면 퍼미션 오류가 남
        let _docs: Array<any> = CFHelper.json.deepClone(docs); // 여기서 복사를 안해주면 docs.objects에 text가 사라지는 버그가 있음
        let list = [];
        try {
            let index = 0;
            for (let _doc of _docs) {
                if (!_doc._key) {
                    _doc._key = CFHelper.id.generateUUID();
                }
                _valid(_doc._key && _doc._key.length > 0);
                let data = this._docToSaveDoc(_doc, withString, exceptStringFields, isRemoveImageUrlToken, userId);
                data.seq = index;
                _log('setCollection::setDoc colPath, _doc._key, data =>', colPath, _doc._key, data);
                await setDoc(doc(this.db, `${colPath}/${_doc._key}`), data);
                index++;
            }
            // 이 체크를 하지 않으면 문서가 없을 때 권한 오류가 남
            if (_docs && _docs.length > 0) {
                const _query: any = query(collection(this.db, colPath), where('userId', '==', userId));
                const snapshot = await getDocs(_query);
                if (snapshot) {
                    // list = Array.from(snapshot.docs, (doc) => {
                    //     let data = this._saveDocToDoc(doc.data(), withString);
                    //     return data;
                    // });
                    //let list = [];
                    for (let doc of snapshot.docs) {
                        let data = await this._saveDocToDoc(doc.data(), withString);
                        list.push(data);
                    }
                    _log(`>>>>>>>>>> CFFBStoreAPI::setCollection ${colPath} ${JSON.stringify(_docs)}   =>   ${list}`);
                } else {
                    _log(`>>>>>>>>>> CFFBStoreAPI::setCollection ${colPath} ${JSON.stringify(_docs)}   =>   EMPTY`);
                    throw new Error();
                }
            }
            // else {
            //     list = [];
            // }
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::setCollection error => ${JSON.stringify(error)}`);
            //reject(error);
            throw error;
        }
        return list;
    }

    async deleteCollection(colPath: string, userId: string) {
        try {
            const _query: any = query(collection(this.db, colPath), where('userId', '==', userId));
            const snapshot = await getDocs(_query); // 
            if (snapshot) {
                let list = Array.from(snapshot.docs, (doc) => doc.ref);
                _log('deleteCollection list =>', list);
                for (let _doc of list) {
                    await deleteDoc(_doc as any);
                }
            }
            _log(`>>>>>>>>>> CFFBStoreAPI::deleteCollection ${colPath}`);
        } catch (error) {
            _log(`>>>>>>>>>> CFFBStoreAPI::deleteCollection error => ${JSON.stringify(error)}`);
            //reject(error);
            //throw error;
        }
    }

    // 정확히 일치하는 경우만 동작함

    // async search(keyword: string, entityName: string, fields: Array<string>, filters: any) {
    //     let result: Array<any> = [];
    //     try {
    //         let wheres: any = [];
    //         Object.keys(filters).map(key => {
    //             if (filters[key] === undefined) { return; }; 
    //             wheres.push(where( key, '==', filters[key]));
    //         }); 

    //         // search query
    //         let ref = collection(this.db, entityName);
    //         for(let feild of fields) {
    //             wheres.push(where(feild, '>=', keyword));
    //             wheres.push(where(feild, '<=', keyword + '\uf8ff'));
    //             // wheres.push(startAt(keyword));
    //             // wheres.push(endAt(keyword + '\uf8ff'));
    //             // wheres.push(where('fieldName', isGreaterThanOrEqualTo: searchKey));
    //             // wheres.push(where('fieldName', isLessThan: searchKey +’z’));
    //         }

    //         const _query: any = query(collection(this.db, entityName), ...wheres);
    //         let snapshot = await getDocs(_query);
    //         if (snapshot) {
    //             result = Array.from(snapshot.docs, (doc) => {
    //                 return this._convertLocalDate(doc.data());
    //             });
    //             _log(`>>>>>>>>>> CFFBStoreAPI::search ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(result)}`);
    //         } else {
    //             _log(`>>>>>>>>>> CFFBStoreAPI::search ${entityName} - ${JSON.stringify(filters)}   =>   empty`); 
    //             throw new Error();
    //         }
    //     } catch(error) {
    //         _log(`>>>>>>>>>> CFFBStoreAPI::list error : ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
    //         result = [];
    //         throw error;
    //     }
    //     return result;
    // }

    /* -------------------------------------------------------------------------- */

    // ?alt=media : 이게 있으면 토크이 없어도 스토리지 권한 규칙에 따라 이미지가 보임
    public _docToSaveDoc(_doc: any, withString: boolean = false, exceptStringFields: Array<string> = [], isRemoveImageUrlToken: boolean = false, userId?: string) {
        //_log('_docToSaveDoc _doc =>', _doc);
        let data: any = {};

        // imageURL에서 토큰 제거 (권한 때문에) : 템플릿에 사용한 이미지는 발행대상이라 전체공개
        // 템플릿에 이미지를 token없이 저장 할수는 있으나 coverImage가 문제임 (svg안에 이미지라 복사시 주소를 바꿔주기 어려움)
        //if (isRemoveImageUrlToken) {
        // let prefix = environment.firebaseStorageUrl;
        // if (_doc && _doc.type && _doc.type == 'image' && _doc.src && _doc.src.substring(0, prefix.length) == prefix) {
        //     _doc.src = this._removeTokenFromUrl(_doc.src);
        //     _doc.src = this._removeQueryParamFromUrl(_doc.src);
        //     _log('_docToSaveDoc _doc.src =>', _doc.src);
        // }
        //}

        // 항상 토큰을 제거 하고 있음, 지금은 제거하고 없으면 생성하고 있음
        // 그냥 제거하지 말면??
        // 

        /*
            <변경사항>
            1. 링크제거 없이 저장 함 (기존에는 제거하고 로딩할때 붙여주었음)
            2. 로딩할때 링크 없을 때만 링크 복원함

        */

        // 문자열로 저장 옵션이면
        if (withString) {
            let _data: any = {};

            // 특정 필드는 밖으로 빼고 문자열로 저장 함 ['text'], text는 왜 밖으로 뺐을까? 어차피 지금은 검색을 위해서 따로 저장하기 떄문에 이게 필요 없을 것 같은데
            // object.text로 검색 저장할때 사용함 이거라면 굳이 그럴필요 없을 듯
            for (let field of exceptStringFields) {
                if (_doc[field]) {
                    _data[field] = _doc[field];
                } else {
                    _data[field] = '';
                }
                delete _doc[field];
            }
            // 문자열로 저장
            _data._data = JSON.stringify(_doc);

            // userId 추가
            if (userId) {
                _data.userId = userId;
            }
            //_log('_docToSaveDoc _data =>', _data);
            data = _data;
        } else {
            let _doc2 = CFHelper.json.deepClone(_doc);
            data = CFHelper.object.replaceUndefinedWithValue(_doc2, '');
        }

        // update date
        if (_doc && _doc.updateDate) {
            data['updateDate'] = serverTimestamp();
        }
        _log('_docToSaveDoc data =>', data);
        return data;
    }

    private _removeQueryParamFromUrl(url: string) {
        // 문자열에서 '?'을 찾습니다.
        const index = url.indexOf('?');

        // '?'을 찾으면 그 이전 부분을 유지하고 '?' 이후를 제거합니다.
        if (index !== -1) {
            return url.substring(0, index);
        } else {
            // '?'을 찾지 못하면 원래 URL을 그대로 반환합니다.
            return url;
        }
    }

    private _removeTokenFromUrl(url: string) {
        // 문자열에서 '&token'을 찾습니다.
        const tokenIndex = url.indexOf('&token');

        // '&token'을 찾으면 그 이전 부분을 유지하고 '&token' 이후를 제거합니다.
        if (tokenIndex !== -1) {
            return url.substring(0, tokenIndex);
        } else {
            // '&token'을 찾지 못하면 원래 URL을 그대로 반환합니다.
            return url;
        }
    }

    public async _saveDocToDoc(_doc: any, withString: boolean = false) {
        //_log('_saveDocToDoc _doc =>', _doc);
        let data = _doc;

        // 문자열로 저장 옵션이면
        if (withString) {
            //valid(_doc._data);
            if (_doc._data) {
                let _data: any = JSON.parse(_doc._data);
                Object.assign(data, _data);
                delete data._data;
            }
        }
        data = this._convertLocalDate(data);

        // imageURL에 토큰 추가 (권한 때문에)
        // 만약에 이미지 url인데 token이 없다면 권한을 요청해서 토큰을 붙여줘야 한다.
        let prefix = environment.firebaseStorageUrl;
        if (data && data.type && data.type == 'image' && data.src && data.src.substring(0, prefix.length) == prefix) {
            // 만약에 토큰이 없다면
            if (data.src.indexOf('&token') == -1) {
                _log('_saveDocToDoc token없음 =>')
                try {
                    data.src = await this.getPublicImageUrl(data.src); // 토큰이 없을 경우만
                } catch (e) {
                    data.src = '';
                }
                _log('_saveDocToDoc data.src =>', data.src);
            } else {
                _log('_saveDocToDoc token있음 =>')
                // 이미 토큰이 있다면 토큰을 제거하고 다시 권한 요청 ( 이미 실서버에 올라간 이미지 떄문에 )
                // let url = this._removeTokenFromUrl(_doc.src);
                // url = this._removeQueryParamFromUrl(_doc.src);
                // data.src = await this.getPublicImageUrl(url);
            }
        }

        //_log('_saveDocToDoc data =>', data);
        return data;
    }

    // 변환 할 수 있는 것만 변환한다. 
    private _convertLocalDate(data: any) {
        if (!data) { return data; }

        if (data.registDate) {
            try {
                data.registDate = data.registDate.toDate().toISOString();
            } catch (e) {

            }
        }
        if (data.updateDate) {
            try {
                data.updateDate = data.updateDate.toDate().toISOString();
            } catch (e) {

            }
        }

        return data;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 storage api                                */
    /* -------------------------------------------------------------------------- */
    // 나중에 이전 필요

    async getPublicImageUrl(url: string) {
        _flog(this.getPublicImageUrl, arguments);
        try {
            // let prefix = environment.firebaseStorageUrl;
            // if (url.substring(0, prefix.length) !== prefix) { return url; }
            url = this._removeQueryParamFromUrl(url);

            let urls = url.split('/o/');
            let _ref = decodeURIComponent(urls[1]);
            _valid(_ref);
            if (!_ref) { return url; }
            _log('getPublicImageUrl _ref =>', _ref);

            const app = initializeApp(environment.firebaseConfig);
            let storage = getStorage(app);
            let storageRef = ref(storage, _ref);

            let _url = await getDownloadURL(storageRef);
            if (_url) {
                url = _url;
            }
        } catch (e) {
            url = '';
            _log('getPublicImageUrl:fail url =>', url);
        }
        _log('getPublicImageUrl url =>', url);
        return url;
    }

    // async getDrawingHistory(userId: string) {
    //     const app = initializeApp(environment.firebaseConfig);
    //     let storage = getStorage(app);
    //     let storageRef = ref(storage, `userContent/${userId}/data`);
    //     _log('fbstore getDrawingHistory storageRef => ', storageRef);

    //     listAll(storageRef).then(resp => {
    //         _log('fbstore getDrawingHistory resp => ', resp);
    //          // 다운로드 URL을 담을 배열
    //         let downloadURLs: any = [];
    //         // 모든 파일에 대해 다운로드 URL 가져오기
    //         let urlPromises = resp.items.map(itemRef => 
    //             getDownloadURL(itemRef).then(url => {
    //                 downloadURLs.push(url);
    //             })
    //         );
    //         // promise.all 을 사용하여 모든 다운로드  url 을 비동기적으로 가져오고 배열에 담는다.
    //         return Promise.all(urlPromises).then(() => downloadURLs);
    //     }).then(downloadURLs => {
    //         // 다운로드 URL 배열 출력
    //         _log('fbstore getDrawingHistory downloadURLs => ', downloadURLs);
    //     });
    // }

    //    https://firebasestorage.googleapis.com/v0/b/blank-test-5ee64.appspot.com/o/userContent%2F8ImRcsjdSCYAi1KyXoXpHf3wnn83%2Fimages%2F10.png

    //     // 이미지 다운로드 함수
    //   function downloadImage() {
    //     // 이미지의 Firebase Storage 경로
    //     var storageRef = storage.ref('userContent/8ImRcsjdSCYAi1KyXoXpHf3wnn83/images/10.png');

    //     // 이미지 다운로드 URL 가져오기
    //     storageRef.getDownloadURL().then(function(url) {
    //       // 이미지 요소에 URL 설정하여 이미지 표시
    //       var imageElement = document.getElementById('imageElement');
    //       imageElement.src = url;
    //     }).catch(function(error) {
    //       // 에러 처리
    //       console.error('이미지 다운로드 실패:', error);
    //     });
    //   }

    // const app = initializeApp(environment.firebaseConfig);
    // let storage = getStorage(app);
    // let storageRef = ref(storage, `${folderName}/${userId}/images/${file.name}`);
    // return uploadBytes(storageRef, file).then((resp: any) => { 
    //     _log('imageUploadByFb::uploadBytes resp.metadata.fullPath =>', resp.metadata.fullPath)
    //     return getDownloadURL(storageRef); 
    // }).then(downloadURL => {
    //     console.log('업로드한 파일의 다운로드 file:', file);
    //     let registDate = CFDate.nowAsString();
    //     this.mediaStore.create(file.name, file.size, file.type, registDate, downloadURL, userId);
    //     // url에서 토크을 제거 한다. 권한문제 때문에 토큰 제거
    //     return downloadURL;
    // })
    // .catch(error => {
    //     console.error('파일 업로드 및 다운로드 URL 얻기 실패:', error);
    //     throw error;
    // });



}
