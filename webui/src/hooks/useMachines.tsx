import { useMutation, useQuery } from "react-query";
import { fetchMachines, startMachine, stopMachine } from "../api/machines";
import { queryClient } from "../main";

export const useMachinesQuery = (offset?: number, size?: number) =>
  useQuery({
    queryKey: ["machines", offset, size],
    queryFn: () => fetchMachines(offset, size),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

export const useStopMachineMutation = () =>
  useMutation({
    mutationFn: (id: string) => stopMachine(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["machines"]);
    },
  });

export const useStartMachineMutation = () =>
  useMutation({
    mutationFn: (id: string) => startMachine(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["machines"]);
    },
  });
