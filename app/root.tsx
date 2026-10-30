import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import stylesheet from "./styles.css?url";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap",
    },
    { rel: "stylesheet", href: stylesheet },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link rel="stylesheet" href="/app.css" />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (!publishableKey || publishableKey.includes("REPLACE_ME")) {
    return (
      <>
        <div className="notice">
          Authentication is not configured. Set VITE_CLERK_PUBLISHABLE_KEY to enable login.
        </div>
        <Outlet />
      </>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#1973cc",
          colorText: "#1b1e1f",
          borderRadius: "8px",
          fontFamily: "Poppins, Inter, ui-sans-serif, system-ui, sans-serif",
        },
      }}
    >
      <Outlet />
    </ClerkProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("SERVER ERROR:", error?.message || error, error?.stack);
  return (
    <div>
      <h1>Unexpected Server Error</h1>
      <pre>{error?.message || String(error)}</pre>
    </div>
  );
}
