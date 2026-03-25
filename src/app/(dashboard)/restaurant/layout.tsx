"use client";

import { useSession } from "next-auth/react";

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const isEnabled = (session?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled ?? false;

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Restaurant module is not enabled for this organization.</p>
      </div>
    );
  }

  return <>{children}</>;
}
