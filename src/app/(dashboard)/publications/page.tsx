import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canCreatePublicationRole } from "@/lib/auth/publication-permissions";
import type { PlatformRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Publications" };

export default async function PublicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canCreate = canCreatePublicationRole(profile?.role as PlatformRole | undefined);

  const { data: publications } = await supabase
    .from("publications")
    .select("id, name, slug, description, status, logo_url, cadence, publication_members(role)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <H1 className="text-xl">Publications</H1>
          <Muted>Every publication you&apos;re a member of. No limit on how many can exist.</Muted>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/publications/new">New publication</Link>
          </Button>
        )}
      </div>

      {!publications?.length ? (
        <Muted>You&apos;re not part of any publication yet.</Muted>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publications.map((pub) => {
            const membership = Array.isArray(pub.publication_members) ? pub.publication_members[0] : pub.publication_members;
            return (
              <Link key={pub.id} href={`/publications/${pub.id}`}>
                <Card className="h-full transition-colors hover:border-neutral-300">
                  <CardHeader className="flex-row items-center gap-3 space-y-0">
                    <Avatar className="h-9 w-9 rounded-md">
                      <AvatarImage src={pub.logo_url ?? undefined} alt="" />
                      <AvatarFallback className="rounded-md">{pub.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{pub.name}</CardTitle>
                      <Muted className="truncate text-xs">/{pub.slug}</Muted>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pub.description && <p className="line-clamp-2 text-sm text-muted-foreground">{pub.description}</p>}
                    <div className="flex items-center gap-2">
                      <Badge variant={pub.status === "active" ? "success" : "neutral"}>{pub.status}</Badge>
                      {pub.cadence && <Badge variant="neutral">{pub.cadence}</Badge>}
                      {membership?.role && (
                        <Badge variant="info" className="capitalize">
                          {membership.role.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
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
