import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  ClipboardList,
  SearchCheck,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "../hooks/useQuery";
import { PageHeading, QueryState, Status, Empty } from "../components/UI";
import { VenueCard } from "../components/VenueCard";
import { localToday, datePlus, displayInstant } from "../services/dates";
function RequestSummary({ account }) {
  const query = useQuery("/bookings", {
    limit: 4,
    ...(account.role === "APPROVER" ? { status: "PENDING" } : {}),
  });
  return (
    <section className="panel">
      <div className="section-top">
        <h2>
          {account.role === "REQUESTER"
            ? "Recent requests"
            : "Awaiting your review"}
        </h2>
        <Link
          className="text-link"
          to={
            account.role === "REQUESTER" ? "/my-bookings" : "/approvals/pending"
          }
        >
          View all
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <QueryState query={query}>
        {query.result?.data.length ? (
          query.result.data.map((b) => (
            <Link className="request-row" to={`/bookings/${b.id}`} key={b.id}>
              <span className="request-icon">
                <ClipboardList size={19} />
              </span>
              <div>
                <b>{b.eventTitle}</b>
                <small>
                  {b.venue.name} · {displayInstant(b.occurrences[0].startsAt)}
                </small>
              </div>
              <Status value={b.status} />
              <ArrowUpRight size={17} />
            </Link>
          ))
        ) : (
          <Empty title="No requests yet">
            {account.role === "REQUESTER"
              ? "Your next campus event starts with a venue."
              : "No pending requests for your assigned venues."}
          </Empty>
        )}
      </QueryState>
    </section>
  );
}
export function Dashboard() {
  const { account } = useAuth(),
    catalog = useQuery("/venues", { limit: 3 });
  const occupancy = useQuery("/calendar", {
    from: localToday(),
    to: datePlus(localToday(), 31),
  });
  const name = account.name.split(" ")[0];
  return (
    <>
      <PageHeading
        eyebrow="YOUR CAMPUS WORKSPACE"
        title={`Welcome, ${name}.`}
        description="A little planning. A lot of possibilities."
        action={
          <span className="date-chip">
            <CalendarDays size={16} />
            {new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "long",
            }).format(new Date())}
          </span>
        }
      />
      <section className="hero-banner">
        <div>
          <p className="eyebrow">SPACES THAT BRING US TOGETHER</p>
          <h2>
            Make room for
            <br />
            <i>your next big idea.</i>
          </h2>
          <p>
            Discover campus venues, find your time,
            <br />
            and get your plans moving.
          </p>
          <Link className="button light" to="/venues">
            Explore venues
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hero-architecture" aria-hidden="true">
          <div className="arch arch-one" />
          <div className="arch arch-two" />
          <div className="arch arch-three" />
          <span>
            COEP
            <br />
            SPACES
          </span>
        </div>
        <span className="hero-bottom-label">
          A CAMPUS FULL OF POSSIBILITIES ↗
        </span>
      </section>
      <div className="stat-grid">
        <Link to="/venues" className="stat-card">
          <span className="stat-icon">
            <Building2 />
          </span>
          <div>
            <small>Campus venues</small>
            <b>{catalog.result?.pagination.total ?? "—"}</b>
            <span>Explore the complete catalog</span>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/calendar" className="stat-card">
          <span className="stat-icon amber">
            <CalendarDays />
          </span>
          <div>
            <small>Reserved occurrences</small>
            <b>{occupancy.result?.data.length ?? "—"}</b>
            <span>Across the next 31 calendar dates</span>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link to="/availability" className="stat-card">
          <span className="stat-icon blue">
            <SearchCheck />
          </span>
          <div>
            <small>Plan your next event</small>
            <b className="stat-text">Find a time</b>
            <span>Check live venue availability</span>
          </div>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      {account.role !== "ADMIN" && <RequestSummary account={account} />}
      <div className="section-top spaced">
        <div>
          <p className="eyebrow">A PLACE FOR EVERY PLAN</p>
          <h2>Discover campus spaces</h2>
        </div>
        <Link className="text-link" to="/venues">
          View catalog
          <ArrowRight size={17} />
        </Link>
      </div>
      <QueryState query={catalog}>
        {catalog.result?.data.length ? (
          <div className="venue-grid">
            {catalog.result.data.map((v) => (
              <VenueCard venue={v} key={v.id} />
            ))}
          </div>
        ) : (
          <Empty title="The catalog is waiting">
            Import the institution’s venue workbook to get started.
          </Empty>
        )}
      </QueryState>
      {occupancy.error && (
        <p className="field-note" role="status">
          Calendar summary unavailable. Visit Calendar to retry.
        </p>
      )}
    </>
  );
}
