import { SessionProvider } from "next-auth/react";
import { SWRProvider } from "@/lib/swr-config";

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SWRProvider>
        <div className="h-screen overflow-hidden bg-slate-100">
          {children}
        </div>
      </SWRProvider>
    </SessionProvider>
  );
}
