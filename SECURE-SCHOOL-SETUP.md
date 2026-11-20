# Takhti secure teacher and guardian access

**Status: implementation awaiting integration and deployment tests. Do not use
real identifiable children's records until independent security review, consent
processes, and production provisioning have been completed.**

## What changed

- Cloud Run verifies an **RS256-signed Firebase Authentication ID token**
  against Google's public keys, audience and issuer for `FIREBASE_PROJECT_ID`.
  A verified email address is required for school access.
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
