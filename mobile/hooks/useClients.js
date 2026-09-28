import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getWorkspace } from "@/services/api/workspaceApi";
import { buildClientColumnMap, mapRowToClient } from "@/utils/clients";

export function useClients() {
  const query = useQuery({
    queryKey: queryKeys.workspace,
    queryFn: getWorkspace,
  });

  const clients = useMemo(() => {
    const rows = query.data?.rows || [];
    const columnMap = buildClientColumnMap(query.data?.columns || []);
    return rows.map((row) => mapRowToClient(row, columnMap));
  }, [query.data]);

  return { ...query, clients };
}
