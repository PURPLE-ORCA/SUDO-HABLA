export interface SelectItem {
  label: string;
  value: string;
}

export const fetchProviderModels = async (
  provider: string,
  apiKey: string,
): Promise<SelectItem[]> => {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAI models: ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: { id: string }[] };

    return (data.data ?? [])
      .filter((model) => model.id.includes("gpt"))
      .map((model) => ({ label: model.id, value: model.id }));
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Gemini models: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  };

  return (data.models ?? [])
    .filter(
      (model) =>
        model.name.includes("models/gemini") &&
        (model.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((model) => ({
      label: model.displayName || model.name,
      value: model.name.replace("models/", ""),
    }));
};
