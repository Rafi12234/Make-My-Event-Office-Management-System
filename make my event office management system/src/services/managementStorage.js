import { DEFAULT_COLUMNS } from "../data/defaultSheet";

const EMPLOYEE_STORAGE_KEY = "mme_current_employee_v1";
const WORKSPACE_STORAGE_KEY = "mme_management_workspace_v1";
const EMPLOYEE_DIRECTORY_KEY = "mme_employee_directory_v1";

export function loadCurrentEmployee() {
  try {
    const raw = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCurrentEmployee(employee) {
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employee));
  upsertEmployeeDirectory(employee);
}

export function clearCurrentEmployee() {
  localStorage.removeItem(EMPLOYEE_STORAGE_KEY);
}

export function loadEmployeeDirectory() {
  try {
    const raw = localStorage.getItem(EMPLOYEE_DIRECTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function upsertEmployeeDirectory(employee) {
  const employees = loadEmployeeDirectory();
  const normalizedEmail = employee.email.trim().toLowerCase();
  const existingIndex = employees.findIndex(
    (item) => item.email.toLowerCase() === normalizedEmail,
  );

  const nextEmployee = {
    ...employee,
    email: normalizedEmail,
    lastUsedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    employees[existingIndex] = {
      ...employees[existingIndex],
      ...nextEmployee,
    };
  } else {
    employees.push(nextEmployee);
  }

  localStorage.setItem(EMPLOYEE_DIRECTORY_KEY, JSON.stringify(employees));
  return employees;
}

export function createDefaultWorkspace() {
  return {
    id: "meeting-management",
    name: "Meeting Management",
    columns: DEFAULT_COLUMNS,
    rows: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return createDefaultWorkspace();

    const parsed = JSON.parse(raw);
    return {
      ...createDefaultWorkspace(),
      ...parsed,
      columns:
        Array.isArray(parsed.columns) && parsed.columns.length
          ? parsed.columns
          : DEFAULT_COLUMNS,
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    };
  } catch {
    return createDefaultWorkspace();
  }
}

export function saveWorkspace(workspace) {
  localStorage.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      ...workspace,
      updatedAt: new Date().toISOString(),
    }),
  );
}
