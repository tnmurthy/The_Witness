import Link from "next/link";

export const metadata = { title: "Unsubscribed" };

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">You&apos;ve been unsubscribed</h1>
        <p className="mt-2 text-sm text-neutral-500">
          You won&apos;t receive any more emails from this publication. You can re-subscribe at any time from
          the publication&apos;s page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
