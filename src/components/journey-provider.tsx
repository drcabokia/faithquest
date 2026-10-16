"use client";
import dynamic from "next/dynamic";
import type { StorageMode } from "@/lib/supabase/config";
const Demo = dynamic(() =>
  import("./demo-journey-provider").then((m) => m.DemoJourneyProvider),
);
const Account = dynamic(() =>
  import("./account-journey-provider").then((m) => m.AccountJourneyProvider),
);
export { useJourney, JourneyLoading } from "./journey-context";
export function JourneyProvider({
  children,
  mode = "demo",
}: {
  children: React.ReactNode;
  mode?: StorageMode;
}) {
  return mode === "supabase" ? (
    <Account>{children}</Account>
  ) : (
    <Demo>{children}</Demo>
  );
}
