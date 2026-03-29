"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormConfigTab } from "./form-config-tab";

interface UserFormConfigDialogProps {
  orgId: string;
  userId: string;
  userName: string;
  edition?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormConfigDialog({
  orgId,
  userId,
  userName,
  edition,
  open,
  onOpenChange,
}: UserFormConfigDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-6">
        <SheetHeader className="mb-4">
          <SheetTitle>Form Config — {userName}</SheetTitle>
        </SheetHeader>
        <FormConfigTab
          orgId={orgId}
          edition={edition}
          userId={userId}
          userName={userName}
        />
      </SheetContent>
    </Sheet>
  );
}
