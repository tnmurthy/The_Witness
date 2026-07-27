import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { UsersTable } from "@/components/admin/users-table";

export const metadata = { title: "Users & Roles" };

export default async function AdminUsersPage() {
  const { userId } = await requireRole(["super_admin"]);

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Users &amp; Roles</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide role changes are Super Admin only. Publication-level roles (Editor-in-Chief, Editor,
          Writer, Researcher on a specific publication) are managed from that publication&apos;s settings instead.
        </p>
      </div>
      <UsersTable initialUsers={users ?? []} currentUserId={userId} />
    </div>
  );
}
