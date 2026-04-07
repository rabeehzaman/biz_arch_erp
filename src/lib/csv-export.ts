import { downloadBlob } from "@/lib/download";

/**
 * CSV generation + download utility with UTF-8 BOM for Arabic Excel support.
 */
export async function downloadCsv(rows: string[][], filename: string) {
  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  await downloadBlob(blob, filename);
}
