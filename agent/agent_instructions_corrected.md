# Agent Instructions — Venue Booking Management System

Version 1.2 | 15 October 2026 | Aligned with PRD version 1.2

## 1. Project Overview

Build a full-stack Venue Booking Management System for managing venue availability, booking requests, approval workflows, and venue administration.

The application has three user roles:

- `REQUESTER`
- `APPROVER`
- `ADMIN`

The project is being developed by a single developer. Prioritize simplicity, maintainability, correctness, and a working MVP over unnecessary architectural complexity.

Follow the project's PRD as the primary source of truth for business requirements. If a requirement is missing or ambiguous, ask for clarification before making a significant architectural or business-rule decision.

Do not implement additional features unless explicitly requested.

## 2. Technology Stack

### Frontend

- React with Vite
- JavaScript and JSX
- Tailwind CSS v4
- React Router
- Axios
- FullCalendar
- date-fns
- lucide-react
- react-hot-toast

### Backend

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- JSON Web Tokens (JWT)
- bcryptjs
- Zod
- Nodemailer (optional for MVP)

### Development Tools

- Git and GitHub
- VS Code
- Postman
- pgAdmin 4
- Prisma Studio

Do not introduce alternative frameworks, databases, ORMs, or additional dependencies without a clear reason and developer approval.

## 3. Git Branching Strategy

The repository uses main for stable code and dev for active work. The agent may edit project files only in the developer-prepared dev checkout and may inspect Git read-only. It must not stage, commit, push, merge, rebase, reset, stash, create/switch/delete branches, create worktrees or pull requests, or perform other Git writes. If on the wrong branch, ask the developer to prepare dev. Leave edits uncommitted; report changes, executed tests, limitations, next task and a suggested commit message. The developer performs Git writes manually.

## 4. Project Architecture

Follow the established folder structure.

### Frontend

`client/src/`

- `assets/` — static assets
- `components/` — reusable UI components
- `pages/` — route-level components
- `services/` — API request functions
- `hooks/` — reusable React hooks
- `context/` — shared application state
- `App.jsx` — application routes
- `main.jsx` — application entry point
- `index.css` — global styles

### Backend

`server/src/`

- `config/` — configuration and Prisma client
- `controllers/` — HTTP request and response handling
- `routes/` — API endpoint definitions
- `middlewares/` — authentication, authorization, validation, error handling
- `services/` — business logic
- `validators/` — Zod validation schemas
- `utils/` — shared helper functions
- `app.js` — Express application setup
- `server.js` — application startup

### Database

`server/prisma/`

- `schema.prisma` — database models
- `migrations/` — schema migrations
- `seed.js` — optional sample data

Keep controllers thin and place business logic in services.

Do not duplicate business rules across controllers, routes, and services.

## 5. Role-Based Access Control

The application has three roles.

### REQUESTER

Can:

- Browse venues
- Check availability
- View the booking calendar
- Create booking requests
- View their own bookings
- Cancel their own bookings according to the PRD

Cannot:

- Approve or reject booking requests
- Manage venue records
- Access other users' private booking details without authorization

### APPROVER

Can:

- Browse venues
- Check availability
- View the booking calendar
- View pending requests within their authorized scope
- Approve or reject requests
- View approval history within their authorized scope

Cannot:

- Add, edit, or delete venues
- Change user roles
- Create booking requests, cancel bookings, or access New Booking / My Bookings
- Access administrative operations without authorization

### ADMIN

Can:

- Access all Approver capabilities
- Add venues
- Edit venue details
- Deactivate venues only after resolving future pending or approved bookings
- Manage venue information and availability configuration

Admin also provisions accounts, assigns roles, activates/deactivates accounts, and cancels eligible bookings with a reason. Admin cannot create bookings or access New Booking / My Bookings. Both reviewer roles can review all organization bookings in this MVP; neither may decide their own historical requests.

### Security Requirements

- Enforce permissions in backend middleware and service logic.
- Never rely on frontend navbar visibility for authorization.
- Never trust a role supplied by the client.
- No public registration page or API. All accounts are provisioned by an Administrator.
- Bootstrap the first Admin through a secure maintenance script; use Manage Accounts thereafter.
- Verify ownership or authorized scope before returning or modifying protected records.

## 6. Role-Based Navbar

Use one reusable Navbar component with shared and role-specific navigation.

### Common Navigation

Visible to all authenticated users:

- Logo and application name
- Dashboard
- Venue Catalog
- Check Availability
- Calendar
- Profile / Logout

### Requester Navigation

- New Booking
- My Bookings

### Approver Navigation

- Pending Requests
- Approvals / History

### Admin Navigation

- Pending Requests
- Approvals / History
- Manage Venues
- Manage Accounts

Manage Venues provides Add, Edit and Deactivate operations within the page. Manage Accounts is a separate Admin-only core page.

Do not create three completely separate Navbar components unless there is a strong architectural reason.

Keep role-based navigation configuration centralized.

Ensure the Navbar is responsive for desktop and mobile screens.

## 7. Booking System Requirements

The booking system must support:

- Selecting a venue
- Selecting booking dates
- Selecting start and end times
- Selecting weekdays for recurring requests when required
- Validating booking rules
- Checking venue availability
- Detecting overlapping bookings
- Submitting booking requests
- Tracking booking status
- Approving or rejecting requests
- Cancelling bookings where permitted

### Booking Statuses

Use clear statuses such as:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`

Use consistent status values across the database, backend, and frontend.

### Clash Detection

A time conflict exists when two bookings for the same venue and date overlap.

Use the following overlap condition:

`existing.startTime < requested.endTime AND existing.endTime > requested.startTime`

Adjacent time slots must not be considered overlapping unless the PRD defines a mandatory buffer between bookings.

Check all relevant dates in a multi-date or recurring booking request.

The backend must reject invalid requests and return meaningful error responses.

A flagged conflict must be shown clearly to the requester or approver.

### Approval Safety

- Recheck availability during approval.
- Never approve conflicting reservations.
- Protect concurrent approval operations using database transactions and appropriate database-level constraints or locking.
- Prevent duplicate approvals and invalid status transitions.
- Both PENDING and APPROVED reserve slots; REJECTED and CANCELLED release them. Exclude the current booking from its approval conflict check.
- Keep booking status changes consistent with the database.

Booking correctness takes priority over interface polish.

## 8. Backend API Guidelines

Use REST-style API routes under `/api/v1` only.

Suggested resource groups:

- `/api/v1/auth`
- `/api/v1/venues`
- `/api/v1/bookings`
- `/api/v1/accounts`, `/api/v1/availability/check`, `/api/v1/calendar`, `/api/v1/health`

Approval decisions use `POST /api/v1/bookings/:id/decision`; no separate approvals resource.

### Rules

1. Use appropriate HTTP methods.
2. Validate incoming requests with Zod.
3. Use consistent JSON response formats.
4. Return meaningful HTTP status codes.
5. Use centralized error handling.
6. Do not expose password hashes, tokens, or sensitive internal details.
7. Use authentication middleware on protected endpoints.
8. Use role-based authorization middleware for restricted operations.
9. Handle database errors gracefully.

Never assume frontend validation is sufficient.

## 9. Database Guidelines

Use PostgreSQL with Prisma.

Expected core entities include:

- Account
- Venue
- Booking
- BookingOccurrence
- BookingAction
- AccountAction

The final schema must follow the approved PRD.

### Rules

- Define appropriate primary and foreign keys.
- Add indexes for commonly queried fields.
- Preserve referential integrity.
- Store passwords as secure hashes.
- Store dates and times consistently.
- Use migrations for schema changes.
- Do not manually modify production database structures outside the migration process.
- Avoid destructive migrations without approval.
- Consider how deleting a venue affects historical bookings.
- Use database-level protection against overlapping approved bookings where appropriate.

## 10. Frontend Guidelines

Use functional React components and hooks.

### Rules

- Prefer reusable components over duplicated JSX.
- Keep API calls in the `services/` directory.
- Use React Router for navigation.
- Use AuthContext for authentication state.
- Implement protected routes for authenticated pages.
- Restrict role-specific routes appropriately.
- Provide loading, empty, success, and error states.
- Show validation errors clearly.
- Make layouts responsive.
- Maintain consistent spacing, typography, and visual styling.
- Use accessible labels, semantic elements, and keyboard-friendly controls.

Do not overengineer global state management.

Use React Context and local component state unless additional complexity is justified.

## 11. Security Requirements

- Hash passwords using bcryptjs.
- Never store plaintext passwords.
- Validate and sanitize untrusted input as appropriate.
- Keep secrets in environment variables.
- Never commit `.env` files.
- Provide `.env.example` files without real credentials.
- Configure CORS for trusted frontend origins.
- Apply secure JWT handling.
- Do not expose sensitive errors to clients.
- Prevent unauthorized access to protected APIs.
- Avoid logging passwords, tokens, and database credentials.

Authentication and authorization must be tested independently.

## 12. Testing Requirements

Test every completed feature before considering it finished.

### Authentication

- Successful login
- Incorrect password
- Missing credentials
- Expired or invalid token
- Unauthorized role access

### Venue Management

- View venues
- View venue details
- Add venue as Admin
- Edit venue as Admin
- Safely deactivate venue as Admin
- Reject unauthorized venue modifications

### Booking

- Create valid booking
- Reject invalid dates
- Reject invalid time ranges
- Detect overlapping bookings
- Allow adjacent non-overlapping bookings
- Handle recurring weekday selections
- Cancel eligible bookings
- Prevent unauthorized cancellation

### Approval

- Approve valid pending request
- Reject pending request
- Prevent conflicting approvals
- Prevent repeated approval
- Prevent unauthorized approval and any self-decision, including after role changes
- Verify correct status updates

Run relevant tests after modifications.

Do not claim a feature is tested unless its tests have actually been executed.

## 13. MVP Priorities

Mandatory: all 13 core pages and their workflows, login-only authentication, account provisioning and roles, venue administration, full event form, single and weekday recurring requests, availability, transactional conflicts, approval/rejection/history, cancellation, calendar, privacy, responsive navigation and useful loading/error states.

Should have: venue filters, simple dashboard count cards, seeded demo data. The Dashboard route remains core even if richer counts are deferred.

Optional: post-commit email notifications. Later: statistics charts, QR check-in, waitlist, priority overrides, uploads, payments, advanced settings and reporting. Do not implement these before mandatory scope or without a request.

## 14. Development Workflow

Follow a feature-by-feature approach.

For each task:

1. Understand the requirement.
2. Inspect relevant existing files.
3. Identify affected components, APIs, and database entities.
4. Propose a short implementation plan for significant changes.
5. Implement the smallest complete solution.
6. Validate the implementation.
7. Run relevant tests.
8. Report completed work and remaining issues.

Prefer complete vertical features over large disconnected batches of frontend and backend code.

Example:

Build the venue listing API, connect it to the React venue catalog, and test the complete flow before beginning the next major feature.

## 15. Agent Operating Rules

Follow section 3: no agent Git writes. Leave all changes uncommitted for manual developer review.

## 16. Expected Agent Response Format

After completing a coding task, provide:

1. **Summary:** What was implemented.
2. **Files changed:** Which files were created or modified.
3. **Testing:** Which commands or tests were run and their results.
4. **Issues:** Any known limitations or unfinished work.
5. **Next step:** The recommended next development task.

Keep explanations concise but sufficiently detailed for a developer learning full-stack development.

## 17. Definition of Done

A feature is complete only when:

- It meets its functional requirements.
- Relevant backend validation is implemented.
- Role-based access is enforced.
- The frontend handles success and failure states.
- Relevant tests pass.
- Existing functionality remains working.
- No secrets or generated dependencies are committed.
- The code is ready for review before merging into `main`.

The overall goal is a reliable, understandable, and maintainable Venue Booking Management System delivered incrementally through the `dev` branch.

Keep the frontend modular and separate UI styling from business logic wherever practical, so the visual design can be changed later without rewriting core functionality.
## 18. Authoritative page inventory and account lifecycle

The MVP contains exactly 13 core pages, including Login and Manage Accounts. Public registration is excluded. Profile, initial password change, account editing, and venue add/edit are modal or inline flows, not extra core pages. Logout, access-denied and not-found states are not counted as core product pages.

Use one responsive, reusable Navbar with centralized role configuration. All signed-in roles see Dashboard, Venue Catalog, Check Availability, Calendar, Profile and Logout. Only REQUESTER sees New Booking and My Bookings. APPROVER and ADMIN see Pending Requests and Approval History. Only ADMIN sees Manage Venues and Manage Accounts. Details pages are reached from permitted lists. Enforce these boundaries in route guards and backend services; hidden links are not security.

All accounts are admin-provisioned. No public registration route, link or API is allowed. Bootstrap the first Administrator using a documented maintenance script with secrets provided outside source control. Admins provision accounts through Manage Accounts and deliver temporary credentials securely outside the app. Require a password change in an authenticated modal before granting ordinary API access. POST /api/v1/auth/change-password accepts currentPassword and newPassword, hashes the new password and invalidates prior tokens. Enforce authorization against the current database role and isActive on every request; role changes, deactivation and password changes revoke existing sessions through tokenVersion. Prevent removal or demotion of the last active Administrator. Audit account creation, role changes and activation changes in AccountAction (id, targetAccountId, actorId, action, createdAt); never store credentials in audit logs.

| # | Page | Route | Access | Purpose |
|---|---|---|---|---|
| 1 | Login | `/login` | Public | Credentials only; no Register link. |
| 2 | Dashboard | `/dashboard` | All roles | Role-specific summary and permitted shortcuts. |
| 3 | Venue Catalog | `/venues` | All roles | Search and filters. |
| 4 | Venue Details | `/venues/:id` | All roles | Capacity, amenities, location, hours. |
| 5 | Check Availability | `/availability` | All roles | Dates, recurrence and slot preview. |
| 6 | New Booking | `/bookings/new` | REQUESTER | Full event form and occurrence preview. |
| 7 | My Bookings | `/my-bookings` | REQUESTER | Own requests and cancellation. |
| 8 | Booking Details | `/bookings/:id` | Scoped | Own details for Requester; all for reviewers. |
| 9 | Pending Requests | `/approvals/pending` | APPROVER, ADMIN | Review and decide eligible requests. |
| 10 | Approval History | `/approvals/history` | APPROVER, ADMIN | Decisions, reasons, actors and timestamps. |
| 11 | Calendar | `/calendar` | All roles | Privacy-filtered pending and approved slots. |
| 12 | Manage Venues | `/admin/venues` | ADMIN | Add, edit, deactivate within page. |
| 13 | Manage Accounts | `/admin/accounts` | ADMIN | Provision, activate and assign roles. |

## 19. Canonical event and API contract

The canonical booking fields are eventType (trimmed text, 1–80 characters), contactName (1–120), contactEmail (valid email, maximum 254), contactPhone (7–25 characters, digits plus spaces, +, parentheses and hyphens, with at least 7 digits), guestCount (positive integer, no greater than venue capacity), eventDetails (1–2000), and purpose (1–500). All are required and stored on Booking. Store phone numbers as text. These bounds are implementation defaults for this revision. Render user text safely and reject unknown or privileged write fields.

Event schedule uses startDate, endDate, weekdays when recurring, localStartTime and localEndTime. Validate real dates, ordered ranges, distinct ISO weekday integers 1–7, and a nonempty occurrence list. Equal dates with no weekdays represent a single booking. Generate every occurrence in Asia/Kolkata and store startsAt/endsAt as UTC timestamps. Return the original schedule and generated occurrences in authorized booking details. Derive requesterId from the authenticated account; generate id, status and timestamps on the server. Never accept client-supplied requesterId or status.

guestCount is the single canonical field replacing attendeeCount in forms, schema, responses and API bodies. Migrate existing attendeeCount values into guestCount without loss. Preserve existing records: for newly required event/contact fields, keep legacy unknown values nullable and flag incomplete legacy details rather than inventing contact data; enforce all required fields on new requests. Any destructive migration requires developer approval.

The creation response is {data:{id,status,...eventFields,...scheduleFields,occurrences}}; authorized detail responses use the same canonical names. List responses use {data:[...],pagination:{page,limit,total}} and redact private details as required. All routes in the API table are relative to /api/v1, including /auth/me. Dashboard counts derive from the same scoped listing rules. Approval History uses GET /api/v1/bookings with status filters and GET /api/v1/bookings/:id including actions. POST /api/v1/accounts returns 201 with public account fields only; account mutations return 200. There is no /auth/register or separate /api/approvals resource.

### Required API operations

All paths below are relative to `/api/v1`.

- **POST /auth/login** — {email, password} → 200 {data:{token, account}}. GET /auth/me returns the current account and its role.
- **GET /venues and /venues/:id** — Optional search, capacity, location filters → venue list or details.
- **POST /venues; PATCH /venues/:id** — Administrator only. Create or update venue fields; return 201 or 200.
- **POST /availability/check** — Booking dates, weekdays, venueId, and time range → {data:{available, occurrences, conflicts}}. Read-only preview.
- **POST /bookings** — REQUESTER only. Schedule fields plus eventType, contactName, contactEmail, contactPhone, guestCount, eventDetails and purpose → 201 booking with status and occurrences, or 409 conflict.
- **GET /bookings and /bookings/:id** — Requester sees only own bookings; Approver and Admin see organization bookings and may filter status. Individual IDs enforce the same scope. History includes actions and decision actors.
- **POST /bookings/:id/decision** — APPROVER or ADMIN only; {decision:"APPROVED"|"REJECTED", reason?}. Rejection requires reason. No decision on own request. Pending, active venue and future first occurrence required.
- **POST /bookings/:id/cancel** — {reason?} → 200 cancelled booking. Administrator cancellation requires a reason.
- **GET /calendar?from=&to=** — Return occurrence summaries within the range; apply role-based privacy.
- **GET /accounts; POST /accounts; PATCH /accounts/:id; PATCH /accounts/:id/role** — ADMIN only. List; provision {name,email,role,temporaryPassword}; update {name,isActive}; assign {role}. Never return hashes or passwords. Preserve last active Admin and audit all changes.

## 20. Booking rules and transactional safety

Pending and approved occurrences both block time. Availability and submission consider both statuses. Submission, decision, cancellation and venue deactivation all lock the same venue row first, then re-read affected booking/venue state inside one transaction. Approval must exclude its own reserved occurrences from conflict checks. Approval and rejection are allowed only while PENDING and before the first occurrence starts; no self-decision is permitted, even after a role change. Cancellation of PENDING or APPROVED is permitted only before the first occurrence. Return 409 for a stale or ineligible transition; 403 for forbidden roles or self-decision. No operation creates or changes only part of a recurring series.

Apply the rolling window at availability preview and submission: local dates from today through today plus 30 days inclusive, with every start strictly in the future. Use the server clock converted to Asia/Kolkata, never the browser timezone. Recheck future start and unchanged schedule validity during a decision. Intervals are half-open; adjacent bookings are allowed. Cancelled and rejected bookings release all occurrences; preserve rows and audit history. Expiry, overnight bookings, partial-series changes and priority overrides remain deferred.

GET /api/v1/health returns minimal service health without secrets. Use the existing error envelope and status conventions. Preserve pagination defaults, privacy boundaries and performance targets. Avoid hard deletion of accounts or referenced venues; deactivate instead.

## 21. Release acceptance checks

Release checks must cover all 13 routes and role-specific navigation; disabled accounts and stale-role tokens; no public registration; account provisioning and last-Admin protection; required event fields and persistence; invalid phone/email and capacity; all weekdays and empty recurrence; today, today plus 30, and day 31 around Kolkata midnight; timezone-independent display; adjacent intervals; pending and approved conflicts; concurrent submissions; approval excluding its own occurrences; no self-decision after a role change; repeat and concurrent decisions; cancellation before and after the first start; rollback of whole series; blocked deactivation with future reservations; and privacy on lists, details, calendar and conflicts. Test authentication independently from authorization. Preserve the target of p95 under 2 seconds for venue lists and availability at 50 venues, 1,000 occurrences and 10 concurrent signed-in accounts.

## 22. Preserved quality and operational requirements

- JWT bearer authentication; bcryptjs hashing; tokens in memory, with login again after refresh acceptable. Verify signature and expiry, current account status, role and tokenVersion. Use HTTPS, trusted-origin CORS, login rate limits, request size limits and safe errors. Keep environment secrets and credentials outside source control and logs.
- Standard errors: `{error:{code,message,fields?,conflicts?}}`; 400 invalid input/rule, 401 missing/expired/invalid login, 403 forbidden role or self-decision, 404 missing/inaccessible record, 409 slot conflict or invalid state. Conflict details reveal dates/times only.
- Dates use YYYY-MM-DD, local times HH:mm, output instants ISO 8601 UTC with Z. Show Asia/Kolkata beside times. Use UUID keys, foreign keys, indexes on occurrence venueId/startsAt and bookingId, positive capacity and endsAt > startsAt checks. Booking status governs every occurrence.
- Venue fields: name, location, capacity, amenities, optional imageUrl, isActive, openingTime, closingTime. Account, Booking, BookingOccurrence, BookingAction and AccountAction follow PRD version 1.2. Use migrations and non-production demo seeds with accounts for all three roles and sample venues. Never ship fixed production passwords.
- Optional email is sent after commit, with delivery logging; failure never rolls back booking state. The booking status page is authoritative.
- Provide health checks, useful safe error logs, environment examples, setup instructions and a database backup before deployment changes. Keep one frontend, one backend and one database. Use one server configuration for booking rules and role permissions without expanding the approved role boundaries.

## 23. Reconciliation record

This revision standardizes the two documents on 13 core pages, with Manage Accounts included and no public registration. Requester permissions are not inherited by reviewers. Both pending and approved reservations block availability. The event fields, guestCount name, versioned API, timezone/window, transactional rules, cancellation authority, and prohibition on agent Git writes are consistent with PRD version 1.2. Existing architecture, stack, privacy, performance, optional notification and deferred-feature requirements remain in force.
