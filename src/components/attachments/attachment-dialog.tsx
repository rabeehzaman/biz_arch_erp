"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Paperclip,
  Upload,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface AttachmentFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

interface AttachmentDialogProps {
  documentType: string;
  documentId: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS = 5;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/"))
    return <FileImage className="h-5 w-5 shrink-0 text-blue-500" />;
  if (fileType === "application/pdf")
    return <FileText className="h-5 w-5 shrink-0 text-red-500" />;
  if (fileType.includes("spreadsheet") || fileType.includes("excel"))
    return <FileSpreadsheet className="h-5 w-5 shrink-0 text-green-500" />;
  if (fileType.includes("word") || fileType.includes("document"))
    return <FileText className="h-5 w-5 shrink-0 text-blue-600" />;
  return <File className="h-5 w-5 shrink-0 text-slate-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDialog({
  documentType,
  documentId,
}: AttachmentDialogProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/attachments?documentType=${documentType}&documentId=${documentId}`
      );
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
        setCount(data.length);
      }
    } catch {
      // silently fail - user will see empty state
    } finally {
      setIsLoading(false);
    }
  }, [documentType, documentId]);

  // Fetch count on mount (for badge)
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/attachments?documentType=${documentType}&documentId=${documentId}`
    )
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!cancelled) setCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [documentType, documentId]);

  // Fetch full list when dialog opens
  useEffect(() => {
    if (isOpen) fetchAttachments();
  }, [isOpen, fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(t("attachments.invalidFileType"));
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error(t("attachments.fileTooLarge"));
      return;
    }

    if (attachments.length >= MAX_ATTACHMENTS) {
      toast.error(t("attachments.maxFilesReached"));
      return;
    }

    setIsUploading(true);
    try {
      // Step 1: Get presigned URL + create DB record
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          documentId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create attachment");
      }

      const { attachment, uploadUrl } = await res.json();

      // Step 2: Upload file directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        // Clean up DB record if upload fails
        await fetch(`/api/attachments/${attachment.id}`, { method: "DELETE" });
        throw new Error("Upload failed");
      }

      // Add to local state
      setAttachments((prev) => [attachment, ...prev]);
      setCount((prev) => prev + 1);
      toast.success(t("attachments.uploadSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("attachments.uploadFailed")
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");

      setAttachments((prev) => prev.filter((a) => a.id !== id));
      setCount((prev) => prev - 1);
      toast.success(t("attachments.deleteSuccess"));
    } catch {
      toast.error(t("attachments.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (attachment: AttachmentFile) => {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}`);
      if (!res.ok) throw new Error("Failed to get download URL");

      const { downloadUrl } = await res.json();
      window.open(downloadUrl, "_blank");
    } catch {
      toast.error(t("attachments.downloadFailed"));
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative col-span-1 h-9 w-full sm:h-10 sm:w-auto"
        onClick={() => setIsOpen(true)}
      >
        <Paperclip className="h-4 w-4 sm:mr-2" />
        <span className="sm:hidden">
          {count > 0 ? count : ""}
        </span>
        <span className="hidden sm:inline">{t("attachments.title")}</span>
        {count > 0 && (
          <span className="hidden rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground sm:inline-flex">
            {count}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("attachments.title")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {/* File List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : attachments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {t("attachments.noFiles")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                  >
                    {getFileIcon(attachment.fileType)}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleDownload(attachment)}
                        className="block max-w-full truncate text-left text-sm font-medium text-slate-700 hover:text-primary hover:underline"
                      >
                        {attachment.fileName}
                      </button>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(attachment.fileSize)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(attachment.id)}
                      disabled={deletingId === attachment.id}
                      className="shrink-0 text-slate-400 hover:text-red-500"
                    >
                      {deletingId === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || attachments.length >= MAX_ATTACHMENTS}
                className="gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading
                  ? t("attachments.uploading")
                  : t("attachments.uploadFiles")}
              </Button>
              <p className="text-center text-xs text-slate-400">
                {t("attachments.maxFilesInfo")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
