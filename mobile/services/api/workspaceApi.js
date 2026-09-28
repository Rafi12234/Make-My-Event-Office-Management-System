import { apiRequest } from "./client";

export function getWorkspace() {
  return apiRequest("/workspace/default");
}

// Full-sheet replace, mirroring the web Management sheet's save contract —
// callers must pass the complete current workspace (all rows, not just the
// changed one) or unrelated rows will be dropped server-side.
export function saveWorkspace(workspace, employeeId) {
  return apiRequest("/workspace/default", {
    method: "PUT",
    body: JSON.stringify({ workspace, employeeId }),
  });
}
