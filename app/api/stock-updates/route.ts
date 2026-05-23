import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {
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
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error("Error writing to SSE stream:", error);
          // Safely shut down stream if error occurs
          try {
            controller.close();
          } catch (e) {
            // Controller might already be closed
          }
          clearInterval(intervalId);
        }
      };

      // Send initial stock data immediately
      sendStockUpdates("INIT");

      // Set up polling interval to check for changes
      intervalId = setInterval(() => {
        sendStockUpdates("UPDATE");
      }, 1500);
    },
    cancel() {
      // Automatically called when client disconnects
      clearInterval(intervalId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Prevents Nginx from buffering the stream
    },
  });
}
