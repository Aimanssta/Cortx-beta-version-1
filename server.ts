import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startWorker } from "./src/lib/queue";
import fs from 'fs';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Initialize BullMQ Workers
  console.log("Initializing SEO Content Workers...");
  startWorker();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      workers: "running", 
      platform: "CORTX pSEO",
      env: process.env.NODE_ENV,
      stripeKeySet: !!process.env.STRIPE_SECRET_KEY
    });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    console.log("POST /api/create-checkout-session hit");
    try {
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        console.error("Missing STRIPE_SECRET_KEY");
        return res.status(400).json({ error: "Stripe configuration is missing. Please set STRIPE_SECRET_KEY in the settings." });
      }

      const s = new Stripe(secret);
      const origin = req.headers.origin || process.env.BASE_URL || `http://${req.headers.host}`;
      console.log(`Using origin: ${origin}`);

      const session = await s.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'CortX GBP Live - Market Domination',
                description: 'Full access to AI review responses, post scheduler, and SEO engine.',
              },
              unit_amount: 30000, // $300.00
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/?subscribed=true`,
        cancel_url: `${origin}/?subscribed=false`,
      });

      console.log(`Session created: ${session.id}`);
      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Programmatic SEO: Sitemap Serving
  app.get("/sitemap.xml", (req, res) => {
    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.header('Content-Type', 'application/xml');
      res.sendFile(sitemapPath);
    } else {
      res.status(404).send("Sitemap not generated yet.");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 CORTX pSEO Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
