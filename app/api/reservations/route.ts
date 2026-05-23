import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { productId, warehouseId, quantity, userId } = await request.json();

    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const reservation = await prisma.$transaction(
      async (tx) => {
        // 1. Lock the stock row using a raw SELECT ... FOR UPDATE query
        // This is the core concurrency-safe mechanism preventing race conditions
        const stocks = await tx.$queryRaw<any[]>`
          SELECT id, "totalUnits", "reservedUnits"
          FROM "Stock"
          WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
          LIMIT 1
          FOR UPDATE;
        `;

        if (!stocks || stocks.length === 0) {
          throw new Error("Stock record not found");
        }

        const stock = stocks[0];
        const available = stock.totalUnits - stock.reservedUnits;

        // 2. Verify stock availability inside the locked transaction block
        if (available < quantity) {
          throw new Error("Not enough stock");
        }

        // 3. Create the pending reservation
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        const newReservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "pending",
            expiresAt,
            userId: userId || "anonymous",
          },
        });

        // 4. Update the reservedUnits on the Stock table
        await tx.stock.update({
          where: { id: stock.id },
          data: {
            reservedUnits: {
              increment: quantity,
            },
          },
        });

        return newReservation;
      },
      {
        maxWait: 40000, // wait up to 40 seconds to acquire connection
        timeout: 45000, // wait up to 45 seconds for execution
      }
    );

    return NextResponse.json(reservation, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Not enough stock") {
        return NextResponse.json({ error: "Not enough stock" }, { status: 409 });
      }
      if (error.message === "Stock record not found") {
        return NextResponse.json({ error: "Stock record not found" }, { status: 404 });
      }
    }
    console.error("Reservation creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
