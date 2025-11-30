import { API_URL } from "../consts";

export const fetchProfile = async () => {
  const res = await fetch(`${API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to get profile");
  }

  const data = await res.json();
  return data;
};
