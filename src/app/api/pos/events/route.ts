import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { posEventBus } from "@/lib/pos-event-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const organizationId = getOrgId(session);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to events for this org
      const unsubscribe = posEventBus.subscribe(organizationId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        } catch {
          // Client disconnected
          unsubscribe();
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      // Cleanup when client disconnects
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      // AbortSignal not available on controller directly,
      // but the stream will throw when client disconnects
      controller.enqueue(encoder.encode(": ready\n\n"));

      // Store cleanup for cancel
      (controller as any)._cleanup = cleanup;
    },
    cancel(controller) {
      (controller as any)?._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
