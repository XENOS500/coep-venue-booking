// Uses an existing Playwright installation; no application dependency is added.
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
async function main() {
  const root = path.resolve(__dirname, "../../..");
  const fixtures = JSON.parse(
    await fs.readFile(path.join(root, ".local/browser-fixtures.json"), "utf8"),
  );
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    timezoneId: "America/Los_Angeles",
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:5173";
  await fs.mkdir(path.join(root, ".local/screenshots"), { recursive: true });
  async function screenshot(name) {
    await page.screenshot({
      path: path.join(root, `.local/screenshots/${name}.png`),
      fullPage: true,
    });
  }
  async function login(role) {
    await page.goto(`${base}/login`);
    await page.getByLabel("Email address").fill(fixtures.accounts[role].email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixtures.accounts[role].password);
    await page
      .getByRole("button", { name: "Sign in to your workspace" })
      .click();
    await page.getByRole("heading", { name: /Welcome,/ }).waitFor();
  }
  async function logout() {
    await page.getByRole("button", { name: /Browser/ }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  }
  await page.goto(`${base}/login`);
  await screenshot("login-desktop");
  await login("ADMIN");
  await page.getByText("61", { exact: true }).waitFor();
  await screenshot("dashboard-desktop");
  assert.equal(
    await page
      .getByRole("link", { name: "Pending requests", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("link", { name: "New booking", exact: true }).count(),
    0,
  );
  await page.getByRole("link", { name: "Manage venues", exact: true }).click();
  await page.getByLabel("Find a venue to manage").fill("NC 05");
  await page.getByRole("button", { name: "Edit NC 05", exact: true }).click();
  await page.getByLabel("Opening time · Asia/Kolkata").fill("08:00");
  await page.getByLabel("Closing time · Asia/Kolkata").fill("20:00");
  await page
    .getByLabel("Capacity and opening hours verified; enable bookings")
    .check();
  await page.getByRole("button", { name: "Save venue", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("link", { name: "Assign approvers", exact: true })
    .click();
  await page.getByLabel("Select a venue").selectOption(fixtures.venueId);
  await page.getByLabel(/Approver Browser/).check();
  await page.getByRole("button", { name: "Save assignments" }).click();
  await page.getByText("Approver assignments saved.").waitFor();
  await logout();
  await login("REQUESTER");
  await page.getByRole("link", { name: "Venue catalog", exact: true }).click();
  await page.getByLabel("Search venues").fill("NC 05");
  await page.getByRole("heading", { name: "NC 05", exact: true }).waitFor();
  await screenshot("catalog-desktop");
  await page.getByRole("heading", { name: "NC 05", exact: true }).click();
  await page
    .getByText("Ready for booking requests.", { exact: false })
    .waitFor();
  await page.getByRole("link", { name: "Request this venue" }).click();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Event date", { exact: true }).fill(tomorrow);
  await page.getByLabel("Event title").fill("Browser workflow workshop");
  await page.getByLabel("Expected guests").fill("25");
  await page
    .getByLabel("Event details")
    .fill("End-to-end browser verification.");
  await page
    .getByLabel("Purpose", { exact: true })
    .fill("Validate the booking workflow.");
  await page.getByLabel("Contact phone").fill("+91 98765 43210");
  await page
    .getByRole("button", { name: "Check availability", exact: true })
    .click();
  await page.getByText("These times are currently available.").waitFor();
  await screenshot("booking-form-desktop");
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Browser workflow workshop", exact: true })
    .waitFor();
  assert.equal(await page.getByText("PENDING", { exact: true }).count(), 1);
  const bookingUrl = page.url();
  await screenshot("booking-pending-desktop");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page
    .locator(".fc-event")
    .filter({ hasText: "Your pending · NC 05" })
    .first()
    .waitFor();
  await screenshot("calendar-desktop");
  await logout();
  await login("APPROVER");
  await page
    .getByRole("link", { name: "Pending requests", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Browser workflow workshop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText("APPROVED", { exact: true }).waitFor();
  await logout();
  await login("REQUESTER");
  await page.getByRole("link", { name: "My bookings", exact: true }).click();
  await page
    .getByRole("link", { name: "Browser workflow workshop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText("CANCELLED", { exact: true }).waitFor();
  // In-memory authentication requires in-app navigation, not a full page reload.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Venue catalog", exact: true }).click();
  await page.getByLabel("Search venues").waitFor();
  await screenshot("catalog-mobile");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "Mobile layout must not overflow horizontally",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await screenshot("navigation-mobile");
  await page
    .getByRole("button", { name: "Close navigation", exact: true })
    .first()
    .click();
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(
    "Browser workflow passed: admin configuration/assignment, catalog/details, availability, requester submission, calendar, approver decision, requester cancellation, desktop/mobile navigation.",
  );
  await context.close();
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  process.exit(1);
});
