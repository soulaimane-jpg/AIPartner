"use client";

import { useActionState, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteWorkspaceMembersAction, type WorkspaceInviteState } from "@/lib/actions/workspace-invites";

export function WorkspaceInviteForm() {
  const [rows, setRows] = useState([0]);
  const [state, action] = useActionState<WorkspaceInviteState, FormData>(
    inviteWorkspaceMembersAction,
    undefined,
  );

  return (
    <form action={action} className="customer-panel space-y-4 p-5 sm:p-6">
      <input type="hidden" name="returnTo" value="/settings/members" />
      <div>
        <h2 className="text-[14px] font-semibold">Invite colleagues</h2>
        <p className="text-[12px] text-muted-foreground">
          Invitations expire after seven days.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_36px]"
          >
            <Input
              type="email"
              name="inviteEmail"
              placeholder="colleague@company.com"
              aria-label="Colleague email"
              required
            />
            <select
              name="inviteRole"
              defaultValue="MEMBER"
              aria-label="Workspace role"
              className="h-10 rounded-md border border-input bg-card px-3 text-[13px]"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
            </select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove row"
              disabled={rows.length === 1}
              onClick={() =>
                setRows((current) => current.filter((value) => value !== row))
              }
              className="justify-self-end sm:justify-self-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {state?.error && (
        <p role="alert" className="text-[12px] text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            setRows((current) => [...current, Math.max(...current) + 1])
          }
          className="w-full sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another
        </Button>
        <Button type="submit" size="sm" className="w-full sm:w-auto">
          <Send className="h-3.5 w-3.5" />
          Send invitations
        </Button>
      </div>
    </form>
  );
}
