import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial stock data immediately
  const sendStockUpdates = async (type: "INIT" | "UPDATE") => {
    try {
      const products = await prisma.product.findMany({
        include: {
          stock: {
            include: { warehouse: true },
            orderBy: { warehouse: { name: "asc" } },
          },
        },
        orderBy: { name: "asc" },
      });

      const message = `data: ${JSON.stringify({ type, products })}\n\n`;
      await writer.write(encoder.encode(message));
    } catch (error) {
      console.error("Error writing to SSE stream:", error);
    }
  };

  // Send initial payload
  sendStockUpdates("INIT");

  // Set up polling interval to check for changes
  const interval = setInterval(async () => {
    await sendStockUpdates("UPDATE");
  }, 1500);

  // Clean up on disconnect
  responseStream.writable.on("close", () => {
    clearInterval(interval);
    writer.close().catch(console.error);
  });

  // Provide a clean abort/close handler if client closes
  const response = new NextResponse(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Prevents Nginx from buffering the stream
    },
  });

  return response;
}
