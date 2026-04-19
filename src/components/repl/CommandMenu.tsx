import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";
import { TAB_COMPLETE_HINT } from "../../prompts/messages";

interface CommandMenuProps {
  showMenu: boolean;
  filteredCommands: { label: string; value: string }[];
}

export const CommandMenu = ({
  showMenu,
  filteredCommands,
}: CommandMenuProps) => {
  if (!showMenu) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={CLI_BRAND_COLOR}
      paddingX={1}
      marginBottom={1}
    >
      {filteredCommands.map((cmd, i) => (
        <Text
          key={cmd.value}
          color={i === 0 ? "black" : CLI_BRAND_COLOR}
          backgroundColor={i === 0 ? CLI_BRAND_COLOR : undefined}
          bold={i === 0}
        >
          {cmd.label}
          {i === 0 ? TAB_COMPLETE_HINT : ""}
        </Text>
      ))}
    </Box>
  );
};
