import { accountResponder } from "@/lib/account-response";
import { serviceHealthy } from "@/lib/service-health";
export const dynamic = "force-dynamic";
export async function GET() {
  const reply = accountResponder("health");
  const ok = await serviceHealthy();
  return reply({ status: ok ? "ok" : "unavailable" }, ok ? 200 : 503);
}
