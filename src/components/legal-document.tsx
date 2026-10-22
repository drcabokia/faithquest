import Link from "next/link";
import content from "@/content/legal.json";
import site from "@/content/site.json";
import { Logo } from "./brand";
import { LegalLinks } from "./legal-links";

export function LegalDocument({ kind }: { kind: keyof typeof content }) {
  const document = content[kind];
  return (
    <div className="legal-page">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="legal-header">
        <Logo />
        <Link href="/login" className="text-link">
          Open FaithQuest365
        </Link>
      </header>
      <main id="main-content" className="legal-document">
        <p className="eyebrow">YOUR INFORMATION. YOUR JOURNEY.</p>
        <h1>{document.title}</h1>
        <p className="legal-date">Last updated: {site.updated}</p>
        <p>{document.intro}</p>
        <p>
          FaithQuest365 is operated by <strong>{site.operatorName}</strong>.
          Contact:{" "}
          <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
        </p>
        <nav className="legal-contents" aria-label="On this page">
          {document.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
          <a href="#contact">Contact</a>
        </nav>
        {document.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.links && (
              <ul>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section id="contact">
          <h2>Contact</h2>
          <p>
            For privacy requests, service questions or concerns, contact{" "}
            {site.operatorName} at{" "}
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
          </p>
        </section>
      </main>
      <footer className="legal-footer">
        <Link href="/">FaithQuest365 home</Link>
        <LegalLinks />
      </footer>
    </div>
  );
}
