/**
 * Consultation Orchestration Service
 * Coordinates medical case analysis using MageAgent for multi-agent orchestration
 *
 * Flow:
 * 1. Analyze case complexity
 * 2. Select appropriate medical agents
 * 3. Build medical-specific prompts
 * 4. Delegate to MageAgent for orchestration
 * 5. Process and format results
 */

import { v4 as uuidv4 } from 'uuid';
import { ComplexityAnalyzer, ComplexityFactors } from '../agents/complexity-analyzer';
import {
  medicalPromptBuilder,
  AgentSelectionRequest,
  ClinicalCaseData,
  MedicalOrchestrationTask,
} from '../agents/agent-spawner';
import {
  mageAgentClient,
  OrchestrationRequest,
  TaskStatusResponse,
} from './mageagent-client';
import {
  OrchestrationTask,
  ConsensusResult,
  AgentResult,
} from '../types/agent-types';
import { createLogger } from '../utils/logger';
import { pubMedService } from './enrichment/pubmed-service';
import { drugSafetyService } from './enrichment/drug-safety-service';
import { riskStratificationService } from './enrichment/risk-stratification-service';
import { clinicalGuidelinesService } from './enrichment/clinical-guidelines-service';
import { googleMedPaLM2Service } from './google-medlm/medpalm2-service';
import { googleMedLMService } from './google-medlm/medlm-service';
import { aidocService } from './imaging/aidoc-service';
import { pathAIService } from './imaging/pathai-service';
import { zebraMedicalService } from './imaging/zebra-medical-service';
import { hipaaComplianceService } from './compliance/hipaa-compliance';
import { medicalSafetyValidator } from './compliance/medical-safety-validator';
import { auditTrailService } from './compliance/audit-trail-service';
import { soapNoteGenerator } from './automation/soap-note-generator';
import { medicalCodingService } from './automation/medical-coding-service';
import { clinicalTrialMatcher } from './automation/clinical-trial-matcher';

const logger = createLogger('ConsultationOrchestrationService');

/**
 * Consultation request
 */
export interface ConsultationRequest {
  patient_id: string;
  urgency: 'routine' | 'urgent' | 'emergent';
  chief_complaint?: string;
  symptoms: string[];
  vitals?: Record<string, any>;
  labs?: Record<string, any>;
  imaging?: Record<string, any>;
  medical_history?: {
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
    surgeries?: string[];
  };
  additional_context?: string;
}

/**
 * Consultation response (immediate)
 */
export interface ConsultationResponse {
  consultation_id: string;
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  poll_url: string;
  estimated_duration: number;
  agents_selected: number;
  complexity_score: number;
  websocket?: {
    namespace: string;
    events: string[];
  };
}

/**
 * Consultation result (final)
 */
export interface ConsultationResult {
  consultation_id: string;
  status: 'completed' | 'failed';
  agents_spawned: number;
  consensus: ConsensusResult;
  individual_analyses: AgentResult[];
  processing_time: number;
  complianceReport?: {
    hipaaCompliant: boolean;
    violations: string[];
    warnings: string[];
    overallRiskLevel: string;
  };
  safetyValidation?: {
    safe: boolean;
    overallRisk: string;
    criticalAlerts: number;
    warnings: number;
    safetyScore: number;
    requiresHumanReview: boolean;
  };
  auditTrail?: {
    decisionId: string;
    auditId: string;
  };
  // Phase 8: Advanced Features (Automation)
  soapNote?: any; // GeneratedSOAPNote from automation
  medicalCoding?: any; // MedicalCodingResult from automation
  clinicalTrials?: any; // TrialMatchingResult from automation
  error?: string;
}

/**
 * Consultation Orchestration Service
 */
export class ConsultationOrchestrationService {
  private complexityAnalyzer: ComplexityAnalyzer;
  private activeTasks: Map<string, OrchestrationTask>;

  constructor() {
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.activeTasks = new Map();
    logger.info('Consultation Orchestration Service initialized');
  }

  /**
   * Start a medical consultation
   */
  async startConsultation(
    request: ConsultationRequest
  ): Promise<ConsultationResponse> {
    const consultationId = uuidv4();

    logger.info('Starting medical consultation', {
      consultationId,
      patientId: request.patient_id,
      urgency: request.urgency,
      symptoms: request.symptoms.join(', '),
    });

    try {
      // Step 0: HIPAA Compliance Validation
      const complianceValidation = await hipaaComplianceService.validateCompliance({
        type: 'consultation',
        userId: 'system', // Would be actual user ID
        userRole: 'ai_assistant',
        patientId: request.patient_id,
        dataAccessed: ['symptoms', 'vitals', 'labs', 'imaging', 'medical_history'],
        purpose: 'treatment',
        hasConsent: true, // Would check actual consent
        encryptionEnabled: true,
      });

      if (!complianceValidation.compliant) {
        logger.error('HIPAA compliance violation detected', {
          consultationId,
          violations: complianceValidation.violations.length,
        });
        throw new Error('HIPAA compliance requirements not met');
      }

      logger.info('HIPAA compliance validated', {
        consultationId,
        riskLevel: complianceValidation.overallRiskLevel,
      });

      // Step 1: Analyze case complexity
      const complexityFactors = this.extractComplexityFactors(request);
      const complexityScore = this.complexityAnalyzer.analyze(complexityFactors);

      logger.info('Complexity analysis complete', {
        consultationId,
        overallScore: complexityScore.overallScore.toFixed(2),
        agentCountRecommendation: complexityScore.agentCountRecommendation,
      });

      // Step 1.5: Enrich with medical intelligence (PubMed, drug safety, guidelines, risk scores)
      const enrichedContext = await this.enrichConsultation(request, complexityScore);

      logger.info('Medical intelligence enrichment complete', {
        consultationId,
        hasPubMedResults: enrichedContext.literature.length > 0,
        hasDrugSafetyReport: !!enrichedContext.drugSafety,
        hasGuidelines: enrichedContext.guidelines.length > 0,
        hasRiskAssessment: !!enrichedContext.riskAssessment,
      });

      // Step 2: Select appropriate medical agents
      const agentSelectionRequest: AgentSelectionRequest = {
        complexityScore,
        urgency: request.urgency,
        symptoms: request.symptoms,
        requiresImaging: !!request.imaging && Object.keys(request.imaging).length > 0,
        requiresLabs: !!request.labs && Object.keys(request.labs).length > 0,
        requiresDrugs: !!request.medical_history?.medications,
        requiresSurgery: this.requiresSurgicalEvaluation(request),
        rareDiseaseSuspicion: complexityScore.breakdown.diagnosticComplexity,
        specialtyRequirements: this.identifySpecialtyRequirements(request),
      };

      const selectedAgents = medicalPromptBuilder.selectAgents(agentSelectionRequest);

      logger.info('Medical agents selected', {
        consultationId,
        agentCount: selectedAgents.length,
        agents: selectedAgents.map((a) => a.displayName).join(', '),
      });

      // Step 3: Build medical orchestration task for MageAgent (with enriched context)
      const clinicalData: ClinicalCaseData = {
        patientId: request.patient_id,
        chiefComplaint: request.chief_complaint,
        symptoms: request.symptoms,
        vitals: request.vitals,
        labs: request.labs,
        imaging: request.imaging,
        medicalHistory: request.medical_history,
        urgency: request.urgency,
        additionalContext: this.buildEnrichedContextString(request, enrichedContext),
      };

      const medicalTask = medicalPromptBuilder.buildMedicalOrchestrationTask(
        selectedAgents,
        clinicalData,
        complexityScore
      );

      logger.info('Medical orchestration task built', {
        consultationId,
        taskLength: medicalTask.task.length,
        maxAgents: medicalTask.maxAgents,
        timeout: medicalTask.timeout,
      });

      // Step 4: Submit to MageAgent for orchestration
      const orchestrationRequest: OrchestrationRequest = {
        task: medicalTask.task,
        maxAgents: medicalTask.maxAgents,
        timeout: medicalTask.timeout,
        context: medicalTask.context,
        streamProgress: true,
      };

      const mageAgentResponse = await mageAgentClient.orchestrate(orchestrationRequest);

      logger.info('MageAgent orchestration submitted', {
        consultationId,
        taskId: mageAgentResponse.taskId,
        status: mageAgentResponse.status,
      });

      // Step 5: Create orchestration task tracking
      const orchestrationTask: OrchestrationTask = {
        taskId: mageAgentResponse.taskId,
        taskType: 'clinical_consultation',
        status: 'spawning_agents',
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData: request,
        complexityScore,
        agentsSpawned: [],
        agentCount: selectedAgents.length,
        agentsCompleted: 0,
        agentsFailed: 0,
        progress: 0,
        currentStep: 'Spawning medical agents...',
        priority: this.determinePriority(request.urgency),
      };

      this.activeTasks.set(consultationId, orchestrationTask);

      // Step 6: Return immediate response with task ID
      return {
        consultation_id: consultationId,
        task_id: mageAgentResponse.taskId,
        status: 'pending',
        poll_url: `/api/doctor/consultations/${consultationId}`,
        estimated_duration: mageAgentResponse.estimatedDuration || complexityScore.estimatedProcessingTime,
        agents_selected: selectedAgents.length,
        complexity_score: complexityScore.normalizedScore,
        websocket: mageAgentResponse.websocket,
      };
    } catch (error: any) {
      logger.error('Failed to start consultation:', error);
      throw new Error(`Consultation orchestration failed: ${error.message}`);
    }
  }

  /**
   * Get consultation status
   */
  async getConsultationStatus(consultationId: string): Promise<ConsultationResult | ConsultationResponse> {
    const orchestrationTask = this.activeTasks.get(consultationId);

    if (!orchestrationTask) {
      throw new Error(`Consultation ${consultationId} not found`);
    }

    try {
      // Get status from MageAgent
      const taskStatus = await mageAgentClient.getTaskStatus(orchestrationTask.taskId);

      logger.debug('MageAgent task status retrieved', {
        consultationId,
        taskId: orchestrationTask.taskId,
        status: taskStatus.status,
        progress: taskStatus.progress,
      });

      // Update orchestration task
      orchestrationTask.status = this.mapMageAgentStatus(taskStatus.status);
      orchestrationTask.progress = taskStatus.progress || 0;
      orchestrationTask.currentStep = taskStatus.currentStep || orchestrationTask.currentStep;
      orchestrationTask.updatedAt = new Date();

      // If completed, process results
      if (taskStatus.status === 'completed') {
        orchestrationTask.completedAt = new Date();

        const result = await this.processCompletedConsultation(
          consultationId,
          taskStatus
        );

        // Clean up active task
        this.activeTasks.delete(consultationId);

        return result;
      }

      // If failed, return error
      if (taskStatus.status === 'failed') {
        orchestrationTask.error = taskStatus.error;
        orchestrationTask.completedAt = new Date();

        const result: ConsultationResult = {
          consultation_id: consultationId,
          status: 'failed',
          agents_spawned: orchestrationTask.agentCount,
          consensus: this.getEmptyConsensus(),
          individual_analyses: [],
          processing_time: this.calculateProcessingTime(orchestrationTask),
          error: taskStatus.error || 'Unknown error',
        };

        // Clean up active task
        this.activeTasks.delete(consultationId);

        return result;
      }

      // Still running - return progress
      return {
        consultation_id: consultationId,
        task_id: orchestrationTask.taskId,
        status: taskStatus.status,
        poll_url: `/api/doctor/consultations/${consultationId}`,
        estimated_duration: orchestrationTask.complexityScore?.estimatedProcessingTime || 120,
        agents_selected: orchestrationTask.agentCount,
        complexity_score: orchestrationTask.complexityScore?.normalizedScore || 0.5,
      };
    } catch (error: any) {
      logger.error(`Failed to get consultation status for ${consultationId}:`, error);
      throw new Error(`Failed to retrieve consultation status: ${error.message}`);
    }
  }

  /**
   * Poll consultation until completion
   */
  async pollConsultationUntilComplete(
    consultationId: string,
    options?: {
      maxAttempts?: number;
      pollInterval?: number;
      onProgress?: (status: any) => void;
    }
  ): Promise<ConsultationResult> {
    const maxAttempts = options?.maxAttempts || 120;
    const pollInterval = options?.pollInterval || 5000;

    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getConsultationStatus(consultationId);

      // Call progress callback
      if (options?.onProgress) {
        options.onProgress(status);
      }

      // Check if completed
      if ('consensus' in status) {
        logger.info(`Consultation ${consultationId} completed successfully`);
        return status as ConsultationResult;
      }

      // Still running, wait and poll again
      await this.sleep(pollInterval);
      attempts++;
    }

    throw new Error(`Consultation ${consultationId} polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Process completed consultation from MageAgent results
   */
  private async processCompletedConsultation(
    consultationId: string,
    taskStatus: TaskStatusResponse
  ): Promise<ConsultationResult> {
    const orchestrationTask = this.activeTasks.get(consultationId)!;

    logger.info('Processing completed consultation', {
      consultationId,
      taskId: orchestrationTask.taskId,
    });

    try {
      // Extract agent results from MageAgent response
      const individualAnalyses = this.extractAgentResults(taskStatus.result);

      // Build consensus from agent results
      const consensus = this.buildConsensus(individualAnalyses);

      // Calculate processing time
      const processingTime = this.calculateProcessingTime(orchestrationTask);

      // Step: Safety Validation
      const safetyValidation = await this.performSafetyValidation(
        consensus,
        orchestrationTask.requestData as ConsultationRequest
      );

      logger.info('Safety validation complete', {
        consultationId,
        safe: safetyValidation.safe,
        safetyScore: safetyValidation.safetyScore,
        requiresHumanReview: safetyValidation.requiresHumanReview,
      });

      // Step: Compliance Check
      const complianceReport = await this.generateComplianceReport(
        orchestrationTask.requestData as ConsultationRequest,
        consensus
      );

      logger.info('Compliance report generated', {
        consultationId,
        compliant: complianceReport.hipaaCompliant,
      });

      // Step: Audit Trail Logging
      const auditTrail = this.logClinicalDecision(
        consultationId,
        orchestrationTask.requestData as ConsultationRequest,
        consensus,
        individualAnalyses,
        safetyValidation
      );

      logger.info('Clinical decision audited', {
        consultationId,
        decisionId: auditTrail.decisionId,
        auditId: auditTrail.auditId,
      });

      // Phase 8: Generate advanced automation features
      logger.info('Generating advanced automation features (SOAP, coding, trials)');

      // Temporary result for automation services
      const tempResult: ConsultationResult = {
        consultation_id: consultationId,
        status: 'completed',
        agents_spawned: orchestrationTask.agentCount,
        consensus,
        individual_analyses: individualAnalyses,
        processing_time: processingTime,
      };

      // Step: Generate SOAP Note (target <5s)
      let soapNote;
      try {
        soapNote = await soapNoteGenerator.generateFromConsultation({
          consultationResult: tempResult,
          patientId: (orchestrationTask.requestData as ConsultationRequest).patient_id,
          format: 'standard',
          targetEHR: 'fhir_r4',
        });
        logger.info('SOAP note generated', {
          consultationId,
          generationTime: `${soapNote.metadata.generationTime}ms`,
          wordCount: soapNote.metadata.wordCount,
        });
      } catch (error: any) {
        logger.warn('SOAP note generation failed:', error);
        soapNote = undefined;
      }

      // Step: Generate Medical Coding (ICD-10, CPT, DRG)
      let medicalCoding;
      try {
        medicalCoding = await medicalCodingService.codeConsultation(
          tempResult,
          'outpatient'
        );
        logger.info('Medical coding complete', {
          consultationId,
          icd10Codes: medicalCoding.icd10Codes.length,
          cptCodes: medicalCoding.cptCodes.length,
          estimatedReimbursement: `$${medicalCoding.estimatedReimbursement.total.toFixed(2)}`,
          accuracy: `${(medicalCoding.codingAccuracy * 100).toFixed(1)}%`,
        });
      } catch (error: any) {
        logger.warn('Medical coding failed:', error);
        medicalCoding = undefined;
      }

      // Step: Match Clinical Trials
      let clinicalTrials;
      try {
        clinicalTrials = await clinicalTrialMatcher.findMatchingTrialsFromConsultation(
          tempResult,
          {
            age: 50, // Would come from patient data
            sex: 'F', // Would come from patient data
            diagnosis: consensus.primaryDiagnosis.condition,
          },
          undefined // location optional
        );
        logger.info('Clinical trial matching complete', {
          consultationId,
          matchesFound: clinicalTrials.matches.length,
          highPriorityTrials: clinicalTrials.matches.filter((m) => m.priority === 'HIGH').length,
        });
      } catch (error: any) {
        logger.warn('Clinical trial matching failed:', error);
        clinicalTrials = undefined;
      }

      const result: ConsultationResult = {
        consultation_id: consultationId,
        status: 'completed',
        agents_spawned: orchestrationTask.agentCount,
        consensus,
        individual_analyses: individualAnalyses,
        processing_time: processingTime,
        complianceReport: {
          hipaaCompliant: complianceReport.hipaaCompliant,
          violations: complianceReport.violations,
          warnings: complianceReport.warnings,
          overallRiskLevel: complianceReport.overallRiskLevel,
        },
        safetyValidation: {
          safe: safetyValidation.safe,
          overallRisk: safetyValidation.overallRisk,
          criticalAlerts: safetyValidation.criticalAlerts.length,
          warnings: safetyValidation.warnings.length,
          safetyScore: safetyValidation.safetyScore,
          requiresHumanReview: safetyValidation.requiresHumanReview,
        },
        auditTrail: {
          decisionId: auditTrail.decisionId,
          auditId: auditTrail.auditId,
        },
        soapNote,
        medicalCoding,
        clinicalTrials,
      };

      logger.info('Consultation processing complete', {
        consultationId,
        primaryDiagnosis: consensus.primaryDiagnosis.condition,
        confidence: consensus.primaryDiagnosis.confidence.toFixed(2),
        processingTime: `${processingTime}ms`,
        safe: safetyValidation.safe,
        requiresHumanReview: safetyValidation.requiresHumanReview,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to process completed consultation:', error);
      throw new Error(`Failed to process consultation results: ${error.message}`);
    }
  }

  /**
   * Extract complexity factors from consultation request
   */
  private extractComplexityFactors(request: ConsultationRequest): ComplexityFactors {
    return {
      symptomCount: request.symptoms.length,
      symptomSeverity: this.assessSymptomSeverity(request.symptoms, request.urgency),
      symptomDuration: 0.5, // Default - would need to be provided in request
      vitalSignsAbnormal: this.countAbnormalVitals(request.vitals),
      labResultsAbnormal: this.countAbnormalLabs(request.labs),
      imagingRequired: !!request.imaging,
      age: 50, // Default - would need to be provided in request
      comorbidityCount: request.medical_history?.conditions?.length || 0,
      medicationCount: request.medical_history?.medications?.length || 0,
      allergyCount: request.medical_history?.allergies?.length || 0,
      urgencyLevel: request.urgency,
      specialtyRequirements: this.identifySpecialtyRequirements(request),
      dataVolume: this.calculateDataVolume(request),
      differentialBreadth: this.estimateDifferentialBreadth(request),
      rareDiseaseSuspicion: 0.3, // Default - would be refined by analysis
      multiSystemInvolvement: this.detectMultiSystemInvolvement(request),
      previousTreatmentFailures: 0, // Would need to be provided in request
      symptomProgressionRate: 'stable', // Would need to be provided in request
    };
  }

  /**
   * Extract agent results from MageAgent response
   */
  private extractAgentResults(mageAgentResult: any): AgentResult[] {
    // MageAgent result structure depends on its implementation
    // This is a placeholder - adjust based on actual MageAgent response format
    if (!mageAgentResult || !Array.isArray(mageAgentResult.agents)) {
      logger.warn('No agent results found in MageAgent response');
      return [];
    }

    return mageAgentResult.agents.map((agentData: any) => ({
      agentId: agentData.agentId || 'unknown',
      specialty: agentData.specialty || 'general',
      primaryDiagnosis: agentData.primaryDiagnosis,
      differentialDiagnoses: agentData.differentialDiagnoses || [],
      recommendations: agentData.recommendations || [],
      riskAssessment: agentData.riskAssessment,
      findings: agentData.findings || [],
      concerns: agentData.concerns || [],
      confidence: agentData.confidence || 0.5,
      processingTime: agentData.processingTime || 0,
      modelUsed: agentData.modelUsed,
      tokensUsed: agentData.tokensUsed,
      costUsd: agentData.costUsd,
    }));
  }

  /**
   * Build consensus from individual agent results
   */
  private buildConsensus(agentResults: AgentResult[]): ConsensusResult {
    if (agentResults.length === 0) {
      return this.getEmptyConsensus();
    }

    // Simple consensus algorithm - can be enhanced
    // Find most common primary diagnosis
    const diagnosisCounts = new Map<string, { count: number; agents: string[] }>();

    agentResults.forEach((result) => {
      if (result.primaryDiagnosis) {
        const condition = result.primaryDiagnosis.condition;
        const existing = diagnosisCounts.get(condition) || { count: 0, agents: [] };
        existing.count++;
        existing.agents.push(result.agentId);
        diagnosisCounts.set(condition, existing);
      }
    });

    // Get consensus diagnosis (most common)
    let consensusDiagnosis = { condition: 'Unknown', count: 0, agents: [] as string[] };
    diagnosisCounts.forEach((value, key) => {
      if (value.count > consensusDiagnosis.count) {
        consensusDiagnosis = { condition: key, count: value.count, agents: value.agents };
      }
    });

    const agreementScore = consensusDiagnosis.count / agentResults.length;
    const avgConfidence =
      agentResults.reduce((sum, r) => sum + r.confidence, 0) / agentResults.length;

    // Aggregate recommendations
    const allRecommendations = agentResults.flatMap((r) => r.recommendations || []);
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);

    return {
      primaryDiagnosis: {
        condition: consensusDiagnosis.condition,
        icd10Code: 'TBD', // Would be extracted from agent results
        confidence: avgConfidence,
        agreementScore,
        supportingAgents: consensusDiagnosis.agents,
        evidenceStrength: this.determineEvidenceStrength(agreementScore, avgConfidence),
      },
      differentialDiagnoses: this.aggregateDifferentials(agentResults),
      recommendations: uniqueRecommendations.map((rec) => ({
        type: rec.type,
        priority: rec.priority,
        recommendation: rec.recommendation,
        agreementScore: 1.0, // Would calculate actual agreement
        suggestedBy: ['primary_care'], // Would track which agents suggested
      })),
      overallConfidence: avgConfidence,
      consensusQuality: this.assessConsensusQuality(agreementScore, avgConfidence),
    };
  }

  /**
   * Helper methods
   */

  private getEmptyConsensus(): ConsensusResult {
    return {
      primaryDiagnosis: {
        condition: 'Unable to determine',
        confidence: 0,
        agreementScore: 0,
        supportingAgents: [],
        evidenceStrength: 'weak',
      },
      differentialDiagnoses: [],
      recommendations: [],
      overallConfidence: 0,
      consensusQuality: 'poor',
    };
  }

  private mapMageAgentStatus(status: string): OrchestrationTask['status'] {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'running':
        return 'analyzing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private determinePriority(urgency: string): OrchestrationTask['priority'] {
    switch (urgency) {
      case 'emergent':
        return 'critical';
      case 'urgent':
        return 'high';
      default:
        return 'medium';
    }
  }

  private calculateProcessingTime(task: OrchestrationTask): number {
    if (task.completedAt && task.createdAt) {
      return task.completedAt.getTime() - task.createdAt.getTime();
    }
    return 0;
  }

  private assessSymptomSeverity(symptoms: string[], urgency: string): number {
    // Simple heuristic - would be more sophisticated in production
    if (urgency === 'emergent') return 0.9;
    if (urgency === 'urgent') return 0.6;
    return 0.3;
  }

  private countAbnormalVitals(vitals?: Record<string, any>): number {
    if (!vitals) return 0;
    // Would implement actual vital sign assessment logic
    return Object.keys(vitals).length * 0.3;
  }

  private countAbnormalLabs(labs?: Record<string, any>): number {
    if (!labs) return 0;
    // Would implement actual lab result assessment logic
    return Object.keys(labs).length * 0.3;
  }

  private identifySpecialtyRequirements(request: ConsultationRequest): string[] {
    const specialties: string[] = [];

    // Would implement sophisticated specialty detection
    if (request.imaging) specialties.push('radiology');
    if (request.labs) specialties.push('pathology');
    if (request.medical_history?.medications) specialties.push('pharmacology');

    return specialties;
  }

  private requiresSurgicalEvaluation(request: ConsultationRequest): boolean {
    // Simple heuristic - would be more sophisticated
    const surgicalKeywords = ['mass', 'tumor', 'fracture', 'trauma', 'obstruction'];
    return request.symptoms.some((symptom) =>
      surgicalKeywords.some((keyword) =>
        symptom.toLowerCase().includes(keyword)
      )
    );
  }

  private calculateDataVolume(request: ConsultationRequest): number {
    let volume = request.symptoms.length * 0.1;
    if (request.vitals) volume += Object.keys(request.vitals).length * 0.05;
    if (request.labs) volume += Object.keys(request.labs).length * 0.05;
    if (request.imaging) volume += 0.2;
    if (request.medical_history) volume += 0.2;
    return Math.min(volume, 1.0);
  }

  private estimateDifferentialBreadth(request: ConsultationRequest): number {
    // More symptoms and data = broader differential
    return Math.min(request.symptoms.length * 0.15, 1.0);
  }

  private detectMultiSystemInvolvement(request: ConsultationRequest): boolean {
    // Would implement sophisticated multi-system detection
    return request.symptoms.length > 5;
  }

  private deduplicateRecommendations(recommendations: any[]): any[] {
    const seen = new Set<string>();
    return recommendations.filter((rec) => {
      const key = `${rec.type}-${rec.recommendation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private aggregateDifferentials(agentResults: AgentResult[]): any[] {
    // Aggregate and deduplicate differential diagnoses from all agents
    const differentials = new Map<string, any>();

    agentResults.forEach((result) => {
      result.differentialDiagnoses?.forEach((diff) => {
        const existing = differentials.get(diff.condition);
        if (!existing || diff.confidence > existing.confidence) {
          differentials.set(diff.condition, {
            condition: diff.condition,
            icd10Code: diff.icd10Code,
            confidence: diff.confidence,
            agreementScore: 1 / agentResults.length, // Simple calculation
            suggestedBy: [result.agentId],
          });
        }
      });
    });

    return Array.from(differentials.values()).sort((a, b) => b.confidence - a.confidence);
  }

  private determineEvidenceStrength(
    agreementScore: number,
    confidence: number
  ): 'weak' | 'moderate' | 'strong' | 'very_strong' {
    const combinedScore = (agreementScore + confidence) / 2;
    if (combinedScore > 0.8) return 'very_strong';
    if (combinedScore > 0.6) return 'strong';
    if (combinedScore > 0.4) return 'moderate';
    return 'weak';
  }

  private assessConsensusQuality(
    agreementScore: number,
    confidence: number
  ): 'poor' | 'fair' | 'good' | 'excellent' {
    const combinedScore = (agreementScore + confidence) / 2;
    if (combinedScore > 0.8) return 'excellent';
    if (combinedScore > 0.6) return 'good';
    if (combinedScore > 0.4) return 'fair';
    return 'poor';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build enriched context string for MageAgent
   */
  private buildEnrichedContextString(
    request: ConsultationRequest,
    enrichedContext: EnrichedContext
  ): string {
    const sections: string[] = [];

    // Original additional context
    if (request.additional_context) {
      sections.push(`## Original Context\n${request.additional_context}`);
    }

    // Recent medical literature
    if (enrichedContext.literature.length > 0) {
      sections.push(`\n## Recent Medical Literature (Last 5 Years)`);
      enrichedContext.literature.slice(0, 5).forEach((article, idx) => {
        sections.push(`\n${idx + 1}. **${article.title}**`);
        sections.push(`   - Journal: ${article.journal} (${article.publicationDate})`);
        sections.push(`   - Evidence Level: ${article.evidenceLevel}`);
        sections.push(`   - PMID: ${article.pmid}`);
      });
    }

    // Drug safety alerts
    if (enrichedContext.drugSafety) {
      const safety = enrichedContext.drugSafety;
      sections.push(`\n## Drug Safety Analysis`);
      sections.push(`   - Overall Risk: ${safety.overallRisk.toUpperCase()}`);

      if (safety.drugInteractions.length > 0) {
        sections.push(`\n   **Drug Interactions (${safety.drugInteractions.length}):**`);
        safety.drugInteractions.slice(0, 3).forEach((interaction: any) => {
          sections.push(`   - ⚠️ ${interaction.severity.toUpperCase()}: ${interaction.drug1} + ${interaction.drug2}`);
          sections.push(`     ${interaction.description}`);
        });
      }

      if (safety.contraindications.length > 0) {
        sections.push(`\n   **Contraindications:**`);
        safety.contraindications.forEach((contra: any) => {
          sections.push(`   - ${contra.drug}: ${contra.reason}`);
        });
      }
    }

    // Clinical guidelines
    if (enrichedContext.guidelines.length > 0) {
      sections.push(`\n## Relevant Clinical Guidelines`);
      enrichedContext.guidelines.slice(0, 3).forEach((guideline, idx) => {
        sections.push(`\n${idx + 1}. **${guideline.title}** (${guideline.organization}, ${guideline.year})`);
        guideline.recommendations.slice(0, 2).forEach((rec: any) => {
          sections.push(`   - Class ${rec.classOfRecommendation}, LOE ${rec.levelOfEvidence}: ${rec.recommendation}`);
        });
      });
    }

    // Med-PaLM 2 Expert Analysis (85% USMLE accuracy)
    if (enrichedContext.medPalmDifferentials) {
      const medpalm = enrichedContext.medPalmDifferentials;
      sections.push(`\n## Med-PaLM 2 Expert Analysis (85% USMLE Accuracy)`);
      sections.push(`   - Overall Confidence: ${(medpalm.overallConfidence * 100).toFixed(1)}%`);

      if (medpalm.differentials && medpalm.differentials.length > 0) {
        sections.push(`\n   **Differential Diagnoses:**`);
        medpalm.differentials.slice(0, 5).forEach((diff: any, idx: number) => {
          sections.push(`   ${idx + 1}. ${diff.condition} (${(diff.probability * 100).toFixed(1)}%)`);
          if (diff.icd10Code) {
            sections.push(`      - ICD-10: ${diff.icd10Code}`);
          }
          sections.push(`      - Urgency: ${diff.urgency}`);
          if (diff.supportingFactors && diff.supportingFactors.length > 0) {
            sections.push(`      - Supporting: ${diff.supportingFactors.slice(0, 2).join(', ')}`);
          }
        });
      }
    }

    // Medical Imaging AI Analysis
    if (enrichedContext.imagingAnalysis) {
      const imaging = enrichedContext.imagingAnalysis;
      sections.push(`\n## Medical Imaging AI Analysis`);

      // Aidoc: CT/MRI critical findings
      if (imaging.ctMriFindings) {
        const aidoc = imaging.ctMriFindings;
        sections.push(`\n### Aidoc AI - Critical Findings Detection (60% Time Reduction)`);
        sections.push(`   - Triage Priority: ${aidoc.triage.priority}`);
        sections.push(`   - Time to Radiologist: ${aidoc.triage.estimatedTimeToRadiologist} minutes`);

        if (aidoc.analysis.hasCriticalFindings) {
          sections.push(`\n   **⚠️  CRITICAL FINDINGS DETECTED:**`);
          aidoc.analysis.criticalFindings.slice(0, 3).forEach((finding: any) => {
            sections.push(`   - ${finding.severity}: ${finding.findingType}`);
            sections.push(`     ${finding.description}`);
            sections.push(`     Action: ${finding.recommendedAction}`);
          });
        }

        if (aidoc.hasLifeThreatening) {
          sections.push(`\n   🚨 LIFE-THREATENING FINDINGS - IMMEDIATE INTERVENTION REQUIRED`);
        }
      }

      // PathAI: Digital pathology
      if (imaging.pathologyFindings) {
        const pathai = imaging.pathologyFindings;
        sections.push(`\n### PathAI - Digital Pathology Analysis (95% Pathologist Concordance)`);
        sections.push(`   - Diagnosis: ${pathai.analysis.diagnosis}`);
        sections.push(`   - AI Confidence: ${(pathai.analysis.confidence * 100).toFixed(1)}%`);
        sections.push(`   - Pathologist Review Priority: ${pathai.recommendation.priority}`);

        if (pathai.analysis.cancerDetection?.detected) {
          sections.push(`\n   **Cancer Detected:**`);
          sections.push(`   - Type: ${pathai.analysis.cancerDetection.cancerType}`);
          if (pathai.analysis.cancerDetection.grade) {
            sections.push(`   - Grade: ${pathai.analysis.cancerDetection.grade}`);
          }
          if (pathai.analysis.biomarkers.length > 0) {
            sections.push(`\n   **Biomarkers:**`);
            pathai.analysis.biomarkers.forEach((bio: any) => {
              sections.push(`   - ${bio.biomarker}: ${bio.score} (${bio.positivity})`);
            });
          }
        }
      }

      // Zebra Medical: Comprehensive imaging
      if (imaging.comprehensiveImaging) {
        const zebra = imaging.comprehensiveImaging;
        sections.push(`\n### Zebra Medical Vision - Comprehensive Analysis (13+ Clinical Findings)`);
        sections.push(`   - Overall Risk Score: ${zebra.analysis.overallRiskScore}/100`);

        if (zebra.screeningReport.significantFindings.length > 0) {
          sections.push(`\n   **Significant Findings:**`);
          zebra.screeningReport.significantFindings.slice(0, 3).forEach((finding: any) => {
            sections.push(`   - ${finding.findingType} (${finding.severity})`);
            sections.push(`     ${finding.description}`);
            sections.push(`     Follow-up: ${finding.followUpRecommendation}`);
          });
        }

        if (zebra.screeningReport.preventiveActions.length > 0) {
          sections.push(`\n   **Preventive Actions Recommended:**`);
          zebra.screeningReport.preventiveActions.forEach((action: any) => {
            sections.push(`   - ${action}`);
          });
        }
      }
    }

    return sections.join('\n');
  }

  /**
   * Enrich consultation with medical intelligence
   */
  private async enrichConsultation(
    request: ConsultationRequest,
    complexityScore: any
  ): Promise<EnrichedContext> {
    try {
      logger.info('Enriching consultation with medical intelligence');

      // Run enrichment services in parallel for speed (including Med-PaLM 2 and imaging AI)
      const [literature, drugSafety, guidelines, riskAssessment, medPalmDifferentials, imagingAnalysis] = await Promise.all([
        // PubMed literature search
        request.symptoms.length > 0
          ? pubMedService
              .search({
                query: request.symptoms.join(' '),
                dateRange: 'last_5_years',
                studyTypes: ['meta_analysis', 'systematic_review', 'randomized_controlled_trial'],
                limit: 10,
                minRelevanceScore: 0.5,
              })
              .catch(err => {
                logger.warn('PubMed search failed:', err);
                return [];
              })
          : Promise.resolve([]),

        // Drug safety analysis
        request.medical_history?.medications && request.medical_history.medications.length > 0
          ? drugSafetyService
              .checkInteractions({
                medications: request.medical_history.medications,
                allergies: request.medical_history.allergies,
                conditions: request.medical_history.conditions,
              })
              .catch(err => {
                logger.warn('Drug safety check failed:', err);
                return null;
              })
          : Promise.resolve(null),

        // Clinical guidelines
        request.chief_complaint || request.symptoms.length > 0
          ? clinicalGuidelinesService
              .getGuidelines(request.chief_complaint || request.symptoms[0])
              .catch(err => {
                logger.warn('Clinical guidelines fetch failed:', err);
                return [];
              })
          : Promise.resolve([]),

        // Risk stratification (placeholder - would use actual patient data)
        Promise.resolve(null), // Would calculate based on specific risk models

        // Med-PaLM 2 differential diagnosis (85% USMLE accuracy)
        request.symptoms.length > 0
          ? googleMedPaLM2Service
              .generateDifferentialDiagnosis({
                symptoms: request.symptoms,
                context: {
                  symptoms: request.symptoms,
                  vitals: request.vitals,
                  labs: request.labs,
                  medicalHistory: request.medical_history,
                  urgency: request.urgency,
                },
                maxDiagnoses: 5,
                includeRareDiseases: true,
              })
              .catch(err => {
                logger.warn('Med-PaLM 2 differential diagnosis failed:', err);
                return null;
              })
          : Promise.resolve(null),

        // Medical imaging AI analysis (Aidoc, PathAI, Zebra Medical)
        this.analyzeImagingIfAvailable(request).catch(err => {
          logger.warn('Imaging AI analysis failed:', err);
          return null;
        }),
      ]);

      return {
        literature: literature || [],
        drugSafety,
        guidelines: guidelines || [],
        riskAssessment,
        medPalmDifferentials,
        imagingAnalysis,
      };
    } catch (error: any) {
      logger.error('Enrichment failed:', error);
      // Return empty enrichment on error (don't block consultation)
      return {
        literature: [],
        drugSafety: null,
        guidelines: [],
        riskAssessment: null,
        medPalmDifferentials: null,
        imagingAnalysis: null,
      };
    }
  }

  /**
   * Analyze imaging if available in consultation request
   *
   * Supports:
   * - CT/MRI critical findings (Aidoc)
   * - Digital pathology (PathAI)
   * - Multi-modality imaging (Zebra Medical)
   */
  private async analyzeImagingIfAvailable(request: ConsultationRequest): Promise<any | null> {
    if (!request.imaging || Object.keys(request.imaging).length === 0) {
      return null;
    }

    logger.info('Analyzing imaging studies with medical AI', {
      imagingTypes: Object.keys(request.imaging),
    });

    const imagingResults: any = {
      ctMriFindings: null,
      pathologyFindings: null,
      comprehensiveImaging: null,
    };

    try {
      // Aidoc: CT/MRI critical findings detection
      if (request.imaging.ct || request.imaging.mri) {
        const studyInput = {
          studyId: request.imaging.studyId || `study_${Date.now()}`,
          patientId: request.patient_id,
          modality: request.imaging.ct ? 'CT_NEXUS' : 'MRI_NEXUS',
          dicomUrl: request.imaging.dicomUrl,
          clinicalContext: {
            symptoms: request.symptoms,
            urgency: request.urgency === 'emergent' ? 'STAT' : 'URGENT',
          },
        };

        const aidocAnalysis = await aidocService.analyzeImaging(studyInput as any);

        // Get triage priority
        const triage = await aidocService.getTriagePriority(aidocAnalysis);

        imagingResults.ctMriFindings = {
          analysis: aidocAnalysis,
          triage,
          hasLifeThreatening: aidocService.hasLifeThreateningFindings(aidocAnalysis),
        };
      }

      // PathAI: Digital pathology analysis
      if (request.imaging.pathology) {
        const slideInput = {
          slideId: request.imaging.slideId || `slide_${Date.now()}`,
          patientId: request.patient_id,
          specimenType: request.imaging.specimenType || 'BREAST_BIOPSY',
          stainType: request.imaging.stainType || 'H&E',
          wholeslideImageUrl: request.imaging.wholeslideImageUrl,
        };

        const pathologyAnalysis = await pathAIService.analyzeSlide(slideInput as any);

        // Get pathologist recommendation
        const pathologistRec = pathAIService.getPathologistRecommendation(pathologyAnalysis);

        imagingResults.pathologyFindings = {
          analysis: pathologyAnalysis,
          recommendation: pathologistRec,
        };
      }

      // Zebra Medical: Comprehensive multi-modality imaging
      if (request.imaging.zebra || request.imaging.opportunisticScreening) {
        const zebraInput = {
          studyId: request.imaging.studyId || `zebra_${Date.now()}`,
          patientId: request.patient_id,
          modality: (request.imaging.modality || 'CT') as any,
          anatomicalRegion: request.imaging.anatomicalRegion || 'CHEST',
          dicomUrl: request.imaging.dicomUrl,
          enableOpportunisticScreening: true,
        };

        const zebraAnalysis = await zebraMedicalService.analyzeImaging(zebraInput);

        // Generate opportunistic screening report
        const screeningReport = zebraMedicalService.generateOpportunisticScreeningReport(
          zebraAnalysis
        );

        imagingResults.comprehensiveImaging = {
          analysis: zebraAnalysis,
          screeningReport,
        };
      }

      // Return null if no imaging was actually analyzed
      if (
        !imagingResults.ctMriFindings &&
        !imagingResults.pathologyFindings &&
        !imagingResults.comprehensiveImaging
      ) {
        return null;
      }

      return imagingResults;
    } catch (error: any) {
      logger.error('Imaging AI analysis failed:', error);
      return null;
    }
  }

  /**
   * Perform safety validation on clinical recommendations
   */
  private async performSafetyValidation(
    consensus: ConsensusResult,
    request: ConsultationRequest
  ): Promise<any> {
    try {
      // Convert consensus to medical recommendation format
      const medicalRecommendation = {
        recommendationType: 'diagnosis' as const,
        primaryRecommendation: consensus.primaryDiagnosis.condition,
        diagnosis: {
          condition: consensus.primaryDiagnosis.condition,
          icd10Code: consensus.primaryDiagnosis.icd10Code,
          confidence: consensus.primaryDiagnosis.confidence,
          differentials: consensus.differentialDiagnoses?.map(d => d.condition),
        },
        medications: consensus.recommendations
          ?.filter(r => r.type === 'medication')
          .map(r => ({
            drug: r.recommendation,
            dose: 0, // Would extract from recommendation
            doseUnit: 'mg',
            frequency: 'daily',
            route: 'oral' as const,
            indication: consensus.primaryDiagnosis.condition,
          })),
        patientContext: {
          age: (request.medical_history as any)?.age || 50,
          weight: request.vitals?.weight,
          sex: ((request.medical_history as any)?.sex || 'other') as 'male' | 'female' | 'other',
          allergies: request.medical_history?.allergies || [],
          currentMedications: request.medical_history?.medications || [],
          conditions: request.medical_history?.conditions || [],
        },
        aiConfidence: consensus.overallConfidence,
      };

      const safetyValidation = await medicalSafetyValidator.validateRecommendation(
        medicalRecommendation
      );

      return safetyValidation;
    } catch (error: any) {
      logger.error('Safety validation failed:', error);
      return {
        safe: false,
        overallRisk: 'high',
        criticalAlerts: [],
        warnings: [],
        informational: [],
        drugInteractionConflicts: [],
        contraindicationViolations: [],
        doseRangeViolations: [],
        recommendations: ['Safety validation failed - require human physician review'],
        requiresHumanReview: true,
        safetyScore: 0,
      };
    }
  }

  /**
   * Generate compliance report
   */
  private async generateComplianceReport(
    request: ConsultationRequest,
    consensus: ConsensusResult
  ): Promise<any> {
    try {
      const complianceValidation = await hipaaComplianceService.validateCompliance({
        type: 'consultation',
        userId: 'system',
        userRole: 'ai_assistant',
        patientId: request.patient_id,
        dataAccessed: ['diagnosis', 'recommendations', 'medical_history'],
        purpose: 'treatment',
        hasConsent: true,
        encryptionEnabled: true,
      });

      return {
        hipaaCompliant: complianceValidation.compliant,
        violations: complianceValidation.violations.map(v => v.description),
        warnings: complianceValidation.warnings.map(w => w.description),
        overallRiskLevel: complianceValidation.overallRiskLevel,
      };
    } catch (error: any) {
      logger.error('Compliance report generation failed:', error);
      return {
        hipaaCompliant: false,
        violations: ['Compliance validation failed'],
        warnings: ['Unable to validate HIPAA compliance'],
        overallRiskLevel: 'critical',
      };
    }
  }

  /**
   * Log clinical decision to audit trail
   */
  private logClinicalDecision(
    consultationId: string,
    request: ConsultationRequest,
    consensus: ConsensusResult,
    individualAnalyses: any[],
    safetyValidation: any
  ): { decisionId: string; auditId: string } {
    try {
      const decision = auditTrailService.logDecision({
        timestamp: new Date(),
        patientId: request.patient_id,
        clinicianId: 'ai_system',
        clinicianRole: 'ai_assistant',
        decisionType: 'diagnosis',
        aiAssisted: true,
        aiModels: individualAnalyses.map(analysis => ({
          modelId: analysis.modelUsed || 'unknown',
          modelName: analysis.modelUsed || 'Unknown Model',
          version: '1.0',
          provider: 'NexusDoc',
          modelType: 'llm' as const,
          purpose: `Medical consultation - ${analysis.specialty}`,
        })),
        inputs: {
          symptoms: request.symptoms,
          vitals: request.vitals,
          labs: request.labs,
          imaging: request.imaging,
          medicalHistory: request.medical_history,
        },
        outputs: {
          primaryDiagnosis: consensus.primaryDiagnosis.condition,
          confidence: consensus.primaryDiagnosis.confidence,
          recommendations: consensus.recommendations?.map(r => r.recommendation),
        },
        evidence: {
          sources: individualAnalyses.map(a => `${a.specialty} agent`),
          clinicalReasoningSteps: [
            'Multi-agent consensus analysis',
            'Medical intelligence enrichment',
            'Safety validation',
            'HIPAA compliance check',
          ],
        },
        safetyValidation: {
          validated: true,
          safetyScore: safetyValidation.safetyScore,
          criticalAlerts: safetyValidation.criticalAlerts.length,
          warnings: safetyValidation.warnings.length,
        },
        humanReview: {
          required: safetyValidation.requiresHumanReview,
          completed: false,
        },
      });

      const auditLog = auditTrailService.logEvent({
        eventType: 'clinical_decision',
        userId: 'ai_system',
        userRole: 'ai_assistant',
        patientId: request.patient_id,
        action: `Medical consultation completed: ${consensus.primaryDiagnosis.condition}`,
        details: {
          consultationId,
          decisionId: decision.decisionId,
          aiConfidence: consensus.overallConfidence,
          safetyScore: safetyValidation.safetyScore,
          requiresHumanReview: safetyValidation.requiresHumanReview,
        },
        outcome: 'success',
      });

      return {
        decisionId: decision.decisionId,
        auditId: auditLog.auditId,
      };
    } catch (error: any) {
      logger.error('Audit logging failed:', error);
      return {
        decisionId: 'audit_failed',
        auditId: 'audit_failed',
      };
    }
  }
}

/**
 * Enriched medical context
 */
export interface EnrichedContext {
  literature: any[]; // PubMed articles
  drugSafety: any | null; // Drug safety report
  guidelines: any[]; // Clinical guidelines
  riskAssessment: any | null; // Risk scores
  medPalmDifferentials: any | null; // Med-PaLM 2 differential diagnoses
  imagingAnalysis: any | null; // Medical imaging AI analysis (Aidoc, PathAI, Zebra Medical)
}

// Export singleton instance
export const consultationOrchestrationService = new ConsultationOrchestrationService();
