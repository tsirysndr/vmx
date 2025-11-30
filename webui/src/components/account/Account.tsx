import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Profile } from "../../types/profile";

type AccountProps = {
  profile: Profile;
};

function Account(props: AccountProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const onSignOut = () => {
    localStorage.removeItem("token");
    setIsOpen(false);
  };

  return (
    <div className="pt-2 border-t border-(--color-border)" ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 w-full p-2 transition-colors"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-(--color-fuschia) text-(--color-slate)">
            {!props.profile.avatar_url && (
              <span className="icon-[tabler--user] size-5"></span>
            )}
            {props.profile.avatar_url && (
              <img
                src={props.profile.avatar_url}
                alt="avatar"
                className="rounded-full"
              />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">
              {props.profile.display_name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {props.profile.handle}
            </p>
          </div>
          <span className="icon-[tabler--dots-vertical] size-4 flex-shrink-0"></span>
        </button>

        {isOpen && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-[#130826] border border-[#7033ff9c] rounded shadow-xl py-1"
            style={{ zIndex: 9999 }}
          >
            <Link
              to="/profile"
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#241338] transition-colors text-sm"
              onClick={() => setIsOpen(false)}
            >
              <span className="icon-[tabler--user] size-4"></span>
              Profile
            </Link>
            <Link
              to="/settings"
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#241338] transition-colors text-sm text-left"
              onClick={() => setIsOpen(false)}
            >
              <span className="icon-[tabler--settings] size-4"></span>
              Settings
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#241338] transition-colors text-sm "
              onClick={onSignOut}
            >
              <span className="icon-[tabler--logout] size-4"></span>
              Sign out
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default Account;
