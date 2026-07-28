import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageOrganization } from "@/lib/auth/permissions";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";

export const metadata = { title: "Organization" };

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: organization } = await supabase.from("organizations").select("id, name, type").eq("id", id).single();
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
      <div>
        <h1 className="text-xl font-semibold text-foreground">{organization.name}</h1>
        <p className="text-sm text-muted-foreground capitalize">{organization.type}</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Members</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return (
                  <tr key={m.user_id} className="border-t border-neutral-200">
                    <td className="px-4 py-2.5">{profile?.full_name || "Unnamed"}</td>
                    <td className="px-4 py-2.5 capitalize">{m.role}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
