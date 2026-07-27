import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { PLATFORM_ROLE_LABELS, type PlatformRole } from "@/lib/auth/roles";

export const metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · {PLATFORM_ROLE_LABELS[(profile?.role as PlatformRole) ?? "subscriber"]}
        </p>
      </div>
      <ProfileForm userId={user.id} initialFullName={profile?.full_name ?? ""} />
    </div>
  );
}
