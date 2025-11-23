import {
  createRootRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import Sidebar from "../components/sidebar";

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const token = localStorage.getItem("token");
    if (!token && location.pathname !== "/login") {
      throw redirect({
        to: "/login",
        replace: true,
      });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const routerState = useRouterState();
  const isLoginPage = routerState.location.pathname === "/login";

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  if (isLoginPage) {
    return (
      <div className="h-screen overflow-y-auto">
        <Outlet />
      </div>
    );
  }

  if (!localStorage.getItem("token")) {
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
