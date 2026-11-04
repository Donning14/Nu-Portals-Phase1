import type { Route } from "./+types/profile";
import { requireRole } from "../../shared/auth";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, userId } = await requireRole(request, context);
  return { role, userId };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { role, userId } = loaderData;

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Profile</h1>
      <div style={{ marginTop: "1rem" }}>
        <p><strong>User ID:</strong> {userId || "Not signed in"}</p>
        <p><strong>Role:</strong> {role}</p>
      </div>
      <div style={{ marginTop: "2rem", padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
        <h2>Account Information</h2>
        <p>This page is only accessible to <strong>executive</strong> users.</p>
        <p>Employee, customer, and user roles will see a 403 Forbidden error.</p>
      </div>
    </div>
  );
}

