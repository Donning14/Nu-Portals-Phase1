import type { Route } from './+types/quote-new';
import { Page } from '../components/Shell';
import { requireRole } from '../../shared/auth';
import { SERVICE_OPTIONS } from '../../shared/catalog';

export async function loader({ request, context }: Route.LoaderArgs) {
  return requireRole(request, context);
}

export default function NewQuoteRequest() {
  return (
    <Page title="Request a quote">
      <p>Describe the work you want priced. Submitting this form does not create a request yet.</p>
      <form className="form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Service
          <select name="service" required defaultValue="">
            <option value="" disabled>Select a service</option>
            {SERVICE_OPTIONS.map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
        <label>
          Title
          <input name="title" required maxLength={150} placeholder="Short name for this request" />
        </label>
        <label>
          Scope
          <textarea name="scope" required maxLength={4000} placeholder="What should the work include?" />
        </label>
        <label>
          Timeline
          <input name="timeline" type="date" required aria-label="Requested start date" />
        </label>
        <label>
          Budget
          <input name="budget" required maxLength={80} placeholder="Example: 15000-25000" />
        </label>
        <label>
          <input name="existingWork" type="checkbox" /> This request is for work already underway
        </label>
        <button className="btn" type="submit">Submit quote request</button>
      </form>
    </Page>
  );
}
