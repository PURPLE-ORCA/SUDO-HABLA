import React from "react";
import { Box, Spacer, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";
import { CHEAT_SHEET_TITLE, NO_VOCAB_MESSAGE } from "../../prompts/messages";
import type { VocabEntry } from "../../lib/vocab";

const getMasteryColor = (mastery = 0) => {
  if (mastery === 0) return "red";
  if (mastery <= 2) return "yellow";
  return "green";
};

interface VocabSidebarProps {
  showSidebar: boolean;
  vocabList: VocabEntry[];
}

export const VocabSidebar = ({ showSidebar, vocabList }: VocabSidebarProps) => {
  if (!showSidebar) return null;

  return (
    <Box width={35} flexShrink={0} flexDirection="column" paddingLeft={1} overflow="hidden">
      <Text bold color={CLI_BRAND_COLOR} underline>
        {CHEAT_SHEET_TITLE}
      </Text>
      <Spacer />
      {vocabList.slice(0, 10).map((v, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text bold color={getMasteryColor(v.mastery)}>
            {v.word}
          </Text>
          <Text dimColor>{v.translation}</Text>
        </Box>
      ))}
      {vocabList.length === 0 && <Text dimColor>{NO_VOCAB_MESSAGE}</Text>}
    </Box>
  );
};
