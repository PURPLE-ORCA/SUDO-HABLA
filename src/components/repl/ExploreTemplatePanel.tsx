import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

interface ExploreTemplatePanelProps {
  onSelect: (item: { value: string }) => void;
}

const EXPLORE_TEMPLATE_ITEMS = [
  { label: "PRODUCT.md", value: "product" },
  { label: "ARCHITECTURE.md", value: "architecture" },
  { label: "README.md", value: "readme" },
  { label: "Cancel", value: "cancel" },
];

export const ExploreTemplatePanel = ({ onSelect }: ExploreTemplatePanelProps) => (
  <Box
    flexDirection="column"
    marginY={1}
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
    overflow="hidden"
  >
    <Text bold color="cyan">
      Choose /explore template output.
    </Text>
    <Box marginTop={1}>
      <SelectInput items={EXPLORE_TEMPLATE_ITEMS} onSelect={onSelect} />
    </Box>
  </Box>
);
