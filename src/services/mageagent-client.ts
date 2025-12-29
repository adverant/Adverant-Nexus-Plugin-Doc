/**
 * MageAgent Client
 * Client for MageAgent orchestration service
 * Leverages existing multi-agent orchestration instead of duplicating it
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('MageAgentClient');

/**
 * MageAgent orchestration request
 */
export interface OrchestrationRequest {
  task: string;
  maxAgents?: number;
  timeout?: number;
  context?: any;
  streamProgress?: boolean;
}

/**
 * MageAgent orchestration response (async pattern)
 */
export interface OrchestrationResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  pollUrl: string;
  estimatedDuration?: number;
  websocket?: {
    namespace: string;
    events: string[];
  };
}

/**
 * Task status response
 */
export interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  currentStep?: string;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * MageAgent Client
 */
export class MageAgentClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.services.mageagent;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30s for initial request
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('MageAgent client initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Orchestrate a multi-agent task
   */
  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    try {
      logger.info('Sending orchestration request to MageAgent', {
        taskLength: request.task.length,
        maxAgents: request.maxAgents,
        timeout: request.timeout,
        streamProgress: request.streamProgress,
      });

      const response = await this.client.post('/mageagent/api/orchestrate', {
        task: request.task,
        maxAgents: request.maxAgents || 5,
        timeout: request.timeout || 300000,
        context: request.context,
        streamProgress: request.streamProgress || false,
      });

      logger.info('Orchestration task submitted', {
        taskId: response.data.taskId,
        status: response.data.status,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to submit orchestration request:', error);
      throw new Error(`MageAgent orchestration failed: ${error.message}`);
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    try {
      const response = await this.client.get(`/mageagent/api/tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to get task status for ${taskId}:`, error);
      throw new Error(`Failed to get task status: ${error.message}`);
    }
  }

  /**
   * Poll task until completion
   */
  async pollTaskUntilComplete(
    taskId: string,
    options?: {
      maxAttempts?: number;
      pollInterval?: number;
      onProgress?: (status: TaskStatusResponse) => void;
    }
  ): Promise<TaskStatusResponse> {
    const maxAttempts = options?.maxAttempts || 120; // 120 * 5s = 10 minutes max
    const pollInterval = options?.pollInterval || 5000; // 5 seconds

    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getTaskStatus(taskId);

        // Call progress callback if provided
        if (options?.onProgress) {
          options.onProgress(status);
        }

        // Check if task is complete
        if (status.status === 'completed') {
          logger.info(`Task ${taskId} completed successfully`);
          return status;
        }

        if (status.status === 'failed') {
          logger.error(`Task ${taskId} failed:`, status.error);
          throw new Error(`Task failed: ${status.error}`);
        }

        // Task still running, wait and poll again
        await this.sleep(pollInterval);
        attempts++;
      } catch (error: any) {
        logger.error(`Error polling task ${taskId}:`, error);
        throw error;
      }
    }

    throw new Error(`Task ${taskId} polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.error('MageAgent health check failed:', error);
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Export singleton instance
export const mageAgentClient = new MageAgentClient();
