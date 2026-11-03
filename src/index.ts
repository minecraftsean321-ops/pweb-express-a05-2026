import express from "express";
import {
  globalErrorHandler,
  logger,
  notFoundHandler,
} from "./middlewares/logger";
import heroRouter from "./routes/hero";
import skinRouter from "./routes/skin";
import playerRouter from "./routes/player"; // ← baru
import statisticsRouter from "./routes/statistics"; // ← baru

const app = express();

app.use(express.json());

// Pasang logger diurutan teratas agar bisa menangkap semua request
app.use(logger);

app.get("/health", (_req, res) => {
  res.status(200).send("Server is up and running 💫");
});

const PORT = 3000;

app.use("/api/heroes", heroRouter);
app.use("/api/skins", skinRouter);
app.use("/api/players", playerRouter); // ← baru
app.use("/api/statistics", statisticsRouter); // ← baru
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, (error?: Error) => {
  if (error) throw error;
  console.log(`Express is running on Port ${PORT}`);
});
