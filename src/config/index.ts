/**
 * NexusDoc - Configuration Module
 * Centralized configuration management for the medical AI service
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  // Service Configuration
  nodeEnv: string;
  logLevel: string;
  port: number;
  wsPort: number;

  // Database Configuration
  database: {
    postgres: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      maxConnections: number;
    };
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    neo4j: {
      uri: string;
      user: string;
      password: string;
    };
    qdrant: {
      host: string;
      port: number;
      collections: {
        literature: string;
        images: string;
        drugs: string;
      };
    };
  };

  // Nexus Service Integration
  services: {
    graphrag: string;
    mageagent: string;
    fileprocess: string;
    learningagent: string;
    sandbox: string;
    auth: string;
  };

  // Google Drive Configuration
  googleDrive: {
    serviceAccountKey: string;
    folderId: string;
    encryptionEnabled: boolean;
    encryptionKey: string;
    maxFileSize: number;
    chunkSize: number;
  };

  // Medical APIs
  medicalApis: {
    pubmed: {
      apiKey?: string;
      endpoint: string;
    };
    cochrane: {
      apiKey?: string;
    };
    openrouter: {
      apiKey: string;
    };
  };

  // Agent Configuration
  agents: {
    maxAgents: number;
    warmPoolSize: number;
    enableNNumberSpawning: boolean;
    spawnTimeout: number;
    defaultModel: string;
  };

  // Complexity Scoring Weights
  complexityWeights: {
    symptoms: number;
    urgency: number;
    history: number;
    dataVolume: number;
    specialties: number;
    rareDisease: number;
  };

  // Task Management
  tasks: {
    defaultTimeout: number;
    cleanupInterval: number;
    retentionDays: number;
  };

  // Security
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    bcryptRounds: number;
    hipaaAuditEnabled: boolean;
    encryptionAlgorithm: string;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  // CORS
  cors: {
    origin: string;
    credentials: boolean;
  };

  // OpenTelemetry
  telemetry: {
    enabled: boolean;
    serviceName: string;
    otlpEndpoint: string;
    jaegerEndpoint: string;
  };

  // Prometheus
  prometheus: {
    enabled: boolean;
    port: number;
  };

  // Medical Knowledge
  medicalKnowledge: {
    ontologyUpdateInterval: number;
    literatureCacheTTL: number;
    drugInteractionCacheTTL: number;
  };

  // Feature Flags
  features: {
    clinicalConsultation: boolean;
    medicalImaging: boolean;
    drugDiscovery: boolean;
    telemedicine: boolean;
    googleDriveStorage: boolean;
    realTimeStreaming: boolean;
  };
}

const config: Config = {
  // Service Configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  port: parseInt(process.env.PORT || '8114', 10),
  wsPort: parseInt(process.env.WS_PORT || '8115', 10),

  // Database Configuration
  database: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DATABASE || 'nexusdoc',
      user: process.env.POSTGRES_USER || 'unified_nexus',
      password: process.env.POSTGRES_PASSWORD || 'nexus_secure_password',
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'nexus_neo4j_password',
    },
    qdrant: {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333', 10),
      collections: {
        literature: process.env.QDRANT_COLLECTION_LITERATURE || 'medical_literature',
        images: process.env.QDRANT_COLLECTION_IMAGES || 'medical_images',
        drugs: process.env.QDRANT_COLLECTION_DRUGS || 'drug_compounds',
      },
    },
  },

  // Nexus Service Integration
  services: {
    graphrag: process.env.GRAPHRAG_ENDPOINT || 'http://localhost:9090',
    mageagent: process.env.MAGEAGENT_ENDPOINT || 'http://localhost:9080',
    fileprocess: process.env.FILEPROCESS_ENDPOINT || 'http://localhost:9099',
    learningagent: process.env.LEARNINGAGENT_ENDPOINT || 'http://localhost:9097',
    sandbox: process.env.SANDBOX_ENDPOINT || 'http://localhost:9095',
    auth: process.env.AUTH_ENDPOINT || 'http://localhost:9101',
  },

  // Google Drive Configuration
  googleDrive: {
    serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    encryptionEnabled: process.env.GOOGLE_DRIVE_ENCRYPTION_ENABLED === 'true',
    encryptionKey: process.env.GOOGLE_DRIVE_ENCRYPTION_KEY || '',
    maxFileSize: parseInt(process.env.GOOGLE_DRIVE_MAX_FILE_SIZE || '5368709120', 10),
    chunkSize: parseInt(process.env.GOOGLE_DRIVE_CHUNK_SIZE || '8388608', 10),
  },

  // Medical APIs
  medicalApis: {
    pubmed: {
      apiKey: process.env.PUBMED_API_KEY,
      endpoint: process.env.PUBMED_API_ENDPOINT || 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    },
    cochrane: {
      apiKey: process.env.COCHRANE_API_KEY,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
    },
  },

  // Agent Configuration
  agents: {
    maxAgents: parseInt(process.env.MAX_AGENTS || '15', 10),
    warmPoolSize: parseInt(process.env.AGENT_WARM_POOL_SIZE || '5', 10),
    enableNNumberSpawning: process.env.ENABLE_N_NUMBER_SPAWNING === 'true',
    spawnTimeout: parseInt(process.env.AGENT_SPAWN_TIMEOUT || '300000', 10),
    defaultModel: process.env.AGENT_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
  },

  // Complexity Scoring Weights
  complexityWeights: {
    symptoms: parseFloat(process.env.COMPLEXITY_WEIGHT_SYMPTOMS || '0.15'),
    urgency: parseFloat(process.env.COMPLEXITY_WEIGHT_URGENCY || '0.25'),
    history: parseFloat(process.env.COMPLEXITY_WEIGHT_HISTORY || '0.15'),
    dataVolume: parseFloat(process.env.COMPLEXITY_WEIGHT_DATA_VOLUME || '0.10'),
    specialties: parseFloat(process.env.COMPLEXITY_WEIGHT_SPECIALTIES || '0.20'),
    rareDisease: parseFloat(process.env.COMPLEXITY_WEIGHT_RARE_DISEASE || '0.15'),
  },

  // Task Management
  tasks: {
    defaultTimeout: parseInt(process.env.TASK_DEFAULT_TIMEOUT || '300000', 10),
    cleanupInterval: parseInt(process.env.TASK_CLEANUP_INTERVAL || '3600000', 10),
    retentionDays: parseInt(process.env.TASK_RETENTION_DAYS || '30', 10),
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-min-32-chars',
    jwtExpiry: process.env.JWT_EXPIRY || '15m',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    hipaaAuditEnabled: process.env.HIPAA_AUDIT_ENABLED === 'true',
    encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // OpenTelemetry
  telemetry: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME || 'nexusdoc',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:16686',
  },

  // Prometheus
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    port: parseInt(process.env.PROMETHEUS_PORT || '9116', 10),
  },

  // Medical Knowledge
  medicalKnowledge: {
    ontologyUpdateInterval: parseInt(process.env.MEDICAL_ONTOLOGY_UPDATE_INTERVAL || '86400000', 10),
    literatureCacheTTL: parseInt(process.env.MEDICAL_LITERATURE_CACHE_TTL || '3600000', 10),
    drugInteractionCacheTTL: parseInt(process.env.DRUG_INTERACTION_CACHE_TTL || '86400000', 10),
  },

  // Feature Flags
  features: {
    clinicalConsultation: process.env.FEATURE_CLINICAL_CONSULTATION !== 'false',
    medicalImaging: process.env.FEATURE_MEDICAL_IMAGING !== 'false',
    drugDiscovery: process.env.FEATURE_DRUG_DISCOVERY !== 'false',
    telemedicine: process.env.FEATURE_TELEMEDICINE !== 'false',
    googleDriveStorage: process.env.FEATURE_GOOGLE_DRIVE_STORAGE !== 'false',
    realTimeStreaming: process.env.FEATURE_REAL_TIME_STREAMING !== 'false',
  },
};

// Validation
function validateConfig(): void {
  const errors: string[] = [];

  if (!config.security.jwtSecret || config.security.jwtSecret === 'change-me-in-production-min-32-chars') {
    if (config.nodeEnv === 'production') {
      errors.push('JWT_SECRET must be set in production');
    }
  }

  if (config.features.googleDriveStorage && !config.googleDrive.serviceAccountKey) {
    errors.push('GOOGLE_SERVICE_ACCOUNT_KEY required when Google Drive storage is enabled');
  }

  if (!config.medicalApis.openrouter.apiKey) {
    errors.push('OPENROUTER_API_KEY is required for LLM access');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Validate configuration on load
validateConfig();

export default config;
