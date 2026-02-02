export default {
  // Vitest passes (files, errors) into onFinished; fall back to ctx shape if provided.
  onFinished(filesArg, errorsArg) {
    const files = Array.isArray(filesArg) ? filesArg : filesArg?.files || [];
    const errors = Array.isArray(errorsArg) ? errorsArg : errorsArg?.errors || [];

    const totalFiles = files.length;
    const failed = errors.length;
    const passed = Math.max(0, totalFiles - failed);
    const durationMs = Math.round(files.reduce((sum, f) => sum + (f?.result?.duration ?? 0), 0));

    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    console.log(
      `Vitest summary: ${plural(passed, "file")} passed, ${plural(failed, "file")} failed, ${plural(totalFiles, "total file")}, duration ${durationMs}ms.`
    );

    const printTasks = (task, filePathHint = "") => {
      if (!task) return;
      const filePath = task?.file?.filepath || task?.filepath || filePathHint;
      if (task.type === "test" && task.result?.state) {
        const state = task.result.state || "unknown";
        const name = task.name || "(unnamed test)";
        console.log(`[${state.toUpperCase()}] ${filePath ? filePath + " :: " : ""}${name}`);
      }
      if (Array.isArray(task.tasks)) {
        task.tasks.forEach(child => printTasks(child, filePath));
      }
    };

    files.forEach(f => printTasks(f));
  }
};
