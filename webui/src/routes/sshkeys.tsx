import { createFileRoute } from "@tanstack/react-router";
import SshKeysPage from "../pages/sshkeys";

export const Route = createFileRoute("/sshkeys")({
  component: SshKeysPage,
});
