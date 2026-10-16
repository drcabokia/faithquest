export type QuizPrompt = {
  id: string;
  day: number;
  question: string;
  options: [string, string, string, string];
  reference: string;
};
export const QUIZ_PROMPTS: QuizPrompt[] = [
  {
    id: "gen-light",
    day: 1,
    question: "What did God call the light?",
    options: ["Day", "Heaven", "Earth", "Sea"],
    reference: "Genesis 1:5",
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
    reference: "Genesis 2:2–3",
  },
  {
    id: "gen-garden",
    day: 1,
    question: "Where did God place the man to cultivate and keep it?",
    options: ["Babel", "The garden of Eden", "Egypt", "Mount Sinai"],
    reference: "Genesis 2:15",
  },
  {
    id: "gen-noah",
    day: 2,
    question: "Who was told to build an ark?",
    options: ["Abraham", "Moses", "Noah", "David"],
    reference: "Genesis 6:13–14",
  },
  {
    id: "gen-walk",
    day: 2,
    question: "Who is described as having walked with God before God took him?",
    options: ["Cain", "Enoch", "Lamech", "Pharaoh"],
    reference: "Genesis 5:24",
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
    reference: "Genesis 9:12–13",
  },
];
