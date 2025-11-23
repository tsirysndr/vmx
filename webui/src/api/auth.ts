import { API_URL } from "../consts";

export const login = async (username: string) => {
  const res = await fetch(`${API_URL}/machines`, {
    headers: {
      Authorization: `Bearer ${username}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to login");
  }
};
