import type { Route } from './+types/quote-detail';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function QuoteDetail({ params }: Route.ComponentProps) {
  return (
    <Page title="Quote details">
      <p>Quote {params.id}</p>
      <div className="cards">
        <article className="card">
          <h2>Scope</h2>
          <p>The quoted scope summary will appear here.</p>
        </article>
        <article className="card">
          <h2>Price</h2>
          <p>No price has been issued.</p>
        </article>
        <article className="card">
          <h2>Version</h2>
          <p>Version 1</p>
        </article>
        <article className="card">
          <h2>Expiry</h2>
          <p>No expiration date is set.</p>
        </article>
        <article className="card">
          <h2>Acceptance status</h2>
          <p>Draft. This quote has not been accepted.</p>
        </article>
      </div>
    </Page>
  );
}
