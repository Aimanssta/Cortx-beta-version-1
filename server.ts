import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startWorker } from "./src/lib/queue";
import fs from 'fs';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import cors from 'cors';
import admin from 'firebase-admin';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0470557726'
  });
}
const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  
  // Use express.json() for all routes EXCEPT the webhook route which needs raw body
  app.use((req, res, next) => {
    if (req.originalUrl === '/api/stripe-webhook') {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

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

      const { userId } = req.body;
      if (!userId) {
        console.error("Missing userId in request body");
        return res.status(400).json({ error: "User ID is required." });
      }

      const s = new Stripe(secret);
      const origin = req.headers.origin || process.env.BASE_URL || `http://${req.headers.host}`;
      console.log(`Using origin: ${origin}`);

      const session = await s.checkout.sessions.create({
        payment_method_types: ['card'],
        client_reference_id: userId,
        metadata: {
          userId: userId
        },
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

  app.post("/api/stripe-webhook", express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return res.status(400).send("Webhook secret not configured.");
    }

    let event;

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Received event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;

      if (userId) {
        console.log(`Upgrading user ${userId} to premium...`);
        try {
          await db.collection('users').doc(userId).set({
            isSubscribed: true,
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          console.log(`User ${userId} upgraded successfully.`);
        } catch (error) {
          console.error(`Error updating user ${userId}:`, error);
        }
      }
    } else if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
      const sessionOrInvoice = event.data.object as any;
      const customerId = sessionOrInvoice.customer as string;

      console.log(`Payment failed or subscription deleted for customer ${customerId}. Event: ${event.type}`);

      // Find user by stripeCustomerId
      try {
        const userSnapshot = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          console.log(`Revoking premium access for user ${userDoc.id}...`);
          await userDoc.ref.update({
            isSubscribed: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`User ${userDoc.id} access revoked.`);
        }
      } catch (error) {
        console.error(`Error revoking access for customer ${customerId}:`, error);
      }
    }

    res.json({received: true});
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
