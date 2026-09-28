import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getWorkspace } from "@/services/api/workspaceApi";
import { buildClientColumnMap, mapRowToClient } from "@/utils/clients";

// Shares the same query cache/key as useClients() — opening a client's
// detail screen right after the list never triggers a second network call.
export function useClient(rowKey) {
  const query = useQuery({
    queryKey: queryKeys.workspace,
    queryFn: getWorkspace,
  });

  const client = useMemo(() => {
    const rows = query.data?.rows || [];
    const row = rows.find((candidate) => candidate.id === rowKey);
    if (!row) return null;
    const columnMap = buildClientColumnMap(query.data?.columns || []);
    return mapRowToClient(row, columnMap);
  }, [query.data, rowKey]);

  return { ...query, client };
}
