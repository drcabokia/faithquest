import { Reader } from "@/components/bible/reader";
import { Suspense } from "react";
import { JourneyLoading } from "@/components/journey-provider";
export default function Page() {
  return (
    <Suspense fallback={<JourneyLoading />}>
      <Reader />
    </Suspense>
  );
}
