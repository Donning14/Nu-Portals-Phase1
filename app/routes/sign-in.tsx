// No loader needed — sign-in is in the PUBLIC_PAGES list
// The requireRole function automatically skips auth for this page

import {SignIn} from '@clerk/clerk-react';import {Page} from '../components/Shell';export default function SignInPage(){return <Page title="Sign in"><SignIn routing="hash" forceRedirectUrl="/app"/></Page>}
