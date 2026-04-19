import type { Provider } from "../lib/config";

export const ONBOARDING_PROVIDER_ITEMS: { label: string; value: Provider }[] = [
  { label: "Gemini", value: "gemini" },
  { label: "OpenAI", value: "openai" },
];
