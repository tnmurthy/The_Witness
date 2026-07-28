export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 font-voice text-xl font-semibold text-foreground">
          <span className="h-5 w-1 bg-gold-700" aria-hidden="true" />
          The Witness
        </div>
        <div className="rounded-lg border border-neutral-200 bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
