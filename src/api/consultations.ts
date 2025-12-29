/**
 * Clinical Consultations API
 * REST endpoints for medical case analysis using multi-agent orchestration
 */

import { Router, Request, Response } from 'express';
import {
  consultationOrchestrationService,
  ConsultationRequest,
} from '../services/consultation-orchestration-service';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('ConsultationsAPI');

/**
 * POST /api/doctor/consultations
 * Start a new medical consultation
 *
 * Body:
 * {
 *   "patient_id": "encrypted_patient_123",
 *   "urgency": "high",
 *   "chief_complaint": "Chest pain",
 *   "symptoms": ["chest pain", "shortness of breath", "diaphoresis"],
 *   "vitals": { "bp": "180/95", "hr": 105, "spo2": 94 },
 *   "labs": { "troponin_i": "15.2", "bnp": "1200" },
 *   "medical_history": {
 *     "conditions": ["hypertension", "diabetes"],
 *     "medications": ["metformin", "lisinopril"],
 *     "allergies": ["penicillin"]
 *   }
 * }
 *
 * Response:
 * {
 *   "consultation_id": "uuid",
 *   "task_id": "mageagent_task_uuid",
 *   "status": "pending",
 *   "poll_url": "/api/doctor/consultations/{id}",
 *   "estimated_duration": 120,
 *   "agents_selected": 7,
 *   "complexity_score": 0.78
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateConsultationRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid consultation request',
        details: validation.errors,
      });
    }

    const consultationRequest: ConsultationRequest = req.body;

    logger.info('Received consultation request', {
      patientId: consultationRequest.patient_id,
      urgency: consultationRequest.urgency,
      symptomCount: consultationRequest.symptoms.length,
    });

    // Start consultation orchestration
    const response = await consultationOrchestrationService.startConsultation(
      consultationRequest
    );

    logger.info('Consultation started successfully', {
      consultationId: response.consultation_id,
      taskId: response.task_id,
      agentsSelected: response.agents_selected,
    });

    // Return 202 Accepted with task details
    res.status(202).json(response);
  } catch (error: any) {
    logger.error('Failed to start consultation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/doctor/consultations/:consultationId
 * Get consultation status or final results
 *
 * Response (in progress):
 * {
 *   "consultation_id": "uuid",
 *   "task_id": "mageagent_task_uuid",
 *   "status": "running",
 *   "poll_url": "/api/doctor/consultations/{id}",
 *   "estimated_duration": 120,
 *   "agents_selected": 7,
 *   "complexity_score": 0.78
 * }
 *
 * Response (completed):
 * {
 *   "consultation_id": "uuid",
 *   "status": "completed",
 *   "agents_spawned": 7,
 *   "consensus": {
 *     "primaryDiagnosis": {
 *       "condition": "Acute Myocardial Infarction",
 *       "icd10Code": "I21.9",
 *       "confidence": 0.92,
 *       "agreementScore": 0.86,
 *       "supportingAgents": ["cardiology", "emergency_medicine", "primary_care"],
 *       "evidenceStrength": "very_strong"
 *     },
 *     "differentialDiagnoses": [...],
 *     "recommendations": [...],
 *     "overallConfidence": 0.89,
 *     "consensusQuality": "excellent"
 *   },
 *   "individual_analyses": [...],
 *   "processing_time": 45000
 * }
 */
router.get('/:consultationId', async (req: Request, res: Response) => {
  try {
    const { consultationId } = req.params;

    logger.debug('Fetching consultation status', { consultationId });

    const result = await consultationOrchestrationService.getConsultationStatus(
      consultationId
    );

    // If completed, return 200 with full results
    if ('consensus' in result) {
      logger.info('Consultation completed', {
        consultationId,
        status: result.status,
        processingTime: `${result.processing_time}ms`,
      });
      return res.status(200).json(result);
    }

    // Still running, return 200 with progress (clients should continue polling)
    logger.debug('Consultation in progress', {
      consultationId,
      status: result.status,
    });
    res.status(200).json(result);
  } catch (error: any) {
    // Check if consultation not found
    if (error.message.includes('not found')) {
      logger.warn('Consultation not found', {
        consultationId: req.params.consultationId,
      });
      return res.status(404).json({
        error: 'Consultation not found',
        message: error.message,
      });
    }

    logger.error('Failed to get consultation status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/doctor/consultations/:consultationId/poll
 * Poll consultation until completion (blocking with timeout)
 *
 * Body (optional):
 * {
 *   "max_attempts": 120,
 *   "poll_interval": 5000
 * }
 *
 * Response:
 * Same as GET /:consultationId but only returns when completed
 */
router.post('/:consultationId/poll', async (req: Request, res: Response) => {
  try {
    const { consultationId } = req.params;
    const { max_attempts, poll_interval } = req.body;

    logger.info('Starting polling for consultation', {
      consultationId,
      maxAttempts: max_attempts || 120,
      pollInterval: poll_interval || 5000,
    });

    // Set longer timeout for this endpoint
    req.setTimeout(600000); // 10 minutes

    const result = await consultationOrchestrationService.pollConsultationUntilComplete(
      consultationId,
      {
        maxAttempts: max_attempts,
        pollInterval: poll_interval,
        onProgress: (status) => {
          logger.debug('Polling progress', { consultationId, status: status.status });
        },
      }
    );

    logger.info('Consultation polling complete', {
      consultationId,
      status: result.status,
      processingTime: `${result.processing_time}ms`,
    });

    res.status(200).json(result);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Consultation not found',
        message: error.message,
      });
    }

    if (error.message.includes('timeout')) {
      logger.warn('Consultation polling timeout', {
        consultationId: req.params.consultationId,
      });
      return res.status(408).json({
        error: 'Request timeout',
        message: error.message,
      });
    }

    logger.error('Failed to poll consultation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Validate consultation request
 */
function validateConsultationRequest(body: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!body.patient_id) {
    errors.push('patient_id is required');
  }

  if (!body.urgency) {
    errors.push('urgency is required');
  } else if (!['routine', 'urgent', 'emergent'].includes(body.urgency)) {
    errors.push('urgency must be one of: routine, urgent, emergent');
  }

  if (!body.symptoms || !Array.isArray(body.symptoms) || body.symptoms.length === 0) {
    errors.push('symptoms array is required and must not be empty');
  }

  // Type validations
  if (body.vitals && typeof body.vitals !== 'object') {
    errors.push('vitals must be an object');
  }

  if (body.labs && typeof body.labs !== 'object') {
    errors.push('labs must be an object');
  }

  if (body.imaging && typeof body.imaging !== 'object') {
    errors.push('imaging must be an object');
  }

  if (body.medical_history) {
    if (typeof body.medical_history !== 'object') {
      errors.push('medical_history must be an object');
    } else {
      if (body.medical_history.conditions && !Array.isArray(body.medical_history.conditions)) {
        errors.push('medical_history.conditions must be an array');
      }
      if (body.medical_history.medications && !Array.isArray(body.medical_history.medications)) {
        errors.push('medical_history.medications must be an array');
      }
      if (body.medical_history.allergies && !Array.isArray(body.medical_history.allergies)) {
        errors.push('medical_history.allergies must be an array');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export default router;
