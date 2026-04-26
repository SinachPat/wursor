import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that do NOT require a Clerk session.
// • /sign-in and /sign-up — Clerk's own auth UI
// • /api/webhooks/* — carrier-level HMAC auth (Linear, Slack, GitHub, Intercom)
// • /api/agent-bridge — workspace Bearer-token auth issued to Cursor / Claude Code
const isPublicRoute = createRouteMatcher([
  '/',                       // root → redirects to /marketing.html
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/agent-bridge(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files (html, css, images, fonts…)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
