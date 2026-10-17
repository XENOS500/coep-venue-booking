import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Field, FormError } from "../components/UI";
import { Footer } from "../components/Footer";

export function Register() {
  const { account } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  if (account) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError(null);
    try {
      if (registration) {
        await api.post("/auth/register/verify", { registrationId: registration.registrationId, code: values.code }, { timeout: 120000 });
        setDone(true);
        setRegistration(null);
      } else {
        const response = await api.post("/auth/register", values, { timeout: 120000 });
        form.reset();
        setRegistration(response.data.data);
        setCooldown(response.data.data.resendAfterSeconds);
      }
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post("/auth/register/resend", { registrationId: registration.registrationId }, { timeout: 120000 });
      setCooldown(response.data.data.resendAfterSeconds);
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  return (
    <div className="auth-shell">
      <main className="registration-page">
        <section className="panel registration-panel">
          <p className="eyebrow">COEP SPACES</p>
          <h1>{done ? "Your account is ready" : registration ? "Verify your email" : "Register as Requester"}</h1>
          {done ? <p>You can now sign in with your email and the password you chose.</p> : <>
            <p className="muted">{registration
              ? `Enter the six-digit code sent to ${registration.email}. It expires in 10 minutes. Check your spam folder too.`
              : "Use an email address you can access, including Gmail, Yahoo or college mail. Requester accounts can submit booking requests for approval."}</p>
            <form key={registration ? "verify" : "register"} onSubmit={submit}>
              {registration ? <Field label="Verification code">
                <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
              </Field> : <>
                <Field label="Your name"><input name="name" autoComplete="name" maxLength={120} required /></Field>
                <Field label="Email address"><input name="email" type="email" autoComplete="email" placeholder="Your email address" maxLength={254} required /></Field>
                <Field label="Password" hint="Use at least 12 characters."><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></Field>
              </>}
              <FormError error={error} />
              <button className="button" disabled={busy}>{busy ? "Please wait…" : registration ? "Verify and create account" : "Send verification code"}</button>
            </form>
            {registration && <div className="account-actions">
              <button type="button" className="button secondary" onClick={resend} disabled={busy || cooldown > 0}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
              <button type="button" className="text-button" disabled={busy} onClick={() => { setRegistration(null); setError(null); }}>Use another email</button>
            </div>}
          </>}
          <p><Link to="/login" className="text-link">{done ? "Sign in" : "Back to sign in"}</Link></p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
