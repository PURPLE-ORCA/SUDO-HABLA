export const readFileForReview = async (filePath: string) => {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    return { exists: false as const, content: "" };
  }

  const content = await file.text();
  return { exists: true as const, content };
};
