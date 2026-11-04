import type { Route } from "./+types/employees";
import { requireRole } from "../../shared/auth";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, userId } = await requireRole(request, context);
  return { role, userId };
}

export default function Employees({ loaderData }: Route.ComponentProps) {
  const { role, userId } = loaderData;

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Employees</h1>
      <p style={{ color: "#666" }}>
        Signed in as <strong>{role}</strong>
      </p>

      <div style={{ marginTop: "2rem" }}>
        <h2>Employee Directory</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
              <th style={{ padding: "0.75rem" }}>Name</th>
              <th style={{ padding: "0.75rem" }}>Email</th>
              <th style={{ padding: "0.75rem" }}>Role</th>
              <th style={{ padding: "0.75rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.75rem" }}>John Doe</td>
              <td style={{ padding: "0.75rem" }}>john@example.com</td>
              <td style={{ padding: "0.75rem" }}>Employee</td>
              <td style={{ padding: "0.75rem" }}>Active</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.75rem" }}>Jane Smith</td>
              <td style={{ padding: "0.75rem" }}>jane@example.com</td>
              <td style={{ padding: "0.75rem" }}>Employee</td>
              <td style={{ padding: "0.75rem" }}>Active</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.75rem" }}>Bob Johnson</td>
              <td style={{ padding: "0.75rem" }}>bob@example.com</td>
              <td style={{ padding: "0.75rem" }}>Employee</td>
              <td style={{ padding: "0.75rem" }}>Active</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
