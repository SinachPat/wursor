import { redirect } from 'next/navigation';

// The marketing site lives at /marketing.html (static file in /public).
// The Clerk middleware will intercept any unauthenticated visit to /canvas
// and redirect to /sign-in, so we simply send everyone to the marketing page.
export default function Home() {
  redirect('/marketing.html');
}
