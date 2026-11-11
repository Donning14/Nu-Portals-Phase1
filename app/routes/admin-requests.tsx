import type { Route } from './+types/admin-requests';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';
import { REQUEST_STATUSES } from '../../shared/catalog';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function AdminRequests() {
  return (
    <Page title="Review requests">
      <p>Assign a Nu-Portals project manager, qualify the request, then approve or reject it. These actions are not saved yet.</p>
      <form className="form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Request
          <input name="requestId" required placeholder="Request number" />
        </label>
        <label>
          Assignment
          <input name="projectManager" required placeholder="Nu-Portals project manager" />
        </label>
        <label>
          Qualification
          <select name="qualification" required defaultValue="">
            <option value="" disabled>Select a qualification</option>
            {REQUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <div>
          <button className="btn" type="submit" name="decision" value="approved">Approve</button>
          {' '}
          <button className="btn secondary" type="submit" name="decision" value="rejected">Reject</button>
        </div>
      </form>
      <p>No requests are waiting for review.</p>
    </Page>
  );
}
