"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import type { PriceListData } from "./price-list-settings";

interface SimpleEntity {
  id: string;
  name: string;
  email?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceListData;
}

export function PriceListAssignDialog({ open, onOpenChange, priceList }: Props) {
  const { t } = useLanguage();
  const [users, setUsers] = useState<SimpleEntity[]>([]);
  const [customers, setCustomers] = useState<SimpleEntity[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<SimpleEntity[]>([]);
  const [assignedCustomers, setAssignedCustomers] = useState<SimpleEntity[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loading, setLoading] = useState(false);

  const loadAssignments = useCallback(() => {
    // Parse existing assignments
    setAssignedUsers(
      priceList.assignments
        .filter((a) => a.user)
        .map((a) => ({ id: a.user!.id, name: a.user!.name }))
    );
    setAssignedCustomers(
      priceList.assignments
        .filter((a) => a.customer)
        .map((a) => ({ id: a.customer!.id, name: a.customer!.name }))
    );
  }, [priceList.assignments]);

  useEffect(() => {
    if (open) {
      loadAssignments();
      // Fetch users and customers for dropdowns
      fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
      fetch("/api/customers?compact=true").then((r) => r.json()).then((data) => {
        setCustomers(Array.isArray(data) ? data : data.data ?? []);
      }).catch(() => {});
    }
  }, [open, loadAssignments]);

  const handleAssign = async (type: "user" | "customer") => {
    const id = type === "user" ? selectedUserId : selectedCustomerId;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "user" ? { userId: id } : { customerId: id }),
      });
      if (!res.ok) throw new Error();

      if (type === "user") {
        const user = users.find((u) => u.id === id);
        if (user) setAssignedUsers((prev) => [...prev.filter((u) => u.id !== id), user]);
        setSelectedUserId("");
      } else {
        const customer = customers.find((c) => c.id === id);
        if (customer) setAssignedCustomers((prev) => [...prev.filter((c) => c.id !== id), customer]);
        setSelectedCustomerId("");
      }
      toast.success(t("priceLists.assigned"));
    } catch {
      toast.error(t("priceLists.assignFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (type: "user" | "customer", entityId: string) => {
    try {
      const res = await fetch(`/api/price-lists/${priceList.id}/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "user" ? { userId: entityId } : { customerId: entityId }),
      });
      if (!res.ok) throw new Error();

      if (type === "user") {
        setAssignedUsers((prev) => prev.filter((u) => u.id !== entityId));
      } else {
        setAssignedCustomers((prev) => prev.filter((c) => c.id !== entityId));
      }
    } catch {
      toast.error(t("priceLists.unassignFailed"));
    }
  };

  const assignedUserIds = new Set(assignedUsers.map((u) => u.id));
  const assignedCustomerIds = new Set(assignedCustomers.map((c) => c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("priceLists.assign")} — {priceList.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Users section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t("priceLists.assignedUsers")}</h4>
            <div className="flex items-center gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("priceLists.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => !assignedUserIds.has(u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleAssign("user")}
                disabled={!selectedUserId || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {assignedUsers.map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1 py-1">
                  {u.name}
                  <button
                    onClick={() => handleUnassign("user", u.id)}
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
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("priceLists.selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers
                    .filter((c) => !assignedCustomerIds.has(c.id))
                    .slice(0, 50)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => handleAssign("customer")}
                disabled={!selectedCustomerId || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {assignedCustomers.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1 py-1">
                  {c.name}
                  <button
                    onClick={() => handleUnassign("customer", c.id)}
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
      </DialogContent>
    </Dialog>
  );
}
