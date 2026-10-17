import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  Users,
  Clock3,
  MapPin,
  Info,
} from "lucide-react";
import { useQuery } from "../hooks/useQuery";
import { useAuth } from "../context/AuthContext";
import { PageHeading, QueryState, Empty, Pagination } from "../components/UI";
import { VenueCard, VenueImage, value } from "../components/VenueCard";
export function Catalog() {
  const [filters, setFilters] = useState({
    search: "",
    building: "",
    type: "",
    capacity: "",
    page: 1,
  });
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== ""),
  );
  const query = useQuery("/venues", params);
  const update = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: 1 }));
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR NEXT SPACE"
        title="Venue catalog"
        description="From small discussions to big ideas. Find a space that fits."
      />
      <div className="catalog-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search venues"
            placeholder="Search venues or buildings…"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by building"
          value={filters.building}
          onChange={(e) => update("building", e.target.value)}
        >
          <option value="">All buildings</option>
          {query.result?.filters?.buildings.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => update("type", e.target.value)}
        >
          <option value="">All venue types</option>
          {query.result?.filters?.types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          className="capacity-filter"
          aria-label="Minimum capacity"
          type="number"
          min="1"
          placeholder="Min. guests"
          value={filters.capacity}
          onChange={(e) => update("capacity", e.target.value)}
        />
      </div>
      <div className="section-top">
        <p>
          <b>{query.result?.pagination.total ?? "—"}</b> venues found
        </p>
        <span className="muted">Real spaces. Across campus.</span>
      </div>
      <QueryState query={query}>
        {query.result?.data.length ? (
          <div className="venue-grid">
            {query.result.data.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>
        ) : (
          <Empty title="No matching venues">
            Try a different building, venue type or capacity.
          </Empty>
        )}
        <Pagination
          pagination={query.result?.pagination}
          onChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      </QueryState>
    </>
  );
}
export function VenueDetails() {
  const { id } = useParams(),
    query = useQuery(`/venues/${id}`),
    { account } = useAuth();
  const v = query.result?.data;
  return (
    <>
      <Link className="back-link" to="/venues">
        <ArrowLeft size={16} />
        Back to venues
      </Link>
      <QueryState query={query}>
        {v && (
          <>
            <PageHeading
              eyebrow={value(v.venueType)}
              title={v.name}
              description={`${value(v.buildingName)} · ${value(v.floor)}`}
              action={
                account.role === "REQUESTER" && v.eligible ? (
                  <Link className="button" to={`/bookings/new?venue=${id}`}>
                    Request this venue
                    <ArrowUpRight size={17} />
                  </Link>
                ) : null
              }
            />
            <div className="detail-grid">
              <div>
                <VenueImage venue={v} className="detail-image" />
                <section className="panel">
                  <h2>About this space</h2>
                  <dl className="details-list">
                    <dt>Features</dt>
                    <dd>{value(v.features)}</dd>
                    <dt>Permitted uses</dt>
                    <dd>{value(v.allowedUses)}</dd>
                    <dt>Room reference (source)</dt>
                    <dd>{value(v.roomReferenceRaw)}</dd>
                    <dt>Source serial</dt>
                    <dd>{v.sourceSerial ?? "Manually created"}</dd>
                  </dl>
                  {v.imageSourceUrl && (
                    <a
                      className="text-link"
                      href={v.imageSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                        View original image source (may require access)
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                  {v.imageSourceLabel && !v.imageSourceUrl && (
                    <p className="muted">
                      Unresolved image label: {v.imageSourceLabel}
                    </p>
                  )}
                </section>
              </div>
              <aside>
                <section className="panel">
                  <h2>Space at a glance</h2>
                  <div className="glance-row">
                    <Users />
                    <div>
                      <b>
                        {v.capacity ? `${v.capacity} guests` : "Not provided"}
                      </b>
                      <small>Verified capacity</small>
                    </div>
                  </div>
                  <div className="glance-row">
                    <MapPin />
                    <div>
                      <b>{value(v.floor)}</b>
                      <small>{value(v.buildingName)}</small>
                    </div>
                  </div>
                  <div className="glance-row">
                    <Clock3 />
                    <div>
                      <b>
                        {v.openingTime && v.closingTime
                          ? `${v.openingTime}–${v.closingTime}`
                          : "Not configured"}
                      </b>
                      <small>Asia/Kolkata · opening hours</small>
                    </div>
                  </div>
                  <div className={`notice ${v.eligible ? "positive" : ""}`}>
                    <Info size={18} />
                    <span>
                      {v.eligible
                        ? "Ready for booking requests. All requests require approval."
                        : "This venue is not accepting requests. Capacity, opening hours, activation and an active approver must be configured."}
                    </span>
                  </div>
                  <Link
                    className="button secondary full"
                    to={`/availability?venue=${id}`}
                  >
                    Check availability
                  </Link>
                </section>
                {v.reviewNotes.length > 0 && (
                  <section className="panel">
                    <h3>Catalog verification</h3>
                    <ul className="review-notes">
                      {v.reviewNotes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
