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

export const loginWithGithub = async () => {
  const res = await fetch(`${API_URL.replace(/\/api/, "")}/github/login`);

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  return res.json();
};

export const loginWithATProto = async (handle: string) => {
  const res = await fetch(`${API_URL.replace(/\/api/, "")}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ handle }),
  });

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  return res.json();
};
