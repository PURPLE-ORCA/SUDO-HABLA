import React, { useEffect, useState } from "react";
import { Onboarding } from "./Onboarding";
import { Repl } from "./Repl";
import { readConfig, type Config } from "../lib/config";

export const App = () => {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const storedConfig = await readConfig();
      setConfig(storedConfig);
    };
    loadConfig();
  }, []);

  if (!config) {
    return <Onboarding onComplete={setConfig} />;
  }

  return <Repl config={config} onConfigReset={() => setConfig(null)} />;
};
