/**
 * Compliance Services Module
 * Exports all compliance and safety services
 *
 * Services:
 * - HIPAA Compliance
 * - Medical Safety Validation
 * - Audit Trail
 * - Federated Learning
 */

// HIPAA Compliance
export {
  hipaaComplianceService,
  HIPAAComplianceService,
  type PHIType,
  type PHIElement,
  type MaskedPHI,
  type PHIAccessLog,
  type ConsentRecord,
  type ComplianceValidationResult,
  type ComplianceViolation,
  type ComplianceWarning,
  type EncryptionValidation,
} from './hipaa-compliance';

// Medical Safety Validator
export {
  medicalSafetyValidator,
  MedicalSafetyValidatorService,
  type SafetySeverity,
  type MedicalRecommendation,
  type MedicationRecommendation,
  type ProcedureRecommendation,
  type TestRecommendation,
  type DiagnosisRecommendation,
  type PatientContext,
  type SafetyValidationResult,
  type SafetyAlert,
  type DrugInteractionConflict,
  type ContraindicationViolation,
  type DoseRangeViolation,
} from './medical-safety-validator';

// Audit Trail
export {
  auditTrailService,
  AuditTrailService,
  type AuditEventType,
  type AuditLogEntry,
  type ClinicalDecisionAudit,
  type AIModelRecord,
  type AuditReport,
  type ModelVersionRecord,
} from './audit-trail-service';

// Federated Learning
export {
  federatedLearningService,
  FederatedLearningService,
  type ModelParameters,
  type LocalTrainingConfig,
  type FederatedRound,
  type NodeParticipation,
  type AggregationResult,
  type DifferentialPrivacyParams,
} from './federated-learning-service';
