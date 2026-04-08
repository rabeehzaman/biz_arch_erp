import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { r2Client, R2_BUCKET } from "@/lib/r2";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { key } = await request.json();

    if (!key || !key.startsWith(`products/${organizationId}/`)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    await r2Client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete object:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
