const MAX_DEPTH = 3;

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist"]);

const formatDeps = (title: string, deps: Record<string, string> | undefined) => {
  const pairs = Object.entries(deps ?? {});
  if (pairs.length === 0) return `${title}: none`;

  const lines = pairs
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => `- ${name}: ${version}`);

  return `${title}:\n${lines.join("\n")}`;
};

const buildDirectoryTree = async (rootDir: string) => {
  const lines: string[] = ["."];

  const walk = async (relativePath: string, depth: number) => {
    if (depth >= MAX_DEPTH) return;

    const absolutePath = relativePath
      ? `${rootDir}/${relativePath}`
      : rootDir;

    let entries: string[];
    try {
      const proc = Bun.spawnSync({
        cmd: ["ls", "-1p", absolutePath],
        stderr: "pipe",
      });
      if (proc.exitCode !== 0) return;
      entries = proc.stdout
        .toString()
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;
      const isDir = entry.endsWith("/");
      const cleanEntry = isDir ? entry.slice(0, -1) : entry;
      if (!cleanEntry) continue;
      const entryRelativePath = relativePath
        ? `${relativePath}/${cleanEntry}`
        : cleanEntry;

      const prefix = "  ".repeat(depth + 1);
      lines.push(`${prefix}${cleanEntry}${isDir ? "/" : ""}`);

      if (isDir) {
        await walk(entryRelativePath, depth + 1);
      }
    }
  };

  await walk("", 0);
  return lines.join("\n");
};

export const getProjectSkeleton = async (): Promise<string> => {
  try {
    const cwd = process.cwd();
    const packageJsonPath = `${cwd}/package.json`;
    const packageFile = Bun.file(packageJsonPath);

    let dependencyBlock = "Dependencies: none\nDevDependencies: none";

    if (await packageFile.exists()) {
      const content = await packageFile.text();
      const parsed = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      dependencyBlock = [
        formatDeps("Dependencies", parsed.dependencies),
        formatDeps("DevDependencies", parsed.devDependencies),
      ].join("\n\n");
    }

    const tree = await buildDirectoryTree(cwd);

    return `=== PROJECT DEPENDENCIES ===\n${dependencyBlock}\n\n=== PROJECT TREE (MAX DEPTH 3) ===\n${tree}`;
  } catch {
    return "=== PROJECT DEPENDENCIES ===\nDependencies: none\nDevDependencies: none\n\n=== PROJECT TREE (MAX DEPTH 3) ===\n.";
  }
};
