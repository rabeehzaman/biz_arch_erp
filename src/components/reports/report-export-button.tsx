"use client";

import { Button } from "@/components/ui/button";
import { Download, FileDown, Printer, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface ReportExportButtonProps {
  onExportCsv: () => void;
  onPrint: () => void;
  disabled?: boolean;
  onDownloadPdf?: () => void;
  isDownloading?: boolean;
}

export function ReportExportButton({
  onExportCsv,
  onPrint,
  disabled,
  onDownloadPdf,
  isDownloading,
}: ReportExportButtonProps) {
  const { t } = useLanguage();

  return (
    <>
      {onDownloadPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPdf}
          disabled={disabled || isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {t("reports.downloadPdf")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onExportCsv} disabled={disabled}>
        <Download className="mr-2 h-4 w-4" />
        {t("reports.exportCsv")}
      </Button>
      <Button variant="outline" size="sm" onClick={onPrint} disabled={disabled}>
        <Printer className="mr-2 h-4 w-4" />
        {t("reports.print")}
      </Button>
    </>
  );
}
