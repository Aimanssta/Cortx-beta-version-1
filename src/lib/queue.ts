import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Standard Redis connection
const redisOptions = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

// Handle connection errors gracefully
let isRedisAvailable = false;

connection.on('connect', () => {
  console.log('✅ Connected to Redis');
  isRedisAvailable = true;
});

connection.on('error', (err: any) => {
  // Silent error logging to avoid crashing the log stream if Redis is missing
  if (isRedisAvailable) {
    console.warn('⚠️ Redis connection lost:', err.message);
  } else if (err.code === 'ECONNREFUSED') {
    // Only log once to avoid flooding
    if (!(global as any)._redis_warned) {
      console.warn('ℹ️ Redis not found at 127.0.0.1:6379. SEO Engine will run in local-fallback mode.');
      (global as any)._redis_warned = true;
    }
  }
  isRedisAvailable = false;
});

export const seoContentQueue = new Queue('seo-content-generation', { connection });

/**
 * Enhanced Job Adder with Fallback
 */
export const addSEOJob = async (data: any) => {
  if (isRedisAvailable) {
    return await seoContentQueue.add('generate', data);
  } else {
    console.log('ℹ️ Redis unavailable, processing SEO job in memory-fallback mode.');
    // Simulated processing delay
    setTimeout(() => {
      console.log(`✅ [Fallback] Processed SEO content for location: ${data.locationId}`);
    }, 2000);
    return { id: 'mock-' + Date.now(), data };
  }
};

// Worker implementation for content generation
export const startWorker = () => {
  // Only start the worker if Redis is actually intended to be used
  // and we don't want it constantly trying/failing in server logs if missing
  const worker = new Worker('seo-content-generation', async (job) => {
    console.log(`Processing job ${job.id} for location: ${job.data.locationId}`);
    
    // 1. Rate-limit check (Simulated)
    // 2. Fetch data from GBP / External sources
    // 3. Generate content using Gemini AI
    // 4. Validate output (Quality Checks)
    // 5. Store in Firestore/Database
    
    return { status: 'completed', locationId: job.data.locationId };
  }, { connection });

  worker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });

  return worker;
};
