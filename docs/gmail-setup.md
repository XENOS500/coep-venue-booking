# Gmail API OTP setup

The backend now sends OTP emails through Gmail API over HTTPS. Any valid email
can register as a Requester. The existing Admin login and Admin-only Approver
management remain unchanged. Newly created Approvers still use college emails.
No Google OAuth step is required for Requesters: only the sender authorizes Gmail.

## 1. Create the Google Cloud project

Sign in at https://console.cloud.google.com/ with the Gmail account you will
send from. Create project `COEP Venue Booking` and select it. Go to **APIs &
Services → Library → Gmail API → Enable**.

## 2. Configure Google Auth platform

Open **Google Auth platform → Branding → Get started** (or the existing Branding
page). Enter app name `COEP Spaces`, use your sender account for support and
contact emails, and choose **External** audience. Complete the setup.

Under **Audience → Test users**, add the sender's Gmail address while testing.
Do not add all Requesters; they do not authorize Gmail. Under **Data Access →
Add or remove scopes**, add only:

```text
https://www.googleapis.com/auth/gmail.send
```

Save. This scope allows sending, not reading inbox mail. Reference:
https://developers.google.com/workspace/gmail/api/auth/scopes

### Public Branding links

Deploy the newly added static pages first. They are bundled with the frontend,
work without login or JavaScript, and do not need the backend to be online.
After confirming each URL opens in incognito, enter exactly:

| Branding field | URL |
| --- | --- |
| Application home page | `https://coep-venue-booking.vercel.app/about.html` |
| Application privacy policy link | `https://coep-venue-booking.vercel.app/privacy.html` |
| Application Terms of Service link | `https://coep-venue-booking.vercel.app/terms.html` |
| Authorized domain | `coep-venue-booking.vercel.app` |

Keep app name `COEP Spaces` and the support/developer contact email used by the
maintainer. Public pages currently show `pareekayush500@gmail.com`, matching the
provided Google Branding screenshots. Review the policy and contact details
before publishing; update them whenever the deployment's actual practices change.
The public introduction links to the privacy policy and explains Gmail API use.
Google may separately request domain ownership or brand/scope verification;
publishing these pages is not a guarantee of Google approval. Save Branding,
then return to Audience to publish the app when Google's requirements are met.

Vercel serves existing static files before the SPA rewrite, so no rewrite change
is required. Do not submit the URLs while they still return the old login page.

## 3. Create OAuth credentials

Open **Google Auth platform → Clients → Create client**:

* Application type: **Web application**
* Name: `COEP Spaces Gmail Sender`
* Authorized JavaScript origins: leave empty
* Authorized redirect URI: `https://developers.google.com/oauthplayground`

Create and securely retain the **Client ID** and **Client secret**. They are
not API keys or Gmail passwords. No service account or SMTP app password is used.

## 4. Authorize the sender in OAuth Playground

Open https://developers.google.com/oauthplayground/ and click the settings gear.
Enable **Use your own OAuth credentials**; paste the Client ID and Client secret
from step 3. Set **Access type: Offline** and **Force prompt: Consent Screen**.
In Step 1 enter the exact `gmail.send` scope above, then **Authorize APIs**.
Choose the sender account and approve only sending permission.

An unverified-app warning may be shown for your own app. Proceed only after
checking the project/client is yours; do not bypass an organizational block.
In Step 2 click **Exchange authorization code for tokens**. Save the **Refresh
token**, not the short-lived Access token. Keep all tokens private.

The Playground must use your own credentials, not its built-in shared client:
https://developers.google.com/oauthplayground/

## 5. Avoid a seven-day testing-token expiry

Google expires authorizations/refresh tokens after seven days when an External
app remains in Testing with Gmail scope. For initial testing this is sufficient.
Before relying on the sender, open **Audience → Publish app** and confirm the
publishing status is **In production**, following any Google requirements shown.
Then repeat step 4 to obtain a fresh refresh token under that status.

Publishing is not Google verification. `gmail.send` is a sensitive scope; Google
may require additional verification depending on the app's use. Do not claim the
app is Google-verified. Even production tokens can be revoked, including after
certain sender-account changes. If authorization fails later, reauthorize and
replace the refresh token. Relevant Google guidance:
https://support.google.com/cloud/answer/15549945
https://developers.google.com/workspace/gmail/api/auth/scopes
https://developers.google.com/identity/protocols/oauth2#expiration

## 6. Configure Render

Add these four variables to **Render → backend service → Environment**:

| Variable | Value to enter |
| --- | --- |
| `GMAIL_CLIENT_ID` | The Client ID from step 3 |
| `GMAIL_CLIENT_SECRET` | The Client secret from step 3 |
| `GMAIL_REFRESH_TOKEN` | The Refresh token from step 4/5 |
| `GMAIL_SENDER_EMAIL` | The exact Gmail address authorized in step 4 |

Remove obsolete `RESEND_API_KEY` and `EMAIL_FROM` variables; the app no longer
uses them. Do not change existing database credentials, Admin credentials or
JWT secret. These four variables never belong on Vercel or in `VITE_*` values.

Commit/push the code yourself, merge `dev` into `main`, deploy backend and frontend
from that merged commit. Keep Render's start command:

```text
npm run db:migrate && npm run start -w server
```

The new `202610170003_requester_any_email` migration removes the previous
college-only pending-registration constraint. Do not edit already applied
migrations or reset production data. Full release instructions are in
`registration-and-deployment.md`.

## 7. Test actual delivery

Visit https://coep-venue-booking.vercel.app/register using a new email, complete
the OTP and log in. Test Gmail, Yahoo and college recipients. Check Spam and the
sender Gmail's Sent folder. Google authorization is needed only for the sender,
not for each recipient. Delivery still depends on Gmail sending limits and the
recipient's mailbox policy; Gmail API cannot guarantee inbox placement.

If you see `EMAIL_NOT_CONFIGURED`, check all four Render variables. For
`EMAIL_DELIVERY_FAILED`, confirm API enablement, `gmail.send` permission, the
correct client/refresh-token pairing, publication status and sender authorization.
`redirect_uri_mismatch` means the URI in step 3 differs from the Playground URI.
`access_denied` while Testing often means the sender is missing from Test users
or the wrong Google account was chosen. Never share tokens in screenshots.

Tests use a mocked Gmail transport; no actual Gmail account has been authorized
and no real OTP emails have been sent by the agent.
