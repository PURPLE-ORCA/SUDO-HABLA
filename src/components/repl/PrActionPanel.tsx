import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

interface PrActionPanelProps {
  onSelect: (item: { value: string }) => void;
}

const PR_ACTION_ITEMS = [
  { label: "Copy PR body to clipboard", value: "copy" },
  { label: "Write PR_DESCRIPTION.md", value: "file" },
  { label: "Do nothing", value: "skip" },
];

export const PrActionPanel = ({ onSelect }: PrActionPanelProps) => (
  <Box
    flexDirection="column"
    marginY={1}
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
    overflow="hidden"
  >
    <Text bold color="cyan">
      PR body ready. Pick output, because mouse selection is terminal nonsense.
    </Text>
    <Box marginTop={1}>
      <SelectInput items={PR_ACTION_ITEMS} onSelect={onSelect} />
    </Box>
  </Box>
);
