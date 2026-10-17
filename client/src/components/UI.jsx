import { useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  X,
} from "lucide-react";
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow || "COEP TECHNOLOGICAL UNIVERSITY"}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Status({ value }) {
  return (
    <span className={`status status-${value?.toLowerCase()}`}>
      <span aria-hidden="true" />
      {value?.replaceAll("_", " ")}
    </span>
  );
}
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={24} /> Loading…
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="alert" role="alert">
      <AlertCircle size={20} />
      <div>
        {message}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({ title = "Nothing here yet", children }) {
  return (
    <div className="state empty">
      <div className="empty-symbol">◎</div>
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </div>
  );
}
export function QueryState({ query, children }) {
  if (query.loading) return <Loading />;
  if (query.error)
    return <ErrorState message={query.error} retry={query.reload} />;
  return children;
}
export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.total <= pagination.limit) return null;
  const { page, limit, total } = pagination;
  return (
    <div className="pagination">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={16} />
          Previous
        </button>
        <button
          className="button secondary"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Field({ label, children, hint, ...props }) {
  return (
    <label className="field" {...props}>
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function FormError({ error }) {
  if (!error) return null;
  const detail = error.response?.data?.error;
  const fields = detail?.fields;
  return (
    <div className="alert" role="alert">
      <div>
        {detail?.message || error.message}
        {fields && (
          <ul>
            {Object.entries(fields).map(([field, messages]) => (
              <li key={field}>
                {field}: {messages.join(", ")}
              </li>
            ))}
          </ul>
        )}
        {detail?.conflicts?.length > 0 && (
          <ul>
            {detail.conflicts.map((c, i) => (
              <li key={i}>
                {new Intl.DateTimeFormat("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(c.startsAt))}{" "}
                –{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  timeZone: "Asia/Kolkata",
                  timeStyle: "short",
                }).format(new Date(c.endsAt))}{" "}
                · Asia/Kolkata
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
