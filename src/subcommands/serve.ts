import { start_http_server } from "../../bindings/bindings.ts";
import api from "../api/mod.ts";

export default async function () {
    // Handle Ctrl+C (SIGINT) and SIGTERM for graceful shutdown
    const shutdown = async () => {
        console.log("\nShutting down servers...");
        Deno.exit(0);
    };

    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);

    start_http_server();
    api();
}
