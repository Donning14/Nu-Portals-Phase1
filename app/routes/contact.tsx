import type { Route } from "./+types/contact";
import { requireRole } from "../shared/auth";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, userId } = await requireRole(request, context);
  return { role, userId };
}

export default function Contact({ loaderData }: Route.ComponentProps) {
  const { role } = loaderData;

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Contact</h1>
      <p style={{ color: "#666" }}>
        Signed in as <strong>{role}</strong>
      </p>
      <div style={{ marginTop: "2rem" }}>
        <h2>Contact Us</h2>
        <p>This page is accessible to all roles: executive, employee, customer, and user.</p>
      </div>
    </div>
  );
}
