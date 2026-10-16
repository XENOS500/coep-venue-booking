import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, SearchCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "../hooks/useQuery";
import { post } from "../services/api";
import { PageHeading, Field, FormError, QueryState } from "../components/UI";
import {
  ScheduleFields,
  initialSchedule,
  scheduleBody,
} from "../components/ScheduleFields";
import { OccurrencePreview } from "../components/OccurrencePreview";
const eventTypes = [
  "Lecture",
  "Workshop",
  "Seminar",
  "Meeting",
  "Hands-on session",
  "Other",
];
export function BookingForm({ availabilityOnly = false }) {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    { account } = useAuth();
  const query = useQuery("/venues", { limit: 100 });
  const [schedule, setRawSchedule] = useState(() =>
    initialSchedule(params.get("venue") || ""),
  );
  const [preview, setPreview] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const [eventType, setEventType] = useState("Lecture");
  const setSchedule = (update) => {
    setPreview(null);
    setError(null);
    setRawSchedule(update);
  };
  async function check() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await post("/availability/check", scheduleBody(schedule)));
    } catch (e) {
      setError(e);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (availabilityOnly) return check();
    setBusy(true);
    setError(null);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...scheduleBody(schedule),
      ...fields,
      guestCount: Number(fields.guestCount),
      eventType: eventType === "Other" ? fields.otherEventType : eventType,
    };
    delete body.otherEventType;
    try {
      const booking = await post("/bookings", body);
      toast.success(
        "Booking request submitted. Your slots are held pending approval.",
      );
      navigate(`/bookings/${booking.id}`);
    } catch (e) {
      setError(e);
      if (e.response?.status === 409) setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  const chosenVenue = query.result?.data.find((v) => v.id === schedule.venueId);
  return (
    <>
      <PageHeading
        eyebrow={
          availabilityOnly
            ? "PLAN WITH CONFIDENCE"
            : "BRING YOUR IDEAS TOGETHER"
        }
        title={availabilityOnly ? "Check availability" : "Request a venue"}
        description={
          availabilityOnly
            ? "Find an open slot before you plan your event."
            : "Tell us what you’re planning. We’ll help you find the space."
        }
      />
      <QueryState query={query}>
        <form onSubmit={submit} className="detail-grid booking-grid">
          <div>
            <section className="panel">
              <div className="numbered-heading">
                <span>01</span>
                <div>
                  <h2>Choose your space & time</h2>
                  <p className="muted">Single event or a recurring series.</p>
                </div>
              </div>
              <ScheduleFields
                schedule={schedule}
                setSchedule={setSchedule}
                venues={query.result?.data || []}
              />
              {chosenVenue && (
                <div className="notice">
                  <span>
                    {chosenVenue.capacity
                      ? `Capacity: ${chosenVenue.capacity}. `
                      : "Capacity not provided. "}
                    {chosenVenue.openingTime
                      ? `Open ${chosenVenue.openingTime}–${chosenVenue.closingTime}. `
                      : "Opening hours not configured. "}
                    {!chosenVenue.eligible &&
                      "Not accepting requests until setup is verified."}
                  </span>
                </div>
              )}
              <button
                type={availabilityOnly ? "submit" : "button"}
                className="button secondary"
                disabled={busy || !schedule.venueId}
                onClick={availabilityOnly ? undefined : check}
              >
                <SearchCheck size={17} />
                {busy ? "Checking…" : "Check availability"}
              </button>
            </section>
            {!availabilityOnly && (
              <>
                <section className="panel">
                  <div className="numbered-heading">
                    <span>02</span>
                    <div>
                      <h2>About your event</h2>
                      <p className="muted">
                        Help the venue approver understand your request.
                      </p>
                    </div>
                  </div>
                  <Field label="Event title">
                    <input
                      name="eventTitle"
                      required
                      maxLength={160}
                      placeholder="e.g. Design thinking workshop"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Event type">
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                      >
                        {eventTypes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Expected guests"
                      hint={
                        chosenVenue?.capacity
                          ? `Up to ${chosenVenue.capacity} guests`
                          : "Venue capacity must be verified"
                      }
                    >
                      <input
                        name="guestCount"
                        type="number"
                        required
                        min="1"
                        max={chosenVenue?.capacity || undefined}
                        placeholder="Number of guests"
                      />
                    </Field>
                  </div>
                  {eventType === "Other" && (
                    <Field label="Describe the event type">
                      <input name="otherEventType" maxLength={80} required />
                    </Field>
                  )}
                  <Field label="Event details">
                    <textarea
                      name="eventDetails"
                      rows="4"
                      required
                      maxLength={2000}
                      placeholder="Outline your event and activities…"
                    />
                  </Field>
                  <Field label="Purpose">
                    <textarea
                      name="purpose"
                      rows="2"
                      required
                      maxLength={500}
                      placeholder="What do you hope to achieve?"
                    />
                  </Field>
                </section>
                <section className="panel">
                  <div className="numbered-heading">
                    <span>03</span>
                    <div>
                      <h2>Event contact</h2>
                      <p className="muted">
                        Contact information for this event.
                      </p>
                    </div>
                  </div>
                  <Field label="Contact name">
                    <input
                      name="contactName"
                      defaultValue={account.name}
                      required
                      maxLength={120}
                      autoComplete="name"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Contact email">
                      <input
                        name="contactEmail"
                        type="email"
                        defaultValue={account.email}
                        required
                        maxLength={254}
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Contact phone">
                      <input
                        name="contactPhone"
                        type="tel"
                        required
                        minLength={7}
                        maxLength={25}
                        autoComplete="tel"
                        placeholder="+91 98765 43210"
                      />
                    </Field>
                  </div>
                </section>
              </>
            )}
            <FormError error={error} />
            {!availabilityOnly && (
              <div className="form-actions">
                <p className="muted">
                  Pending requests hold all slots until a decision or
                  cancellation.
                </p>
                <button
                  className="button"
                  disabled={busy || !chosenVenue?.eligible}
                >
                  {busy ? "Submitting…" : "Submit request"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
          <aside className="panel sticky-panel">
            <p className="eyebrow">SCHEDULE PREVIEW</p>
            <OccurrencePreview preview={preview} />
          </aside>
        </form>
      </QueryState>
    </>
  );
}
