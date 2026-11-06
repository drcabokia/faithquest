import { LegalDocument } from "@/components/legal-document";
import { publicMetadata } from "@/lib/public-metadata";
import content from "@/content/legal.json";

export const metadata = publicMetadata(
  "/privacy",
  "Privacy Policy",
  content.privacy.description,
);
export default function PrivacyPage() {
  return <LegalDocument kind="privacy" />;
}
