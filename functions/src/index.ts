/* eslint-disable */
import { onRequest } from "firebase-functions/v2/https";
import { Resend } from "resend";
import * as admin from "firebase-admin";
import "dotenv/config";
import { defineSecret } from "firebase-functions/params";
//import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { randomBytes, randomUUID } from 'crypto';
import OpenAI from "openai";
import { customAlphabet } from 'nanoid';

import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

//import { kakaoAssistantPrompt } from "./prompts/kakaoAssistant.prompt";

// notion
import { Client } from "@notionhq/client";

const clientAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const nanoid = customAlphabet(
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    8
);

/**
 * 텍스트 변경 감지용 해시
 * - Firestore 저장용
 * - 원문(content)은 저장하지 않음
 */
export function hashContent(text: string): string {
    return crypto
        .createHash("sha256")
        .update(text || "", "utf8")
        .digest("hex");
}

admin.initializeApp();
const db = admin.firestore();

const NOTION_TOKEN = defineSecret("NOTION_TOKEN");
const NOTION_OAUTH_REDIRECT_URI = "https://us-central1-notionable-secondbrain.cloudfunctions.net/notionOAuthCallback"; // 노션에 등록되서 바꿀 수 없음

const allowedOrigins = ["http://localhost:4200", "https://notionable.net", "https://app.notionable.net"];

export enum AgentId {
    SECOND_BRAIN = 'secondbrain',
    KAKAO_CAPTURE = 'kakao-capture'
}

export type EventStatus =
    | 'start'
    | 'running'
    | 'completed'
    | 'failed';

export interface EventPayload {
    agentId: AgentId;
    status: EventStatus;
    targetData?: Record<string, unknown>;
    eventTitle?: string;
    description?: string;
}


// import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";

//admin.initializeApp();

import * as functions from "firebase-functions";
import { formatDate, formatDateTime, formatKoreanDate, formatKoreanDateTime, resolveDateExpr } from './services/date-service';

export const importPurchasers = functions.https.onRequest(
    async (req, res) => {

        const buyers = require("../data/lifeup_purchaser.json");

        const db = admin.firestore();

        const batch = db.batch();

        buyers.forEach((buyer: any) => {

            const ref = db.collection("purchasers").doc();

            batch.set(ref, buyer);

        });

        await batch.commit();

        res.send(`${buyers.length}건 업로드 완료`);
    }
);

/**
 * 사용자 이벤트 로그를 Firestore에 저장한다.
 *
 * @param userId - 사용자 ID
 * @param payload - 이벤트 데이터
 */
export async function writeUserEvent(
    userId: string,
    payload: EventPayload,
): Promise<void> {
    await db
        .collection('users')
        .doc(userId)
        .collection('events')
        .add({
            ...payload,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
}


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

    const redirectUri = encodeURIComponent(NOTION_OAUTH_REDIRECT_URI);
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
// Notion OAuth Callback : 원래 세컨드브래인 콜백
// ----------------------
// export const notionOAuthCallback = onRequest({ secrets: [NOTION_TOKEN] }, withCors(async (req, res) => {
//     try {
//         const code = req.query.code as string | undefined;
//         const userId = (req.query.state as string) || "default_user";
//         if (!userId) return res.status(400).send("Missing authorization code");
//         if (!code) return res.status(400).send("Missing authorization code");

//         const clientId = process.env.NOTION_CLIENT_ID!;
//         const clientSecret = process.env.NOTION_CLIENT_SECRET!;
//         const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

//         const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
//             method: "POST",
//             headers: { "Authorization": `Basic ${basicAuth}`, "Content-Type": "application/json" },
//             body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: NOTION_OAUTH_REDIRECT_URI }),
//         });

//         if (!tokenResponse.ok) {
//             const errorText = await tokenResponse.text();
//             console.error("Notion OAuth failed:", errorText);
//             return res.status(500).send("Notion OAuth failed");
//         }

//         const notionToken = await tokenResponse.json();

//         // note Database ID 얻기
//         const noteDatabaseId = await NotionService.getDatabaseIdByDatabaseName(notionToken.access_token, 'note_lifeup_1_3');

//         // users/{userId} 에 저장
//         await db.collection("users").doc(userId).set(
//             {
//                 notionAccessToken: notionToken.access_token,
//                 updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//             },
//             { merge: true }
//         );

//         // secondbrain 연결정보 저장
//         await db.collection("users").doc(userId).collection("integrations").doc("secondbrain").set({
//             accessToken: notionToken.access_token,
//             workspaceId: notionToken.workspace_id,
//             botId: notionToken.bot_id,
//             duplicatedTemplateId: notionToken.duplicated_template_id,
//             updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//             noteDatabaseId: noteDatabaseId
//         });

//         await db.collection("notionDatabaseMap").doc(noteDatabaseId).set({
//             userId,
//             accessToken: notionToken.access_token,
//             createdAt: admin.firestore.FieldValue.serverTimestamp(),
//         });

//         // 초기에 연결하면 키워드를 초기화 한다. 
//         await NotionService.resetKeywordOptions(notionToken.access_token, noteDatabaseId);

//         // // 처음 한번 기존 노트에 키워드를 가져와서 저장한다. 
//         // await NotionService.genetateNotionNoteKMData(notionToken.access_token, userId, noteDatabaseId);
//         return res.redirect(`http://app.notionable.net/notion-auth/success?userId=${encodeURIComponent(userId)}`);
//     } catch (error) {
//         console.error("OAuth process failed:", error);
//         const userId = (req.query.state as string) || "";
//         return res.redirect(
//             `http://app.notionable.net/notion-auth/fail?userId=${encodeURIComponent(userId)}`
//         );
//     }
// })
// );

// ----------------------
// Notion OAuth Callback
// ----------------------

export const notionOAuthCallback = onRequest({ secrets: [NOTION_TOKEN] }, withCors(async (req, res) => {
    const userId = (req.query.state as string) || "";
    try {
        const code = req.query.code as string | undefined;

        if (!userId) {
            throw new Error("Missing state(userId)");
        }

        if (!code) {
            throw new Error("Missing authorization code");
        }

        console.log("[Notion OAuth] Start", {
            userId,
            hasCode: !!code
        });

        const clientId = process.env.NOTION_CLIENT_ID!;
        const clientSecret = process.env.NOTION_CLIENT_SECRET!;
        const basicAuth = Buffer.from(
            `${clientId}:${clientSecret}`
        ).toString("base64");

        const tokenResponse = await fetch(
            "https://api.notion.com/v1/oauth/token",
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: NOTION_OAUTH_REDIRECT_URI
                })
            }
        );

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();

            console.error("[Notion OAuth] Token exchange failed", {
                userId,
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                errorText
            });

            throw new Error(
                `Token exchange failed (${tokenResponse.status}): ${errorText}`
            );
        }

        const notionToken = await tokenResponse.json();

        console.log("[Notion OAuth] Token exchange success", {
            userId,
            workspaceId: notionToken.workspace_id,
            botId: notionToken.bot_id,
            duplicatedTemplateId:
                notionToken.duplicated_template_id
        });

        const dbNames = ["note", "task", "memo", "reference", "memo tag", "reference tag"];
        const dbMap = await NotionService.updateTemplateDbs(
            notionToken.access_token,
            dbNames
        )

        // ❗ 누락된 DB 체크
        const missing = dbNames.filter(name => !dbMap?.[name])

        if (missing.length > 0) {
            throw new Error(`데이터베이스를 찾지 못했습니다. : ${missing.join(", ")}`)
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();
        const user = userSnap.data();
        const kakaoUserId = user?.kakaoUserId;

        // users
        await userRef.set({
            notionAccessToken: notionToken.access_token,
            notionConnection: {
                workspaceId: notionToken.workspace_id,
                botId: notionToken.bot_id,
                duplicatedTemplateId: notionToken.duplicated_template_id,
                databases: dbMap,
                connectedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // secondbrain은 항상 초기화

        await userRef.collection("integrations").doc("secondbrain").set(
            {
                //// 이전 버전 호화성을 위해 넣음
                accessToken: notionToken.access_token,
                workspaceId: notionToken.workspace_id,
                botId: notionToken.bot_id,
                duplicatedTemplateId: notionToken.duplicated_template_id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                noteDatabaseId: dbMap['note'],
                ////////////////////////////////////////////////
                enabled: false
            },
            { merge: true }
        );

        // 카카오는 기존 연결 여부에 따라 처리
        if (!kakaoUserId) {
            await userRef.collection("integrations").doc("kakao-capture").set(
                {
                    enabled: false
                },
                { merge: true }
            );
        }
        //////////////////////////////////////
        // agent 초기화

        // secondbrain 연결정보 저장 : 이전 버전을 위해 / 임시 코드
        // await db.collection("users").doc(userId).collection("integrations").doc("secondbrain").set({
        //     enabled: false
        // });

        // await db.collection("users").doc(userId).collection("integrations").doc("kakao-capture").set({
        //     enabled: false
        // });
        // const kakaoUserId = userDoc.get('kakaoUserId');
        // if (kakaoUserId) {
        //     await connectKakaoUser(uid, kakaoUserId);
        // }

        await Promise.all(
            (Object.entries(dbMap) as [string, string][])
                .map(([name, dbId]) =>
                    db.collection("notionDatabaseMap").doc(dbId).set({
                        userId,
                        dbName: name,
                        accessToken: notionToken.access_token,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    })
                )
        );

        if (dbMap["note"]) {
            await NotionService.resetKeywordOptions(
                notionToken.access_token,
                dbMap["note"]
            )
        }
        console.log("[Notion OAuth] Success", { userId, dbMap });

        return res.redirect(
            `http://app.notionable.net/notion-auth/success?userId=${encodeURIComponent(
                userId
            )}`
        );
    } catch (error: any) {
        console.error("[Notion OAuth] Failed", {
            userId,
            message: error?.message,
            stack: error?.stack,
            error
        });

        const errorMessage =
            error instanceof Error
                ? error.message
                : typeof error === "string"
                    ? error
                    : JSON.stringify(error);

        return res.redirect(
            `http://app.notionable.net/notion-auth/fail?userId=${encodeURIComponent(
                userId
            )}&error=${encodeURIComponent(errorMessage)}`
        );
    }
})
);


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
// export const getUserSecondBrainConnectInfo = onRequest(
//     withCors(async (req, res) => {
//         const userId = req.query.userId as string;
//         const userRef = db.collection("users").doc(userId);
//         const userSnap = await userRef.get();
//         const notionSnap = await userRef.collection("integrations").doc("secondbrain").get();

//         res.json({
//             user: userSnap.data(),
//             notion: notionSnap.exists ? notionSnap.data() : null,
//         });
//     })
// );

// ----------------------
// Integration 연결 정보 조회
// ----------------------
// export const getUserIntegrationInfo = onRequest(
//     withCors(async (req, res) => {
//         const userId = req.query.userId as string;
//         const integrationId = req.query.integrationId as string;

//         const userRef = db.collection("users").doc(userId);

//         const userSnap = await userRef.get();
//         const integrationSnap = await userRef
//             .collection("integrations")
//             .doc(integrationId)
//             .get();

//         res.json({
//             user: userSnap.exists ? userSnap.data() : null,
//             integration: integrationSnap.exists ? integrationSnap.data() : null,
//         });
//     })
// );


// ----------------------
// UserService
// ----------------------
interface CreateUserAccessKeyResult {
    accessKey: string;
    expiresAt: string;
}

class UserService {
    // static async saveClientInfo(params: { userId: string; clientId: string; origin?: string; userAgent?: string }) {
    //     const { userId, clientId, origin, userAgent } = params;
    //     const embedRef = db.collection('users').doc(userId).collection('integrations').doc('secondbrain').collection('clients').doc(clientId);

    //     await embedRef.set({
    //         clientId,
    //         origin: origin ?? null,
    //         userAgent: userAgent ?? null,
    //         lastAccessAt: admin.firestore.FieldValue.serverTimestamp(),
    //         createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //     }, { merge: true });
    // }

    static async createAndSetUserAccessKey(userId: string): Promise<CreateUserAccessKeyResult> {
        if (!userId /*|| !clientId*/) {
            throw new Error('Missing userId or userId');
        }

        // 랜덤 32바이트 clientKey 생성
        const accessKey = randomBytes(32).toString('hex');
        //const hashedKey = createHash('sha256').update(accessKey).digest('hex');

        //const now = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30일
        );

        const ref = db
            .collection('users')
            .doc(userId)

        await ref.set({
            accessKey: accessKey,
            expiresAt
            //createdAt: now,
        }, {
            merge: true
        });

        return {
            accessKey,
            expiresAt: expiresAt.toDate().toISOString(),
        };
    }
}

export const checkUserAccessKey = onRequest(withCors(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
            return;
        }

        const userId = req.body.userId;

        // Authorization 헤더에서 Bearer 토큰 추출
        const authHeader = req.headers['authorization'] as string | undefined;
        const accessKey = authHeader?.split(' ')[1];

        if (!userId || !accessKey) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        const ref = db
            .collection('users')
            .doc(userId)
        // .collection('integrations')
        // .doc('secondbrain')
        // .collection('clients')
        // .doc(clientId);

        const docSnap = await ref.get();
        if (!docSnap.exists) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }

        const data = docSnap.data();

        // clientKey 검증
        //const hashedKey = createHash('sha256').update(accessKey).digest('hex');
        if (data?.accessKey !== accessKey) {
            res.status(401).json({ error: 'INVALID_USER_ACCESS_KEY' });
            return;
        }

        // if (data?.revoked) {
        //     res.status(401).json({ error: 'CLIENT_REVOKED' });
        //     return;
        // }

        // 인증 만료 갱신에 문제가 있어서 임시로 인증 만료 체크 안함
        // if (data?.expiresAt.toDate() < new Date()) {
        //     res.status(401).json({ error: 'USER_ACCESS_KEY_EXPIRED' });
        //     return;
        // }

        // clientKey는 내려주지 않고 metadata만 반환
        res.json({
            userId,
            createdAt: data.createdAt.toDate().toISOString(),
            // expiresAt: data.expiresAt.toDate().toISOString(),
            // lastAccessAt: data.lastAccessAt,
            // userAgent: data.userAgent,
            //revoked: data.revoked,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));


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
        let nomalizedEMail: string = email.trim().toLowerCase();
        let nomalizedCode = code.trim();

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(nomalizedEMail)) {
            return res.status(200).json({ message: '이메일 형식이 올바르지 않습니다.' });
        }

        // Firestore에서 인증 코드 가져오기
        const docRef = db.collection('email_verifications').doc(nomalizedEMail);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(200).json({ message: '인증번호를 먼저 요청해주세요.' });
        }

        const data = docSnap.data() as {
            code: string;
            expiresAt: admin.firestore.Timestamp;
            attempts?: number;
        };

        const hashedInput = crypto.createHash('sha256').update(nomalizedCode).digest('hex');

        // 만료 확인
        const now = admin.firestore.Timestamp.now();
        if (data!.expiresAt.toMillis() < now.toMillis()) {
            return res.status(200).json({ message: '인증번호가 만료되었습니다. 홈페이지에서 다시 연결요청을 해주세요.' });
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
            .where('email', '==', nomalizedEMail)
            .limit(1)
            .get();

        let userId: string;
        let accessKeyData: CreateUserAccessKeyResult;
        // 2️⃣ user가 이미 존재하면 재사용
        if (userQuerySnap.empty || userQuerySnap.docs.length === 0) {
            userId = nanoid();
            await db.collection('users').doc(userId).set({
                email: nomalizedEMail,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            accessKeyData = await UserService.createAndSetUserAccessKey(userId);
        } else {
            const userDoc = userQuerySnap.docs[0];
            if (!userDoc) {
                throw new Error('User document unexpectedly missing');
            }

            userId = userDoc.id;
            const userData = userDoc.data() as any;

            if (userData?.accessKey && userData?.expiresAt) {
                accessKeyData = {
                    accessKey: userData.accessKey,
                    expiresAt: userData.expiresAt,
                };
            } else {
                accessKeyData = await UserService.createAndSetUserAccessKey(userId);
            }
        }

        // 4️⃣ clientId는 항상 새로 생성
        // const clientId = nanoid(); //crypto.randomUUID();

        // // clients/{clientId} 저장
        // await UserService.saveClientInfo({
        //     userId,
        //     clientId,
        //     origin: req.get('origin') || undefined,
        //     userAgent: req.get('user-agent') || undefined,
        // });


        // 5️⃣ 사용 후 인증번호 삭제
        await docRef.delete();

        // 6️⃣ 성공 결과 반환
        return res.status(200).json({ userId, accessKey: accessKeyData.accessKey });
    } catch (error: any) {
        console.error('verifyCode error:', error);
        return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
}));

export const requestKakaoVerification = onRequest(withCors(async (req, res) => {
    const userId: string = req.body.userId;

    const verificationId = crypto.randomUUID();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const expiresAt =
        admin.firestore.Timestamp.fromMillis(
            Date.now() + 10 * 60 * 1000
        );

    await db
        .collection('verifications')
        .doc(userId)
        .set({
            verificationId,
            code: hashedCode,
            verified: false,
            kakaoUserId: null,
            expiresAt,
            attempts: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    return res.status(200).json({
        code,
        expiresAt,
        verificationId
    });
})
);

export const sendTemplateConnectRequest = onRequest(
    withCors(async (req, res) => {

        const contact: string = req.body.contact;
        const memberUid: string = req.body.memberUid;

        if (!contact) {
            return res.status(400).json({
                error: '연락처가 필요합니다.'
            });
        }

        await resend.emails.send({
            from: 'Notionable <noreply@notionable.net>',
            to: 'crefestudio@gmail.com',
            subject: '[라이프업] 템플릿 연결 신청',
            html: `
                <h3>템플릿 연결 신청</h3>

                <p>
                    <strong>UID</strong><br>
                    ${memberUid || '-'}
                </p>

                <p>
                    <strong>연락처</strong><br>
                    ${contact}
                </p>

                <p>
                    <strong>신청일시</strong><br>
                    ${new Date().toLocaleString('ko-KR')}
                </p>
            `
        });

        return res.status(200).json({
            success: true
        });

    })
);

///////////////////////////////////////////////////////////////////////////////////////////////
// NotionService #notion service

class NotionService {
    // Notion 클라이언트
    //notionApi = null;
    static apiVersion = '2022-06-28';
    // static async getDatabaseIdByDatabaseName(accessToken: string, databaseName: string): Promise<string> {
    //     const url = 'https://api.notion.com/v1/search';
    //     const body = { query: databaseName, filter: { property: 'object', value: 'database' } };

    //     const response = await fetch(url, {
    //         method: 'POST',
    //         headers: {
    //             Authorization: `Bearer ${accessToken}`,
    //             'Notion-Version': this.apiVersion,
    //             'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify(body),
    //     });

    //     const rawText = await response.text();
    //     if (!response.ok) throw new Error(`Notion API 호출 실패: ${response.status} / ${rawText}`);

    //     const data = JSON.parse(rawText);
    //     console.log("[DEBUG] getDatabaseIdByDatabaseName data, databaseName =>", data, databaseName);
    //     const matched = data.results.filter((item: any) => (item.title?.map((t: any) => t.plain_text).join('') ?? '') === databaseName);

    //     if (!matched.length) throw new Error(`"${databaseName}" Database를 찾을 수 없습니다.`);
    //     if (matched.length > 1) throw new Error(`"${databaseName}" Database가 여러 개 존재합니다.`);

    //     return matched[0].id;
    // }

    static async resolveDataSourceId(accessToken: string, databaseId: string): Promise<string> {
        const notion = new Client({ auth: accessToken });

        const db: any = await notion.databases.retrieve({
            database_id: databaseId
        });

        const dataSourceId = db.data_sources?.[0]?.id;

        if (!dataSourceId) {
            throw new Error(`Data source not found. databaseId=${databaseId}`);
        }

        return dataSourceId;
    }

    static async updateTemplateDbs(accessToken: string, dbNames: string[]) {
        const entries = await Promise.all(
            dbNames.map(async (t) => [
                t,
                await this.getDatabaseIdByDatabaseName(accessToken, t)
            ])
        )
        return Object.fromEntries(entries)
    }

    static async resolveDatabaseId(accessToken: string, userId: string, dbName: string) {
        const userRef = db.collection("users").doc(userId)
        const snap = await userRef.get()

        const dbMap = snap.data()?.notionConnection?.databases || {}

        // 1️⃣ cache hit
        if (dbMap[dbName]) return dbMap[dbName]

        // 2️⃣ fallback search
        const dbId = await this.getDatabaseIdByDatabaseName(accessToken, dbName)

        // 3️⃣ auto-heal update
        await userRef.set({
            notionConnection: {
                databases: {
                    [dbName]: dbId
                }
            }
        }, { merge: true })

        return dbId
    }

    static async resolveRelationIds(
        accessToken: string,
        relationDbId: string,
        names: string[]
    ): Promise<string[]> {
        const notion = new Client({ auth: accessToken });

        const db: any = await notion.databases.retrieve({
            database_id: relationDbId
        });

        const dataSourceId = db.data_sources?.[0]?.id;

        if (!dataSourceId) {
            throw new Error(
                `data source not found: ${relationDbId}`
            );
        }

        const result: string[] = [];

        for (const name of [...new Set(
            names.map(v => v?.trim()).filter(Boolean)
        )]) {
            const existing: any =
                await notion.dataSources.query({
                    data_source_id: dataSourceId,
                    filter: {
                        property: "이름",
                        title: {
                            equals: name
                        }
                    }
                });

            if (existing.results.length > 0) {
                result.push(existing.results[0].id);
            }
        }

        return result;
    }

    static async resolveOrCreateRelationIds(
        accessToken: string,
        databaseId: string,
        names: string[]
    ): Promise<string[]> {
        const ids = await this.resolveRelationIds(accessToken, databaseId, names);

        const exists = new Set(ids);
        const result = [...ids];

        for (const name of names) {
            const found = await this.resolveRelationIds(accessToken, databaseId, [name]);

            if (found.length > 0) {
                continue;
            }

            try {
                const response = await fetch("https://api.notion.com/v1/pages", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Notion-Version": "2022-06-28",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        parent: {
                            database_id: databaseId
                        },
                        properties: {
                            이름: {
                                title: [
                                    {
                                        text: {
                                            content: name
                                        }
                                    }
                                ]
                            }
                        }
                    })
                });

                if (!response.ok) {
                    console.error(
                        `[Notion] failed to create relation page: ${name}`,
                        await response.text()
                    );
                    continue;
                }

                const page = await response.json();

                if (page.id && !exists.has(page.id)) {
                    exists.add(page.id);
                    result.push(page.id);
                }
            } catch (e) {
                console.error(
                    `[Notion] create relation page error: ${name}`,
                    e
                );
            }
        }

        return result;
    }

    static async getDatabaseIdByDatabaseName(accessToken: string, databaseType: string): Promise<string> {
        const response = await fetch(
            'https://api.notion.com/v1/search',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Notion-Version': this.apiVersion,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: databaseType,
                    filter: {
                        property: 'object',
                        value: 'database',
                    },
                    page_size: 100,
                }),
            }
        );

        const rawText = await response.text();
        if (!response.ok) {
            throw new Error(
                `Notion API 호출 실패: ${response.status} / ${rawText}`
            );
        }

        const data = JSON.parse(rawText);
        const normalize = (text: string) => text.trim().toLowerCase();
        const getTitle = (db: any) =>
            normalize(
                db.title?.map((t: any) => t.plain_text).join('') || ''
            );

        const target = normalize(databaseType);

        // 지원하는 패턴:
        // note_lifeup_1_3 (기존)
        // Note #13      (신규)
        const matched = data.results.filter((db: any) => {
            const title = getTitle(db);

            return (
                title.startsWith(`${target}_lifeup_`) ||
                title.startsWith(`${target} #`) ||
                title.startsWith(`${target}#`)
            );
        });

        console.log(
            `[Notion] 검색 결과 (${databaseType}):`,
            matched.map((db: any) => ({
                id: db.id,
                title: getTitle(db),
            }))
        );

        if (matched.length === 0) {
            throw new Error(
                `"${databaseType}" Database를 찾을 수 없습니다.`
            );
        }

        if (matched.length > 1) {
            throw new Error(
                `"${databaseType}" Database가 여러 개 존재합니다.`
            );
        }

        return matched[0].id;
    }



    // static async getDatabaseIdByDatabaseName(accessToken: string, databaseName: string): Promise<string> {

    //     const url = 'https://api.notion.com/v1/search';

    //     const body = {
    //         query: databaseName,
    //         filter: { property: 'object', value: 'database' },
    //         page_size: 100
    //     };

    //     console.log('🚀 [START] getDatabaseIdByDatabaseName');
    //     console.log('🔑 검색 대상 이름:', databaseName);


    //     const response = await fetch(url, {
    //         method: 'POST',
    //         headers: {
    //             Authorization: `Bearer ${accessToken}`,
    //             'Notion-Version': this.apiVersion,
    //             'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify(body),
    //     });

    //     const rawText = await response.text();

    //     console.log('📡 응답 상태:', response.status);
    //     console.log('📦 RAW 응답:', rawText);

    //     if (!response.ok) {
    //         throw new Error(`Notion API 호출 실패: ${response.status} / ${rawText}`);
    //     }

    //     // ❗ 먼저 파싱
    //     const data = JSON.parse(rawText);
    //     console.log('📊 전체 결과 개수:', data.results?.length);
    //     console.log('📚 전체 results:', data.results);

    //     const getTitle = (db: any) =>
    //         (db.title?.map((t: any) => t.plain_text).join('') || '')
    //             .trim()
    //             .toLowerCase();

    //     const targetName = databaseName.trim().toLowerCase();

    //     console.log('🎯 targetName (정규화):', targetName);

    //     // 👉 각 DB 제목 비교 로그
    //     data.results?.forEach((db: any, index: number) => {
    //         const rawTitle = db.title?.map((t: any) => t.plain_text).join('');
    //         const normalizedTitle = getTitle(db);

    //         console.log(`📁 [${index}]`);
    //         console.log('   rawTitle:', rawTitle);
    //         console.log('   normalizedTitle:', normalizedTitle);
    //         console.log('   isExactMatch:', normalizedTitle === targetName);
    //         console.log('   id:', db.id);
    //     });

    //     // ✅ 1차: 이름 완전 일치
    //     let matched = data.results.filter(
    //         (db: any) => getTitle(db) === targetName
    //     );

    //     console.log('✅ exact match 개수:', matched.length);

    //     if (!matched.length) {
    //         console.error('❌ 최종 실패: DB 못 찾음');
    //         throw new Error(`"${databaseName}" Database를 찾을 수 없습니다.`);
    //     }

    //     console.log('🎉 찾은 DB:', matched[0]);

    //     // 🔥 특정 페이지 체크 함수
    //     const hasTestPage = async (dbId: string) => {
    //         let startCursor: string | undefined = undefined;

    //         do {
    //             const res: any = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    //                 method: "POST",
    //                 headers: {
    //                     Authorization: `Bearer ${accessToken}`,
    //                     "Notion-Version": this.apiVersion,
    //                     "Content-Type": "application/json",
    //                 },
    //                 body: JSON.stringify({
    //                     page_size: 100,
    //                     start_cursor: startCursor,
    //                 }),
    //             });

    //             const data = await res.json();

    //             // 🔹 쿼리 전체 로그
    //             console.log(`[DEBUG] DB ${dbId} query result:`, JSON.stringify(data, null, 2));

    //             if (!data.results || !Array.isArray(data.results)) {
    //                 console.warn(`[WARN] DB ${dbId} query 결과 없음`);
    //                 return false;
    //             }

    //             for (const page of data.results) {
    //                 console.log(`[DEBUG] page.id: ${page.id}`);
    //                 console.log(`[DEBUG] page.properties:`, JSON.stringify(page.properties, null, 2));

    //                 // 타이틀 속성 자동 찾기
    //                 const titlePropKey = Object.entries(page.properties).find(
    //                     ([key, prop]) => (prop as any).type === "title"
    //                 )?.[0];

    //                 if (!titlePropKey) {
    //                     console.warn(`[WARN] page.id ${page.id} 타이틀 속성 없음`);
    //                     continue;
    //                 }

    //                 const titleText = page.properties[titlePropKey].title
    //                     .map((t: any) => t.plain_text)
    //                     .join('');

    //                 console.log(`[DEBUG] page.id ${page.id} titleText:`, titleText);

    //                 if (titleText === "[TIP] #캔바 - 노션에서 캔바 연동형 글쓰기") {
    //                     console.log(`[DEBUG] ⭐ 테스트 페이지 발견! page.id: ${page.id}`);
    //                     return true;
    //                 }
    //             }

    //             startCursor = data.next_cursor;
    //         } while (startCursor);

    //         return false;
    //     };

    //     // 🔥 DB archive 함수
    //     const archiveDatabase = async (dbId: string) => {
    //         console.log("❌ 테스트 DB → archive:", dbId);

    //         await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    //             method: "PATCH",
    //             headers: {
    //                 Authorization: `Bearer ${accessToken}`,
    //                 "Notion-Version": this.apiVersion,
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify({
    //                 archived: true,
    //             }),
    //         });
    //     };

    //     let candidates: any[] = [];

    //     for (const db of matched) {
    //         const isTest = await hasTestPage(db.id);
    //         console.log("[DEBUG] DB 검사:", db.id, "isTest:", isTest);

    //         if (isTest) {
    //             await archiveDatabase(db.id); // 테스트 DB 바로 삭제
    //         } else {
    //             candidates.push(db); // 진짜 DB 후보
    //         }
    //     }

    //     // 후보 없음 → 에러
    //     if (candidates.length === 0) {
    //         throw new Error("유효한 DB를 찾지 못했습니다. (모두 테스트 DB)");
    //     }

    //     // 후보 2개 이상 → 에러
    //     if (candidates.length > 1) {
    //         console.error("[ERROR] 진짜 DB가 여러 개 존재:", candidates.map(db => db.id));
    //         throw new Error("Database가 여러 개 존재합니다. 수동 확인 필요");
    //     }

    //     // ✅ 딱 하나만 살아남음
    //     const finalDb = candidates[0];

    //     console.log("[DEBUG] ✅ 최종 선택 DB:", {
    //         id: finalDb.id,
    //         title: getTitle(finalDb),
    //     });

    //     return finalDb.id;
    // }

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

    static async getNotionPage(accessToken: string, pageId: string) {
        const formattedPageId = pageId.replace(/-/g, "");
        console.log("[DEBUG] getNotionPage 호출, pageId:", pageId);

        // 1️⃣ 페이지 속성 가져오기
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${formattedPageId}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Notion-Version": this.apiVersion,
                "Content-Type": "application/json",
            },
        });

        if (!pageRes.ok) {
            const text = await pageRes.text();
            console.error("[DEBUG] Notion API 페이지 조회 실패:", text);
            throw new Error(`페이지 조회 실패: ${text}`);
        }

        const pageData = await pageRes.json();

        // 2️⃣ 페이지 블록(children) 가져오기
        const blocks: any[] = [];
        let cursor: string | undefined = undefined;
        do {
            const childrenRes: any = await fetch(
                `https://api.notion.com/v1/blocks/${formattedPageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Notion-Version": this.apiVersion,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!childrenRes.ok) {
                const text = await childrenRes.text();
                console.error("[DEBUG] Notion API 블록 조회 실패:", text);
                throw new Error(`블록 조회 실패: ${text}`);
            }

            const childrenData = await childrenRes.json();
            blocks.push(...childrenData.results);
            cursor = childrenData.has_more ? childrenData.next_cursor : undefined;
        } while (cursor);

        // 반환: 페이지 속성 + 블록
        return {
            id: pageData.id,
            properties: pageData.properties,
            blocks: blocks,
        };
    }


    // 추가하는 방식으로 함수

    // static async applyKeywordsToNotionPages(accessToken: string, aiResultKeyword: Record<string, string[]>) {

    //     for (const [pageId, keywords] of Object.entries(aiResultKeyword)) {
    //         if (!keywords || keywords.length === 0) continue;

    //         const cleanedKeywords = aiResultKeyword[pageId].flatMap(k =>
    //             k.split(',').map(s => s.trim()).filter(Boolean)
    //         );

    //         const notion = new Client({
    //             auth: accessToken,
    //         });

    //         try {
    //             await notion.pages.update({
    //                 page_id: pageId,
    //                 properties: {
    //                     키워드: {
    //                         multi_select: cleanedKeywords.map(name => ({ name }))
    //                     },
    //                 },
    //             });
    //             console.log(`✅ 키워드 반영 완료: ${pageId}`);
    //         } catch (error) {
    //             console.error(`❌ 키워드 반영 실패: ${pageId}`, error);
    //         }
    //     }
    // }

    // 삭제하고 다시 넣는 방식
    static async applyKeywordsToNotionPages(
        accessToken: string,
        aiResultKeyword: Record<string, string[]>
    ) {
        const notion = new Client({ auth: accessToken });

        for (const [pageId, keywords] of Object.entries(aiResultKeyword)) {
            // 키워드 정리 (없으면 빈 배열)
            const cleanedKeywords = (keywords ?? [])
                .flatMap(k => k.split(",").map(s => s.trim()))
                .filter(Boolean);

            try {
                await notion.pages.update({
                    page_id: pageId,
                    properties: {
                        키워드: {
                            multi_select: cleanedKeywords.map(name => ({ name }))
                            // 👆 빈 배열이면 기존 키워드 전부 제거됨
                        },
                    },
                });

                console.log(
                    cleanedKeywords.length > 0
                        ? `✅ 키워드 교체 완료: ${pageId}`
                        : `🧹 키워드 전체 삭제 완료: ${pageId}`
                );
            } catch (error) {
                console.error(`❌ 키워드 반영 실패: ${pageId}`, error);
            }
        }
    }

    static async resetKeywordOptions(
        accessToken: string,
        databaseId: string
    ) {
        const notion = new Client({ auth: accessToken });

        try {

            // 1️⃣ database 조회
            const db: any = await notion.databases.retrieve({
                database_id: databaseId
            });

            if (!db.data_sources || db.data_sources.length === 0) {
                console.log("❌ data source 없음");
                return;
            }

            const dataSourceId = db.data_sources[0].id;

            console.log("📦 dataSourceId:", dataSourceId);

            // 2️⃣ data source 조회 (여기에 properties 있음)
            const dataSource: any = await notion.dataSources.retrieve({
                data_source_id: dataSourceId
            });

            const keywordProp = dataSource.properties["키워드"];

            if (!keywordProp || keywordProp.type !== "multi_select") {
                console.log("❌ '키워드' property 없음 또는 타입 다름");
                return;
            }

            console.log(
                "📊 현재 키워드 옵션 개수:",
                keywordProp.multi_select.options.length
            );

            // 3️⃣ 옵션 초기화
            await notion.dataSources.update({
                data_source_id: dataSourceId,
                properties: {
                    [keywordProp.id]: {
                        multi_select: {
                            options: []
                        }
                    }
                }
            });

            console.log("✅ Keyword 옵션 초기화 완료");

        } catch (error) {
            console.error("❌ Keyword 옵션 초기화 실패", error);
        }
    }

    // private static async moveNotionPage(
    //     notion: Client,
    //     accessToken: string,
    //     userId: string,
    //     sourcePage: any,
    //     aiResult: any
    // ): Promise<string | undefined> {
    //     const sourceProperties = sourcePage.properties ?? {};

    //     const extractTitle = (property: any) => {
    //         return property?.title?.[0]?.text?.content ?? "";
    //     };

    //     const extractRelationIds = (property: any) => {
    //         return property?.relation?.map((v: any) => v.id).filter(Boolean) ?? [];
    //     };

    //     const sourceTitle =
    //         extractTitle(sourceProperties.할일) ||
    //         extractTitle(sourceProperties.이름) ||
    //         "";

    //     const sourceTagIds = extractRelationIds(sourceProperties.태그);

    //     console.log("[NotionMove] source", {
    //         sourcePageId: sourcePage.id,
    //         sourceTitle,
    //         sourceTagIds,
    //         targetDb: aiResult.db
    //     });

    //     const databaseId = await this.resolveDatabaseId(
    //         accessToken,
    //         userId,
    //         aiResult.db
    //     );

    //     const dataSourceId = await this.resolveDataSourceId(
    //         accessToken,
    //         databaseId
    //     );

    //     const properties: any = {};

    //     if (aiResult.db === "task") {
    //         const typeMap: Record<string, string> = {
    //             "할것": "할 것",
    //             "살것": "살 것",
    //             "읽을것": "읽을 것",
    //             "볼것": "볼 것",
    //             "갈곳": "갈 곳"
    //         };

    //         properties.할일 = {
    //             title: [{
    //                 text: {
    //                     content: aiResult.title ?? sourceTitle
    //                 }
    //             }]
    //         };

    //         properties.유형 = {
    //             status: {
    //                 name: typeMap[aiResult.type] ?? aiResult.type ?? "할 것"
    //             }
    //         };

    //         properties.분류 = {
    //             select: {
    //                 name: aiResult.kinds ?? "수집함"
    //             }
    //         };

    //         if (aiResult.importance) {
    //             properties.중요도 = {
    //                 select: {
    //                     name: aiResult.importance
    //                 }
    //             };
    //         }

    //         if (aiResult.urgency) {
    //             properties.긴급도 = {
    //                 select: {
    //                     name: aiResult.urgency
    //                 }
    //             };
    //         }
    //     } else if (aiResult.db === "memo" || aiResult.db === "reference") {
    //         const tagDbName = aiResult.db === "memo"
    //             ? "memo tag"
    //             : "reference tag";

    //         const tagDbId = await this.resolveDatabaseId(
    //             accessToken,
    //             userId,
    //             tagDbName
    //         );

    //         const tagIds = await this.resolveTagIds(
    //             accessToken,
    //             tagDbId,
    //             aiResult.tags ?? []
    //         );

    //         properties.이름 = {
    //             title: [{
    //                 text: {
    //                     content: aiResult.title ?? sourceTitle
    //                 }
    //             }]
    //         };

    //         properties.태그 = {
    //             relation: tagIds.map(id => ({ id }))
    //         };

    //         if (aiResult.type) {
    //             const typeDbName = aiResult.db === "memo"
    //                 ? "memo type"
    //                 : "reference type";

    //             const typeDbId = await this.resolveDatabaseId(
    //                 accessToken,
    //                 userId,
    //                 typeDbName
    //             );

    //             const typeIds = await this.resolveOrCreateRelationIds(
    //                 accessToken,
    //                 typeDbId,
    //                 [aiResult.type]
    //             );

    //             if (typeIds.length > 0) {
    //                 properties.유형 = {
    //                     relation: typeIds.map(id => ({ id }))
    //                 };
    //             }

    //             if (aiResult.db === "memo") {
    //                 const colorMap: Record<string, string> = {
    //                     "아이디어": "파란색",
    //                     "연락처": "분홍색",
    //                     "계정 정보": "초록색",
    //                     "필기": "보라색",
    //                     "개인 문서": "노란색",
    //                     "독서 기록": "보라색"
    //                 };

    //                 const color = colorMap[aiResult.type];

    //                 if (color) {
    //                     properties.색상 = {
    //                         select: {
    //                             name: color
    //                         }
    //                     };
    //                 }
    //             }
    //         }

    //         if (aiResult.importance) {
    //             properties.중요도 = {
    //                 select: {
    //                     name: aiResult.importance
    //                 }
    //             };
    //         }
    //     }

    //     // 기존 페이지의 블록 가져오기
    //     const response = await notion.blocks.children.list({
    //         block_id: sourcePage.id
    //     });

    //     const sourceBlocks = response.results as any[];

    //     console.log("[NotionMove] source blocks", {
    //         count: sourceBlocks.length,
    //         types: sourceBlocks.map(block => block.type)
    //     });

    //     // 기존 블록을 새 페이지에 넣을 수 있는 형태로 변환
    //     const copiedBlocks: any[] = sourceBlocks
    //         .map((block: any) => {
    //             const type = block.type;
    //             const content = block[type];

    //             if (!content) {
    //                 return null;
    //             }

    //             // 이미지
    //             if (type === "image") {
    //                 if (content.type === "external" && content.external?.url) {
    //                     return {
    //                         object: "block",
    //                         type: "image",
    //                         image: {
    //                             type: "external",
    //                             external: {
    //                                 url: content.external.url
    //                             }
    //                         }
    //                     };
    //                 }

    //                 if (content.type === "file" && content.file?.url) {
    //                     return {
    //                         object: "block",
    //                         type: "image",
    //                         image: {
    //                             type: "external",
    //                             external: {
    //                                 url: content.file.url
    //                             }
    //                         }
    //                     };
    //                 }

    //                 return null;
    //             }

    //             // 일반 블록
    //             const allowedTypes = [
    //                 "paragraph",
    //                 "heading_1",
    //                 "heading_2",
    //                 "heading_3",
    //                 "bulleted_list_item",
    //                 "numbered_list_item",
    //                 "to_do",
    //                 "toggle",
    //                 "quote",
    //                 "callout",
    //                 "code",
    //                 "divider",
    //                 "bookmark",
    //                 "embed",
    //                 "equation"
    //             ];

    //             if (!allowedTypes.includes(type)) {
    //                 console.log("[NotionMove] unsupported block", {
    //                     id: block.id,
    //                     type
    //                 });
    //                 return null;
    //             }

    //             return {
    //                 object: "block",
    //                 type,
    //                 [type]: content
    //             };
    //         })
    //         .filter(Boolean);

    //     console.log("[NotionMove] blocks prepared", {
    //         count: copiedBlocks.length,
    //         types: copiedBlocks.map((block: any) => block.type)
    //     });

    //     // 새 페이지 생성
    //     const page: any = await notion.pages.create({
    //         parent: {
    //             data_source_id: dataSourceId
    //         },
    //         properties,
    //         template: {
    //             type: "default"
    //         }
    //     });

    //     const newPageId = page.id;

    //     console.log("[NotionMove] created", {
    //         from: sourcePage.id,
    //         to: newPageId,
    //         db: aiResult.db
    //     });

    //     try {
    //         // 기존 본문 복사
    //         if (copiedBlocks.length > 0) {
    //             await notion.blocks.children.append({
    //                 block_id: newPageId,
    //                 children: copiedBlocks
    //             });

    //             console.log("[NotionMove] existing content copied", {
    //                 count: copiedBlocks.length
    //             });
    //         }

    //         // AI 분석 결과 추가
    //         if (aiResult.content?.trim()) {
    //             await notion.blocks.children.append({
    //                 block_id: newPageId,
    //                 children: [{
    //                     object: "block",
    //                     type: "paragraph",
    //                     paragraph: {
    //                         rich_text: [{
    //                             type: "text",
    //                             text: {
    //                                 content: aiResult.content.trim()
    //                             }
    //                         }]
    //                     }
    //                 }]
    //             });

    //             console.log("[NotionMove] ai content added");
    //         }

    //         // 모든 복사가 성공한 후 기존 페이지 archive
    //         await notion.pages.update({
    //             page_id: sourcePage.id,
    //             archived: true
    //         });

    //         console.log("[NotionMove] archived", {
    //             pageId: sourcePage.id
    //         });
    //     } catch (error) {
    //         console.error("[NotionMove] copy failed", {
    //             sourcePageId: sourcePage.id,
    //             newPageId,
    //             error
    //         });

    //         // 복사 실패 시 기존 페이지는 절대 삭제하지 않음
    //         throw error;
    //     }

    //     return newPageId;
    // }

    // #kakao notion
    static async createDbItemFromAiResult(userId: string, aiResult: any, entity: any): Promise<string | undefined> {
        console.log("[createDbItemFromAiResult] called");
        console.log("[createDbItemFromAiResult] aiResult =", JSON.stringify(aiResult, null, 2));

        if (!aiResult?.db || !["create", "correct"].includes(aiResult.action)) {
            console.log("[createDbItemFromAiResult] skipped", {
                action: aiResult?.action,
                db: aiResult?.db
            });
            return undefined;
        }

        let pageId: string | undefined;

        console.log(`[NotionCreate] start db = ${aiResult?.db} action = ${aiResult?.action} title = "${aiResult?.title ?? ""}" entity = ${entity?.type ?? "text"} `);

        const userDoc = await db.collection("users").doc(userId).get();
        const accessToken = userDoc.data()?.notionAccessToken;
        console.log(`[NotionCreate] accessToken = ${!!accessToken} `);
        if (!accessToken) {
            throw new Error("NOTION_NOT_CONNECTED");
        }
        const notion = new Client({ auth: accessToken });
        const databaseId = await this.resolveDatabaseId(accessToken, userId, aiResult.db);
        console.log(`[NotionCreate] database resolved db = ${aiResult.db} databaseId = ${databaseId} `);

        let dataSourceId = await this.resolveDataSourceId(accessToken, databaseId);

        const entityBlocks = this.buildEntityBlocks(entity);
        const contentBlocks: any[] = [...entityBlocks];
        const hasContext = entity?.context && typeof entity.context === "string" && entity.context.trim().length > 0;

        ////////////////////////////////////////////////////
        if (aiResult.action === "correct") {
            try {
                pageId = await waitForTargetPageId(userId, aiResult.contextId);

                const sourcePage: any = await notion.pages.retrieve({
                    page_id: pageId
                });
                const sourceDatabaseId = sourcePage.parent?.database_id;
                const targetDatabaseId = await this.resolveDatabaseId(
                    accessToken,
                    userId,
                    aiResult.db
                );
                const targetDataSourceId = await NotionService.resolveDataSourceId(
                    accessToken,
                    targetDatabaseId
                );

                if (sourceDatabaseId !== targetDatabaseId) {
                    await notion.pages.move({
                        page_id: pageId,
                        parent: {
                            type: 'data_source_id',
                            data_source_id: targetDataSourceId
                        }
                    });

                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await notion.pages.update({
                        page_id: pageId,
                        template: {
                            type: 'default'
                        }
                    });
                    // await new Promise(resolve => setTimeout(resolve, 3000)); // 위에 await로는 노션에서 템플릿 만드는 시간을 기다리지 않음
                    console.log("[NotionMove] database changed", {
                        from: sourceDatabaseId,
                        to: targetDatabaseId,
                        targetDb: aiResult.db,
                        targetDataSourceId
                    });
                }
            } catch (e) {
                console.warn("[NotionCorrect] target page not found. create new page.", e);
                aiResult.response +=
                    "\n\n⚠️ 원본 항목을 찾지 못해 수정할 수 없었습니다. 대신 새 항목으로 등록했습니다.";

                pageId = undefined;
                return;
            }
        }

        ////////////////////////////////////////////////////
        // contentBlocks  추가
        if (aiResult.content && !hasContext) {
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
            if (youtubeRegex.test(aiResult.content.trim())) {
                // URL 텍스트
                contentBlocks.push({
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [
                            {
                                type: "text",
                                text: {
                                    content: aiResult.content.trim()
                                }
                            }
                        ]
                    }
                });

                // 기존 embed
                contentBlocks.push({
                    object: "block",
                    type: "embed",
                    embed: {
                        url: aiResult.content.trim()
                    }
                });
            } else {
                contentBlocks.push({
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{
                            type: "text",
                            text: { content: aiResult.content }
                        }]
                    }
                });
            }
        }

        //////////////////////////////////////////////////
        // properties

        let properties: any;
        switch (aiResult.db) {
            case "task": {
                const parsed = resolveDateExpr(aiResult.dateExpr);

                const typeMap: Record<string, string> = {
                    "할것": "할 것",
                    "살것": "살 것",
                    "읽을것": "읽을 것",
                    "볼것": "볼 것",
                    "갈곳": "갈 것"
                };
                const normalizedType = typeMap[aiResult.type] ?? aiResult.type ?? "할 것";

                properties = {
                    할일: {
                        title: [{ text: { content: aiResult.title ?? "" } }]
                    },
                    유형: {
                        status: { name: normalizedType }
                    },
                    분류: {
                        select: { name: aiResult.kinds ?? "수집함" }
                    }
                };

                if (aiResult.importance) {
                    properties.중요도 = {
                        select: { name: aiResult.importance }
                    };
                }

                if (aiResult.urgency) {
                    properties.긴급도 = {
                        select: { name: aiResult.urgency }
                    };
                }

                if (parsed) {
                    properties.날짜 = {
                        date: {
                            start: parsed.hasTime
                                ? formatDateTime(parsed.date)
                                : formatDate(parsed.date),
                            ...(parsed.hasTime ? { time_zone: "Asia/Seoul" } : {})
                        }
                    };
                }
                break;
            }

            case "memo":
            case "reference": {
                const tagDbName = aiResult.db === "memo" ? "memo tag" : "reference tag";
                const tagDbId = await this.resolveDatabaseId(accessToken, userId, tagDbName);

                const tagIds = await this.resolveTagIds(accessToken, tagDbId, aiResult.tags ?? []);

                properties = {
                    이름: {
                        title: [{ text: { content: aiResult.title ?? "" } }]
                    },
                    태그: {
                        relation: tagIds.map(id => ({ id }))
                    }
                };


                if (aiResult.type) {
                    const typeDbName = aiResult.db === "memo" ? "memo type" : "reference type";
                    const typeDbId = await this.resolveDatabaseId(accessToken, userId, typeDbName);
                    const typeIds = await this.resolveOrCreateRelationIds(
                        accessToken,
                        typeDbId,
                        [aiResult.type]
                    );

                    if (typeIds.length > 0) {
                        properties.유형 = {
                            relation: typeIds.map(id => ({ id }))
                        };
                    }

                    // 메모에 색지정
                    if (aiResult.db === 'memo') {
                        const colorMap: Record<string, string> = {
                            "아이디어": "파란색",
                            "연락처": "분홍색",
                            "계정 정보": "초록색",
                            "필기": "보라색",
                            "개인 문서": "노란색",
                            "독서 기록": "보라색"
                        };

                        const color = colorMap[aiResult.type];

                        if (color) {
                            properties.색상 = {
                                select: {
                                    name: color
                                }
                            };
                        }
                    }
                }

                if (aiResult.importance) {
                    properties.중요도 = {
                        select: { name: aiResult.importance }
                    };
                }

                console.log("[CREATE CHECK]", {
                    pageId,
                    action: aiResult.action
                });
                break;
            }

            default:
                throw new Error(`Unsupported db type: ${aiResult.db}`);
        }

        if (pageId) {
            // 속성 바꾸고
            await notion.pages.update({
                page_id: pageId,
                properties
            });
            // 기존 블럭 삭제하고 새 블럭으로 교체 할 필요가 있는가?

        } else {
            // 기본 템플릿 만들고 
            const page: any = await notion.pages.create({
                parent: { data_source_id: dataSourceId! },
                properties,
                template: {
                    type: "default"
                }
            });
            pageId = page.id;

            // 10초 기다리고
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 기존 블럭 삭제, 필요한 것인가?

            // 새 컨텐츠 블럭 넣어주고
            if (contentBlocks.length > 0) {
                await notion.blocks.children.append({
                    block_id: pageId!,
                    children: contentBlocks
                });
            }

            console.log(`[NotionCreate][task] created pageId = ${pageId}`);
        }


        // // 새로 만들면
        // if (!pageId) {
        //     // 기본 템플릿 만들고 
        //     const page: any = await notion.pages.create({
        //         parent: { data_source_id: dataSourceId! },
        //         properties,
        //         template: {
        //             type: "default"
        //         }
        //     });
        //     pageId = page.id;

        //     // 10초 기다리고
        //     await new Promise(resolve => setTimeout(resolve, 10000));

        //     // 새 컨텐츠 블럭 넣어주고
        //     if (contentBlocks.length > 0) {
        //         await notion.blocks.children.append({
        //             block_id: pageId!,
        //             children: contentBlocks
        //         });
        //     }

        //     console.log(`[NotionCreate][task] created pageId = ${pageId}`);
        // } else {

        //     // 속성 바꾸고
        //     await notion.pages.update({
        //         page_id: pageId,
        //         properties
        //     });

        //     // // 기존 블럭 삭제
        //     // const existingBlocks = await notion.blocks.children.list({
        //     //     block_id: pageId
        //     // });
        //     // for (const block of existingBlocks.results) {
        //     //     await notion.blocks.delete({
        //     //         block_id: block.id
        //     //     });
        //     // }

        //     // // 새 블럭 넣어주고
        //     // if (contentBlocks.length > 0) {
        //     //     await notion.blocks.children.append({
        //     //         block_id: pageId,
        //     //         children: contentBlocks
        //     //     });
        //     // }
        //     console.log(`[NotionCreate][task] updated pageId = ${pageId}`);
        // }


        await writeUserEvent(userId, {
            agentId: AgentId.KAKAO_CAPTURE,
            status: "completed",
            eventTitle: `${aiResult.db} ${aiResult.action === "create" ? "생성" : "수정"}`,
            description: [
                `action = ${aiResult.action}`,
                `db = ${aiResult.db}`,
                `pageId = ${pageId ?? "-"}`,
                `title = ${aiResult.title ?? "-"}`,
                `type = ${aiResult.type ?? "-"}`,
                aiResult.kinds ? `kinds = ${aiResult.kinds}` : null,
                aiResult.tags?.length ? `tags = ${aiResult.tags.join(", ")}` : null,
                aiResult.dateExpr ? `date = ${aiResult.dateExpr}` : null,
                entity?.type ? `entity = ${entity.type}` : null
            ]
                .filter(Boolean)
                .join("\n")
        });

        console.log(`[NotionCreate] done db = ${aiResult.db} action = ${aiResult.action} pageId = ${pageId ?? "-"}`);

        return pageId;
    }


    // static async createDbItemFromAiResult(
    //     userId: string,
    //     aiResult: any,
    //     entity: any
    // ): Promise<string | undefined> {
    //     if (
    //         !aiResult?.db ||
    //         !["create", "correct"].includes(aiResult.action)
    //     ) {
    //         return undefined;
    //     }

    //     let pageId: string | undefined;

    //     console.log(`[NotionCreate] start db = ${aiResult?.db} action = ${aiResult?.action} title = "${aiResult?.title ?? ""}" entity = ${entity?.type ?? "text"} `);

    //     if (aiResult.action === "correct" && !aiResult.targetPageId) {
    //         console.log(`[NotionCreate] correct but targetPageId missing`);
    //         return undefined;
    //     }
    //     const targetPageId = aiResult.targetPageId;

    //     // get Notion accessToken
    //     const userDoc = await db.collection("users").doc(userId).get();
    //     const accessToken = userDoc.data()?.notionAccessToken;
    //     console.log(`[NotionCreate] accessToken = ${!!accessToken} `);
    //     if (!accessToken) return undefined;

    //     // get database
    //     const notion = new Client({ auth: accessToken });
    //     const databaseId = await this.resolveDatabaseId(
    //         accessToken,
    //         userId,
    //         aiResult.db
    //     );
    //     console.log(`[NotionCreate] database resolved db = ${aiResult.db} databaseId = ${databaseId} `);

    //     // create image
    //     const children: any[] = [
    //         ...this.buildEntityBlocks(entity)
    //     ];

    //     console.log(`[NotionCreate] entity blocks = ${children.length} `);

    //     // content
    //     if (aiResult.content) {
    //         children.push({
    //             object: "block",
    //             type: "paragraph",
    //             paragraph: {
    //                 rich_text: [{
    //                     type: "text",
    //                     text: { content: aiResult.content }
    //                 }]
    //             }
    //         });

    //         console.log(`[NotionCreate] content added length = ${aiResult.content.length} `);
    //     }

    //     switch (aiResult.db) {
    //         ////////////////////////////////////////////////////////////
    //         case "task": {
    //             console.log(
    //                 `[NotionCreate][task] title = "${aiResult.title ?? ""}" type = ${aiResult.type ?? "-"} kinds = ${aiResult.kinds ?? "-"} importance = ${aiResult.importance ?? "-"} urgency = ${aiResult.urgency ?? "-"} date = ${aiResult.dateExpr ?? "-"} `
    //             );

    //             const importanceMap: Record<number, string> = {
    //                 1: "중요",
    //                 2: "매우 중요"
    //             };

    //             const urgencyMap: Record<number, string> = {
    //                 1: "긴급",
    //                 2: "매우 긴급"
    //             };

    //             const parsed = resolveDateExpr(aiResult.dateExpr);

    //             console.log(`[NotionCreate][task] parsedDate = ${parsed ? parsed.date.toISOString() : "none"} hasTime = ${parsed?.hasTime ?? false} `);

    //             const typeMap: Record<string, string> = {
    //                 "할것": "할 것",
    //                 "살것": "살 것",
    //                 "읽을것": "읽을 것",
    //                 "볼것": "볼 것",
    //                 "갈곳": "갈 곳"
    //             };

    //             const normalizedType =
    //                 typeMap[aiResult.type] ??
    //                 aiResult.type ??
    //                 "할 것";

    //             const properties: any = {
    //                 할일: {
    //                     title: [{
    //                         text: {
    //                             content: aiResult.title ?? ""
    //                         }
    //                     }]
    //                 },
    //                 유형: {
    //                     status: {
    //                         name: normalizedType
    //                     }
    //                 },
    //                 분류: {
    //                     select: {
    //                         name: aiResult.kinds ?? "수집함"
    //                     }
    //                 }
    //             };

    //             if (importanceMap[aiResult.importance]) {
    //                 properties.중요도 = {
    //                     select: {
    //                         name: importanceMap[aiResult.importance]
    //                     }
    //                 };
    //             }

    //             if (urgencyMap[aiResult.urgency]) {
    //                 properties.긴급도 = {
    //                     select: {
    //                         name: urgencyMap[aiResult.urgency]
    //                     }
    //                 };
    //             }

    //             if (parsed) {
    //                 properties.날짜 = {
    //                     date: {
    //                         start: parsed.hasTime
    //                             ? parsed.date.toISOString()
    //                             : parsed.date.toISOString().slice(0, 10)
    //                     }
    //                 };
    //             }

    //             if (aiResult.action === "create") {
    //                 console.log(
    //                     `[NotionCreate][task] creating page`
    //                 );

    //                 const page: any = await notion.pages.create({
    //                     parent: {
    //                         database_id: databaseId
    //                     },
    //                     properties
    //                 });

    //                 pageId = page.id;
    //                 console.log(`[NotionCreate][task] created pageId id = ${pageId} `);
    //             } else {
    //                 const targetPageId = aiResult.targetPageId;
    //                 if (!targetPageId) {
    //                     throw new Error("targetPageId required for correct");
    //                 }

    //                 await notion.pages.update({
    //                     page_id: targetPageId,
    //                     properties
    //                 });

    //                 pageId = targetPageId; 
    //                 console.log(
    //                     `[NotionCreate][task] updated targetPageId = ${targetPageId} `
    //                 );
    //             }

    //             break;
    //         }

    //         ////////////////////////////////////////////////////////////
    //         case "memo":
    //         case "reference": {
    //             console.log(
    //                 `[NotionCreate][${aiResult.db}]title = "${aiResult.title ?? ""}" type = ${aiResult.type ?? "-"} tags = ${(aiResult.tags ?? []).join(",")} children = ${children.length} `
    //             );

    //             // get Tag db
    //             const tagDbName = aiResult.db === "memo" ? "memo tag" : "reference tag";
    //             const tagDbId = await this.resolveDatabaseId(
    //                 accessToken,
    //                 userId,
    //                 tagDbName
    //             );
    //             console.log(`[NotionCreate][${aiResult.db}]tagDb = ${tagDbName} tagDbId = ${tagDbId} `);

    //             // get tags
    //             const tagIds = await this.resolveTagIds(
    //                 accessToken,
    //                 tagDbId,
    //                 aiResult.tags ?? []
    //             );
    //             console.log(`[NotionCreate][${aiResult.db}]tagIds = ${tagIds.length} `);

    //             const properties: any = {
    //                 이름: {
    //                     title: [{
    //                         text: {
    //                             content: aiResult.title ?? ""
    //                         }
    //                     }]
    //                 },
    //                 태그: {
    //                     relation: tagIds.map(id => ({
    //                         id
    //                     }))
    //                 }
    //             };

    //             if (aiResult.type) {
    //                 // 유형 처리
    //                 const typeDbName = aiResult.db === "memo" ? "memo type" : "reference type";
    //                 const typeDbId = await this.resolveDatabaseId(
    //                     accessToken,
    //                     userId,
    //                     typeDbName
    //                 );

    //                 const typeIds = await this.resolveRelationIds(
    //                     accessToken,
    //                     typeDbId,
    //                     [aiResult.type]
    //                 );

    //                 if (typeIds.length > 0) {
    //                     properties.유형 = {
    //                         relation: typeIds.map(id => ({ id }))
    //                     };
    //                 }
    //                 console.log(`[NotionCreate][${aiResult.db}] type="${aiResult.type}" relationCount=${typeIds.length}`);
    //             }

    //             if (aiResult.action === "create") {
    //                 console.log(`[NotionCreate][${aiResult.db}] creating page`);
    //                 const page: any = await notion.pages.create({
    //                     parent: {
    //                         database_id: databaseId
    //                     },
    //                     properties,
    //                     children: children.length
    //                         ? children
    //                         : undefined
    //                 });
    //                 pageId = page.id;
    //                 console.log(`[NotionCreate][${aiResult.db}] created id = ${targetPageId} `);
    //             } else {
    //                  const targetPageId = aiResult.targetPageId;
    //                 if (!targetPageId) {
    //                     throw new Error("targetPageId required for correct");
    //                 }

    //                 await notion.pages.update({
    //                     page_id: targetPageId,
    //                     properties
    //                 });

    //                 pageId = targetPageId; 
    //                 console.log(`[NotionCreate][${aiResult.db}] updated id = ${targetPageId} `);
    //             }
    //             break;
    //         }

    //         default:
    //             console.log(
    //                 `[NotionCreate] unsupported db = ${aiResult.db} `
    //             );
    //             throw new Error(
    //                 `Unsupported db type: ${aiResult.db} `
    //             );
    //     }

    //     console.log(
    //         `[NotionCreate] write event db = ${aiResult.db} action = ${aiResult.action} title = "${aiResult.title ?? ""}" targetPageId = ${targetPageId ?? "-"} `
    //     );

    //     await writeUserEvent(userId, {
    //         agentId: AgentId.KAKAO_CAPTURE,
    //         status: "completed",
    //         eventTitle: `${aiResult.db} ${aiResult.action === "create"
    //             ? "생성"
    //             : "수정"
    //             } `,
    //         description: [
    //             `action = ${aiResult.action} `,
    //             `db = ${aiResult.db} `,
    //             `targetPageId = ${targetPageId ?? "-"} `,
    //             `title = ${aiResult.title ?? "-"} `,
    //             `type = ${aiResult.type ?? "-"} `,
    //             aiResult.kinds
    //                 ? `kinds = ${aiResult.kinds} `
    //                 : null,
    //             aiResult.tags?.length
    //                 ? `tags = ${aiResult.tags.join(",")} `
    //                 : null,
    //             aiResult.dateExpr
    //                 ? `date = ${aiResult.dateExpr} `
    //                 : null,
    //             entity?.type
    //                 ? `entity = ${entity.type} `
    //                 : null,
    //             `confidence = ${aiResult.confidence ?? "-"} `
    //         ].filter(Boolean).join(" | ")
    //     });

    //     console.log(
    //         `[NotionCreate] done db = ${aiResult.db} action = ${aiResult.action} targetPageId = ${targetPageId ?? "-"} `
    //     );

    //     return pageId;
    // }


    static async resolveTagIds(
        accessToken: string,
        tagDbId: string,
        tags: string[]
    ): Promise<string[]> {
        console.log(`[Tag] start tagDbId = ${tagDbId} tags = ${tags.join(",")} `);

        const notion = new Client({ auth: accessToken });

        const db: any = await notion.databases.retrieve({
            database_id: tagDbId
        });

        const dataSourceId = db.data_sources?.[0]?.id;

        console.log(`[Tag] dataSourceId = ${dataSourceId ?? "none"} `);

        if (!dataSourceId) {
            console.log(
                `[Tag] data source not found tagDbId = ${tagDbId} `
            );
            throw new Error(`data source not found: ${tagDbId} `);
        }

        const result: string[] = [];

        for (const tag of [...new Set(tags.map(t => t.trim()).filter(Boolean))]) {
            console.log(
                `[Tag] lookup tag = "${tag}"`
            );

            const existing: any = await notion.dataSources.query({
                data_source_id: dataSourceId,
                filter: {
                    property: "이름",
                    title: {
                        equals: tag
                    }
                }
            });

            if (existing.results.length > 0) {
                console.log(
                    `[Tag] existing tag = "${tag}" id = ${existing.results[0].id} `
                );

                result.push(existing.results[0].id);
                continue;
            }

            console.log(
                `[Tag] create tag = "${tag}"`
            );

            const created: any = await notion.pages.create({
                parent: {
                    data_source_id: dataSourceId
                },
                properties: {
                    이름: {
                        title: [
                            {
                                text: {
                                    content: tag
                                }
                            }
                        ]
                    }
                },
                template: {
                    type: "default"
                }
            });

            console.log(`[Tag] created tag = "${tag}" id = ${created.id} `);
            result.push(created.id);
        }

        console.log(`[Tag] done count = ${result.length} `);
        return result;
    }

    static buildEntityBlocks(entity: any): any[] {
        if (!entity?.type) {
            console.log(`[Entity] skip type = none`);
            return [];
        }

        switch (entity.type) {
            case "image":
                return this.buildImageBlocks(entity);

            case "youtube":
                return this.buildYoutubeBlocks(entity);

            default:
                console.log(`[Entity] unsupported type = ${entity.type}`);
                return [];
        }
    }

    static buildImageBlocks(entity: any): any[] {
        const objects: string[] = Array.isArray(entity.objects) ? entity.objects : [];
        const ocrText: string = typeof entity.ocrText === "string" ? entity.ocrText.trim() : "";
        const context: string = typeof entity.context === "string" ? entity.context.trim() : "";
        const imageUrl: string = typeof entity.url === "string" ? entity.url.trim() : "";

        console.log(`[Entity][image] start image = ${!!imageUrl} objects = ${objects.length} ocr = ${ocrText.length}`);

        const children: any[] = [];

        if (imageUrl.length > 0) {
            children.push({
                object: "block",
                type: "image",
                image: {
                    type: "external",
                    external: { url: imageUrl }
                }
            });
        }

        if (context.length > 0) {
            children.push({
                object: "block",
                type: "heading_3",
                heading_3: {
                    rich_text: [
                        {
                            type: "text",
                            text: { content: context }
                        }
                    ]
                }
            });
        }

        if (ocrText.length > 0) {
            children.push({
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [
                        {
                            type: "text",
                            text: { content: ocrText }
                        }
                    ]
                }
            });
        }

        if (objects.length > 0) {
            children.push({
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: objects.map(t => `#${t}`).join(", ")
                            },
                            annotations: { color: "blue" }
                        }
                    ]
                }
            });
        }

        console.log(`[Entity][image] done blocks = ${children.length}`);

        return children;
    }

    // #youtube
    // entity: {
    //     type: "youtube",
    //     url: userMessage.trim(),
    //     title,
    //     author,
    //     thumbnail,
    //     description
    // }
    static buildYoutubeBlocks(entity: any): any[] {
        const thumbnail: string = typeof entity.thumbnail === "string" ? entity.thumbnail.trim() : "";
        const title: string = typeof entity.title === "string" ? entity.title.trim() : "";
        const channel: string = typeof entity.channel === "string" ? entity.channel.trim() : "";
        //const description: string = typeof entity.description === "string" ? entity.description.trim() : "";
        const videoUrl: string = typeof entity.url === "string" ? entity.url.trim() : "";

        console.log(`[Entity][youtube] start thumbnail = ${!!thumbnail} title = ${title.length} channel = ${channel.length}`);

        const children: any[] = [];

        if (thumbnail.length > 0) {
            children.push({
                object: "block",
                type: "image",
                image: {
                    type: "external",
                    external: {
                        url: thumbnail
                    }
                }
            });
        }

        if (videoUrl.length > 0) {
            children.push({
                object: "block",
                type: "embed",
                embed: {
                    url: videoUrl
                }
            });
        }

        // if (title.length > 0) {
        //     children.push({
        //         object: "block",
        //         type: "heading_3",
        //         heading_3: {
        //             rich_text: [
        //                 {
        //                     type: "text",
        //                     text: {
        //                         content: title,
        //                         link: videoUrl ? { url: videoUrl } : undefined
        //                     }
        //                 }
        //             ]
        //         }
        //     });
        // }

        // if (channel.length > 0) {
        //     children.push({
        //         object: "block",
        //         type: "paragraph",
        //         paragraph: {
        //             rich_text: [
        //                 {
        //                     type: "text",
        //                     text: {
        //                         content: `채널: ${channel}`
        //                     }
        //                 }
        //             ]
        //         }
        //     });
        // }

        // if (description.length > 0) {
        //     children.push({
        //         object: "block",
        //         type: "paragraph",
        //         paragraph: {
        //             rich_text: [
        //                 {
        //                     type: "text",
        //                     text: {
        //                         content: description
        //                     }
        //                 }
        //             ]
        //         }
        //     });
        // }

        console.log(`[Entity][youtube] done blocks = ${children.length}`);

        return children;
    }


    // static buildEntityBlocks(entity: any): any[] {
    //     if (!entity || entity.type !== "image") {
    //         console.log(`[Entity] skip type = ${entity?.type ?? "none"}`);
    //         return [];
    //     }

    //     const objects: string[] = Array.isArray(entity.objects) ? entity.objects : [];
    //     const ocrText: string = typeof entity.ocrText === "string" ? entity.ocrText.trim() : "";
    //     const context: string = typeof entity.context === "string" ? entity.context.trim() : "";
    //     const imageUrl: string = typeof entity.url === "string" ? entity.url.trim() : "";

    //     console.log(`[Entity] start type = ${entity.type} image = ${!!imageUrl} objects = ${objects.length} ocr = ${ocrText.length}`);

    //     const children: any[] = [];

    //     // 1. image
    //     if (imageUrl.length > 0) {
    //         children.push({
    //             object: "block",
    //             type: "image",
    //             image: {
    //                 type: "external",
    //                 external: { url: imageUrl }
    //             }
    //         });
    //     }

    //     // 2. context
    //     if (context.length > 0) {
    //         children.push({
    //             object: "block",
    //             type: "heading_3",
    //             heading_3: {
    //                 rich_text: [
    //                     {
    //                         type: "text",
    //                         text: { content: context }
    //                     }
    //                 ]
    //             }
    //         });
    //     }

    //     // 3. OCR
    //     if (ocrText.length > 0) {
    //         children.push({
    //             object: "block",
    //             type: "paragraph",
    //             paragraph: {
    //                 rich_text: [
    //                     {
    //                         type: "text",
    //                         text: { content: ocrText }
    //                     }
    //                 ]
    //             }
    //         });
    //     }

    //     // 4. objects tags
    //     if (objects.length > 0) {
    //         const tagLine = objects.map(t => `#${t}`).join(", ");

    //         children.push({
    //             object: "block",
    //             type: "paragraph",
    //             paragraph: {
    //                 rich_text: [
    //                     {
    //                         type: "text",
    //                         text: { content: tagLine },
    //                         annotations: { color: "blue" }
    //                     }
    //                 ]
    //             }
    //         });
    //     }

    //     console.log(`[Entity] done blocks = ${children.length}`);

    //     return children;
    // }
}


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
export const generateNotionNoteKMDataBatch = onRequest({ timeoutSeconds: 540, memory: "1GiB", },
    withCors(async (req, res) => {
        const { userId } = req.body;
        try {
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
            const batchPages: { pageId: string; title: string; content: string; }[] = [];

            // page.content가져오느라 시간이 많이 걸리는 부분
            let testIndex = 0;
            for (const page of response.results) {
                try {
                    // keyword가 db에 없으면 노션에서 가져옴
                    const pageData: { pageId: string; title: string; content: string; } | null
                        = await getAndUpdatePageData(userId, page, accessToken, { skipIfKeywordsExist: true });

                    // ✅ 이벤트  
                    if (pageData) {
                        await writeUserEvent(userId, {
                            agentId: AgentId.SECOND_BRAIN,
                            status: "running",
                            eventTitle: `< span style = "color:#7fb7ff" > ${pageData.title} </span> 노트의 키워드 추출 작업을 진행중입니다.`
                        });
                    }

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
                    { title: string; content: string }
                > = {};

                batch.forEach(n => {
                    pageData[n.pageId] = {
                        title: n.title,
                        content: n.content,
                        //keywords: n.keywords,
                    };
                });

                try {
                    /////////////////
                    // 키워드 추출       

                    // 기존 키워드 리스트 가져오기
                    let existingKeywords: string[] = await loadKeywordsFromCache(userId);

                    // ai 키워드 추출
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

                    // ✅ 이벤트  
                    // await writeUserEvent(userId, {
                    //     eventType: "generate-note-keyword",
                    //     status: "running",
                    //     eventTitle: `10개이내 노트의 키워드 생성을 완료했습니다.`
                    // });                
                } catch (err) {
                    console.error("AI 처리 실패:", err);
                    failCount += batch.length;
                }
            }

            // ❌ 페이지 변환 실패 이벤트 (1회)
            await writeUserEvent(userId, {
                agentId: AgentId.SECOND_BRAIN,
                status: "completed",
                eventTitle: `요청한 ${successCount}개의 노트의 키워드 추출 작업을 완료하였습니다.`
            });

            res.status(200).json({
                message: "노트 속성 + AI keywords + keywords 저장 완료",
                successCount,
                failCount,
            });

        } catch (error: any) {
            console.error(error);
            res.status(500).send(error.message);

            // ❌ 페이지 변환 실패 이벤트 (1회)
            await writeUserEvent(userId, {
                agentId: AgentId.SECOND_BRAIN,
                status: "failed",
                eventTitle: `키워드 추출 작업 중 오류가 발생했습니다.`
            });
        }
    }
    ));

const DEBOUNCE_DELAY = 60 * 1000; // 3초: 마지막 이벤트 후 대기 시간

// #webhook
export const handleNotionWebhookSinglePage = onRequest({ timeoutSeconds: 540, memory: "512MiB" }, withCors(async (req, res) => {
    const event = req.body;
    //console.log("[Notion Webhook Payload]", event);

    // 🔑 노션에서 이 함수가 제대로 응답하는지 확인 하기 위함 용도 : 웹훅 구독 인증 토큰 확인
    if (event.type === "webhook_verification") {
        console.log("[Webhook Verification] token:", event.token);
        return res.status(200).send(event.token);
    }

    // 1️⃣ "페이지 콘텐츠 업데이트됨" 이벤트만 처리
    if (event.type !== "page.content_updated") {
        return res.status(200).json({ message: `이벤트 타입 ${event.type}은 처리하지 않음.` });
    }

    const pageId = event.entity?.id;
    const databaseId =
        event.data?.parent?.database_id ??
        event.data?.parent?.id;

    if (!pageId || !databaseId) {
        return res.status(200).json({ message: "missing ids" });
    }
    res.status(200).send("ok");

    try {
        // ----------------------------
        // Firestore에서 userId / accessToken 찾기
        // ----------------------------

        let userId: string | null = null;
        let accessToken: string | null = null;

        // 1️⃣ 빠른 lookup
        const mapRef = db.collection("notionDatabaseMap").doc(databaseId);
        const mapDoc = await mapRef.get();

        if (mapDoc.exists) {
            const data = mapDoc.data();
            userId = data?.userId;
            accessToken = data?.accessToken;
        }

        // 2️⃣ fallback (기존 구조)
        if (!userId || !accessToken) {
            console.log(`[Webhook] mapping 없음 → fallback search`);

            const usersSnapshot = await db.collection("users").get();

            for (const userDoc of usersSnapshot.docs) {
                const sbDoc = await userDoc.ref
                    .collection("integrations")
                    .doc("secondbrain")
                    .get();

                if (!sbDoc.exists) continue;

                const sbData = sbDoc.data();

                if (sbData?.noteDatabaseId === databaseId) {
                    userId = userDoc.id;
                    accessToken = sbData?.accessToken;

                    // 찾았으면 mapping 생성 (자동 마이그레이션)
                    await mapRef.set(
                        {
                            userId,
                            accessToken,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );

                    console.log(`[Webhook] mapping 자동 생성: ${databaseId}`);
                    break;
                }
            }
        }

        if (!userId || !accessToken) {
            console.error("해당 DB와 매칭되는 userId 또는 accessToken을 찾을 수 없음");
            return;
        }

        // ----------------------------
        // 3️⃣ Firestore에 이벤트 큐 기록 (마지막 이벤트 덮어쓰기)
        // ----------------------------
        const queueRef = db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("secondbrain")
            .collection("webhook_queue")
            .doc(pageId);

        const now = Date.now();
        await queueRef.set(
            {
                lastEventTimestamp: now,
                //lastEventPayload: event,
            },
            { merge: true }
        );

        // ----------------------------
        // 4️⃣ 마지막 이벤트만 처리: DEBOUNCE_DELAY 이후
        // ----------------------------
        setTimeout(async () => {
            try {
                const latestDoc = await queueRef.get();
                if (!latestDoc.exists) return;

                const latestTimestamp = latestDoc.data()?.lastEventTimestamp;

                // 내가 마지막 이벤트가 아니면 종료
                if (latestTimestamp !== now) {
                    console.log(`[${pageId}] 더 최신 이벤트 존재 → 타이머 연장됨`);
                    return;
                }

                console.log(`[${pageId}] 60초 동안 추가 이벤트 없음 → 처리 시작`);
                await processWebhookEvent(userId!, accessToken!, pageId);

                // 큐 정리
                await queueRef.delete();
            } catch (err) {
                console.error(`[${pageId}] debounce worker error`, err);
            }
        }, DEBOUNCE_DELAY);
        // return res.status(200).json({
        //     message: "이벤트 수신 (debounce 대기중)",
        // });
    } catch (error: any) {
        console.error("노션 웹훅 처리 실패:", error);
    }
})
);

// ----------------------------
// 페이지 처리 함수
// ----------------------------
// #page

async function processWebhookEvent(userId: string, accessToken: string, pageId: string) {
    // notion API에서 페이지의 propery(title), block 가져오기
    const page = await NotionService.getNotionPage(accessToken, pageId);
    console.log(`[${pageId}] page fetched`);

    const pageData = await getAndUpdatePageData(userId, page, accessToken);
    if (!pageData) {
        console.log(`[${pageId}] 페이지 데이터 없음`);
        return;
    }

    // 진행 이벤트 기록
    await writeUserEvent(userId, {
        agentId: AgentId.SECOND_BRAIN,
        status: "running",
        eventTitle: `<span style="color:#7fb7ff">${pageData.title}</span> 노트 키워드 추출 진행`,
    });

    // ----------------------------
    // AI 키워드 추출
    const existingKeywords = await loadKeywordsFromCache(userId);
    const aiResultRaw = await requestPageKeywordsFromAI({ [pageId]: pageData }, existingKeywords);
    const aiResult = filterUndefinedId({ [pageId]: pageData }, aiResultRaw);

    const normalized: Record<string, string[]> = {};
    for (const [key, keywords] of Object.entries(aiResult)) {
        normalized[key] = Array.from(
            new Set(keywords.map((kw) => normalizeKeyword(kw, existingKeywords)))
        );
    }

    // Notion 반영
    await NotionService.applyKeywordsToNotionPages(accessToken, normalized);

    // Firestore 저장
    const pageRef = db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .collection("pages")
        .doc(pageId);
    await pageRef.set(
        {
            keywords: normalized[pageId] || []
        },
        { merge: true }
    );

    // 키워드 캐시 업데이트
    const newExistingKeywords = await loadKeywordsFromCache(userId);
    upsertKeywords(userId, newExistingKeywords);

    // 완료 이벤트
    await writeUserEvent(userId, {
        agentId: AgentId.SECOND_BRAIN,
        status: "completed",
        eventTitle: `${pageData.title} 노트 키워드 추출 완료`,
    });

    console.log(`[${pageId}] 처리 완료`);
}



//////////////////////////////////////////////////////////////////////

// export const handleNotionWebhookSinglePage = onRequest(
//     { timeoutSeconds: 300, memory: "512MiB" },
//     withCors(async (req, res) => {
//         console.log("[Notion Webhook Payload]", req.body);
//         const event = req.body;
//         const eventType = event.type;

//         // 🔑 구독 인증 토큰 확인
//         if (req.body.type === "webhook_verification") {
//             console.log("[Webhook Verification] payload:", req.body);
//             console.log("[Webhook Verification] token:", req.body.token);
//             return res.status(200).send(req.body.token);
//         }


//         // 1️⃣ "페이지 콘텐츠 업데이트됨" 이벤트만 처리
//         if (eventType !== "page.content_updated") {
//             return res.status(200).json({ message: `이벤트 타입 ${eventType}은 처리하지 않음.` });
//         }

//         try {
//             // 2️⃣ pageId / databaseId 추출
//             const pageId = event.entity?.id;
//             const databaseId = event.data?.parent?.id;
//             if (!pageId || !databaseId) {
//                 return res.status(400).json({ message: "페이지 ID 또는 DB ID 누락" });
//             }

//             // ----------------------------
//             // Firestore에서 userId 찾기
//             // ----------------------------
//             // secondbrain integration에서 noteDatabaseId와 비교
//             const usersSnapshot = await db.collection("users").get();
//             let userId: string | null = null;
//             let accessToken: string | null = null;

//             for (const userDoc of usersSnapshot.docs) {
//                 const sbDoc = await userDoc.ref.collection("integrations").doc("secondbrain").get();
//                 if (!sbDoc.exists) continue;

//                 const sbData = sbDoc.data();
//                 if (sbData?.noteDatabaseId === databaseId) {
//                     userId = userDoc.id;
//                     accessToken = sbData?.accessToken;
//                     break;
//                 }
//             }

//             if (!userId || !accessToken) {
//                 return res.status(404).json({ message: "해당 DB와 매칭되는 userId 또는 accessToken을 찾을 수 없음" });
//             }

//             // ----------------------------
//             // 4️⃣ 페이지 속성 업데이트
//             // ----------------------------
//             const pageData = await updateNotePropertiesInFirestore(userId, { id: pageId }, accessToken);

//             if (!pageData) {
//                 return res.status(200).json({ message: "페이지 데이터 없음 또는 업데이트할 속성 없음" });
//             }

//             // 진행 이벤트 기록
//             await writeUserEvent(userId, {
//                 eventType: "generate-note-keyword-webhook",
//                 status: "running",
//                 eventTitle: `<span style="color:#7fb7ff">${pageData.title}</span> 노트의 키워드 추출 작업을 진행중입니다.`,
//             });

//             // ----------------------------
//             // 5️⃣ AI 키워드 추출
//             // ----------------------------
//             const existingKeywords = await loadKeywordsFromCache(userId);
//             const aiResultKeywordsRaw = await requestPageKeywordsFromAI({ [pageId]: pageData }, existingKeywords);
//             const aiResultKeywords = filterUndefinedId({ [pageId]: pageData }, aiResultKeywordsRaw);

//             const normalized: Record<string, string[]> = {};
//             for (const [key, keywords] of Object.entries(aiResultKeywords)) {
//                 normalized[key] = Array.from(
//                     new Set(keywords.map((kw) => normalizeKeyword(kw, existingKeywords)))
//                 );
//             }

//             // Notion에 키워드 반영
//             await NotionService.applyKeywordsToNotionPages(accessToken, normalized);

//             // Firestore에 저장
//             for (const pid of Object.keys(normalized)) {
//                 await db
//                     .collection("users")
//                     .doc(userId)
//                     .collection("integrations")
//                     .doc("secondbrain")
//                     .collection("pages")
//                     .doc(pid)
//                     .set(
//                         {
//                             title: pageData.title,
//                             keywords: normalized[pid] || [],
//                         },
//                         { merge: true }
//                     );
//             }

//             // 키워드 캐시 업데이트
//             const newExistingKeywords = await loadKeywordsFromCache(userId);
//             upsertKeywords(userId, newExistingKeywords);

//             // 완료 이벤트
//             await writeUserEvent(userId, {
//                 eventType: "generate-note-keyword-webhook",
//                 status: "completed",
//                 eventTitle: `${pageData.title} 노트의 키워드 추출 완료`,
//             });

//             return res.status(200).json({ message: "단일 페이지 키워드 처리 완료", pageId, keywords: normalized[pageId] });
//         } catch (error: any) {
//             console.error("노션 웹훅 단일 페이지 처리 실패:", error);

//             // 이벤트 기록
//             if (error.userId) {
//                 await writeUserEvent(error.userId, {
//                     eventType: "generate-note-keyword-webhook",
//                     status: "failed",
//                     eventTitle: `페이지 키워드 추출 중 오류 발생: ${error.message}`,
//                 });
//             }

//             return res.status(500).json({ message: error.message });
//         }
//     }
// ));


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

//////////////////////////////////////////////////////////
// #keywords

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
                refCount: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
        );
    }
}


//////////////////////////////////////////////////////////
// #groups

// async function generateGroupsFromKeywords(userId: string) {
//     // 1. pages 에서 키워드 수집
//     const existingKeywords = await loadKeywordsFromPages(userId);
//     if (existingKeywords.length === 0) return;

//     // 2. AI로 그룹 생성
//     const aiResultGroups =
//         await requestGroupsFromKeywordsByAI(existingKeywords);
//     // 형태: Record<groupName, string[]>

//     // 3. 기존 groups 캐시 로드 (중복 방지 / refCount 관리용)
//     const existingGroups = await loadGroupsFromCache(userId);

//     // 4. upsert
//     await upsertGroups(userId, aiResultGroups, existingGroups);
// }

// async function requestGroupsFromKeywordsByAI(existingKeywords: string[]): Promise<Record<string, string[]>> {

//     console.log('requestGroupsFromKeywordsByAI existingKeywords =>', existingKeywords);

//   let prompt = `
// 당신은 지식 관리 시스템을 위한 도메인 및 키워드 구조 설계 전문가입니다.

// 다음에 주어지는 키워드 목록을 보고,
// 각 키워드가 속해야 할 “도메인(domain)”을 분류하라.

// [도메인의 정의]
// - 도메인은 지식의 최상위 개념이며, “이 지식이 어느 세계의 이야기인가”를 나타낸다.
// - 도메인은 세부 주제나 기능명이 아니라, 넓고 안정적인 의미 영역이어야 한다.

// 아래 규칙을 반드시 따르세요.

// 1. 전체 도메인 수는 기존 도메인을 포함하여 5~8개 이내를 유지한다.
// 2. 도메인은 의미의 최상위 개념이어야 합니다.
//    - 단일 주제, 단기 유행, 일회성 개념은 도메인이 될 수 없습니다.
//    - 여러 키워드를 안정적으로 포괄할 수 있어야 합니다.

// 2. 기존 도메인을 최우선으로 활용하세요.
//    - 이미 존재하는 도메인으로 충분히 설명 가능한 경우,새로운 도메인을 생성하지 마세요.
//    - 새 도메인은 기존 도메인으로는 의미가 명확히 담기지 않을 때만 생성합니다.

// 3. 키워드 번역 원칙 
//     - 추가할 도메인이 영어이면 한글로 번역 후 기존 도메인에 동의어가 있으면 동의어로 등록한다. 
//     - 추가 할 도메인이 'tech'이면 한글로 번역하면 '테크'이고 기존 키워드 목록에 '태크'이 있으면 '테크'으로 등록합니다. 
//    - 이 규칙은 키워드 중복과 의미 파편화를 방지하기 위한 필수 규칙입니다.

// 4. 파편화 방지를 최우선 원칙으로 삼으세요.
//    - 도메인과 키워드의 목적은 세분화가 아니라 맥락의 유지입니다.
//    - 지식 구조가 의미 없이 잘게 쪼개지지 않도록, 가능한 한 기존 구조 안으로 흡수·정리하세요.
//    - 도메인과 키워드는 최소 개수로 유지되어야 합니다.

// 5. 도메인은 시간이 지나도 유효해야 합니다.
//    - 툴 이름, 유행어, 특정 콘텐츠명은 도메인이 아닙니다.
//    - 사고방식, 활동 영역, 역할, 시스템 단위의 개념을 우선합니다.

// 6. 결과는 아래 형식을 따르세요.
//    - 도메인명은 한국어로 간결하게 작성합니다.
//    - 각 도메인에 포함되는 키워드 목록을 함께 제공합니다.

// 출력은 반드시 JSON 형식으로만 반환하세요.
// 설명 문장, 마크다운, 부가 텍스트는 포함하지 마세요.

// `;

//     // 🔹 Existing keywords (global context)
//     if (existingKeywords.length) {
//         prompt += `\n[keywords]\n${existingKeywords.join(", ")}\n`;
//     }

//     console.log('requestGroupsFromKeywordsByAI prompt =>', prompt);

//     const response = await clientAI.chat.completions.create({
//         model: "gpt-4.1-mini",
//         messages: [
//         {
//             role: "system",
//             content: `
// You are a strict JSON generator.
// Return valid raw JSON only.
// Do not include markdown, code blocks, or explanations.
// `
//       },
//       {
//         role: "user",
//         content: prompt
//       }
//     ],
//         temperature: 0.3,
//     });

//     const text = response.choices[0].message?.content || "";
//     console.log("[DEBUG] requestGroupsFromKeywordsByAI::AI Keywords 응답 텍스트:", text);

//     try {
//         return safeParseAIJson(text);
//     } catch (err) {
//         console.error("AI Keywords JSON 파싱 실패:", {
//         error: err,
//         rawResponse: text,
//         });
//         throw err;
//     }
// }

// async function loadGroupsFromCache(userId: string): Promise<string[]> {
//     const snapshot = await db
//         .collection("users")
//         .doc(userId)
//         .collection("integrations")
//         .doc("secondbrain")
//         .collection("groups")
//         .get();

//     return snapshot.docs.map(d => d.id);
// }

// async function upsertGroups(
//     userId: string,
//     aiGroups: Record<string, string[]>,
//     existingGroups: string[] = []
// ) {
//     if (!aiGroups || Object.keys(aiGroups).length === 0) return;

//     const baseRef = db
//         .collection("users")
//         .doc(userId)
//         .collection("integrations")
//         .doc("secondbrain")
//         .collection("groups");

//     for (const [groupName, keywords] of Object.entries(aiGroups)) {
//         if (!groupName) continue;

//         const groupId = groupName; // 🔑 지금은 이름 = ID 전략
//         const ref = baseRef.doc(groupId);

//         const isExisting = existingGroups.includes(groupId);

//         await ref.set(
//             {
//                 groupId,
//                 name: groupName,
//                 keywords: keywords ?? [],
//                 updatedAt: new Date(),
//                 refCount: isExisting
//                     ? admin.firestore.FieldValue.increment(0)
//                     : admin.firestore.FieldValue.increment(1),
//             },
//             { merge: true }
//         );
//     }
// }



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

async function getAndUpdatePageData(
    userId: string,
    page: any,
    accessToken: string,
    options?: {
        skipIfKeywordsExist?: boolean;
    }
): Promise<{
    pageId: string;
    title: string;
    content: string;
    contentHash: string;
} | null> {

    const pageId = page.id;

    const pageRef = db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .collection("pages")
        .doc(pageId);

    // 1️⃣ 기존 데이터 조회
    const oldSnap = await pageRef.get();
    const oldData = oldSnap.exists ? oldSnap.data() : undefined;

    const oldTitle = oldData?.title ?? "";
    const oldContentHash = oldData?.contentHash ?? "";
    const oldContentLength = oldData?.contentLength ?? 0;

    const oldKeywords: string[] = Array.isArray(oldData?.keywords)
        ? oldData!.keywords
        : [];

    // keyword 이미 존재하면 skip - skipIfKeywordsExist 일관 변환에서만 skip
    if (
        options?.skipIfKeywordsExist === true &&
        oldKeywords.length > 0
    ) {
        console.log(
            `[SKIP] pageId: ${pageId} - keywords 이미 존재 (${oldKeywords.length}개)`
        );
        return null;
    }

    // 새 데이터 추출 (Notion)
    const { title, content } = await extractPageTitleAndContent(
        page,
        accessToken
    );

    // 0️⃣ 너무 짧은 컨텐츠 skip
    const contentLength = content.length;
    const MIN_CONTENT_LENGTH = 100;

    if (contentLength < MIN_CONTENT_LENGTH) {
        console.log(`[${pageId}] content 너무 짧음 (${contentLength}) → 키워드 추출 skip`);
        return null;
    }

    const contentHash = hashContent(content);

    // ---------------------------
    // 1️⃣ HASH CHECK
    // ---------------------------
    if (title === oldTitle && contentHash === oldContentHash) {
        console.log(`[${pageId}] hash 동일 → 처리 패스`);
        return null;
    }

    // ---------------------------
    // 2️⃣ LENGTH CHECK
    // ---------------------------
    const lengthChangeRatio =
        Math.abs(contentLength - oldContentLength) /
        Math.max(oldContentLength, 1);

    if (lengthChangeRatio < 0.05) {
        console.log(`[${pageId}] length 변화 ${(lengthChangeRatio * 100).toFixed(2)}% → 업데이트`);
        return null;
    }


    // 4️⃣ 변경 있음 → Firestore 저장
    await pageRef.set(
        {
            title,
            contentHash,
            contentLength,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    console.log(`[${pageId}] 변경 감지 및 Firestore 업데이트 완료`);

    // 5️⃣ 후속 처리를 위한 데이터 반환
    return {
        pageId,
        title,
        content,
        contentHash,
    };
}

async function extractPageTitleAndContent(
    page: any,
    accessToken: string
): Promise<{
    pageId: string;
    title: string;
    content: string;
}> {
    const pageId = page.id;

    // 1️⃣ 제목 추출
    const titleProperty =
        page.properties?.["이름"] ||
        page.properties?.["제목"] ||
        page.properties?.["Title"];

    let title = "";
    if (
        titleProperty?.type === "title" &&
        Array.isArray(titleProperty.title)
    ) {
        title = titleProperty.title
            .map((t: any) => t.plain_text)
            .join("")
            .trim();

        if (["새 문서", "Untitled"].includes(title)) {
            title = "";
        }
    }

    // 2️⃣ 페이지 content (비싼 작업)
    let content = await getPageContentText(pageId, accessToken);
    console.log('extractPageTitleAndContent content =>', content);

    // 아래 문구 content에서 제거
    // ▪문서 편집
    // ▪기타
    // ▪AI 도구 - 문서, 기획
    // ▪AI 도구 - 회의록 작성

    // 템플릿 공통 문구 제거
    const TEMPLATE_PHRASES = [
        "▪문서 편집",
        "▪기타",
        "▪AI 도구 - 문서, 기획",
        "▪AI 도구 - 회의록 작성",
        "⚡ AI 도구 바로 가기",
        "노션에서 함께 자주 사용되는 서비스의 연동 방법과 바로 가기를 제공합니다."
    ];

    // 문자열 그대로 찾아 제거
    for (const phrase of TEMPLATE_PHRASES) {
        content = content.split(phrase).join("");
    }

    // 공백 및 빈 줄 정리
    content = content
        .replace(/\n{2,}/g, "\n")
        .trim();

    console.log("extractPageTitleAndContent content =>", content);
    return { pageId, title, content };
}


// Firestore에 실제 저장 (내부 함수)
// async function updateNotePropertiesInFirestoreInternal(
//     userId: string,
//     pageId: string
// //    keywords?: string[]
// ): Promise<void> {
//     const docRef = db
//         .collection("users")
//         .doc(userId)
//         .collection("integrations")
//         .doc("secondbrain")
//         .collection("pages")
//         .doc(pageId);

//     docRef.set(     ,{ merge: true });

//     // 저장할 데이터 객체 구성 (값 있는 것만)
//     // const dataToSave: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
//     // if (Array.isArray(keywords) && keywords.length > 0) {
//     //     dataToSave.keywords = keywords;
//     // }

//     // 값이 하나라도 있으면 Firestore에 저장
//     // if (Object.keys(dataToSave).length > 1) { // updatedAt 제외한 필드가 있으면
//     //     await docRef.set(dataToSave, { merge: true });
//     // }
// }



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

    // text를 최대 5000자 이내로 줄임
    const MAX_LENGTH = 5000;
    const trimmedContent =
        finalContent.length > MAX_LENGTH
            ? finalContent.slice(0, MAX_LENGTH)
            : finalContent;

    console.log(
        `[DEBUG] getPageContentText - pageId: ${pageId}, original length: ${finalContent.length}, trimmed length: ${trimmedContent.length}`
    );
    return trimmedContent;
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



const HELP_RESPONSE = `
당신의 노셔너블 비서를 
어떻게 활용하면 되는지 알려드릴게요. 😊

1. 할 일 등록하기
할일이 떠오르면 바로 알려주세요.
알아서 척척 분류해 드립니다.

분류: 할 것, 살 것, 읽을 것, 볼 것, 갈 곳
유형: 오늘, 내일, 일정, 다음에, 나중에, 대기중
중요도/긴급도: 중요, 매우 중요, 긴급, 매우 긴급 
날짜 : 오늘, 내일, 몇일 후, 아니면 구체적인 날짜를 말씀해주세요.
사진 첨부 가능: 책 표지, 영수증, 기억하고 싶은 사진을 툭 던져주셔도 다 기록해 드립니다.

2. 메모 보관하기
아이디어, 계정 정보, 연락처, 필기, 개인 문서, 독서 메모

3. 참고 자료 저장하기
나중에 다시 보고 싶은 콘텐츠가 있다면 링크만 슥 보내주세요.
유용한 웹사이트 링크, 인터넷 뉴스 기사, 유튜브 같은 영상까지 깔끔하게 수집해 둡니다.

4. 분류가 잘못되었다면 다시 요청해주시면 수정 가능합니다.
`;


// #kakao ai
export const KakaoAgentPrompt = `

# 서비스의 목적 (Purpose)

노셔너블 라이프업 비서는 사용자의 정보를 저장하는 AI 비서입니다.
사용자가 입력한 내용을 올바르게 이해하여 Task, Memo, Reference 또는 일반 대화(chat)으로 정확하게 판단하는 것이 가장 중요한 역할입니다.
사용자는 대부분 정보를 저장하기 위해 이 비서를 사용합니다. 특별한 근거가 없는 한 저장 의도를 우선적으로 고려하세요.

# 역할 (Role)

당신은 "노셔너블 라이프업 비서 AI"입니다.
당신은 단순히 문장을 분류하거나 JSON을 생성하는 AI가 아닙니다.
항상 사용자의 의도를 먼저 이해한 후 가장 적절한 행동(action)을 결정하고, 시스템이 처리할 수 있는 JSON 객체를 생성합니다.

# 판단 원칙 (Principles)

항상 아래 순서대로 판단합니다.

1. 사용자의 목적을 이해합니다.
2. action(create / correct / delete / help / chat / ask)을 우선 결정합니다.
3. action이 create인 경우에만 저장 유형(Task / Memo / Reference)을 판단합니다.
4. action=create가 아니라면 create 관련 규칙은 무시합니다.
5. 선택된 유형의 세부 규칙을 적용합니다.
6. JSON 객체를 생성합니다.

저장 유형을 판단할 때는 다음 우선순위를 따른다.

1. 실행이 필요한 내용(해야 할 일, 살 것, 준비할 것 등)이면 Task를 우선한다.
2. 실행이 목적이 아니라 정보를 기록하거나 보관하는 것이 목적이면 Memo 또는 Reference를 판단한다.

# 중요한 원칙

- 문장의 단어나 키워드만 보고 판단하지 않습니다.
- 항상 사용자가 왜 이 메시지를 보냈는지, 무엇을 하려는지를 먼저 이해합니다.
- 판단이 가능하면 질문보다 추론을 우선합니다.
- 여러 해석이 가능하여 잘못 처리될 가능성이 높은 경우에만 최소한의 질문을 합니다.

# 출력 규칙

출력은 JSON 객체 하나만 허용합니다.

- JSON 외 출력 금지
- 설명, 코드블록, Markdown 출력 금지
- 반드시 action 필드를 포함합니다.
- response는 사용자에게 표시할 문장입니다.
- help인 경우 response는 "" 또는 null입니다.

# Action 규칙

허용값

- create
- correct
- help
- chat
- ask

반드시 하나만 선택합니다.

//////////////////////////////
## create 처리 규칙

action=create인 경우에만 아래 규칙을 적용합니다.

1. 저장 유형(Task / Memo / Reference)을 결정합니다.
2. 해당 유형의 세부 규칙을 적용합니다.
3. title, response 등 공통 규칙을 적용합니다.

# 저장 유형 분류 기준

Task
실행하거나 잊지 않기 위해 저장하는 정보
예) 우유, 빨래, 도쿄, 상실의 시대

Task에는 하나의 행동뿐 아니라 준비물, 체크리스트, 구매 목록 등 실행을 위한 목록도 포함된다.

예)
여행 준비물
캠핑 준비물
마트 장보기
출장 체크리스트

Memo
사용자가 직접 생성하거나 관리하는 정보
예) 내 생각, 내 기록, 내 아이디어, 내 계정 정보

Reference
나중에 참고하기 위해 저장하는 정보
예) 링크, 기사, 논문, 연락처

먼저 저장 목적을 판단한 후 저장 유형을 결정합니다.

1. task

[task.type]

허용값:
"할 것" | "살 것" | "읽을 것" | "볼 것" | "갈 곳"

규칙:

* 기본값: "할 것"
* 구매/쇼핑/구입/사기 → "살 것"
* 책/문서/글/논문/기사 → "읽을 것"
* 영상/영화/드라마/유튜브 → "볼 것"
* 장소/방문/여행/식당 → "갈 곳"

* 고유명사 처리
책 = 읽을 것 / 영화·드라마 = 볼 것 / 장소 = 갈 곳 / 상품 = 살 것

* 단일 명사 처리 규칙
사용자가 한 단어 또는 짧은 명사만 입력한 경우:
1순위: 구매 가능한 실물 물건이면 task(type="살 것")
예:
딸기
바나나
우유
휴지
샴푸
에어팟
노트북
마우스

2순위: 책이나 문서 제목이면 task(type="읽을 것")

3순위: 영화, 드라마, 유튜브, 영상 콘텐츠이면 task(type="볼 것")

4순위: 장소 관련 명사이면 task(type="갈 곳")
포함:
- 국가명
- 도시명
- 지역명
- 관광지
- 랜드마크
- 식당명
- 카페명
- 호텔명
- 공원명
- 역 이름
- 공항명

예:
베트남
나트랑
제주도
에펠탑
스타벅스
인천공항
롯데월드
성심당

5순위: 위 어느 것도 아니면 task(type="할 것")


---

[task.importance]

허용값:
"중요" | "매우 중요"

규칙:

* 중요 관련 언급이 있을 때만 포함한다.
* 언급이 없으면 필드를 출력하지 않는다.
* "중요", "꼭", "반드시", "우선" → "중요"
* "매우 중요", "최우선", "절대 잊지 말기" → "매우 중요"

---

[task.urgency]

허용값:
"긴급" | "매우 긴급"

규칙:

* 긴급 관련 언급이 있을 때만 포함한다.
* 언급이 없으면 필드를 출력하지 않는다.
* "긴급", "빨리", "오늘 안에" → "긴급"
* "매우 긴급", "당장", "즉시" → "매우 긴급"

---

[task.kinds]

허용값:
"수집함" | "다음" | "일정" | "대기중" | "나중에"

규칙:

* 기본값: "수집함"
* 날짜가 있는 경우 → "일정"
* "다음", "다음에", "후속" → "다음"
* 바로 진행할 수 없는 경우 → "대기중"
* "나중에", "언젠가", "천천히" → "나중에"

---

[task.dateExpr]

사용자가 말한 날짜와 시간을 아래 형식으로 변환하여 출력합니다.

실제 날짜나 시간을 계산하거나 추론하지 않습니다.
사용자가 말하지 않은 연도, 월, 일, 오전/오후는 임의로 생성하지 않습니다.

예)

* 오늘 → "today"
* 내일 → "tomorrow"
* 모레 → "dayafter"
* 15분 후 → "now+15m"
* 3시간 후 → "now+3h"
* 7일 후 → "now+7d"
* 이번주 월요일 → "this:monday"
* 다음주 월요일 → "next:monday"
* 이번주 금요일 → "this:friday"
* 오늘 오후 3시 → "today+15:00"
* 내일 오전 9시 → "tomorrow+09:00"
* 모레 오후 6시 → "dayafter+18:00"
* 다음주 월요일 오후 2시 → "next:monday+14:00"
* 2026년 7월 3일 → "date:2026-07-03"
* 8월 8일 → "date:08-08"
* 8일 → "date:08"

[최우선 규칙]
시간 표현의 오전/오후가 명확하지 않으면 다른 모든 판단보다 이 규칙을 우선한다.

- 오전/오후가 명시되지 않은 시간은 절대 추론하지 않는다.
- 날짜가 명시되어 있어도 오전/오후가 불명확하면 ask이다.
- 문맥상 자연스러운 시간이라고 판단하지 않는다.
- 일정의 종류, 장소, 사람, 업무 내용 등을 근거로 오전/오후를 추론하지 않는다.
- "6시"는 오전 6시인지 오후 6시인지 알 수 없으므로 반드시 ask이다.
- "내일 6시"도 반드시 ask이다.
단, "아침 6시", "오전 6시", "저녁 6시", "오후 6시"처럼
시간대가 명시된 경우에는 ask하지 않는다.

예)
"오후 3시 회의"
"8시 30분 택배 발송"
"9시 병원"

출력:
{
  "action": "ask",
  "response": "언제 8시 30분인가요?"
}

예)
"3시 회의"

출력:
{
  "action": "ask",
  "response": "오전 3시인가요, 오후 3시인가요?"
}

2. memo
사용자와 관계가 가까운 정보이다.
사용자가 직접 생성했거나, 관리하거나, 기억해야 하는 정보를 저장한다.

a.type: 아이디어, 계정 정보, 연락처, 필기, 개인 문서, 독서 메모

아이디어: 사용자가 직접 만든 생각, 계획, 발상, 의견, 감상, 회고 등 개인적인 지식과 생각을 저장하는 메모
계정 정보 : 서비스 계정, 로그인 정보, 인증 정보
연락처 : 명함, 전화번호, 주소, 사람과의 연락 정보
필기 : 사용자가 직접 작성하거나 참여하여 생성한 필기, 화이트보드, 강의 노트, 회의 메모
개인 문서 : 사용자와 직접 관련된 문서, 예: 영수증, 병원 기록, 계약서, 고지서 등
독서 메모 : 사용자가 읽고 있는 책의 발췌, 메모, 감상

* 중요 규칙
- 위 메모의 type이 명확할 때만 memo로 분류하고 모호하면 reference로 분류한다.
- 영문/숫자 식별자(예: ESGDbreeze, abc123)는 계정 정보를 우선 고려한다.
- type은 1개 필수
- type 중에 해당하는 경우 1개 이상을 경우 예외적으로 2개까지만 가능

c.importance: 중요, 매우 중요
- 중요 관련 언급이 있을 때만 포함한다.
- 언급이 없으면 필드를 출력하지 않는다.

d.tags: 반드시 tags 규칙에 따라 판단한다.


출력 예시:
{
  "action": "create",
  "db": "memo",
  "title": "카카오톡 AI 비서",
  "type": "아이디어",
  "tags": ["AI"],
  "content": "카카오톡 AI 비서",
  "response": "'카카오톡 AI 비서'를 '메모 - 아이디어'에 등록했습니다."
}


3. reference
- 위 memo 카테고리에 명확하게 해당하지 않는 모든 정보는 reference로 분류한다.
- reference는 나중에 참고하기 위해 수집하는 정보이다.

b.type: 이미지, 동영상, 글, 북마크
c.importance: 중요, 매우 중요
- 중요 관련 언급이 있을 때만 포함한다.
- 언급이 없으면 필드를 출력하지 않는다.importance: 중요, 매우 중요
d.tags: 반드시 tags 규칙에 따라 판단한다.

출력 예시:
{
  "action": "create",
  "db": "reference",
  "title": "카카오톡 AI 비서",
  "type": "글",
  "tags": ["AI"],
  "content": "카카오톡 AI 비서",
  "response": "'카카오톡 AI 비서'를 '메모 - 아이디어'에 등록했습니다."
}

## tags 규칙

tags는 나중에 자료를 다시 찾기 위한 핵심 검색 태그이다.

- create인 memo/reference는 tags 필드를 반드시 포함한다.
- 적절한 대표 태그가 있으면 1개를 출력한다.
- 정말 적절한 태그가 없을 때만 빈 배열 []을 출력한다.
- [이미지 분석] 항목도 tags를 판단하는 데에도 활용한다.


- 1개 이상, 보톤 1개, 꼭 필요한 경우 최대 2개까지만 출력한다.
- 억지로 2개를 채우지 않는다.
- 자료 전체를 대표하는 가장 핵심적인 주제나 대상을 선택한다.
- 제목이나 본문의 단어를 단순히 복사하지 않고 검색에 도움이 되는 핵심 개념을 선택한다.
- 너무 구체적이거나 일회성인 태그를 만들지 않는다.
- 비슷한 의미의 태그를 중복해서 선택하지 않는다.

### 상위 개념 우선

상위·중위·하위 개념이 함께 존재하면 기본적으로 가장 상위의
대표 개념 하나만 선택한다.

- 골프 → 아이언 → 아이언 선택 → "골프"
- 테니스 → 라켓 → 라켓 추천 → "테니스"
- AI → 클로드 → 클로드 사용법 → "AI"

단, 상위 개념이 너무 넓어 자료를 찾는 데 도움이 되지 않는 경우에는
1.5단계 수준의 대표 개념을 선택할 수 있다.

예:
- 시계 → 손목시계 → 손목시계 사진 → "손목시계"
- 자동차 → 전기차 → 전기차 충전 → "전기차"

하위 개념 자체가 자료의 핵심 주제이고 상위 개념이 지나치게 넓다면
하위 개념을 선택한다.

### 기존 태그 우선 사용

[기존 태그]가 제공되면 다음 순서로 판단한다.

1. 자료의 핵심을 대표하는 기존 태그가 있는지 확인한다.
2. 적합한 기존 태그가 있으면 반드시 우선 사용한다.
3. 기존 태그와 의미가 같거나 유사한 새로운 태그를 만들지 않는다.
4. 기존 태그만으로 충분하면 새로운 태그를 추가하지 않는다.
5. 기존 태그로 핵심 주제를 표현하기 어려울 때만 새로운 태그를 만든다.
6. 새로운 태그도 가능한 한 여러 자료에서 재사용할 수 있는 일반적인 이름으로 만든다.

예:

기존 태그:
["AI", "OpenAI", "생산성", "노션"]

자료:
"OpenAI API를 이용한 AI 비서 개발 방법"

결과:
["AI"]

자료:
"노션에서 업무를 관리하는 방법"

결과:
["노션"]

자료:
"골프 초보자의 아이언 선택 방법"

기존 태그:
["골프", "여행", "독서"]

결과:
["골프"]

### 태그 파편화 방지

다음과 같이 지나치게 구체적인 태그를 만들지 않는다.

나쁜 예:
"GPT-4.1-mini-API"
"아이폰12배터리문제"
"골프초보자아이언선택"
"카카오톡AI비서기획"

좋은 예:
"AI"
"여행"
"아이폰"
"말레이시아"
"골프"
"카카오톡"

### 최종 판단

tags의 목적은 자료를 세밀하게 분류하는 것이 아니라
나중에 비슷한 자료를 함께 찾기 위한 대표적인 검색 기준을 만드는 것이다.

따라서 다음 순서로 판단한다.

기존 태그 재사용> 재사용성 > 상위 개념 > 대표성 > 태그 개수

적절한 대표 태그가 없으면 억지로 태그를 만들지 않는다.

//////////////////////////////////////////////////////////////////////////////////////
## ask

ask는 사용자의 의도는 이해했지만 작업을 수행하기 위한 필수 정보가 부족하거나, 사용자의 의도를 하나로 판단할 수 없는 경우 선택합니다.

다음 경우에만 ask를 사용합니다.

1. 날짜 또는 시간이 불완전한 경우

- 시간이 있지만 날짜가 없는 경우
- 시간이 있지만 오전/오후를 알 수 없는 경우

예)

"3시 회의"

{
  "action": "ask",
  "response": "오전 3시인가요, 오후 3시인가요?"
}

예)

"8시 30분 택배 발송"

{
  "action": "ask",
  "response": "언제 8시 30분에 발송하시나요?"
}

2. 저장(create)인지 비서와의 대화(chat)인지 판단할 수 없는 경우

예)

"체중이동은 꼭 해야 하나?"

{
  "action": "ask",
  "response": "메모로 저장할까요, 아니면 제가 답변드릴까요?"
}

예)

"노션은 왜 많이 사용할까?"
{
  "action": "ask",
  "response": "메모로 저장할까요, 아니면 제가 함께 생각해드릴까요?"
}

중요
- ask는 필요한 최소한의 질문만 합니다.
- 충분히 추론 가능한 경우에는 ask를 사용하지 않습니다.
- 잘못 처리될 가능성이 있는 경우에만 ask를 사용합니다.
- 사용자의 답변을 받은 후 create, correct 또는 chat을 수행합니다.

### ask 후속 응답 처리

직전 action이 ask인 경우,
사용자의 다음 입력은 새로운 요청이 아니라
이전 요청에 대한 추가 답변으로 간주한다.

추가 답변을 기존 요청과 합쳐 다시 해석한다.

정보가 충분하면 create를 반환한다.

여전히 정보가 부족하면 ask를 반환한다.

correct를 사용하지 않는다.


//////////////////////////////////////////
## help
- 사용자가 사용법 / 도움말 / 뭐 할 수 있어 / 어떻게 쓰는거야 / 기능 알려줘 를 물어보면 선택

출력:
{
  "action": "help",
  "response": ""
}
중요:
- help일 경우 response는 반드시 빈 문자열 또는 null
- 실제 도움말 문구는 서버에서 처리한다

//////////////////////////////////////////////////////////////////////////////////////////////
## correct

correct는 기존 항목을 수정하기 위한 action이다.

### 판단 원칙 (매우 중요)

correct는 매우 제한적으로 사용한다.
다음 두 조건을 모두 만족하는 경우에만 action="correct"를 선택한다.
1. 사용자가 수정 의사를 명시적으로 표현했다.
2. 수정 대상이 직전 항목임이 명확하다.

위 조건 중 하나라도 만족하지 않으면 반드시 action="create"를 선택한다.

애매한 경우에는 항상 create를 선택한다.

절대 대화 흐름이나 문맥만으로 수정이라고 추론하지 않는다.

---

### 수정 의사로 인정하는 표현

다음과 같이 사용자가 명시적으로 수정을 요청한 경우 correct이다.

- OO로
- 아니
- 수정
- 변경
- 바꿔
- 고쳐
- 다시
- 옮겨
- 추가해
- 삭제해
- ○○으로 변경
- ○○으로 수정
- ○○로 바꿔
- ○○만 바꿔
- ○○만 추가해
- ○○만 삭제해

또한 직전 항목의 속성값 변경으로 명확하게 해석되는 단독 입력도 correct로 처리한다.

예)
- 중요로
- 긴급으로
- 다음으로
- 나중에
- 할 것으로
- 살 것으로

---

### correct 변경값 생성 규칙 (중요)

correct인 경우 반드시 실제 변경할 값을 생성해야 한다.
response만 작성하고 변경 데이터를 생략하지 않는다.

직전 항목의 title, type, importance, urgency, kinds, dateExpr 등의 속성과
현재 사용자 입력을 비교하여 변경할 필드를 결정한다.

사용자가 입력한 값이 특정 속성값과 일치하면 해당 속성을 변경한다.

예)

직전:
{
  "title": "연속 요청 응답 가능하게",
  "type": "할 것"
}

사용자:
중요로

결과:
{
  "action": "correct",
  "importance": "중요"  
}

---

직전:
{
  "title": "치과 예약",
  "dateExpr": "tomorrow+15:00"
}

사용자:
오전으로

결과:
{
  "action": "correct",
  "dateExpr": "tomorrow+03:00"
}

---

### correct 예

직전:
우산 사기

사용자:
우산 2개 사기

→ correct

---

직전:
치과 예약

사용자:
치과 예약 내일로 변경

→ correct

---

직전:
나트랑

사용자:
아니 할 것으로 분류해줘

→ correct

---

### create 예

다음은 반드시 create이다.

- 명사가 변경된 경우
- 새로운 대상이 등장한 경우
- 수정 의사가 명시되지 않은 경우

예)

썬크림 사기
→ 핸드크림 사기

사과 사기
→ 바나나 사기

책 읽기
→ 유튜브 보기

홍길동 명함
→ 김철수 명함

위 예시는 모두 create이다.

직전 항목과 관련 있어 보여도 수정 의사가 명시되지 않았다면 create를 선택한다.

---

### correct 출력 규칙 (중요)
correct는 직전 분류 결과를 기준으로 변경사항만 반환한다.
기존 title, db, type 등 변경되지 않는 값은 생성하지 않는다.

예)

직전:
{
  "action": "create",
  "db": "task",
  "title": "사용자 응답 빠르게 처리하기",
  "type": "할 것"
}

현재:
중요로

출력:
{
  "action": "correct",
  "importance": "중요",
  "response": "중요도를 '중요'로 변경했습니다."
}

---

### 시간대 변경 규칙

기존 dateExpr에 정확한 시간이 있는 경우

- "오전으로"
- "오후로"

같은 시간대 변경 요청은 기존 hour를 유지한 채 오전/오후만 변경한다.

예)

previous:
tomorrow+15:00

사용자:
오전으로

결과:
tomorrow+03:00

previous:
tomorrow+09:00

사용자:
오후로

결과:
tomorrow+21:00

주의:

임의로 09:00, 15:00 등의 기본 시간을 생성하지 않는다.



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
## chat

chat은 사용자가 비서에게 지금 답변, 설명, 의견 또는 도움을 요청하는 경우 선택한다.

### chat 선택 기준

다음 경우 chat으로 판단한다.

1. 질문이나 답변 요청
예)
- 오늘 날씨 어때?
- 추천해줘.
- 알려줘.
- 설명해줘.
- 어떻게 생각해?

2. 지식 또는 작업 요청
예)
- 번역해줘.
- 요약해줘.
- 비교해줘.
- 계산해줘.
- apple 뜻 알려줘.
- Git이 뭐야?

3. 인사 및 일상 대화
예)
- 안녕
- 고마워
- 좋은 아침


### 저장 우선 규칙 (중요)

사용자가 자신의 생각, 기록, 업무, 개선 사항, 해야 할 일을 남기는 경우에는 chat보다 create를 우선한다.
질문 형태라도 나중에 다시 보기 위한 기록 의도가 있으면 create를 선택한다.

예)

"체중이동은 꼭 해야 하나?"
→ create (Memo)

"노션은 왜 많이 사용할까?"
→ create (Memo)

### 개발 작업 및 업무 기록 판단 (중요)

사용자가 개발 작업, 업무 계획, 개선 사항, 기능 추가 사항을 짧게 기록하는 형태로 입력한 경우에는 명령형 문장처럼 보여도 Task로 우선 판단한다.

예)

- 로그인 오류 수정
- 연속 요청 응답 가능하게
- 이미지 분석 기능 추가
- 자동 저장 기능 만들기

위 입력은 비서에게 실행 요청하는 것이 아니라 해야 할 작업 기록으로 판단한다.

### 요청형 문장 처리

"~해줘", "~알려줘", "~조회해줘", "~예약해줘", "~보여줘" 형태라도 먼저 사용자의 목적을 판단한다.

저장(create) 의도로 해석될 수 있는 경우에는 기능 요청으로 판단하지 않고 기존 create 규칙을 우선 적용한다.

예)

- 홍길동 명함
- 여행 준비물
- 회의록
- 카카오톡 AI 비서 아이디어

위 입력은 기능 요청이 아니라 저장 대상으로 판단한다.


### 지원하지 않는 기능 요청

현재 시스템에서 수행할 수 없는 기능 요청은 실행하거나 실행한 것처럼 응답하지 않는다.

예)

- 조회하기
- 완료 처리해줘
- 내일 일정 알려줘
- 예약해줘
- 내 메모 보여줘
- 검색해줘

위와 같은 요청은 수행했다고 가정하거나 조회 결과를 생성하지 않는다.
response에는 현재 지원하지 않는 기능임을 자연스럽게 안내한다.

///////////////////////////////////////////////////////////////////
# '[이미지 분석]' 처리 규칙 (절대 규칙)

사용자 입력이 '[이미지 분석]'으로 시작하는 경우에는
이미지에서 AI가 추출한 OCR, 객체, 설명, 메타데이터 등을 포함한 입력이다.

이 정보는 일반 텍스트와 동일하게 처리하되,
사용자가 이미지를 보낸 목적은 기본적으로 저장(create)으로 판단한다.

## 절대 규칙

- '[이미지 분석]' 입력은 기본적으로 action="create"를 선택한다.
- ask 또는 correct는 선택하지 않는다.
- chat은 사용자가 이미지에 대해 명시적으로 질문하거나 설명, 번역, 분석 등을 요청한 경우에만 선택한다.

## 저장 유형 판단

이미지 여부가 아니라 저장 목적을 기준으로 Task / Memo / Reference를 판단한다.

예)

명함 → Memo - 연락처

영수증 → Memo - 개인 문서

회의 화이트보드 → Memo - 필기

기사 스크린샷 → Reference - 글

문서 캡처 → Memo - 개인 문서

논문 캡처 → Reference - 글

할 일 목록, 체크리스트, 준비물 → Task

## 핵심 원칙

'[이미지 분석]'은 입력 타입이 아니라,
이미지에서 추출한 정보가 포함된 일반 입력이다.

OCR, 객체, 설명, 힌트는 모두 저장 유형을 판단하기 위한 참고 정보로 활용한다.

//////////////////////////////////////////////////////////////////////
title 생성  규칙

## 공통 규칙

- title은 반드시 생성해야 한다.
- title은 파일명이나 노션 페이지 제목으로 사용할 수 있는 형태로 작성한다.
- title과 content를 동일하게 작성하지 않는다.
- title은 사용자의 입력 의도와 핵심 내용을 반영한다.
- title 생성 시 명백한 모바일 입력 오타는 보정한다.

### 오타 보정 규칙

사용자는 모바일 환경에서 입력하므로 입력 과정에서 발생한 오타가 포함될 수 있다.
title 생성 시 의미가 명확한 오타만 보정한다.

보정 대상:
- 자판 입력 오류로 보이는 명백한 오타
- 글자 일부가 잘못 입력된 단어
- 의미가 명확한 잘못 입력된 단어

주의:
- 맞춤법을 적극적으로 교정하지 않는다.
- 사용자의 표현 방식과 말투를 변경하지 않는다.
- 의미가 여러 가지로 해석될 경우 원문을 유지한다.
- 문장을 자연스럽게 다듬거나 요약하는 과정에서 불필요한 수정을 하지 않는다.

[task.title]

규칙:
1. title은 반드시 사용자의 원문 표현을 그대로 유지한다.
2. 문장을 자연스럽게 바꾸거나, 동사 형태를 변경하거나, 유사 표현으로 변환하지 않는다. (매우 중요)
3. AI는 title을 새로 작성하지 않는다. 원문에서 필요한 최소한의 제거만 수행한다.
4. task의 '유형'에 따라 아래 대상 유형에서만 끝 표현 제거가 가능하다.
5. '할 것' 유형은 절대 변경하지 않는다.
6. 사용자의 입력에서 날짜·시간 표현이 dateExpr로 추출된 경우, 해당 날짜·시간 표현은 title에서 제거한다.
7. 제거 후 남은 표현만 title로 사용한다.
8. 날짜·시간 외의 표현은 수정하거나 재작성하지 않는다.

예:
- "8월 8일 태국 출발" → title: "태국 출발"
- "내일 3시 기획회의" → title: "기획회의"
- "다음주 화요일 병원" → title: "병원"
- "오늘 저녁 엄마 전화" → title: "엄마 전화"

주의:
- dateExpr로 해석되지 않은 숫자나 단어는 제거하지 않는다.
- 날짜·시간 표현만 제거하고 나머지 표현은 그대로 유지한다.

### 검색 키워드 변환 대상 유형

다음 유형은 검색 키워드 활용을 위해 마지막 동작 표현만 제거할 수 있다.

대상 유형:
- 살 것
- 읽을 것
- 볼 것
- 갈 곳

제거 대상:
- "사기"
- "읽기"
- "보기"
- "가기"

조건:
- 반드시 문장 마지막에 단독으로 존재할 때만 제거한다.
- 제거 후 남은 나머지 표현은 절대 수정하지 않는다.

예:
- "우산 사기" → "우산"
- "핸드크림 사기" → "핸드크림"
- "클린 코드 읽기" → "클린 코드"
- "오징어게임 보기" → "오징어게임"
- "강남역 맛집 가기" → "강남역 맛집"

### 금지 예

- "오늘 혜민님 업무 정리해야 하는데" → "오늘 혜민님 업무 정리하기" ❌
- "보고서 작성해야 함" → "보고서 작성하기" ❌
- "회의 준비 필요" → "회의 준비하기" ❌

원문:
- "오늘 혜민님 업무 정리해야 하는데"
결과:
- "오늘 혜민님 업무 정리해야 하는데"

[memo.title]

  title은 메모의 핵심 주제를 10~30자 내외로 요약한다.
  content는 원문 내용을 최대한 보존한다.
  title과 content를 동일하게 작성하지 않는다.

  예시

    입력:
    "카카오톡 AI 비서를 만들어서 음성, 이미지 분석까지 연결하면 좋겠다"

    출력:
    {
    "action":"create",
    "db":"memo",
    "title":"카카오톡 AI 비서 아이디어",
    "content":"카카오톡 AI 비서를 만들어서 음성, 이미지 분석까지 연결하면 좋겠다"
    }

[reference.title]
  title은 자료를 식별하기 쉬운 대표 제목을 생성한다.
  content는 원문 내용을 최대한 보존한다.
  title과 content를 동일하게 작성하지 않는다.

    입력:
    "https://example.com 에 RAG 구조 설명이 잘 되어 있다"

    출력:
    {
    "action":"create",
    "db":"reference",
    "title":"RAG 구조 설명 자료",
    "content":"https://example.com 에 RAG 구조 설명이 잘 되어 있다"
    }


11. 중요 규칙:
- 반드시 action 필드를 포함해야 한다 (최상위 필수 필드)
- action이 없으면 절대 유효한 JSON이 아니다
- 모든 응답은 action 기준으로 동작한다

- JSON만 출력
- response는 필수
- codeblock 금지

- 하나만 선택한다.
`;


async function getTagCache(userId: string): Promise<string[]> {
    console.log("[TagCache] get start", { userId });

    const sbDoc = await db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("kakao-capture")
        .get();

    console.log("[TagCache] document exists", {
        userId,
        exists: sbDoc.exists
    });

    const data = sbDoc.data();
    const tags = data?.tagCache;

    console.log("[TagCache] raw data", {
        userId,
        tagCache: tags
    });

    const result = Array.isArray(tags)
        ? tags.filter((tag: any) => typeof tag === "string" && tag.trim())
        : [];

    console.log("[TagCache] get result", {
        userId,
        count: result.length,
        tags: result
    });

    return result;
}

async function updateTagCache(userId: string, tags: string[]): Promise<void> {
    console.log("[TagCache] update start", {
        userId,
        tags
    });

    const ref = db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("kakao-capture");

    const tagCache = [...new Set(
        tags
            .map(tag => tag.trim())
            .filter(Boolean)
    )];

    console.log("[TagCache] update data", {
        userId,
        count: tagCache.length,
        tagCache
    });

    await ref.set({
        tagCache
    }, { merge: true });

    console.log("[TagCache] update success", {
        userId,
        count: tagCache.length,
        tagCache
    });
}

// #kakao ai
async function requestKakaoAssistantActionFromAI(
    userId: string,
    userMessage: string,
    previousResult?: any
): Promise<any> {
    const instructionPrompt = KakaoAgentPrompt;
    const tagCache = await getTagCache(userId);

    let userPrompt: string;

    if (previousResult?.result?.action === "ask") {
        userPrompt = `
            [이전 요청]
            ${previousResult.aiInput}

            [사용자 추가 답변]
            ${userMessage}

            [기존 태그]
            ${tagCache.join(", ") || "(없음)"}

            위 추가 답변을 반영하여 이전 요청을 완성한다.

            규칙
            - 정보가 충분하면 create를 반환한다.
            - 여전히 부족하면 ask를 반환한다.
            - correct는 사용하지 않는다.
        `;
    } else {
        userPrompt = `
            ${previousResult ? `
            [직전 사용자 입력]
            ${previousResult.userMessage}

            [직전 분류 결과]
            ${JSON.stringify(previousResult.result, null, 2)}
            ` : ""}

            [기존 태그]
            ${tagCache.join(", ") || "(없음)"}

            [현재 사용자 입력]
            ${userMessage}
        `;
    }

    console.log('requestKakaoAssistantActionFromAI ', JSON.stringify(previousResult?.result, null, 2));
    console.log('requestKakaoAssistantActionFromAI userPrompt => ', userPrompt);

    const response = await clientAI.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            {
                role: "system",
                content: instructionPrompt
            },
            {
                role: "user",
                content: userPrompt
            }
        ],
        temperature: 0.2
    });

    const text = response.choices[0].message?.content ?? "";
    console.log("[DEBUG] Kakao Assistant AI =>", text);

    try {
        const result = safeParseAssistantJson(text);

        console.log("[TagCache] check", {
            action: result?.action,
            tags: result?.tags,
            tagCache,
            isArray: Array.isArray(result?.tags)
        });

        if (result?.action === "create" &&
            Array.isArray(result?.tags) &&
            result.tags.length > 0) {
            const newTags = result.tags
                .filter((tag: any) => typeof tag === "string" && tag.trim())
                .map((tag: string) => tag.trim());

            const mergedTags = [...new Set([...tagCache, ...newTags])];

            if (mergedTags.length !== tagCache.length) {
                await updateTagCache(userId, mergedTags);
            }
        }


        return result;
    } catch (err) {
        console.error("AI JSON parse failed", {
            error: err,
            rawResponse: text
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

export function safeParseAssistantJson(raw: string): any {
    const parsed = safeParseJson(raw);
    if (!parsed.action) {
        throw new Error(
            'Missing action'
        );
    }
    return parsed;
}

export function safeParseEntityJson(
    raw: string
): any {

    const parsed =
        safeParseJson(raw);

    if (!parsed.category) {
        throw new Error(
            'Missing category'
        );
    }

    if (!parsed.title) {
        throw new Error(
            'Missing title'
        );
    }

    return parsed;
}

export function safeParseJson(
    raw: string
): any {

    if (!raw) {
        throw new Error(
            'Empty AI response'
        );
    }

    let cleaned =
        raw.trim();

    cleaned =
        cleaned.replace(
            /^```json\s*/i,
            ''
        );

    cleaned =
        cleaned.replace(
            /^```\s*/i,
            ''
        );

    cleaned =
        cleaned.replace(
            /\s*```$/,
            ''
        );

    const match =
        cleaned.match(
            /\{[\s\S]*\}/
        );

    if (!match) {
        throw new Error(
            'JSON block not found'
        );
    }

    return JSON.parse(
        match[0]
    );
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

///////////////////////////////////////////////////////////////////////////////
// 
//      #graph

// 타입 정의 (Node/Edge)
interface Node {
    id: string;
    label: string;
    group?: string;
    size?: number; // 참조 수 기반 노드 크기
    color?: any;
    notionPageId?: string;
}

interface Edge {
    from: string;
    to: string;
    weight?: number;
    color?: any;
}

export const getKeywordGraphData = onRequest(
    withCors(async (req, res) => {
        try {
            const { userId, graphType } = req.body;
            if (!userId) {
                return res.status(400).send("userId를 전달해야 합니다.");
            }

            if (graphType !== "keyword-only" && graphType !== "note-keyword") {
                return res.status(400).send(
                    `graphType은 "keyword-only" 또는 "note-keyword"만 가능합니다. 전달된 값: ${graphType}`
                );
            }

            const storeService = new StoreService();
            const pagesKeywords = await storeService.getNoteKeywords(userId);
            if (!pagesKeywords) {
                return res.status(200).json({
                    errorCode: 200,
                    message: "저장된 키워드가 없습니다."
                });
            }

            let graphData: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };
            if (graphType === "keyword-only") {
                graphData = generateKeywordGraphDataOnlyKeywordType(pagesKeywords);
            } else if (graphType === "note-keyword") {
                // 기본: note + keyword
                graphData = generateKeywordGraphDataNoteKeywordType(pagesKeywords);
            }
            return res.status(200).json(graphData);

        } catch (error: any) {
            console.error(error);
            return res.status(500).send(error.message);
        }
    })
);

class StoreService {
    // pages 컬렉션에서 모든 노트의 키워드 가져오기 (페이지 이름 포함, 50자 제한)
    async getNoteKeywords(userId: string): Promise<Record<string, { title: string; keywords: string[] }> | null> {
        // 1️⃣ pages 컬렉션에서 note 문서들 가져오기
        const pagesSnap = await db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("secondbrain")
            .collection("pages")
            .get();

        const allKeywords: Record<string, { title: string; keywords: string[] }> = {};

        pagesSnap.forEach(doc => {
            const page = doc.data();
            const keywords: string[] = Array.isArray(page?.keywords) ? page.keywords : [];

            if (keywords.length > 0) {
                // 페이지 제목 가져오기, 최대 50자
                let title = (page?.title ?? "제목 없음").toString();
                if (title.length > 50) title = title.slice(0, 50);

                allKeywords[doc.id] = { title, keywords };
            }
        });

        if (Object.keys(allKeywords).length === 0) {
            return null;
        }
        return allKeywords;
    }
}


/*
        // --- 노드 데이터 ---
        const nodesArray: Node[] = [
            { id: 1, label: "Jean Valjean", group: "main" },
            { id: 2, label: "Javert", group: "secondary" },
            { id: 3, label: "Fantine", group: "secondary" },
            { id: 4, label: "Cosette", group: "main" },
            { id: 5, label: "Marius", group: "secondary" }
        ];

        // --- 엣지 데이터 ---
        const edgesArray: Edge[] = [
            { from: 1, to: 2 },
            { from: 1, to: 3 },
            { from: 1, to: 4 },
            { from: 4, to: 5 },
            { from: 2, to: 3 },
        ];
*/

// Firestore에 컨셉 저장 및 노드/엣지 그래프 데이터 생성 함수

// function generateKeywordGraphDataNoteKeywordType(
//     pagesKeywords: Record<string, { title: string; keywords: string[] }>
// ): { nodes: Node[]; edges: Edge[] } {
//     const nodes: Node[] = [];
//     const edges: Edge[] = [];
//     const keywordToNodeId: Record<string, string> = {};
//     let keywordCounter = 1;

//     for (const [pageId, { title, keywords }] of Object.entries(pagesKeywords)) {
//         const noteNodeId = `page-${pageId}`;
//         // note label: title 50자 제한
//         nodes.push({
//             id: noteNodeId,
//             label: title.length > 50 ? title.slice(0, 50) + "…" : title,
//             group: "page",
//         });

//         for (const keyword of keywords) {
//             const trimmedKeyword = keyword.trim();
//             if (!trimmedKeyword) continue;

//             if (!keywordToNodeId[trimmedKeyword]) {
//                 const keywordNodeId = `keyword-${keywordCounter++}`;
//                 keywordToNodeId[trimmedKeyword] = keywordNodeId;
//                 nodes.push({
//                     id: keywordNodeId,
//                     label: trimmedKeyword,
//                     group: "keyword",
//                 });
//             }

//             edges.push({
//                 from: noteNodeId,
//                 to: keywordToNodeId[trimmedKeyword],
//                 weight: 1,
//             });
//         }
//     }

//     return { nodes, edges };
// }

function generateKeywordGraphDataNoteKeywordType(
    pagesKeywords: Record<string, { title: string; keywords: string[] }>
): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const keywordToNodeId: Record<string, string> = {};

    for (const [pageId, { title, keywords }] of Object.entries(pagesKeywords)) {
        const noteNodeId = `page-${pageId}`;

        nodes.push({
            id: noteNodeId,
            label: title.length > 50 ? title.slice(0, 50) + "…" : title,
            group: "page",
            notionPageId: pageId
        });

        for (const keyword of keywords) {
            const trimmedKeyword = keyword.trim();
            if (!trimmedKeyword) continue;

            if (!keywordToNodeId[trimmedKeyword]) {
                const keywordNodeId = `keyword-${encodeURIComponent(trimmedKeyword)}`;
                keywordToNodeId[trimmedKeyword] = keywordNodeId;

                nodes.push({
                    id: keywordNodeId,
                    label: trimmedKeyword,
                    group: "keyword",
                });
            }

            edges.push({
                id: `${noteNodeId}-${keywordToNodeId[trimmedKeyword]}`,
                from: noteNodeId,
                to: keywordToNodeId[trimmedKeyword],
                weight: 1,
            } as any);
        }
    }

    return { nodes, edges };
}

function generateKeywordGraphDataOnlyKeywordType(
    pagesKeywords: Record<string, { title: string; keywords: string[] }>
): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const keywordCountMap: Record<string, number> = {};
    const edgeMap: Record<string, number> = {};

    // 🔑 keyword → nodeId 매핑 (deterministic)
    const keywordIdMap: Record<string, string> = {};

    // 1️⃣ 키워드 등장 횟수 + 엣지 계산
    for (const { keywords } of Object.values(pagesKeywords)) {
        const uniqueKeywords = Array.from(
            new Set(keywords.map(k => k.trim()).filter(k => k))
        );

        for (const keyword of uniqueKeywords) {
            const trimmedKeyword = keyword.trim();
            if (!trimmedKeyword) continue;

            keywordCountMap[trimmedKeyword] =
                (keywordCountMap[trimmedKeyword] || 0) + 1;

            // ✅ keyword 기반으로 항상 같은 id 생성
            if (!keywordIdMap[trimmedKeyword]) {
                keywordIdMap[trimmedKeyword] =
                    `keyword-${encodeURIComponent(trimmedKeyword)}`;
            }
        }

        for (let i = 0; i < uniqueKeywords.length; i++) {
            for (let j = i + 1; j < uniqueKeywords.length; j++) {
                const [k1, k2] = [
                    uniqueKeywords[i].trim(),
                    uniqueKeywords[j].trim()
                ].sort();

                if (!k1 || !k2) continue;

                const key = `${k1}|${k2}`;
                edgeMap[key] = (edgeMap[key] || 0) + 1;
            }
        }
    }

    const counts = Object.values(keywordCountMap);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    // 2️⃣ HSL → HEX
    function hslToHex(h: number, s: number, l: number) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // 3️⃣ 노드 생성
    for (const [keyword, count] of Object.entries(keywordCountMap)) {
        const logCount = Math.log(count + 1);
        const logMin = Math.log(minCount + 1);
        const logMax = Math.log(maxCount + 1);

        const brightness =
            logMin === logMax
                ? 50
                : 30 + ((logCount - logMin) / (logMax - logMin)) * 40;

        const colorHex = hslToHex(200, 70, brightness);

        nodes.push({
            id: keywordIdMap[keyword],
            label: keyword,
            group: "keyword",
            size: 10 + count * 2,
            color: {
                background: colorHex,
                border: "#003366",
                highlight: {
                    background: colorHex,
                    border: "#003366"
                },
                hover: {
                    background: colorHex,
                    border: "#003366"
                },
                opacity: 1
            }
        });
    }

    // 4️⃣ 엣지 생성
    for (const [key, weight] of Object.entries(edgeMap)) {
        const [k1, k2] = key.split("|");

        const from = keywordIdMap[k1];
        const to = keywordIdMap[k2];

        // ✅ edge id 고정
        const edgeId = `edge-${from}-${to}`;

        edges.push({
            id: edgeId,
            from,
            to,
            weight,
            color: {
                color: "#393E46",
                opacity: 1
            }
        } as any);
    }

    return { nodes, edges };
}



// export const getSecondBrainClient = onRequest(withCors(async (req, res) => {
//     try {
//         if (req.method !== 'POST') {
//             res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
//             return;
//         }

//         const userId = req.body.userId;
//         const clientId = req.body.clientId;

//         // Authorization 헤더에서 Bearer 토큰 추출
//         const authHeader = req.headers['authorization'] as string | undefined;
//         const clientKey = authHeader?.split(' ')[1];

//         if (!userId || !clientId || !clientKey) {
//             res.status(400).json({ error: 'Missing parameters' });
//             return;
//         }

//         const ref = db
//             .collection('users')
//             .doc(userId)
//             .collection('integrations')
//             .doc('secondbrain')
//             .collection('clients')
//             .doc(clientId);

//         const docSnap = await ref.get();
//         if (!docSnap.exists) {
//             res.status(404).json({ error: 'Client not found' });
//             return;
//         }

//         const data = docSnap.data();

//         // clientKey 검증
//         const hashedKey = createHash('sha256').update(clientKey).digest('hex');
//         if (data?.clientKey !== hashedKey) {
//             res.status(401).json({ error: 'INVALID_CLIENT_KEY' });
//             return;
//         }

//         // if (data?.revoked) {
//         //     res.status(401).json({ error: 'CLIENT_REVOKED' });
//         //     return;
//         // }

//         if (data?.expiresAt.toDate() < new Date()) {
//             res.status(401).json({ error: 'CLIENT_EXPIRED' });
//             return;
//         }

//         // clientKey는 내려주지 않고 metadata만 반환
//         res.json({
//             clientId,
//             createdAt: data.createdAt.toDate().toISOString(),
//             expiresAt: data.expiresAt.toDate().toISOString(),
//             lastAccessAt: data.lastAccessAt,
//             userAgent: data.userAgent,
//             //revoked: data.revoked,
//         });
//     } catch (e) {
//         console.error(e);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// }));


// export const verifyClientKey = functions.https.onRequest(
//     withCors(async (req, res) => {
//         try {
//             if (req.method !== 'POST') {
//                 res.status(405).json({ valid: false, reason: 'METHOD_NOT_ALLOWED' });
//                 return;
//             }

//             const { userId, clientId } = req.body;
//             const clientKey = req.headers['x-client-key'] as string;

//             if (!userId || !clientId || !clientKey) {
//                 res.status(400).json({ valid: false, reason: 'MISSING_PARAMS' });
//                 return;
//             }

//             const ref = db
//                 .collection('users')
//                 .doc(userId)
//                 .collection('integrations')
//                 .doc('secondbrain')
//                 .collection('clients')
//                 .doc(clientId);

//             const snap = await ref.get();
//             if (!snap.exists) {
//                 res.status(401).json({ valid: false, reason: 'NOT_FOUND' });
//                 return;
//             }

//             const data = snap.data()!;
//             const hashedKey = createHash('sha256').update(clientKey).digest('hex');

//             // if (data.revoked) {
//             //     res.status(401).json({ valid: false, reason: 'REVOKED' });
//             //     return;
//             // }

//             if (data.hashedKey !== hashedKey) {
//                 res.status(401).json({ valid: false, reason: 'INVALID_KEY' });
//                 return;
//             }

//             if (data.expiresAt.toDate() < new Date()) {
//                 res.status(401).json({ valid: false, reason: 'EXPIRED' });
//                 return;
//             }

//             res.json({ valid: true });
//         } catch (e) {
//             console.error(e);
//             res.status(500).json({ valid: false, reason: 'SERVER_ERROR' });
//         }
//     })
// );


/*

0. export extractPageTitleAndContent
    notion page에서 페이지 제목, 페이지 내용, '키워드' => secondrain/pages/{noteId}/title, content, keyword 에 저장
1. export updateAllNotePropertiesInFirestore : notion note database에서 모든 노트 읽어서 필요한 필드를 firestore에 저장 
2. generateNoteKMProperties : secondrain/pages/{noteId}/title, content, keyword => secondrain/pages/{noteId}/keywords, keywords, domain 에 만들어서 넣음
* 주의! 여기서 keyword는 가져오는 것과 추가하는 것이 같은 필드 : 기존값을 토대로 새로운 값을 업데이트 함, ai가 판단  
3. generateKMData 
    secondrain/pagess/{noteId}/keywords, keywords, domain => secondbrain/kmData / 바로 그래프로 사용할 수 있는 JSON


   "keywords": [],      노션에 저장(O) / 사용자 (O) / AI (O)
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




*/

export const verifyPurchaser = onRequest(withCors(async (req, res) => {
    try {
        const { templateId, email, phone } = req.body;

        if (!templateId) {
            return res.status(200).json({
                message: 'templateId가 필요합니다.',
            });
        }

        if (!email && !phone) {
            return res.status(200).json({
                message: 'email 또는 phone 중 하나는 필요합니다.',
            });
        }

        const normalizedEmail = email?.trim().toLowerCase();
        const normalizedPhone = phone?.trim();

        let purchaserData: any = null;
        let purchaserId: string | null = null;

        // 이메일 조회
        if (normalizedEmail) {
            const emailQuerySnap = await db.collection('purchasers')
                .where('templateId', '==', templateId)
                .where('email', '==', normalizedEmail)
                .limit(1)
                .get();

            if (!emailQuerySnap.empty) {
                const purchaserDoc = emailQuerySnap.docs[0];

                if (purchaserDoc) {
                    purchaserId = purchaserDoc.id;
                    purchaserData = purchaserDoc.data();
                }
            }
        }

        // 전화번호 조회 (이메일로 못 찾았을 경우)
        if (!purchaserData && normalizedPhone) {
            const phoneQuerySnap = await db.collection('purchasers')
                .where('templateId', '==', templateId)
                .where('phone', '==', normalizedPhone)
                .limit(1)
                .get();

            if (!phoneQuerySnap.empty) {
                const purchaserDoc = phoneQuerySnap.docs[0];

                if (purchaserDoc) {
                    purchaserId = purchaserDoc.id;
                    purchaserData = purchaserDoc.data();
                }
            }
        }

        if (!purchaserData) {
            return res.status(200).json({
                message: '구매 내역을 찾을 수 없습니다.',
            });
        }

        return res.status(200).json({
            purchaserId,
            purchaser: purchaserData,
        });

    } catch (error) {
        console.error('verifyPurchaser error:', error);

        return res.status(500).json({
            message: '서버 오류가 발생했습니다.',
        });
    }
}));

// minInstances:1 => 콜드 스타트 방지, 사용비용 발생
// #kakao
export const kakaoWebhook = onRequest({ timeoutSeconds: 60, memory: "512MiB" }, withCors(async (req, res) => {
    const payload = req.body;
    const utterance = payload?.userRequest?.utterance?.trim() ?? '';
    const user = payload?.userRequest?.user;
    const kakaoUserId = user?.properties?.plusfriendUserKey || user?.id;
    const callbackUrl = payload?.userRequest?.callbackUrl;

    try {
        logKakaoRequest(payload, user, kakaoUserId);

        ///////////////////////////////////////////////////
        // 연결된 사용자 조회
        const connection = await findEnabledConnectedUser(kakaoUserId);
        if (connection) {
            if (!connection.enabled) {
                return res.json({
                    version: "2.0",
                    template: {
                        outputs: [
                            {
                                simpleText: {
                                    text: [
                                        "현재 카카오톡 AI 비서 자동화가 꺼져 있습니다.",
                                        "",
                                        "노셔너블 비서를 이용하려면 자동화 에이전트 관리에서 '카카오톡 AI 비서 자동화'를 활성화해주세요."
                                    ].join("\n")
                                }
                            }
                        ]
                    }
                });
            }

            // 1. 카카오에 즉시 응답
            res.json({
                version: "2.0",
                useCallback: true,
                data: {
                    text: "처리중입니다..."
                }
            });

            const userDoc = db.collection("users").doc(connection.uid);
            await userDoc
                .collection("integrations")
                .doc("kakao-capture")
                .collection("webhook_queue")
                .add({
                    type: "capture",
                    utterance,
                    user,
                    kakaoUserId,
                    callbackUrl,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: "pending"
                });

            console.log(
                "[KAKAO] queue created",
                { uid: connection.uid }
            );
            return;
        }

        // 여기부터는 미연결 사용자
        if (/^\d{4}$/.test(utterance)) {
            return await processVerificationCode(
                res,
                utterance,
                kakaoUserId
            );
        }
        return resposeKakaoMessage(
            [
                "노셔너블 비서입니다.",
                "",
                "아직 카카오톡 연결이 완료되지 않았습니다.",
                "notionable.net에 접속하여 카카오톡 연결을 먼저 진행해주세요."
            ].join('\n'),
            res
        );
    } catch (error) {
        console.error("[KAKAO WEBHOOK ERROR]", error);
        return res.status(500).json({
            message: [
                "처리 중 오류가 발생했습니다.",
                "잠시 후 다시 시도해주세요."
            ].join('\n')
        });
    }
})
);

export const handleKakaoWebhookQueue = onDocumentCreated(
    "users/{userId}/integrations/kakao-capture/webhook_queue/{jobId}",
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        const { userId, jobId } = event.params;

        console.log("[KAKAO QUEUE] start", { userId, jobId });

        try {
            await processKakaoAgent(
                userId,
                data.utterance,
                data.callbackUrl,
                jobId
            );

            await snapshot.ref.delete();

            console.log("[KAKAO QUEUE] success", {
                userId,
                jobId
            });

        } catch (error) {
            console.error("[KAKAO QUEUE] ERROR", {
                userId,
                jobId,
                error
            });

            await snapshot.ref.update({
                status: "error",
                error: String(error),
                updatedAt: Date.now()
            });
        }
    }
);

function logKakaoRequest(
    payload: any,
    user: any,
    kakaoUserId: string
) {
    console.log(
        "[KAKAO RAW]",
        JSON.stringify(payload, null, 2)
    );

    console.log("[KAKAO USER]", {
        kakaoUserId,
        type: user?.type,
        plusfriendUserKey:
            user?.properties?.plusfriendUserKey,
        botUserKey: user?.id
    });
}

// #kakao
async function processKakaoAgent(
    userId: string,
    userMessage: string,
    callbackUrl: string,
    jobId: string
) {
    const userDoc = await db.collection("users").doc(userId).get();
    const accessToken = userDoc.data()?.notionAccessToken;
    if (!accessToken) {
        console.error("[KAKAO NOTION ERROR] Notion accessToken 없음", {
            userId,
            jobId
        });

        await resposeKakaoMessageByCallbackUrl(
            "라이프업 템플릿이 연결되어 있지 않습니다.\n라이프봇을 이용하시려면 먼저 라이프업 템플릿을 연결해주세요.\n👇 템플릿 연결하기\nhttps://notionable.net",
            callbackUrl
        );
        return;
    }

    const totalStart = Date.now();
    const logTime = (label: string, start: number) => { console.log(`[TIME] ${label}: ${Date.now() - start}ms`); };

    let enrichedResult: any;
    let entity: any;
    let contextAiInput = userMessage;

    const locked = await acquireKakaoProcessingLock(userId, jobId);
    if (!locked) {
        await resposeKakaoMessageByCallbackUrl(
            "⏳ 이전 요청을 처리하고 있습니다.\n잠시 후 다시 말씀해주세요. 🙂",
            callbackUrl
        );
        return;
    }

    try {
        let t = Date.now();
        const prepared = await prepareAssistantInput(userMessage, userId);
        logTime("prepareAssistantInput", t);

        const { aiInput, entity: preparedEntity } = prepared;
        entity = preparedEntity;

        t = Date.now();
        const previousResult: any = await getLastAssistantContext(userId);
        console.log("[processKakaoAgent] previousResult =>", previousResult);
        logTime("getLastAssistantContext", t);

        t = Date.now();
        const result = await requestKakaoAssistantActionFromAI(userId, aiInput, previousResult);
        logTime("requestKakaoAssistantActionFromAI", t);

        enrichedResult = enrichKakaoAssistantResult(result, previousResult);

        contextAiInput =
            previousResult?.result?.action === "ask"
                ? `${previousResult.aiInput}\n${aiInput}`
                : aiInput;

        const payload: any = {
            userMessage,
            aiInput: contextAiInput,
            entity,
            result: enrichedResult,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        console.log("[TIME] saveAssistantContext START");
        t = Date.now();
        enrichedResult.contextId = await saveAssistantContext(userId, payload);
        console.log(`[TIME] saveAssistantContext: ${Date.now() - t}ms`);

    } finally {
        await releaseKakaoProcessingLock(userId, jobId);
    }

    try {
        let t = Date.now();

        // 사용자 응답 
        console.log("[TIME] sendKakaoCallback START");
        await resposeKakaoMessageByCallbackUrl(enrichedResult.response, callbackUrl);
        logTime("sendKakaoCallback", t);

        t = Date.now();

        await processAfterResponse(
            userId,
            entity,
            enrichedResult
        );

        logTime("processAfterResponse", t);
        logTime("TOTAL", totalStart);

    } catch (e) {
        console.error("[KAKAO ERROR - processKakaoAgent]", e);

        try {
            await resposeKakaoMessageByCallbackUrl(
                "처리 중 오류가 발생했습니다.",
                callbackUrl
            );
        } catch { }
    }
}

function enrichKakaoAssistantResult(result: any, previousResult: any) {
    console.log("[enrich] result =", JSON.stringify(result, null, 2));
    console.log("[enrich] previousResult =", JSON.stringify(previousResult, null, 2));

    let enrichedResult = {
        ...result
    };

    // 수정이라면 기존 값에 덮음
    if (enrichedResult.action === "correct" && previousResult) {
        enrichedResult = {
            ...previousResult.result,
            ...enrichedResult,
            action: "correct"
        };

        console.log("[enrich] merged =", JSON.stringify(enrichedResult, null, 2));
    }

    if (enrichedResult.dateExpr && !enrichedResult.kinds) {
        enrichedResult.kinds = "일정";
    }

    if (enrichedResult.action === "help") {
        enrichedResult.response = HELP_RESPONSE;
    }

    if (enrichedResult.action === "correct" && previousResult?.pageId) {
        enrichedResult.targetPageId = previousResult.pageId;
    }

    if (["create", "correct"].includes(enrichedResult.action)) {
        enrichedResult.response = buildAssistantResponse(enrichedResult);
    }

    console.log("[enrich] final =", JSON.stringify(enrichedResult, null, 2));

    return enrichedResult;
}
// Kakao Assistant AI => {
//   "action": "correct",
//   "dateExpr": "tomorrow+19:00",
//   "response": "내일 오후 7시 약속으로 수정했습니다."
// }

export function buildAssistantResponse(result: any): string {
    const lines: string[] = [];

    // 날짜
    if (result.dateExpr) {
        const parsed = resolveDateExpr(result.dateExpr);

        if (parsed) {
            const dateText = parsed.hasTime
                ? formatKoreanDateTime(parsed.date)
                : formatKoreanDate(parsed.date);

            lines.push(`🗓️ ${dateText}`);
            lines.push("");
        }
    }

    // 제목
    if (result.title) {
        lines.push(`📌 ${result.title}`);
    }

    // 할일 · 할 것
    const categoryMap: Record<string, string> = {
        task: "할일",
        memo: "메모",
        reference: "참고자료"
    };

    const category = categoryMap[result.db];
    if (category) {
        lines.push(result.type
            ? `📥 ${category} · ${result.type}`
            : `📥 ${category}`);
    }

    // 중요도
    if (result.importance) {
        lines.push(`⭐ ${result.importance}`);
    }

    // 긴급도
    if (result.urgency) {
        lines.push(`🚨 ${result.urgency}`);
    }

    // 분류
    if (result.kinds) {
        lines.push(`📂 ${result.kinds}`);
    }

    // 태그
    if (result.tags?.length) {
        lines.push(`🏷️ ${result.tags.map((tag: string) => `#${tag}`).join(" ")}`);
    }

    if (lines.length > 0) {
        lines.push("");
    }

    // 안내 문구
    switch (result.action) {
        case "create":
            lines.push(`'${result.title}'을 ${result.type ?? category}으로 등록했습니다.`);
            break;

        case "correct":
            if (result.title) {
                lines.push(`'${result.title}'을 수정했습니다.`);
            } else if (result.dateExpr) {
                lines.push("일정을 수정했습니다.");
            } else {
                lines.push(result.response ?? "수정했습니다.");
            }
            break;

        case "delete":
            lines.push(`'${result.title}'을 삭제했습니다.`);
            break;

        default:
            if (result.response) {
                lines.push(result.response);
            }
    }

    return lines.join("\n");
}

async function resposeKakaoMessageByCallbackUrl(text: string, callbackUrl: string) {
    await fetch(callbackUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text
                        }
                    }
                ]
            }
        })
    });
}

async function resposeKakaoMessage(text: string, res: any) {
    return res.json({
        version: "2.0",
        template: {
            outputs: [
                {
                    simpleText: {
                        text
                    }
                }
            ]
        }
    });
}

// #kakao notion
async function processAfterResponse(
    userId: string,
    entity: any,
    aiResult: any,
) {
    const start = Date.now();

    try {
        let pageId: string | undefined;

        console.log("[processAfterResponse] aiResult =", JSON.stringify(aiResult, null, 2));
        console.log("[processAfterResponse] action =", aiResult?.action);
        console.log("[processAfterResponse] db =", aiResult?.db);
        console.log("[processAfterResponse] entity =", JSON.stringify(entity, null, 2));

        console.log("[TIME] NotionService.createDbItemFromAiResult START");
        let t = Date.now();

        try {
            pageId = await NotionService.createDbItemFromAiResult(userId, aiResult, entity);
            console.log("[processAfterResponse] pageId =", pageId);

            if (pageId) {
                console.log(
                    "[CONTEXT UPDATE]",
                    aiResult.contextId,
                    pageId
                );
                await db
                    .collection("users")
                    .doc(userId)
                    .collection("assistantContext")
                    .doc(aiResult.contextId)
                    .update({
                        pageId
                    });
            }
        } catch (error) {
            console.error("[NOTION ERROR]", {
                userId,
                action: aiResult?.action,
                db: aiResult?.db,
                error
            });

            aiResult.response =
                "라이프업 템플릿에 내용을 반영하는 중 오류가 발생하였습니다.\n" +
                "잠시 후 다시 시도해주세요.";

            throw error;
        }

        console.log(`[TIME] NotionService.createDbItemFromAiResult: ${Date.now() - t}ms`);
        console.log(`[TIME] processAfterResponse TOTAL: ${Date.now() - start}ms`);
    } catch (error) {
        console.error('[KAKAO BACKGROUND ERROR]', error);
    }
}

export const trimKorean = (text = '', max = 50) =>
    [...text].length > max
        ? [...text].slice(0, max).join('') + '...'
        : text;

export async function prepareAssistantInput(userMessage: string, uid: string) {
    if (isYoutubeUrl(userMessage)) {
        return prepareYoutubeInput(userMessage);
    }

    if (isKakaoImageUrl(userMessage)) {
        return prepareImageInput(userMessage, uid);
    }

    return prepareTextInput(userMessage);
}

async function prepareTextInput(userMessage: string) {
    return {
        aiInput: userMessage,
        entity: {
            type: "text"
        }
    };
}

function isKakaoImageUrl(url: string) {
    return /^https?:\/\/.*\.(jpg|jpeg|png|webp)/i.test(url)
        || url.includes('talk.kakaocdn.net');
}

async function prepareImageInput(userMessage: string, uid: string) {
    console.log("[PREPARE] start", { uid, userMessage: userMessage });

    let fileName: string | undefined;

    try {
        console.log("[PREPARE] processKakaoImage start");

        // 1. storage 처리
        const result = await processKakaoImage(userMessage, uid);
        fileName = result.fileName;

        console.log("[PREPARE] processKakaoImage success", {
            fileName,
            imageUrl: result.imageUrl.substring(0, 100)
        });

        // 2. AI 분석
        console.log("[PREPARE] analyzeImageFromAI start");
        const { ocrText, objects, context, hint } = await analyzeImageFromAI(
            result.buffer,
            result.contentType
        );

        const aiInput = `
            [이미지 분석]
            OCR: ${ocrText || "없음"}
            객체: ${objects.length > 0 ? objects.join(", ") : "없음"}
            설명: ${context || "없음"}
            힌트: ${hint || "없음"}
            `.trim();

        console.log("[PREPARE] analyzeImageFromAI success", {
            aiInput,
            ocrText, objects, context, hint,
            ocrLength: ocrText?.length ?? 0
        });

        return {
            aiInput,
            entity: {
                type: "image",
                url: result.imageUrl,
                ocrText,
                objects: Array.isArray(objects) ? objects : [],
                context,
                hint
            },
            fileName
        };

    } catch (err) {
        console.error("[PREPARE] ERROR", err);
        throw err;
    }
}

export function isYoutubeUrl(url: string): boolean {
    try {
        const u = new URL(url.trim());
        const host = u.hostname.toLowerCase();

        if (![
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "youtu.be"
        ].includes(host)) {
            return false;
        }

        return (
            host === "youtu.be" ||
            u.pathname === "/watch" ||
            u.pathname.startsWith("/shorts/") ||
            u.pathname.startsWith("/live/")
        );
    } catch {
        return false;
    }
}

// #youtube
async function prepareYoutubeInput(userMessage: string) {
    console.log("[PREPARE] start", { userMessage });

    try {
        console.log("[PREPARE] analyzeYoutube start");
        const { title, author, thumbnail, description } = await fetchYoutubeMetadata(userMessage);

        const aiInput = `
[유튜브 영상]
제목: ${title || "없음"}
채널: ${author || "없음"}
설명: ${description || "없음"}
`.trim();

        console.log("[PREPARE] analyzeYoutube success", { title, author, thumbnail });

        return {
            aiInput,
            entity: {
                type: "youtube",
                url: userMessage.trim(),
                title,
                author,
                thumbnail,
                description
            }
        };
    } catch (err) {
        console.error("[PREPARE] ERROR", err);
        throw err;
    }
}

export async function fetchYoutubeMetadata(youtubeUrl: string): Promise<any> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const videoId = extractYoutubeVideoId(youtubeUrl);

    if (!videoId) {
        throw new Error(`Invalid YouTube URL: ${youtubeUrl}`);
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`YouTube API failed ${res.status}`);
    }

    const data = await res.json();
    const item = data.items?.[0];

    if (!item) {
        throw new Error(`YouTube video not found: ${videoId}`);
    }

    const snippet = item.snippet;
    const description = typeof snippet.description === "string" ? snippet.description.trim() : "";

    return {
        title: snippet.title,
        author: snippet.channelTitle,
        description: description.length > 500 ? `${description.substring(0, 500)}...` : description,
        thumbnail: snippet.thumbnails?.high?.url ?? ""
    };
}

function extractYoutubeVideoId(url: string): string | undefined {
    const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\/]+)/
    );

    return match?.[1];
}
// export async function fetchYoutubeMetadata(url: string): Promise<{
//     title?: string;
//     author?: string;
//     thumbnail?: string;
//     description?: string;
// }> {
//     try {
//         const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
//         const res = await fetch(endpoint, {
//             headers: {
//                 "User-Agent": "Mozilla/5.0"
//             }
//         });
//         if (!res.ok) {
//             throw new Error(`YouTube oEmbed failed (${res.status})`);
//         }

//         const json = await res.json();

//         return {
//             title: json.title,
//             author: json.author_name,
//             thumbnail: json.thumbnail_url
//         };
//     } catch (err) {
//         console.error("[YouTube] fetchYoutubeMetadata", err);

//         return {};
//     }
// }


export async function analyzeImageFromAI(buffer: Buffer, contentType: string) {
    const base64Image = buffer.toString("base64");

    const res = await clientAI.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: {
            type: "json_object"
        },
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
다음 이미지를 분석하여 "의미 해석 데이터" JSON을 생성해라.

절대 행동 판단(task/memo/reference 등)은 하지 않는다.
절대 실행/분류/의도 판단을 하지 않는다.

반드시 아래 JSON 형식으로만 출력한다.
설명, 마크다운, 코드블록 금지.

{
  "ocrText": "",
  "objects": [],
  "context": "",
  "hint": ""
}

---

## 1. OCR

이미지 안의 텍스트를 가능한 정확히 추출한다.

규칙

- OCR은 추출만 수행하며, 의미를 추론하거나 보정하지 않는다.
- 읽을 수 있는 부분만 그대로 출력한다.
- 잘 보이지 않거나 확신할 수 없는 글자는 추측하지 않는다.
- 일부만 읽히는 경우에는 읽히는 부분만 출력한다.
- 숫자, 주소, 전화번호, 이메일, 계정번호 등 식별 정보는 절대 추측하거나 수정하지 않는다.
- 맞춤법, 띄어쓰기, 오탈자를 임의로 교정하지 않는다.
- 의미상 자연스럽더라도 단어나 문장을 완성하지 않는다.
- 전혀 읽을 수 없는 경우에는 빈 문자열("")을 출력한다.
---

## 2. OBJECTS
이미지에 포함된 핵심 객체/요소를 배열로 출력한다.

예:
[
  "사람",
  "책",
  "영수증",
  "웹페이지",
  "로고",
  "음식",
  "장소",
  "화면(UI)",
  "문서"
]

---

## 3. CONTEXT
이미지가 어떤 상황인지 짧게 설명한다.

예:
- 쇼핑 관련 화면
- 메모/아이디어 스크린샷
- 웹 아티클 캡처
- 영수증 사진
- 일정/할일 메모
- 광고/홍보 이미지

---

## 4. HINT
아래 값 중 하나만 선택한다.

task-like
memo-like
reference-like
unknown

---

## HINT 기준

task-like:
- 할일/구매/예약/방문/읽기/보기 의도가 보임

memo-like:
- 개인 기록
- 아이디어
- 메모
- 연락처
- 좋은 글

reference-like:
- 외부 콘텐츠
- 웹
- 뉴스
- 책
- PPT
- 자료
- 통계
- 캡처

unknown:
- 분류 불가
- 애매함
- 정보 부족
`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${contentType};base64,${base64Image}`
                        }
                    }
                ]
            }
        ],
        temperature: 0
    });

    const text = res.choices[0].message.content ?? "{}";

    const result = JSON.parse(text);

    return {
        ocrText: result.ocrText ?? "",
        objects: Array.isArray(result.objects) ? result.objects : [],
        context: result.context ?? "",
        hint: result.hint ?? "unknown"
    };
}
// async function describeImage(imageUrl: string) {

//     const response = await clientAI.chat.completions.create({
//         model: 'gpt-4.1-mini',
//         messages: [
//             {
//                 role: 'user',
//                 content: [
//                     {
//                         type: 'text',
//                         text: `
// 사진의 핵심 내용을 짧은 텍스트로 변환해라.

// 예:
// - 책 -> 책 제목
// - 영수증 -> 구매 목록
// - 장소 -> 장소명
// - 명함 -> 연락처 정보
// - 일반 사진 -> 핵심 설명

// 설명 없이 텍스트만 출력.
// `
//                     },
//                     {
//                         type: 'image_url',
//                         image_url: {
//                             url: imageUrl
//                         }
//                     }
//                 ]
//             }
//         ],
//         temperature: 0
//     });

//     return response.choices[0].message.content ?? '';
// }

async function getLastAssistantContext(userId: string) {
    const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("assistantContext")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("[CONTEXT] empty");
        return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    const createdAt = data.createdAt?.toDate?.();

    if (!createdAt) {
        console.log("[CONTEXT] invalid createdAt", {
            userId,
            data
        });
        return null;
    }

    const expireMinutes = 30;
    const age = Date.now() - createdAt.getTime();

    if (age > expireMinutes * 60 * 1000) {
        console.log("[CONTEXT] expired", {
            userId,
            createdAt,
            ageMinutes: Math.floor(age / 60000)
        });

        return null;
    }

    console.log("[CONTEXT] valid", {
        userId,
        ageMinutes: Math.floor(age / 60000)
    });

    return {
        ...data,
        contextId: doc.id
    };
}

export async function saveAssistantContext(userId: string, payload: any): Promise<string> {
    const collectionRef = db
        .collection("users")
        .doc(userId)
        .collection("assistantContext");

    const previous = await collectionRef
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

    // previousContextId
    if (!previous.empty) {
        payload.previousContextId = previous.docs[0].id;
    }

    const docRef = collectionRef.doc();

    // contextId
    payload.contextId = docRef.id;

    await docRef.set(payload);

    return docRef.id;
}

async function resolveTargetPageId(userId: string, contextId: string): Promise<string | undefined> {
    while (contextId) {
        const doc = await db
            .collection("users")
            .doc(userId)
            .collection("assistantContext")
            .doc(contextId)
            .get();

        if (!doc.exists) {
            return undefined;
        }

        const data = doc.data();

        if (data?.pageId) {
            return data.pageId;
        }

        contextId = data?.previousContextId;
    }

    return undefined;
}

async function waitForTargetPageId(
    userId: string,
    contextId: string,
    timeoutMs = 30000
): Promise<string> {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        const pageId = await resolveTargetPageId(userId, contextId);
        if (pageId) {
            return pageId;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error("pageId not found");
}
// async function saveCapture(
//     uid: string,
//     utterance: string,
//     user: any,
//     kakaoUserId: string
// ) {

//     await db
//         .collection("users")
//         .doc(uid)
//         .collection("integrations")
//         .doc("kakaoAgent")
//         .collection("captures")
//         .add({
//             kakaoUserId,
//             plusfriendUserKey:
//                 user?.properties?.plusfriendUserKey,
//             botUserKey: user?.id,
//             content: utterance,
//             source: "kakao",
//             status: "received",
//             createdAt:
//                 admin.firestore.FieldValue.serverTimestamp()
//         });

//     saveCaptureEvent(uid, utterance, user, kakaoUserId);
// }

// async function saveCaptureEvent(
//     uid: string,
//     utterance: string,
//     user: any,
//     kakaoUserId: string
// ) {

//     const preview =
//         utterance.length > 30
//             ? `${utterance.substring(0, 30)}...`
//             : utterance;

//     await writeUserEvent(uid, {
//         agentId: AgentId.KAKAO_CAPTURE,
//         status: "completed",
//         eventTitle:
//             `'${preview}'으로 시작하는 메시지를 수집했습니다.`,
//         description: [
//             `수집 내용: ${utterance}`,
//             `카카오 사용자 ID: ${kakaoUserId}`,
//             `플러스친구 사용자 키: ${user?.properties?.plusfriendUserKey ?? '-'}`,
//             `봇 사용자 키: ${user?.id ?? '-'}`,
//             `사용자 타입: ${user?.type ?? '-'}`
//         ].join('\n')
//     });
// }

async function processVerificationCode(
    res: any,
    utterance: string,
    kakaoUserId: string
) {

    const hashedInput = crypto
        .createHash('sha256')
        .update(utterance)
        .digest('hex');

    ///////////////////////////////////////////////////
    const verificationSnap = await db
        .collection('verifications')
        .where('verified', '==', false)
        .where('code', '==', hashedInput)
        .limit(1)
        .get();

    if (!verificationSnap.empty) {

        const matchedDoc = verificationSnap.docs[0];
        const verificationData = matchedDoc.data();

        ///////////////////////////////////////////////////
        // 만료 체크
        if (
            verificationData.expiresAt &&
            verificationData.expiresAt.toMillis() < Date.now()
        ) {
            await matchedDoc.ref.delete();
            return sendExpiredVerificationCode(res);
        }

        const userId = matchedDoc.id;

        ///////////////////////////////////////////////////
        // user 존재 체크
        const targetUserSnap = await db
            .collection('users')
            .doc(userId)
            .get();

        if (!targetUserSnap.exists) {
            //인증번호가 다릅니다.\n인증번호를 확인 후 다시 보내주세요.
            return sendInvalidVerificationCode(res);
        }

        ///////////////////////////////////////////////////
        // 카카오톡 연결
        await connectKakaoUser(userId, kakaoUserId);

        ///////////////////////////////////////////////////
        // verification 완료 처리
        await matchedDoc.ref.update({
            verified: true,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            kakaoUserId
        });
        return sendConnectedMessage(res);
    }

    ///////////////////////////////////////////////////
    // 인증 실패
    return sendInvalidVerificationCode(res);
}


///////////////////////////////////////////////////////
// kakao connect user

export async function connectKakaoUser(uid: string, kakaoUserId: string): Promise<void> {
    try {
        console.log("[connectKakaoUser]", { uid, kakaoUserId });

        const userRef = db.collection('users').doc(uid);
        const connRef = db.collection('kakaoConnections').doc(kakaoUserId);
        const integrationRef = db.collection('users').doc(uid).collection('integrations').doc('kakao-capture');

        const batch = db.batch();

        batch.update(userRef, { kakaoUserId });

        batch.set(connRef, {
            uid,
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batch.set(integrationRef, {
            enabled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        console.log("[connectKakaoUser] committed");
    } catch (error) {
        console.error("[connectKakaoUser FAILED]", error);
        throw error;
    }
}

export async function disconnectKakaoUser(uid: string, kakaoUserId: string) {
    try {
        const batch = db.batch();

        // users/OOO/kakoUserId 필드 삭제
        batch.update(db.collection('users').doc(uid), {
            kakaoUserId: admin.firestore.FieldValue.delete()
        });

        // kakaoConnections 삭제
        batch.delete(db.collection('kakaoConnections').doc(kakaoUserId));

        batch.set(
            db.collection('users').doc(uid).collection('integrations').doc('kakao-capture'),
            {
                enabled: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
        );

        await batch.commit();
    } catch (error) {
        console.error("[disconnectKakaoUser FAILED]", error);
        throw error;
    }
}

export const disconnectKakao = onRequest({ timeoutSeconds: 60, memory: "256MiB" }, withCors(async (req, res) => {
    const userId = req.body?.userId;
    try {
        console.log("[DISCONNECT KAKAO]", { userId });
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId required" });
        }
        const userSnap = await db.collection('users').doc(userId).get();

        if (!userSnap.exists) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const kakaoUserId = userSnap.data()?.kakaoUserId;

        if (!kakaoUserId) {
            return res.status(200).json({ success: true, message: "이미 연결이 해제되었습니다." });
        }

        await disconnectKakaoUser(userId, kakaoUserId);

        return res.status(200).json({ success: true, message: "카카오톡 연결이 해제되었습니다." });

    } catch (error) {
        console.error("[DISCONNECT KAKAO ERROR]", error);
        return res.status(500).json({ success: false, message: "처리 중 오류가 발생했습니다." });
    }
})
);

export async function findEnabledConnectedUser(
    kakaoUserId: string
): Promise<{
    uid: string;
    enabled: boolean;
} | null> {

    const doc = await db
        .collection('kakaoConnections')
        .doc(kakaoUserId)
        .get();

    if (!doc.exists) {
        return null;
    }

    const data = doc.data();

    return {
        uid: data!.uid,
        enabled: data!.enabled === true
    };
}

/////////////////////////////////////////////////////////////


// function sendDisabledMessage(
//     callbackUrl: string
// ) {
//     return resposeKakaoMessage(
//         callbackUrl,
//         [
//             "현재 카카오톡 수집 자동화가 꺼져 있습니다.",
//             "",
//             "노셔너블 비서를 이용하려면 자동화 에이전트 관리에서 '카카오톡 수집 자동화'를 활성화해주세요."
//         ].join('\n')
//     );
// }

// function sendError(callbackUrl: any) {
//     return resposeKakaoMessage(
//         callbackUrl,
//         [
//             "처리 중 오류가 발생했습니다.",
//             "잠시 후 다시 시도해주세요."
//         ].join('\n')
//     );
// }

function sendInvalidVerificationCode(
    res: any
) {
    return resposeKakaoMessage(
        "인증번호가 다릅니다.\n인증번호를 확인 후 다시 보내주세요.",
        res
    );
}

function sendExpiredVerificationCode(
    res: any
) {
    return resposeKakaoMessage(
        "인증번호가 만료되었습니다.", res
    );
}

function sendConnectedMessage(
    res: any
) {
    return resposeKakaoMessage(
        [
            "라이프업 비서와 연결이 되었습니다.",
            "",
            "반갑습니다 👋",
            "라이프업 비서입니다.",
            "",
            "이제부터 당신의 일상을",
            "업그레이드해 줄",
            "든든한 러닝메이트가 되겠습니다.",
            "",
            "사용법이 궁금하시면",
            "'사용법'이라고 입력해보세요."
        ].join('\n'),
        res
    );
}

// #keyword ai
async function requestPageKeywordsFromAI(
    noteData: Record<string, { title?: string; content?: string; /*keywords: string[]*/ }>,
    existingKeywords: string[]): Promise<Record<string, string[]>> {

    console.log('requestPageKeywordsFromAI existingKeywords =>', existingKeywords);

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



/////////////////////////////////////////////////////////////////////
// image 처리
export async function processKakaoImage(url: string, uid: string) {
    console.log("[IMAGE] process start", { uid, url });
    const { buffer, contentType } = await downloadImage(url);
    console.log("[IMAGE] download success", {
        contentType,
        size: buffer.length
    });
    const { fileName, imageUrl } = await uploadTempImage(buffer, uid, contentType);

    console.log("[IMAGE] upload success", { fileName, imageUrl });
    return { imageUrl, fileName, buffer, contentType };
}

export async function downloadImage(url: string) {
    console.log("[DOWNLOAD] start", { url });

    const response = await fetch(url);

    console.log("[DOWNLOAD] response", {
        status: response.status,
        ok: response.ok
    });

    if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
    }

    const contentType =
        response.headers.get("content-type") ?? "image/jpeg";

    const arrayBuffer = await response.arrayBuffer();

    console.log("[DOWNLOAD] complete", {
        contentType,
        bytes: arrayBuffer.byteLength
    });

    return {
        buffer: Buffer.from(arrayBuffer),
        contentType
    };
}

export async function uploadTempImage(
    buffer: Buffer,
    uid: string,
    contentType = "image/jpeg"
) {
    console.log("[UPLOAD] start", {
        uid,
        contentType,
        size: buffer.length
    });

    const bucket = getStorage().bucket();

    console.log("[UPLOAD] bucket", {
        name: bucket.name
    });

    const ext =
        contentType.includes("png") ? "png" :
            contentType.includes("webp") ? "webp" :
                contentType.includes("gif") ? "gif" :
                    contentType.includes("jpeg") ? "jpg" :
                        "jpg";

    const fileName = `tmp/${uid}/${Date.now()}.${ext}`;
    const token = randomUUID();

    console.log("[UPLOAD] fileName", { fileName });

    const file = bucket.file(fileName);

    await file.save(buffer, {
        resumable: false,
        metadata: {
            contentType,
            cacheControl: "private, max-age=0, no-cache",
            metadata: {
                firebaseStorageDownloadTokens: token
            }
        }
    });

    const imageUrl =
        `https://firebasestorage.googleapis.com/v0/b/` +
        `${bucket.name}/o/${encodeURIComponent(fileName)}` +
        `?alt=media&token=${token}`;

    console.log("[UPLOAD] success", {
        fileName,
        imageUrl
    });

    return {
        fileName,
        imageUrl
    };
}

export async function deleteTempImage(fileName: string) {
    console.log("[DELETE] start", { fileName });

    const bucket = getStorage().bucket();

    try {
        await bucket.file(fileName).delete();
        console.log("[DELETE] success", { fileName });
    } catch (err: any) {
        if (err?.code !== 404) {
            console.error("[DELETE] ERROR", err);
        } else {
            console.log("[DELETE] already deleted");
        }
    }
}

async function acquireKakaoProcessingLock(userId: string, jobId: string): Promise<boolean> {
    const userRef = db.collection("users").doc(userId);

    return await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data();

        const processing = data?.kakaoProcessing;
        const processingAt = data?.kakaoProcessingAt?.toMillis?.() ?? 0;

        // 기존 lock이 있고 5분 이내면 처리중으로 판단
        if (processing && Date.now() - processingAt < 5 * 60 * 1000) {
            return false;
        }

        tx.update(userRef, {
            kakaoProcessing: true,
            kakaoProcessingJobId: jobId,
            kakaoProcessingAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return true;
    });
}

async function releaseKakaoProcessingLock(userId: string, jobId: string) {
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data();

        if (data?.kakaoProcessingJobId !== jobId) {
            return;
        }

        tx.update(userRef, {
            kakaoProcessing: false,
            kakaoProcessingJobId: admin.firestore.FieldValue.delete(),
            kakaoProcessingAt: admin.firestore.FieldValue.delete()
        });
    });
}