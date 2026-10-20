import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, ArrowRight, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, FormError } from "../components/UI";
import { Footer } from "../components/Footer";
export function Login() {
  const { account, login } = useAuth(),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [slow, setSlow] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, [busy]);
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
    <div className="auth-shell">
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
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <div className="password-control">
                  <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  />
                  <button
                    type="button"
                    className="password-toggle icon-button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-controls="login-password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(value => !value)}
                  >
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <FormError error={error} />
              {busy && slow && (
                <p className="muted" role="status">
                  Connecting is taking longer than usual. Please keep this page
                  open while we sign you in.
                </p>
              )}
              <button className="button" disabled={busy}>
                {busy ? "Signing in…" : "Sign in to your workspace"}
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="login-help">
              <Link to="/register" className="text-link">Register as Requester</Link>
              <br />
              Need access or help signing in?
              <br />
              Contact your institution’s authorized administrator.
            </p>
            <small className="muted">
              Your session is saved on this browser. Use Logout when you finish
              on a shared device.
            </small>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
