import { Link } from "@tanstack/react-router";
import Account from "../account";
import { useProfileQuery } from "../../hooks/useProfile";

function Sidebar() {
  const { data: profile } = useProfileQuery();
  console.log(">> profile", profile);
  return (
    <>
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
          className="overlay [--auto-close:sm] sm:shadow-none overlay-open:translate-x-0 drawer drawer-start max-w-64 fixed sm:fixed left-0 top-0 h-screen z-1 sm:flex sm:translate-x-0 [--body-scroll:true]"
          role="dialog"
          tabIndex={-1}
        >
          <div className="drawer-body px-2 pt-4 h-full overflow-y-auto overflow-x-visible !bg-(--color-background) border-r border-(--color-border) flex flex-col">
            <div className="flex-shrink-0">
              <div className="h-20 flex items-center pl-5 pr-5 text-base!">
                <span className="icon-[tabler--server] size-5 mr-3"></span>
                local
              </div>
              <ul className="menu p-0 text-sm!">
                <li>
                  <Link to="/">
                    <span className="icon-[tabler--home] size-5"></span>
                    Overview
                  </Link>
                </li>
                <li>
                  <Link to="/sshkeys">
                    <span className="icon-[tabler--key] size-5"></span>
                    SSH Keys
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex-grow"></div>
            <div className="flex-shrink-0 overflow-visible">
              <Account />
            </div>
          </div>
        </aside>
        <div id="custom-backdrop-container"></div>
      </div>
      <div className="w-[256px] max-sm:hidden flex-shrink-0"></div>
    </>
  );
}

export default Sidebar;
