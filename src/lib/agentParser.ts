import os from "os";

const LOCAL_AGENTS_DIR = `${process.cwd()}/.sudo-habla/agents`;
const GLOBAL_AGENTS_DIR = `${os.homedir()}/.sudo-habla/agents`;

const CURATED_TEMPLATES: Record<string, string> = {
  "readme.md": `---
name: readme
description: Generate concise README from project context
---
Act as a senior documentation engineer.
Generate a clean README.md for this project using provided project dependencies and architecture tree.
Include sections: Overview, Tech Stack, Setup, Scripts, Project Structure, Usage, and Notes.
Keep tone practical and specific to given context. Avoid generic boilerplate.
Remember hidden vocab block at very end.`,
  "product.md": `---
name: product
description: Generate product requirements/spec markdown
---
Act as a principal product engineer.
Generate PRODUCT.md for this codebase using provided project context.
Include sections: Vision, Target Users, Core Features, Architecture Summary, Non-Functional Requirements, and Roadmap.
Ground every section in observed stack and structure. Avoid fantasy features.
Remember hidden vocab block at very end.`,
  "architecture.md": `---
name: architecture
description: Generate architecture guide markdown
---
Act as a staff architect.
Generate ARCHITECTURE.md from provided dependencies and directory tree.
Include sections: System Overview, Runtime & Tooling, Module Boundaries, Data Flow, Operational Constraints, and Extension Points.
Be precise, terse, and implementation-grounded.
Remember hidden vocab block at very end.`,
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

const ensureLocalAgentTemplates = async () => {
  const mkdirProc = Bun.spawnSync({
    cmd: ["mkdir", "-p", LOCAL_AGENTS_DIR],
    stderr: "pipe",
  });
  if (mkdirProc.exitCode !== 0) return;

  for (const [filename, content] of Object.entries(CURATED_TEMPLATES)) {
    const filePath = `${LOCAL_AGENTS_DIR}/${filename}`;
    const file = Bun.file(filePath);
    if (await file.exists()) continue;
    await Bun.write(filePath, `${content.trim()}\n`);
  }
};

export const loadAgentTemplate = async (templateName: string): Promise<string> => {
  await ensureLocalAgentTemplates();

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

  const availableLocal = listTemplatesInDir(LOCAL_AGENTS_DIR).join(", ") || "none";
  throw new Error(
    `Template not found: ${templateName}. Checked: ${localPath}, ${globalPath}. Available local templates: ${availableLocal}`,
  );
};
