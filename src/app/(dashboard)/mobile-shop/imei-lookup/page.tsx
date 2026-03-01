"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { Loader2, AlertTriangle, Search, Smartphone } from "lucide-react";
import Link from "next/link";
import { ImeiCameraScanner } from "@/components/mobile-devices/imei-camera-scanner";

interface DeviceResult {
  id: string;
  imei1: string;
  imei2: string | null;
  serialNumber: string | null;
  brand: string;
  model: string;
  color: string | null;
  storageCapacity: string | null;
  ram: string | null;
  networkStatus: string;
  currentStatus: string;
  conditionGrade: string;
  batteryHealthPercentage: number | null;
  includedAccessories: { box?: boolean; charger?: boolean; cable?: boolean } | null;
  costPrice: number;
  landedCost: number;
  sellingPrice: number;
  soldPrice: number | null;
  inwardDate: string;
  outwardDate: string | null;
  supplierWarrantyExpiry: string | null;
  customerWarrantyExpiry: string | null;
  notes: string | null;
  supplier: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  product: { id: string; name: string; sku: string | null } | null;
  purchaseInvoice: { id: string; purchaseInvoiceNumber: string } | null;
  salesInvoice: { id: string; invoiceNumber: string } | null;
  salesperson: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  IN_STOCK: "bg-green-100 text-green-800",
  RESERVED: "bg-yellow-100 text-yellow-800",
  SOLD: "bg-blue-100 text-blue-800",
  IN_REPAIR: "bg-orange-100 text-orange-800",
  RMA: "bg-red-100 text-red-800",
};

const conditionLabels: Record<string, string> = {
  NEW: "New",
  OPEN_BOX: "Open Box",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  GRADE_C: "Grade C",
  REFURBISHED: "Refurbished",
};

function isWarrantyActive(date: string | null) {
  if (!date) return false;
  return new Date(date) > new Date();
}

export default function ImeiLookupPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("imei") ?? "");
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<DeviceResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-search when navigated from command palette with ?imei= param
  useEffect(() => {
    const imeiParam = searchParams.get("imei");
    if (imeiParam) {
      handleSearch(imeiParam);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (imei?: string) => {
    const searchImei = imei || query.trim();
    if (!searchImei) return;

    setLoading(true);
    setNotFound(false);
    setDevice(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/mobile-devices/lookup?imei=${encodeURIComponent(searchImei)}`);
      if (res.ok) {
        const data = await res.json();
        setDevice(data);
      } else if (res.status === 404) {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="h-6 w-6" />
            IMEI Lookup
          </h2>
          <p className="text-slate-500">Search for a device by scanning or entering its IMEI number</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="max-w-lg mx-auto space-y-2">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Scan or enter IMEI number..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  className="font-mono text-lg h-12 text-center"
                />
                <ImeiCameraScanner
                  onScan={(imei) => {
                    setQuery(imei);
                    handleSearch(imei);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Press Enter, tap the camera icon, or scan a barcode to search
              </p>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {notFound && searched && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">Device Not Found</h3>
              <p className="text-slate-500 mt-1">No device matches IMEI: <span className="font-mono">{query}</span></p>
            </CardContent>
          </Card>
        )}

        {device && !loading && (
          <StaggerContainer className="grid gap-4 md:grid-cols-2">
            {/* Device Specs */}
            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Device Specs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span className="font-medium">{device.brand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-medium">{device.model}</span>
                  </div>
                  {device.color && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Color</span>
                      <span>{device.color}</span>
                    </div>
                  )}
                  {device.storageCapacity && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span>{device.storageCapacity}</span>
                    </div>
                  )}
                  {device.ram && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RAM</span>
                      <span>{device.ram}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IMEI 1</span>
                    <span className="font-mono text-xs">{device.imei1}</span>
                  </div>
                  {device.imei2 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IMEI 2</span>
                      <span className="font-mono text-xs">{device.imei2}</span>
                    </div>
                  )}
                  {device.serialNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial</span>
                      <span className="font-mono text-xs">{device.serialNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network</span>
                    <span>{device.networkStatus}</span>
                  </div>
                  {device.product && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Product</span>
                      <span>{device.product.name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Inventory & Condition */}
            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Inventory & Condition</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={statusColors[device.currentStatus] || "bg-gray-100 text-gray-800"}>
                      {device.currentStatus.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span>{conditionLabels[device.conditionGrade] || device.conditionGrade}</span>
                  </div>
                  {device.batteryHealthPercentage !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Battery Health</span>
                      <span>{device.batteryHealthPercentage}%</span>
                    </div>
                  )}
                  {device.includedAccessories && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accessories</span>
                      <span className="text-right text-xs">
                        {[
                          device.includedAccessories.box && "Box",
                          device.includedAccessories.charger && "Charger",
                          device.includedAccessories.cable && "Cable",
                        ].filter(Boolean).join(", ") || "None"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Cost & Sourcing */}
            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cost & Sourcing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {device.supplier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier</span>
                      <Link href={`/suppliers`} className="text-blue-600 hover:underline">
                        {device.supplier.name}
                      </Link>
                    </div>
                  )}
                  {device.purchaseInvoice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Invoice</span>
                      <Link href={`/purchase-invoices/${device.purchaseInvoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {device.purchaseInvoice.purchaseInvoiceNumber}
                      </Link>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inward Date</span>
                    <span>{new Date(device.inwardDate).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost Price</span>
                    <span>&#8377;{Number(device.costPrice).toLocaleString("en-IN")}</span>
                  </div>
                  {Number(device.landedCost) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Landed Cost</span>
                      <span>&#8377;{Number(device.landedCost).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(device.sellingPrice) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selling Price</span>
                      <span>&#8377;{Number(device.sellingPrice).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Sales Details */}
            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Sales Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {device.currentStatus === "SOLD" ? (
                    <>
                      {device.customer && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer</span>
                          <Link href={`/customers`} className="text-blue-600 hover:underline">
                            {device.customer.name}
                          </Link>
                        </div>
                      )}
                      {device.salesInvoice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sales Invoice</span>
                          <Link href={`/invoices/${device.salesInvoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {device.salesInvoice.invoiceNumber}
                          </Link>
                        </div>
                      )}
                      {device.outwardDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outward Date</span>
                          <span>{new Date(device.outwardDate).toLocaleDateString("en-IN")}</span>
                        </div>
                      )}
                      {device.soldPrice !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sold Price</span>
                          <span>&#8377;{Number(device.soldPrice).toLocaleString("en-IN")}</span>
                        </div>
                      )}
                      {device.salesperson && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Salesperson</span>
                          <span>{device.salesperson.name}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Not sold yet</p>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Warranty - Full Width */}
            <StaggerItem className="md:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Warranty</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier Warranty</span>
                      {device.supplierWarrantyExpiry ? (
                        <span className="flex items-center gap-2">
                          {new Date(device.supplierWarrantyExpiry).toLocaleDateString("en-IN")}
                          <Badge variant={isWarrantyActive(device.supplierWarrantyExpiry) ? "default" : "secondary"} className="text-xs">
                            {isWarrantyActive(device.supplierWarrantyExpiry) ? "Active" : "Expired"}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer Warranty</span>
                      {device.customerWarrantyExpiry ? (
                        <span className="flex items-center gap-2">
                          {new Date(device.customerWarrantyExpiry).toLocaleDateString("en-IN")}
                          <Badge variant={isWarrantyActive(device.customerWarrantyExpiry) ? "default" : "secondary"} className="text-xs">
                            {isWarrantyActive(device.customerWarrantyExpiry) ? "Active" : "Expired"}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </StaggerContainer>
        )}
      </div>
    </PageAnimation>
  );
}
