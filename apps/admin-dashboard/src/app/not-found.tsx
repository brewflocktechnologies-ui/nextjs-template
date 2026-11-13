import Link from 'next/link';

// The dashboard's own 404 (D-28). Next.js's built-in one carries an inline <style> without the
// request's nonce, which the CSP blocks; this one uses the stylesheet only. The text does not say
// whether the page exists, so a 404 for a route the user may not see reveals nothing (P2.1-AC08).
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        This page does not exist, or you do not have access to it.
      </p>
      <Link href="/" className="mt-4 inline-block underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
