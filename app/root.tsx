import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { ClerkProvider } from '@clerk/clerk-react';
import './styles.css';
export function Layout({children}:{children:ReactNode}) { return <html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><Meta/><Links/></head><body>{children}<ScrollRestoration/><Scripts/></body></html> }
export default function Root(){const key=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY; return key && !key.includes('REPLACE_ME') ? <ClerkProvider publishableKey={key}><Outlet/></ClerkProvider> : <><div className="notice">Authentication is not configured. Set VITE_CLERK_PUBLISHABLE_KEY to enable login.</div><Outlet/></>;}
