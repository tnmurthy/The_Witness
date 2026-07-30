import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageOrganization } from "@/lib/auth/permissions";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { H1, Muted } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Organization" };

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, type")
    .eq("id", id)
    .single();
  if (!organization) notFound();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", id)
    .eq("user_id", user.id)
    .single();

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, profiles(full_name)")
    .eq("organization_id", id);

  const isAdmin = canManageOrganization(membership?.role);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/organizations">Organizations</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{organization.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <H1 className="text-xl">{organization.name}</H1>
        <Muted className="capitalize">{organization.type}</Muted>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((m) => {
              const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return (
                <TableRow key={m.user_id}>
                  <TableCell>{profile?.full_name || "Unnamed"}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "admin" ? "signal" : "neutral"} className="capitalize">
                      {m.role}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Invite a member</h2>
          <InviteMemberForm organizationId={id} />
        </div>
      )}
    </div>
  );
}
