export const buildQuizFeedbackPrompt = (
  word: string,
  guess: string,
  isCorrect: boolean,
): string =>
  `The user was quizzed on the Spanish technical term "${word}". They guessed the translation was "${guess}". This was ${isCorrect ? "CORRECT" : "INCORRECT"}. Provide a brief, cynical response in Spanish followed by the English translation. If they were wrong, mock them. If they were right, act begrudgingly impressed.`;

export const buildInterviewEvaluationPrompt = (
  interviewQuestion: string,
  answer: string,
): string => `Act as a ruthless Principal Engineer conducting a technical interview in Spanish.
  You asked the candidate: "${interviewQuestion}"
  The candidate answered: "${answer}"
  Grade their technical accuracy and their Spanish grammar. Be brutally honest. If they used English, roast them for it. Provide the correct answer in perfect technical Spanish. Remember to append the |||VOCAB||| JSON block at the end.`;
