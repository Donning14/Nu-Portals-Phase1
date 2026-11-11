import type { Route } from './+types/requests';
import { Link } from 'react-router';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';
import { REQUEST_STATUSES, SERVICE_OPTIONS } from '../../shared/catalog';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function Requests() {
  return (
    <Page title="Requests">
      <p>Search quote requests by status, date, service, or assigned project manager.</p>
      <p><Link to="/app/quotes/new">Submit a quote request</Link></p>
      <form className="form filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search
          <input name="q" type="search" placeholder="Request number or title" />
        </label>
        <label>
          Status
          <select name="status" defaultValue="">
            <option value="">Any status</option>
            {REQUEST_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          From
          <input name="from" type="date" />
        </label>
        <label>
          To
          <input name="to" type="date" />
        </label>
        <label>
          Service
          <select name="service" defaultValue="">
            <option value="">Any service</option>
            {SERVICE_OPTIONS.map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
        <label>
          Assigned project manager
          <input name="projectManager" placeholder="Project manager name" />
        </label>
        <button className="btn" type="submit">Search</button>
      </form>
      <p>No requests match this search yet.</p>
    </Page>
  );
}
