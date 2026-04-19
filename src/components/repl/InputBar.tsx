import React from "react";
import { Box } from "ink";
import TextInput from "ink-text-input";
import { INPUT_BACKGROUND_COLOR } from "../../constants/ui";
import {
  INPUT_PLACEHOLDER_DEFAULT,
  INPUT_PLACEHOLDER_INTERVIEW,
} from "../../prompts/messages";

interface InputBarProps {
  input: string;
  inputKey: number;
  interviewQuestion: string | null;
  quizActive: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export const InputBar = ({
  input,
  inputKey,
  interviewQuestion,
  quizActive,
  onChange,
  onSubmit,
}: InputBarProps) => (
  <Box width="100%" backgroundColor={INPUT_BACKGROUND_COLOR} paddingX={1}>
    <TextInput
      key={inputKey}
      value={input}
      onChange={onChange}
      onSubmit={onSubmit}
      focus={!quizActive}
      placeholder={
        interviewQuestion ? INPUT_PLACEHOLDER_INTERVIEW : INPUT_PLACEHOLDER_DEFAULT
      }
    />
  </Box>
);
