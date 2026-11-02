import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).send("Server is up and running 💫");
});

const PORT = 3000;

app.listen(PORT, (error?: Error) => {
  if (error) throw error; 
  console.log(`Express is running on Port ${PORT}`);
});