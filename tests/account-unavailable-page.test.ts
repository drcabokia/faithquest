import { describe, expect, it } from "vitest";
import { accountUnavailablePage } from "../src/lib/account-unavailable-page";

describe("account outage document", () => {
  it("escapes reflected text and retries the same path and query without JavaScript", () => {
    const url = new URL("https://faithquest.test/bible?book=GEN&chapter=2");
    url.searchParams.append(
      '" autofocus onfocus="alert(1)',
      "<script>bad</script>",
    );
    const html = accountUnavailablePage('<reference "test">', url);
    expect(html).toContain('action="/bible"');
    expect(html).toContain('name="chapter" value="2"');
    expect(html).toContain('type="submit">Try again</button>');
    expect(html).toContain("&lt;reference &quot;test&quot;&gt;");
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('name="" autofocus');
  });
});
