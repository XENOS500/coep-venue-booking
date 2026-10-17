import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api, post } from "../services/api";
import { useQuery } from "../hooks/useQuery";
import { PageHeading, QueryState, Field, FormError, Modal, Pagination, Empty } from "../components/UI";

export function ManageAccounts() {
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery("/accounts", { page, limit: 20 });
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (editor.id) await api.patch(`/accounts/approvers/${editor.id}`, { password: data.password });
      else await post("/accounts/approvers", data);
      toast.success(editor.id ? "Password reset. Previous sessions have ended." : "Approver account saved. Share credentials privately.");
      setEditor(null); query.reload();
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  async function toggle(account) {
    setBusy(true); setError(null);
    try {
      await api.patch(`/accounts/approvers/${account.id}`, { isActive: !account.isActive });
      toast.success(account.isActive ? "Approver access disabled." : "Approver access enabled.");
      query.reload();
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Manage accounts" description="Choose who can review venue requests. Only you can grant Approver access."
      action={<button className="button" disabled={busy} onClick={() => { setEditor({}); setError(null); }}>Add approver</button>} />
    <section className="panel">
      <p className="muted">Create an Approver with a college email, or promote an existing Requester. Promotion replaces their password and ends existing sessions. Your Admin login remains unchanged.</p>
      <p><Link className="text-link" to="/admin/approvers">Assign approvers to venues</Link></p>
      <p className="muted">After creating an account, assign its venues. Before disabling an approver, assign a replacement for any pending requests.</p>
      {!editor && <FormError error={error} />}
      <QueryState query={query}>
        {query.result?.data.length ? <div className="table-scroll"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Actions</th></tr></thead>
          <tbody>{query.result?.data.map(account => <tr key={account.id}>
            <td>{account.name}</td><td>{account.email}</td><td>{account.isActive ? "Active" : "Disabled"}</td>
            <td><div className="account-actions">
              <button className="button secondary" disabled={busy} onClick={() => { setEditor(account); setError(null); }} aria-label={`Reset password for ${account.email}`}>Reset password</button>
              <button className="button secondary" disabled={busy} onClick={() => toggle(account)} aria-label={`${account.isActive ? "Disable" : "Enable"} ${account.email}`}>{account.isActive ? "Disable" : "Enable"}</button>
            </div></td>
          </tr>)}</tbody>
        </table></div> : <Empty title="No approvers yet">Add the college authorities who will review booking requests.</Empty>}
        <Pagination pagination={query.result?.pagination} onChange={setPage} />
      </QueryState>
    </section>
    {editor && <Modal title={editor.id ? `Reset password: ${editor.name}` : "Create or promote an approver"} onClose={() => { if (!busy) setEditor(null); }}>
      <form onSubmit={save}>
        {!editor.id && <>
          <Field label="Name"><input name="name" required maxLength={120} /></Field>
          <Field label="College email"><input name="email" type="email" placeholder="authority@coeptech.ac.in" required maxLength={254} /></Field>
          <p className="muted">If this email belongs to a Requester, saving grants them Approver access and replaces their password.</p>
        </>}
        <Field label="New password" hint="At least 12 characters. Deliver it privately to this authority."><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></Field>
        <FormError error={error} />
        <button className="button" disabled={busy}>{busy ? "Saving…" : editor.id ? "Reset password" : "Grant Approver access"}</button>
      </form>
    </Modal>}
  </>;
}
