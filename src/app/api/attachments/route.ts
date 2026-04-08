import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { r2Client, R2_BUCKET } from "@/lib/r2";

const VALID_DOCUMENT_TYPES = new Set([
  "invoice",
  "purchase_invoice",
  "quotation",
  "credit_note",
  "debit_note",
  "expense",
  "journal_entry",
  "inventory_adjustment",
  "stock_transfer",
]);

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

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS = 5;

// GET - List attachments for a document
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get("documentType");
    const documentId = searchParams.get("documentId");

    if (!documentType || !documentId) {
      return NextResponse.json(
        { error: "documentType and documentId are required" },
        { status: 400 }
      );
    }

    const attachments = await prisma.attachment.findMany({
      where: { organizationId, documentType, documentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("Failed to list attachments:", error);
    return NextResponse.json(
      { error: "Failed to list attachments" },
      { status: 500 }
    );
  }
}

// POST - Create attachment record + return presigned upload URL
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { documentType, documentId, fileName, fileSize, fileType } =
      await request.json();

    if (!documentType || !documentId || !fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!VALID_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(fileType)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Allowed: images, PDF, Word, and Excel files",
        },
        { status: 400 }
      );
    }

    if (fileSize > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Check attachment count limit
    const existingCount = await prisma.attachment.count({
      where: { organizationId, documentType, documentId },
    });

    if (existingCount >= MAX_ATTACHMENTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ATTACHMENTS} attachments allowed per document` },
        { status: 400 }
      );
    }

    // Generate R2 key
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `attachments/${organizationId}/${documentType}/${documentId}/${crypto.randomUUID()}-${sanitizedName}`;

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileKey,
      ContentType: fileType,
    });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        organizationId,
        documentType,
        documentId,
        fileName,
        fileKey,
        fileSize,
        fileType,
        uploadedById: session.user.id!,
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ attachment, uploadUrl });
  } catch (error) {
    console.error("Failed to create attachment:", error);
    return NextResponse.json(
      { error: "Failed to create attachment" },
      { status: 500 }
    );
  }
}
