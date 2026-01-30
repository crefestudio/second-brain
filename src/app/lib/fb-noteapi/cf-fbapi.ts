// import { _log, _valid, isArrayOfStrings, isJSON, CFDate, CFHelper } from '../cf-common/cf-common';
// import { NPLList } from './cf-noteapi';
// import { serverTimestamp, ref as fbRef, getDatabase, update } from 'firebase/database';
// // const db = getDatabase(app);

// export enum FBOrder {
//     asc = 'asc',
//     desc = 'desc'
// }

// export class CFFBAPI {
// 	static _self: CFFBAPI;
//     public db: any;
//     constructor(_db: any) {
//         if (_db) {
//             this.db = _db;
//         }

//         setTimeout(() => {
//             CFFBAPI.getInstance().nowAsString();
//         }, 1000);
//     }

//     nowAsString() {
//         _log('firebase 서버 시간 : ', serverTimestamp());
//         // this.db.ref('/.info/serverTimeOffset')
//         // .once('value')
//         // .then(function stv(data: any) {
//         //     console.log('firebase 서버시간', data.toDate());
//         // }, function (err: any) {
//         //     return err;
//         // });
//         // const serverTimeRef = this.db.ref('.info/serverTime');
//         // console.log('Firebase 서버 시간:', serverTimeRef);

//         // serverTimeRef.on('value', (snapshot: any) => {
//         //     console.log('Firebase 서버 시간:');
//         //     const serverTime = snapshot.val();
//         //     console.log('Firebase 서버 시간:', serverTime);
//         // });
//         // const now = new Date();
//         // const isoString = now.toISOString();
//         // return isoString;
//     }


// 	static getInstance(db?: any) {
//         if (!CFFBAPI._self) {
//             _valid(db);
//             CFFBAPI._self = new CFFBAPI(db);
//         } 
//         return CFFBAPI._self;
//     }

//     async create(entityName: string, entity: any): Promise<any> {
//         // create date
//         if(entity && entity.registDate) {
//             entity.registDate = CFDate.nowAsString();
//         }
//         if(entity && entity.createDate) {
//             entity.createDate = CFDate.nowAsString();
//         }
//         return new Promise((resolve, reject) => {
//             try {
//                 let ref = this.db.ref(entityName).push(entity);
//                 if (!ref) throw({});
//                 entity._key = ref.key;
//                 ref.update({_key: ref.key}, (error: any) => {
//                     if (error) {
//                         reject(error);
//                         return;
//                     }
//                     ref.once('value').then((snapshot: { exists: () => any; val: () => unknown; }) => {
//                         if (snapshot.exists()) {
//                             _log(`>>>>>>>>>> CFFBAPI::post ${entityName} ${JSON.stringify(entity)}   =>   ${JSON.stringify(snapshot.val())}`);
//                             resolve(snapshot.val());
//                         } else {
//                             _log(`>>>>>>>>>> CFFBAPI::post ${entityName} ${JSON.stringify(entity)}   =>   EMPTY`);                   
//                             resolve({});
//                         }
//                     }).catch((error: any) => {
//                         _log(`>>>>>>>>>> CFFBAPI::post ${entityName} ${JSON.stringify(entity)}   =>   ${error}`);                   
//                         reject(error);
//                     });
//                 });
//             } catch(error) {
//                 _log(`>>>>>>>>>> CFFBAPI::post ${entityName} ${JSON.stringify(entity)}   =>   ${error}`);                   
//                 reject(error);
//             }
//         });        
//     }

//     // const dbRef = firebase.database().ref();
//     // dbRef.child("users").child(userId).get().then((snapshot) => {
//     // if (snapshot.exists()) {
//     //     console.log(snapshot.val());
//     // } else {
//     //     console.log("No data available");
//     // }
//     // }).catch((error) => {
//     // console.error(error);
//     // });

//     // let params = {
//     //     userid: userid,
//     //     note_seq: note_seq,
//     //     template_seq: template_seq
//     // }

//     async get(entityName: string, key: any): Promise<any> {
//         return this.getByFilter(entityName, {_key: key});
//     }

//     // async getByFilter(entityName: string, filters: any): Promise<any> {
//     //     return new Promise((resolve, reject) => {
//     //         try {
//     //             const dbRef = this.db.ref(entityName);
//     //             let _query: any; 
//     //             let keys = Object.keys(filters);
//     //             if (keys.length > 1) {
//     //                 throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//     //             }
//     //             Object.keys(filters).map(key => {
//     //                 if (!filters[key]) { return; }; 
//     //                 _query = dbRef.orderByChild(key).equalTo(filters[key]);
//     //             }); 
//     //             _query.once('value').then((snapshot: { val: () => { [s: string]: unknown; } | ArrayLike<unknown>; exists: () => any; }) => {
//     //                 _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(Object.values(snapshot.val())[0])}`);
//     //                 if (snapshot.exists()) {
//     //                     resolve(Object.values(snapshot.val())[0]);
//     //                 } else {
//     //                     resolve(false);
//     //                 }
//     //             }).catch((error: any) => {
//     //                 _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`); 
//     //                 resolve(false);
//     //             });
//     //             //return snapshop.val();
//     //         } catch(error) {
//     //             _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
//     //             reject(false);
//     //         }
//     //     });
//     // }

//     async getByFilter(entityName: string, filters: any) {
//         let result;
//         try {
//             const dbRef = this.db.ref(entityName);
//             let _query: any; 
//             let keys = Object.keys(filters);
//             if (keys.length > 1) {
//                 throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//             }
//             Object.keys(filters).map(key => {
//                 if (!filters[key]) { return; }; 
//                 _query = dbRef.orderByChild(key).equalTo(filters[key]);
//             }); 
//             let snapshot = await _query.once('value');
//             if (snapshot && snapshot.exists()) {
//                 result = Object.values(snapshot.val())[0];
//                 _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(result)}`);
//             } else {
//                 result = false;
//                 _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   empty`); 
//             }
//         } catch(error) {
//             _log(`>>>>>>>>>> CFFBAPI::get ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
//             result = false;
//             throw error;
//         }
//         return result;
//     }

//     // async listByKeys(entityName: any, keys: Array<string>): Promise<Array<any>> {
//     //     let result: any;
//     //     try {
//     //         let query = this.db.ref(entityName);
//     //         for(let key of keys) {
//     //             query = query.child(key);
//     //             //query =  query.orderByChild('_key').equalTo(key);
//     //         }
//     //         //let data = dbRef.child(keys[0]);
//     //         // for (var i = 1; i < keys.length; i++) {
//     //         //     data = data.child(keys[i]);
//     //         // }

//     //         let snapshot = await query.once('value');
//     //         if (snapshot && snapshot.exists()) {
//     //             result = Object.values(snapshot.val());
//     //             _log(`>>>>>>>>>> CFFBAPI::listByKeys ${entityName} - ${JSON.stringify(keys)}   =>   ${JSON.stringify(snapshot.val())}`);
//     //         } else {
//     //             result = false;
//     //             _log(`>>>>>>>>>> CFFBAPI::listByKeys ${entityName} - ${JSON.stringify(keys)}   =>   Empty`);
//     //         }
//     //     } catch(error) {
//     //         _log(`>>>>>>>>>> CFFBAPI::listByKeys ${entityName} - ${JSON.stringify(keys)}   =>   ${JSON.stringify(error)}`);  
//     //         result = false;
//     //         throw error;
//     //     }
//     //     return result;
//     // }

//     async listByFilter(entityName: any, filters: any, order: FBOrder = FBOrder.desc): Promise<Array<any>> {
//         let result: any;
//         try {
//             const dbRef = this.db.ref(entityName);

//             let _query: any; 
//             let keys = Object.keys(filters);

//             if (keys.length > 1) {
//                 throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//             }
//             Object.keys(filters).map(key => {
//                 if (!filters[key]) { return; }; 
//                 _query = dbRef.orderByChild(key).equalTo(filters[key]);
//             }); 
//             _log('listByFilter _query =>', _query);
//             let snapshot = await _query.once('value');
//             if (snapshot && snapshot.exists()) {
//                 let list: Array<any> =  Object.values(snapshot.val());
//                 _log('listByFilter list =>', list)
//                 result = order == FBOrder.asc? list : list.reverse();
//                 _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//             } else {
//                 result = [];
//                 _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   Empty`);
//             }
//         } catch(error) {
//             _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
//             result = false;
//             throw error;
//         }
    
//         return result;
//     }

//     // async listByKeys(entityName: any, keys: any, order: FBOrder = FBOrder.desc): Promise<Array<any>> {
//     //     let result: any;
//     //     try {
//     //         const dbRef = this.db.ref(entityName);

//     //         let _query: any; 
//     //         let keys = Object.keys(filters);

//     //         if (keys.length > 1) {
//     //             throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//     //         }
//     //         Object.keys(filters).map(key => {
//     //             if (!filters[key]) { return; }; 
//     //             _query = dbRef.orderByChild(key).equalTo(filters[key]);
//     //         }); 
//     //         _log('listByFilter _query =>', _query);
//     //         let snapshot = await _query.once('value');
//     //         if (snapshot && snapshot.exists()) {
//     //             let list: Array<any> =  Object.values(snapshot.val());
//     //             _log('listByFilter list =>', list)
//     //             result = order == FBOrder.asc? list : list.reverse();
//     //             _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//     //         } else {
//     //             result = [];
//     //             _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   Empty`);
//     //         }
//     //     } catch(error) {
//     //         _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
//     //         result = false;
//     //         throw error;
//     //     }
//     //     return result;
//     // }

//     async updateByNode(node: string, data: any) {
//         _log('CFFBAPI::updateByNode node, data =>', node, data);
//         let _data = CFHelper.json.deepClone(data);
//         data = CFHelper.object.replaceUndefinedWithValue(_data, '');
//         // update date
//         if(data && data.updateDate) {
//             data.updateDate = CFDate.nowAsString();
//         }

//         return new Promise((resolve, reject) => {
//             try {
//                 let ref = this.db.ref(node).set(data, (error: any) => {
//                     if (error) {
//                         _log(`>>>>>>>>>> CFFBAPI::update ${node} error => ${JSON.stringify(error)}`);
//                         reject(error);
//                     } else {
//                         _log(`>>>>>>>>>> CFFBAPI::update ${node} data => ${JSON.stringify(data)}`);
//                         resolve(data);
//                     }
//                 });
//             } catch(error) {
//                 _log(`>>>>>>>>>> CFFBAPI::update error, note, data => ${JSON.stringify(error)} ${node} ${data}`);
//                 reject(error);
//             }
//         });        
//     }

//     async update(entityName: string, key: string, data: any, childNodeName?: string) {
//         _log('CFFBAPI::update node, data =>', entityName, data);
//         let _data = CFHelper.json.deepClone(data);
//         data = CFHelper.object.replaceUndefinedWithValue(_data, '');
//         // update date
//         if(data && data.updateDate) {
//             data.updateDate = CFDate.nowAsString();
//         }
//         return new Promise((resolve, reject) => {
//             try {
//                 let node = `${entityName}/${key}`;
//                 if (childNodeName && childNodeName.length > 0) {
//                     node += `/${childNodeName}`; 
//                 }
//                 let ref = this.db.ref(node).set(data, (error: any) => {
//                     if (error) {
//                         _log(`>>>>>>>>>> CFFBAPI::update ${node} error => ${JSON.stringify(error)}`);
//                         reject(error);
//                     } else {
//                         _log(`>>>>>>>>>> CFFBAPI::update ${node} data => ${JSON.stringify(data)}`);
//                         resolve(data);
//                     }
//                 });
//             } catch(error) {
//                 _log(`>>>>>>>>>> CFFBAPI::update error => ${JSON.stringify(error)}`);
//                 reject(error);
//             }
//         });        
//     }

//     async delete(entityName: string, key: string) {
//         let result: any;
//         try {
//             let node = `${entityName}/${key}`;
//             await this.db.ref(node).remove();
//             _log(`>>>>>>>>>> CFFBAPI::delete ${node}`);
//             result = true;
//         } catch(error) {
//             _log(`>>>>>>>>>> CFFBAPI::delete error => ${JSON.stringify(error)}`);
//             result = false;
//             throw(error);
//         }
//         return result;
//     }

//     async search(keyword: string, entityName: string, fields: Array<string>, filters: any, order: FBOrder = FBOrder.desc) {
//         let result: any;
//         try {
//             const dbRef = this.db.ref('/'+entityName);
//             let _query: any;

//             // 검색 대상
//             for(let field of fields) {
//                 _query = dbRef.orderByChild(field).startAt(keyword).endAt(keyword + '\uf8ff');
//             }

//             // filter
//             let keys = Object.keys(filters);
//             if (keys.length > 1) {
//                 throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//             }
//             Object.keys(filters).map(key => {
//                 if (!filters[key]) { return; }; 
//                 _query = dbRef.orderByChild(key).equalTo(filters[key]);
//             }); 

//             let snapshot = await _query.once('value');
//             if (snapshot && snapshot.exists()) {
//                 let list: Array<any> =  Object.values(snapshot.val());
//                 result = order == FBOrder.asc? list : list.reverse();
//                 _log(`>>>>>>>>>> CFFBAPI::search ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//             } else {
//                 result = [];
//                 _log(`>>>>>>>>>> CFFBAPI::search ${entityName} - ${JSON.stringify(fields)}   =>   Empty`);
//             }
//         } catch(error) {
//             _log(`>>>>>>>>>> CFFBAPI::search ${entityName} - ${JSON.stringify(fields)}   =>   ${JSON.stringify(error)}`);  
//             result = false;
//             throw error;
//         }
//         return result;
//     }

//     async searchInNodes(keyword: string, nodes: Array<string>, fields: Array<string>, filters?: any, order: FBOrder = FBOrder.desc) {
//         const queries = nodes.map((node) => {
//             return new Promise((resolve, reject) => {
//                 // 검색 대상
//                 _log('searchInNodes node =>', node);
//                 let query = this.db.ref(node);
//                 for(let field of fields) {
//                     query = query.orderByChild(field).startAt(keyword).endAt(keyword + '\uf8ff');
//                 }
        
//                 query.once('value', (snapshot: any) => {
//                     let result;
//                     if (snapshot && snapshot.exists()) {
//                         let list: Array<any> =  Object.values(snapshot.val());
//                         result = order == FBOrder.asc? list : list.reverse();
//                         _log(`>>>>>>>>>> CFFBAPI::searchInNodes ${node} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//                     } else {
//                         result = [];
//                         _log(`>>>>>>>>>> CFFBAPI::searchInNodes ${node} - ${JSON.stringify(fields)}   =>   Empty`);
//                     }
//                     resolve(result);
//                 }, (error: any) => {
//                     reject(error);
//                 });
//             });
//         });
//         return Promise.all(queries);
//     }
//     // function findDataWithKeyword(refPaths, field, keyword) {
//     //     const queries = refPaths.map((refPath) => {
//     //       return new Promise((resolve, reject) => {
//     //         const query = database.ref(refPath)
//     //           .orderByChild(field)
//     //           .startAt(keyword)
//     //           .endAt(keyword + '\uf8ff');
      
//     //         query.once('value', (snapshot) => {
//     //           const results = [];
//     //           snapshot.forEach((childSnapshot) => {
//     //             const data = childSnapshot.val();
//     //             results.push(data);
//     //           });
//     //           resolve(results);
//     //         }, (error) => {
//     //           reject(error);
//     //         });
//     //       });
//     //     });
      
//     //     return Promise.all(queries);
//     //   }

//     // 여러 필드에 대한 equalTo 쿼리 수행 #todo
//     // function queryMultipleFieldsEqualTo(refPath, fields) {
//     //     return new Promise((resolve, reject) => {
//     //     let query = database.ref(refPath);
    
//     //     for (const field in fields) {
//     //         query = query.orderByChild(field).equalTo(fields[field]);
//     //     }
    
//     //     query.once('value', (snapshot) => {
//     //         const results = [];
//     //         snapshot.forEach((childSnapshot) => {
//     //         const data = childSnapshot.val();
//     //         results.push(data);
//     //         });
//     //         resolve(results);
//     //     }, (error) => {
//     //         reject(error);
//     //     });
//     //     });
//     // }

//     // async searchFromNote(keyword: string, userId: string) {
//     //     // let result: any;
//     //     // try {
//     //     //     const dbRef = this.db.ref(entityName);

//     //     //     let _query: any; 
//     //     //     let keys = Object.keys(filters);

//     //     //     if (keys.length > 1) {
//     //     //         throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//     //     //     }
//     //     //     Object.keys(filters).map(key => {
//     //     //         if (!filters[key]) { return; }; 
//     //     //         _query = dbRef.orderByChild(key).equalTo(filters[key]);
//     //     //     }); 
//     //     //     _log('listByFilter _query =>', _query);
//     //     //     let snapshot = await _query.once('value');
//     //     //     if (snapshot && snapshot.exists()) {
//     //     //         let list: Array<any> =  Object.values(snapshot.val());
//     //     //         _log('listByFilter list =>', list)
//     //     //         result = order == FBOrder.asc? list : list.reverse();
//     //     //         _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//     //     //     } else {
//     //     //         result = [];
//     //     //         _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   Empty`);
//     //     //     }
//     //     // } catch(error) {
//     //     //     _log(`>>>>>>>>>> CFFBAPI::listByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(error)}`);  
//     //     //     result = false;
//     //     //     throw error;
//     //     // }
//     // }

//     // 다시  retrun new Promise로 바꾸고 테스트

//     // async deleteByFilter(entityName: string, filters: any) {
//     //     let result: any;
//     //     try {
//     //         const dbRef = this.db.ref(entityName);
//     //         let _query: any; 
//     //         let keys = Object.keys(filters);

//     //         if (keys.length > 1) {
//     //             throw new Error("get 파라미터는 1개 이상일 수 없습니다.");
//     //         }
//     //         Object.keys(filters).map(key => {
//     //             if (!filters[key]) { return; }; 
//     //             _query = dbRef.orderByChild(key).equalTo(filters[key]);
//     //         });
//     //         let snapshot = await _query.once('value');
//     //         if (snapshot && snapshot.exists()) {
//     //             snapshot.forEach((childSnapshot: any) => {
//     //                 var key = childSnapshot.key;
//     //                 // this.delete(entityName, key).then(() => {

//     //                 // })
//     //                 // .catch(error => {

//     //                 // });
//     //             });
//     //             _log(`>>>>>>>>>> CFFBAPI::deleteByFilter ${entityName} - ${JSON.stringify(filters)}   =>   ${JSON.stringify(snapshot.val())}`);
//     //         } else {
//     //             result = [];
//     //             _log(`>>>>>>>>>> CFFBAPI::deleteByFilter ${entityName} - ${JSON.stringify(filters)}   =>   Empty`);
//     //         }

//     //         //let node = `${entityName}/${key}`;
//     //         //await this.db.ref(node).remove();
//     //         //_log(`>>>>>>>>>> CFFBAPI::delete ${node}`);
//     //         result = true;
//     //     } catch(error) {
//     //         _log(`>>>>>>>>>> CFFBAPI::deleteByFilter error => ${JSON.stringify(error)}`);
//     //         result = false;
//     //     }
//     //     return result;
//     // }


//     /*
//     var ref = firebase.database().ref("경로/이름");

//     // userId가 toto인 사람의 데이터 삭제
//     ref.orderByChild("userId").equalTo("toto").once("value", function(snapshot) {
//     snapshot.forEach(function(childSnapshot) {
//         var childKey = childSnapshot.key;
//         var childData = childSnapshot.val();
//         firebase.database().ref("경로/이름/" + childKey).remove()
//         .then(() => {
//             console.log("데이터 삭제 성공: " + childKey);
//         })
//         .catch((error) => {
//             console.error("데이터 삭제 실패: ", error);
//         });
//     });
//     });
//     */
// }
