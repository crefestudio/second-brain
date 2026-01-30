/* eslint-disable */
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as cors from "cors";

import "dotenv/config";
import {defineSecret} from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();
const corsHandler = cors({origin: true});

const NOTION_TOKEN = defineSecret("NOTION_TOKEN");
const REDIRECT_URI =
    "https://us-central1-notionable-secondbrain.cloudfunctions.net/notionOAuthCallback";


// export const notionAuth = onRequest({}, (req, res) => {
//     const redirectUri = encodeURIComponent(
//         "https://us-central1-notionable-secondbrain.cloudfunctions.net/notionOAuthCallback"
//     );

//     const authUrl =
//         "https://api.notion.com/v1/oauth/authorize" +
//         `?client_id=${process.env.NOTION_CLIENT_ID}` +
//         "&response_type=code" +
//         "&owner=user" +
//         `&redirect_uri=${redirectUri}`;

//     res.redirect(authUrl);
// });

export const notionAuth = onRequest((req, res) => {
  corsHandler(req, res, () => {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).send("userId is required");
    }

    const redirectUri = encodeURIComponent(
      "https://us-central1-notionable-secondbrain.cloudfunctions.net/notionOAuthCallback"
    );

    const state = encodeURIComponent(userId as string);

    const authUrl =
            "https://api.notion.com/v1/oauth/authorize" +
            `?client_id=${process.env.NOTION_CLIENT_ID}` +
            "&response_type=code" +
            "&owner=user" +
            `&redirect_uri=${redirectUri}` +
            `&state=${state}`;

    return res.redirect(authUrl);
  });
});

export const getNotionDatabase = onRequest(
  {secrets: [NOTION_TOKEN]},
  async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const url = req.url ?
          new URL(req.url, `http://${req.headers.host}`) :
          null;

        const databaseId = url ?
          url.searchParams.get("databaseId") :
          null;

        if (!databaseId) {
          res.status(400).json({
            error: "databaseId query parameter is required",
          });
          return;
        }

        const response = await fetch(
          `https://api.notion.com/v1/databases/${databaseId}`,
          {
            headers: {
              "Authorization": `Bearer ${NOTION_TOKEN.value()}`,
              "Notion-Version": "2022-06-28",
            },
          },
        );

        const data = await response.json();
        res.json(data);
      } catch (error) {
        res.status(500).json({
          error: String(error),
        });
      }
    });
  },
);

export const getUserSecondBrainConnectInfo = onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const userId = req.query.userId as string;

        console.log("PROJECT:", process.env.GCLOUD_PROJECT);
        console.log("USER_ID:", JSON.stringify(userId));

        const snap = await db.collection("users").get();

        console.log(
            "ALL USER DOCS:",
            snap.docs.map(d => d.id)
        );

        //const doc = await db.collection("users").doc(userId).get();

        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();
        const notionSnap = await userRef
        .collection("integrations")
        .doc("secondbrain")
        .get();

        return res.json({
            user: userSnap.data(),
            notion: notionSnap.exists ? notionSnap.data() : null,
        });
    });
});


export const notionOAuthCallback = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const code = req.query.code as string | undefined;
      const userId = (req.query.state as string) || "default_user";

      if (!code) {
        return res.status(400).send("Missing authorization code");
      }

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
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Notion OAuth failed:", errorText);
        return res.status(500).send("Notion OAuth failed");
      }

      const notionToken = await tokenResponse.json();

      await db
        .collection("users")
        .doc(userId)
        .set({
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
        );

      await db
        .collection("users")
        .doc(userId)
        .collection("integrations")
        .doc("secondbrain")
        .set({
          accessToken: notionToken.access_token,
          workspaceId: notionToken.workspace_id,
          botId: notionToken.bot_id,
          duplicatedTemplateId: notionToken.duplicated_template_id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      return res.redirect(
        `http://notionable.net/secondbrain/oauth-success?userId=${encodeURIComponent(
          userId
        )}`
      );
    } catch (err) {
      console.error("OAuth callback error:", err);
      return res.status(500).send("Internal server error");
    }
  });
});
