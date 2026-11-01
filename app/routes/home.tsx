import { Link } from 'react-router';
import { Shell } from '../components/Shell';
import type { Route } from "./+types/home";
import { requireRole } from "../shared/auth";

const steps = [
  ['01', 'Ideation', 'Identify valuable AI opportunities'],
  ['02', 'Discovery', 'Understand workflows, data and outcomes'],
  ['03', 'Design & Build', 'Develop secure agents and integrations'],
  ['04', 'Deployment', 'Test, launch and enable adoption'],
  ['05', 'Support', 'Maintain, monitor and troubleshoot'],
  ['06', 'Optimization', 'Improve reliability and results'],
] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, userId } = await requireRole(request, context);
  return { role, userId };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <div>Home — Role: {loaderData.role}</div>;
}
export default function Home() {
  return (
    <Shell>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Intelligent automation. Real business outcomes.</p>
          <h1>
            <span className="hero-accent">From AI idea</span>
            <span className="hero-title">to lasting business impact.</span>
          </h1>
          <p className="hero-lead">
            We help organizations discover opportunities, design and build AI agents, deploy them into real
            workflows, and support them long after launch.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/contact">
              Start a conversation
            </Link>
            <Link className="btn secondary" to="/services">
              Explore services
            </Link>
          </div>
        </div>
      </section>
      <section className="page">
        <div className="container">
          <h2>Full-lifecycle AI Agent services</h2>
          <p>Deployment is a milestone. Support is a commitment.</p>
          <div className="cards cards-home">
            {steps.map(([n, title, body]) => (
              <article className="card" key={n}>
                <span className="eyebrow">{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
