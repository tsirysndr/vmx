/** biome-ignore-all lint/a11y/useButtonType: <explanation> */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login, loginWithATProto, loginWithGithub } from "../../api/auth";

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [handle, setHandle] = useState("");
  const [continueWithAccessToken, setContinueWithAccessToken] = useState(false);

  const onSignInWithAccessToken = async () => {
    if (!token) {
      return;
    }

    try {
      await login(token);
    } catch {
      alert("Failed to Login, please try again");
      return;
    }

    localStorage.setItem("token", token);

    await navigate({
      to: "/",
    });
  };

  const onSignInWithGithub = async () => {
    const { auth_url } = await loginWithGithub();
    window.location.href = auth_url;
  };

  const onSignInWithATProto = async () => {
    setLoading(true);
    const { auth_url } = await loginWithATProto(handle);
    setLoading(false);
    window.location.href = auth_url;
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6">
        <h1 className="text-[17px] mb-8">Sign in to your account</h1>
        <div>
          {!continueWithAccessToken && (
            <button
              onClick={() => setContinueWithAccessToken(true)}
              className="btn btn-md btn-outline text-[14px] w-full text-white mb-4"
            >
              <span className="icon-[tabler--key] my-auto size-4 shrink-0 text-white!"></span>
              Continue with Access Token
            </button>
          )}

          {continueWithAccessToken && (
            <button
              onClick={() => setContinueWithAccessToken(false)}
              className="btn btn-md btn-outline text-[14px] w-full text-white mb-4"
            >
              <span className="icon-[tabler--at] my-auto size-4 shrink-0 text-white!"></span>
              Continue with AT Protocol
            </button>
          )}
          <button
            onClick={onSignInWithGithub}
            className="btn btn-md btn-outline text-[14px] w-full text-white"
          >
            <span className="icon-[tabler--brand-github] my-auto size-4 shrink-0 text-white!"></span>
            Continue with GitHub
          </button>
        </div>
        <div className="flex items-center justify-center h-10">
          <span className="text-[14px] ">or</span>
        </div>

        {!continueWithAccessToken && (
          <div className="input input-md flex w-full space-x-4 bg-(--color-background) border-r text-[13px]">
            <span className="icon-[tabler--at] my-auto size-4 shrink-0 text-[#63656d]!"></span>
            <input
              type="text"
              className="grow"
              placeholder="<username>.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value.trim())}
            />
          </div>
        )}
        {continueWithAccessToken && (
          <div className="input input-md flex w-full space-x-4 bg-(--color-background) border-r text-[13px]">
            <span className="icon-[tabler--key] my-auto size-4 shrink-0 text-[#63656d]!"></span>
            <input
              type="password"
              className="grow"
              placeholder="Access Token"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
            />
          </div>
        )}
        <div className="mt-6">
          <button
            onClick={
              continueWithAccessToken
                ? onSignInWithAccessToken
                : onSignInWithATProto
            }
            className="btn btn-primary btn-md text-[14px] w-full text-white"
          >
            {loading && (
              <span className="loading loading-spinner loading-sm"></span>
            )}
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
