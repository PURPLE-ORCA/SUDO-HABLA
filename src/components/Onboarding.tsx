import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { writeConfig, type Config, type Provider } from "../lib/config";
import { fetchProviderModels, type SelectItem } from "../lib/fetcher";
import { ONBOARDING_PROVIDER_ITEMS } from "../constants/onboarding";
import { CLI_BRAND_COLOR } from "../constants/ui";
import packageJson from "../../package.json";

type OnboardingStep = "PROVIDER_SELECT" | "API_KEY_INPUT" | "LOADING_MODELS" | "MODEL_SELECT";

interface OnboardingProps {
  onComplete: (config: Config) => void;
}

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("PROVIDER_SELECT");
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [pendingApiKey, setPendingApiKey] = useState("");
  const [availableModels, setAvailableModels] = useState<SelectItem[]>([]);
  const [onboardingError, setOnboardingError] = useState("");

  const handleProviderSelect = (item: { value: string }) => {
    setPendingProvider(item.value as Provider);
    setAvailableModels([]);
    setOnboardingError("");
    setOnboardingStep("API_KEY_INPUT");
  };

  const handleApiKeySubmit = async (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return;

    setPendingApiKey(trimmed);

    if (!pendingProvider) return;

    setOnboardingStep("LOADING_MODELS");

    try {
      const models = await fetchProviderModels(pendingProvider, trimmed);
      if (!models.length) {
        throw new Error("No compatible models found for this provider.");
      }

      setAvailableModels(models);
      setOnboardingError("");
      setOnboardingStep("MODEL_SELECT");
    } catch (error: any) {
      setOnboardingError(error.message);
      setOnboardingStep("API_KEY_INPUT");
    }
  };

  const handleModelSelect = async (item: { value: string }) => {
    if (!pendingProvider || !pendingApiKey) return;

    const nextConfig: Config = {
      activeProvider: pendingProvider,
      activeModel: item.value,
      apiKeys: {
        gemini: pendingProvider === "gemini" ? pendingApiKey : "",
        openai: pendingProvider === "openai" ? pendingApiKey : "",
      },
    };

    await writeConfig(pendingProvider, item.value, pendingApiKey);

    setPendingProvider(null);
    setPendingApiKey("");
    setAvailableModels([]);
    setOnboardingError("");
    setOnboardingStep("PROVIDER_SELECT");

    onComplete(nextConfig);
  };

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box marginBottom={1}>
        <Text color={CLI_BRAND_COLOR} bold>
          🦈 sudo-habla v{packageJson.version}
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} justifyContent="center">
        <Box marginBottom={1}>
          <Text color="yellow">No config detected.</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>
            {onboardingStep === "PROVIDER_SELECT"
              ? "Select your provider"
              : onboardingStep === "API_KEY_INPUT"
                ? "Enter the API Key for your provider:"
                : onboardingStep === "LOADING_MODELS"
                  ? "Fetching available models..."
                  : "Select the model for your provider"}
          </Text>
        </Box>
        {onboardingError ? (
          <Box marginBottom={1}>
            <Text color="red">{onboardingError}</Text>
          </Box>
        ) : null}
        {onboardingStep === "PROVIDER_SELECT" ? (
          <SelectInput items={ONBOARDING_PROVIDER_ITEMS} onSelect={handleProviderSelect} />
        ) : null}
        {onboardingStep === "API_KEY_INPUT" ? (
          <Box>
            <Box marginRight={1}>
              <Text color={CLI_BRAND_COLOR}>❯</Text>
            </Box>
            <TextInput
              value={pendingApiKey}
              onChange={setPendingApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
              placeholder="sk-..."
            />
          </Box>
        ) : null}
        {onboardingStep === "LOADING_MODELS" ? (
          <Text color="yellow">Fetching available models...</Text>
        ) : null}
        {onboardingStep === "MODEL_SELECT" ? (
          <SelectInput items={availableModels} onSelect={handleModelSelect} />
        ) : null}
      </Box>
    </Box>
  );
};
