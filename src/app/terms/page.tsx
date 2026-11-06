import { LegalDocument } from "@/components/legal-document";
import { publicMetadata } from "@/lib/public-metadata";
import content from "@/content/legal.json";

export const metadata = publicMetadata(
  "/terms",
  "Terms of Service",
  content.terms.description,
);
export default function TermsPage() {
  return <LegalDocument kind="terms" />;
}
