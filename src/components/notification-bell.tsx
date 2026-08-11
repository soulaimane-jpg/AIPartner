import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { NotificationRow } from "@/lib/db/rows";
import { timeAgo, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function NotificationBell() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const notifications = await query<NotificationRow>(
    'SELECT * FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 8',
    [session.user.id],
  );
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-white/10 hover:text-slate-900 transition-all group">
          <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 grid h-2 w-2 place-items-center rounded-full bg-indigo-500 shadow-sm">
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between pb-4">
          <span className="text-slate-900">Signal Feed</span>
          <Badge variant="outline" className="h-5 px-2 border-blue-200 text-blue-600 bg-blue-50 text-xs">
            {unread} UNREAD
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-600 font-mono ">
            [ IDLE_STATE: NO_NEW_SIGNALS ]
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "#"}
                className="block rounded-xl px-4 py-3 hover:bg-white transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-all",
                      n.read ? "bg-slate-800" : "bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.8)]"
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-none">{n.title}</div>
                    <div className="text-xs text-slate-500 leading-normal">{n.message}</div>
                    <div className="text-xs font-mono  text-slate-700">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
