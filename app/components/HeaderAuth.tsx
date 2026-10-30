import { Link } from 'react-router';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/clerk-react';

function GuestLinks() {
  return (
    <>
      <Link className="header-signin" to="/sign-in">
        Sign In
      </Link>
      <Link className="header-join" to="/sign-up">
        Join
      </Link>
    </>
  );
}

function GuestModals() {
  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl="/app">
        <button type="button" className="header-signin">
          Sign In
        </button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl="/app/onboarding">
        <button type="button" className="header-join">
          Join
        </button>
      </SignUpButton>
    </>
  );
}

export function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <>
        <Link className="header-login" to="/app">
          Portal
        </Link>
        <UserButton afterSignOutUrl="/" />
      </>
    );
  }

  if (!isLoaded) {
    return <GuestLinks />;
  }

  return <GuestModals />;
}
