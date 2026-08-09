import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("元気です"));

export default app;
