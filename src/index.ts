/**
 * NexusDoc - Medical AI Microservice
 * Main entry point
 *
 * @version 1.0.0
 * @description Comprehensive medical AI service integrating clinical decision support,
 *              medical imaging analysis, drug discovery, and telemedicine capabilities
 *              with N-number dynamic agent spawning
 */

import express, { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import { createLogger } from './utils/logger';
import { initializeTelemetry } from './utils/telemetry';
import { initializeDatabase, closeDatabase } from './database';
import { healthRouter } from './api/health';
import consultationsRouter from './api/consultations';
import { usageTrackingMiddleware, flushPendingReports } from './middleware/usage-tracking';
// Import other routers as they are created
// import { imagingRouter } from './api/imaging';
// import { drugDiscoveryRouter } from './api/drug-discovery';
// import { telemedicineRouter } from './api/telemedicine';

const logger = createLogger('Main');

class NexusDocService {
  private app: Application;
  private httpServer: HTTPServer;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.httpServer = new HTTPServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing NexusDoc service...');

    try {
      // 1. Initialize OpenTelemetry (if enabled)
      if (config.telemetry.enabled) {
        initializeTelemetry();
        logger.info('OpenTelemetry initialized');
      }

      // 2. Initialize databases
      await initializeDatabase();
      logger.info('Databases initialized');

      // 3. Setup middleware
      this.setupMiddleware();
      logger.info('Middleware configured');

      // 4. Setup routes
      this.setupRoutes();
      logger.info('Routes configured');

      // 5. Setup WebSocket
      this.setupWebSocket();
      logger.info('WebSocket configured');

      // 6. Setup error handling
      this.setupErrorHandling();
      logger.info('Error handling configured');

      logger.info('NexusDoc service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize service:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Usage tracking (after body parsing)
    this.app.use(usageTrackingMiddleware);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Base API route
    this.app.get('/api/doctor', (req, res) => {
      res.json({
        service: 'nexusdoc',
        version: '1.0.0',
        description: 'Medical AI microservice for Adverant Nexus Platform',
        status: 'operational',
      });
    });

    // Health check
    this.app.use('/api/doctor/health', healthRouter);

    // Clinical consultations (Phase 2 - Agent Orchestration)
    if (config.features.clinicalConsultation) {
      this.app.use('/api/doctor/consultations', consultationsRouter);
      logger.info('Clinical consultations endpoint registered');
    }

    // Feature routes (to be implemented in future phases)
    // if (config.features.medicalImaging) {
    //   this.app.use('/api/doctor/imaging', imagingRouter);
    // }
    //
    // if (config.features.drugDiscovery) {
    //   this.app.use('/api/doctor/drug-discovery', drugDiscoveryRouter);
    // }
    //
    // if (config.features.telemedicine) {
    //   this.app.use('/api/doctor/telemedicine', telemedicineRouter);
    // }

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Authentication (placeholder - integrate with Nexus Auth)
      socket.on('authenticate', async (data) => {
        try {
          // TODO: Validate JWT token with Nexus Auth Service
          logger.info(`Client ${socket.id} authenticated`);
          socket.emit('authenticated', { success: true });
        } catch (error) {
          logger.error(`Authentication failed for ${socket.id}:`, error);
          socket.emit('error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Task streaming
      socket.on('subscribe_task', (taskId: string) => {
        logger.info(`Client ${socket.id} subscribed to task ${taskId}`);
        socket.join(`task:${taskId}`);
      });

      socket.on('unsubscribe_task', (taskId: string) => {
        logger.info(`Client ${socket.id} unsubscribed from task ${taskId}`);
        socket.leave(`task:${taskId}`);
      });

      // Disconnect
      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error:', err);

      // Don't expose internal errors in production
      const message = config.nodeEnv === 'production'
        ? 'Internal server error'
        : err.message;

      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Give time for logs to flush
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Flush pending usage reports
      try {
        logger.info('Flushing pending usage reports...');
        await flushPendingReports();
        logger.info('Usage reports flushed successfully');
      } catch (error) {
        logger.error('Error flushing usage reports:', error);
      }

      // Stop accepting new connections
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Close WebSocket connections
      this.io.close(() => {
        logger.info('WebSocket server closed');
      });

      // Close all database connections (PostgreSQL, Redis, Neo4j, Qdrant)
      try {
        await closeDatabase();
        logger.info('All database connections closed successfully');
      } catch (error) {
        logger.error('Error closing database connections:', error);
        // Continue shutdown even if database cleanup fails
      }

      setTimeout(() => {
        logger.info('Graceful shutdown complete');
        process.exit(0);
      }, 2000); // Reduced to 2s since databases are already closed
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    await this.initialize();

    // Start HTTP server
    this.httpServer.listen(config.port, () => {
      logger.info(`🏥 NexusDoc HTTP API listening on port ${config.port}`);
      logger.info(`🔌 NexusDoc WebSocket listening on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(`🚀 Service ready for medical AI operations`);
    });
  }

  /**
   * Get Socket.IO instance for broadcasting from other modules
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

// Start the service
const service = new NexusDocService();
service.start().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

// Export for testing
export default service;
