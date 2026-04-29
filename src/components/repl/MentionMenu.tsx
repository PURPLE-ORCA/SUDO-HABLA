import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";
import { TAB_COMPLETE_HINT } from "../../prompts/messages";

interface MentionMenuProps {
  showMenu: boolean;
  suggestions: string[];
}

export const MentionMenu = ({ showMenu, suggestions }: MentionMenuProps) => {
  if (!showMenu) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={CLI_BRAND_COLOR}
      paddingX={1}
      marginBottom={1}
    >
      {suggestions.map((item, i) => (
        <Text
          key={item}
          color={i === 0 ? "black" : CLI_BRAND_COLOR}
          backgroundColor={i === 0 ? CLI_BRAND_COLOR : undefined}
          bold={i === 0}
        >
          @{item}
          {i === 0 ? TAB_COMPLETE_HINT : ""}
        </Text>
      ))}
    </Box>
  );
};
