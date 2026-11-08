# Firestore rules rollout

Production rechecked on 2026-11-08 using the Firebase Rules API: the active `cloud.firestore` release (updated 2026-11-02T15:01:43.175480Z) matches the local `firestore.rules`. The previous statement that production still used allow-all rules was stale.

Twenty-two allow/deny checks passed against the local Firestore emulator using `node scripts/test-firestore-rules.cjs` (project `demo-lifeup-rules`, port 8189), including recurring schedule reads, cross-account and anonymous denial, denial of direct schedule/config/receipt mutations, and pending-deletion/archived-account denial. The separate template entitlement test also passed with the emulator enabled. These checks are not a full audit of every Cloud Function, Storage bucket, or application flow.

The deployed recurring API rejected anonymous list requests (401) and invalid ID tokens (400). Its source validates a revocation-checked Firebase ID token, deletion status, both account/workspace ownership bindings, supported template, and action inputs. Invalid-token errors currently expose the SDK diagnostic; return a generic 401 as follow-up hardening.

Recurring config, schedules, and occurrence receipts are server-write-only under these rules. Owner reads still cover all workspace subcollections and all fields, including any Notion credentials in the user document. Move credentials to a server-only path with an explicit allowlist of readable paths; adding a narrower deny beneath the current recursive read rule would not override that allow.

## Ownership and allowed operations

- A signed-in user needs both `appAccounts/{uid}.userId` and `users/{userId}.firebaseUid` to match. These are written by the server after purchase email verification.
- Owners may read their workspace and its subcollections, including migration progress/results. This includes all fields of those documents; Firestore rules do not redact tokens. Separate server secrets from readable documents in a subsequent data-model migration.
- Client writes are limited to routine habits, dismissing routine notifications, existing automation enabled flags, removal of the secondbrain integration, purchase-record deletion and removal (not replacement) of the Notion connection fields.
- Purchases cannot be self-certified; identity bindings cannot be changed by clients. Verification email codes and purchaser lists are inaccessible.
- Admin SDK access bypasses rules. HTTP Functions must separately validate identity and ownership; these rules do not secure those endpoints.

## Compatibility checklist retained from the original rollout (revalidate before changing rules)

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
