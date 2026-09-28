import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCalendarMonth } from "@/services/api/calendarApi";
import { todayDateString } from "@/utils/dates";

/**
 * Builds the dashboard summary from the existing /api/calendar endpoint —
 * no new backend endpoint needed. "client_next_call"/"client_next_meeting"
 * events represent pending follow-ups; a past date means it's overdue
 * (still exists because it hasn't been fulfilled with a new call/meeting
 * yet — fulfilling one deletes the pending row server-side).
 *
 * /api/calendar is queried per-month, so a single-month query would miss
 * anything scheduled for a neighboring month (e.g. a next meeting set for
 * early next month, or an overdue item whose original date was last
 * month) — querying prev/current/next month together closes that gap.
 */
export function useDashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthsToQuery = [-1, 0, 1].map((offset) => {
    const d = new Date(year, month - 1 + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const queries = useQueries({
    queries: monthsToQuery.map(({ year: y, month: m }) => ({
      queryKey: queryKeys.calendar(y, m),
      queryFn: () => getCalendarMonth(y, m),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.isError)?.error;
  const isRefetching = queries.some((q) => q.isFetching);
  const refetch = () => Promise.all(queries.map((q) => q.refetch()));

  const summary = useMemo(() => {
    const events = queries.flatMap((q) => q.data?.events || []);
    const today = todayDateString();

    const nextCalls = events.filter((event) => event.source === "client_next_call");
    const nextMeetings = events.filter((event) => event.source === "client_next_meeting");

    const byDateTime = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));

    const todayCalls = nextCalls.filter((event) => event.date === today).sort(byDateTime);
    const todayMeetings = nextMeetings.filter((event) => event.date === today).sort(byDateTime);
    const overdueCalls = nextCalls.filter((event) => event.date < today).sort(byDateTime);
    const overdueMeetings = nextMeetings.filter((event) => event.date < today).sort(byDateTime);
    const upcomingCalls = nextCalls.filter((event) => event.date > today);
    const upcomingMeetings = nextMeetings.filter((event) => event.date > today);

    const upcomingCallActivities = [...todayCalls, ...upcomingCalls].sort(byDateTime).slice(0, 5);
    const upcomingMeetingActivities = [...todayMeetings, ...upcomingMeetings].sort(byDateTime).slice(0, 5);

    return {
      counts: {
        todayCalls: todayCalls.length,
        todayMeetings: todayMeetings.length,
        overdueCalls: overdueCalls.length,
        overdueMeetings: overdueMeetings.length,
      },
      todayCalls,
      todayMeetings,
      overdueCalls,
      overdueMeetings,
      upcomingCallActivities,
      upcomingMeetingActivities,
    };
    // Data identity from TanStack Query doesn't change reference on refetch
    // in a way useMemo can compare directly across 3 parallel queries, so
    // depend on each query's last-updated timestamp instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.map((q) => q.dataUpdatedAt).join(",")]);

  return { isLoading, isError, error, isRefetching, refetch, summary };
}
