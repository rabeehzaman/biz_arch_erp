"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { Loader2, AlertTriangle, Search, Smartphone, Download, Images } from "lucide-react";
import Link from "next/link";
import { ImeiCameraScanner } from "@/components/mobile-devices/imei-camera-scanner";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

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
  mrp: number | null;
  soldPrice: number | null;
  inwardDate: string;
  outwardDate: string | null;
  supplierWarrantyExpiry: string | null;
  customerWarrantyExpiry: string | null;
  notes: string | null;
  photoUrls: string[];
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

function isWarrantyActive(date: string | null) {
  if (!date) return false;
  return new Date(date) > new Date();
}

export default function ImeiLookupPage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { symbol, locale } = useCurrency();
  const [query, setQuery] = useState(() => searchParams.get("imei") ?? "");
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<DeviceResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  const conditionLabels: Record<string, string> = {
    NEW: t("mobileShop.conditionNew"),
    OPEN_BOX: t("mobileShop.conditionOpenBox"),
    GRADE_A: t("mobileShop.conditionGradeA"),
    GRADE_B: t("mobileShop.conditionGradeB"),
    GRADE_C: t("mobileShop.conditionGradeC"),
    REFURBISHED: t("mobileShop.conditionRefurbished"),
  };

  const statusLabels: Record<string, string> = {
    IN_STOCK: t("mobileShop.inStock"),
    RESERVED: t("mobileShop.reserved"),
    SOLD: t("mobileShop.sold"),
    IN_REPAIR: t("mobileShop.inRepair"),
    RMA: t("mobileShop.rma"),
  };

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
            {t("mobileShop.imeiLookup")}
          </h2>
          <p className="text-slate-500">{t("mobileShop.imeiLookupDesc")}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="max-w-lg mx-auto space-y-2">
              <div className="flex items-stretch gap-2">
                <Input
                  autoFocus
                  placeholder={t("mobileShop.imeiPlaceholder")}
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
              <Button type="button" className="w-full" onClick={() => handleSearch()}>
                <Search className="mr-2 h-4 w-4" />
                {t("mobileShop.searchDevice")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t("mobileShop.searchHelp")}
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
              <h3 className="text-lg font-semibold text-slate-900">{t("mobileShop.deviceNotFound")}</h3>
              <p className="text-slate-500 mt-1">{t("mobileShop.noDeviceMatchesImei")} <span className="font-mono">{query}</span></p>
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
                    {t("mobileShop.deviceSpecs")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.brand")}</span>
                    <span className="font-medium">{device.brand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.model")}</span>
                    <span className="font-medium">{device.model}</span>
                  </div>
                  {device.color && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.color")}</span>
                      <span>{device.color}</span>
                    </div>
                  )}
                  {device.storageCapacity && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.storage")}</span>
                      <span>{device.storageCapacity}</span>
                    </div>
                  )}
                  {device.ram && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.ram")}</span>
                      <span>{device.ram}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.imei1")}</span>
                    <span className="font-mono text-xs">{device.imei1}</span>
                  </div>
                  {device.imei2 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.imei2")}</span>
                      <span className="font-mono text-xs">{device.imei2}</span>
                    </div>
                  )}
                  {device.serialNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.serial")}</span>
                      <span className="font-mono text-xs">{device.serialNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.network")}</span>
                    <span>{device.networkStatus}</span>
                  </div>
                  {device.product && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.product")}</span>
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
                  <CardTitle className="text-base">{t("mobileShop.inventoryCondition")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("common.status")}</span>
                    <Badge className={statusColors[device.currentStatus] || "bg-gray-100 text-gray-800"}>
                      {statusLabels[device.currentStatus] || device.currentStatus.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.condition")}</span>
                    <span>{conditionLabels[device.conditionGrade] || device.conditionGrade}</span>
                  </div>
                  {device.batteryHealthPercentage !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.batteryHealth")}</span>
                      <span>{device.batteryHealthPercentage}%</span>
                    </div>
                  )}
                  {device.includedAccessories && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.accessories")}</span>
                      <span className="text-right text-xs">
                        {[
                          device.includedAccessories.box && t("mobileShop.box"),
                          device.includedAccessories.charger && t("mobileShop.charger"),
                          device.includedAccessories.cable && t("mobileShop.cable"),
                        ].filter(Boolean).join(", ") || t("mobileShop.noneAccessories")}
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
                  <CardTitle className="text-base">{t("mobileShop.costSourcing")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {device.supplier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.supplier")}</span>
                      <Link href={`/suppliers`} className="text-blue-600 hover:underline">
                        {device.supplier.name}
                      </Link>
                    </div>
                  )}
                  {device.purchaseInvoice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.purchaseInvoice")}</span>
                      <Link href={`/purchase-invoices/${device.purchaseInvoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {device.purchaseInvoice.purchaseInvoiceNumber}
                      </Link>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.inwardDate")}</span>
                    <span>{new Date(device.inwardDate).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mobileShop.costPrice")}</span>
                    <span>{symbol}{Number(device.costPrice).toLocaleString(locale)}</span>
                  </div>
                  {Number(device.landedCost) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.landedCost")}</span>
                      <span>{symbol}{Number(device.landedCost).toLocaleString(locale)}</span>
                    </div>
                  )}
                  {Number(device.sellingPrice) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.sellingPrice")}</span>
                      <span>{symbol}{Number(device.sellingPrice).toLocaleString(locale)}</span>
                    </div>
                  )}
                  {device.mrp !== null && Number(device.mrp) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.mrp")}</span>
                      <span>{symbol}{Number(device.mrp).toLocaleString(locale)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Sales Details */}
            <StaggerItem>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("mobileShop.salesDetails")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {device.currentStatus === "SOLD" ? (
                    <>
                      {device.customer && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("mobileShop.customer")}</span>
                          <Link href={`/customers`} className="text-blue-600 hover:underline">
                            {device.customer.name}
                          </Link>
                        </div>
                      )}
                      {device.salesInvoice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("mobileShop.salesInvoice")}</span>
                          <Link href={`/invoices/${device.salesInvoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {device.salesInvoice.invoiceNumber}
                          </Link>
                        </div>
                      )}
                      {device.outwardDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("mobileShop.outwardDate")}</span>
                          <span>{new Date(device.outwardDate).toLocaleDateString("en-IN")}</span>
                        </div>
                      )}
                      {device.soldPrice !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("mobileShop.soldPrice")}</span>
                          <span>{symbol}{Number(device.soldPrice).toLocaleString(locale)}</span>
                        </div>
                      )}
                      {device.salesperson && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("mobileShop.salesperson")}</span>
                          <span>{device.salesperson.name}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">{t("mobileShop.notSoldYet")}</p>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Device Photos - Full Width */}
            {device.photoUrls && device.photoUrls.length > 0 && (
              <StaggerItem className="md:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Images className="h-4 w-4" />
                      {t("mobileShop.devicePhotos")} ({device.photoUrls.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {device.photoUrls.map((url, index) => (
                        <div key={url} className="relative group">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${t("mobileShop.photo")} ${index + 1}`}
                              className="h-28 w-28 rounded-md border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <a
                            href={url.replace("/upload/", "/upload/fl_attachment/")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t("common.download")}
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            )}

            {/* Warranty - Full Width */}
            <StaggerItem className="md:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("mobileShop.warranty")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.supplierWarranty")}</span>
                      {device.supplierWarrantyExpiry ? (
                        <span className="flex items-center gap-2">
                          {new Date(device.supplierWarrantyExpiry).toLocaleDateString("en-IN")}
                          <Badge variant={isWarrantyActive(device.supplierWarrantyExpiry) ? "default" : "secondary"} className="text-xs">
                            {isWarrantyActive(device.supplierWarrantyExpiry) ? t("mobileShop.warrantyActive") : t("mobileShop.warrantyExpired")}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("common.na")}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mobileShop.customerWarranty")}</span>
                      {device.customerWarrantyExpiry ? (
                        <span className="flex items-center gap-2">
                          {new Date(device.customerWarrantyExpiry).toLocaleDateString("en-IN")}
                          <Badge variant={isWarrantyActive(device.customerWarrantyExpiry) ? "default" : "secondary"} className="text-xs">
                            {isWarrantyActive(device.customerWarrantyExpiry) ? t("mobileShop.warrantyActive") : t("mobileShop.warrantyExpired")}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("common.na")}</span>
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
