# Confirmation and sign-in

Signup creates the account, then Supabase sends a confirmation link. Whether the
person lands **inside onboarding** or is asked for credentials again depends on
two Supabase project settings, not on application code.

## Why the sign-in page appears after confirming

The app uses Supabase's PKCE flow. The `code` in the confirmation URL can only be
redeemed by the browser that started the signup, because the verifier lives in
that browser's storage. Opening the link in a mail app, a different browser, or
on a phone produces `callback_failed`, and the app sends the person to `/login`
with `next` preserved.

The account *is* confirmed in that case. Signing in once continues straight to
`/onboarding`; no second confirmation is required. The login page now says this
explicitly.

## Fix it properly: confirm with a token hash

A `token_hash` is redeemed server-side and works in any browser. Change
**Supabase → Authentication → Emails → Confirm signup** to:

```html
<h2>Confirm your Aegis account</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/onboarding">Confirm my email</a></p>
<p>This link signs you in and takes you straight to workspace setup.</p>
```

Then set **Authentication → URL Configuration → Site URL** to
`https://aegis22.onrender.com`, and add
`https://aegis22.onrender.com/auth/callback` to the redirect allowlist.

`/auth/callback` already handles that shape: it verifies the hash server-side,
writes the session cookies and redirects to `next`.

## Or remove the step for the demo

If this deployment only carries synthetic demo data, turn off
**Authentication → Providers → Email → Confirm email**. `signUp` then returns a
session immediately and the browser goes to onboarding with no inbox round-trip.
Leave confirmation on if real people will use the workspace.

## Email delivery

Supabase's built-in SMTP is limited to a handful of messages per hour and is
frequently filtered. For anything beyond a demo, set
**Authentication → Emails → SMTP** to Resend and add `RESEND_API_KEY` to the
Render environment (see [render-environment.md](render-environment.md)).
