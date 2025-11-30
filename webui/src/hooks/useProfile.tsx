import { useQuery } from "react-query";
import { fetchProfile } from "../api/me";

export const useProfileQuery = () =>
  useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
