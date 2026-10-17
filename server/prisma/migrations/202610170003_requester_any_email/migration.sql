-- Requesters can now verify any email provider. Approvers are still created
-- only by Admin and retain college-domain validation for new accounts.
ALTER TABLE "PendingRegistration"
DROP CONSTRAINT "PendingRegistration_college_email";

ALTER TABLE "PendingRegistration"
ADD CONSTRAINT "PendingRegistration_email_normalized"
CHECK ("email" = lower(trim("email")));
