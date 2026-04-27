import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

interface CommitConfirmPanelProps {
  message: string;
  onSelect: (item: { value: string }) => void;
}

const COMMIT_CONFIRM_ITEMS = [
  { label: "✅ Yes, commit this mess", value: "yes" },
  { label: "❌ No, abort like a coward", value: "no" },
];

export const CommitConfirmPanel = ({ message, onSelect }: CommitConfirmPanelProps) => (
  <Box
    flexDirection="column"
    marginY={1}
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
  >
    <Text bold color="cyan">
      📝 Proposed Commit:
    </Text>
    <Text italic color="gray">
      {message}
    </Text>
    <Box marginTop={1}>
      <SelectInput items={COMMIT_CONFIRM_ITEMS} onSelect={onSelect} />
    </Box>
  </Box>
);
