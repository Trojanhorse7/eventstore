import express, { type Request, type Response } from "express";
import type { EventStore } from "./store.js";

export function createApp(store: EventStore) {
  const app = express();
  app.use(express.json());

  // POST /events — accept any JSON body, stamp id + createdAt, append, return 201
  app.post("/events", (req: Request, res: Response) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const event = store.append(req.body as Record<string, unknown>);
    res.status(201).json(event);
  });

  // GET /events/:id — seek read via index; 404 if not found
  app.get("/events/:id", (req: Request, res: Response) => {
    const event = store.read(req.params.id);
    if (!event) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(event);
  });

  // GET /stats — total events and bytes on disk
  app.get("/stats", (_req: Request, res: Response) => {
    res.json(store.stats());
  });

  return app;
}
