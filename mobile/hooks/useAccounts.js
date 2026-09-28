import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import {
  addMoneyReceived,
  getAccountsSummary,
  getBookedEvents,
  getVendorProfile,
  getVendors,
  payVendor,
  submitExpense,
} from "@/services/api/accountsApi";

export function useAccountsSummary() {
  return useQuery({
    queryKey: queryKeys.accountsSummary,
    queryFn: getAccountsSummary,
  });
}

export function useBookedEvents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accountsBookedEvents,
    queryFn: getBookedEvents,
    enabled,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.accountsVendors,
    queryFn: getVendors,
  });
}

export function useVendorProfile(vendorId) {
  return useQuery({
    queryKey: queryKeys.accountsVendorProfile(vendorId),
    queryFn: () => getVendorProfile(vendorId),
    enabled: Boolean(vendorId),
  });
}

export function useAddMoneyReceived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addMoneyReceived,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accountsSummary }),
  });
}

export function useSubmitExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accountsSummary }),
  });
}

export function usePayVendor(vendorId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => payVendor(vendorId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsVendors });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountsVendorProfile(vendorId) });
    },
  });
}
