import type { Metadata } from "next";
import "./globals.css";
import { storageMode } from "@/lib/supabase/config";
import { JourneyProvider } from "@/components/journey-provider";
export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: {
    default: "FaithQuest365 · Read. Discover. Grow in Faith.",
    template: "%s | FaithQuest365",
  },
  description:
    "A welcoming 365-day Bible reading journey. Read Scripture, reflect, and grow in faith, one day at a time.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <JourneyProvider mode={storageMode()}>{children}</JourneyProvider>
      </body>
    </html>
  );
}
