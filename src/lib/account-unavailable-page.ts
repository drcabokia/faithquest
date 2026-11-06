const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export function accountUnavailablePage(reference: string, retryUrl: URL) {
  const query = [...retryUrl.searchParams]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>A moment to reconnect | FaithQuest365</title><link rel="icon" href="/brand/faithquest365-mark.svg"><link rel="stylesheet" href="/brand/information.css"></head><body class="public-site"><main class="legal-page account-unavailable"><a class="brand" href="/" aria-label="FaithQuest365 home"><img src="/brand/faithquest365-mark.svg" width="46" height="46" alt=""><span>FaithQuest<span class="brand-365">365</span><small>YOUR DAILY WALK IN THE WORD</small></span></a><h1>A moment to reconnect.</h1><p>Your account service is temporarily unavailable. Please try again in a moment.</p><form method="get" action="${escapeHtml(retryUrl.pathname)}">${query}<button class="information-button" type="submit">Try again</button></form><small class="account-reference">Reference: ${escapeHtml(reference)}</small></main></body></html>`;
}
