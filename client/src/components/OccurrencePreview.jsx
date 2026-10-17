import { CheckCircle2, Clock3 } from "lucide-react";
import { displayInstant, displayTime } from "../services/dates";
export function OccurrencePreview({ preview }) {
  if (!preview)
    return (
      <div className="preview-placeholder">
        <Clock3 size={32} />
        <h3>Your schedule, at a glance</h3>
        <p>
          Choose a venue and schedule, then check availability to preview every
          occurrence.
        </p>
      </div>
    );
  return (
    <>
      <div className={`notice ${preview.available ? "positive" : ""}`}>
        <CheckCircle2 size={20} />
        <span>
          {preview.available
            ? "These times are currently available."
            : "This schedule has reserved intervals."}
        </span>
      </div>
      <p className="muted">
        {preview.occurrences.length} occurrence
        {preview.occurrences.length !== 1 ? "s" : ""} · Asia/Kolkata
      </p>
      <ol className="occurrence-list">
        {preview.occurrences.map((o) => (
          <li key={o.startsAt}>
            <span>{displayInstant(o.startsAt)}</span>
            <small>until {displayTime(o.endsAt)}</small>
          </li>
        ))}
      </ol>
      {preview.conflicts.length > 0 && (
        <div className="alert">
          <div>
            <b>Reserved intervals</b>
            <ul>
              {preview.conflicts.map((c, i) => (
                <li key={i}>
                  {displayInstant(c.startsAt)} – {displayTime(c.endsAt)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="field-note">
        Availability is a preview. Your times are reserved only after the
        request is submitted successfully.
      </p>
    </>
  );
}
