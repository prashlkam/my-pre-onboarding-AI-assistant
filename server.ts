import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import bodyParser from "body-parser";
import { JSONFilePreset } from 'lowdb/node';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Candidate {
  id: string;
  name: string;
  role: string;
  instructionExceptions: { instruction: string; reason: string }[];
  completedTasks: { item: string; guidance: string }[];
  pendingTasks: { item: string; guidance: string }[];
  timestamp: string;
}

interface Data {
  candidates: Candidate[];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Lowdb
  const defaultData: Data = { candidates: [] };
  const db = await JSONFilePreset<Data>('db.json', defaultData);

  app.use(cors());
  app.use(bodyParser.json());

  // API Routes
  app.post("/api/candidates", async (req, res) => {
    try {
      const candidate: Candidate = {
        ...req.body,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      };
      
      await db.update(({ candidates }) => candidates.push(candidate));
      res.status(201).json(candidate);
    } catch (error) {
      console.error("Error saving candidate:", error);
      res.status(500).json({ error: "Failed to save candidate data" });
    }
  });

  app.get("/api/candidates", (req, res) => {
    res.json(db.data.candidates);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
