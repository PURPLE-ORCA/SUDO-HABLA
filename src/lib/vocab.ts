import os from "os";
import path from "path";

export type VocabEntry = {
  word: string;
  translation: string;
  count: number;
  lastSeen: string;
};

const VOCAB_PATH = path.join(os.homedir(), ".sudo-habla-vocab.json");

export const addVocab = async (
  newWords: { word: string; translation: string }[],
): Promise<void> => {
  let entries: VocabEntry[] = [];

  try {
    const text = await Bun.file(VOCAB_PATH).text();
    if (text.trim()) {
      entries = JSON.parse(text) as VocabEntry[];
    }
  } catch {
    entries = [];
  }

  for (const newWord of newWords) {
    const existing = entries.find((entry) => entry.word === newWord.word);
    if (existing) {
      existing.count += 1;
      existing.translation = newWord.translation;
      existing.lastSeen = new Date().toISOString();
      continue;
    }

    entries.push({
      word: newWord.word,
      translation: newWord.translation,
      count: 1,
      lastSeen: new Date().toISOString(),
    });
  }

  await Bun.write(VOCAB_PATH, JSON.stringify(entries, null, 2));
};
