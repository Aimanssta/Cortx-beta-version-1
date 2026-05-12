import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(400).json({ error: "Stripe configuration is missing." });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const stripe = new Stripe(secret);
    const origin = req.headers.origin || process.env.BASE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      client_reference_id: userId,
      metadata: { userId },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CortX GBP Live - Market Domination',
              description: 'Full access to AI review responses, post scheduler, and SEO engine.',
            },
            unit_amount: 30000, // $300.00
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/?subscribed=true`,
      cancel_url: `${origin}/?subscribed=false`,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe error details:', {
      message: error.message,
      stack: error.stack,
      envSet: !!process.env.STRIPE_SECRET_KEY
    });
    return res.status(500).json({ 
      error: error.message,
      details: "Check Vercel logs for full stack trace."
    });
  }
}
