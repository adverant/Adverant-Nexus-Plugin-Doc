/**
 * Health check API endpoint
 */

import { Router, Request, Response } from 'express';
import { getPostgresPool, getRedisClient, getNeo4jDriver, getQdrantClient } from '../database';
import config from '../config';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('HealthCheck');

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
    neo4j: DependencyStatus;
    qdrant: DependencyStatus;
    nexus_services: {
      graphrag: DependencyStatus;
      mageagent: DependencyStatus;
      fileprocess: DependencyStatus;
      learningagent: DependencyStatus;
      sandbox: DependencyStatus;
      auth: DependencyStatus;
    };
  };
  features: {
    clinicalConsultation: boolean;
    medicalImaging: boolean;
    drugDiscovery: boolean;
    telemedicine: boolean;
    googleDriveStorage: boolean;
    realTimeStreaming: boolean;
  };
  agents: {
    maxAgents: number;
    warmPoolSize: number;
    nNumberSpawning: boolean;
  };
}

interface DependencyStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Check PostgreSQL health
 */
async function checkPostgres(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const pool = getPostgresPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { healthy: true, latency: Date.now() - start };
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    await client.ping();
    return { healthy: true, latency: Date.now() - start };
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Check Neo4j health
 */
async function checkNeo4j(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    return { healthy: true, latency: Date.now() - start };
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Check Qdrant health
 */
async function checkQdrant(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const client = getQdrantClient();
    await client.getCollections();
    return { healthy: true, latency: Date.now() - start };
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Check Nexus service health (simple ping)
 */
async function checkNexusService(serviceUrl: string): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const axios = require('axios');
    const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
    return {
      healthy: response.status === 200,
      latency: Date.now() - start,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

/**
 * GET /api/doctor/health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Check all dependencies
    const [postgres, redis, neo4j, qdrant, graphrag, mageagent, fileprocess, learningagent, sandbox, auth] =
      await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkNeo4j(),
        checkQdrant(),
        checkNexusService(config.services.graphrag),
        checkNexusService(config.services.mageagent),
        checkNexusService(config.services.fileprocess),
        checkNexusService(config.services.learningagent),
        checkNexusService(config.services.sandbox),
        checkNexusService(config.services.auth),
      ]);

    // Determine overall health status
    const allHealthy =
      postgres.healthy &&
      redis.healthy &&
      neo4j.healthy &&
      qdrant.healthy &&
      graphrag.healthy &&
      mageagent.healthy;

    const someDegraded =
      !fileprocess.healthy || !learningagent.healthy || !sandbox.healthy || !auth.healthy;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy && !someDegraded) {
      status = 'healthy';
    } else if (allHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const healthStatus: HealthStatus = {
      status,
      service: 'nexusdoc',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        postgres,
        redis,
        neo4j,
        qdrant,
        nexus_services: {
          graphrag,
          mageagent,
          fileprocess,
          learningagent,
          sandbox,
          auth,
        },
      },
      features: config.features,
      agents: {
        maxAgents: config.agents.maxAgents,
        warmPoolSize: config.agents.warmPoolSize,
        nNumberSpawning: config.agents.enableNNumberSpawning,
      },
    };

    const responseTime = Date.now() - startTime;
    logger.info(`Health check completed in ${responseTime}ms - status: ${status}`);

    const httpStatus = status === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(healthStatus);
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'nexusdoc',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/doctor/health/live
 * Liveness probe (basic check)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /api/doctor/health/ready
 * Readiness probe (checks critical dependencies)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);

    if (postgres.healthy && redis.healthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({
        status: 'not_ready',
        postgres: postgres.healthy,
        redis: redis.healthy,
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
    });
  }
});

export { router as healthRouter };
