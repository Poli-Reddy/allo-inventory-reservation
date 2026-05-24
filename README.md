# Allo Inventory Reservation System

A highly concurrency-safe, real-time inventory reservation platform for multi-warehouse retail and D2C brands. Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma, and PostgreSQL (hosted on Supabase).

Visit the live Application at [https://allo-inventory-reservation-one.vercel.app?_vercel_share=vFaO7ADAyEDDm3tc7JuyQDQUOIYQC7tg](https://allo-inventory-reservation-one.vercel.app?_vercel_share=vFaO7ADAyEDDm3tc7JuyQDQUOIYQC7tg)

## Core Problem Solved
When shoppers enter checkout, payment processes take several minutes (UPI checks, bank redirects, cards). 
- If stock is decremented at checkout completion: Two shoppers can pay for the same final SKU, causing overselling, refunds, and manual operations cleanup.
- If stock is decremented at add-to-cart: Carts are often abandoned, depleting virtual inventory and tanking conversion.

**The Solution:** An inventory hold pattern. When a shopper proceeds to checkout, we temporarily reserve the product unit for 10 minutes. If payment completes successfully, the stock is permanently decremented. If they cancel or the hold expires, the unit is returned to available stock immediately.

## Key Features
- **Race-Condition-Free Reservations:** Uses PostgreSQL explicit row-level locking (`SELECT ... FOR UPDATE` inside a Prisma sequential transaction block) to prevent double-booking under extreme concurrency.
- **Real-Time Stock Feeds:** Uses Server-Sent Events (SSE) to stream live stock updates directly to front-end page counters.
- **Chaos Mode:** A built-in stress-testing tool on the homepage (with floating trigger and `Ctrl+Shift+C` shortcut) that triggers 10 parallel reservation requests simultaneously to prove race-condition prevention.
- **Lazy Expiry Cleanup:** Expired pending reservations are lazily cleaned up inside database queries during product reads, removing the need for a persistent worker in MVP environments.

---

## Architecture Diagram
![Architecture Diagram](./architecture.png)

---

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- A hosted PostgreSQL instance (e.g., Supabase, Neon, or Railway)

### 1. Clone the Repository
```bash
git clone https://github.com/Poli-Reddy/allo-inventory-reservation.git
cd allo-inventory-reservation
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and specify your PostgreSQL database connection URI:
```env
DATABASE_URL="postgresql://postgres.[USER].[PROJECT_REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=15&pool_timeout=45"
```

### 4. Run Database Migrations
Run Prisma migrations to initialize database tables:
```bash
npx prisma migrate dev --name init
```

### 5. Seed the Database
Seed the database with 3 warehouses (Bangalore, Delhi, Mumbai) and 5 products with different stock counts:
```bash
npx prisma db seed
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000/](http://localhost:3000/) to view the application.

---

## Concurrency Race-Condition Testing
To verify the robustness of our concurrency-safe row-level locking:
1. Make sure your local server is running at [http://localhost:3000/](http://localhost:3000/).
2. Open a separate terminal and run the concurrency verification script:
   ```bash
   npx tsx scripts/test-concurrency.ts
   ```

### What this test does:
- Targets the AirPods SKU in the Bangalore warehouse and resets available stock to exactly 1 unit.
- Dispatches 100 simultaneous network requests attempting to reserve that single unit at the exact same moment.
- Verifies that exactly 1 request succeeds (returning `200 OK`) and exactly 99 requests fail with a conflict (returning `409 Conflict`), validating complete race-condition safety.

---

## Design Choices and Architectural Trade-offs

### 1. PostgreSQL Row Locking (`FOR UPDATE`)
- **Choice:** We use a raw SQL `SELECT ... FOR UPDATE` query inside our `prisma.$transaction` block.
- **Why:** Standard Prisma operations do not natively lock rows during reads. Operating system memory locks or generic transaction levels can lead to serialization failures or double bookings when concurrent transactions read the same stock value. Explicit row locking forces concurrent queries trying to acquire the same row lock to queue behind the first lock, guaranteeing serializable consistency on that record.

### 2. Lazy Expiry Cleanup
- **Choice:** Expired reservations are caught and automatically released back to stock during active reads in `/api/products`.
- **Why:** Implementing a background cron scheduler or Vercel background worker adds architectural complexity, dependency overhead, and costs. Performing checks lazily at read-time is a lightweight, zero-dependency solution.
- **Trade-off:** For a high-traffic production system, compiling inline writes with product queries could slow down list response times. The recommended transition is migrating this function to an active Cron endpoint (`/api/cleanup-expired`) triggered every minute.

### 3. Server-Sent Events (SSE)
- **Choice:** Standard SSE transform-stream is used to stream live updates to catalog page grids.
- **Why:** Lightweight and built natively into standard browser APIs without necessitating WebSockets packages or complex socket servers.
- **Trade-off:** Our SSE endpoint polls the database every 1.5 seconds to query stock levels. For production scaling, integrating this with database change notification triggers (e.g., PostgreSQL `LISTEN`/`NOTIFY` or Prisma middleware pub/sub) would remove database polling entirely.
