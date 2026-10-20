// Run with PLAYWRIGHT_MODULE_PATH pointing to an existing Playwright installation.
// Only a local, migrated disposable database ending in _ui_test is accepted.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile, mkdir } = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const connection = process.env.TEST_DATABASE_URL;
  assert(connection, "Set TEST_DATABASE_URL");
  const parsed = new URL(connection);
  assert(["127.0.0.1", "localhost"].includes(parsed.hostname) && parsed.pathname.endsWith("_ui_test"), "Use only a local disposable _ui_test database");
  const { PrismaClient } = await import("@prisma/client");
  const { default: bcrypt } = await import("bcryptjs");
  const { createApp } = await import("../../src/app.js");
  const db = new PrismaClient({ datasources: { db: { url: connection } } });
  const root = path.resolve(__dirname, "../../..");
  const dist = path.join(root, "client/dist");
  const sentCodes = [];
  const password = "Browser-test-password-123";
  let browser, server, page;
  try {
    await db.$executeRaw`TRUNCATE "PendingRegistration", "BookingAction", "BookingOccurrence", "Booking", "VenueApprover", "AuditEvent", "Venue", "Account" CASCADE`;
    await db.account.create({ data: {
      email: "admin.browser@example.test", name: "Existing Admin", role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 4),
    } });
    let app;
    // Serve the actual production build and API from one ephemeral local server.
    server = createServer((req, res) => {
      if (req.url.startsWith("/api/v1/")) return app(req, res);
      (async () => {
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const isStatic = pathname.startsWith("/assets/") || ["/about.html", "/privacy.html", "/terms.html", "/public-pages.css", "/footer.css"].includes(pathname);
        const file = isStatic ? path.resolve(dist, `.${pathname}`) : path.join(dist, "index.html");
        assert(file.startsWith(dist + path.sep));
        const types = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html" };
        res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
        res.end(await readFile(file));
      })().catch(() => { res.statusCode = 404; res.end(); });
    }).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    app = createApp(db, {
      JWT_SECRET: "browser-test-secret-at-least-32-characters",
      CLIENT_ORIGIN: base,
    }, { emailService: { configured: true, sendOtp: async message => sentCodes.push(message) } });
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await mkdir(path.join(root, ".local/screenshots"), { recursive: true });
    // Public branding pages must be readable without authentication, JavaScript
    // or any API request. Test actual emitted HTML, not the SPA fallback.
    const publicContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    try {
      const publicPage = await publicContext.newPage();
      let publicApiRequests = 0;
      publicPage.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) publicApiRequests++; });
      for (const [pathname, heading] of [["/about.html", "A space for your next idea."], ["/privacy.html", "Privacy policy"], ["/terms.html", "Terms of use"]]) {
        const response = await publicPage.goto(base + pathname);
        assert.equal(response.status(), 200);
        assert.match(response.headers()["content-type"], /text\/html/);
        assert((await response.text()).includes(`<title>`));
        await publicPage.getByRole("heading", { name: heading, exact: true }).waitFor();
        assert.equal(await publicPage.locator("script").count(), 0);
        assert(await publicPage.locator('a[href="/privacy.html"]').count() > 0);
        assert(await publicPage.locator('a[href="mailto:pareekayush500@gmail.com"]').count() > 0);
      }
      await publicPage.goto(`${base}/about.html`);
      await publicPage.screenshot({ path: path.join(root, ".local/screenshots/public-home-desktop.png"), fullPage: true });
      await publicPage.setViewportSize({ width: 390, height: 844 });
      for (const pathname of ["/about.html", "/privacy.html", "/terms.html"]) {
        await publicPage.goto(base + pathname);
        assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Mobile overflow on ${pathname}`);
      }
      await publicPage.goto(`${base}/privacy.html`);
      await publicPage.reload();
      await publicPage.getByRole("heading", { name: "Privacy policy", exact: true }).waitFor();
      await publicPage.screenshot({ path: path.join(root, ".local/screenshots/public-privacy-mobile.png") });
      assert.equal(publicApiRequests, 0);
    } finally { await publicContext.close(); }
    let homepageApiRequests = 0;
    const observeHomepage = request => { if (new URL(request.url()).pathname.startsWith("/api/")) homepageApiRequests++; };
    page.on("request", observeHomepage);
    await page.goto(base);
    await page.getByRole("heading", { level: 1, name: "Big ideas. Better spaces." }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.title(), "COEP Spaces | Find your campus space");
    await page.getByRole("link", { name: "Explore the venue catalog" }).scrollIntoViewIfNeeded();
    for (const photo of await page.locator(".landing-page img").all()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate(image => image.decode());
      assert(await photo.evaluate(image => image.naturalWidth > 0));
    }
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Homepage overflows at ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    assert.equal(await page.getByRole("button", { name: "Open menu", exact: true }).isVisible(), false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, ".local/screenshots/home-desktop.png") });
    await page.screenshot({ path: path.join(root, ".local/screenshots/home-desktop-full.png"), fullPage: true });
    await page.locator(".landing-faq summary").filter({ hasText: "Do I need an account to book a venue?" }).click();
    assert.equal(await page.locator(".landing-faq details").first().getAttribute("open"), "");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.locator("#home-navigation").getByRole("link", { name: "How it works", exact: true }).click();
    assert.equal(new URL(page.url()).hash, "#how-it-works");
    assert.equal(await page.getByRole("button", { name: "Open menu", exact: true }).getAttribute("aria-expanded"), "false");
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Open menu", exact: true }).getAttribute("aria-expanded"), "false");
    await page.locator(".landing-brand").click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, ".local/screenshots/home-mobile.png") });
    await page.locator(".landing-final").getByRole("link", { name: "Create a requester account" }).click();
    await page.waitForURL("**/register");
    await page.goto(base);
    await page.reload();
    await page.getByRole("heading", { level: 1, name: "Big ideas. Better spaces." }).waitFor();
    await page.getByRole("link", { name: "Find your space", exact: true }).click();
    await page.waitForURL("**/login");
    assert.equal(homepageApiRequests, 0, "Public homepage must not depend on the backend");
    page.off("request", observeHomepage);
    await page.setViewportSize({ width: 1280, height: 900 });
    const passwordInput = page.getByLabel("Password", { exact: true });
    await passwordInput.fill("Toggle-test-password");
    assert.equal(await passwordInput.getAttribute("type"), "password");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    assert.equal(await passwordInput.getAttribute("type"), "text");
    assert.equal(await passwordInput.inputValue(), "Toggle-test-password");
    await page.getByRole("button", { name: "Hide password", exact: true }).press("Enter");
    assert.equal(await passwordInput.getAttribute("type"), "password");
    assert.equal(await passwordInput.inputValue(), "Toggle-test-password");
    assert.equal(new URL(page.url()).pathname, "/login");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    assert.equal(await passwordInput.getAttribute("type"), "text");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await page.screenshot({ path: path.join(root, ".local/screenshots/login-password-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.getByRole("link", { name: "Privacy policy", exact: true }).getAttribute("href"), "/privacy.html");
    await page.getByRole("link", { name: "Register as Requester" }).click();
    await page.getByLabel("Your name").fill("Student Browser");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Password").fill(password);
    assert.equal(await page.getByLabel("Email address").evaluate(input => input.checkValidity()), false);
    await page.getByLabel("Email address").fill("student@gmail.com");
    assert.equal(await page.getByLabel("Email address").evaluate(input => input.checkValidity()), true);
    await page.getByRole("button", { name: "Send verification code" }).click();
    await page.getByLabel("Verification code").waitFor();
    assert.equal(sentCodes.length, 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, ".local/screenshots/registration-mobile.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByLabel("Verification code").fill(sentCodes[0].code);
    await page.getByRole("button", { name: "Verify and create account" }).click();
    await page.getByRole("heading", { name: "Your account is ready" }).waitFor();
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    async function login(email, credential = password) {
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(credential);
      await page.getByRole("button", { name: "Sign in to your workspace" }).click();
      await page.waitForURL("**/dashboard");
    }
    await login("student@gmail.com");
    await page.goto(base);
    await page.locator(".landing-header-actions").getByRole("link", { name: "Overview", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Find your space", exact: true }).getAttribute("href"), "/venues");
    assert.equal(await page.getByRole("link", { name: "Get started", exact: true }).count(), 0);
    await page.setViewportSize({ width: 320, height: 700 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator(".landing-header-actions").getByRole("link", { name: "Overview", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("link", { name: "New booking", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Manage accounts", exact: true }).count(), 0);
    await page.locator(".profile-button").click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login("admin.browser@example.test");
    await page.getByRole("link", { name: "Manage accounts", exact: true }).click();
    // All Admin links must remain reachable while the profile stays in view.
    for (const viewport of [{ width: 1920, height: 900 }, { width: 1366, height: 650 }, { width: 1280, height: 600 }, { width: 1024, height: 480 }]) {
      await page.setViewportSize(viewport);
      const profile = page.getByRole("button", { name: "Open your profile", exact: true });
      const bounds = await profile.boundingBox();
      assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, `Profile clipped at ${viewport.width}x${viewport.height}`);
      await profile.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.locator("#campus-navigation").getByRole("link", { name: "Assign approvers", exact: true }).scrollIntoViewIfNeeded();
      assert(await page.locator("#campus-navigation").getByRole("link", { name: "Assign approvers", exact: true }).isVisible());
      await page.locator(".campus-footer").scrollIntoViewIfNeeded();
      assert.equal(await page.locator(".campus-footer .public-info-links a").count(), 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator(".campus-footer").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(237, 241, 231)");
    }
    await page.setViewportSize({ width: 390, height: 600 });
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const mobileProfile = await page.locator(".profile-button").boundingBox();
    assert(mobileProfile && mobileProfile.y + mobileProfile.height <= 600);
    await page.locator(".profile-button").click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Close navigation", exact: true }).first().click();
    await page.locator(".campus-footer").scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, ".local/screenshots/footer-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.screenshot({ path: path.join(root, ".local/screenshots/admin-footer-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Add approver" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Add approver" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Authority Browser");
    await dialog.getByLabel("College email").fill("authority@coeptech.ac.in");
    await dialog.getByLabel("New password").fill(password);
    await dialog.getByRole("button", { name: "Grant Approver access" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("cell", { name: "authority@coeptech.ac.in", exact: true }).waitFor();
    await page.getByRole("button", { name: "Disable authority@coeptech.ac.in", exact: true }).click();
    await page.getByRole("cell", { name: "Disabled", exact: true }).waitFor();
    await page.getByRole("button", { name: "Enable authority@coeptech.ac.in", exact: true }).click();
    await page.getByRole("cell", { name: "Active", exact: true }).waitFor();
    await page.getByRole("button", { name: "Reset password for authority@coeptech.ac.in", exact: true }).click();
    await dialog.getByLabel("New password").fill("Reset-browser-password-123");
    await dialog.getByRole("button", { name: "Reset password", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.screenshot({ path: path.join(root, ".local/screenshots/accounts-desktop.png"), fullPage: true });
    await page.locator(".profile-button").click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login("authority@coeptech.ac.in", "Reset-browser-password-123");
    await page.getByRole("link", { name: "Pending requests", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Manage accounts", exact: true }).count(), 0);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(errors, []);
    console.log("PASS: public homepage photos, navigation, FAQs, responsive layouts and signed-in links work without API calls; static About/privacy/terms work without JavaScript; login, signup and account-management workflows passed.");
  } catch (error) {
    if (page) {
      console.error("UI alerts:", await page.locator(".alert").allTextContents());
      await page.screenshot({ path: path.join(root, ".local/screenshots/accounts-failure.png"), fullPage: true });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
