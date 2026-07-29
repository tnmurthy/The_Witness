import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatePersonForm } from "@/components/people/create-person-form";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { H1 } from "@/components/ui/typography";

export const metadata = { title: "Add person" };

export default async function NewPersonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/people">People</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Add person</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <H1 className="text-xl">Add person</H1>
      <CreatePersonForm />
    </div>
  );
}
