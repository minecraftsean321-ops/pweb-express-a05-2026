import express from "express";
import { globalErrorHandler, logger, notFoundHandler } from "./middlewares/logger";
import heroRouter from './routes/hero';
import skinRouter from './routes/skin';


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
app.use('/api/heroes', heroRouter);
app.use('/api/skins', skinRouter);

app.listen(PORT, (error?: Error) => {
  if (error) throw error; 
  console.log(`Express is running on Port ${PORT}`);
});