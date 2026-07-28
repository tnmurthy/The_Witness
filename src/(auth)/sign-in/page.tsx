import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back.</p>
      </div>

      <OAuthButtons />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* SignInForm reads the ?next= redirect target via useSearchParams,
          which opts the subtree out of static rendering unless wrapped in
          Suspense — this boundary is what lets Next.js still prerender
          the surrounding page shell. */}
      <Suspense fallback={<div className="h-[164px]" aria-hidden="true" />}>
        <SignInForm />
      </Suspense>

      <div className="text-right">
        <Link href="/forgot-password" className="text-xs text-navy-700 underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Sign in without a password
        </summary>
        <div className="mt-3">
          <MagicLinkForm />
        </div>
      </details>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="text-navy-700 underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
