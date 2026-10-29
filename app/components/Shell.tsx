import { Link } from 'react-router';
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="header">
        <nav className="container nav">
          <Link to="/" aria-label="Nu-Portals home">
            <img className="logo" src="/logo.svg" alt="Nu-Portals" />
          </Link>
          <div className="navlinks">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/services">Services</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/communication-preferences">Preferences</Link>
            <Link to="/app">Portal</Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <div className="container">
          <b>Nu-Portals</b>
          <p>AI solutions from ideation through ongoing support.</p>
          <div className="navlinks">
            <a href="/policies/sms-terms.html">SMS Terms</a>
            <a href="/policies/sms-consent.html">SMS Consent</a>
            <a href="/policies/sms-privacy.html">SMS Privacy</a>
          </div>
          <small>Legal documents refer to AnuPortal.com; confirm entity naming before publication.</small>
        </div>
      </footer>
    </>
  );
}

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Shell>
      <section className="page">
        <div className="container">
          <h1>{title}</h1>
          {children}
        </div>
      </section>
    </Shell>
  );
}
