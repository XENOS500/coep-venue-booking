import { useState } from "react";
import { Plus, Pencil, Settings2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { api, post } from "../services/api";
import { useQuery } from "../hooks/useQuery";
import {
  PageHeading,
  QueryState,
  Empty,
  Modal,
  Field,
  FormError,
  Pagination,
  Loading,
  ErrorState,
} from "../components/UI";
function VenueEditor({ venue, onClose, onSaved }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...data,
      capacity: data.capacity ? Number(data.capacity) : null,
      isActive: data.isActive === "on",
      bookingEnabled: data.bookingEnabled === "on",
    };
    for (const key of [
      "buildingName",
      "floor",
      "venueType",
      "features",
      "allowedUses",
      "imageUrl",
      "openingTime",
      "closingTime",
    ])
      body[key] = body[key]?.trim() || null;
    try {
      if (venue.id) await api.patch(`/venues/${venue.id}`, body);
      else await post("/venues", body);
      toast.success("Venue saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={venue.id ? `Edit ${venue.name}` : "Add a venue"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <Field label="Venue name">
          <input
            name="name"
            defaultValue={venue.name}
            required
            maxLength={160}
          />
        </Field>
        <div className="form-grid">
          <Field label="Building">
            <input
              name="buildingName"
              defaultValue={venue.buildingName || ""}
              maxLength={200}
            />
          </Field>
          <Field label="Floor">
            <input
              name="floor"
              defaultValue={venue.floor || ""}
              maxLength={160}
            />
          </Field>
          <Field label="Venue type">
            <input
              name="venueType"
              defaultValue={venue.venueType || ""}
              maxLength={160}
            />
          </Field>
          <Field label="Verified capacity">
            <input
              type="number"
              name="capacity"
              defaultValue={venue.capacity || ""}
              min="1"
              max="100000"
            />
          </Field>
          <Field label="Opening time · Asia/Kolkata">
            <input
              name="openingTime"
              type="time"
              defaultValue={venue.openingTime || ""}
            />
          </Field>
          <Field label="Closing time · Asia/Kolkata">
            <input
              name="closingTime"
              type="time"
              defaultValue={venue.closingTime || ""}
            />
          </Field>
        </div>
        <Field
          label="Features"
          hint="Preserve negative features such as No Wifi."
        >
          <textarea
            name="features"
            defaultValue={venue.features || ""}
            maxLength={2000}
          />
        </Field>
        <Field label="Permitted uses">
          <textarea
            name="allowedUses"
            defaultValue={venue.allowedUses || ""}
            maxLength={2000}
          />
        </Field>
        <Field
          label="Verified image URL"
          hint="Use an authorized, directly embeddable HTTPS image URL. Source links are preserved separately."
        >
          <input
            name="imageUrl"
            type="url"
            defaultValue={venue.imageUrl || ""}
          />
        </Field>
        <label className="checkbox-label">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={venue.isActive ?? true}
          />
          Venue is active
        </label>
        <label className="checkbox-label">
          <input
            name="bookingEnabled"
            type="checkbox"
            defaultChecked={venue.bookingEnabled ?? false}
          />
          Capacity and opening hours verified; enable bookings
        </label>
        <p className="field-note">
          At least one active assigned approver is also required to accept
          requests. Changes that invalidate active reservations are blocked.
        </p>
        <FormError error={error} />
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Save venue"}
        </button>
      </form>
    </Modal>
  );
}
export function ManageVenues() {
  const [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [search, setSearch] = useState("");
  const query = useQuery("/venues", { page, limit: 20, search });
  return (
    <>
      <PageHeading
        eyebrow="CAMPUS OPERATIONS"
        title="Manage venues"
        description="Maintain accurate spaces, capacities and opening hours."
        action={
          <button className="button" onClick={() => setEditing({})}>
            <Plus size={17} />
            Add venue
          </button>
        }
      />
      <label className="search-field admin-search">
        <Settings2 size={18} />
        <input
          placeholder="Find a venue…"
          aria-label="Find a venue to manage"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <QueryState query={query}>
        {query.result?.data.length ? (
          <div className="panel table-panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Capacity</th>
                  <th>Opening hours</th>
                  <th>Booking status</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {query.result.data.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <b>{v.name}</b>
                      <small>{v.buildingName}</small>
                    </td>
                    <td>{v.capacity || "Not provided"}</td>
                    <td>
                      {v.openingTime && v.closingTime
                        ? `${v.openingTime}–${v.closingTime}`
                        : "Not configured"}
                      <small>Asia/Kolkata</small>
                    </td>
                    <td>
                      <span
                        className={`eligibility ${v.eligible ? "ready" : ""}`}
                      >
                        {!v.isActive
                          ? "Inactive"
                          : v.eligible
                            ? "Bookable"
                            : "Setup pending"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${v.name}`}
                        onClick={() => setEditing(v)}
                      >
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No venues found">
            Adjust your search or add a venue.
          </Empty>
        )}
        <Pagination pagination={query.result?.pagination} onChange={setPage} />
      </QueryState>
      {editing && (
        <VenueEditor
          venue={editing}
          onClose={() => setEditing(null)}
          onSaved={query.reload}
        />
      )}
    </>
  );
}
function AssignmentEditor({ venueId, directory }) {
  const query = useQuery(`/venues/${venueId}/approvers`);
  return (
    <QueryState query={query}>
      {query.result && (
        <AssignmentForm
          key={`${venueId}-${JSON.stringify(query.result.data)}`}
          venueId={venueId}
          current={query.result.data}
          directory={directory}
          onSaved={query.reload}
        />
      )}
    </QueryState>
  );
}
function AssignmentForm({ venueId, current, directory, onSaved }) {
  const [selected, setSelected] = useState(
      current
        .filter((a) => a.approver.isActive && a.approver.role === "APPROVER")
        .map((a) => a.approverId),
    ),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put(`/venues/${venueId}/approvers`, { approverIds: selected });
      toast.success("Approver assignments saved.");
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <h2>Assigned approvers</h2>
      <p className="muted">
        Any currently assigned active approver can decide a pending request.
        Existing decisions remain in history.
      </p>
      {directory.length ? (
        <div className="approver-list">
          {directory.map((a) => (
            <label key={a.id} className="approver-option">
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, a.id]
                      : s.filter((id) => id !== a.id),
                  )
                }
              />
              <span className="avatar">{a.name[0]}</span>
              <span>
                <b>{a.name}</b>
                <small>{a.email}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <Empty title="No active approvers">
          Provision an APPROVER account through the trusted maintenance script.
        </Empty>
      )}
      {!selected.length && (
        <div className="notice">
          Without an active approver, this venue cannot accept new requests.
          Existing holds remain reserved.
        </div>
      )}
      <FormError error={error} />
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save assignments"}
      </button>
    </form>
  );
}
export function AssignApprovers() {
  const [directoryPage, setDirectoryPage] = useState(1);
  const venues = useQuery("/venues", { limit: 100 }),
    directory = useQuery("/approvers", { page: directoryPage, limit: 50 }),
    [venueId, setVenueId] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="THE RIGHT PEOPLE, THE RIGHT SPACES"
        title="Assign approvers"
        description="Connect each venue with the people responsible for its requests."
      />
      <div className="detail-grid">
        <section className="panel">
          <h2>
            <Users size={19} />
            Venue assignments
          </h2>
          <QueryState query={venues}>
            <Field label="Select a venue">
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              >
                <option value="">Choose a venue</option>
                {venues.result?.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.buildingName}
                  </option>
                ))}
              </select>
            </Field>
          </QueryState>
          {directory.error ? (
            <ErrorState message={directory.error} retry={directory.reload} />
          ) : !directory.result ? (
            <Loading />
          ) : (
            <>
              {venueId ? (
                <AssignmentEditor
                  key={venueId}
                  venueId={venueId}
                  directory={directory.result?.data || []}
                />
              ) : (
                <Empty title="Choose a venue">
                  View and update its approver assignments here.
                </Empty>
              )}
              <Pagination
                pagination={directory.result?.pagination}
                onChange={setDirectoryPage}
              />
            </>
          )}
        </section>
        <aside className="panel">
          <p className="eyebrow">HOW ASSIGNMENTS WORK</p>
          <h2>
            Clear responsibility.
            <br />
            Scoped access.
          </h2>
          <p className="muted">
            Approvers can see private requests only for their currently assigned
            venues. Removing an assignment removes that access immediately.
          </p>
          <p className="muted">
            Only existing active APPROVER accounts can be assigned. Account
            creation and access changes are available in Manage accounts.
          </p>
        </aside>
      </div>
    </>
  );
}
