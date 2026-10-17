# API reference

Base: `/api/v1`. Protected requests use `Authorization: Bearer <token>`.

Successful objects use `{data:object}`. Paginated venue/booking lists use `{data:[],pagination:{page,limit,total}}` with page 1, default limit 24, maximum 100. Venue lists also include building/type filter values. Errors use `{error:{code,message,fields?,conflicts?}}`. Conflicts contain only UTC start/end instants.

| Method and path | Role / response |
|---|---|
| `GET /health` | Public service/database liveness; no configuration details |
| `GET /health/live` | Public lightweight liveness; no database query |
| `POST /auth/login` | `{email,password}` → `{data:{token,account}}` |
| `POST /auth/register` | Public, any valid email; `{name,email,password}` → 202 `{data:{registrationId,email,expiresInSeconds,resendAfterSeconds}}` |
| `POST /auth/register/resend` | Public; `{registrationId}` → 202; cooldown and hourly email limits |
| `POST /auth/register/verify` | Public; `{registrationId,code}` → 201 after creating REQUESTER only |
| `GET /accounts` | ADMIN; paginated Approver accounts; `page,limit,search`; no hashes |
| `POST /accounts/approvers` | ADMIN; `{name,email,password}`; create or explicitly promote a Requester; college email required |
| `PATCH /accounts/approvers/:id` | ADMIN; `{isActive?,password?}`; revoke sessions and audit; cannot target Admin |
| `GET /auth/me` | Current active account: id, name, email, role |
| `GET /venues` | All roles; `search,building,type,capacity,page,limit` |
| `GET /venues/:id` | All roles; source data, booking eligibility and active approver count |
| `POST /venues` | ADMIN; create; 201 |
| `PATCH /venues/:id` | ADMIN; edit/deactivate safely |
| `GET /approvers` | ADMIN; paginated minimal active APPROVER directory; `page,limit` |
| `GET /venues/:id/approvers` | ADMIN; current assignments |
| `PUT /venues/:id/approvers` | ADMIN; replace with `{approverIds:[UUID]}` |
| `POST /availability/check` | All roles; schedule → available, occurrences, conflicts |
| `POST /bookings` | REQUESTER; event and schedule → PENDING series; 201 |
| `GET /bookings` | REQUESTER owns / APPROVER currently assigned; optional `status,page,limit` |
| `GET /bookings/:id` | Same scope; canonical event data, occurrences and actor history |
| `POST /bookings/:id/decision` | Assigned APPROVER; `{decision:"APPROVED" or "REJECTED",reason?}` |
| `POST /bookings/:id/cancel` | Owning REQUESTER before first occurrence; `{reason?}` |
| `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | All roles; exclusive `to`, maximum 93-day range |

`GET /bookings?status=HISTORY` selects APPROVED, REJECTED and CANCELLED requests. Other allowed statuses are PENDING, APPROVED, REJECTED and CANCELLED. History scope always follows current venue assignments.

## Create request

```json
{
  "venueId": "a-venue-uuid",
  "eventTitle": "Design workshop",
  "eventType": "Workshop",
  "contactName": "Event contact",
  "contactEmail": "contact@coeptech.ac.in",
  "contactPhone": "+91 98765 43210",
  "guestCount": 40,
  "eventDetails": "Hands-on design exercises for students.",
  "purpose": "Introduce collaborative design methods.",
  "startDate": "2026-10-20",
  "endDate": "2026-10-22",
  "weekdays": [2, 4],
  "localStartTime": "10:00",
  "localEndTime": "12:00"
}
```

The example dates must be replaced with eligible dates at runtime. Equal start/end dates with empty weekdays are a single event. Recurrence uses distinct ISO weekdays Monday=1. An availability request contains only venueId and the six schedule fields (no event/contact data). Requester, status and identities are server controlled; unknown write fields are rejected.

## Error status codes

400 invalid input or schedule/configuration; 401 invalid login or session; 403 forbidden role or self-decision; 404 missing or out-of-scope record; 409 overlapping slots, invalid state or venue changes invalidating reservations; 413 excessive body size; 429 excessive login attempts; 500 safe generic service error.
