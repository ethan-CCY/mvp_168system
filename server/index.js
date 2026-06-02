import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./routes.js";
import { toJson } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 8000);

app.use(cors({
  origin: process.env.WEB_ORIGIN || "http://127.0.0.1:5173",
  credentials: false
}));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json(toJson({ message: error.message || "Server error" }));
});

app.listen(port, () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
