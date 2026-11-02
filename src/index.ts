import express from "express";
import { globalErrorHandler, logger, notFoundHandler } from "./middlewares/logger";

const app = express();

app.use(express.json());

// Pasang logger diurutan teratas agar bisa menangkap semua request
app.use(logger);

app.get("/health", (_req, res) => {
  res.status(200).send("Server is up and running 💫");
});

const PORT = 3000;

app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, (error?: Error) => {
  if (error) throw error; 
  console.log(`Express is running on Port ${PORT}`);
});