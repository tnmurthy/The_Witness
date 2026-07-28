import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";

export const metadata = { title: "New organization" };

export default function NewOrganizationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">New organization</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll be added as its admin automatically.</p>
      </div>
      <CreateOrganizationForm />
    </div>
  );
}
