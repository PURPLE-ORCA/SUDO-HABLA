import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";

interface ReplHeaderProps {
  version: string;
  updateAvailable?: string | null;
}

export const ReplHeader = ({ version, updateAvailable }: ReplHeaderProps) => (
  <Box marginBottom={1} flexDirection="column">
    <Text color={CLI_BRAND_COLOR} bold>
      🦈 sudo-habla v{version}
    </Text>
    {updateAvailable && (
      <Text color="yellow">
        ⚠️ Update available (v{updateAvailable}). Run: bun add -g sudo-habla
      </Text>
    )}
  </Box>
);
