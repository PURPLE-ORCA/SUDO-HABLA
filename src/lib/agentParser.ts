import os from "os";

const LOCAL_AGENTS_DIR = `${process.cwd()}/.sudo-habla/agents`;
const GLOBAL_AGENTS_DIR = `${os.homedir()}/.sudo-habla/agents`;

const BUILTIN_TEMPLATES: Record<string, string> = {
  readme: `Act as a senior documentation engineer.
Generate README.md for this project from provided context.
Include sections: Overview, Tech Stack, Setup, Scripts, Project Structure, Usage, and Notes.
Keep content specific to observed dependencies and architecture tree.
Remember hidden vocab block at end.`,
  product: `Act as a principal product engineer.
Generate PRODUCT.md for this project from provided context.
Include sections: Vision, Target Users, Core Features, Architecture Summary, Non-Functional Requirements, and Roadmap.
Ground every section in observed stack and directory tree. Avoid generic filler.
Remember hidden vocab block at end.`,
  architecture: `Act as a staff architect.
Generate ARCHITECTURE.md from provided project context.
Include sections: System Overview, Runtime & Tooling, Module Boundaries, Data Flow, Operational Constraints, and Extension Points.
Be precise and implementation-grounded.
Remember hidden vocab block at end.`,
};

const parseTemplate = (content: string): string => {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (frontmatterMatch?.[1]) {
    return frontmatterMatch[1].trim();
  }
  return content.trim();
};

const normalizeTemplateInput = (templateName: string): string => {
  const raw = templateName.trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return "";

  const normalized = raw.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid template path: traversal is blocked");
  }

  const parts = normalized.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (!last) return "";

  const withoutMd = last.replace(/\.md$/i, "");
  return withoutMd.toLowerCase();
};

const listTemplatesInDir = (dirPath: string): string[] => {
  try {
    const proc = Bun.spawnSync({
      cmd: ["ls", "-1", dirPath],
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) return [];
    return proc.stdout
      .toString()
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.toLowerCase().endsWith(".md"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

const ensureLocalAgentsDirectory = () => {
  try {
    const proc = Bun.spawnSync({
      cmd: ["mkdir", "-p", LOCAL_AGENTS_DIR],
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) return;
  } catch {
    return;
  }
};

export const loadAgentTemplate = async (templateName: string): Promise<string> => {
  ensureLocalAgentsDirectory();

  const normalizedName = normalizeTemplateInput(templateName);
  if (!normalizedName) {
    throw new Error("Template name required");
  }

  const localPath = `${LOCAL_AGENTS_DIR}/${normalizedName}.md`;
  const globalPath = `${GLOBAL_AGENTS_DIR}/${normalizedName}.md`;

  const localFile = Bun.file(localPath);
  if (await localFile.exists()) {
    return parseTemplate(await localFile.text());
  }

  const globalFile = Bun.file(globalPath);
  if (await globalFile.exists()) {
    return parseTemplate(await globalFile.text());
  }

  const builtin = BUILTIN_TEMPLATES[normalizedName];
  if (builtin) {
    return builtin;
  }

  const availableLocal = listTemplatesInDir(LOCAL_AGENTS_DIR).join(", ") || "none";
  throw new Error(
    `Template not found: ${templateName}. Checked: ${localPath}, ${globalPath}. Available local templates: ${availableLocal}`,
  );
};
