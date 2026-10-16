import { Quiz } from "@/components/quiz";
import { Suspense } from "react";
import { JourneyLoading } from "@/components/journey-provider";
export default function Page() {
  return (
    <Suspense fallback={<JourneyLoading />}>
      <Quiz />
    </Suspense>
  );
}
