"""Import eBible.org public-domain WEB VPL archive; no network access required.
Usage: python scripts/import_web.py path/to/eng-web_vpl.zip
"""
from pathlib import Path
import zipfile, re, json, hashlib, sys
from datetime import date
BOOK_DATA = """GEN|Genesis|50
EXO|Exodus|40
LEV|Leviticus|27
NUM|Numbers|36
DEU|Deuteronomy|34
JOS|Joshua|24
JDG|Judges|21
RUT|Ruth|4
1SA|1 Samuel|31
2SA|2 Samuel|24
1KI|1 Kings|22
2KI|2 Kings|25
1CH|1 Chronicles|29
2CH|2 Chronicles|36
EZR|Ezra|10
NEH|Nehemiah|13
EST|Esther|10
JOB|Job|42
PSA|Psalms|150
PRO|Proverbs|31
ECC|Ecclesiastes|12
SNG|Song of Solomon|8
ISA|Isaiah|66
JER|Jeremiah|52
LAM|Lamentations|5
EZK|Ezekiel|48
DAN|Daniel|12
HOS|Hosea|14
JOL|Joel|3
AMO|Amos|9
OBA|Obadiah|1
JON|Jonah|4
MIC|Micah|7
NAM|Nahum|3
HAB|Habakkuk|3
ZEP|Zephaniah|3
HAG|Haggai|2
ZEC|Zechariah|14
MAL|Malachi|4
MAT|Matthew|28
MRK|Mark|16
LUK|Luke|24
JHN|John|21
ACT|Acts|28
ROM|Romans|16
1CO|1 Corinthians|16
2CO|2 Corinthians|13
GAL|Galatians|6
EPH|Ephesians|6
PHP|Philippians|4
COL|Colossians|4
1TH|1 Thessalonians|5
2TH|2 Thessalonians|3
1TI|1 Timothy|6
2TI|2 Timothy|4
TIT|Titus|3
PHM|Philemon|1
HEB|Hebrews|13
JAS|James|5
1PE|1 Peter|5
2PE|2 Peter|3
1JN|1 John|5
2JN|2 John|1
3JN|3 John|1
JUD|Jude|1
REV|Revelation|22"""
SOURCE_CODES = dict(SNG="SOL", EZK="EZE", JOL="JOE", NAM="NAH", MRK="MAR", JHN="JOH", PHP="PHI", JAS="JAM", **{"1JN":"1JO","2JN":"2JO","3JN":"3JO"})
archive = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
chapters = {}
with zipfile.ZipFile(archive) as z:
    for line in z.read("eng-web_vpl.txt").decode("utf-8-sig").splitlines():
        match = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if match:
            book, chapter, verse, text = match.groups()
            chapters.setdefault((book, int(chapter)), []).append({"number":int(verse), "text":text})
books = []
for index, row in enumerate(BOOK_DATA.splitlines()):
    book, name, count = row.split("|"); count = int(count)
    source = SOURCE_CODES.get(book, book)
    assert len([c for b,c in chapters if b == source]) == count, book
    books.append(dict(id=book, name=name, chapters=count, testament="OT" if index < 39 else "NT"))
    for chapter in range(1,count+1):
        verses = chapters[(source, chapter)]
        assert verses and verses[0]["number"] == 1
        assert len(set(v["number"] for v in verses)) == len(verses)
        path = root / f"public/bible/{book}/{chapter}.json"
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(dict(book=book,chapter=chapter,translation="WEB",verses=verses),ensure_ascii=False,separators=(",",":")),encoding="utf-8")
assert sum(b["chapters"] for b in books) == 1189
path = root / "src/data/books.ts"; path.parent.mkdir(parents=True,exist_ok=True)
path.write_text("export const BOOKS = " + json.dumps(books,indent=2) + " as const;\nexport type BookId = (typeof BOOKS)[number][\"id\"];\n",encoding="utf-8")
(root / "public/bible/provenance.json").write_text(json.dumps(dict(translation="World English Bible Classic",edition="2020 stable text",source="https://ebible.org/Scriptures/eng-web_vpl.zip",license="Public domain",licenseUrl="https://ebible.org/eng-web/copyright.htm",retrievedOn=date.today().isoformat(),archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),books=66,chapters=1189,note="Protestant canon subset. Verse text preserved; reference identifiers normalized."),indent=2),encoding="utf-8")
print("Imported 66 books and 1189 chapters.")
