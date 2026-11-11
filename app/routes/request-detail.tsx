import type { Route } from './+types/request-detail';
import { Link } from 'react-router';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function RequestDetail({ params }: Route.ComponentProps) {
  return (
    <Page title="Request details">
      <p>Request {params.id}</p>
      <div className="cards">
        <article className="card">
          <h2>Description</h2>
          <p>The request description will appear here when this request is loaded.</p>
        </article>
        <article className="card">
          <h2>Status</h2>
          <p>No status has been recorded for this request.</p>
        </article>
        <article className="card">
          <h2>Quote</h2>
          <p>No quote has been issued. <Link to="/app/quotes/new">Start a quote request</Link>.</p>
        </article>
        <article className="card">
          <h2>Project manager</h2>
          <p>No Nu-Portals project manager is assigned.</p>
        </article>
        <article className="card">
          <h2>Activity history</h2>
          <p>No activity has been recorded.</p>
        </article>
      </div>
    </Page>
  );
}
