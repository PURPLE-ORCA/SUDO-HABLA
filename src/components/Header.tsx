import React from "react";
import { Box, Text } from "ink";
import { BRAND_COLOR, SUDO_HABLA_LOGO } from "../constants/theme";

export const Header = () => (
  <Box flexDirection="column" marginBottom={1} flexShrink={0}>
    <Text color={BRAND_COLOR} bold>
      {SUDO_HABLA_LOGO}
    </Text>
    <Text dimColor>v1.4.0 - Hostile Terminal Tutor</Text>
  </Box>
);
