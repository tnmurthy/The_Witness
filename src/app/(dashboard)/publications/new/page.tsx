import { CreatePublicationForm } from "@/components/publications/create-publication-form";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "New publication" };

export default function NewPublicationPage() {
  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">New publication</H1>
        <Muted>You&apos;ll be added as its Editor-in-Chief automatically.</Muted>
      </div>
      <CreatePublicationForm />
    </div>
  );
}
