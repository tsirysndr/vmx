import {
  createRootRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";
import z from "zod";
import { getAccessToken } from "../api/auth";

export const Route = createRootRoute({
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  beforeLoad: ({ location, search }) => {
    const token = localStorage.getItem("token");
    if (!token && location.pathname !== "/login" && !search.id) {
      throw redirect({
        to: "/login",
        replace: true,
      });
      return;
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const routerState = useRouterState();
  const isLoginPage = routerState.location.pathname === "/login";
  const id = routerState.location.search.id;
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }

    getAccessToken(id).then((accessToken) => {
      localStorage.setItem("token", accessToken);
      setToken(accessToken);
    });
  }, [id]);

  if (isLoginPage) {
    return (
      <div className="h-screen overflow-y-auto">
        <Outlet />
      </div>
    );
  }

  if (!token) {
    return <></>;
  }

  return (
    <>
      <div className="flex flex-row h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 h-screen overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {
        // <TanStackRouterDevtools />
      }
    </>
  );
}
