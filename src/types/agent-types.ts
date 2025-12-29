/**
 * Agent Type Definitions
 * Defines all medical agent types, roles, and interfaces
 */

/**
 * Medical agent specializations
 */
export enum MedicalSpecialty {
  // Primary Care & Emergency
  PRIMARY_CARE = 'primary_care',
  EMERGENCY_MEDICINE = 'emergency_medicine',

  // Core Specialties
  CARDIOLOGY = 'cardiology',
  NEUROLOGY = 'neurology',
  PULMONOLOGY = 'pulmonology',
  GASTROENTEROLOGY = 'gastroenterology',
  ENDOCRINOLOGY = 'endocrinology',
  NEPHROLOGY = 'nephrology',
  RHEUMATOLOGY = 'rheumatology',
  HEMATOLOGY = 'hematology',
  ONCOLOGY = 'oncology',
  INFECTIOUS_DISEASE = 'infectious_disease',

  // Diagnostic Specialties
  RADIOLOGY = 'radiology',
  PATHOLOGY = 'pathology',
  LABORATORY_MEDICINE = 'laboratory_medicine',

  // Therapeutic Specialties
  PHARMACOLOGY = 'pharmacology',
  SURGERY = 'surgery',
  ANESTHESIOLOGY = 'anesthesiology',
  PSYCHIATRY = 'psychiatry',

  // Support Specialties
  CLINICAL_RESEARCH = 'clinical_research',
  MEDICAL_DOCUMENTATION = 'medical_documentation',
  RARE_DISEASE_SPECIALIST = 'rare_disease_specialist',
}

/**
 * Agent spawn frequency triggers
 */
export enum SpawnFrequency {
  ALWAYS = 'always',              // Always spawn (e.g., primary care)
  HIGH_URGENCY = 'high_urgency',  // Spawn for urgent/emergent cases
  IMAGING_REQUESTS = 'imaging_requests',
  LAB_REQUESTS = 'lab_requests',
  DRUG_QUERIES = 'drug_queries',
  SURGICAL_CANDIDATES = 'surgical_candidates',
  COMPLEX_CASES = 'complex_cases',
  RARE_SUSPICION = 'rare_suspicion',
  KEYWORD_TRIGGERED = 'keyword_triggered',
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  specialty: MedicalSpecialty;
  displayName: string;
  description: string;
  spawnFrequency: SpawnFrequency;
  triggerKeywords?: string[];
  baseConfidenceWeight: number; // 0.5 - 1.0
  capabilities: string[];
  defaultModel?: string;
  requiresSpecialData?: string[]; // e.g., ['imaging', 'lab_results']
}

/**
 * Agent spawn decision
 */
export interface AgentSpawnDecision {
  shouldSpawn: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedCompletionTime: number; // seconds
}

/**
 * Spawned agent instance
 */
export interface SpawnedAgent {
  agentId: string;
  instanceId: string;
  specialty: MedicalSpecialty;
  displayName: string;
  status: 'spawning' | 'active' | 'analyzing' | 'completed' | 'failed';
  spawnedAt: Date;
  completedAt?: Date;
  confidenceWeight: number;
  progress: number; // 0-1
  currentActivity?: string;
  result?: AgentResult;
  error?: string;
}

/**
 * Agent analysis result
 */
export interface AgentResult {
  agentId: string;
  specialty: MedicalSpecialty;
  primaryDiagnosis?: {
    condition: string;
    icd10Code?: string;
    confidence: number;
    evidenceLevel?: string;
    supportingEvidence: string[];
  };
  differentialDiagnoses?: Array<{
    condition: string;
    icd10Code?: string;
    confidence: number;
    reasoning: string;
  }>;
  recommendations: Array<{
    type: 'diagnostic' | 'therapeutic' | 'procedural' | 'referral' | 'monitoring';
    priority: 'routine' | 'urgent' | 'emergent';
    recommendation: string;
    evidence?: string[];
  }>;
  riskAssessment?: {
    riskLevel: 'low' | 'moderate' | 'high' | 'critical';
    scores?: Record<string, number>;
    factors: string[];
  };
  findings: string[];
  concerns: string[];
  confidence: number;
  processingTime: number; // milliseconds
  modelUsed?: string;
  tokensUsed?: number;
  costUsd?: number;
}

/**
 * Complexity factors for scoring
 */
export interface ComplexityFactors {
  // Symptom-based
  symptomCount: number;
  symptomSeverity: number; // 0-1 normalized
  symptomDuration: number; // 0-1 normalized (acute vs chronic)

  // Clinical data
  vitalSignsAbnormal: number; // 0-1 (percentage abnormal)
  labResultsAbnormal: number; // 0-1 (percentage abnormal)
  imagingRequired: boolean;

  // Patient factors
  age: number; // actual age
  comorbidityCount: number;
  medicationCount: number;
  allergyCount: number;

  // Case characteristics
  urgencyLevel: 'routine' | 'urgent' | 'emergent';
  specialtyRequirements: string[]; // specialties that might be needed
  dataVolume: number; // 0-1 normalized (amount of data to process)

  // Diagnostic complexity
  differentialBreadth: number; // 0-1 (how many possible diagnoses)
  rareDiseaseSuspicion: number; // 0-1
  multiSystemInvolvement: boolean;

  // Additional context
  previousTreatmentFailures: number;
  symptomProgressionRate: 'stable' | 'improving' | 'worsening';
}

/**
 * Complexity score breakdown
 */
export interface ComplexityScore {
  overallScore: number; // 0-1
  breakdown: {
    symptomComplexity: number;
    clinicalDataComplexity: number;
    patientComplexity: number;
    diagnosticComplexity: number;
    urgencyFactor: number;
  };
  normalizedScore: number; // 0-1 after applying weights
  agentCountRecommendation: number; // 1-15
  estimatedProcessingTime: number; // seconds
}

/**
 * Consensus building data
 */
export interface ConsensusInput {
  agents: SpawnedAgent[];
  primaryFocus: 'diagnosis' | 'treatment' | 'risk_assessment' | 'comprehensive';
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  primaryDiagnosis: {
    condition: string;
    icd10Code?: string;
    confidence: number;
    agreementScore: number; // 0-1 (percentage of agents agreeing)
    supportingAgents: string[]; // agent IDs
    dissentingAgents?: string[];
    evidenceStrength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  };
  differentialDiagnoses: Array<{
    condition: string;
    icd10Code?: string;
    confidence: number;
    agreementScore: number;
    suggestedBy: string[]; // agent IDs
  }>;
  recommendations: Array<{
    type: string;
    priority: string;
    recommendation: string;
    agreementScore: number;
    suggestedBy: string[];
  }>;
  conflicts?: Array<{
    issue: string;
    agentsInvolved: string[];
    resolutionMethod: 'majority_vote' | 'expert_override' | 'evidence_based' | 'manual_review';
    resolution: string;
  }>;
  overallConfidence: number;
  consensusQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

/**
 * Orchestration task
 */
export interface OrchestrationTask {
  taskId: string;
  taskType: 'clinical_consultation' | 'imaging_analysis' | 'drug_discovery' | 'telemedicine';
  status: 'pending' | 'spawning_agents' | 'analyzing' | 'building_consensus' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Input data
  requestData: any;
  complexityScore?: ComplexityScore;

  // Agent orchestration
  agentsSpawned: SpawnedAgent[];
  agentCount: number;
  agentsCompleted: number;
  agentsFailed: number;

  // Progress tracking
  progress: number; // 0-1
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds

  // Results
  consensusResult?: ConsensusResult;
  finalResult?: any;
  error?: string;

  // Metadata
  requestedBy?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Agent warm pool entry
 */
export interface WarmPoolAgent {
  agentId: string;
  specialty: MedicalSpecialty;
  lastUsed: Date;
  usageCount: number;
  averageCompletionTime: number; // milliseconds
  successRate: number; // 0-1
}

/**
 * Orchestration metrics
 */
export interface OrchestrationMetrics {
  totalTasksProcessed: number;
  averageAgentsPerTask: number;
  averageTaskDuration: number; // seconds
  successRate: number; // 0-1
  averageConfidence: number; // 0-1
  mostUsedSpecialties: Array<{
    specialty: MedicalSpecialty;
    count: number;
  }>;
  costMetrics: {
    totalCostUsd: number;
    averageCostPerTask: number;
    averageCostPerAgent: number;
  };
  performanceMetrics: {
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}
