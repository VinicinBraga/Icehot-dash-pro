import { useQuery } from "@tanstack/react-query";
import { fetchTemperatureHistory } from "@/lib/api";
import type { Filters } from "@/lib/types";

export function useTemperatureHistory(
  from: Date,
  to: Date,
  filters?: Filters,
  enabled = true
) {
  return useQuery({
    enabled,
    queryKey: [
      "temperature-history",
      from,
      to,
      JSON.stringify(filters || {}),
    ],
    queryFn: () =>
      fetchTemperatureHistory(from, to, filters),
    staleTime: 1000 * 60 * 5,
  });
}