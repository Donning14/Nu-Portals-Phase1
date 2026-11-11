import type { Route } from './+types/project-detail';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function ProjectDetail({ params }: Route.ComponentProps) {
  return (
    <Page title="Project details">
      <p>Project {params.id}</p>
      <div className="cards">
        <article className="card">
          <h2>Scope</h2>
          <p>The agreed scope of work will appear here.</p>
        </article>
        <article className="card">
          <h2>Project manager</h2>
          <p>No Nu-Portals project manager is assigned.</p>
        </article>
        <article className="card">
          <h2>Assignments</h2>
          <p>No employees are assigned to this project.</p>
        </article>
        <article className="card">
          <h2>Schedule</h2>
          <p>Start date, target end date, and completion are not set.</p>
        </article>
        <article className="card">
          <h2>Updates</h2>
          <p>No project updates have been posted.</p>
        </article>
        <article className="card">
          <h2>Documents</h2>
          <p>No private project documents are attached.</p>
        </article>
      </div>
    </Page>
  );
}
