import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./features/auth/routes";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
