import type { BookId } from "./books";

export const CHRONOLOGICAL_DRAFT_ID = "chronological-draft-v1";
export type PlacementSource =
  | {
      kind: "scripture";
      label: string;
      book: BookId;
      chapter: number;
      verses: readonly number[];
    }
  | { kind: "guide"; label: string; href: string };
export type PlacementNote = {
  id: string;
  title: string;
  text: string;
  sources: readonly PlacementSource[];
};
export const CHRONOLOGICAL_NOTES: readonly PlacementNote[] = [
  {
    id: "job-setting",
    title: "Job's placement is uncertain",
    text: "Job is placed between Genesis 11 and Abraham's story as an editorial reading choice. The text introduces Uz but gives no date connecting Job to Genesis. This placement does not establish when the events occurred or when the book was written.",
    sources: [
      {
        kind: "scripture",
        label: "Job 1:1",
        book: "JOB",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "guide",
        label: "BibleProject: Job's unspecified setting",
        href: "https://bibleproject.com/guides/book-of-job/",
      },
    ],
  },
  {
    id: "judges-ruth",
    title: "Ruth and the judges",
    text: "Ruth's opening places its story in the time of the judges. Reading the whole book after Judges preserves its narrative rather than identifying an exact year within Judges.",
    sources: [
      {
        kind: "scripture",
        label: "Ruth 1:1",
        book: "RUT",
        chapter: 1,
        verses: [1],
      },
    ],
  },
  {
    id: "parallel-history",
    title: "Chronicles revisits earlier history",
    text: "Chronicles is read alongside broad periods in Samuel and Kings. Its genealogies span many generations, and its narratives retell events already read. Whole-chapter blocks preserve those accounts; they are not a day-by-day harmony. Second Chronicles 36 also reaches from exile to Cyrus's return decree.",
    sources: [
      {
        kind: "scripture",
        label: "1 Chronicles 9:1–3",
        book: "1CH",
        chapter: 9,
        verses: [1, 2, 3],
      },
      {
        kind: "scripture",
        label: "2 Chronicles 36:20–23",
        book: "2CH",
        chapter: 36,
        verses: [20, 21, 22, 23],
      },
    ],
  },
  {
    id: "psalms-anthology",
    title: "Psalms belongs to many periods",
    text: "The whole Psalms collection follows the David narratives for reading context. This does not date all psalms to David: Psalm 137 recalls Babylon, and the collection contains work from different periods. Review may move individual psalms alongside their contexts.",
    sources: [
      {
        kind: "scripture",
        label: "Psalm 137:1",
        book: "PSA",
        chapter: 137,
        verses: [1],
      },
      {
        kind: "guide",
        label: "BibleProject: Psalms across Israel's history",
        href: "https://bibleproject.com/guides/book-of-psalms/",
      },
    ],
  },
  {
    id: "wisdom-collections",
    title: "Wisdom books and Solomon",
    text: "Proverbs, Ecclesiastes and Song of Solomon follow the Solomon narratives as a contextual grouping. This does not assign every passage or its final collection to Solomon's lifetime. Proverbs itself identifies material associated with Hezekiah, Agur and Lemuel; authorship and dating require editorial review.",
    sources: [
      {
        kind: "scripture",
        label: "Proverbs 25:1",
        book: "PRO",
        chapter: 25,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Proverbs 30:1",
        book: "PRO",
        chapter: 30,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Proverbs 31:1",
        book: "PRO",
        chapter: 31,
        verses: [1],
      },
    ],
  },
  {
    id: "prophet-context",
    title: "Prophets grouped by narrative context",
    text: "Jonah is read near the kingdom narratives, while Amos and Hosea follow their opening royal settings. These anchors support broad contexts rather than an exact sequence of every oracle. Undated material such as Habakkuk remains a proposed placement.",
    sources: [
      {
        kind: "scripture",
        label: "2 Kings 14:25",
        book: "2KI",
        chapter: 14,
        verses: [25],
      },
      {
        kind: "scripture",
        label: "Amos 1:1",
        book: "AMO",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Hosea 1:1",
        book: "HOS",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Zephaniah 1:1",
        book: "ZEP",
        chapter: 1,
        verses: [1],
      },
    ],
  },
  {
    id: "isaiah-span",
    title: "Isaiah reaches beyond one reign",
    text: "Isaiah remains intact near the Assyrian-period narratives. Its opening names several kings, while later chapters look toward Cyrus and restoration. This contextual placement does not settle composition questions or make every chapter contemporary with Hezekiah.",
    sources: [
      {
        kind: "scripture",
        label: "Isaiah 1:1",
        book: "ISA",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Isaiah 44:28",
        book: "ISA",
        chapter: 44,
        verses: [28],
      },
    ],
  },
  {
    id: "jerusalem-fall",
    title: "Jerusalem's fall and Obadiah",
    text: "Jeremiah's opening spans Josiah through the exile, and its final chapter retells Jerusalem's fall. Obadiah is placed near the fall because it describes strangers entering Jerusalem, but that passage alone does not establish a precise date. Its placement remains open to review.",
    sources: [
      {
        kind: "scripture",
        label: "Jeremiah 1:2–3",
        book: "JER",
        chapter: 1,
        verses: [2, 3],
      },
      {
        kind: "scripture",
        label: "Jeremiah 52:12–13",
        book: "JER",
        chapter: 52,
        verses: [12, 13],
      },
      {
        kind: "scripture",
        label: "Obadiah 1:11",
        book: "OBA",
        chapter: 1,
        verses: [11],
      },
    ],
  },
  {
    id: "exile-visions",
    title: "Exile narratives and visions",
    text: "Ezekiel's opening supplies an exile setting. Daniel is grouped here by its narrative setting, not by a claim about its composition date. Daniel's later visions revisit earlier reigns: chapter 7 returns to Belshazzar after chapter 6's Darius narrative. Whole books preserve these shifts and future visions.",
    sources: [
      {
        kind: "scripture",
        label: "Ezekiel 1:1–3",
        book: "EZK",
        chapter: 1,
        verses: [1, 2, 3],
      },
      {
        kind: "scripture",
        label: "Daniel 6:1",
        book: "DAN",
        chapter: 6,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Daniel 7:1",
        book: "DAN",
        chapter: 7,
        verses: [1],
      },
    ],
  },
  {
    id: "return-rebuilding",
    title: "Return and temple rebuilding",
    text: "Haggai and Zechariah are read between Ezra 1–4 and Ezra 5–6 because Ezra 5 names their prophetic work during rebuilding. Ezra 4 includes a look ahead to opposition under later kings; Esther, Ezra's later arrival and Nehemiah are grouped by their narrative royal settings. This is not a resolution of every Persian-period chronology question.",
    sources: [
      {
        kind: "scripture",
        label: "Ezra 4:6–7",
        book: "EZR",
        chapter: 4,
        verses: [6, 7],
      },
      {
        kind: "scripture",
        label: "Ezra 5:1–2",
        book: "EZR",
        chapter: 5,
        verses: [1, 2],
      },
      {
        kind: "scripture",
        label: "Esther 1:1",
        book: "EST",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Ezra 7:1",
        book: "EZR",
        chapter: 7,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "Nehemiah 2:1",
        book: "NEH",
        chapter: 2,
        verses: [1],
      },
    ],
  },
  {
    id: "joel-date",
    title: "Joel's date is unresolved",
    text: "Joel is provisionally placed near the return-period books. Its opening does not name a king or date; other placements remain possible. The linked guide argues for a post-exile setting, which is one interpretation rather than an agreed date.",
    sources: [
      {
        kind: "scripture",
        label: "Joel 1:1–3",
        book: "JOL",
        chapter: 1,
        verses: [1, 2, 3],
      },
      {
        kind: "guide",
        label: "BibleProject: Joel's proposed setting",
        href: "https://bibleproject.com/guides/book-of-joel/",
      },
    ],
  },
  {
    id: "gospel-accounts",
    title: "Four accounts of Jesus's life",
    text: "Each Gospel stays intact, so the next Gospel returns to earlier events in Jesus's life. Luke describes arranging an account, and John explains his selection of signs. This draft is not a verse-level Gospel harmony, and book order does not claim composition order.",
    sources: [
      {
        kind: "scripture",
        label: "Luke 1:1–4",
        book: "LUK",
        chapter: 1,
        verses: [1, 2, 3, 4],
      },
      {
        kind: "scripture",
        label: "John 20:30–31",
        book: "JHN",
        chapter: 20,
        verses: [30, 31],
      },
    ],
  },
  {
    id: "acts-letters",
    title: "Letters alongside Acts are provisional",
    text: "Letters interrupt Acts at broad contextual points. Galatians follows Acts 13–14 as one possible placement; its relation to the Jerusalem meeting is debated. The order of James, the Thessalonian letters, Corinthian letters and Romans needs independent chronology review. These reading positions are not assertions of exact dates.",
    sources: [
      {
        kind: "scripture",
        label: "Acts 13:14",
        book: "ACT",
        chapter: 13,
        verses: [14],
      },
      {
        kind: "scripture",
        label: "Acts 14:23",
        book: "ACT",
        chapter: 14,
        verses: [23],
      },
      {
        kind: "scripture",
        label: "Galatians 2:1",
        book: "GAL",
        chapter: 2,
        verses: [1],
      },
      {
        kind: "scripture",
        label: "1 Corinthians 16:8",
        book: "1CO",
        chapter: 16,
        verses: [8],
      },
      {
        kind: "guide",
        label: "BibleProject: Galatians and Acts context",
        href: "https://bibleproject.com/guides/book-of-galatians/",
      },
    ],
  },
  {
    id: "later-letters",
    title: "Captivity and later letters",
    text: "Letters associated with imprisonment follow Acts 28, which ends with Paul under guard in Rome. This does not settle where each letter was written. The remaining letters use a provisional reading order: their dates, some authorship questions and their relation to Acts require review.",
    sources: [
      {
        kind: "scripture",
        label: "Acts 28:16; 30–31",
        book: "ACT",
        chapter: 28,
        verses: [16, 30, 31],
      },
      {
        kind: "scripture",
        label: "Philippians 1:13",
        book: "PHP",
        chapter: 1,
        verses: [13],
      },
      {
        kind: "scripture",
        label: "Philemon 1:1",
        book: "PHM",
        chapter: 1,
        verses: [1],
      },
    ],
  },
  {
    id: "revelation-genre",
    title: "Revelation concludes with visions of hope",
    text: "Revelation ends the reading journey. Its visions are not a sequence of past events to place after the letters, and this position does not resolve its composition date or the different Christian interpretations of its visions.",
    sources: [
      {
        kind: "scripture",
        label: "Revelation 1:1–3",
        book: "REV",
        chapter: 1,
        verses: [1, 2, 3],
      },
    ],
  },
];

export type DraftSegment = {
  id: string;
  title: string;
  readings: readonly (BookId | readonly [BookId, number, number])[];
  notes: readonly string[];
};
// Original contextual ordering. No third-party daily schedule is reproduced.
export const CHRONOLOGICAL_SEGMENTS: readonly DraftSegment[] = [
  {
    id: "beginnings",
    title: "Beginnings",
    readings: [["GEN", 1, 11]],
    notes: [],
  },
  {
    id: "job",
    title: "Job: undated setting",
    readings: ["JOB"],
    notes: ["job-setting"],
  },
  {
    id: "patriarchs",
    title: "Abraham and his family",
    readings: [["GEN", 12, 50]],
    notes: [],
  },
  { id: "exodus", title: "Exodus and covenant", readings: ["EXO"], notes: [] },
  {
    id: "wilderness",
    title: "Law and wilderness",
    readings: ["LEV", "NUM", "DEU"],
    notes: [],
  },
  {
    id: "land",
    title: "Land and judges",
    readings: ["JOS", "JDG", "RUT"],
    notes: ["judges-ruth"],
  },
  { id: "saul", title: "Samuel and Saul", readings: ["1SA"], notes: [] },
  {
    id: "lineages",
    title: "Lineages and Saul revisited",
    readings: [["1CH", 1, 10]],
    notes: ["parallel-history"],
  },
  {
    id: "david",
    title: "David's reign and parallel account",
    readings: ["2SA", ["1CH", 11, 29]],
    notes: ["parallel-history"],
  },
  {
    id: "psalms",
    title: "Psalms across the generations",
    readings: ["PSA"],
    notes: ["psalms-anthology"],
  },
  {
    id: "solomon",
    title: "Solomon and the temple",
    readings: [
      ["1KI", 1, 11],
      ["2CH", 1, 9],
    ],
    notes: ["parallel-history"],
  },
  {
    id: "wisdom",
    title: "Wisdom collections",
    readings: ["PRO", "ECC", "SNG"],
    notes: ["wisdom-collections"],
  },
  {
    id: "kingdoms",
    title: "Divided kingdoms",
    readings: [
      ["1KI", 12, 22],
      ["2CH", 10, 20],
      ["2KI", 1, 14],
      ["2CH", 21, 25],
    ],
    notes: ["parallel-history"],
  },
  {
    id: "israel-prophets",
    title: "Jonah, Amos and Hosea",
    readings: ["JON", "AMO", "HOS"],
    notes: ["prophet-context"],
  },
  {
    id: "assyria",
    title: "Kingdoms under Assyrian pressure",
    readings: [
      ["2KI", 15, 20],
      ["2CH", 26, 32],
    ],
    notes: ["parallel-history"],
  },
  {
    id: "assyria-prophets",
    title: "Isaiah, Micah and Nahum",
    readings: ["ISA", "MIC", "NAM"],
    notes: ["isaiah-span", "prophet-context"],
  },
  {
    id: "judah",
    title: "Judah through Josiah",
    readings: [
      ["2KI", 21, 23],
      ["2CH", 33, 35],
    ],
    notes: ["parallel-history"],
  },
  {
    id: "warnings",
    title: "Warnings before Jerusalem's fall",
    readings: ["ZEP", "HAB", ["JER", 1, 51]],
    notes: ["prophet-context", "jerusalem-fall"],
  },
  {
    id: "fall",
    title: "Fall of Jerusalem and lament",
    readings: [["2KI", 24, 25], ["2CH", 36, 36], ["JER", 52, 52], "LAM", "OBA"],
    notes: ["parallel-history", "jerusalem-fall"],
  },
  {
    id: "exile",
    title: "Exile narratives and visions",
    readings: ["EZK", "DAN"],
    notes: ["exile-visions"],
  },
  {
    id: "return",
    title: "Return and opposition",
    readings: [["EZR", 1, 4]],
    notes: ["return-rebuilding"],
  },
  {
    id: "rebuilding",
    title: "Prophets during rebuilding",
    readings: ["HAG", "ZEC"],
    notes: ["return-rebuilding"],
  },
  {
    id: "temple",
    title: "Temple rebuilding completed",
    readings: [["EZR", 5, 6]],
    notes: ["return-rebuilding"],
  },
  {
    id: "esther",
    title: "Esther in Persia",
    readings: ["EST"],
    notes: ["return-rebuilding"],
  },
  {
    id: "ezra",
    title: "Ezra's later arrival",
    readings: [["EZR", 7, 10]],
    notes: ["return-rebuilding"],
  },
  {
    id: "nehemiah",
    title: "Nehemiah and Jerusalem",
    readings: ["NEH"],
    notes: ["return-rebuilding"],
  },
  {
    id: "joel",
    title: "Joel: proposed return-period placement",
    readings: ["JOL"],
    notes: ["joel-date"],
  },
  { id: "malachi", title: "Malachi", readings: ["MAL"], notes: [] },
  {
    id: "gospels",
    title: "Four Gospel accounts",
    readings: ["MAT", "MRK", "LUK", "JHN"],
    notes: ["gospel-accounts"],
  },
  {
    id: "early-church",
    title: "Early church and James",
    readings: [["ACT", 1, 12], "JAS"],
    notes: ["acts-letters"],
  },
  {
    id: "galatia",
    title: "Mission journeys and Galatians",
    readings: [["ACT", 13, 14], "GAL"],
    notes: ["acts-letters"],
  },
  {
    id: "thessalonica",
    title: "Further journeys and Thessalonian letters",
    readings: [["ACT", 15, 18], "1TH", "2TH"],
    notes: ["acts-letters"],
  },
  {
    id: "ephesus",
    title: "Ephesus and 1 Corinthians",
    readings: [["ACT", 19, 19], "1CO"],
    notes: ["acts-letters"],
  },
  {
    id: "greece",
    title: "Greece and further letters",
    readings: [["ACT", 20, 20], "2CO", "ROM"],
    notes: ["acts-letters"],
  },
  {
    id: "rome",
    title: "Journey to Rome",
    readings: [["ACT", 21, 28]],
    notes: ["later-letters"],
  },
  {
    id: "captivity",
    title: "Letters associated with captivity",
    readings: ["EPH", "PHP", "COL", "PHM"],
    notes: ["later-letters"],
  },
  {
    id: "later-letters",
    title: "Further apostolic letters",
    readings: [
      "1TI",
      "TIT",
      "2TI",
      "1PE",
      "2PE",
      "HEB",
      "JUD",
      "1JN",
      "2JN",
      "3JN",
    ],
    notes: ["later-letters"],
  },
  {
    id: "hope",
    title: "Revelation and hope",
    readings: ["REV"],
    notes: ["revelation-genre"],
  },
];
