import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Inventory Reservation System",
  description: "A highly concurrency-safe, real-time inventory reservation platform for multi-warehouse operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} min-h-screen gradient-bg selection:bg-violet-500/30`}>
        <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
                A
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Allo Health
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                Inventory Hold Panel
              </span>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
