import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { fetchMachines } from "../../api/machines";
import { login } from "../../api/auth";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");

  const onSignIn = async () => {
    if (!username) {
      return;
    }

    try {
      await login(username);
    } catch {
      alert("Failed to Login, please try again");
      return;
    }

    localStorage.setItem("token", username);

    await navigate({
      to: "/",
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6">
        <h1 className="text-[17px] mb-8">Sign in to your account</h1>
        <div className="input input-md flex w-full space-x-4 bg-(--color-background) border-r text-[13px]">
          <span className="icon-[tabler--user] my-auto size-4 shrink-0 text-[#63656d]!"></span>
          <input
            type="text"
            className="grow"
            placeholder="<username>.bsky.social or access token"
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
          />
        </div>
        <div className="mt-6">
          <button
            onClick={onSignIn}
            className="btn btn-primary btn-md text-[14px] w-full text-white"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
