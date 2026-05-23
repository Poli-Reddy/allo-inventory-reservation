import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
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
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(reservation, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch reservation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
