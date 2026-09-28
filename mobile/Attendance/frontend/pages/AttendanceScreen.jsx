import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import AttendanceStatusCard from "@/Attendance/frontend/components/AttendanceStatusCard";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import LoadingScreen from "@/components/common/LoadingScreen";
import ScreenContainer from "@/components/common/ScreenContainer";
import { Brand } from "@/constants/theme";
import { useAttendanceActions, useAttendanceHistory, useTodayAttendance } from "@/hooks/useAttendance";
import { formatDisplayDate, formatDisplayTime } from "@/utils/dates";
import { moderateScale } from "@/utils/responsive";

function timeOnly(dateTimeString) {
  if (!dateTimeString) return "--";
  const timePart = dateTimeString.split(" ")[1];
  return timePart ? formatDisplayTime(timePart.slice(0, 5)) : "--";
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function AttendanceScreen() {
  const today = useTodayAttendance();
  const history = useAttendanceHistory(30);
  const actions = useAttendanceActions();

  const isRefreshing = today.isRefetching || history.isRefetching;

  function handleRefresh() {
    today.refetch();
    history.refetch();
  }

  if (today.isLoading || history.isLoading) {
    return <LoadingScreen message="Loading attendance..." />;
  }

  if (today.isError) {
    return <ErrorState message={today.error?.message} onRetry={today.refetch} />;
  }

  return (
    <ScreenContainer
      scroll
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { fontSize: moderateScale(22) }]}>Attendance</Text>
        <Text style={styles.pageSubtitle}>Sign in and out, and review your recent history.</Text>
      </View>

      <AttendanceStatusCard
        attendance={today.data}
        onSignIn={actions.signIn}
        onSignOut={actions.signOut}
        isSigningIn={actions.isSigningIn}
        isSigningOut={actions.isSigningOut}
      />

      {actions.actionErrorMessage ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color="#d32f2f" />
          <Text style={styles.errorMessage}>{actions.actionErrorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { fontSize: moderateScale(17) }]}>Attendance History</Text>
        {history.data?.length ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{history.data.length}</Text>
          </View>
        ) : null}
      </View>

      {history.data?.length ? (
        <View style={styles.historyList}>
          {history.data.map((record) => {
            const duration = formatDuration(record.durationMinutes);
            const isInProgress = Boolean(record.signInAt) && !record.signOutAt;
            return (
              <View key={record.id} style={styles.historyRow}>
                <View style={styles.historyIconBadge}>
                  <MaterialIcons name="event-available" size={17} color={Brand.plum} />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyDate}>{formatDisplayDate(record.attendanceDate)}</Text>
                  <Text style={styles.historyDetail}>
                    {timeOnly(record.signInAt)} {"\u2192"} {isInProgress ? "In progress" : timeOnly(record.signOutAt)}
                  </Text>
                </View>
                {duration ? (
                  <View style={styles.durationPill}>
                    <Text style={styles.durationPillText}>{duration}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState title="No history yet" message="Your attendance history will appear here." />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
    gap: 3,
  },
  pageTitle: {
    fontWeight: "800",
    color: Brand.purple,
  },
  pageSubtitle: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fdecec",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  errorMessage: {
    flex: 1,
    color: "#d32f2f",
    fontWeight: "600",
    fontSize: moderateScale(12.5),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: "800",
    color: Brand.purple,
  },
  countPill: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: Brand.purple,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  historyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(91,55,101,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  historyInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  historyDate: {
    color: Brand.purple,
    fontWeight: "700",
    fontSize: moderateScale(13.5),
  },
  historyDetail: {
    color: Brand.mauve,
    fontSize: moderateScale(12),
  },
  durationPill: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  durationPillText: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    color: Brand.purple,
  },
});
