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
