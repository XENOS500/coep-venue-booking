import { Router } from "express";
import { respond } from "../controllers/controller.js";
import { authenticate, authorize, publicAccount } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/security.js";
import { createAuthService } from "../services/auth.service.js";
import { createBookingService } from "../services/booking.service.js";
import { createVenueService } from "../services/venue.service.js";
import { createAccountService } from "../services/account.service.js";
import { createEmailService } from "../services/email.service.js";
import { createRegistrationService } from "../services/registration.service.js";
import * as v from "../validators/schemas.js";
export function apiRouter(db, config, options = {}) {
  const router = Router(),
    emailService = options.emailService || createEmailService(config),
    auth = createAuthService(db, config.JWT_SECRET),
    bookings = createBookingService(db, options.clock, {
      frontendOrigin: config.CLIENT_ORIGIN, onDecision: options.onDecision,
    }),
    venues = createVenueService(db, options.clock),
    accounts = createAccountService(db),
    registration = createRegistrationService(db, config.JWT_SECRET, emailService, options.clock);
  const id = (req) => v.parse(v.uuid, req.params.id);
  // A lightweight public liveness check keeps the API reachable without
  // waking Neon on every scheduled request. /health still checks the database.
  router.get(
    "/health/live",
    respond(() => ({ status: "ok" })),
  );
  router.get(
    "/health",
    respond(async () => {
      await db.$queryRaw`SELECT 1`;
      return { status: "ok" };
    }),
  );
  router.post(
    "/auth/login",
    loginLimiter(options.rateLimit),
    respond((req) => auth.login(v.parse(v.loginSchema, req.body))),
  );
  const registrationLimit = loginLimiter(options.registrationRateLimit || { max: 10, windowMs: 15 * 60 * 1000 });
  router.post("/auth/register", registrationLimit,
    respond(req => registration.request(v.parse(v.registrationSchema, req.body)), 202));
  router.post("/auth/register/resend", registrationLimit,
    respond(req => registration.resend(v.parse(v.resendRegistrationSchema, req.body).registrationId), 202));
  router.post("/auth/register/verify", loginLimiter({ max: 30, windowMs: 15 * 60 * 1000 }),
    respond(req => registration.verify(v.parse(v.verifyRegistrationSchema, req.body)), 201));
  router.use(authenticate(db, config.JWT_SECRET));
  router.get("/accounts", authorize("ADMIN"),
    respond(req => accounts.list(req.account, v.parse(v.listSchema, req.query)), 200, false));
  router.post("/accounts/approvers", authorize("ADMIN"),
    respond(req => accounts.createApprover(req.account, v.parse(v.approverCreateSchema, req.body)), 201));
  router.patch("/accounts/approvers/:id", authorize("ADMIN"),
    respond(req => accounts.updateApprover(req.account, id(req), v.parse(v.approverPatchSchema, req.body))));
  router.get(
    "/auth/me",
    respond((req) => publicAccount(req.account)),
  );
  router.get(
    "/venues",
    respond((req) => venues.list(v.parse(v.listSchema, req.query)), 200, false),
  );
  router.get(
    "/venues/:id",
    respond((req) => venues.detail(id(req))),
  );
  router.post(
    "/venues",
    authorize("ADMIN"),
    respond(
      (req) =>
        venues.create(req.account, v.parse(v.venueCreateSchema, req.body)),
      201,
    ),
  );
  router.patch(
    "/venues/:id",
    authorize("ADMIN"),
    respond((req) =>
      venues.update(
        req.account,
        id(req),
        v.parse(v.venuePatchSchema, req.body),
      ),
    ),
  );
  router.get(
    "/approvers",
    authorize("ADMIN"),
    respond(
      (req) => venues.directory(v.parse(v.listSchema, req.query)),
      200,
      false,
    ),
  );
  router.get(
    "/venues/:id/approvers",
    authorize("ADMIN"),
    respond((req) => venues.assignments(id(req))),
  );
  router.put(
    "/venues/:id/approvers",
    authorize("ADMIN"),
    respond((req) =>
      venues.assign(
        req.account,
        id(req),
        v.parse(v.assignmentSchema, req.body),
      ),
    ),
  );
  router.post(
    "/availability/check",
    respond((req) =>
      bookings.availability(v.parse(v.scheduleSchema, req.body)),
    ),
  );
  router.get(
    "/bookings",
    authorize("REQUESTER", "APPROVER"),
    respond(
      (req) => bookings.list(req.account, v.parse(v.listSchema, req.query)),
      200,
      false,
    ),
  );
  router.post(
    "/bookings",
    authorize("REQUESTER"),
    respond(
      (req) => bookings.create(req.account, v.parse(v.bookingSchema, req.body)),
      201,
    ),
  );
  router.get(
    "/bookings/:id",
    authorize("REQUESTER", "APPROVER"),
    respond((req) => bookings.detail(req.account, id(req))),
  );
  router.post(
    "/bookings/:id/decision",
    authorize("APPROVER"),
    respond((req) =>
      bookings.transition(
        req.account,
        id(req),
        v.parse(v.decisionSchema, req.body),
      ),
    ),
  );
  router.post(
    "/bookings/:id/cancel",
    authorize("REQUESTER"),
    respond((req) =>
      bookings.transition(
        req.account,
        id(req),
        v.parse(v.cancelSchema, req.body ?? {}),
        true,
      ),
    ),
  );
  router.get(
    "/calendar",
    respond((req) =>
      bookings.calendar(req.account, v.parse(v.calendarSchema, req.query)),
    ),
  );
  return router;
}
