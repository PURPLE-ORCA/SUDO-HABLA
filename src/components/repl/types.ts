import type { VocabEntry } from "../../lib/vocab";

export type Message = { role: "user" | "assistant"; text: string };

export type QuizState = {
  active: boolean;
  target?: VocabEntry;
  options?: { label: string; value: string }[];
};
