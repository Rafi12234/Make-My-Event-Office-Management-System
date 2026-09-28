import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import {
  getAttendanceHistory,
  getTodayAttendance,
  signIn as signInRequest,
  signOut as signOutRequest,
} from "@/Attendance/frontend/services/attendanceApi";
import { getCurrentAttendanceLocation } from "@/Attendance/frontend/services/locationService";

export function useTodayAttendance() {
  return useQuery({
    queryKey: queryKeys.attendanceToday,
    queryFn: getTodayAttendance,
  });
}

export function useAttendanceHistory(limit = 30) {
  return useQuery({
    queryKey: queryKeys.attendanceHistory,
    queryFn: () => getAttendanceHistory(limit),
  });
}

/**
 * Owns the "no location = no Sign In/Out" gate (guide sections 20 & 25):
 * resolves a fresh GPS fix BEFORE calling the API, and never calls the
 * mutation at all if permission/GPS resolution fails.
 */
export function useAttendanceActions() {
  const queryClient = useQueryClient();
  const [actionErrorMessage, setActionErrorMessage] = useState(null);
  const [isPreparingSignIn, setIsPreparingSignIn] = useState(false);
  const [isPreparingSignOut, setIsPreparingSignOut] = useState(false);

  function invalidateAttendance() {
    queryClient.invalidateQueries({ queryKey: queryKeys.attendanceToday });
    queryClient.invalidateQueries({ queryKey: queryKeys.attendanceHistory });
  }

  const signInMutation = useMutation({ mutationFn: signInRequest, onSuccess: invalidateAttendance });
  const signOutMutation = useMutation({ mutationFn: signOutRequest, onSuccess: invalidateAttendance });

  const signIn = useCallback(async () => {
    setActionErrorMessage(null);
    setIsPreparingSignIn(true);
    try {
      const location = await getCurrentAttendanceLocation();
      await signInMutation.mutateAsync(location);
    } catch (error) {
      setActionErrorMessage(error.message);
    } finally {
      setIsPreparingSignIn(false);
    }
  }, [signInMutation]);

  const signOut = useCallback(async () => {
    setActionErrorMessage(null);
    setIsPreparingSignOut(true);
    try {
      const location = await getCurrentAttendanceLocation();
      await signOutMutation.mutateAsync(location);
    } catch (error) {
      setActionErrorMessage(error.message);
    } finally {
      setIsPreparingSignOut(false);
    }
  }, [signOutMutation]);

  return {
    signIn,
    signOut,
    isSigningIn: isPreparingSignIn || signInMutation.isPending,
    isSigningOut: isPreparingSignOut || signOutMutation.isPending,
    actionErrorMessage,
  };
}
