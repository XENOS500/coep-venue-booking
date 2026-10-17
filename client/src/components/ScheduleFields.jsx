import { Field } from "./UI";
import { localToday, datePlus } from "../services/dates";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const initialSchedule = (venueId = "") => ({
  venueId,
  startDate: localToday(),
  endDate: localToday(),
  weekdays: [],
  localStartTime: "10:00",
  localEndTime: "11:00",
});
export function ScheduleFields({ schedule, setSchedule, venues }) {
  const recurring = schedule.recurring ?? false;
  const update = (key, value) =>
    setSchedule((s) => ({
      ...s,
      [key]: value,
      ...(key === "startDate" && !recurring ? { endDate: value } : {}),
    }));
  return (
    <>
      <Field label="Venue">
        <select
          required
          value={schedule.venueId}
          onChange={(e) => update("venueId", e.target.value)}
        >
          <option value="">Choose a venue</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.buildingName || "Building not provided"}
              {!v.eligible ? " · Setup pending" : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="segmented" aria-label="Booking frequency">
        <button
          type="button"
          aria-pressed={!recurring}
          className={!recurring ? "selected" : ""}
          onClick={() =>
            setSchedule((s) => ({
              ...s,
              recurring: false,
              endDate: s.startDate,
              weekdays: [],
            }))
          }
        >
          Single date
        </button>
        <button
          type="button"
          aria-pressed={recurring}
          className={recurring ? "selected" : ""}
          onClick={() => update("recurring", true)}
        >
          Recurring dates
        </button>
      </div>
      <div className="form-grid">
        <Field label={recurring ? "First date" : "Event date"}>
          <input
            type="date"
            min={localToday()}
            max={datePlus(localToday(), 30)}
            required
            value={schedule.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
        </Field>
        {recurring && (
          <Field label="Last date (inclusive)">
            <input
              type="date"
              min={schedule.startDate}
              max={datePlus(localToday(), 30)}
              required
              value={schedule.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </Field>
        )}
        <Field label="Start time">
          <input
            type="time"
            required
            value={schedule.localStartTime}
            onChange={(e) => update("localStartTime", e.target.value)}
          />
        </Field>
        <Field label="End time">
          <input
            type="time"
            required
            value={schedule.localEndTime}
            onChange={(e) => update("localEndTime", e.target.value)}
          />
        </Field>
      </div>
      {recurring && (
        <fieldset className="weekday-field">
          <legend>Repeat on</legend>
          <div className="weekdays">
            {days.map((day, i) => (
              <label
                key={day}
                className={schedule.weekdays.includes(i + 1) ? "checked" : ""}
              >
                <input
                  type="checkbox"
                  checked={schedule.weekdays.includes(i + 1)}
                  onChange={(e) =>
                    update(
                      "weekdays",
                      e.target.checked
                        ? [...schedule.weekdays, i + 1]
                        : schedule.weekdays.filter((d) => d !== i + 1),
                    )
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="field-note">
        All dates and times use Asia/Kolkata. Book today through{" "}
        {datePlus(localToday(), 30)}, inclusive. Same-day starts must be in the
        future.
      </p>
    </>
  );
}
export const scheduleBody = ({ recurring, ...s }) => s;
