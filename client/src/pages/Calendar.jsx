import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useQuery } from "../hooks/useQuery";
import { PageHeading, ErrorState } from "../components/UI";
import { calendarWallTime, datePlus, localToday } from "../services/dates";
export function Calendar() {
  const navigate = useNavigate(),
    [range, setRange] = useState({
      from: localToday(),
      to: datePlus(localToday(), 31),
    }),
    [venue, setVenue] = useState("");
  const query = useQuery("/calendar", range),
    venues = useQuery("/venues", { limit: 100 });
  const events = (query.result?.data || [])
    .filter((o) => !venue || o.venueId === venue)
    .map((o) => ({
      id: o.id,
      title: `${o.isOwn ? "Your " : ""}${o.status.toLowerCase()} · ${o.venue.name}`,
      start: calendarWallTime(o.startsAt),
      end: calendarWallTime(o.endsAt),
      backgroundColor:
        o.status === "APPROVED" ? "#295943" : o.isOwn ? "#ae7a25" : "#76817c",
      borderColor: "transparent",
      extendedProps: o,
    }));
  return (
    <>
      <PageHeading
        eyebrow="THE CAMPUS SCHEDULE"
        title="Venue calendar"
        description="Reserved intervals across campus. All times shown in Asia/Kolkata."
      />
      <div className="section-top">
        <div className="calendar-legend">
          <span>
            <i className="legend-dot green" />
            Approved
          </span>
          <span>
            <i className="legend-dot gray" />
            Pending
          </span>
          <span>
            <i className="legend-dot amber" />
            Your pending request
          </span>
        </div>
        <select
          aria-label="Filter calendar by venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        >
          <option value="">All venues</option>
          {venues.result?.data.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name} · {v.buildingName}
            </option>
          ))}
        </select>
      </div>
      {query.error && <ErrorState message={query.error} retry={query.reload} />}
      <section className="panel calendar-panel" aria-busy={query.loading}>
        {query.loading && (
          <div role="status" className="calendar-loading">
            Loading reservations…
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={localToday()}
          timeZone="UTC"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
          }}
          height="auto"
          firstDay={1}
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          events={query.error || query.loading ? [] : events}
          datesSet={(info) =>
            setRange({
              from: info.startStr.slice(0, 10),
              to: info.endStr.slice(0, 10),
            })
          }
          eventClick={(info) => {
            const id = info.event.extendedProps.bookingId;
            if (id) navigate(`/bookings/${id}`);
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
        />
      </section>
      <p className="field-note">
        Pending and approved requests reserve time. Private event and contact
        information is available only to the requester and currently assigned
        approvers.
      </p>
    </>
  );
}
