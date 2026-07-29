"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";

import { usePerson, useUpdatePerson, useDeletePerson } from "@/lib/graph/people-hooks";
import { RelatedContentPanel } from "@/components/graph/related-content-panel";
import { QueryStateView } from "@/components/ui/query-state-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function PersonDetail({ personId }: { personId: string }) {
  const router = useRouter();
  const query = usePerson(personId);
  const updatePerson = useUpdatePerson(personId);
  const deletePerson = useDeletePerson();

  const [fullName, setFullName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (query.data && !hydrated) {
      setFullName(query.data.person.full_name);
      setBio(query.data.person.bio ?? "");
      setAvatarUrl(query.data.person.avatar_url ?? "");
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  async function handleSave() {
    try {
      await updatePerson.mutateAsync({ fullName, bio, avatarUrl });
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  async function handleDelete() {
    try {
      await deletePerson.mutateAsync(personId);
      toast.success("Person deleted");
      router.push("/people");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <QueryStateView
      query={query}
      loading={
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      {(data) => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="text-lg">{initials(data.person.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="person-name">Full name</Label>
                <Input id="person-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="person-avatar">Avatar URL</Label>
              <Input id="person-avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="person-bio">Bio</Label>
              <Textarea id="person-bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={updatePerson.isPending}>
                <Save className="h-4 w-4" /> {updatePerson.isPending ? "Saving…" : "Save"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-danger-700">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {data.person.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the person and every Knowledge Graph connection to them. This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-danger-700 hover:bg-danger-800">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <RelatedContentPanel entityType="person" entityId={personId} />
        </div>
      )}
    </QueryStateView>
  );
}
