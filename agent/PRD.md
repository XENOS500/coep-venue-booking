# COEP Venue Booking System — PRD

Version 2.0 · 16 October 2026

## 1. Goal and technical baseline

An internal system where COEP requesters find venues, check availability, submit bookings, and track decisions. Approvers decide requests only for assigned venues. Admins maintain venues and approver assignments.

- **Database:** Neon-hosted PostgreSQL; existing project `coep-venue-booking`; Prisma ORM and migrations.
- **Repository:** `XENOS500/coep-venue-booking`.
- **Stack:** React/Vite, Tailwind CSS, React Router, FullCalendar; Node.js/Express, JWT, bcryptjs, Zod. Keep one frontend, backend, and database.
- **Success:** complete browse → request → decision → calendar flow; no overlapping active reservations under concurrent requests; permissions enforced on every protected operation.

## 2. Roles, accounts, and navigation

Each active account has exactly one role; roles do not inherit one another’s powers.

| Role | Permissions | Additional navigation |
|---|---|---|
| REQUESTER | Submit requests; view and cancel own eligible bookings | New Booking, My Bookings |
| APPROVER | View full requests and decision history for currently assigned venues; approve/reject pending requests there | Pending Requests, Approval History |
| ADMIN | Create/edit/deactivate venues, configure availability, assign/remove existing APPROVER users for specific venues | Manage Venues, Assign Approvers |

**Shared navigation:** Venue Catalog, Check Availability, Calendar, Profile/Logout. Use one responsive navbar with role-specific links and protected routes. Admins receive no booking decision, requester, or cancellation powers. Approvers cannot submit bookings or manage venues. Shared calendar/catalog access does not grant private booking access.

**Accounts:** admin-provisioned through a documented, trusted maintenance/seed process; no public registration or self-selected roles. Initial admin access is bootstrapped securely. Account provisioning, deactivation, and role changes remain operational tasks, not additional ADMIN application screens or APIs. This explicitly supersedes legacy public registration and broad admin/account-management permissions.

## 3. Real venue catalog and images

Import all **61 venue records** from `coep_venues.xlsx`, sheet `in`, rows 2–62. Source serials run 1–62 with 50 absent; do not invent a missing venue. Ignore blank columns and trailing blank rows. Preserve source serial and raw values for traceability; use a separate UUID as the application ID.

| Workbook column | Venue field |
|---|---|
| A — Sr No | sourceSerial |
| B — Building Name | buildingName |
| C — Floor | floor |
| D — Venue Name | name |
| E — Class Room/Lab/Seminar Hall | venueType |
| F — Class Room No/Lab No/Seminar Hall No | roomReferenceRaw |
| J — Capacity(eg 120, 50) | capacity, nullable until verified |
| K — Features(eg projector, MIC , wifi, etc) | features |
| L — Pictures URL | imageSourceUrl / imageSourceLabel |
| M — Venue Can be Used for(eg hands-on session, lecture, lab,etc) | allowedUses |

Catalog cards/details show name, building, floor, type, capacity, features, permitted uses, image/fallback, and booking eligibility. Search/filter by name, building, type, and capacity. Unknown values display “Not provided”; do not infer equipment or capacity. Preserve “No Wifi” as a negative feature.

**Import corrections:** trim whitespace without merging distinct venues. Names such as `ME-201` repeat across buildings. Column F contains repeated values such as `4` for NC 01–08 and must not be treated as a reliable room ID. Several floors/types are ambiguous. Keep these raw values flagged for admin review. Missing capacities occur at source serials 41, 47, 48, 49, 51, and 52; show these venues in the catalog but block requests until capacity and booking configuration are verified.

**Images:** read the cell’s hyperlink target first, then an HTTPS URL in its text. There are 38 linked entries: 32 non-folder links and 6 SharePoint folder links; 21 blanks and 2 unlinked labels. Shared links are not necessarily directly embeddable images. Preserve original URLs, including query strings; do not invent download URLs. Store a separate verified `imageUrl` for display; otherwise use a placeholder and an optional source link. Folder links require selection of an authorized individual image. Unlinked labels `3D Lab 1st Floor` and `Basment` are unresolved assets. Link accessibility and image contents have not been verified.

Examples inspected in the workbook:

- NC 05: Academic Complex Building, 2nd floor, capacity 72, Projector/Mic/Speaker/Wifi, Lecture; [source image](https://coepac-my.sharepoint.com/:i:/g/personal/ksp_comp_coeptech_ac_in/EY7XfX1KNQlMkCTxXJQI0BABleLdKq1eLj2eJ2QNIOqH1A?e=GsPQog).
- ME-001: Mechanical Old Bajaj Building, Ground Floor, capacity 90; [source image](https://drive.google.com/file/d/11r8JUGcdvTO0ylOI_nn1YEYv9b4CKOKq/view?usp=sharing).
- Applied Mech basement: capacity 30; cell L19 displays `Fluid Mechanics_Basement1.jpg` but contains a [SharePoint image link](https://coepac-my.sharepoint.com/:i:/g/personal/rz_civil_coeptech_ac_in/EZlKqOfsGOZBu773lI-WxL0Bx_j_E4f_RBBKkQ6F5cNAbA?e=VJxXAO).

## 4. Booking and decision rules

**Required form fields:** venue; event title and type; contact name, email, and phone; schedule; positive integer guest count; event details; purpose. Event type is a simple configurable list including Other with free text. Guest count cannot exceed verified capacity. Contact details describe the event contact and do not change booking ownership.

1. **Time and 30-day window:** use `Asia/Kolkata` for inputs, display, recurrence, and validation; store UTC occurrence timestamps. Permit today through today + 30 calendar days, inclusive; today’s start must be in the future. On 16 October 2026, the last eligible date is 15 November 2026. This is an advance-booking limit, not 30 days’ minimum notice. Apply it to every generated occurrence at submission.
2. **Single/recurring:** single booking has one date; recurrence has inclusive start/end dates, selected ISO weekdays (Monday=1), and one daily time range. Preview all generated dates; reject empty results, past dates, and dates outside the window. End must be after start on the same day; no overnight bookings. Validate configured opening hours and venue eligibility on every occurrence.
3. **Availability:** PENDING and APPROVED reserve slots; REJECTED and CANCELLED release them. Pending holds have no automatic expiry in MVP. Show occupied intervals without exposing another requester’s personal information. A preview does not guarantee reservation.
4. **Conflicts:** same venue overlaps when `newStart < existingEnd AND newEnd > existingStart`. Adjacent slots are allowed; no buffer is assumed. Recheck all occurrences in a transaction while locking the venue row before submission. Create the whole series or none; return conflicting dates/times. Every operation affecting slots follows the same locking convention.
5. **Decisions:** only an active APPROVER currently assigned to the venue can decide. Recheck assignment, pending status, future first occurrence, venue eligibility, and conflicts transactionally, excluding the request’s own holds. Approve or reject the entire series once; rejection requires a reason. Prevent self-approval even if an account’s role changed. Record actor, decision, reason, and time.
6. **Transitions:** `PENDING → APPROVED | REJECTED | CANCELLED`; `APPROVED → CANCELLED`. Rejected/cancelled requests are final. Never automatically approve or overwrite an existing decision.
7. **Cancellation:** only the owning REQUESTER may cancel a pending/approved booking before its first occurrence starts. Cancellation releases the whole series. No admin/approver cancellation override. Changes require cancellation and a new request; partial-series edits/cancellation are deferred.
8. **Venue changes:** deactivation preserves history and blocks new bookings. Block deactivation while future pending/approved reservations exist; requesters must cancel eligible bookings first. Reject availability/capacity changes that invalidate active future reservations. Assignment changes do not alter existing decisions; an unassigned venue cannot accept new requests, and pending requests become actionable when a valid approver is assigned.

## 5. Core pages and privacy

Login; Venue Catalog; Venue Details; Check Availability; New Booking with recurrence preview; My Bookings; Booking Details; Calendar; Pending Requests; Approval History; Manage Venues with add/edit form; Assign Approvers; Profile/Logout. Forms can be embedded rather than separate routes. No registration page, general account-management page, or admin approval queue.

Calendar shows reserved venue/time intervals to all signed-in users, approved reservations, and a distinct indication of the requester’s own pending bookings. Private contact, guest count, details, and purpose are visible only to the owner and currently assigned approvers. Admins see operational occupancy summaries only. Booking Details follows the same access rules. Provide loading, empty, validation, success, and error states, accessible labels, keyboard controls, and status text independent of color.

## 6. Minimal schema and API

Use UUID keys, foreign keys, timestamps, unique account email, positive known capacity/guest count, and occurrence end-after-start checks.

| Entity | Minimum fields |
|---|---|
| Account | id, name, email, passwordHash, role, isActive, createdAt |
| Venue | id, workbook fields above, imageUrl?, isActive, bookingEnabled, openingTime, closingTime, sourceRaw |
| VenueApprover | venueId, approverId, assignedBy, assignedAt; unique venueId + approverId |
| Booking | id, requesterId, venueId, eventTitle, eventType, contactName/email/phone, guestCount, details, purpose, startDate/endDate, weekdays[], localStartTime/localEndTime, status, createdAt |
| BookingOccurrence | id, bookingId, venueId, startsAt, endsAt |
| BookingAction | id, bookingId, actorId, action, reason?, createdAt |

Booking status governs every occurrence. Index occurrence venue/time, booking owner/status, and approver assignments. Preserve referenced records; no hard deletion of booked venues. Check active account role and current assignment on each decision, including after account changes.

Base `/api/v1`; JSON; authenticated endpoints; ISO dates and UTC timestamps; paginated lists.

| Endpoint | Access/purpose |
|---|---|
| POST /auth/login; GET /auth/me | Login and current active account |
| GET /venues; GET /venues/:id | All roles; catalog/details |
| POST /venues; PATCH /venues/:id | ADMIN; create/update/deactivate |
| GET /approvers | ADMIN; minimal active APPROVER directory for assignment |
| GET /venues/:id/approvers; PUT /venues/:id/approvers | ADMIN; read/replace assignments, validate APPROVER role |
| POST /availability/check | All roles; validate schedule and preview occurrences/conflicts |
| POST /bookings | REQUESTER; form fields and schedule → PENDING series |
| GET /bookings; GET /bookings/:id | Owner or assigned APPROVER; scoped list/details/history |
| POST /bookings/:id/decision | Assigned APPROVER; APPROVED/REJECTED, reason |
| POST /bookings/:id/cancel | Owning REQUESTER; eligible cancellation |
| GET /calendar?from=&to= | All roles; privacy-filtered occurrence summaries |

Return 400 for invalid rules/input, 401 for invalid login, 403 for forbidden actions, 404 for missing/inaccessible records, 409 for conflicts or invalid transitions. Use `{error:{code,message,fields?,conflicts?}}`; never return another requester’s private details in conflict errors. No registration or role-management API in MVP.

## 7. Security, priorities, and acceptance

**Security:** server-side validation, role/ownership/assignment checks; bcrypt password hashes; signed expiring JWTs kept in memory; HTTPS; login rate limits; trusted-origin CORS; bounded request/list sizes; parameterized database access; Neon credentials and secrets only in server environment variables. Never expose database credentials to the browser or log passwords/tokens/private booking data. Use TLS database connections, migrations, backup/recovery procedures, and audit booking decisions plus venue/assignment changes.

**Must have:** authentication/provisioning, all three role boundaries, real catalog import, venue management/assignments, complete form, availability, recurrence/30-day rules, transactional conflict prevention, approval/rejection, cancellation, status/history, basic calendar, responsive accessible navigation.

**Should have:** richer filters, count cards, improved operational error reporting. **Optional:** email after successful transaction commit; email failure never reverses a booking. **Deferred:** public signup, payments, QR check-in, waitlist, priority overrides, uploads, advanced reporting, partial-series changes, and automatic pending expiry.

**Release checks:** deny admin decisions and unassigned approver access; deny other users’ private details/cancellation; validate recurrence and both 30-day boundaries; allow adjacent slots; reject entire conflicting series; simultaneous overlapping submissions create only one reservation; duplicate/concurrent decisions cannot corrupt status; cancellation releases every occurrence; import all 61 records and handle missing capacities/images safely. Target 95% of catalog/availability requests within 2 seconds with 100 venues, 1,000 occurrences, and 10 concurrent users.

## 8. Sources and explicit assumptions

Based on uploaded `PRD.docx` v1.1 (15 October 2026), cross-checked with legacy `agent_instructions.md`, and direct inspection of `coep_venues.xlsx` values and hyperlink targets. This PRD supersedes conflicting role, registration, navigation, and demo-seeding requirements; seed the real catalog instead. The legacy instruction file itself is not modified.

- Retain the source PRD’s pending-slot holds, inclusive 30-day horizon, whole-series decisions/cancellation, and timezone. Remove its unsupported claim that COEP venues are located in Kolkata; a timezone does not establish venue location.
- Assume account provisioning is a restricted maintenance responsibility, compatible with ADMIN having only venue/assignment powers in the application.
- Assume multiple approvers per venue are allowed; any one currently assigned approver can decide, with the first valid decision final. At least one is required before accepting requests.
- Opening hours are absent from the workbook: admins must configure them before enabling bookings. Missing capacity blocks booking, while a missing image does not.
- Event-type choices, required contact fields, no approval after the first occurrence starts, and blocking venue changes that invalidate reservations are explicit MVP assumptions where legacy requirements were silent.

This deliverable specifies requirements only; it does not implement the application or change Git state.
