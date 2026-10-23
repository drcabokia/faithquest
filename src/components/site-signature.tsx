import site from "@/content/site.json";

export function SiteSignature() {
  return <small className="site-signature">By {site.operatorName}</small>;
}
