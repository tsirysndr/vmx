import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return (
    <>
      <div className="flex flex-row min-h-screen">
        <div>
          <button
            type="button"
            className="btn btn-text max-sm:btn-square sm:hidden"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="scoped-sidebar"
            data-overlay="#scoped-sidebar"
            data-overlay-options='{ "backdropExtraClasses": "!absolute", "backdropParent": "#custom-backdrop-container" }'
          >
            <span className="icon-[tabler--menu-2] size-5"></span>
          </button>

          <aside
            id="scoped-sidebar"
            className="overlay [--auto-close:sm] sm:shadow-none overlay-open:translate-x-0 drawer drawer-start max-w-64 absolute z-1 sm:flex sm:translate-x-0 [--body-scroll:true]"
            role="dialog"
            tabIndex={-1}
          >
            <div className="drawer-body px-2 pt-4  bg-(--color-background)! border-r border-(--color-border)">
              <div className="h-20 flex items-center pl-5 pr-5">vmx</div>
              <ul className="menu p-0 text-[14px]">
                <li>
                  <a href="#">
                    <span className="icon-[tabler--home] size-5"></span>
                    Overview
                  </a>
                </li>
                <li>
                  <a href="#">
                    <span className="icon-[tabler--user] size-5"></span>
                    Profile
                  </a>
                </li>
                <li>
                  <a href="#">
                    <span className="icon-[tabler--key] size-5"></span>
                    SSH Keys
                  </a>
                </li>
              </ul>
            </div>
          </aside>
          <div id="custom-backdrop-container"></div>
        </div>
        <div className="ml-[260px] min-h-screen w-[calc(100%-260px)]">
          <Outlet />
        </div>
      </div>

      {
        // <TanStackRouterDevtools />
      }
    </>
  );
}
