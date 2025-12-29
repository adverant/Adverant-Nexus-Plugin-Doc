/**
 * Audit Trail Service
 * Comprehensive audit logging for regulatory compliance and legal defense
 *
 * Features:
 * - Clinical decision audit trail
 * - AI model versioning and provenance
 * - Regulatory compliance tracking (FDA, HIPAA, GDPR)
 * - Tamper-proof audit logs
 * - Complete traceability
 *
 * Regulations:
 * - FDA 21 CFR Part 11 (Electronic Records)
 * - HIPAA 45 CFR § 164.308(a)(1)(ii)(D) (Audit Controls)
 * - GDPR Article 30 (Records of Processing Activities)
 * - ISO 27001 (Information Security)
 */

import crypto from 'crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AuditTrailService');

/**
 * Audit log entry types
 */
export type AuditEventType =
  | 'clinical_decision'
  | 'diagnosis_generated'
  | 'treatment_recommended'
  | 'medication_prescribed'
  | 'phi_access'
  | 'model_inference'
  | 'consent_obtained'
  | 'data_export'
  | 'configuration_change'
  | 'user_login'
  | 'user_logout'
  | 'security_alert'
  | 'compliance_violation';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  auditId: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId: string;
  userRole: string;
  patientId?: string;
  action: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
  ipAddress?: string;
  sessionId?: string;
  modelVersion?: string;
  dataAccessed?: string[];
  modifications?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  signature: string; // Cryptographic signature for tamper detection
  previousHash?: string; // Hash chain for immutability
}

/**
 * Clinical decision audit entry
 */
export interface ClinicalDecisionAudit {
  decisionId: string;
  timestamp: Date;
  patientId: string;
  clinicianId: string;
  clinicianRole: string;
  decisionType: 'diagnosis' | 'treatment' | 'medication' | 'procedure' | 'referral';
  aiAssisted: boolean;
  aiModels?: AIModelRecord[];
  inputs: {
    symptoms?: string[];
    vitals?: Record<string, any>;
    labs?: Record<string, any>;
    imaging?: Record<string, any>;
    medicalHistory?: Record<string, any>;
  };
  outputs: {
    primaryDiagnosis?: string;
    confidence?: number;
    recommendations?: string[];
    medications?: any[];
    procedures?: any[];
  };
  evidence: {
    sources: string[];
    literatureReferences?: string[];
    guidelinesCited?: string[];
    clinicalReasoningSteps?: string[];
  };
  safetyValidation?: {
    validated: boolean;
    safetyScore: number;
    criticalAlerts: number;
    warnings: number;
  };
  humanReview?: {
    required: boolean;
    completed: boolean;
    reviewerId?: string;
    reviewerComments?: string;
    approved: boolean;
  };
  outcome?: {
    implemented: boolean;
    effectivenessScore?: number;
    adverseEvents?: string[];
  };
  signature: string;
}

/**
 * AI model record for provenance
 */
export interface AIModelRecord {
  modelId: string;
  modelName: string;
  version: string;
  provider: string; // e.g., "OpenAI", "Anthropic", "Google"
  modelType: 'llm' | 'vision' | 'specialized';
  trainedOn?: Date;
  purpose: string;
  performanceMetrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
  regulatoryApproval?: {
    fda: boolean;
    ce: boolean; // European CE marking
    status: 'approved' | 'pending' | 'investigational';
  };
}

/**
 * Audit report
 */
export interface AuditReport {
  reportId: string;
  generatedAt: Date;
  reportType: 'compliance' | 'security' | 'clinical' | 'comprehensive';
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    clinicalDecisions: number;
    phiAccesses: number;
    complianceViolations: number;
    securityAlerts: number;
  };
  events: AuditLogEntry[];
  clinicalDecisions: ClinicalDecisionAudit[];
  complianceStatus: {
    hipaaCompliant: boolean;
    fdaCompliant: boolean;
    gdprCompliant: boolean;
    violations: string[];
  };
  recommendations: string[];
}

/**
 * Model version tracking
 */
export interface ModelVersionRecord {
  versionId: string;
  modelName: string;
  version: string;
  deployedAt: Date;
  previousVersion?: string;
  changes: string[];
  validationResults: {
    accuracy: number;
    safety: number;
    bias: number;
  };
  approvedBy: string;
  regulatoryStatus: 'approved' | 'pending' | 'investigational';
}

/**
 * Audit Trail Service
 */
export class AuditTrailService {
  private auditLogs: AuditLogEntry[];
  private clinicalDecisions: ClinicalDecisionAudit[];
  private modelVersions: Map<string, ModelVersionRecord[]>;
  private secretKey: Buffer;
  private lastHash: string;

  constructor() {
    this.auditLogs = [];
    this.clinicalDecisions = [];
    this.modelVersions = new Map();

    // Generate secret key for signatures (in production, use KMS)
    this.secretKey = crypto.randomBytes(32);
    this.lastHash = this.generateInitialHash();

    logger.info('Audit Trail Service initialized');
  }

  /**
   * Log clinical decision
   */
  logDecision(decision: Omit<ClinicalDecisionAudit, 'decisionId' | 'signature'>): ClinicalDecisionAudit {
    const decisionId = this.generateDecisionId();

    const auditEntry: ClinicalDecisionAudit = {
      ...decision,
      decisionId,
      signature: this.signData({ ...decision, decisionId }),
    };

    this.clinicalDecisions.push(auditEntry);

    // Also create general audit log
    this.logEvent({
      eventType: 'clinical_decision',
      userId: decision.clinicianId,
      userRole: decision.clinicianRole,
      patientId: decision.patientId,
      action: `Clinical decision: ${decision.decisionType}`,
      details: {
        decisionId,
        aiAssisted: decision.aiAssisted,
        confidence: decision.outputs.confidence,
        safetyScore: decision.safetyValidation?.safetyScore,
      },
      outcome: 'success',
    });

    logger.info('Clinical decision logged', {
      decisionId,
      patientId: decision.patientId,
      type: decision.decisionType,
      aiAssisted: decision.aiAssisted,
    });

    return auditEntry;
  }

  /**
   * Log general audit event
   */
  logEvent(
    event: Omit<AuditLogEntry, 'auditId' | 'timestamp' | 'signature' | 'previousHash'>
  ): AuditLogEntry {
    const auditId = this.generateAuditId();
    const timestamp = new Date();

    const entry: AuditLogEntry = {
      ...event,
      auditId,
      timestamp,
      previousHash: this.lastHash,
      signature: '', // Will be set below
    };

    // Generate signature and hash
    entry.signature = this.signData(entry);
    this.lastHash = this.hashEntry(entry);

    this.auditLogs.push(entry);

    // Alert on security events
    if (event.eventType === 'security_alert' || event.eventType === 'compliance_violation') {
      logger.warn('🔒 Security/Compliance Event', {
        auditId,
        eventType: event.eventType,
        action: event.action,
        userId: event.userId,
      });
    }

    return entry;
  }

  /**
   * Track AI model version
   */
  trackModelVersion(model: Omit<ModelVersionRecord, 'versionId'>): ModelVersionRecord {
    const versionId = this.generateVersionId();

    const record: ModelVersionRecord = {
      ...model,
      versionId,
    };

    const versions = this.modelVersions.get(model.modelName) || [];
    versions.push(record);
    this.modelVersions.set(model.modelName, versions);

    // Audit the model version change
    this.logEvent({
      eventType: 'configuration_change',
      userId: model.approvedBy,
      userRole: 'admin',
      action: `Model version update: ${model.modelName} v${model.version}`,
      details: {
        versionId,
        changes: model.changes,
        validationResults: model.validationResults,
      },
      outcome: 'success',
    });

    logger.info('Model version tracked', {
      versionId,
      model: model.modelName,
      version: model.version,
    });

    return record;
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(
    reportType: AuditReport['reportType'],
    timeRange: { start: Date; end: Date },
    options?: {
      includeEvents?: boolean;
      includeClinicalDecisions?: boolean;
      checkCompliance?: boolean;
    }
  ): Promise<AuditReport> {
    logger.info('Generating audit report', { reportType, timeRange });

    const reportId = this.generateReportId();

    // Filter events by time range
    const events = this.auditLogs.filter(
      (log) => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
    );

    const clinicalDecisions = this.clinicalDecisions.filter(
      (decision) => decision.timestamp >= timeRange.start && decision.timestamp <= timeRange.end
    );

    // Calculate summary statistics
    const summary = {
      totalEvents: events.length,
      clinicalDecisions: clinicalDecisions.length,
      phiAccesses: events.filter((e) => e.eventType === 'phi_access').length,
      complianceViolations: events.filter((e) => e.eventType === 'compliance_violation').length,
      securityAlerts: events.filter((e) => e.eventType === 'security_alert').length,
    };

    // Compliance status
    const complianceStatus = options?.checkCompliance
      ? await this.checkComplianceStatus(events, clinicalDecisions)
      : {
          hipaaCompliant: true,
          fdaCompliant: true,
          gdprCompliant: true,
          violations: [],
        };

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, complianceStatus);

    const report: AuditReport = {
      reportId,
      generatedAt: new Date(),
      reportType,
      timeRange,
      summary,
      events: options?.includeEvents ? events : [],
      clinicalDecisions: options?.includeClinicalDecisions ? clinicalDecisions : [],
      complianceStatus,
      recommendations,
    };

    logger.info('Audit report generated', {
      reportId,
      totalEvents: summary.totalEvents,
      clinicalDecisions: summary.clinicalDecisions,
    });

    return report;
  }

  /**
   * Get clinical decision by ID
   */
  getDecision(decisionId: string): ClinicalDecisionAudit | undefined {
    return this.clinicalDecisions.find((d) => d.decisionId === decisionId);
  }

  /**
   * Get all decisions for patient
   */
  getPatientDecisions(patientId: string): ClinicalDecisionAudit[] {
    return this.clinicalDecisions.filter((d) => d.patientId === patientId);
  }

  /**
   * Get model version history
   */
  getModelVersionHistory(modelName: string): ModelVersionRecord[] {
    return this.modelVersions.get(modelName) || [];
  }

  /**
   * Verify audit log integrity (detect tampering)
   */
  verifyIntegrity(): { valid: boolean; tamperedEntries: string[] } {
    const tamperedEntries: string[] = [];
    let previousHash = this.generateInitialHash();

    for (const entry of this.auditLogs) {
      // Verify hash chain
      if (entry.previousHash !== previousHash) {
        tamperedEntries.push(entry.auditId);
      }

      // Verify signature
      const expectedSignature = this.signData({
        ...entry,
        signature: '', // Exclude signature from verification
      });

      if (entry.signature !== expectedSignature) {
        tamperedEntries.push(entry.auditId);
      }

      previousHash = this.hashEntry(entry);
    }

    const valid = tamperedEntries.length === 0;

    if (!valid) {
      logger.error('🚨 AUDIT LOG TAMPERING DETECTED', {
        tamperedCount: tamperedEntries.length,
        tamperedIds: tamperedEntries,
      });
    }

    return { valid, tamperedEntries };
  }

  /**
   * Export audit logs (for regulatory submission)
   */
  async exportAuditLogs(
    format: 'json' | 'csv' | 'pdf',
    timeRange?: { start: Date; end: Date }
  ): Promise<string> {
    let logs = this.auditLogs;

    if (timeRange) {
      logs = logs.filter(
        (log) => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );
    }

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);

      case 'csv':
        return this.convertToCSV(logs);

      case 'pdf':
        // In production, use PDF generation library
        return 'PDF export not implemented';

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Sign data with HMAC
   */
  private signData(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Hash entry for chain
   */
  private hashEntry(entry: AuditLogEntry): string {
    const entryString = JSON.stringify(entry);
    return crypto
      .createHash('sha256')
      .update(entryString)
      .digest('hex');
  }

  /**
   * Generate initial hash for chain
   */
  private generateInitialHash(): string {
    return crypto
      .createHash('sha256')
      .update('AUDIT_TRAIL_GENESIS')
      .digest('hex');
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `AUDIT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate decision ID
   */
  private generateDecisionId(): string {
    return `DECISION_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate version ID
   */
  private generateVersionId(): string {
    return `VERSION_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    return `REPORT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Check compliance status
   */
  private async checkComplianceStatus(
    events: AuditLogEntry[],
    clinicalDecisions: ClinicalDecisionAudit[]
  ): Promise<{
    hipaaCompliant: boolean;
    fdaCompliant: boolean;
    gdprCompliant: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // HIPAA compliance checks
    const unauthorizedPHIAccess = events.filter(
      (e) => e.eventType === 'phi_access' && e.outcome === 'failure'
    );

    if (unauthorizedPHIAccess.length > 0) {
      violations.push(`${unauthorizedPHIAccess.length} unauthorized PHI access attempts`);
    }

    // FDA compliance checks (21 CFR Part 11)
    const unvalidatedClinicalDecisions = clinicalDecisions.filter(
      (d) => d.aiAssisted && !d.safetyValidation?.validated
    );

    if (unvalidatedClinicalDecisions.length > 0) {
      violations.push(`${unvalidatedClinicalDecisions.length} AI decisions without safety validation`);
    }

    const unreviewed = clinicalDecisions.filter(
      (d) => d.humanReview?.required && !d.humanReview.completed
    );

    if (unreviewed.length > 0) {
      violations.push(`${unreviewed.length} clinical decisions pending required human review`);
    }

    // GDPR compliance checks
    const dataExports = events.filter((e) => e.eventType === 'data_export');
    const exportsWithoutConsent = dataExports.filter(
      (e) => !e.details.consentVerified
    );

    if (exportsWithoutConsent.length > 0) {
      violations.push(`${exportsWithoutConsent.length} data exports without verified consent`);
    }

    return {
      hipaaCompliant: unauthorizedPHIAccess.length === 0,
      fdaCompliant: unvalidatedClinicalDecisions.length === 0 && unreviewed.length === 0,
      gdprCompliant: exportsWithoutConsent.length === 0,
      violations,
    };
  }

  /**
   * Generate recommendations based on audit findings
   */
  private generateRecommendations(
    summary: AuditReport['summary'],
    complianceStatus: AuditReport['complianceStatus']
  ): string[] {
    const recommendations: string[] = [];

    if (summary.complianceViolations > 0) {
      recommendations.push('🚨 Address compliance violations immediately');
    }

    if (summary.securityAlerts > 5) {
      recommendations.push('⚠️ High number of security alerts - review security posture');
    }

    if (!complianceStatus.hipaaCompliant) {
      recommendations.push('HIPAA violations detected - conduct immediate security audit');
    }

    if (!complianceStatus.fdaCompliant) {
      recommendations.push('FDA compliance issues - review clinical decision validation process');
    }

    if (!complianceStatus.gdprCompliant) {
      recommendations.push('GDPR violations - review consent management procedures');
    }

    if (summary.phiAccesses > 100) {
      recommendations.push('High PHI access volume - review access controls and minimum necessary principle');
    }

    recommendations.push('Conduct regular audit trail reviews (monthly recommended)');
    recommendations.push('Maintain audit logs for minimum 6 years (HIPAA requirement)');

    return recommendations;
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'Audit ID',
      'Timestamp',
      'Event Type',
      'User ID',
      'User Role',
      'Patient ID',
      'Action',
      'Outcome',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      log.auditId,
      log.timestamp.toISOString(),
      log.eventType,
      log.userId,
      log.userRole,
      log.patientId || '',
      log.action,
      log.outcome,
      log.ipAddress || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }
}

// Export singleton instance
export const auditTrailService = new AuditTrailService();
