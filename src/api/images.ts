import { Hono } from "hono";
import { Effect, pipe } from "effect";
import { parseParams, presentation } from "./utils.ts";
import { getImage, listImages } from "../images.ts";

const app = new Hono();

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      listImages(),
      presentation(c),
    ),
  ));

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getImage(id)),
      presentation(c),
    ),
  ));

app.post("/", (c) => {
  return c.json({ message: "New image created" });
});

app.delete("/:id", (c) => {
  const { id } = c.req.param();
  return c.json({ message: `Image with ID ${id} deleted` });
});

export default app;
