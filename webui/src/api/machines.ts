import { API_URL } from "../consts";

export type Machine = {
  id: string;
  name: string;
  status: string;
  cpus: number;
  memory: string;
  pid: number;
  drivePath: string;
  portForward: string;
  createdAt: string;
};

export const fetchMachines = async (offset?: number, size?: number) => {
  const params = new URLSearchParams();
  if (offset !== undefined) {
    params.append("offset", offset.toString());
  }
  if (size !== undefined) {
    params.append("size", size.toString());
  }

  params.append("all", "1");

  const url = `${API_URL}/machines${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  const data = await response.json();
  return data as Machine[];
};

export const stopMachine = async (id: string) => {
  const url = `${API_URL}/machines/${id}/stop`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  const data = await response.json();
  return data as Machine[];
};

export const startMachine = async (id: string) => {
  const url = `${API_URL}/machines/${id}/start`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await response.json();
  return data as Machine[];
};
