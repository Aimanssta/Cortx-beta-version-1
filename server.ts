import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startWorker } from "./src/lib/queue";
import fs from 'fs';
import Stripe from 'stripe';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Lazy Stripe initialization
  let stripe: Stripe | null = null;
  const getStripe = () => {
    if (!stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set');
      }
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
  };

  // Initialize BullMQ Workers
  console.log("Initializing SEO Content Workers...");
  startWorker();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", workers: "running", platform: "CORTX pSEO" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const s = getStripe();
      const session = await s.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'CORTX Premium Subscription',
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
        success_url: `${req.headers.origin}/?subscribed=true`,
        cancel_url: `${req.headers.origin}/?subscribed=false`,
      });

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
