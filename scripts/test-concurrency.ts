import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testConcurrency() {
  console.log("Starting concurrency race-condition simulation...");

  // 1. Fetch first available product with stock
  const product = await prisma.product.findFirst({
    include: {
      stock: {
        include: { warehouse: true },
      },
    },
  });

  if (!product || product.stock.length === 0) {
    throw new Error("No products or stock records found to test. Run db seed first.");
  }

  const stock = product.stock[0];
  const productId = product.id;
  const warehouseId = stock.warehouseId;

  console.log(`Targeting SKU: ${product.name} in warehouse: ${stock.warehouse.name}`);
  console.log("Resetting stock levels to exactly 1 unit for testing...");

  // 2. Reset stock to 1 unit and 0 reserved units for testing race conditions
  await prisma.stock.update({
    where: { id: stock.id },
    data: {
      totalUnits: 1,
      reservedUnits: 0,
    },
  });

  // Clean any pending reservations for this SKU to prevent interference
  await prisma.reservation.deleteMany({
    where: {
      productId,
      warehouseId,
      status: "pending",
    },
  });

  console.log("Firing 100 parallel reservation requests simultaneously...");

  // 3. Fire 100 parallel fetch requests
  const requests = Array(100)
    .fill(null)
    .map(async (_, index) => {
      try {
        const response = await fetch("http://localhost:3000/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            warehouseId,
            quantity: 1,
            userId: `test-racer-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
          }),
        });
        return response.status;
      } catch (error) {
        return 500;
      }
    });

  const results = await Promise.all(requests);
  const successCount = results.filter((status) => status === 200).length;
  const conflictCount = results.filter((status) => status === 409).length;
  const errorCount = results.filter((status) => status !== 200 && status !== 409).length;

  console.log("\nRace Results Summary:");
  console.log(`Successes (200 OK): ${successCount}`);
  console.log(`Conflicts (409 Conflict): ${conflictCount}`);
  console.log(`Other failures/errors: ${errorCount}`);

  // 4. Validate results
  if (successCount === 1 && conflictCount === 99) {
    console.log("\nVerification: Concurrency test passed!");
    console.log("The SELECT ... FOR UPDATE row lock successfully locked the stock row,");
    console.log("permitting exactly 1 user to secure the unit and blocking the other 99 racers with 409 errors.");
  } else {
    console.log("\nVerification: Concurrency test failed!");
    console.log(`Expected exactly 1 success and 99 conflicts, but got ${successCount} successes and ${conflictCount} conflicts.`);
  }
}

testConcurrency()
  .catch((err) => {
    console.error("Test script failed with error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
