# P0 school-data authentication requirements (not yet implemented)

**Do not onboard real student records to cloud class sync in its current form.**

## Findings from source inspection

- `src/ui/handlers.js` stores a four-digit parent PIN in local device state via `src/core/store.js`. It is a local UI boundary, **not** authentication or an access-control system.
- `src/ui/teacher.js` opens the teacher screen from that same parent dashboard.
- `api/class-sync.mjs` accepts `children` updates keyed by caller-provided child IDs without authenticating a parent/child. Anyone who knows the class code and child ID could submit competing records.
- The first caller submitting any sufficiently long `teacherKey` for an unclaimed class becomes the teacher for that class. There is no verified school/teacher enrollment process.
- Class codes and client-held teacher keys must not be considered sufficient authorization for production handling of children's educational records.

## Required secure design before pilot

1. Enroll organizations and staff through a server-controlled invitation or a verified identity-provider login. Require MFA for staff, where possible.
2. Require server-validated short-lived identity tokens on class APIs. Reject anonymous teacher claims and write attempts, rather than trusting roles declared in request bodies.
3. Scope every teacher action to verified school/tenant and assigned class IDs. Enforce this on the server for roster, school lessons, homework, reporting and exports.
4. Give every family a verified guardian account; bind each child record to authorized guardians and class memberships server-side. Do not accept arbitrary client-supplied child IDs as proof of ownership.
5. Keep explicit guardian consent, age-appropriate notices, audit trails, revocation and record-deletion workflows. Review retention and vendor data flows before collecting children's information.
6. Use a transactional database with ownership constraints and conflict-safe writes; do not rely on last-write-wins JSON blobs for authenticated educational records.
7. Add negative integration tests: two schools cannot read or change each other's classes; a guardian cannot write another child's record; a student cannot mint a teacher role; revoked credentials fail.
8. Migrate existing demo/local data intentionally. Avoid silently promoting existing six-character class codes or four-digit parent PINs into production credentials.

## Interim operational guardrails

Until the identity/authorization migration is done, treat the class-sync feature as **prototype-only with synthetic data**, and avoid collecting real children's identifiable school records through it. Do not advertise the four-digit PIN or class-code/teacherKey mechanism as production authentication.

The voice failover fixes in this PR do not resolve these access-control findings.
