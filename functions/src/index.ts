/* eslint-disable */
import { onRequest } from "firebase-functions/v2/https";
import { Resend } from "resend";
import * as crypto from 'crypto';
import * as admin from "firebase-admin";
import "dotenv/config";
import { defineSecret } from "firebase-functions/params";

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
export const getNotionDatabase = onRequest(
    { secrets: [NOTION_TOKEN] },
    withCors(async (req, res) => {
        const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
        const databaseId = url?.searchParams.get("databaseId");
        if (!databaseId) return res.status(400).json({ error: "databaseId query parameter is required" });

        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            headers: {
                "Authorization": `Bearer ${NOTION_TOKEN.value()}`,
                "Notion-Version": "2022-06-28",
            },
        });

        const data = await response.json();
        res.json(data);
    })
);

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

        return res.redirect(`http://notionable.net/secondbrain/oauth-success?userId=${encodeURIComponent(userId)}`);
    })
);

// ----------------------
// NotionService
// ----------------------
class NotionService {
    static apiVersion = '2025-09-03';

    static async getDatabaseIdByDatabaseName(accessToken: string, databaseName: string): Promise<string> {
        const url = 'https://api.notion.com/v1/search';
        const body = { query: databaseName, filter: { property: 'object', value: 'data_source' } };

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
        const matched = data.results.filter((item: any) => (item.title?.map((t: any) => t.plain_text).join('') ?? '') === databaseName);

        if (!matched.length) throw new Error(`"${databaseName}" Database를 찾을 수 없습니다.`);
        if (matched.length > 1) throw new Error(`"${databaseName}" Database가 여러 개 존재합니다.`);

        return matched[0].id;
    }
}

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
            text: `인증번호: ${code}
            Notionable SecondBrain API 연동을 위해 인증번호를 발급하였습니다.
            요청하신 템플릿에서 아래 인증번호를 입력해 주세요.
            이 인증번호는 10분간만 유효합니다.
            * 만약 이 인증번호를 요청하지 않으셨다면 고객센터(toto791@gmail.com)로 문의 바랍니다.`,
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

