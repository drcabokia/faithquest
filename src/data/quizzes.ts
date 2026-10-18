export type QuizQuestion = {
  id: string;
  day: number;
  question: string;
  options: [string, string, string, string];
  correct: number;
  reference: string;
  explanation: string;
};
// Editorial questions checked against the bundled WEB passages. This is demo content, not a full year of quizzes.
export const QUESTIONS: QuizQuestion[] = [
  {
    id: "gen-light",
    day: 1,
    question: "What did God call the light?",
    options: ["Day", "Heaven", "Earth", "Sea"],
    correct: 0,
    reference: "Genesis 1:5",
    explanation: "God called the light day and the darkness night.",
  },
  {
    id: "gen-rest",
    day: 1,
    question: "On which day did God rest from his work?",
    options: [
      "The third day",
      "The sixth day",
      "The seventh day",
      "The first day",
    ],
    correct: 2,
    reference: "Genesis 2:2–3",
    explanation: "God rested on the seventh day, blessed it, and made it holy.",
  },
  {
    id: "gen-garden",
    day: 1,
    question: "Where did God place the man to cultivate and keep it?",
    options: ["Babel", "The garden of Eden", "Egypt", "Mount Sinai"],
    correct: 1,
    reference: "Genesis 2:15",
    explanation:
      "Yahweh God placed the man in the garden of Eden to cultivate and keep it.",
  },
  {
    id: "gen-noah",
    day: 2,
    question: "Who was told to build an ark?",
    options: ["Abraham", "Moses", "Noah", "David"],
    correct: 2,
    reference: "Genesis 6:13–14",
    explanation:
      "God spoke to Noah and instructed him to make an ark of gopher wood.",
  },
  {
    id: "gen-walk",
    day: 2,
    question: "Who is described as having walked with God before God took him?",
    options: ["Cain", "Enoch", "Lamech", "Pharaoh"],
    correct: 1,
    reference: "Genesis 5:24",
    explanation:
      "Genesis records that Enoch walked with God, and God took him.",
  },
  {
    id: "gen-rainbow",
    day: 3,
    question: "What sign did God give of his covenant with the earth?",
    options: [
      "A rainbow in the cloud",
      "A pillar of fire",
      "A stone tablet",
      "A star",
    ],
    correct: 0,
    reference: "Genesis 9:12–13",
    explanation:
      "God set his rainbow in the cloud as a sign of the covenant between himself and the earth.",
  },
  {
    id: "gen-babel",
    day: 4,
    question: "Why was the city called Babel?",
    options: [
      "It was built beside the sea",
      "Yahweh confused the language there",
      "It was Abram’s birthplace",
      "Noah landed there",
    ],
    correct: 1,
    reference: "Genesis 11:9",
    explanation:
      "Genesis connects Babel’s name with Yahweh confusing the language of the earth.",
  },
  {
    id: "gen-abram-age",
    day: 4,
    question: "How old was Abram when he departed from Haran?",
    options: ["Forty", "Sixty", "Seventy-five", "One hundred"],
    correct: 2,
    reference: "Genesis 12:4",
    explanation:
      "Abram was seventy-five when he left Haran as Yahweh had told him.",
  },
  {
    id: "gen-melchizedek",
    day: 5,
    question: "What did Melchizedek bring out?",
    options: [
      "Bread and wine",
      "Milk and honey",
      "Fish and oil",
      "Silver and gold",
    ],
    correct: 0,
    reference: "Genesis 14:18",
    explanation:
      "Melchizedek, king of Salem and priest of God Most High, brought bread and wine.",
  },
  {
    id: "gen-ishmael",
    day: 5,
    question: "What did Abram name the son Hagar bore him?",
    options: ["Isaac", "Jacob", "Joseph", "Ishmael"],
    correct: 3,
    reference: "Genesis 16:15",
    explanation: "Abram named Hagar’s son Ishmael.",
  },
  {
    id: "gen-abraham-name",
    day: 6,
    question: "What new name did God give Abram?",
    options: ["Israel", "Abraham", "Isaac", "Aaron"],
    correct: 1,
    reference: "Genesis 17:5",
    explanation:
      "God changed Abram’s name to Abraham and spoke of making him the father of many nations.",
  },
  {
    id: "gen-lots-wife",
    day: 6,
    question: "What did Lot’s wife become after looking back?",
    options: ["A pillar of salt", "A tree", "A cloud", "A spring"],
    correct: 0,
    reference: "Genesis 19:26",
    explanation:
      "Genesis records that Lot’s wife looked back and became a pillar of salt.",
  },
  {
    id: "gen-isaac-name",
    day: 7,
    question: "What did Abraham name the son Sarah bore him?",
    options: ["Ishmael", "Esau", "Isaac", "Judah"],
    correct: 2,
    reference: "Genesis 21:3",
    explanation: "Abraham named the son born to him and Sarah Isaac.",
  },
  {
    id: "gen-ram",
    day: 7,
    question: "What animal did Abraham see caught in the thicket by its horns?",
    options: ["A calf", "A goat", "A donkey", "A ram"],
    correct: 3,
    reference: "Genesis 22:13",
    explanation:
      "Abraham saw a ram caught by its horns and offered it instead of his son.",
  },
  {
    id: "gen-sarah-burial",
    day: 8,
    question: "Where did Abraham bury Sarah?",
    options: [
      "A cave at Mount Sinai",
      "The cave of Machpelah",
      "A field in Egypt",
      "A garden in Babel",
    ],
    correct: 1,
    reference: "Genesis 23:19",
    explanation:
      "Abraham buried Sarah in the cave of the field of Machpelah, before Mamre.",
  },
  {
    id: "gen-esau-meal",
    day: 8,
    question: "What meal did Jacob give Esau?",
    options: [
      "Bread and lentil stew",
      "Fish and bread",
      "Roasted lamb and herbs",
      "Manna and quail",
    ],
    correct: 0,
    reference: "Genesis 25:34",
    explanation:
      "Jacob gave Esau bread and lentil stew after the exchange concerning Esau’s birthright.",
  },
  {
    id: "gen-stairway",
    day: 9,
    question: "What did Jacob see reaching from earth to heaven in his dream?",
    options: ["A river", "A tower", "A stairway", "A mountain"],
    correct: 2,
    reference: "Genesis 28:12",
    explanation:
      "Jacob dreamed of a stairway reaching to heaven, with God’s angels ascending and descending.",
  },
  {
    id: "gen-rachel-years",
    day: 9,
    question: "How many years did Jacob offer to serve for Rachel?",
    options: ["Three", "Seven", "Ten", "Twenty"],
    correct: 1,
    reference: "Genesis 29:18",
    explanation:
      "Jacob offered to serve Laban seven years for Rachel, his younger daughter.",
  },
  {
    id: "gen-joseph-name",
    day: 10,
    question: "What did Rachel name her son in this verse?",
    options: ["Benjamin", "Dan", "Levi", "Joseph"],
    correct: 3,
    reference: "Genesis 30:24",
    explanation:
      "Rachel named her son Joseph and asked Yahweh to add another son.",
  },
  {
    id: "gen-israel-name",
    day: 10,
    question: "What new name was Jacob given?",
    options: ["Israel", "Abraham", "Edom", "Judah"],
    correct: 0,
    reference: "Genesis 32:28",
    explanation: "Jacob was told that his name would be Israel.",
  },
  {
    id: "gen-esau-greeting",
    day: 11,
    question: "How did Esau greet Jacob when they met?",
    options: [
      "He hid from him",
      "He embraced and kissed him",
      "He took him prisoner",
      "He sent him away",
    ],
    correct: 1,
    reference: "Genesis 33:4",
    explanation: "Esau ran to Jacob, embraced and kissed him, and they wept.",
  },
  {
    id: "gen-rachel-burial",
    day: 11,
    question: "Near which place was Rachel buried?",
    options: ["Bethel", "Shechem", "Ephrath, also called Bethlehem", "Jericho"],
    correct: 2,
    reference: "Genesis 35:19",
    explanation:
      "Rachel was buried on the way to Ephrath, which is also called Bethlehem.",
  },
  {
    id: "gen-joseph-price",
    day: 12,
    question: "For how much was Joseph sold to the Ishmaelites?",
    options: [
      "Ten pieces of gold",
      "Thirty pieces of silver",
      "Fifty pieces of gold",
      "Twenty pieces of silver",
    ],
    correct: 3,
    reference: "Genesis 37:28",
    explanation: "Genesis gives the price as twenty pieces of silver.",
  },
  {
    id: "gen-potiphar",
    day: 12,
    question: "Who bought Joseph in Egypt?",
    options: [
      "Potiphar, Pharaoh’s officer",
      "Laban",
      "Melchizedek",
      "The chief baker",
    ],
    correct: 0,
    reference: "Genesis 39:1",
    explanation:
      "Potiphar, an officer of Pharaoh and captain of the guard, bought Joseph.",
  },
  {
    id: "gen-cupbearer",
    day: 13,
    question: "Whom did Pharaoh restore to his position?",
    options: [
      "The chief baker",
      "The chief cup bearer",
      "Joseph",
      "The prison keeper",
    ],
    correct: 1,
    reference: "Genesis 40:21",
    explanation:
      "Pharaoh restored the chief cup bearer, who again placed the cup in Pharaoh’s hand.",
  },
  {
    id: "gen-famine-years",
    day: 13,
    question:
      "How many years of famine were foretold after the years of plenty?",
    options: ["Three", "Five", "Seven", "Twelve"],
    correct: 2,
    reference: "Genesis 41:30",
    explanation:
      "Joseph foretold seven years of famine after the years of plenty.",
  },
  {
    id: "gen-benjamin-portion",
    day: 14,
    question: "How large was Benjamin’s portion compared with the others?",
    options: [
      "The same size",
      "Twice as large",
      "Three times as large",
      "Five times as large",
    ],
    correct: 3,
    reference: "Genesis 43:34",
    explanation:
      "Benjamin’s portion was five times as large as any of the others’ portions.",
  },
  {
    id: "gen-joseph-revealed",
    day: 14,
    question: "Who did Joseph say he was when he spoke to his brothers?",
    options: [
      "Their brother whom they sold into Egypt",
      "A messenger from Canaan",
      "The chief baker",
      "A merchant from Salem",
    ],
    correct: 0,
    reference: "Genesis 45:4",
    explanation:
      "Joseph identified himself as their brother, whom they had sold into Egypt.",
  },
  {
    id: "gen-jacob-household",
    day: 15,
    question:
      "According to Genesis 46:27, how many people of Jacob’s house came into Egypt?",
    options: ["Seventy", "Forty", "Fifty", "Ninety"],
    correct: 0,
    reference: "Genesis 46:27",
    explanation: "Genesis 46:27 gives the total as seventy people.",
  },
  {
    id: "gen-goshen",
    day: 15,
    question:
      "In which land did Pharaoh tell Joseph to settle his father and brothers?",
    options: ["Gilead", "Goshen", "Moab", "Midian"],
    correct: 1,
    reference: "Genesis 47:6",
    explanation: "Pharaoh told Joseph to let his family dwell in Goshen.",
  },
  {
    id: "gen-joseph-age",
    day: 16,
    question: "How old was Joseph when he died?",
    options: ["Ninety", "One hundred", "One hundred ten", "One hundred twenty"],
    correct: 2,
    reference: "Genesis 50:26",
    explanation: "Joseph died at one hundred ten years old.",
  },
  {
    id: "exo-moses-named",
    day: 16,
    question: "Who named the child Moses after he became her son?",
    options: ["Miriam", "Zipporah", "Moses’ mother", "Pharaoh’s daughter"],
    correct: 3,
    reference: "Exodus 2:10",
    explanation:
      "Pharaoh’s daughter named him Moses, saying that she drew him out of the water.",
  },
  {
    id: "exo-holy-ground",
    day: 17,
    question:
      "What was Moses told to take off because he was standing on holy ground?",
    options: ["His sandals", "His cloak", "His belt", "His head covering"],
    correct: 0,
    reference: "Exodus 3:5",
    explanation:
      "Moses was told to take off his sandals because the place was holy ground.",
  },
  {
    id: "exo-rod-in-hand",
    day: 17,
    question:
      "What did Moses say he was holding when Yahweh asked what was in his hand?",
    options: ["A basket", "A rod", "A cup", "A stone"],
    correct: 1,
    reference: "Exodus 4:2",
    explanation: "Moses answered that he had a rod in his hand.",
  },
  {
    id: "exo-aaron-rod",
    day: 18,
    question: "What did Aaron’s rod do to the other rods?",
    options: [
      "It broke into pieces",
      "It turned into water",
      "It swallowed them",
      "It disappeared",
    ],
    correct: 2,
    reference: "Exodus 7:12",
    explanation: "Aaron’s rod swallowed up the other rods.",
  },
  {
    id: "exo-flies-goshen",
    day: 18,
    question:
      "Which land did Yahweh say would be set apart so no swarms of flies would be there?",
    options: ["Moab", "Edom", "Midian", "Goshen"],
    correct: 3,
    reference: "Exodus 8:22",
    explanation:
      "Yahweh said he would set apart Goshen, where his people lived, from the swarms of flies.",
  },
  {
    id: "exo-darkness-days",
    day: 19,
    question: "How long did the thick darkness in Egypt last?",
    options: ["Three days", "One day", "Seven days", "Forty days"],
    correct: 0,
    reference: "Exodus 10:22",
    explanation: "The thick darkness in Egypt lasted three days.",
  },
  {
    id: "exo-locusts-sea",
    day: 19,
    question: "Where did the strong west wind drive the locusts?",
    options: [
      "The Nile River",
      "The Red Sea",
      "The Jordan River",
      "The Dead Sea",
    ],
    correct: 1,
    reference: "Exodus 10:19",
    explanation: "The strong west wind carried the locusts into the Red Sea.",
  },
  {
    id: "exo-sea-wind",
    day: 20,
    question: "What kind of wind caused the sea to go back through the night?",
    options: [
      "A gentle south wind",
      "A cold north wind",
      "A strong east wind",
      "A strong west wind",
    ],
    correct: 2,
    reference: "Exodus 14:21",
    explanation:
      "Yahweh caused the sea to go back by a strong east wind all night.",
  },
  {
    id: "exo-miriam-instrument",
    day: 20,
    question: "What instrument did Miriam take in her hand?",
    options: ["A harp", "A trumpet", "A flute", "A tambourine"],
    correct: 3,
    reference: "Exodus 15:20",
    explanation:
      "Miriam took a tambourine, and the women followed with tambourines and dances.",
  },
  {
    id: "exo-manna-name",
    day: 21,
    question:
      "What name did the house of Israel give the bread described in Exodus 16:31?",
    options: ["Manna", "Marah", "Massah", "Meribah"],
    correct: 0,
    reference: "Exodus 16:31",
    explanation: "The house of Israel called it Manna.",
  },
  {
    id: "exo-moses-hands",
    day: 21,
    question: "Who held up Moses’ hands until sunset?",
    options: [
      "Joshua and Caleb",
      "Aaron and Hur",
      "Nadab and Abihu",
      "Miriam and Zipporah",
    ],
    correct: 1,
    reference: "Exodus 17:12",
    explanation: "Aaron and Hur supported Moses’ hands, one on each side.",
  },
  {
    id: "exo-mount-sinai",
    day: 22,
    question: "To the top of which mountain did Yahweh call Moses?",
    options: ["Mount Carmel", "Mount Zion", "Mount Sinai", "Mount Nebo"],
    correct: 2,
    reference: "Exodus 19:20",
    explanation: "Yahweh came down on Mount Sinai and called Moses to its top.",
  },
  {
    id: "exo-sabbath-remember",
    day: 22,
    question: "Which day were the people told to remember and keep holy?",
    options: [
      "The first day of each month",
      "The day after the new moon",
      "The first day of each year",
      "The Sabbath day",
    ],
    correct: 3,
    reference: "Exodus 20:8",
    explanation:
      "The command says to remember the Sabbath day and keep it holy.",
  },
  {
    id: "exo-help-donkey",
    day: 23,
    question:
      "What were the people instructed to do for an enemy’s donkey fallen under its burden?",
    options: [
      "Help with its burden",
      "Leave it where it fell",
      "Take it away as payment",
      "Wait for someone else to help",
    ],
    correct: 0,
    reference: "Exodus 23:5",
    explanation:
      "The instruction was not to leave it, but to help with the burden.",
  },
  {
    id: "exo-mountain-forty",
    day: 23,
    question: "How long was Moses on the mountain after entering the cloud?",
    options: [
      "Seven days and seven nights",
      "Forty days and forty nights",
      "Twelve days and twelve nights",
      "Thirty days and thirty nights",
    ],
    correct: 1,
    reference: "Exodus 24:18",
    explanation: "Moses was on the mountain forty days and forty nights.",
  },
  {
    id: "exo-bread-presence",
    day: 24,
    question: "What was to be set on the table before Yahweh continually?",
    options: [
      "A jar of oil",
      "A bowl of salt",
      "Bread of the presence",
      "A basket of figs",
    ],
    correct: 2,
    reference: "Exodus 25:30",
    explanation:
      "Bread of the presence was to be set on the table before Yahweh always.",
  },
  {
    id: "exo-lamp-oil",
    day: 24,
    question:
      "What were the children of Israel to bring for the continually burning lamp?",
    options: ["Water from the Nile", "Grape juice", "Honey", "Pure olive oil"],
    correct: 3,
    reference: "Exodus 27:20",
    explanation: "They were to bring pure olive oil beaten for the light.",
  },
  {
    id: "exo-bezalel-named",
    day: 25,
    question:
      "Who is named as the son of Uri, grandson of Hur, from the tribe of Judah?",
    options: ["Bezalel", "Oholiab", "Aaron", "Joshua"],
    correct: 0,
    reference: "Exodus 31:2",
    explanation:
      "Yahweh named Bezalel, the son of Uri and grandson of Hur, from Judah.",
  },
  {
    id: "exo-dwell-israel",
    day: 25,
    question: "Among whom did Yahweh say he would dwell and be their God?",
    options: [
      "The people of Moab",
      "The children of Israel",
      "The people of Edom",
      "The people of Philistia",
    ],
    correct: 1,
    reference: "Exodus 29:45",
    explanation:
      "Yahweh said he would dwell among the children of Israel and be their God.",
  },
  {
    id: "exo-molded-calf",
    day: 26,
    question:
      "What form did Aaron make from the material the people handed him?",
    options: [
      "A bronze serpent",
      "A golden eagle",
      "A molded calf",
      "A carved lion",
    ],
    correct: 2,
    reference: "Exodus 32:4",
    explanation: "Aaron fashioned a molded calf.",
  },
  {
    id: "exo-moses-face",
    day: 26,
    question:
      "What happened to the skin of Moses’ face after he spoke with Yahweh?",
    options: [
      "It became covered with dust",
      "It became wet with rain",
      "It was painted gold",
      "It shone",
    ],
    correct: 3,
    reference: "Exodus 34:29",
    explanation: "The skin of Moses’ face shone after he spoke with Yahweh.",
  },
  {
    id: "exo-willing-offering",
    day: 27,
    question: "Who brought offerings for the work of the Tent of Meeting?",
    options: [
      "Those whose hearts stirred them and whose spirits made them willing",
      "Only the tribal leaders",
      "Only the soldiers",
      "Only those who owned no livestock",
    ],
    correct: 0,
    reference: "Exodus 35:21",
    explanation:
      "People whose hearts stirred them and whose spirits made them willing brought offerings.",
  },
  {
    id: "exo-material-enough",
    day: 27,
    question: "How much material was available for the work?",
    options: [
      "Only enough for half the work",
      "Enough, and more than enough",
      "None at all",
      "Enough for the garments only",
    ],
    correct: 1,
    reference: "Exodus 36:7",
    explanation:
      "The material was sufficient for all the work, with extra remaining.",
  },
  {
    id: "exo-basin-mirrors",
    day: 28,
    question: "What supplied the bronze used for the basin and its base?",
    options: [
      "Weapons taken from Amalek",
      "Coins collected from merchants",
      "Mirrors of the women serving at the Tent of Meeting’s door",
      "Chains from Egypt’s storehouses",
    ],
    correct: 2,
    reference: "Exodus 38:8",
    explanation:
      "The bronze basin and its base were made from the mirrors of the women serving at the tent’s door.",
  },
  {
    id: "exo-cloud-tent",
    day: 28,
    question:
      "What covered the Tent of Meeting when Yahweh’s glory filled the tabernacle?",
    options: [
      "A curtain of rain",
      "A flock of birds",
      "A roof of branches",
      "The cloud",
    ],
    correct: 3,
    reference: "Exodus 40:34",
    explanation:
      "The cloud covered the Tent of Meeting, and Yahweh’s glory filled the tabernacle.",
  },
  {
    id: "lev-offering-salt",
    day: 29,
    question: "With what were the meal offerings to be seasoned?",
    options: ["Salt", "Honey", "Wine", "Milk"],
    correct: 0,
    reference: "Leviticus 2:13",
    explanation:
      "Leviticus 2:13 instructs that meal offerings be seasoned with salt.",
  },
  {
    id: "lev-priest-bull",
    day: 29,
    question:
      "What was the anointed priest to offer for the sin described in Leviticus 4:3?",
    options: [
      "A pair of doves only",
      "A young bull without defect",
      "A basket of grain only",
      "A goat with a broken leg",
    ],
    correct: 1,
    reference: "Leviticus 4:3",
    explanation:
      "The priest was to bring a young bull without defect as a sin offering.",
  },
  {
    id: "lev-altar-fire",
    day: 30,
    question: "What was to keep burning continually on the altar?",
    options: [
      "A lamp filled with water",
      "A pile of salt",
      "Fire",
      "A bowl of incense only",
    ],
    correct: 2,
    reference: "Leviticus 6:13",
    explanation:
      "Fire was to be kept burning on the altar and was not to go out.",
  },
  {
    id: "lev-thanksgiving-day",
    day: 30,
    question:
      "According to Leviticus 7:15, when was the meat of the thanksgiving peace offering to be eaten?",
    options: [
      "The following morning",
      "After three days",
      "After seven days",
      "On the day it was offered",
    ],
    correct: 3,
    reference: "Leviticus 7:15",
    explanation:
      "The meat was to be eaten on the day of the offering, with none left until morning.",
  },
];
