import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { formatDisplayTime } from "@/utils/dates";
import { moderateScale } from "@/utils/responsive";

const STATUS_META = {
  not_signed_in: { label: "Not Signed In", dot: "rgba(255,255,255,0.4)" },
  working: { label: "Working", dot: "#34d399" },
  completed: { label: "Completed", dot: "#60a5fa" },
};

// Backend returns "YYYY-MM-DD HH:MM:SS" (naive wall-clock, see dbDates.js) —
// slice out just the "HH:MM" part for the existing formatDisplayTime helper.
function timeOnly(dateTimeString) {
  if (!dateTimeString) return null;
  const timePart = dateTimeString.split(" ")[1];
  return timePart ? timePart.slice(0, 5) : null;
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Dark hero card — mirrors the visual language of the Dashboard/Accounts
// tabs' hero cards, so today's attendance status reads as the same kind
// of single bold focal point across the app.
export default function AttendanceStatusCard({ attendance, onSignIn, onSignOut, isSigningIn, isSigningOut }) {
  const status = attendance?.status || "not_signed_in";
  const meta = STATUS_META[status];
  const canSignIn = status === "not_signed_in";
  const canSignOut = status === "working";
  const duration = formatDuration(attendance?.durationMinutes);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today&apos;s Attendance</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
        <Text style={styles.statusText}>{meta.label}</Text>
      </View>

      <View style={styles.metricsRow}>
        <Metric
          icon="login"
          label="Sign In"
          value={attendance?.signInAt ? formatDisplayTime(timeOnly(attendance.signInAt)) : "--"}
        />
        <Metric
          icon="logout"
          label="Sign Out"
          value={attendance?.signOutAt ? formatDisplayTime(timeOnly(attendance.signOutAt)) : "--"}
        />
        <Metric icon="timer" label="Duration" value={duration || (status === "working" ? "In progress" : "--")} />
      </View>

      <View style={styles.actions}>
        {canSignIn ? (
          <ActionButton
            title="Sign In"
            icon="login"
            tone="light"
            onPress={onSignIn}
            loading={isSigningIn}
            disabled={isSigningOut}
          />
        ) : null}
        {canSignOut ? (
          <ActionButton
            title="Sign Out"
            icon="logout"
            tone="danger"
            onPress={onSignOut}
            loading={isSigningOut}
            disabled={isSigningIn}
          />
        ) : null}
        {!canSignIn && !canSignOut ? (
          <View style={styles.doneBanner}>
            <MaterialIcons name="check-circle" size={16} color="#60a5fa" />
            <Text style={styles.doneBannerText}>Attendance completed for today</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Metric({ icon, label, value }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIconRow}>
        <MaterialIcons name={icon} size={13} color="rgba(255,255,255,0.65)" />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({ title, icon, tone, onPress, loading, disabled }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.actionButton, tone === "light" ? styles.actionButtonLight : styles.actionButtonDanger, isDisabled && styles.actionButtonDisabled]}>
      {loading ? (
        <ActivityIndicator color={tone === "light" ? "#0B0B0F" : "#fff"} />
      ) : (
        <>
          <MaterialIcons name={icon} size={18} color={tone === "light" ? "#0B0B0F" : "#fff"} />
          <Text style={[styles.actionButtonText, tone === "light" ? styles.actionButtonTextLight : styles.actionButtonTextDanger]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0B0F",
    borderRadius: 24,
    padding: 20,
    gap: 4,
  },
  title: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusText: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    color: "#fff",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  metricIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    fontSize: moderateScale(9.5),
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
  },
  metricValue: {
    fontSize: moderateScale(13.5),
    fontWeight: "800",
    color: "#fff",
  },
  actions: {
    marginTop: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
  },
  actionButtonLight: {
    backgroundColor: "#fff",
  },
  actionButtonDanger: {
    backgroundColor: "rgba(248,113,113,0.18)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.4)",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: moderateScale(14),
    fontWeight: "800",
  },
  actionButtonTextLight: {
    color: "#0B0B0F",
  },
  actionButtonTextDanger: {
    color: "#fca5a5",
  },
  doneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(96,165,250,0.12)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  doneBannerText: {
    fontSize: moderateScale(12),
    fontWeight: "700",
    color: "#93c5fd",
  },
});

