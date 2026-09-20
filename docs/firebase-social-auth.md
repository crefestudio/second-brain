# Firebase social login rollout

Implemented against the existing `notionable-secondbrain` Firebase project.

## Console configuration required before rollout

- Enable Google in Authentication > Sign-in method; choose a support email.
- Enable Apple in Authentication > Sign-in method. Configure Apple Developer Services ID, Team ID, Key ID and private key in Firebase Console (never commit the private key).
- Register the Apple return URL `https://notionable-secondbrain.firebaseapp.com/__/auth/handler` and the matching Firebase auth domain in Apple Developer.
- Add production and staging app hostnames to Authentication > Settings > Authorized domains. Add localhost explicitly if needed for development.

References: https://firebase.google.com/docs/auth/web/google-signin and https://firebase.google.com/docs/auth/web/apple

## Account and workspace ownership

Firebase Auth manages identity, provider credentials and persisted sessions. `getAppSession` verifies the ID token, then resolves `appAccounts/{firebaseUid}.userId`. Existing workspace documents retain their IDs and data. Purchase email verification binds the workspace's `firebaseUid` and account's `userId` in one transaction; existing conflicting bindings are refused. No workspace is claimed from a client-supplied UID, local storage or matching social email alone. Apple private relay users can verify their original purchase email.

## Deployment prerequisite: inspect existing Firestore rules

The repository does not contain the deployed Firestore rules. Before deployment, ensure all client writes to `appAccounts` are denied, and clients cannot create or change `users.firebaseUid`. Admin SDK endpoints manage both. Review existing per-workspace rules and HTTP endpoints for ownership enforcement; route guards are not API authorization. Do not add a blanket authenticated-user read/write rule. Existing public widgets and server OAuth callbacks need their existing access-key flows preserved. Full endpoint/rules authorization migration is not validated by this UI/session change.

Deploy `getAppSession` and the updated `verifyCode` together with the app after configuring providers and rules. No deployment was performed during implementation.

## Acceptance checks with configured providers

- Google and Apple first login, returning login, page refresh and original route/hash restoration.
- Popup cancellation/blocking, network failure and provider disabled messages.
- Purchase email verification links existing workspace without changing migration records; a second Firebase account cannot claim it.
- Apple private relay account links using purchase email verification.
- Logout and logout/account changes in another tab remove protected screens.
- Unauthenticated session requests fail; clients cannot modify ownership documents/fields.
- Check social popup behavior on Safari and within the existing iframe. Offer the standalone app URL if the host blocks popups or browser storage.

Account linking between Google and Apple identities and account deletion/revocation are not exposed in this initial UI. Provider-conflict errors direct users to their original sign-in method.
