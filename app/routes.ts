import { type RouteConfig, index, route } from '@react-router/dev/routes';
export default [
 index('routes/home.tsx'),route('about','routes/about.tsx'),route('services','routes/services.tsx'),route('contact','routes/contact.tsx'),
 route('sign-in/*','routes/sign-in.tsx'),route('sign-up/*','routes/sign-up.tsx'),
 route('app','routes/app.tsx'),route('app/onboarding','routes/onboarding.tsx'),route('app/employees','routes/employees.tsx'),route('app/profile','routes/profile.tsx'),
 route('communication-preferences','routes/preferences.tsx')
] satisfies RouteConfig;
