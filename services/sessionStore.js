const path = require('path');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const { RedisStore } = require('connect-redis');
const { createClient } = require('redis');

const SQLiteStore = SQLiteStoreFactory(session);

let redisClient;

function getSessionStoreBackend() {
  return process.env.REDIS_URL ? 'redis' : 'sqlite';
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis session client error:', err.message);
    });

    redisClient.connect().catch((err) => {
      console.error('Redis session client connection failed:', err.message);
    });
  }

  return redisClient;
}

function createSessionStore() {
  if (getSessionStoreBackend() === 'redis') {
    return {
      backend: 'redis',
      store: new RedisStore({
        client: getRedisClient(),
        prefix: process.env.REDIS_PREFIX || 'ahp:sess:'
      })
    };
  }

  const sessionDbDir = process.env.SESSION_DB_DIR || path.join(__dirname, '..', 'data');
  const sessionDbFile = process.env.SESSION_DB_FILE || 'sessions.sqlite';
  return {
    backend: 'sqlite',
    store: new SQLiteStore({
      db: sessionDbFile,
      dir: sessionDbDir,
      concurrentDB: true,
      table: 'sessions'
    })
  };
}

module.exports = {
  createSessionStore,
  getSessionStoreBackend
};