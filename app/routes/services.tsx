import { Page } from '../components/Shell';

const services = [
  ['Ideation & Discovery', 'Identify opportunities and validate use cases.'],
  ['Development & Integration', 'Build AI agents, APIs and connected workflows.'],
  ['Deployment', 'Test, document and launch solutions.'],
  ['Support & Optimization', 'Monitor, troubleshoot and continually improve.'],
] as const;

export default function Services() {
  return (
    <Page title="AI Agent Services">
      <div className="cards">
        {services.map(([title, body]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </Page>
  );
}
