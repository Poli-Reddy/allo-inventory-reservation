import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing reservation ID" },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status === "released") {
      return NextResponse.json({ success: true, message: "Reservation already released" }, { status: 200 });
    }

    if (reservation.status === "confirmed") {
      return NextResponse.json(
        { error: "Cannot release a confirmed purchase" },
        { status: 400 }
      );
    }

    // Release the reservation in a transaction
    await prisma.$transaction(async (tx) => {
      // Lock the stock row to be safe
      const stocks = await tx.$queryRaw<any[]>`
        SELECT id, "totalUnits", "reservedUnits"
        FROM "Stock"
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId}
        LIMIT 1
        FOR UPDATE;
      `;

      if (!stocks || stocks.length === 0) {
        throw new Error("Stock record not found during release");
      }

      const stock = stocks[0];

      // Update reservation status to released
      await tx.reservation.update({
        where: { id },
        data: { status: "released" },
      });

      // Decrement reserved units back
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          reservedUnits: {
            decrement: reservation.quantity,
          },
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Reservation release error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
