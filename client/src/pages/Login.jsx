import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Building2, ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, FormError } from "../components/UI";
export function Login() {
  const { account, login } = useAuth(),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  if (account) return <Navigate to="/dashboard" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await login(Object.fromEntries(form));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-art">
        <div className="brand">
          <span className="brand-icon">
            <Building2 />
          </span>
          <span>
            COEP <b>Spaces</b>
            <small>CAMPUS VENUE BOOKING</small>
          </span>
        </div>
        <div className="login-message">
          <p className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</p>
          <h1>
            Great ideas
            <br />
            need a space
            <br />
            <i>to happen.</i>
          </h1>
          <p>
            Find the right venue. Bring people together.
            <br />
            Make your next campus event a reality.
          </p>
        </div>
        <div className="login-art-footer">
          COEP Technological University <span>EST. 1854</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="section-icon">
            <LockKeyhole size={23} />
          </span>
          <p className="eyebrow">YOUR CAMPUS, CONNECTED</p>
          <h1>Welcome back.</h1>
          <p className="muted">
            Sign in with your institution-provisioned account.
          </p>
          <form onSubmit={submit}>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                placeholder="you@coeptech.ac.in"
                autoComplete="username"
                required
                maxLength={254}
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
            <FormError error={error} />
            <button className="button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to your workspace"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Need access or help signing in?
            <br />
            Contact your institution’s authorized administrator.
          </p>
          <small className="muted">
            Your session stays in memory. Sign in again after refreshing.
          </small>
        </div>
      </section>
    </div>
  );
}
