import { trpc } from "@/lib/trpc";

export function useDashboardAuth() {
  const { data: admin, isLoading } = trpc.dashboardAuth.me.useQuery(undefined, {
    retry: false,
  });

  return {
    admin,
    isLoading,
    isAuthenticated: !!admin,
  };
}
