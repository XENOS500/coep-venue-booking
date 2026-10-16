import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Plus, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "../hooks/useQuery";
import { post } from "../services/api";
import { displayInstant, displayTime } from "../services/dates";
import {
  PageHeading,
  QueryState,
  Empty,
  Status,
  Pagination,
  Modal,
  Field,
  FormError,
} from "../components/UI";
export function Bookings({ mode = "own" }) {
  const [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery("/bookings", {
    page,
    status:
      mode === "pending"
        ? "PENDING"
        : mode === "history"
          ? "HISTORY"
          : status || undefined,
  });
  return (
    <>
      <PageHeading
        eyebrow={
          mode === "own"
            ? "YOUR EVENTS, IN ONE PLACE"
            : "VENUE REVIEW WORKSPACE"
        }
        title={
          mode === "own"
            ? "My bookings"
            : mode === "pending"
              ? "Pending requests"
              : "Approval history"
        }
        description={
          mode === "own"
            ? "Keep track of every request, from planning to approval."
            : "Requests for venues currently assigned to you."
        }
        action={
          mode === "own" && (
            <Link className="button" to="/bookings/new">
              <Plus size={17} />
              New booking
            </Link>
          )
        }
      />
      {mode === "own" && (
        <div className="tabs">
          {["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
            <button
              key={s}
              className={status === s ? "selected" : ""}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All requests"}
            </button>
          ))}
        </div>
      )}
      <QueryState query={query}>
        {query.result?.data.length ? (
          <div className="panel table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event & venue</th>
                    <th>First occurrence</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.result.data.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link className="table-title" to={`/bookings/${b.id}`}>
                          {b.eventTitle}
                        </Link>
                        <small>
                          {b.venue.name} · {b.venue.buildingName}
                        </small>
                      </td>
                      <td>
                        {displayInstant(b.occurrences[0].startsAt)}
                        <small>Asia/Kolkata</small>
                      </td>
                      <td>
                        {b.occurrences.length} occurrence
                        {b.occurrences.length > 1 ? "s" : ""}
                        <small>{b.guestCount} guests</small>
                      </td>
                      <td>
                        <Status value={b.status} />
                      </td>
                      <td>
                        <Link
                          className="icon-button"
                          aria-label={`View ${b.eventTitle}`}
                          to={`/bookings/${b.id}`}
                        >
                          <ArrowUpRight size={19} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <Empty
            title={
              mode === "pending"
                ? "You’re all caught up"
                : "No requests to show"
            }
          >
            {mode === "own"
              ? "Your venue requests will appear here after you submit them."
              : "Requests for your currently assigned venues will appear here."}
          </Empty>
        )}
        <Pagination pagination={query.result?.pagination} onChange={setPage} />
      </QueryState>
    </>
  );
}
export function BookingDetails() {
  const { id } = useParams(),
    query = useQuery(`/bookings/${id}`),
    { account } = useAuth();
  const [action, setAction] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const b = query.result?.data;
  const eligible =
    b &&
    ["PENDING", "APPROVED"].includes(b.status) &&
    new Date(b.occurrences[0].startsAt) > new Date();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const reason = new FormData(e.currentTarget).get("reason")?.trim();
    try {
      await post(
        `/bookings/${id}/${action === "CANCELLED" ? "cancel" : "decision"}`,
        {
          ...(action !== "CANCELLED" ? { decision: action } : {}),
          ...(reason ? { reason } : {}),
        },
      );
      toast.success(`Request ${action.toLowerCase()}.`);
      setAction(null);
      query.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        className="back-link"
        to={
          account.role === "REQUESTER" ? "/my-bookings" : "/approvals/pending"
        }
      >
        <ArrowLeft size={16} />
        Back to requests
      </Link>
      <QueryState query={query}>
        {b && (
          <>
            <PageHeading
              eyebrow={`REQUEST ${b.id.slice(0, 8).toUpperCase()}`}
              title={b.eventTitle}
              description={`${b.venue.name} · ${b.venue.buildingName}`}
              action={<Status value={b.status} />}
            />
            <div className="detail-grid">
              <div>
                <section className="panel">
                  <h2>Event information</h2>
                  <dl className="details-list">
                    <dt>Event type</dt>
                    <dd>{b.eventType}</dd>
                    <dt>Guests</dt>
                    <dd>{b.guestCount}</dd>
                    <dt>Details</dt>
                    <dd className="preserve-lines">{b.eventDetails}</dd>
                    <dt>Purpose</dt>
                    <dd className="preserve-lines">{b.purpose}</dd>
                    <dt>Contact</dt>
                    <dd>
                      {b.contactName}
                      <br />
                      {b.contactEmail}
                      <br />
                      {b.contactPhone}
                    </dd>
                    <dt>Submitted</dt>
                    <dd>{displayInstant(b.createdAt)} · Asia/Kolkata</dd>
                  </dl>
                </section>
                <section className="panel">
                  <h2>
                    <CalendarDays size={19} />
                    Schedule · {b.occurrences.length} occurrence
                    {b.occurrences.length > 1 ? "s" : ""}
                  </h2>
                  <p className="muted">
                    {b.startDate} through {b.endDate} · {b.localStartTime}–
                    {b.localEndTime} · Asia/Kolkata
                    {b.weekdays.length > 0
                      ? ` · ${b.weekdays.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d - 1]).join(", ")}`
                      : ""}
                  </p>
                  <ol className="occurrence-list">
                    {b.occurrences.map((o) => (
                      <li key={o.id}>
                        <span>{displayInstant(o.startsAt)}</span>
                        <small>until {displayTime(o.endsAt)}</small>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <aside>
                <section className="panel">
                  <h2>Request timeline</h2>
                  <ol className="timeline">
                    {b.actions.map((a) => (
                      <li key={a.id}>
                        <b>
                          {a.action.charAt(0) + a.action.slice(1).toLowerCase()}
                        </b>
                        <span>{a.actor.name}</span>
                        <small>{displayInstant(a.createdAt)}</small>
                        {a.reason && <p>{a.reason}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
                {eligible && (
                  <section className="panel">
                    <h2>
                      {account.role === "APPROVER"
                        ? "Review this request"
                        : "Manage request"}
                    </h2>
                    <p className="muted">Actions apply to the entire series.</p>
                    <div className="action-stack">
                      {account.role === "REQUESTER" &&
                        b.requesterId === account.id && (
                          <button
                            className="button danger"
                            onClick={() => {
                              setError(null);
                              setAction("CANCELLED");
                            }}
                          >
                            Cancel request
                          </button>
                        )}
                      {account.role === "APPROVER" &&
                        b.status === "PENDING" &&
                        b.requesterId !== account.id && (
                          <>
                            <button
                              className="button"
                              onClick={() => {
                                setError(null);
                                setAction("APPROVED");
                              }}
                            >
                              Approve request
                            </button>
                            <button
                              className="button danger"
                              onClick={() => {
                                setError(null);
                                setAction("REJECTED");
                              }}
                            >
                              Reject request
                            </button>
                          </>
                        )}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </QueryState>
      {action && (
        <Modal
          title={`${action === "CANCELLED" ? "Cancel" : action === "APPROVED" ? "Approve" : "Reject"} this request?`}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <form onSubmit={submit}>
            <p>
              This applies to all {b.occurrences.length} occurrences.
              {action !== "APPROVED" && " All reserved slots will be released."}
            </p>
            <Field
              label={`Reason ${action === "REJECTED" ? "(required)" : "(optional)"}`}
            >
              <textarea
                name="reason"
                rows="3"
                maxLength={500}
                required={action === "REJECTED"}
              />
            </Field>
            <FormError error={error} />
            <button
              className={`button ${action === "APPROVED" ? "" : "danger"}`}
              disabled={busy}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
