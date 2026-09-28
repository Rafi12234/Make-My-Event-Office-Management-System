import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getMeetings } from "@/services/api/meetingsApi";

export function useMeetings(rowKey) {
  return useQuery({
    queryKey: queryKeys.meetings(rowKey),
    queryFn: () => getMeetings(rowKey),
    enabled: Boolean(rowKey),
  });
}
