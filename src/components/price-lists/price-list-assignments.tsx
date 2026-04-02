"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface SimpleEntity {
  id: string;
  name: string;
  email?: string;
}

interface Props {
  assignedUsers: SimpleEntity[];
  assignedCustomers: SimpleEntity[];
  allUsers: SimpleEntity[];
  allCustomers: SimpleEntity[];
  onAssignUser: (userId: string) => void;
  onUnassignUser: (userId: string) => void;
  onAssignCustomer: (customerId: string) => void;
  onUnassignCustomer: (customerId: string) => void;
}

export function PriceListAssignments({
  assignedUsers,
  assignedCustomers,
  allUsers,
  allCustomers,
  onAssignUser,
  onUnassignUser,
  onAssignCustomer,
  onUnassignCustomer,
}: Props) {
  const { t } = useLanguage();

  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));
  const assignedCustomerIds = new Set(assignedCustomers.map((c) => c.id));
  const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));
  const availableCustomers = allCustomers.filter((c) => !assignedCustomerIds.has(c.id));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Users section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">{t("priceLists.assignedUsers")}</h4>
        <div className="flex items-center gap-2">
          <Select onValueChange={(id) => { onAssignUser(id); }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("priceLists.selectUser")} />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {assignedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 py-1">
              {u.name}
              <button
                type="button"
                onClick={() => onUnassignUser(u.id)}
                className="ml-1 rounded-full hover:bg-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {assignedUsers.length === 0 && (
            <span className="text-xs text-slate-400">{t("priceLists.noUsersAssigned")}</span>
          )}
        </div>
      </div>

      {/* Customers section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">{t("priceLists.assignedCustomers")}</h4>
        <div className="flex items-center gap-2">
          <Select onValueChange={(id) => { onAssignCustomer(id); }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("priceLists.selectCustomer")} />
            </SelectTrigger>
            <SelectContent>
              {availableCustomers.slice(0, 50).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {assignedCustomers.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1 py-1">
              {c.name}
              <button
                type="button"
                onClick={() => onUnassignCustomer(c.id)}
                className="ml-1 rounded-full hover:bg-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {assignedCustomers.length === 0 && (
            <span className="text-xs text-slate-400">{t("priceLists.noCustomersAssigned")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
