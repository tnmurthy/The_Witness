import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, type)")
    .eq("user_id", user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
          <p className="text-sm text-muted-foreground">Enterprise and university accounts you belong to.</p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">New organization</Link>
        </Button>
      </div>

      {!memberships?.length ? (
        <p className="text-sm text-muted-foreground">You&apos;re not part of any organization yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {memberships.map((m) => {
            // Supabase's PostgREST join comes back as an object here since
            // organization_members -> organizations is a many-to-one
            // relationship, but the generated (untyped, pre-codegen) shape
            // is technically an array in TypeScript's eyes — normalize.
            const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
            if (!org) return null;
            return (
              <Link key={org.id} href={`/organizations/${org.id}`}>
                <Card className="transition-colors hover:border-neutral-300">
                  <CardHeader>
                    <CardTitle className="text-base">{org.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {org.type} · your role: {m.role}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
