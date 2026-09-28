import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getEmployeeDirectory } from "@/services/api/employeesApi";

export function useEmployees() {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: getEmployeeDirectory,
  });
}
