import machines from "./machines.ts";
import images from "./images.ts";
import volumes from "./volumes.ts";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { parseFlags } from "@cliffy/flags";

export { images, machines, volumes };

export default function () {
  const token = Deno.env.get("FREEBSD_UP_API_TOKEN") ||
    crypto.randomUUID();
  const { flags } = parseFlags(Deno.args);

  if (!Deno.env.get("FREEBSD_UP_API_TOKEN")) {
    console.log(`Using API token: ${token}`);
  } else {
    console.log(
      `Using provided API token from environment variable FREEBSD_UP_API_TOKEN`,
    );
  }

  const app = new Hono();

  app.use(logger());
  app.use(cors());

  app.use("/images/*", bearerAuth({ token }));
  app.use("/machines/*", bearerAuth({ token }));
  app.use("/volumes/*", bearerAuth({ token }));

  app.route("/images", images);
  app.route("/machines", machines);
  app.route("/volumes", volumes);

  const port = Number(
    flags.port || flags.p ||
      (Deno.env.get("FREEBSD_UP_PORT")
        ? Number(Deno.env.get("FREEBSD_UP_PORT"))
        : 8890),
  );

  Deno.serve({ port }, app.fetch);
}
