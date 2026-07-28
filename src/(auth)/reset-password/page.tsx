import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose something you haven&apos;t used before.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
