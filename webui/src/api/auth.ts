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

export const loginWithGithub = () => {
  window.location.href = `${API_URL.replace(/\/api/, "")}/github/login`;
};

export const loginWithATProto = (handle: string) => {
  window.location.href = `${API_URL.replace(/\/api/, "")}/oauth/login?handle=${encodeURIComponent(handle)}`;
};

export const getAccessToken = async (id: string) => {
  const res = await fetch(`${API_URL}/accesstoken?id=${id}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to get access token");
  }

  const data = await res.json();
  return data.access_token;
};
