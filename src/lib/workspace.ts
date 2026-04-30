export const getWorkspaceFiles = async (): Promise<string[]> => {
  try {
    const proc = Bun.spawnSync({
      cmd: ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
      stderr: "pipe",
    });

    if (proc.exitCode !== 0) return [];

    return proc.stdout
      .toString()
      .split("\n")
      .map((file) => file.trim())
      .filter((file) => {
        if (!file) return false;
        return /\.(ts|tsx|js|jsx|md|json|yml|yaml)$/.test(file) || file === "package.json";
      });
  } catch {
    return [];
  }
};

export const getWorkspaceContext = async (): Promise<string> => {
  try {
    const contextFiles = ["llms.txt", ".cursorrules", "AGENT.md", "AI.md"];

    for (const filename of contextFiles) {
      const filePath = `${process.cwd()}/${filename}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const content = await file.text();
        if (content.trim()) {
          return `\n\n=== REPOSITORY RULES (STRICT COMPLIANCE REQUIRED) ===\n${content}`;
        }
      }
    }

    return "";
  } catch {
    return "";
  }
};
