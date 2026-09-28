export function servedGitTip() {
  return {
    branch: import.meta.env.VITE_GIT_BRANCH ?? "unknown",
    commit: import.meta.env.VITE_GIT_COMMIT ?? "unknown",
  };
}
