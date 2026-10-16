# Bible content and editorial scope

## Provenance

The bundled Scripture is the **World English Bible Classic, 2020 stable text**, downloaded on 16 October 2026 from the publisher’s [VPL archive](https://ebible.org/Scriptures/eng-web_vpl.zip). The publisher dedicates the text to the [public domain](https://ebible.org/eng-web/copyright.htm). The translation name is a trademark; do not change the words and still label the changed text WEB.

`public/bible/provenance.json` records the archive SHA-256, source, license URL, retrieval date, and import scope. The app includes the 66-book Protestant canon from the larger ecumenical source archive. Verse words, punctuation, and Unicode are preserved; source book codes are normalized to consistent app identifiers. Footnotes/headings are not part of this VPL reader. Other canons and languages need their own reviewed plans and content.

Five source verse-number placeholders have no text: Luke 17:36; Acts 8:37, 15:34, 24:7; Romans 16:25. The reader skips empty placeholders and explains that verse numbering follows the edition. It never supplies invented replacement text. This also means a requested reference should be read in its surrounding chapter rather than assuming every verse number has text in every translation.

## Reproduce an import

Download the archive from the publisher, retain it outside tracked source (for example `.cache/web.zip`), then run:

```powershell
python scripts/import_web.py .cache/web.zip
```

Python is a development/import tool, not an application dependency. The importer checks every book’s chapter count, chapter presence, unique verse numbers, and the 1,189-chapter total. It writes JSON and book metadata; run `npm run format` and `npm test` afterward. Review resulting Scripture/provenance changes before committing. Routine builds never download Scripture.

## Schedule

The canonical generator partitions an ordered 1,189-chapter list using `floor(day * 1189 / 365)` boundaries. It creates 365 complete, non-overlapping daily chapter assignments. Chapter lengths vary; this is a chapter-balanced schedule, not an equal-time schedule. The reference SQL uses the same boundaries. Chronological and mixed daily plans remain editorial work, not sample schedules advertised as complete.

## Quiz review

Six demo questions are manually authored and checked against the bundled passages: Genesis 1:5; 2:2–3; 2:15; 5:24; 6:13–14; 9:12–13. Their associated missions are days 1, 2, and 3. Questions and explanations are educational paraphrases, not presented as Scripture quotations. No AI-generated Scripture, quiz, or interpretation is used.
