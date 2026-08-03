/** Public layout — no sidebar, no auth required. Clean reading experience. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-50">{children}</div>;
}
