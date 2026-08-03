"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Publication {
  id: string;
  name: string;
  slug: string;
  memberRole: string;
}

export function ArticleNewForm({ publications }: { publications: Publication[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [publicationId, setPublicationId] = React.useState(publications[0]?.id ?? "");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!publicationId) {
      toast.error("Select a publication");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), publicationId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to create article");
        return;
      }
      toast.success("Article created");
      router.push(`/articles/${body.article.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="The Rise of Vector Databases"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>

      {publications.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="publication">Publication</Label>
          <Select value={publicationId} onValueChange={setPublicationId}>
            <SelectTrigger id="publication">
              <SelectValue placeholder="Select a publication" />
            </SelectTrigger>
            <SelectContent>
              {publications.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" disabled={loading || !title.trim()}>
        {loading ? "Creating…" : "Create article"}
      </Button>
    </form>
  );
}
