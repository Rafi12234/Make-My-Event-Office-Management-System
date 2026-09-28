import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCalls } from "@/services/api/callsApi";

export function useCalls(rowKey) {
  return useQuery({
    queryKey: queryKeys.calls(rowKey),
    queryFn: () => getCalls(rowKey),
    enabled: Boolean(rowKey),
  });
}
