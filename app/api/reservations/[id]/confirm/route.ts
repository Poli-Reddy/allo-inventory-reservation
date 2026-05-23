import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id },
    });

    if (reservation.status !== "pending") {
      return NextResponse.json({ error: "Reservation already processed" }, { status: 400 });
    }

    if (reservation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Reservation expired" }, { status: 410 });
    }

    await prisma.$transaction(async (tx) => {
      // Update reservation status to confirmed
      await tx.reservation.update({
        where: { id },
        data: { status: "confirmed" },
      });

      // No need to update stock here (already reserved in reservedUnits)
    }, {
      maxWait: 20000,
      timeout: 25000,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Reservation confirmation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
