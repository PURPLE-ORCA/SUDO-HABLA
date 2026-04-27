import { $ } from "bun";

const getBaseBranchRef = async (): Promise<string> => {
  try {
    await $`git rev-parse --verify origin/main`.quiet();
    return "origin/main";
  } catch {
    return "main";
  }
};

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

export const getPullRequestContext = async (): Promise<string> => {
  try {
    const baseRef = await getBaseBranchRef();
    const branchName = (await $`git rev-parse --abbrev-ref HEAD`.quiet().text()).trim();
    const commitLog = (await $`git log --oneline ${baseRef}..HEAD`.quiet().text()).trim();
    const branchDiff = (await $`git diff ${baseRef}...HEAD`.quiet().text()).trim();
    const stagedDiff = (await $`git diff --staged`.quiet().text()).trim();
    const unstagedDiff = (await $`git diff`.quiet().text()).trim();
    const worktreeDiff = [stagedDiff, unstagedDiff].filter(Boolean).join("\n\n").trim();

    if (!branchDiff && !worktreeDiff) {
      return "";
    }

    const truncatedLog = commitLog ? commitLog.slice(0, 2000) : "(no commits)";
    const truncatedBranchDiff = branchDiff ? branchDiff.slice(0, 7000) : "";
    const truncatedWorktreeDiff = worktreeDiff ? worktreeDiff.slice(0, 7000) : "";

    const diffSections = [];
    if (truncatedBranchDiff) {
      diffSections.push(`Branch diff against ${baseRef}:\n\`\`\`diff\n${truncatedBranchDiff}\n\`\`\``);
    }
    if (truncatedWorktreeDiff) {
      diffSections.push(`Dirty worktree diff:\n\`\`\`diff\n${truncatedWorktreeDiff}\n\`\`\``);
    }

    return [
      `Base branch: ${baseRef}`,
      `Current branch: ${branchName}`,
      `Commit history since base:\n${truncatedLog}`,
      ...diffSections,
    ].join("\n\n");
  } catch {
    throw new Error("No estás en un repositorio git. ¿Qué intentas esconder?");
  }
};
