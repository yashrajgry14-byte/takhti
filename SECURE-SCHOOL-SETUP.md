# Takhti secure teacher and guardian access

**Status: implementation awaiting integration and deployment tests. Do not use
real identifiable children's records until independent security review, consent
processes, and production provisioning have been completed.**

## What changed

- Cloud Run verifies an **RS256-signed Firebase Authentication ID token**
  against Google's public keys, audience and issuer for `FIREBASE_PROJECT_ID`.
  A verified email address is required for school access.
- Teachers may open `https://YOUR_APP_URL/?role=teacher` independently of the parent PIN. The teacher screen remains inaccessible until a server-approved teacher login.
- The app signs teachers and guardians in with Firebase Authentication
  email/password through Identity Toolkit. The token remains in page memory;
  refresh or expiry requires signing in again.
- A successful login is not authorization. Cloud Run reads a **private,
  administrator-provisioned ACL document** from Google Cloud Storage. Only an
  active teacher assigned to the class can read all class records and assign
  homework, approve synced lessons or edit the roster. A guardian can sync
  only child IDs explicitly bound to their verified account with consent.
- Every ACL has a unique school/tenant ID, and class records are partitioned by this ID. Classes are still labeled with six-character codes, but knowing a code does
  not grant access. The old first-writer teacher-key mechanism is disabled.
- Anonymous or unconfigured class sync fails closed. The separate Netlify
  class-sync endpoint is disabled until it supports the same identity checks.
- `src/ui/teacher.js` renders no teacher-class dashboard until a server
  approves a signed-in teacher identity. The parent PIN remains only a local
  convenience lock, not proof of parental identity.
- Existing local, offline practice and the sample/demo children are not
  migrated automatically.

## One-time Firebase / Google Cloud setup

1. In the Firebase console for the intended school project, enable
   **Authentication → Sign-in method → Email/Password**; configure authorized
   domains, email-verification workflow and account policies. Have the school
   administrator create/verify the authorized teacher and guardian identities.
2. Verify the Firebase project ID, Web API key and Google Cloud billing
   project. Do not paste secrets into GitHub. The Firebase Web API key is a
   public client configuration value, not an administrator credential.
3. In Cloud Shell set:
   ```bash
   export PROJECT=takhti-514811
   export FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
   export FIREBASE_WEB_API_KEY=YOUR_FIREBASE_WEB_API_KEY
   gcloud config set project "$PROJECT"
   ```
4. **Before authorizing a guardian**, verify the guardian-to-child
   relationship and documented, valid parental consent through the school's
   own verified process. Create the child's stable ID under that guardian.
   Record evidence reference securely (not the full consent document in this
   repository).
5. Only a trusted school administrator with bucket IAM permissions runs
   `tools/provision-class-access.mjs` to create the authorization record:
   ```bash
   node tools/provision-class-access.mjs --bucket takhti-514811-takhti-classes \
     --uid FIREBASE_TEACHER_UID --role teacher --school SCHOOL001 --class ABC123

   node tools/provision-class-access.mjs --bucket takhti-514811-takhti-classes \
     --uid FIREBASE_GUARDIAN_UID --role guardian --school SCHOOL001 --class ABC123 \
     --child ALREADY_REGISTERED_CHILD_ID --consent-record VERIFIED_REFERENCE
   ```
   The tool refuses to overwrite existing ACLs. A second class/child for the
   same account requires an administrator to update the existing JSON ACL
   deliberately, reconciling entries rather than replacing prior access.
6. After testing the branch, merge it and deploy via
   `bash cloud/deploy.sh` from the updated main branch with the Firebase
   environment variables set. When unset, the endpoint returns 503 instead of
   accepting anonymous data.

## API contract

- `GET /api/auth-config`: public nonsecret Firebase sign-in configuration.
- `GET /api/class-identity`: requires `Authorization: Bearer <Firebase ID token>`,
  returns only administrator-approved role and teacher class codes.
- `POST /api/class-sync`: same verified bearer token plus the class and
  (guardian-owned) child records. No browser-supplied role, guardian ID,
  teacherKey or consent bit confers permissions.

## Verification

Run `npm ci`, `node --test test/class-security.test.mjs`,
`node test/class-sync.test.js`, `node test/cloud.test.js` and `npm test`.
Verify negative cases using two different schools and two actual Firebase
accounts, not only mocked signed tokens. Confirm that unsigned requests,
other-school IDs, other-child IDs, unverified emails, deactivated ACLs, and
revoked consent are all denied.

## Safe staging validation using your two synthetic Firebase accounts

These instructions are for testing, **not approval to use real children's data**.
Takhti Cloud Run uses `takhti-514811`, while the existing Firebase test users
belong to the separate Authentication project `gen-lang-client-0604938251`.
Do not switch the Firebase project ID back to `takhti-514811` for these accounts.

1. From Google Cloud Shell, fetch the already-reviewed security branch and
   configure a separate Cloud Run service and **test-only** bucket:

   ```bash
   cd ~/takhti
   git fetch origin
   git switch -C takhti-security-staging origin/security/teacher-guardian-verified-access
   npm ci
   npm test
   npm audit --audit-level=high

   export PROJECT=takhti-514811
   export FIREBASE_PROJECT_ID=gen-lang-client-0604938251
   export SERVICE=takhti-auth-staging
   export BUCKET=takhti-514811-auth-test
   gcloud config set project "$PROJECT"

   # Only if not already exported in this Cloud Shell session:
   test -n "${FIREBASE_WEB_API_KEY:-}" || {
     read -rsp 'Firebase Web API key (Gemini Project 1): ' FIREBASE_WEB_API_KEY; echo
     export FIREBASE_WEB_API_KEY
   }
   ```

2. The test-only permission records should already exist in
   `gs://takhti-514811-auth-test/classes/`. If they do not, retrieve each
   account's UID from Firebase Authentication and, after confirming both are
   your own synthetic test accounts, provision them using
   `tools/provision-class-access.mjs`. The teacher must have
   `school=SCHOOL001`, `class=ABC123`; the guardian must have the same
   school/class with `child=TESTCHILD01` and a clearly marked
   `TEST-ONLY-SYNTHETIC-NO-REAL-CONSENT` reference. That reference is **not**
   evidence of real parental consent.

3. Deploy only the isolated **staging** service. Do not deploy `takhti`
   (production) or set `BUCKET` to the production student-data bucket:

   ```bash
   bash cloud/deploy.sh
   STAGING_URL="$(gcloud run services describe takhti-auth-staging --project takhti-514811 --region asia-south1 --format='value(status.url)')"
   printf 'Staging URL: %s\n' "$STAGING_URL"
   ```

4. Sign in with the two *owned* Firebase test accounts. On an unverified
   account, Takhti can request an official Firebase email-verification link.
   The account owner opens the email link; then sign in again to obtain a
   fresh ID token. Do **not** mark `emailVerified` administratively without
   establishing email ownership. To run the automated live test, enter
   credentials **only in Cloud Shell**, not in a chat or GitHub:

   ```bash
   read -rp 'Test teacher email: ' TEACHER_EMAIL
   read -rsp 'Test teacher password: ' TEACHER_PASSWORD; echo
   read -rp 'Test guardian email: ' GUARDIAN_EMAIL
   read -rsp 'Test guardian password: ' GUARDIAN_PASSWORD; echo
   export TEACHER_EMAIL TEACHER_PASSWORD GUARDIAN_EMAIL GUARDIAN_PASSWORD

   node tools/smoke-school-auth.mjs --url "$STAGING_URL"
   unset TEACHER_PASSWORD GUARDIAN_PASSWORD
   ```

   The script refuses non-staging URLs; verifies both signed accounts,
   denies anonymous, tampered, cross-class, cross-child and role-escalation
   requests, and uses **only synthetic** data to test guardian sync, teacher
   read and homework sync. If email verification is needed, it requests the
   Firebase links and stops without creating a student record. Open the links
   and rerun with new credentials.

5. Before any rollout for actual schools, independently review privacy,
   guardian onboarding and consent, authorization revocation, class-storage
   concurrency, deletion and retention, and the remaining legacy share paths.
   Successful CI and synthetic staging tests are **necessary but not
   sufficient** proof that processing real students' data is safe.

## Remaining prerequisites before a real-school rollout

- A robust, auditable identity onboarding and guardian verification service,
  with guardian invite/acceptance workflows, account recovery and explicit
  verified consent records. This initial tool relies on a trusted administrator.
- Server-side **transactional** and tenant-partitioned storage for concurrent
  writes. The existing one-JSON-file-per-class Cloud Storage model can lose
  updates under simultaneous writes and is not an ideal school SaaS datastore.
- Server-enforced record deletion, revocation propagation, audit logging,
  incident response and data retention policies, with legal/privacy review
  appropriate to minors in India.
- Firebase token revocation checks and session rotation for higher assurance.
  A signed token remains valid until expiration even after a user is disabled
  unless revocation is additionally verified, although setting ACL
  `active:false` prevents class access immediately.
- App-wide access audit (homework codes, sharing, voice server and independent
  teacher dashboards). These external/legacy paths are not replaced by this
  class-sync authentication work.
