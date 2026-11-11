import type { Route } from './+types/projects';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';
import { PROJECT_STATUSES, SERVICE_OPTIONS } from '../../shared/catalog';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function Projects() {
  return (
    <Page title="Projects">
      <p>Find projects by status, service, customer, or project manager.</p>
      <form className="form filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search
          <input name="q" type="search" placeholder="Project number or name" />
        </label>
        <label>
          Status
          <select name="status" defaultValue="">
            <option value="">Any status</option>
            {PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Service
          <select name="service" defaultValue="">
            <option value="">Any service</option>
            {SERVICE_OPTIONS.map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
        <label>
          Customer
          <input name="customer" placeholder="Customer or organization" />
        </label>
        <label>
          Project manager
          <input name="projectManager" placeholder="Project manager name" />
        </label>
        <button className="btn" type="submit">Search</button>
      </form>
      <p>No projects match this search yet.</p>
    </Page>
  );
}
