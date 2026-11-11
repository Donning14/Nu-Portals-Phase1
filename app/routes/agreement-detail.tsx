import type { Route } from './+types/agreement-detail';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function AgreementDetail({ params }: Route.ComponentProps) {
  return (
    <Page title="Agreement details">
      <p>Agreement {params.id}</p>
      <div className="cards">
        <article className="card">
          <h2>Document</h2>
          <p>The signed file stays in private storage. No document is attached to this agreement.</p>
        </article>
        <article className="card">
          <h2>Signature date</h2>
          <p>Not signed.</p>
        </article>
        <article className="card">
          <h2>Verification status</h2>
          <p>Not verified.</p>
        </article>
      </div>
    </Page>
  );
}
