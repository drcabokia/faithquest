# Reading comfort

Bible Reader offers **Scripture text size** (Standard, Large, Extra large) and **Line spacing** (Comfortable, Relaxed), plus **Reset reading settings**. The controls apply immediately to the passage, including its inline verse paragraphs. Standard keeps the existing 22-pixel base size; Large uses 26 pixels and Extra large 30 pixels at the default browser font scale. Browser zoom still works.

## Try it without developer tools

1. Open **Bible Reader** and wait for a chapter to load. In **Reading comfort**, choose **Extra large** and **Relaxed**. The Scripture words should become larger and more widely spaced. Verse numbers, saved-verse marks and the words themselves should remain available.
2. Open **Next chapter**, visit **My Reading Plan**, then return to **Bible Reader**. Reload the page. Both choices should remain selected.
3. Open FaithQuest in another tab in the same browser profile at the same address. Its reader should use the same settings. Choose **Reset reading settings** there: both tabs should return to Standard and Comfortable.
4. Try the controls using Tab and the arrow keys. Focus should be visible, and you should be able to reach both selectors and the reset button without a mouse.
5. Try a narrow phone window with Extra large and Relaxed. The controls and Scripture should wrap within the page; you should not need to scroll sideways.
6. Confirm that changing the controls alone does not complete a chapter, save/remove a verse or award XP. Normal reading and completion controls should still work.

Report whether these checks pass; no screenshot of personal data or special account is needed. User acceptance remains pending until reported.

## Where settings are remembered

These are browser preferences in both demo and signed-in modes. They are shared across tabs and anyone using the same browser profile and origin, including another account. A different browser/device, private window, port, or hostname has its own settings. Signing out does not reset them; **Reset reading settings** removes the stored preference. Clearing site data also resets them, and can remove local demo progress, so use the reset button for this test.

Preferences contain only a version, text-size choice and line-spacing choice under `faithquest365.reader-preferences.v1`. They contain no identity, Scripture selections or personal writing, are not sent to Supabase, and are not part of account exports or backup recovery. Existing account progress continues to use authenticated server storage.

If browser storage is unavailable, the controls still work for the current visit and show that the choices could not be remembered. Navigating within the app retains those temporary choices; a full reload may reset them. Changing a setting or resetting explicitly retries storage. Invalid or oversized stored preferences show safe defaults and an explanatory message; the original value is retained until an explicit choice/reset. Other tabs read the latest stored value when it changes.

This phase adds no migration, external font, service worker or account setting. Scripture comes from the existing WEB files without rewriting the source. Earlier editorial, account recovery and reading-consistency acceptance gates remain separate.
