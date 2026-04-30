import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

interface ExploreWritePanelProps {
  fileName: string;
  onSelect: (item: { value: string }) => void;
}

const EXPLORE_WRITE_ITEMS = [
  { label: "✅ Yes, write file", value: "yes" },
  { label: "❌ No, cancel", value: "no" },
];

export const ExploreWritePanel = ({ fileName, onSelect }: ExploreWritePanelProps) => (
  <Box
    flexDirection="column"
    marginY={1}
    borderStyle="round"
    borderColor="red"
    paddingX={1}
    overflow="hidden"
  >
    <Text bold color="red">
      Explore output ready for {fileName}. Write to project root?
    </Text>
    <Box marginTop={1}>
      <SelectInput items={EXPLORE_WRITE_ITEMS} onSelect={onSelect} />
    </Box>
  </Box>
);
