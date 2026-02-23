"use client";

import { Building2, Clock, LogOut, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface POSHeaderProps {
  session: {
    id: string;
    sessionNumber: string;
  } | null;
  heldOrdersCount: number;
  onHeldOrdersClick: () => void;
  onCloseSession: () => void;
}

export function POSHeader({
  session,
  heldOrdersCount,
  onHeldOrdersClick,
  onCloseSession,
}: POSHeaderProps) {
  const { data: authSession } = useSession();
  const router = useRouter();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-slate-900 px-2 sm:px-3 text-white gap-1 sm:gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-base font-bold whitespace-nowrap">BizArch POS</span>
        {session && (
          <Badge variant="secondary" className="hidden xs:inline-flex shrink-0 text-xs">
            {session.sessionNumber}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300">
          <Clock className="h-4 w-4" />
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 relative px-2"
          onClick={onHeldOrdersClick}
        >
          <PauseCircle className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Held</span>
          {heldOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold">
              {heldOrdersCount}
            </span>
          )}
        </Button>

        <div className="hidden sm:block text-sm text-slate-300 truncate max-w-[100px]">
          {authSession?.user?.name}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800 px-2"
          onClick={onCloseSession}
        >
          <LogOut className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">End Session</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => router.push("/")}
          title="Exit POS"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
