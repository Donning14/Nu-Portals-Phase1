import type { Route } from './+types/admin-customers';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';
import { LIFECYCLE_STATUSES } from '../../shared/catalog';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function AdminCustomers() {
  return (
    <Page title="Customers">
      <p>Review customer lifecycle, organization, account manager, and engagements. Changes are not saved yet.</p>
      <form className="form filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Organization
          <input name="organization" placeholder="Organization name" />
        </label>
        <label>
          Lifecycle
          <select name="lifecycle" defaultValue="">
            <option value="">Any lifecycle</option>
            {LIFECYCLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Account manager
          <input name="accountManager" placeholder="Account manager name" />
        </label>
        <label>
          Engagement
          <input name="engagement" placeholder="Request, quote, or project" />
        </label>
        <button className="btn" type="submit">Search</button>
      </form>
      <p>No customer organizations match this search yet.</p>
    </Page>
  );
}
