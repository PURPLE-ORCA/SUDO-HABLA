import os from "os";
import path from "path";

export type VocabEntry = {
  word: string;
  translation: string;
  count: number;
  lastSeen: string;
};

const VOCAB_PATH = path.join(os.homedir(), ".sudo-habla-vocab.json");

export const getVocab = async (): Promise<VocabEntry[]> => {
  try {
    const text = await Bun.file(VOCAB_PATH).text();
    if (!text.trim()) return [];

    const entries = JSON.parse(text) as VocabEntry[];
    return entries.sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  } catch {
    return [];
  }
};

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
