import type { VocabEntry } from "./vocab";

export const buildQuizFromVocab = (vocabList: VocabEntry[]) => {
  const targetIndex = Math.floor(Math.random() * vocabList.length);
  const target = vocabList[targetIndex]!;

  const distractors = vocabList
    .filter((v) => v.word !== target.word)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  const options = [target, ...distractors]
    .map((v) => ({ label: v.translation, value: v.translation }))
    .sort(() => 0.5 - Math.random());

  return { target, options };
};
