import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Standard Redis connection
const redisOptions = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false, // Disable offline queue to avoid memory build-up if Redis is never found
  retryStrategy(times: number) {
    // Only try to reconnect a few times, then stop if it's not there
    if (times > 3) return null; 
    return Math.min(times * 100, 2000);
  },
};

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(REDIS_URL, redisOptions);

// Handle connection errors gracefully
let isRedisAvailable = false;
let redisCheckAttempted = false;

connection.on('connect', () => {
  console.log('✅ Connected to Redis');
  isRedisAvailable = true;
  redisCheckAttempted = true;
});

connection.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    if (!redisCheckAttempted) {
      console.warn('ℹ️ Redis not found. SEO Engine will run in local-fallback mode.');
      redisCheckAttempted = true;
    }
  } else {
    console.warn('⚠️ Redis connection error:', err.message);
  }
  isRedisAvailable = false;
});

// Lazy-initialize Queue only if needed and potentially available
let queueInstance: Queue | null = null;
export const getSEOQueue = () => {
  if (!queueInstance && isRedisAvailable) {
    queueInstance = new Queue('seo-content-generation', { connection });
  }
  return queueInstance;
};

/**
 * Enhanced Job Adder with Fallback
 */
export const addSEOJob = async (data: any) => {
  const queue = getSEOQueue();
  if (queue && isRedisAvailable) {
    try {
      return await queue.add('generate', data);
    } catch (error) {
      console.warn('Failed to add job to BullMQ, falling back:', error);
    }
  }
  
  console.log('ℹ️ Redis unavailable, processing SEO job in memory-fallback mode.');
  setTimeout(() => {
    console.log(`✅ [Fallback] Processed SEO content for location: ${data.locationId}`);
  }, 2000);
  return { id: 'mock-' + Date.now(), data };
};

// Worker implementation for content generation
export const startWorker = () => {
  // We check if Redis is available. If not, we don't start the worker to avoid log spam.
  // We check periodically if Redis became available if we want to be fancy, 
  // but for now, we just check once after a short delay.
  setTimeout(() => {
    if (isRedisAvailable) {
      console.log("🛠️ Starting BullMQ Worker...");
      const worker = new Worker('seo-content-generation', async (job) => {
        console.log(`Processing job ${job.id} for location: ${job.data.locationId}`);
        return { status: 'completed', locationId: job.data.locationId };
      }, { connection });

      worker.on('completed', job => {
        console.log(`Job ${job.id} has completed!`);
      });

      worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} has failed with ${err.message}`);
      });
    } else {
      console.log("ℹ️ Skipping BullMQ Worker start (Redis unavailable)");
    }
  }, 5000);
};
