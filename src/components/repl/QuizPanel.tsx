import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import {
  POP_QUIZ_TITLE_PREFIX,
  POP_QUIZ_TITLE_SUFFIX,
} from "../../prompts/messages";
import type { QuizState } from "./types";

interface QuizPanelProps {
  quiz: QuizState;
  onSelect: (item: { value: string }) => void;
}

export const QuizPanel = ({ quiz, onSelect }: QuizPanelProps) => {
  if (!quiz.active || !quiz.target || !quiz.options) return null;

  return (
    <Box
      flexDirection="column"
      marginY={1}
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Text bold color="magenta">
        {POP_QUIZ_TITLE_PREFIX}
        {quiz.target.word}
        {POP_QUIZ_TITLE_SUFFIX}
      </Text>
      <SelectInput items={quiz.options} onSelect={onSelect} />
    </Box>
  );
};
