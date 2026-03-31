"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

export function SupplierCommentsTab({ supplierId }: { supplierId: string }) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const isAdmin = (session?.user as { role?: string })?.role === "admin" || (session?.user as { role?: string })?.role === "superadmin";

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch");
      setComments(await res.json());
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setIsPosting(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) throw new Error("Failed to post");
      const newComment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setContent("");
      toast.success(t("supplierDetail.commentPosted"));
    } catch (error) {
      console.error("Failed to post comment:", error);
      toast.error(t("common.error"));
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success(t("supplierDetail.commentDeleted"));
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error(t("common.error"));
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Post comment */}
      <Card>
        <CardContent className="pt-6">
          <textarea
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            rows={3}
            placeholder={t("supplierDetail.writeComment")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost();
            }}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {t("supplierDetail.commentShortcut")}
            </p>
            <Button size="sm" onClick={handlePost} disabled={isPosting || !content.trim()}>
              {isPosting ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-2 h-3 w-3" />
              )}
              {t("supplierDetail.postComment")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-600">{t("supplierDetail.noComments")}</h3>
          <p className="text-sm text-slate-400">{t("supplierDetail.noCommentsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="group flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                {comment.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{comment.user.name}</span>
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {(currentUserId === comment.user.id || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
