/**
 * Database initialization and connection management
 */

import { Pool } from 'pg';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import neo4j, { Driver } from 'neo4j-driver';
import { QdrantClient } from '@qdrant/js-client-rest';
import config from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

// Database clients
let pgPool: Pool | null = null;
let redisClient: RedisClientType | null = null;
let neo4jDriver: Driver | null = null;
let qdrantClient: QdrantClient | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
async function initializePostgres(): Promise<Pool> {
  logger.info('Initializing PostgreSQL connection...');

  pgPool = new Pool({
    host: config.database.postgres.host,
    port: config.database.postgres.port,
    database: config.database.postgres.database,
    user: config.database.postgres.user,
    password: config.database.postgres.password,
    max: config.database.postgres.maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  try {
    const client = await pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connected successfully');
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }

  return pgPool;
}

/**
 * Initialize Redis client
 */
async function initializeRedis(): Promise<RedisClientType> {
  logger.info('Initializing Redis connection...');

  redisClient = createRedisClient({
    socket: {
      host: config.database.redis.host,
      port: config.database.redis.port,
    },
    password: config.database.redis.password,
    database: config.database.redis.db,
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Initialize Neo4j driver
 */
async function initializeNeo4j(): Promise<Driver> {
  logger.info('Initializing Neo4j connection...');

  neo4jDriver = neo4j.driver(
    config.database.neo4j.uri,
    neo4j.auth.basic(config.database.neo4j.user, config.database.neo4j.password),
    {
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
    }
  );

  // Test connection
  try {
    const session = neo4jDriver.session();
    await session.run('RETURN 1');
    await session.close();
    logger.info('Neo4j connected successfully');
  } catch (error) {
    logger.error('Neo4j connection failed:', error);
    throw error;
  }

  return neo4jDriver;
}

/**
 * Initialize Qdrant client
 */
async function initializeQdrant(): Promise<QdrantClient> {
  logger.info('Initializing Qdrant connection...');

  qdrantClient = new QdrantClient({
    url: `http://${config.database.qdrant.host}:${config.database.qdrant.port}`,
  });

  // Test connection and create collections if they don't exist
  try {
    // Check if collections exist
    const collections = await qdrantClient.getCollections();
    const collectionNames = collections.collections.map((c: any) => c.name);

    const requiredCollections = [
      {
        name: config.database.qdrant.collections.literature,
        size: 1536, // Voyage AI embeddings
      },
      {
        name: config.database.qdrant.collections.images,
        size: 2048, // Medical imaging embeddings
      },
      {
        name: config.database.qdrant.collections.drugs,
        size: 1536,
      },
    ];

    for (const collection of requiredCollections) {
      if (!collectionNames.includes(collection.name)) {
        logger.info(`Creating Qdrant collection: ${collection.name}`);
        await qdrantClient.createCollection(collection.name, {
          vectors: {
            size: collection.size,
            distance: 'Cosine',
          },
        });
      }
    }

    logger.info('Qdrant connected successfully');
  } catch (error) {
    logger.error('Qdrant connection failed:', error);
    throw error;
  }

  return qdrantClient;
}

/**
 * Initialize all database connections
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await Promise.all([
      initializePostgres(),
      initializeRedis(),
      initializeNeo4j(),
      initializeQdrant(),
    ]);
    logger.info('All database connections initialized');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeDatabase(): Promise<void> {
  logger.info('Closing database connections...');

  const promises: Promise<void>[] = [];

  if (pgPool) {
    promises.push(pgPool.end().then(() => logger.info('PostgreSQL connection closed')));
  }

  if (redisClient) {
    promises.push(redisClient.quit().then(() => logger.info('Redis connection closed')));
  }

  if (neo4jDriver) {
    promises.push(neo4jDriver.close().then(() => logger.info('Neo4j connection closed')));
  }

  await Promise.all(promises);
  logger.info('All database connections closed');
}

/**
 * Get database clients
 */
export function getPostgresPool(): Pool {
  if (!pgPool) {
    throw new Error('PostgreSQL pool not initialized');
  }
  return pgPool;
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

export function getNeo4jDriver(): Driver {
  if (!neo4jDriver) {
    throw new Error('Neo4j driver not initialized');
  }
  return neo4jDriver;
}

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    throw new Error('Qdrant client not initialized');
  }
  return qdrantClient;
}
