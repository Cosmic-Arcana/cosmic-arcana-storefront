# Auth0 Action: link accounts by verified email

`link-verified-email.js` is a Post-Login Action. It makes one person who signs in with GitHub and with Google a single
account, **only when both providers assert `email_verified: true`**. If either is unverified, or anything is unclear,
the accounts stay separate and the login goes on. It never links on an unverified email: anyone can register an
unverified address with one provider and would inherit the other account.

- The earlier account is primary, so the choice does not depend on which one signs in first.
- Only `github` and `google-oauth2` identities, one identity each, different providers. Database users are left alone.
- The BFF needs no change: after linking, the token's `sub` is the primary account's, and `userIdFromAuthSub` maps it
  to the same UUID every time.

## Deploy (owner: these are tenant secrets and settings the agent cannot create)

1. Applications → create a Machine-to-Machine application, authorize it for the Auth0 Management API with
   `read:users` and `update:users`.
2. Actions → Library → Build Custom → Post Login. Paste `link-verified-email.js`. Add the secrets
   `MANAGEMENT_API_DOMAIN` (the tenant domain), `MANAGEMENT_API_CLIENT_ID`, `MANAGEMENT_API_CLIENT_SECRET`.
3. Actions → Flows → Login → add the Action and apply.
4. Check: sign in with GitHub, sign out, sign in with Google using the same verified address. `/auth/profile` shows the
   same `sub` both times.

## Not confirmed against a real tenant

- The order "switch primary user, then link" follows Auth0's own account-linking example. If the first real sign-in
  fails, this is the place to look. A link that fails after the switch denies that login (retry works).
- Whether Auth0's GitHub connection reports `email_verified: true` for a verified GitHub address. If it reports false,
  nothing links, which is safe.
- The cache TTL unit for the management token follows Auth0's example.

## Known gap

Readings saved under the secondary account's id before it was linked are not merged: the BFF keys readings by the
`sub` it sees, and after linking that is the primary's. Migrating them needs a decision and a write to the tarot and
history stores.

## Logs

One JSON line per decision with the shared fields (the Action has no logger abstraction, so it writes through
`console`). No email, token or secret is logged.
