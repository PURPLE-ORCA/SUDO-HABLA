import os from "os";

const LOCAL_AGENTS_DIR = `${process.cwd()}/.sudo-habla/agents`;
const GLOBAL_AGENTS_DIR = `${os.homedir()}/.sudo-habla/agents`;

const BUILTIN_TEMPLATES: Record<string, string> = {
  readme: `Actúa como Senior Engineer de documentación.
Genera README.md COMPLETO en español técnico (castellano), no en inglés.
Incluye secciones: Resumen, Stack Tecnológico, Instalación, Scripts, Estructura del Proyecto, Uso, Notas.
Adapta contenido al contexto real (dependencias y árbol). Prohibido texto genérico.
Prohibido tablas Markdown.
Recuerda añadir bloque oculto al final: |||VOCAB||| [...] |||END_VOCAB|||.`,
  product: `Actúa como Principal Product Engineer.
Genera PRODUCT.md COMPLETO en español técnico (castellano), no en inglés.
Incluye secciones: Visión, Usuarios Objetivo, Funcionalidades Clave, Resumen de Arquitectura, Requisitos No Funcionales, Roadmap.
Fundamenta cada sección en stack y estructura real. Evita relleno genérico.
Prohibido tablas Markdown.
Recuerda añadir bloque oculto al final: |||VOCAB||| [...] |||END_VOCAB|||.`,
  architecture: `Actúa como Staff Architect.
Genera ARCHITECTURE.md COMPLETO en español técnico (castellano), no en inglés.
Incluye secciones: Vista General del Sistema, Runtime y Tooling, Límites de Módulos, Flujo de Datos, Restricciones Operativas, Puntos de Extensión.
Sé preciso y aterrizado a implementación real.
Prohibido tablas Markdown.
Recuerda añadir bloque oculto al final: |||VOCAB||| [...] |||END_VOCAB|||.`,
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
