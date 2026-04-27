type BlameLine = {
  author: string;
  finalLineNumber: number;
  content: string;
};

export type BlameSummary = {
  culprit: string;
  filePath: string;
  lineCount: number;
  snippets: { lineNumber: number; content: string }[];
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const summarizeFileBlame = async (
  filePath: string,
): Promise<BlameSummary | null> => {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const proc = Bun.spawnSync({
    cmd: ["git", "blame", "--line-porcelain", "--", filePath],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString().trim() || "git blame failed");
  }

  const output = proc.stdout.toString();
  const lines = output.split("\n");
  const blameLines: BlameLine[] = [];

  let currentAuthor = "unknown coward";
  let currentLineNumber = 0;

  for (const line of lines) {
    if (/^[0-9a-f]{7,40}\s/.test(line)) {
      const parts = line.split(" ");
      currentLineNumber = Number(parts[2] ?? 0);
      continue;
    }

    if (line.startsWith("author ")) {
      currentAuthor = line.slice("author ".length).trim() || "unknown coward";
      continue;
    }

    if (line.startsWith("\t")) {
      const content = normalizeWhitespace(line.slice(1));
      if (content) {
        blameLines.push({
          author: currentAuthor,
          finalLineNumber: currentLineNumber,
          content,
        });
      }
      currentLineNumber += 1;
    }
  }

  if (blameLines.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const line of blameLines) {
    counts.set(line.author, (counts.get(line.author) ?? 0) + 1);
  }

  const culpritEntry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!culpritEntry) {
    return null;
  }

  const [culprit, lineCount] = culpritEntry;
  const snippets = blameLines
    .filter((line) => line.author === culprit)
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 3)
    .map((line) => ({
      lineNumber: line.finalLineNumber,
      content:
        line.content.length > 140 ? `${line.content.slice(0, 137)}...` : line.content,
    }));

  return {
    culprit,
    filePath,
    lineCount,
    snippets,
  };
};
