# Reading comfort

**Profile & Settings → Reading comfort** offers **Scripture text size** (Standard, Large, Extra large) and **Line spacing** (Comfortable, Relaxed), plus **Reset reading settings**. The controls apply immediately to Bible Reader, including inline verse paragraphs. The reader has a **Reading settings** link to this section; **Open Bible Reader** returns to the saved reading position. These device controls are separate from the account form and do not require **Save preferences**. Standard keeps the existing 22-pixel base size; Large uses 26 pixels and Extra large 30 pixels at the default browser font scale. Browser zoom still works.

## Try it without developer tools

1. Open **Bible Reader**, then select **Reading settings**. It should open **Profile & Settings** at **Reading comfort**. There should be one set of text-size/spacing controls in Settings and none above the passage.
2. Choose **Extra large** and **Relaxed**. Select **Open Bible Reader**. The same passage should use larger, more widely spaced Scripture, with its words, verse numbers and saved-verse marks retained.
3. Open **Next chapter**, then revisit **Reading settings**. Reload Settings. Both choices should remain selected. The **Save preferences** button belongs to journey preferences; reading comfort applies immediately.
4. Open FaithQuest in another tab at the same address. Change a reading setting or use **Reset reading settings** in that tab's Settings. The first tab's controls and open reader should update too.
5. At phone width, check Settings controls and the reader links fit without horizontal scrolling. In the reader, verify Extra large text wraps and chapter completion remains available. Try both light and dark appearance.
6. Use Tab/Shift+Tab and the arrow keys to change the selects. Focus should be visible. **Reset reading settings** should restore Standard/Comfortable in both Settings and the reader.
7. If this browser blocks storage, Settings should explain that choices apply for this visit. Internal navigation to the reader and back must retain the in-memory choice. A retry through a setting change/reset should clear the warning once storage is available.

These checks need no second account or developer tools. Use **Profile & Settings** from navigation to reach the controls directly.

## Where settings are remembered

These are browser preferences in both demo and signed-in modes. They are shared across tabs and anyone using the same browser profile and origin, including another account. A different browser/device, private window, port, or hostname has its own settings. Signing out does not reset them; **Reset reading settings** removes the stored preference. Clearing site data also resets them, and can remove local demo progress, so use the reset button for this test.

Preferences contain only a version, text-size choice and line-spacing choice under `faithquest365.reader-preferences.v1`. They contain no identity, Scripture selections or personal writing, are not sent to Supabase, and are not part of account exports or backup recovery. Existing account progress continues to use authenticated server storage.

If browser storage is unavailable, the controls still work for the current visit and show that the choices could not be remembered. Navigating within the app retains those temporary choices; a full reload may reset them. Changing a setting or resetting explicitly retries storage. Invalid or oversized stored preferences show safe defaults and an explanatory message; the original value is retained until an explicit choice/reset. Other tabs read the latest stored value when it changes.

This phase adds no migration, external font, service worker or account setting. Scripture comes from the existing WEB files without rewriting the source. Earlier editorial, account recovery and reading-consistency acceptance gates remain separate.
