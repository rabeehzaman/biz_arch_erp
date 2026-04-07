// GET /api/zatca/submissions — Paginated list of ZATCA submissions
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);
  const { limit, offset } = parsePagination(req);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const documentType = searchParams.get("documentType") || undefined;

  const where = {
    organizationId,
    ...(status ? { status: status as never } : {}),
    ...(documentType ? { documentType: documentType as never } : {}),
  };

  const [submissions, total] = await Promise.all([
    prisma.zatcaSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        documentType: true,
        invoiceId: true,
        creditNoteId: true,
        debitNoteId: true,
        submissionMode: true,
        status: true,
        warningMessages: true,
        errorMessages: true,
        attemptCount: true,
        lastAttemptAt: true,
        createdAt: true,
        invoice: { select: { invoiceNumber: true } },
        creditNote: { select: { creditNoteNumber: true } },
        debitNote: { select: { debitNoteNumber: true } },
      },
    }),
    prisma.zatcaSubmission.count({ where }),
  ]);

  const data = submissions.map((s) => ({
    id: s.id,
    documentType: s.documentType,
    documentId: s.invoiceId || s.creditNoteId || s.debitNoteId,
    documentNumber: s.invoice?.invoiceNumber || s.creditNote?.creditNoteNumber || s.debitNote?.debitNoteNumber,
    submissionMode: s.submissionMode,
    status: s.status,
    warnings: s.warningMessages ? JSON.parse(s.warningMessages) : [],
    errors: s.errorMessages ? JSON.parse(s.errorMessages) : [],
    attemptCount: s.attemptCount,
    lastAttemptAt: s.lastAttemptAt?.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  const hasMore = offset + data.length < total;
  return paginatedResponse(data, total, hasMore);
}
