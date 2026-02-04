/* eslint-disable */
import { onRequest } from "firebase-functions/v2/https";
import { Resend } from "resend";
import * as crypto from 'crypto';
import * as admin from "firebase-admin";
import "dotenv/config";
import { defineSecret } from "firebase-functions/params";

import OpenAI from "openai";
const clientAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// notion
import { Client } from "@notionhq/client";

admin.initializeApp();
const db = admin.firestore();

const NOTION_TOKEN = defineSecret("NOTION_TOKEN");
const REDIRECT_URI = "https://us-central1-notionable-secondbrain.cloudfunctions.net/notionOAuthCallback";

const allowedOrigins = ["http://localhost:4200", "https://notionable.net"];

export function withCors(handler: (req: any, res: any) => Promise<void> | void) {
    return async (req: any, res: any) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        }

        if (req.method === "OPTIONS") {
            // Preflight request: just return 204 with headers
            return res.status(204).send("");
        }

        try {
            await handler(req, res);
        } catch (err: any) {
            console.error("Function error:", err);
            res.status(500).json({ error: err.message || "Internal server error" });
        }
    };
}


// ----------------------
// Notion OAuth Auth
// ----------------------
export const notionAuth = onRequest(withCors((req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).send("userId is required");

    const redirectUri = encodeURIComponent(REDIRECT_URI);
    const state = encodeURIComponent(userId as string);

    const authUrl =
        "https://api.notion.com/v1/oauth/authorize" +
        `?client_id=${process.env.NOTION_CLIENT_ID}` +
        "&response_type=code" +
        "&owner=user" +
        `&redirect_uri=${redirectUri}` +
        `&state=${state}`;

    return res.redirect(authUrl);
}));

// ----------------------
// Notion Database 조회
// ----------------------
// export const getNotionDatabase = onRequest(
//     { secrets: [NOTION_TOKEN] },
//     withCors(async (req, res) => {
//         const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
//         const databaseId = url?.searchParams.get("databaseId");
//         if (!databaseId) return res.status(400).json({ error: "databaseId query parameter is required" });

//         const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
//             headers: {
//                 "Authorization": `Bearer ${NOTION_TOKEN.value()}`,
//                 "Notion-Version": "2022-06-28",
//             },
//         });

//         const data = await response.json();
//         res.json(data);
//     })
// );

// ----------------------
// 사용자 SecondBrain 연결 정보 조회
// ----------------------
export const getUserSecondBrainConnectInfo = onRequest(
    withCors(async (req, res) => {
        const userId = req.query.userId as string;
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();
        const notionSnap = await userRef.collection("integrations").doc("secondbrain").get();

        res.json({
            user: userSnap.data(),
            notion: notionSnap.exists ? notionSnap.data() : null,
        });
    })
);

// ----------------------
// Notion OAuth Callback
// ----------------------
export const notionOAuthCallback = onRequest(
    { secrets: [NOTION_TOKEN] },
    withCors(async (req, res) => {
        const code = req.query.code as string | undefined;
        const userId = (req.query.state as string) || "default_user";

        if (!code) return res.status(400).send("Missing authorization code");

        const clientId = process.env.NOTION_CLIENT_ID!;
        const clientSecret = process.env.NOTION_CLIENT_SECRET!;
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
            method: "POST",
            headers: { "Authorization": `Basic ${basicAuth}`, "Content-Type": "application/json" },
            body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Notion OAuth failed:", errorText);
            return res.status(500).send("Notion OAuth failed");
        }

        const notionToken = await tokenResponse.json();

        // note Database ID 얻기
        const noteDatabaseId = await NotionService.getDatabaseIdByDatabaseName(notionToken.access_token, 'note');

        // secondbrain 연결정보 저장
        await db.collection("users").doc(userId).collection("integrations").doc("secondbrain").set({
            accessToken: notionToken.access_token,
            workspaceId: notionToken.workspace_id,
            botId: notionToken.bot_id,
            duplicatedTemplateId: notionToken.duplicated_template_id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            noteDatabaseId: noteDatabaseId
        });

        // // 처음 한번 기존 노트에 키워드를 가져와서 저장한다. 
        // await NotionService.genetateNotionNoteKMData(notionToken.access_token, userId, noteDatabaseId);

        return res.redirect(`http://notionable.net/secondbrain/oauth-success?userId=${encodeURIComponent(userId)}`);
    })
);

// ----------------------
// UserService
// ----------------------
class UserService {
    static async saveClientInfo(params: { userId: string; clientId: string; origin?: string; userAgent?: string }) {
        const { userId, clientId, origin, userAgent } = params;
        const embedRef = db.collection('users').doc(userId).collection('integrations').doc('secondbrain').collection('clients').doc(clientId);

        await embedRef.set({
            clientId,
            origin: origin ?? null,
            userAgent: userAgent ?? null,
            revoked: false,
            lastAccessAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    // static async getSecondBrainIntegrations(userId: string) {
    //     const docSnap = await db.collection('users').doc(userId).collection('integrations').doc('secondbrain').get();
    //     return docSnap.exists ? docSnap.data() : null;
    // }
}

// ----------------------
// Integration 데이터 생성
// ----------------------
// export const createSecondBrainIntegrationData = onRequest(
//     withCors(async (req, res) => {
//         const { userId, clientdId } = req.body;
//         if (!userId || !embedId) return res.status(400).json({ success: false, message: 'userId, embedId 필요' });

//         await UserService.saveClientInfo({ userId, embedId, origin: req.get('origin') || undefined, userAgent: req.get('user-agent') || undefined });

//         const data = await UserService.getSecondBrainIntegration(userId);
//         if (!data?.accessToken) return res.status(400).json({ success: false, message: 'accessToken 없음' });

//         const dbId = await NotionService.getDatabaseIdByDatabaseName(data.accessToken, 'note');
//         await db.collection('users').doc(userId).collection('integrations').doc('secondbrain').set({ noteDbId: dbId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

//         return res.json({ success: true, dbId });
//     })
// );

// ----------------------
// 인증 이메일 발송
// ----------------------
const resend = new Resend(process.env.RESEND_API_KEY!);

export const sendVerificationEmail = onRequest(
    withCors(async (req, res) => {
        const email: string = req.body.email;
        if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        await db.collection('email_verifications').doc(email).set({
            code: hashedCode,
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
            attempts: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await resend.emails.send({
            from: 'Notionable <noreply@notionable.net>',
            to: email,
            subject: 'Notionable SecondBrain API연동 인증번호 안내',
            text: `인증번호: ${code} 유효시간: 10분
            Notionable SecondBrain API 연동을 위해 인증번호를 발급하였습니다.
            요청하신 템플릿에서 아래 인증번호를 입력해 주세요.`,
        });

        return res.status(200).json({ success: true });
    })
);

export const verifyCode = onRequest(withCors(async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(200).json({ message: '이메일과 인증번호가 필요합니다.' });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(200).json({ message: '이메일 형식이 올바르지 않습니다.' });
        }

        // Firestore에서 인증 코드 가져오기
        const docRef = db.collection('email_verifications').doc(email);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(200).json({ message: '인증번호를 먼저 요청해주세요.' });
        }

        const data = docSnap.data();
        const hashedInput = crypto.createHash('sha256').update(code).digest('hex');

        // 만료 확인
        const now = admin.firestore.Timestamp.now();
        if (data!.expiresAt.toMillis() < now.toMillis()) {
            return res.status(200).json({ message: '인증번호가 만료되었습니다.' });
        }

        // 코드 비교
        if (hashedInput !== data!.code) {
            await docRef.update({ attempts: (data!.attempts || 0) + 1 });
            return res.status(200).json({ message: '인증번호가 올바르지 않습니다.' });
        }

        ///////////////////////////////////
        // 인증 성공

        // 1️⃣ 기존 user 조회 (email 기준)
        const userQuerySnap = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        let userId: string;

        // 2️⃣ user가 이미 존재하면 재사용
        if (!userQuerySnap.empty) {
            userId = userQuerySnap.docs[0].id;
        } else {
            // 3️⃣ 없으면 새 user 생성
            userId = crypto.randomUUID();
            await db.collection('users').doc(userId).set({
                email,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 4️⃣ clientId는 항상 새로 생성
        const clientId = crypto.randomUUID();

        // clients/{clientId} 저장
        await UserService.saveClientInfo({
            userId,
            clientId,
            origin: req.get('origin') || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        // 5️⃣ 사용 후 인증번호 삭제
        await docRef.delete();

        // 6️⃣ 성공 결과 반환
        return res.status(200).json({ userId, clientId });
    } catch (error: any) {
        console.error('verifyCode error:', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}));

///////////////////////////////////////////////////////////////////////////////////////////////
// NotionService #notion

class NotionService {
    // Notion 클라이언트
    notionApi = null; 

    static apiVersion = '2022-06-28';
    static async getDatabaseIdByDatabaseName(accessToken: string, databaseName: string): Promise<string> {
        const url = 'https://api.notion.com/v1/search';
        const body = { query: databaseName, filter: { property: 'object', value: 'database' } };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Notion-Version': this.apiVersion,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const rawText = await response.text();
        if (!response.ok) throw new Error(`Notion API 호출 실패: ${response.status} / ${rawText}`);

        const data = JSON.parse(rawText);
        console.log("[DEBUG] getDatabaseIdByDatabaseName data, databaseName =>", data, databaseName);
        const matched = data.results.filter((item: any) => (item.title?.map((t: any) => t.plain_text).join('') ?? '') === databaseName);

        if (!matched.length) throw new Error(`"${databaseName}" Database를 찾을 수 없습니다.`);
        if (matched.length > 1) throw new Error(`"${databaseName}" Database가 여러 개 존재합니다.`);

        return matched[0].id;
    }
  
    // queryDatabase 함수
    static async queryDatabase(accessToken: string, databaseId: string, startCursor?: string) {
        const cleanDbId = databaseId.trim();
        // databaseId에서 -를 제거
        const formattedDbId = cleanDbId.replace(/-/g, '');
        console.log("[DEBUG] 사용될 URL:", `https://api.notion.com/v1/databases/${formattedDbId}/query`);
        console.log("[DEBUG] 사용될 AccessToken:", accessToken.slice(0, 8) + "...");
        const body: any = { page_size: 100 };
        if (startCursor) body.start_cursor = startCursor;

        console.log("[DEBUG] queryDatabase 호출, databaseId:", databaseId, "startCursor:", startCursor);
        console.log("[DEBUG] request body:", body);

        const res = await fetch(`https://api.notion.com/v1/databases/${formattedDbId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                //'Notion-Version': '2025-09-03',
                "Notion-Version": this.apiVersion,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        console.log("[DEBUG] HTTP status:", res.status);

        if (!res.ok) {
            const text = await res.text();
            console.error("[DEBUG] Notion API 호출 실패:", text);
            throw new Error(text);
        }

        const data = await res.json();
        console.log("[DEBUG] queryDatabase 응답 확인:", {
            has_more: data.has_more,
            next_cursor: data.next_cursor,
            results_count: data.results?.length
        });

        return data;
    }


    static async applyKeywordsToNotionPages(accessToken: string,  aiResultKeyword: Record<string, string[]>) {
        
        for (const [pageId, keywords] of Object.entries(aiResultKeyword)) {
            if (!keywords || keywords.length === 0) continue;

            const cleanedKeywords = aiResultKeyword[pageId].flatMap(k => 
                k.split(',').map(s => s.trim()).filter(Boolean)
            );

            const notion = new Client({
                auth: accessToken,
            });

            try {
                await notion.pages.update({
                    page_id: pageId,
                    properties: {
                        키워드: {
                            multi_select: cleanedKeywords.map(name => ({ name }))
                        },
                    },
                });
                console.log(`✅ 키워드 반영 완료: ${pageId}`);
            } catch (error) {
                console.error(`❌ 키워드 반영 실패: ${pageId}`, error);
            }
        }
    }

    // 노션 키워드 읽어서 Firestore 저장 함수
    // static async genetateNotionNoteKMData(accessToken: string, userId: string, noteDatabaseId: string) {
    //     let cursor: string | undefined = undefined;

    //     console.log("[DEBUG] genetateNotionNoteKMData 시작");
    //     console.log("[DEBUG] userId:", userId, "noteDatabaseId:", noteDatabaseId);

    //     do {
    //         console.log("[DEBUG] 현재 cursor:", cursor);

    //         const response: any = await NotionService.queryDatabase(accessToken, noteDatabaseId, cursor);
    //         console.log("[DEBUG] queryDatabase 응답 확인, results 개수:", response.results?.length);

    //         // sateNoteKeywordsToFirestore 부분 => 이거 함수로 뺴서 호출            
    //         for (const page of response.results) {
    //             const noteId = page.id;
    //             const docRef = db
    //                 .collection("users")
    //                 .doc(userId)
    //                 .collection("integrations")
    //                 .doc("secondbrain")
    //                 .collection("pages")  // pages, projects, folders....
    //                 .doc(noteId)  // noteId 문서에 바로 keywords 필드

    //             const docSnap = await docRef.get();

    //             // const oldKeywords: string[] = docSnap.exists ? docSnap.data()?.keywords || [] : [];

    //             //키워드 업데이트 하기
    //             // const keywordsProperty = page.properties["키워드"];
    //             // const newKeywords: string[] = keywordsProperty && keywordsProperty.type === "multi_select"
    //             //     ? keywordsProperty.multi_select.map((item: any) => item.name)
    //             //     : [];

    //             // // 비교 후 처리
    //             // if (oldKeywords.length === 0 && newKeywords.length > 0) {
    //             //     // create
    //             //     console.log("[DEBUG] 키워드 생성:", noteId, newKeywords);
    //             //     await docRef.set({ keywords: newKeywords });
    //             // } else if (oldKeywords.length > 0 && newKeywords.length === 0) {
    //             //     // delete
    //             //     console.log("[DEBUG] 키워드 삭제:", noteId);
    //             //     await docRef.update({ keywords: admin.firestore.FieldValue.delete() });
    //             // } else if (JSON.stringify(oldKeywords) !== JSON.stringify(newKeywords)) {
    //             //     // update
    //             //     console.log("[DEBUG] 키워드 변경 업데이트:", noteId, newKeywords);
    //             //     await docRef.set({ keywords: newKeywords }, { merge: true });
    //             // } else {
    //             //     // no change
    //             //     console.log("[DEBUG] 변화 없음, 저장 생략:", noteId);
    //             // }
    //         }


    //         cursor = response.has_more ? response.next_cursor : undefined;
    //         console.log("[DEBUG] 다음 cursor:", cursor);

    //     } while (cursor);

    //     console.log("모든 노트 키워드 Firestore에 저장 완료");
    // }

}



//class StoreService {

    // pages 컬렉션에서 모든 노트의 키워드 가져오기
    // async getNoteKeywords(userId: string): Promise<Record<string, string[]> | null> {
    //     // 1️⃣ pages 컬렉션에서 note 문서들 가져오기
    //     const pagesSnap = await db
    //         .collection("users")
    //         .doc(userId)
    //         .collection("integrations")
    //         .doc("secondbrain")
    //         .collection("pages")
    //         .get();

    //     const allKeywords: Record<string, string[]> = {};

    //     pagesSnap.forEach(doc => {
    //         const data = doc.data();
    //         if (Array.isArray(data?.keywords) && data.keywords.length > 0) {
    //             allKeywords[doc.id] = data.keywords;
    //         }
    //     });

    //     if (Object.keys(allKeywords).length === 0) {
    //         return null;
    //     }
    //     return allKeywords;
    // }
//}


// Firestore에 컨셉 저장 및 노드/엣지 그래프 데이터 생성 함수
// async function saveKeywordsAndBuildGraph(userId: string, keywordsByNote: Record<string, string[]>): Promise<{ nodes: Node[]; edges: Edge[] }> {
//     const batch = db.batch();
//     for (const [noteId, keywords] of Object.entries(keywordsByNote)) {
//         const noteRef = db
//             .collection("users")
//             .doc(userId)
//             .collection("integrations")
//             .doc("secondbrain")
//             .collection("pages")
//             .doc(noteId);
//         batch.set(
//             noteRef,
//             {
//                 keywords,
//                 updatedAt: new Date(),
//             },
//             { merge: true }
//         );
//     }
//     await batch.commit();

//     const nodes: Node[] = [];
//     const edges: Edge[] = [];
//     const conceptToNodeId: Record<string, string> = {};
//     let conceptCounter = 1;
//     for (const [noteId, keywords] of Object.entries(keywordsByNote)) {
//         const noteNodeId = `note-${noteId}`;
//         nodes.push({
//             id: noteNodeId,
//             label: noteId,
//             group: "note",
//         });
//         for (const concept of keywords) {
//             if (!conceptToNodeId[concept]) {
//                 const conceptNodeId = `concept-${conceptCounter++}`;
//                 conceptToNodeId[concept] = conceptNodeId;
//                 nodes.push({
//                     id: conceptNodeId,
//                     label: concept,
//                     group: "concept",
//                 });
//             }
//             edges.push({
//                 from: noteNodeId,
//                 to: conceptToNodeId[concept],
//             });
//         }
//     }
//     return { nodes, edges };
// }



// Firebase HTTPS 함수
// export const genetateNotionNoteKMData = onRequest(withCors(async (req, res) => {
//     try {
//         const { userId } = req.body;
//         if (!userId) {
//             res.status(400).send("userId를 전달해야 합니다.");
//             return;
//         }

//         // 1️⃣ Firestore에서 noteDatabaseId 가져오기
//         const sbDoc = await db
//             .collection("users")
//             .doc(userId)
//             .collection("integrations")
//             .doc("secondbrain")
//             .get();

//         if (!sbDoc.exists) {
//             res.status(404).send("secondbrain 문서를 찾을 수 없습니다.");
//             return;
//         }

//         const data = sbDoc.data();
//         const noteDatabaseId = data?.noteDatabaseId;
//         const accessToken = data?.accessToken;
//         if (!noteDatabaseId) {
//             res.status(404).send("noteDatabaseId가 Firestore에 존재하지 않습니다.");
//             return;
//         }
//         if (!accessToken) {
//             res.status(404).send("accessToken가 Firestore에 존재하지 않습니다.");
//             return;
//         }

//         // 2️⃣ 노션 키워드 Firestore에 저장
//         await NotionService.genetateNotionNoteKMData(accessToken, userId, noteDatabaseId);

//         res.status(200).send("노션 키워드 Firestore 저장 완료");
//     } catch (error: any) {
//         console.error(error);
//         res.status(500).send(error.message);
//     }
// }));

// 타입 정의 (Node/Edge)
// interface Node { id: string; label: string; group?: string; }
// interface Edge { from: string; to: string; }

// export const generateNoteKMData = onRequest(
//     withCors(async (req, res) => {
//         try {
//             const { userId } = req.body;
//             if (!userId) {
//                 return res.status(400).send("userId를 전달해야 합니다.");
//             }

//             // 1️⃣ pages 컬렉션에서 note 문서들 가져오기
//             const storeService = new StoreService();
//             const noteKeywords = await storeService.getNoteKeywords(userId);

//             if (!noteKeywords) {
//                 return res.status(200).json({ message: "저장된 키워드가 없습니다." });
//             }


//             // 2️⃣ AI에 컨셉 요청
//             const keywordsByNote = await requestKeywordsFromAI(noteKeywords);

//             //////////////////////////////////////////////////

//             // 3️⃣ Firestore에 컨셉 저장 및 노드/엣지 그래프 데이터 생성
//             const { nodes, edges } = await saveKeywordsAndBuildGraph(userId, keywordsByNote);

//             // 4️⃣ 결과 반환
//             return res.status(200).json({
//                 keywordsByNote,
//                 nodes,
//                 edges,
//             });

//         } catch (error: any) {
//             console.error(error);
//             return res.status(500).send(error.message);
//         }
//     })
// );


// export const updateNoteData = onRequest(withCors(async (req, res) => {
//      try {
//         const { userId } = req.body;
//         if (!userId) {
//             res.status(400).send("userId를 전달해야 합니다.");
//             return;
//         }

//         // 1️⃣ Firestore에서 noteDatabaseId 가져오기
//         const sbDoc = await db
//             .collection("users")
//             .doc(userId)
//             .collection("integrations")
//             .doc("secondbrain")
//             .get();

//         if (!sbDoc.exists) {
//             res.status(404).send("secondbrain 문서를 찾을 수 없습니다.");
//             return;
//         }

//         const data = sbDoc.data();
//         const noteDatabaseId = data?.noteDatabaseId;
//         const accessToken = data?.accessToken;
//         if (!noteDatabaseId) {
//             res.status(404).send("noteDatabaseId가 Firestore에 존재하지 않습니다.");
//             return;
//         }
//         if (!accessToken) {
//             res.status(404).send("accessToken가 Firestore에 존재하지 않습니다.");
//             return;
//         }

//         // 예시: 노션 DB에서 페이지 목록을 받아온 후 각 page에 대해 Firestore 저장
//         // const response = await NotionService.queryDatabase(accessToken, noteDatabaseId);
//         // for (const page of response.results) {
//         //     try {
//         //         await updateNotePropertiesInFirestore(userId, page);
//         //     } catch (err) {
//         //         console.error("노트 속성 저장 실패:", err);
//         //     }
//         // }

//         // res.status(200).send("노트 속성 Firestore 저장 완료");

//     } catch (error: any) {
//         console.error(error);
//         res.status(500).send(error.message);
//     }
// }));


// #main #메인
// 노션 page의 속성(title, content, keywords 등)을 Firestore에 저장하는 HTTPS 함수 
export const generateNotionNoteKMDataBatch = onRequest(
    {
        timeoutSeconds: 540,
        memory: "1GiB",
    },
    withCors(async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send("userId를 전달해야 합니다.");
        }

        // Firestore에서 Notion accessToken, noteDatabaseId 가져오기
        const sbDoc = await db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("secondbrain")
            .get();

        if (!sbDoc.exists) {
            return res.status(404).send("secondbrain 문서를 찾을 수 없습니다.");
        }
        const data = sbDoc.data();
        const noteDatabaseId = data?.noteDatabaseId;
        const accessToken = data?.accessToken;
        if (!noteDatabaseId || !accessToken) {
            return res.status(404).send("noteDatabaseId 또는 accessToken이 Firestore에 존재하지 않습니다.");
        }
        
        // Notion DB에서 모든 page 가져오기
        const response = await NotionService.queryDatabase(accessToken, noteDatabaseId);
        let successCount = 0, failCount = 0;
        const batchPages: { pageId: string; title: string; content: string; keywords: string[] }[] = [];

        // page.content가져오느라 시간이 많이 걸리는 부분
        let testIndex = 0;
        for (const page of response.results) {
            try {     
                // keyword가 db에 없으면 노션에서 가져옴
                const pageData: { pageId: string; title: string; content: string; keywords: string[]; } | null  
                    = await updateNotePropertiesInFirestore(userId, page, accessToken);
                if (!pageData) { continue; }
                batchPages.push(pageData);
                successCount++;
            } catch (err) {
                console.error("노트 속성 저장 실패:", err);
                failCount++;
            }
            testIndex++;
            if (testIndex >= 5) break; // 테스트용으로 5개만 처리
        }
        console.error("[DEBUG] batchPages =>", batchPages);

        const BATCH_SIZE = 10;
        for (let i = 0; i < batchPages.length; i += BATCH_SIZE) {
            const batch = batchPages.slice(i, i + BATCH_SIZE);
            const pageData: Record<
                string,
                { title: string; content: string; keywords: string[] }
            > = {};

            batch.forEach(n => {
                pageData[n.pageId] = {
                    title: n.title,
                    content: n.content,
                    keywords: n.keywords,
                };
            });

            try {
                /* 키워드 추출 */ 
                // let aiResultKeyword = await requestPageKeywordsFromAI(pageData); // 제목, 컨텐츠, 키워드 사용
                // console.log(`[DEBUG] Keywords 배치  ${i / BATCH_SIZE + 1} aiResultKeyword =>`, aiResultKeyword);
                // aiResultKeyword = filterUndefinedId(pageData, aiResultKeyword);
                
                /////////////////
                // 컨셉 추출       
                
                // 기존 컨셉 리스트 가져오기
                let existingKeywords: string[] = await loadKeywordsFromCache(userId);

                // 컨셉 추출
                let aiResultKeywords = await requestPageKeywordsFromAI(pageData, existingKeywords);
                aiResultKeywords = filterUndefinedId(pageData, aiResultKeywords);

                const normalized: Record<string, string[]> = {};
                for (const [key, keywords] of Object.entries(aiResultKeywords)) {
                    normalized[key] = Array.from(
                        new Set(
                            keywords.map(keyword =>
                                normalizeKeyword(keyword, existingKeywords)
                            )
                        )
                    );
                }
                aiResultKeywords = normalized;


                // notion에 keyword반영
                await NotionService.applyKeywordsToNotionPages(accessToken, aiResultKeywords);

                //////////////////////////////////
                // 3️⃣ AI 결과 Firestore 저장
                for (const pageId of Object.keys(aiResultKeywords)) {
                    await db
                        .collection("users")
                        .doc(userId)
                        .collection("integrations")
                        .doc("secondbrain")
                        .collection("pages")
                        .doc(pageId)
                        .set(
                        {
                            keywords: aiResultKeywords[pageId] || [], // 안전하게 배열 초기화
                            title: pageData[pageId]?.title || "",   // 안전하게 title 처리
                        },
                        { merge: true }
                    );
                }

                // 키워드 캐시 업데이트 // 키워드 모두 읽어서 한곳에 저장
                let newExistingKeywords: string[] = await loadKeywordsFromPages(userId);
                console.log('newExistingKeywords =>', newExistingKeywords);
                upsertKeywords(userId, newExistingKeywords);

                console.log(`[DEBUG] Keywords 배치 ${i / BATCH_SIZE + 1}:`, aiResultKeywords);
                successCount += batch.length;
            } catch (err) {
                console.error("AI 처리 실패:", err);
                failCount += batch.length;
            }
        }

        res.status(200).json({
            message: "노트 속성 + AI keywords + keywords 저장 완료",
            successCount,
            failCount,
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).send(error.message);
    }
}));

// type NormalizeResult = {
//     canonical: string;
//     source: 'existing' | 'alias' | 'translated' | 'similarity' | 'new';
// };

// type NormalizeOptions = {
//     aliasMap?: Record<string, string>;
//     nonTranslatable?: Set<string>;
//     similarityThreshold?: number;
// };



/**
 * source: 원래 페이지 데이터 (id가 키)
 * aiResult: AI가 반환한 결과 (id가 키)
 * 
 * source에 존재하는 id 중, aiResult에 undefined이거나 존재하지 않는 id를 제거
 */
function filterUndefinedId<T>(
    source: Record<string, any>,
    aiResult: Record<string, T>
): Record<string, T> {
    const filtered: Record<string, T> = {};

    for (const id of Object.keys(source)) {
        if (id in aiResult && aiResult[id] !== undefined && aiResult[id] !== null) {
        filtered[id] = aiResult[id];
        }
    }

    return filtered;
}

// pages/pageId/keywords에서 컨셉을 가져와서 합친다.
async function loadKeywordsFromPages(userId: string): Promise<string[]> {
    const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .collection("pages")
        .get();

  const keywordsSet = new Set<string>();

    snapshot.forEach(doc => {
        const data = doc.data();
        const keywords: string[] = data.keywords ?? []; // 없으면 빈 배열로
        keywords.forEach(c => keywordsSet.add(c));
    });

    return Array.from(keywordsSet);
}

async function loadKeywordsFromCache(userId: string): Promise<string[]> {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("integrations")
    .doc("secondbrain")
    .collection("keywords")
    .get();
  return snapshot.docs.map(d => d.id);
}

async function upsertKeywords(userId: string, keywords?: string[]) {
    if (!keywords || keywords.length === 0) return; // 아무것도 없으면 종료
    const baseRef = db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .collection("keywords");

    for (const keyword of keywords) {
    if (!keyword) continue;
        const ref = baseRef.doc(keyword);
        await ref.set(
            {
                name: keyword,
                updatedAt: new Date(),
                noteCount: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
        );
    }
}


// Notion page에서 제목, 내용, 키워드 Firestore 저장 (외부 함수)
// Notion page에서 제목, 내용(text 블록만), 키워드 Firestore 저장

// 노트의 title, keywords, content Firestore 저장 (중간 로그 포함)
// async function updateNotePropertiesInFirestore(userId: string, page: any, accessToken: string): Promise<{ 
//     pageId: string; title: string; content: string; keywords: string[] }> {
//     const pageId = page.id;

//     // 1️⃣ 제목
//     const titleProperty = page.properties["이름"] || page.properties["제목"] || page.properties["Title"];
//     let title = "";
//     if (titleProperty && titleProperty.type === "title" && Array.isArray(titleProperty.title)) {
//         title = titleProperty.title.map((t: any) => t.plain_text).join("");
//         if (["새 문서", "Untitled"].includes(title.trim())) title = "";
//     }

//     // 2️⃣ 키워드
//     const keywordsProperty = page.properties["키워드"];
//     const keywords: string[] = (keywordsProperty && keywordsProperty.type === "multi_select")
//         ? keywordsProperty.multi_select.map((item: any) => item.name)
//         : [];

//     // 3️⃣ 내용 (블록 텍스트)
//     const content = await getPageContentText(pageId, accessToken);

//     // 4️⃣ 중간 로그
//     console.log(`[DEBUG] updateNotePropertiesInFirestore - noteId: ${pageId}`);
//     console.log(`         title: ${title}`);
//     console.log(`         keywords: ${keywords.join(", ")}`);
//     console.log(`         content length: ${content.length}`);

//     // 5️⃣ Firestore 업데이트
//     // 당장에 쓸거 아니고 직절로 하면 매우 느리니 await 뺌
//     updateNotePropertiesInFirestoreInternal(userId, pageId, keywords);

//     console.log(`[DEBUG] Firestore 업데이트 완료 - pageId: ${pageId}`);
//     return { pageId, title, content, keywords };
// }

async function updateNotePropertiesInFirestore(
    userId: string,
    page: any,
    accessToken: string
): Promise<{
    pageId: string;
    title: string;
    content: string;
    keywords: string[];
} | null> {
    const pageId = page.id;   

    // 🚫 0️⃣ Firestore에 이미 keywords 있으면 스킵
    const pageDocRef = db.collection("users").doc(userId).collection("integrations").doc("secondbrain").collection("pages").doc(pageId);
    const pageSnap = await pageDocRef.get();
    if (pageSnap.exists) {
        const data = pageSnap.data();
        if (data?.keywords && data?.title && data?.keywords) {
            console.log(
                `[SKIP] pageId: ${pageId} - Firestore에 이미 KM Property 존재 (${data.keywords.length}개)`
            );
            return null;
        }
    }

    // 1️⃣ 제목
    const titleProperty =
        page.properties["이름"] ||
        page.properties["제목"] ||
        page.properties["Title"];

    let title = "";
    if (
        titleProperty &&
        titleProperty.type === "title" &&
        Array.isArray(titleProperty.title)
    ) {
        title = titleProperty.title.map((t: any) => t.plain_text).join("");
        if (["새 문서", "Untitled"].includes(title.trim())) title = "";
    }

    // 2️⃣ 키워드 (비어 있음 확정 상태)
    const keywords: string[] = [];

    // 3️⃣ 내용 (여기부터 비싼 작업)
    const content = await getPageContentText(pageId, accessToken);

    // 4️⃣ 로그
    console.log(`[DEBUG] updateNotePropertiesInFirestore - noteId: ${pageId}`);
    console.log(`         title: ${title}`);
    console.log(`         keywords: 없음 (새로 생성 예정)`);
    console.log(`         content length: ${content.length}`);

    // 5️⃣ Firestore 업데이트 (비동기)
    updateNotePropertiesInFirestoreInternal(userId, pageId, keywords);

    console.log(`[DEBUG] Firestore 업데이트 완료 - pageId: ${pageId}`);

    return { pageId, title, content, keywords };
}


// Firestore에 실제 저장 (내부 함수)
async function updateNotePropertiesInFirestoreInternal(
    userId: string,
    pageId: string,
    keywords?: string[]
): Promise<void> {
    const docRef = db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .collection("pages")
        .doc(pageId);

    // 저장할 데이터 객체 구성 (값 있는 것만)
    const dataToSave: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (Array.isArray(keywords) && keywords.length > 0) {
        dataToSave.keywords = keywords;
    }

    // 값이 하나라도 있으면 Firestore에 저장
    if (Object.keys(dataToSave).length > 1) { // updatedAt 제외한 필드가 있으면
        await docRef.set(dataToSave, { merge: true });
    }
}



// 페이지 블록에서 텍스트(content)만 추출 (재귀 포함)
async function getPageContentText(pageId: string, accessToken: string): Promise<string> {
    let content: string[] = [];

    // 재귀적으로 블록에서 텍스트 추출
    async function extractBlockText(blocks: any[]): Promise<void> {
        for (const b of blocks) {
            try {
                let blockText = "";
                switch (b.type) {
                    case "paragraph":
                        blockText = (b.paragraph?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "heading_1":
                        blockText = (b.heading_1?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "heading_2":
                        blockText = (b.heading_2?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "heading_3":
                        blockText = (b.heading_3?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "bulleted_list_item":
                        blockText = (b.bulleted_list_item?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "numbered_list_item":
                        blockText = (b.numbered_list_item?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "quote":
                        blockText = (b.quote?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    case "callout":
                        blockText = (b.callout?.rich_text ?? []).map((t: any) => t.plain_text).join("");
                        break;
                    default:
                        blockText = "";
                }

                if (blockText.trim()) content.push(blockText);

                // 하위 블록 재귀 호출
                if (b.has_children) {
                    const childRes = await fetch(`https://api.notion.com/v1/blocks/${b.id}/children?page_size=100`, {
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Notion-Version": "2022-06-28",
                            "Content-Type": "application/json",
                        },
                    });
                    const childData = await childRes.json();
                    if (Array.isArray(childData.results) && childData.results.length > 0) {
                        await extractBlockText(childData.results);
                    }
                }
            } catch (err) {
                console.error("블록 텍스트 추출 실패:", err, b);
            }
        }
    }

    try {
        const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
        });

        const blocksData = await blocksRes.json();
        console.log(`[DEBUG] getPageContentText - blocksData.results length: ${blocksData.results?.length}`);

        if (Array.isArray(blocksData.results)) {
            await extractBlockText(blocksData.results);
        }
    } catch (err) {
        console.error("Notion blocks 가져오기 실패:", err);
    }

    const finalContent = content.join("\n");
    console.log(`[DEBUG] getPageContentText - pageId: ${pageId}, content length: ${finalContent.length}`);
    return finalContent;
}

/**
 * normalizeKeyword
*/

const SIMILARITY_THRESHOLD = 0.8;

function normalizeForCompare(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

function buildAliasIndex(existing: string[]) {
  const map = new Map<string, string>();

  for (const k of existing) {
        map.set(normalizeForCompare(k), k);

        // 👇 영어로 쓰일 가능성 있는 경우 대비
        const en = toEnglishGuess(k);
        if (en) {
        map.set(normalizeForCompare(en), k);
        }
  }

  return map;
}

function toEnglishGuess(korean: string): string | null {
    const table: Record<string, string> = {
        '노션': 'notion',
        '세컨드브레인': 'second brain',
        '세컨드 브레인': 'second brain',
    };
    return table[korean] ?? null;
}

function normalizeKeyword(
        raw: string,
        existingKeywords: string[]
    ): string {
    const aliasIndex = buildAliasIndex(existingKeywords);
    const key = normalizeForCompare(raw);

    // 1️⃣ exact / alias match
    const matched = aliasIndex.get(key);
    if (matched) return matched;

    // 2️⃣ similarity (보조 안전망)
    let best: { k: string; score: number } | null = null;

    for (const k of existingKeywords) {
        const score = similarity(
        normalizeForCompare(raw),
        normalizeForCompare(k)
        );
        if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { k, score };
        }
    }

    if (best) return best.k;

    // 3️⃣ fallback
    return raw;
}

// function normalizeText(str: string) {
//     return str.toLowerCase().trim();
// }

// export function normalizeConcept(
//     rawConcept: string,
//     existingConcepts: string[],
//     options: NormalizeOptions = {}
// ): NormalizeResult {
// if (!rawConcept) {
//     throw new Error('rawConcept is empty');
// }

// const {
//     aliasMap = {},
//     nonTranslatable = new Set<string>(),
//     similarityThreshold = 0.92,
// } = options;


// const normalize = (s: string) =>
//     s.trim().toLowerCase();

//     const raw = rawConcept.trim();
//     const rawNorm = normalize(raw);

//     // 1️⃣ exact match (case-insensitive)
//     for (const c of existingConcepts) {
//         if (normalize(c) === rawNorm) {
//         return { canonical: c, source: 'existing' };
//         }
//     }

//     // 2️⃣ alias dictionary (strong override)
//     if (aliasMap[rawNorm]) {
//         return { canonical: aliasMap[rawNorm], source: 'alias' };
//     }

//     // 3️⃣ 영어 → 한글 번역 기반 흡수 (매칭 전용)
//     if (isEnglish(raw) && !nonTranslatable.has(rawNorm)) {
//         const translated = translateEnToKo(raw); // 🔧 구현체 주입
//         if (translated) {
//         const translatedNorm = normalize(translated);

//         for (const c of existingConcepts) {
//             if (normalize(c) === translatedNorm) {
//             return { canonical: c, source: 'translated' };
//             }
//         }
//         }
//     }

//     // 4️⃣ similarity match (Levenshtein / embedding)
//     const similar = findMostSimilar(raw, existingConcepts, similarityThreshold);
//     if (similar) {
//         return { canonical: similar, source: 'similarity' };
//     }

//     // 5️⃣ fallback: new concept (raw 그대로)
//     return { canonical: raw, source: 'new' };
// }

// function isEnglish(text: string): boolean {
//     return /^[a-zA-Z0-9\s\-]+$/.test(text);
// }

// function translateEnToKo(text: string): string | null {
//     // ❗️여기서는 OpenAI / Papago / Google 등 어떤 구현이든 가능
//     // 단, 결과는 "기존 키워드 흡수용"으로만 사용
//     return mockTranslate[text.toLowerCase()] ?? null;
// }

// const mockTranslate: Record<string, string> = {
//     notion: '노션',
//     'second brain': '세컨드 브레인',
// };

// const aliasMap = {
//     'chatgpt': 'ChatGPT',
//     'gpt': 'GPT',
// };

// const nonTranslatable = new Set([
//     'firebase',
//     'react',
//     'vue',
//     'aws',
//     'openai',
// ]);

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
    const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
    return 1 - dist / Math.max(a.length, b.length);
}

// function findMostSimilar(
//     raw: string,
//     existing: string[],
//     threshold: number
// ): string | null {
//     let best: { value: string; score: number } | null = null;

//     for (const c of existing) {
//         const score = similarity(raw, c);
//         if (score >= threshold && (!best || score > best.score)) {
//         best = { value: c, score };
//         }
//     }

//     return best?.value ?? null;
// }

// async function requestPageKeywordsFromAI(noteData: Record<string, { keywords: string[]; title?: string; content?: string }>): Promise<Record<string, string[]>> {

//   let prompt = `
// Extract keywords from the note content.

// Input Usage:
// - Prefer extracting keywords that appear in Content.
// - Use Title and Existing Keywords only to reinforce or disambiguate terms.
// - Do not invent terms that do not appear in Title or Content.

// Rules:
// - Extract words or short noun phrases (1–3 words).
// - Prefer terms that actually appear in the text.
// - Include proper nouns, technical terms, and domain terms.
// - Do not summarize or interpret meaning.
// - Do not normalize, merge, or replace terms.
// - Extract up to 15 keywords.

// Notes:
// - Use the title first if it is meaningful.
// - Ignore titles like "새 문서" or other non-informative titles.
// - Refer to existing keywords as hints only.

// Output:
// - JSON object
// - Keys: noteId
// - Values: string[] (keywords only)
// - No explanations.
// `;

//     for (const [noteId, { keywords, title, content }] of Object.entries(noteData)) {
//         prompt += `
// [NoteId: ${noteId}]
// `;
//     if (title) prompt += `Title: ${title}\n`;
//     if (content) prompt += `Content: ${content}\n`;
//     if (keywords && keywords.length > 0) {
//         prompt += `Existing Keywords: ${keywords.join(", ")}\n`;
//     }
// }
// //////////////////////////////////////////////////

//     const response = await clientAI.chat.completions.create({
//         model: "gpt-4.1-mini",
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.4,
//     });

//     const text = response.choices[0].message?.content || "{}";
//     console.log("[DEBUG] AI 응답 텍스트:", text);
//     try {
//         return JSON.parse(text);
//     } catch (err) {
//         console.error("AI 응답 JSON 파싱 실패:", text);
//         throw new Error("AI 응답 JSON 파싱 실패");
//     }
// }

// async function requestPageKeywordsFromAI(
//   noteData: Record<string, { keywords: string[]; title?: string; content?: string }>
// ): Promise<Record<string, string[]>> {

//   let prompt = `
// Extract keywords from the note content.

// Input Usage:
// - Prefer extracting keywords that appear in the Content.
// - Use Title and Existing Keywords only to reinforce or disambiguate terms.
// - Do not invent terms that do not appear in Title or Content.
// - Do NOT translate, localize, paraphrase, or rewrite the Content. Use it verbatim as extracted from the source.

// Critical Constraints:
// - Keywords MUST be copied verbatim from the original Title or Content.
// - Do NOT translate, localize, paraphrase, or rewrite keywords.
// - Preserve the original language, spelling, spacing, and casing exactly as they appear.
// - If a term appears in English, keep it in English.
// - If a term appears in Korean, keep it in Korean.

// Rules:
// - Extract words or short noun phrases (1–3 words).
// - Prefer terms that actually appear in the text.
// - Include proper nouns, technical terms, and domain terms.
// - Do not summarize or interpret meaning.
// - Do not normalize, merge, or replace terms.
// - Extract up to 10 keywords only.

// Notes:
// - Use the title first if it is meaningful.
// - Ignore titles like "새 문서" or other non-informative titles.
// - Refer to existing keywords as hints only.
// - Always show the actual text from Content (including paragraphs, lists, headings) as-is without translating.

// Output Format Contract:
// - Return a single JSON object
// - Each key MUST be a pageId from the input
// - Each value MUST be an array of strings (maximum 10 items)
// - Do NOT include null, comments, or trailing commas

// Critical Constraints:
// - Do NOT modify pageId in any way.
// - Return pageId exactly as provided in the input, including all hyphens and lowercase letters.

// `;

//   for (const [pageId, { keywords, title, content }] of Object.entries(noteData)) {
//     prompt += `\n[pageId: "${pageId}"]\n`; // 따옴표로 감싸서 AI가 문자 그대로 처리하도록 강제
//     if (title) prompt += `Title: ${title}\n`;
//     if (content) prompt += `Content: ${content}\n`;
//     if (keywords?.length) {
//       prompt += `Existing Keywords: ${keywords.join(", ")}\n`;
//     }
//   }
  
//     const response = await clientAI.chat.completions.create({
//         model: "gpt-4.1-mini",
//         messages: [
//             {
//             role: "system",
//             content: `
// You are a strict JSON generator.
// Return valid raw JSON only.
// Do not include markdown, code blocks, or explanations.
//         `
//             },
//             {
//             role: "user",
//             content: prompt
//             }
//         ],
//         temperature: 0.4, // 👈 키워드는 컨셉보다 살짝 높게
//     });

//   const text = response.choices[0].message?.content || "";
//   console.log("[DEBUG] AI 응답 텍스트:", text);

//   try {
//     return safeParseAIJson(text);
//   } catch (err) {
//     console.error("AI 응답 JSON 파싱 실패:", {
//       error: err,
//       rawResponse: text,
//     });
//     throw err;
//   }
// }

async function requestPageKeywordsFromAI(
  noteData: Record<string, { title?: string; content?: string; keywords: string[] }>,
  existingKeywords: string[]): Promise<Record<string, string[]>> {

    console.log('requestPageKeywordsFromAI existingKeywords =>', existingKeywords);
// Extract representative keywords from the note.

// Input Usage:
// - Use the Note Content as the primary source of meaning.
// - Use Keywords only as supporting hints.
// - Refer to Existing Keywords to avoid semantic duplication.
// - Apply the Concept Normalization Preference strictly.

// Goals:
// - Extract 3–6 core keywords that best represent this note.
// - Keywords must be reusable semantic units in a knowledge graph.

// Rules:
// - Do NOT decide keywords from keywords alone; always consider the full content.
// - Prefer higher-level, abstract keywords that represent the overall topic.
// - Absorb tools, implementations, examples, and features into broader keywords.
// - Do NOT invent obscure or overly specific keywords.
// - Each concept must be a noun or short noun phrase (1–3 words).
// - Use singular form only.
// - Prefer abstract and general terms over specific products or libraries.

// Existing Concept Priority (Anti-fragmentation):
// - Before creating a new concept, always check the Existing Keywords list.
// - If a semantically equivalent concept already exists, reuse it.
// - Do NOT create a new concept if an existing one matches semantically.

// New Concept Creation:
// - Create a new concept only if no existing concept matches semantically.
// - A new concept must be suitable to grow into an independent knowledge document.

// Concept Normalization Policy:
// - Primary Language: ${normalizationPreference.primaryLanguage}
// - Case Style: ${normalizationPreference.caseStyle}
// - Acronym Preference: ${normalizationPreference.acronymPreference}

// Normalization Rules:
// - Use standard, widely accepted terminology.
// - Prefer the most commonly used expression.
// - Maintain consistency with existing keywords whenever possible.

// Output Format Contract:
// - Return a single JSON object
// - Each key MUST be a pageId from the input
// - Each value MUST be an array of strings (normalized concept names only)
// - Do NOT include explanations, markdown, comments, or trailing commas
// - Output MUST be valid raw JSON and directly parseable


  let prompt = `
당신은 개인 지식 관리 시스템의 키워드 정제 AI입니다.
다음 노트 데이터를 바탕으로 노트의 핵심 키워드을 추출하십시오.

입력:
1. 노트 본문 (Note Content)
2. 기존 전체 키워드 목록 (Existing Keywords)

목표:
- 이 노트를 대표하는 핵심 키워드을 1~5개 정도 추출합니다.
  - 개수가 정확히 1~5개일 필요는 없으며, 조건을 만족하는 핵심 키워드만 보수적으로 추출해야 합니다.
- 키워드은 지식 그래프에서 재사용 가능한 단일 의미 단위이어야 합니다.
  - 즉, 파편화되지 않고, 노트의 주제를 대표할 수 있는 고유 명칭이어야 합니다.

키워드 추출 규칙:

1. 의미 판단
- Prioritize terms that can represent the overall topic of the document.
- Prefer words with high Frequency/Occurrence in the model’s training corpus.
- Prefer words with high Domain relevance (e.g., technology, productivity, knowledge management).
- Prefer terms with high Recognizability/Popularity, meaning widely known by general users or experts.
- Consider Contextual importance, i.e., words that appear repeatedly in the document and indicate the main theme.
- Absorb fine-grained features, specific implementations, examples, or tool names into higher-level keywords.
- Ensure that a human reader can intuitively recognize the term as representing the document’s core subject.

2. 기존 키워드 우선 원칙
- 새로운 키워드을 생성하기 전에 기존 키워드 목록과 의미적으로 동일한 키워드이 있는지 반드시 확인합니다.
- 의미가 동일하면 기존 키워드을 재사용하여 키워드의 파편화를 줄입니다.
  - 예: "AI" ↔ "Artificial Intelligence", "세컨드 브레인" ↔ "Second Brain"

3. 키워드 번역 원칙 
- 추가할 키워드가 영어이면 한글로 번역 후 기존 키워드에 동의어가 있으면 동의어로 등록한다.
   - 추가 할 키워드가 'notion'이면 한글로 번역하면 '노션'이고 기존 키워드 목록에 '노션'이 있으면 '노션'으로 등록합니다.

3. 단어 조합 규칙
- 단어를 조합한 경우에도 반드시 위 1.의미 판단 규칙에 맞아야 합니다.**
  - 의미 규칙: 상위 개념으로 주제를 대표할 수 있어야 하고, 고유 명칭으로서 독립성이 있어야 함
- 의미 없는 조합이나 설명형 단어는 키워드이 될 수 없습니다.
- 예: '골프장 정보'는 안됨, '노션 데이터베이스'는 됨 


4. 새 키워드 생성 조건
- 기존 키워드과 의미적으로 대응되는 항목이 없을 때만 새 키워드을 생성합니다.
- 새 키워드은 독립적인 지식 문서로 확장 가능해야 하며, 모호해서는 안 됩니다.

5.  키워드 정규화 정책 (중요):
- 키워드은 하나의 대표 표기(canonical form)를 가져야 합니다.
- 동일한 개념의 언어/표기 차이는 하나의 키워드으로 통합합니다.
- 예:
  - "노션", "notion", "NOTION" → "Notion"
- 기존 키워드 목록에 대응되는 항목이 있다면,
  문서에 등장한 표현과 관계없이 반드시 기존 키워드을 사용합니다.

6. 제외 대상 
- 단어가 너무 하위 개념이면 제외합니다.(예: 콜아웃 블록)
- 단어가 너무 보편적이나 지식, 정보, 취향, 관심사를 반영하지 못함 (예:페이지, 소규모팀, 개인)

7. 출력 규칙
- JSON 객체 형태로 출력
- 키: 페이지 ID
- 값: 해당 페이지의 핵심 키워드 배열
- 불필요한 설명, 주석, null 값, 쉼표는 제거

Critical Constraints:
- Do NOT modify pageId in any way.
- Return pageId exactly as provided in the input, including all hyphens and lowercase letters.
- Do not merge or mix keywords across notes
---

예시 출력 (형식 참고):

{
  "pageId_1": ["인공지능", "노션", "데이터베이스"],
  "pageId_2": ["Firebase", "SaaS", "Make"]
}
`;

    // 🔹 Existing keywords (global context)
    if (existingKeywords.length) {
        prompt += `\n[Existing Keywords]\n${existingKeywords.join(", ")}\n`;
    }

    // 🔹 Pages
    for (const [pageId, { title, content }] of Object.entries(noteData)) {
        prompt += `\n[pageId: ${pageId}]\n`;
        if (title) prompt += `Title: ${title}\n`;
        if (content) prompt += `Note Content: ${content}\n`;
        prompt += `\n# Please extract keywords for this pageId independently, do not mix with other pages\n`;
    }

    console.log('requestPageKeywordsFromAI prompt =>', prompt);

    const response = await clientAI.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
        {
            role: "system",
            content: `
You are a strict JSON generator.
Return valid raw JSON only.
Do not include markdown, code blocks, or explanations.
`
      },
      {
        role: "user",
        content: prompt
      }
    ],
        temperature: 0.3,
    });

    const text = response.choices[0].message?.content || "";
    console.log("[DEBUG] AI Keywords 응답 텍스트:", text);

    try {
        return safeParseAIJson(text);
    } catch (err) {
        console.error("AI Keywords JSON 파싱 실패:", {
        error: err,
        rawResponse: text,
        });
        throw err;
    }
}



function safeParseAIJson(raw: string): Record<string, string[]> {
    if (!raw) throw new Error("Empty AI response");

    // 1️⃣ 코드펜스 제거
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');

    // 2️⃣ 첫 { 부터 마지막 } 까지 추출
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error("JSON block not found in AI response");
    }

    const parsed = JSON.parse(match[0]);

    // 3️⃣ 최소 구조 검증 (방어적)
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error("Parsed JSON is not an object");
    }

    for (const [key, value] of Object.entries(parsed)) {
        if (!Array.isArray(value)) {
        throw new Error(`Invalid keywords format for pageId: ${key}`);
        }
    }

    return parsed as Record<string, string[]>;
}

// 노트의 keywords를 AI로 분석해 keywords에 저장하는 HTTPS 함수
// export const generateNoteKMProperties = onRequest(withCors(async (req, res) => {
//     try {
//         const { userId } = req.body;
//         if (!userId) {
//             return res.status(400).send("userId를 전달해야 합니다.");
//         }

//         // pages 컬렉션에서 모든 노트 가져오기
//         const pagesSnap = await db
//             .collection("users")
//             .doc(userId)
//             .collection("integrations")
//             .doc("secondbrain")
//             .collection("pages")
//             .get();

//         // noteId별 {keywords, title, content} 모으기
//         const noteData: Record<string, { keywords: string[]; title?: string; content?: string }> = {};
//         for (const doc of pagesSnap.docs) {
//             const data = doc.data();
//             const keywords = data.keywords;
//             if (!Array.isArray(keywords) || keywords.length === 0) continue;
//             noteData[doc.id] = { keywords, title: data.title, content: data.content };
//         }
//         if (Object.keys(noteData).length === 0) {
//             return res.status(200).json({ message: "저장된 키워드가 없습니다." });
//         }

//         // AI로부터 note의 keywords 한번에 생성
//         let aiResult: Record<string, string[]> = {};
//         try {
//             aiResult = await requestPageKeywordsFromAI(noteData);
//         } catch (err) {
//             console.error("AI 키워드 생성 실패:", err);
//             return res.status(500).send("AI 키워드 생성 실패");
//         }

//         // AI로부터 note의 keywords 생성
//         // let aiKeywordsResult: Record<string, string[]> = {};
//         // try {
//         //     aiKeywordsResult = await requestKeywordsFromAI(noteData);
//         // } catch (err) {
//         //     console.error("AI 키워드 생성 실패:", err);
//         //     return res.status(500).send("AI 키워드 생성 실패");
//         // }
 

//         // 결과 저장
//         let successCount = 0, failCount = 0;
//         for (const doc of pagesSnap.docs) {
//             const noteId = doc.id;
//             if (!aiResult[noteId]) { failCount++; continue; }
//             try {
//                 await doc.ref.set({ keywords: aiResult[noteId] }, { merge: true });
//                 successCount++;
//             } catch (err) {
//                 console.error("Firestore 저장 실패:", noteId, err);
//                 failCount++;
//             }
//         }

//         res.status(200).json({ message: "AI keywords 저장 완료", successCount, failCount });
//     } catch (error: any) {
//         console.error(error);
//         res.status(500).send(error.message);
//     }
// }));

/*

    0. export updateNotePropertiesInFirestore
        notion page에서 페이지 제목, 페이지 내용, '키워드' => secondrain/pages/{noteId}/title, content, keyword 에 저장
    1. export updateAllNotePropertiesInFirestore : notion note database에서 모든 노트 읽어서 필요한 필드를 firestore에 저장 
    2. generateNoteKMProperties : secondrain/pages/{noteId}/title, content, keyword => secondrain/pages/{noteId}/keywords, keywords, domain 에 만들어서 넣음
    * 주의! 여기서 keyword는 가져오는 것과 추가하는 것이 같은 필드 : 기존값을 토대로 새로운 값을 업데이트 함, ai가 판단  
    3. generateKMData 
        secondrain/pagess/{noteId}/keywords, keywords, domain => secondbrain/kmData / 바로 그래프로 사용할 수 있는 JSON


{
  "keywords": [],       노션에 저장(O) / 사용자 (O) / AI (O)
   "keywords": [],      노션에 저장(X) / 사용자 (X) / AI (O) // 1차에서는 
   "domain": "",        노션에 저장(X) / 사용자 (X) / AI (O) // 2차에서 노션에 저장 도메인 관리
  ------------------------------ 
 
  note 내용 // 키워드 

  => genetation -> 노트가 수정되었을때 -> 수정된 내용을 비교해서 노트 단위로 진행함

    // api 호출 규칙
    // 노트 수정이벤트가 발생하면 -> 발생한 것만 생성 
    // 일괄 -> 유저가 수동으로 호출 또는 처음 연결  
    // 일괄 -> 강제 - 모두 
    //        업데이트 -> 마지막 작성 이후 수정된 것만 작성 => 이때만 db 저장 정보가 필요한가? => 키워드, 범주 노션에 갱신 할때 


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 할일
// #todo


- 키워드 - 다시 노션에 저장
- updateNotePropertiesInFirestore 
    - 이미 변환한 것은 건너띠고 변환하기
    - 한번에 5개만 작업하기
- 컨셉 생성
    - 존제하는 컨셉 리스트 만들기
    - 키워드 추출 안함
    - 기존 컨셉을 키워드로 변경함 

=======================================================================================================
>>> 그래프 그리기    
- 이벤트 처리
    새로운 이벤트가 오면 1개 개별 변환하기
    키워드 수정 
        - 이미 생성된 키워드에서 삭제 하면 -> 삭제
        - 추가하면 추가  
- 템플릿 수정
    - tag => 카테고리
    - 도메인 => 범주 

=======================================================================================================  


>>> 인증 UX 마무리
- [ ]  숫자 입력 시 뒤로 가기 안됨
- [ ]  숫자 입력창 영어 입력이 됨
- [ ]  이메일 입력창 → 아이폰에서 숫자로 나옴
- [ ]  메인 인증 버튼 누르고 disable처리 하기

>>> 마무리
- 템플릿 두개 선택 주의 설명
- 로그 숨기기
- 강제 업데이트

- 키워드 생성작업 않은 노트를 확인하고 추가로 5개의 노트는 변환합니다. 추가 5개 번환하기 버튼(임시) 
- 안내 추가(임시)
- 새로운 노트를 만들거나 수정하면 자동으로 AI 태깅 작업이 진행됩니다. 
- 변환 안내하기
- 변환 작업에 시간이 매우 오래 걸려, 기존 노트들을 한번에 변환하지 않습니다. 
- 다만, 새로운 노트를 만들거나 페이지가 수정되면 해당 페이지에 대하여 바로 작업 됩니다. 
- 초기에 content -> keyword작업 
- 오픈 후 : 초기화 후 재생성 : 프로그래스, 수종 작업 버튼, 전체 전환율
- 오픈 전 : 
    - 초기화 후 재생성 작업 없음 // 신규 작업 부터 데이타 반영됨 // 기존 노트 반영은 기다려달라
    - 설치후에는 10개 페이지만 반영됨 // 한번 버튼 누루면 다시 5개
    - 노트가 삭제 되었을때

=======================================================================================================
- 도메인 ai 생성 (2차)
- 키워드 반영 / 머지  => ai가 하는 것이라 => 내가 넣은 키워드를 삭제 했음 !!!!!!!!!!!!!!!(키워드는 개별 수정하지 마라) 2차에서 머지하겠음.


- 검색 - 키워드 기반 (2차)
- [ ]  템플릿 연결 안내 보강(2차) - 첫 화면에서 워크스페이스를 선택함 > 연결 할 템플릿을 선택함 밑에 선택한 후 페이지에서 이 LifeUp템플릿
- 설정 
    - [ ]  유효하지 않은 클라이언트 확인 하고 삭제하기(2차)
    - 노트 변환상태 / 변환 하기 메뉴  
    - 이벤트 표시 (2차)
    - 도메인 작업 (2차)
    - 크레딧 관리(2차)
    - 모바일에서 설정하기 : 세션 - email연결 필요 (2차)
    - [ ]  메뉴 - 버전 확인 / 업데이트(2차)
- keyword저장하면 최근노트로 나옴 : 현재는 어쩔 수 없음 (2차)
- 제목 자동 작성 기능 (2차)
컨셉 생성 옵션 사용자 설정 (2차)
- 키워드 수정 시 반영된게 함 (2차)
- 키워드 개수에 따라 색상 변경하기 (2차)
- 키워드 normalizeConcept(2차) - 번역
*/