import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { createTokenRequest } from "@/lib/pos/ably-server";

/**
 * GET /api/pos/ably-auth
 *
 * Returns an Ably token request scoped to the user's org channels.
 * Called automatically by the Ably client SDK for token auth.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id;

    const tokenRequest = await createTokenRequest(organizationId, userId);
    if (!tokenRequest) {
      return NextResponse.json(
        { error: "Ably not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably auth error:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 },
    );
  }
}
