import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "FaithQuest365 · Read. Discover. Grow in Faith.", template: "%s | FaithQuest365" }, description: "A welcoming 365-day Bible reading journey. Read Scripture, reflect, and grow in faith, one day at a time." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body>{children}</body></html>; }
