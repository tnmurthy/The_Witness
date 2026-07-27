"use client";

import * as React from "react";
import { toast } from "sonner";
import { PLATFORM_ROLES, PLATFORM_ROLE_LABELS, type PlatformRole } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UserRow {
  id: string;
  full_name: string | null;
  role: PlatformRole;
  created_at: string;
}

export function UsersTable({ initialUsers, currentUserId }: { initialUsers: UserRow[]; currentUserId: string }) {
  const [users, setUsers] = React.useState(initialUsers);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  async function handleRoleChange(userId: string, role: PlatformRole) {
    setSavingId(userId);
    const previous = users;
    setUsers((rows) => rows.map((r) => (r.id === userId ? { ...r, role } : r)));

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? "Failed to update role");
      }

      toast.success("Role updated");
    } catch (error) {
      logger.error("Role change failed in UI", { error, userId });
      toast.error(error instanceof Error ? error.message : "Failed to update role");
      setUsers(previous);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>
              {u.full_name || <span className="text-muted-foreground">Unnamed</span>}
              {u.id === currentUserId && (
                <Badge variant="neutral" className="ml-2">
                  you
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <Select
                value={u.role}
                disabled={savingId === u.id || u.id === currentUserId}
                onValueChange={(value) => handleRoleChange(u.id, value as PlatformRole)}
              >
                <SelectTrigger className="w-52" aria-label={`Role for ${u.full_name ?? u.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {PLATFORM_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
