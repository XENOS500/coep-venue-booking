-- One administrator account per database, including inactive accounts.
-- Requesters and approvers remain unrestricted. A partial unique index also
-- prevents concurrent writes and maintenance tools from bypassing the rule.
-- Existing duplicate administrators must be reviewed before this migration;
-- never silently demote users or remove accounts during deployment.
CREATE UNIQUE INDEX "Account_single_admin"
ON "Account" ("role")
WHERE "role" = 'ADMIN';
