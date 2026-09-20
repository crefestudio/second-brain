# Firestore rules rollout

`firestore.rules` is a proposed owner-scoped replacement for the deployed allow-all rules. It has not been deployed. Thirteen core allow/deny checks passed against the local Firestore emulator using `node scripts/test-firestore-rules.cjs` (emulator project `demo-lifeup-rules`, port 8189). Routine CRUD and end-to-end application flows still require the checks below. `firebase.json` now points to it; a full Firebase deploy will include these rules, so complete the checks below before deployment.

## Ownership and allowed operations

- A signed-in user needs both `appAccounts/{uid}.userId` and `users/{userId}.firebaseUid` to match. These are written by the server after purchase email verification.
- Owners may read their workspace and its subcollections, including migration progress/results. This includes all fields of those documents; Firestore rules do not redact tokens. Separate server secrets from readable documents in a subsequent data-model migration.
- Client writes are limited to routine habits, dismissing routine notifications, existing automation enabled flags, removal of the secondbrain integration, purchase-record deletion and removal (not replacement) of the Notion connection fields.
- Purchases cannot be self-certified; identity bindings cannot be changed by clients. Verification email codes and purchaser lists are inaccessible.
- Admin SDK access bypasses rules. HTTP Functions must separately validate identity and ownership; these rules do not secure those endpoints.

## Known compatibility work before production

1. `UserService.savePurchaserInfo()` currently writes `verified: true` from the browser. This is intentionally denied. Move purchase verification/persistence into an authenticated server endpoint before enabling these rules in production.
2. Public widgets/OAuth pages performing Firestore reads without Firebase login are intentionally denied. Route those reads through an access-key-validated server API, or use appropriately scoped Firebase custom-token identities.
3. Existing users need the server-managed Firebase UID binding before their reads are allowed. Do not backfill bindings from an unverified browser UID or email.
4. Automation flags currently use merge writes. Creation of a missing integration or Kakao connection is denied; establish those records on the server first.
5. Any old member-store or other unlisted client collection is denied by default. Verify all supported screens before rollout.

## Required Rules Playground/emulator checks

Seed account A -> workspace A and account B -> workspace B using Admin SDK, plus an unbound account C.

- A may read workspace A and migration results, but not B; anonymous/C reads fail.
- A may get its own appAccounts document but cannot list, create, update or delete account mappings.
- A cannot change firebaseUid, email, access keys, tokens or purchase status; cannot replace a Notion token. Removing the two allowed connection fields succeeds.
- A cannot create/update purchase verification or write migration results/status.
- A can CRUD valid own habits, not B's habits, and cannot add unexpected habit fields.
- A can update its own existing automation enabled flag; cannot change other fields or create arbitrary integrations.
- Verification-code collections and global collection scans are denied.

Do not retain the old `allow read, write: if true` match alongside this file: any matching allow grants access.
