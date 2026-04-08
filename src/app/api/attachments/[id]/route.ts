import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { r2Client, R2_BUCKET } from "@/lib/r2";

// GET - Get presigned download URL for an attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id, organizationId },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: attachment.fileKey,
      ResponseContentDisposition: `attachment; filename="${attachment.fileName}"`,
    });
    const downloadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 300,
    });

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("Failed to get attachment:", error);
    return NextResponse.json(
      { error: "Failed to get attachment" },
      { status: 500 }
    );
  }
}

// DELETE - Delete attachment from DB and R2
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id, organizationId },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Delete from R2
    await r2Client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.fileKey })
    );

    // Delete from DB
    await prisma.attachment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
