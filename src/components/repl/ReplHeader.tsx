import React from "react";
import { Box, Text } from "ink";
import { CLI_BRAND_COLOR } from "../../constants/ui";

export const ReplHeader = ({ version }: { version: string }) => (
  <Box marginBottom={1}>
    <Text color={CLI_BRAND_COLOR} bold>
      🦈 sudo-habla v{version}
    </Text>
  </Box>
);
