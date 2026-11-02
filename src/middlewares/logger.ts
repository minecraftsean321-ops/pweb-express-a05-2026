// src/middlewares/logger.ts
import type { NextFunction, Request, Response } from "express";

// Mencatat setiap request: METHOD /path -> status (durasi)
export const logger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
    );
  });

  next(); // lanjut ke middleware / handler berikutnya
};


//Untuk membalas
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) =>{
    res.status(404).json({
        status: false,
        message: "Endpoint tidak ditemukan!"
    });

};

//Jika endpoint tidak ada
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: false,
    message: err.message || "Terjadi kesalahan internal server"
  });
};
