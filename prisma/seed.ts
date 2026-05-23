import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean database
  console.log("Cleaning database...");
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log("Seeding warehouses...");
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore", location: "Indiranagar" },
  });
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi", location: "Gurgaon" },
  });
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai", location: "Andheri" },
  });

  const warehouses = [bangalore, delhi, mumbai];

  console.log("Seeding products...");
  const iphone = await prisma.product.create({
    data: { name: "iPhone 15", description: "Latest model" },
  });
  const macbook = await prisma.product.create({
    data: { name: "MacBook Pro", description: "16GB RAM" },
  });
  const airpods = await prisma.product.create({
    data: { name: "AirPods", description: "Noise cancelling" },
  });
  const ipad = await prisma.product.create({
    data: { name: "iPad", description: "10th Gen" },
  });
  const watch = await prisma.product.create({
    data: { name: "Apple Watch", description: "Series 9" },
  });

  const products = [iphone, macbook, airpods, ipad, watch];

  console.log("Seeding stock levels...");
  // Let's create varying stock levels per product across warehouses
  // We want:
  // - Some products with high stock in some warehouses.
  // - One product with exactly 1 unit of stock to easily test concurrency/exhaustion (e.g. AirPods in Bangalore has 1 unit, AirPods in other warehouses has 0).
  // - Some products with 0 stock to test out-of-stock 409 responses directly.
  
  for (const product of products) {
    for (const warehouse of warehouses) {
      let totalUnits = 0;
      if (product.name === "iPhone 15") {
        totalUnits = warehouse.name === "Bangalore" ? 10 : 5;
      } else if (product.name === "MacBook Pro") {
        totalUnits = warehouse.name === "Delhi" ? 8 : 3;
      } else if (product.name === "AirPods") {
        // High concurrency test SKU: Bangalore has exactly 1 unit of stock, others 0
        totalUnits = warehouse.name === "Bangalore" ? 1 : 0;
      } else if (product.name === "iPad") {
        totalUnits = warehouse.name === "Mumbai" ? 15 : 0;
      } else if (product.name === "Apple Watch") {
        // Completely out of stock everywhere
        totalUnits = 0;
      }

      await prisma.stock.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalUnits,
          reservedUnits: 0,
        },
      });
    }
  }

  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
