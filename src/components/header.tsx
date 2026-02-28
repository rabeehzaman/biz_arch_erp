"use client";

import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { LogOut, User, Building2, Search } from "lucide-react";
import { MobileSidebar } from "./sidebar";
import { useEffect, useState } from "react";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";

export function Header() {
  const { data: session } = useSession();
  const { setOpen } = useCommandPalette();
  const [orgName, setOrgName] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  useEffect(() => {
    if (session?.user?.organizationId) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((settings) => {
          const companyName = settings.find?.((s: { key: string }) => s.key === "company_name");
          if (companyName) {
            setOrgName(companyName.value);
          }
        })
        .catch(() => { });
    }
  }, [session?.user?.organizationId]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <MobileSidebar />
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-semibold text-slate-900 truncate">
            Welcome, {session?.user?.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 hidden sm:block">
            {orgName ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {orgName}
              </span>
            ) : (
              "Manage your business operations"
            )}
          </p>
        </div>
      </div>

      {/* Spotlight search trigger */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-white transition-colors mx-4 flex-1 max-w-xs"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search or jump to...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </button>

      {mounted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-slate-500">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button className="flex items-center gap-2 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      )}
    </header>
  );
}
