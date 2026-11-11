import { type RouteConfig, index, route } from '@react-router/dev/routes';
export default [
 index('routes/home.tsx'),route('about','routes/about.tsx'),route('services','routes/services.tsx'),route('contact','routes/contact.tsx'),route('contact/learn-more','routes/learn-more.tsx'),
 route('sign-in/*','routes/sign-in.tsx'),route('sign-up/*','routes/sign-up.tsx'),
 route('app','routes/app.tsx'),route('app/onboarding','routes/onboarding.tsx'),route('app/employees','routes/employees.tsx'),route('app/profile','routes/profile.tsx'),
 route('app/quotes/new','routes/quote-new.tsx'),route('app/quotes/:id','routes/quote-detail.tsx'),
 route('app/requests','routes/requests.tsx'),route('app/requests/:id','routes/request-detail.tsx'),
 route('app/projects','routes/projects.tsx'),route('app/projects/:id','routes/project-detail.tsx'),
 route('app/agreements/:id','routes/agreement-detail.tsx'),
 route('app/admin/requests','routes/admin-requests.tsx'),route('app/admin/customers','routes/admin-customers.tsx'),
 route('communication-preferences','routes/preferences.tsx')
] satisfies RouteConfig;
