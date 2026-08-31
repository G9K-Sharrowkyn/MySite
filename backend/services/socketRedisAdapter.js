import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';

let publisher = null;
let subscriber = null;

export const configureSocketRedisAdapter = async (io) => {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return { enabled: false };

  publisher = createClient({ url });
  subscriber = publisher.duplicate();
  publisher.on('error', (error) => {
    console.error('Redis Socket.IO publisher error:', error?.message || error);
  });
  subscriber.on('error', (error) => {
    console.error('Redis Socket.IO subscriber error:', error?.message || error);
  });

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    io.adapter(createAdapter(publisher, subscriber));
    return { enabled: true };
  } catch (error) {
    await closeSocketRedisAdapter();
    throw new Error(`Could not initialize the Socket.IO Redis adapter: ${error.message}`, {
      cause: error
    });
  }
};

export const closeSocketRedisAdapter = async () => {
  const clients = [publisher, subscriber].filter(Boolean);
  publisher = null;
  subscriber = null;
  await Promise.allSettled(
    clients.map(async (client) => {
      if (client.isOpen) await client.quit();
    })
  );
};

export const createRedisRateLimitStore = (prefix) => {
  if (!publisher?.isOpen) return null;
  return new RedisStore({
    prefix,
    sendCommand: async (...args) => publisher.sendCommand(args)
  });
};
