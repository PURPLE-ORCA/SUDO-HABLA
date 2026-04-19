import { $ } from "bun";

export const getLatestGitDiff = async (): Promise<string> => {
  try {
    const diffResult = await $`git diff`.quiet().text();

    if (diffResult.trim()) {
      return diffResult.slice(0, 2000);
    }

    const showResult = await $`git show HEAD --stat`.quiet().text();
    return showResult.slice(0, 2000);
  } catch {
    throw new Error("No estás en un repositorio git. ¿Qué intentas esconder?");
  }
};
