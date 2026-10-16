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
];
