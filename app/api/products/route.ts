import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    // Release expired reservations (lazy cleanup) in a transaction
    await prisma.$transaction(async (tx) => {
      const expiredReservations = await tx.reservation.findMany({
        where: {
          status: "pending",
          expiresAt: { lt: now },
        },
      });

      if (expiredReservations.length > 0) {
        console.log(`Found ${expiredReservations.length} expired reservations to clean up.`);
        
        for (const reservation of expiredReservations) {
          // Release reservation
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "released" },
          });

          // Decrement reserved units in stock
          // Use updateMany or update with unique constraint
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
            data: {
              reservedUnits: {
                decrement: reservation.quantity,
              },
            },
          });
        }
      }
    });

    // Fetch all products with stock and warehouse info
    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: {
            warehouse: true,
          },
          orderBy: {
            warehouse: {
              name: "asc",
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch products or perform lazy cleanup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
