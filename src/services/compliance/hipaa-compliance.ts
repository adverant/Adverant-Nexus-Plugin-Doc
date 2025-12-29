/**
 * HIPAA Compliance Service
 * Ensures compliance with HIPAA Privacy Rule & Security Rule
 *
 * Features:
 * - PHI (Protected Health Information) detection and masking
 * - Audit logging for all PHI access
 * - Encryption validation
 * - Consent management
 * - Access control verification
 * - Breach detection and reporting
 *
 * Regulations:
 * - 45 CFR Part 160 (General Administrative Requirements)
 * - 45 CFR Part 164 (Privacy, Security, and Breach Notification Rules)
 */

import crypto from 'crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HIPAAComplianceService');

/**
 * PHI types as defined by HIPAA
 */
export type PHIType =
  | 'name'
  | 'geographic_subdivision'
  | 'dates'
  | 'phone_number'
  | 'fax_number'
  | 'email'
  | 'ssn'
  | 'mrn' // Medical Record Number
  | 'health_plan_number'
  | 'account_number'
  | 'certificate_number'
  | 'vehicle_identifier'
  | 'device_identifier'
  | 'biometric_identifier'
  | 'photo'
  | 'other_identifier';

/**
 * PHI element detected in data
 */
export interface PHIElement {
  type: PHIType;
  value: string;
  location: {
    field: string;
    startIndex?: number;
    endIndex?: number;
  };
  riskScore: number; // 0-1, likelihood this is actual PHI
  mustMask: boolean;
}

/**
 * Masked PHI result
 */
export interface MaskedPHI {
  original: string;
  masked: string;
  phiElements: PHIElement[];
  maskingMethod: 'redaction' | 'pseudonymization' | 'encryption';
}

/**
 * PHI access log entry
 */
export interface PHIAccessLog {
  timestamp: Date;
  userId: string;
  userRole: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'print';
  patientId: string;
  dataAccessed: string[]; // List of PHI fields accessed
  purpose: string; // TPO: Treatment, Payment, Operations
  ipAddress: string;
  sessionId: string;
  authorized: boolean;
  consentVerified: boolean;
  auditId: string;
}

/**
 * Consent record
 */
export interface ConsentRecord {
  consentId: string;
  patientId: string;
  consentType: 'treatment' | 'disclosure' | 'research' | 'marketing';
  grantedDate: Date;
  expirationDate?: Date;
  scope: string[]; // What can be shared
  authorizedParties: string[]; // Who can access
  restrictions?: string[];
  status: 'active' | 'revoked' | 'expired';
  signature: string; // Digital signature
  witnessSignature?: string;
}

/**
 * HIPAA compliance validation result
 */
export interface ComplianceValidationResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
  recommendations: string[];
  overallRiskLevel: 'low' | 'moderate' | 'high' | 'critical';
  privacyRuleCompliance: boolean;
  securityRuleCompliance: boolean;
  breachNotificationCompliance: boolean;
}

/**
 * HIPAA violation
 */
export interface ComplianceViolation {
  rule: string; // e.g., "45 CFR § 164.308(a)(1)(ii)(B)"
  severity: 'minor' | 'major' | 'critical';
  description: string;
  remediation: string;
  potentialPenalty?: string; // Financial penalty range
  mustReportToCMS: boolean; // Centers for Medicare & Medicaid Services
}

/**
 * Compliance warning (not violation, but risky)
 */
export interface ComplianceWarning {
  category: string;
  description: string;
  recommendation: string;
}

/**
 * Encryption validation result
 */
export interface EncryptionValidation {
  atRest: {
    enabled: boolean;
    algorithm: string;
    keySize: number;
    compliant: boolean;
  };
  inTransit: {
    enabled: boolean;
    protocol: string; // TLS 1.2+
    compliant: boolean;
  };
  keyManagement: {
    rotationEnabled: boolean;
    lastRotation?: Date;
    compliant: boolean;
  };
  overallCompliant: boolean;
}

/**
 * HIPAA Compliance Service
 */
export class HIPAAComplianceService {
  private phiDetectionPatterns: Map<PHIType, RegExp[]>;
  private accessLogs: PHIAccessLog[];
  private consentRecords: Map<string, ConsentRecord[]>; // patientId -> consents
  private encryptionKey: Buffer;

  // Minimum required encryption standards
  private readonly REQUIRED_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly REQUIRED_TLS_VERSION = 1.2;
  private readonly REQUIRED_KEY_SIZE = 256;

  constructor() {
    this.phiDetectionPatterns = new Map();
    this.accessLogs = [];
    this.consentRecords = new Map();

    // Generate encryption key (in production, use KMS like AWS KMS, Azure Key Vault)
    this.encryptionKey = crypto.randomBytes(32);

    this.initializePHIPatterns();

    logger.info('HIPAA Compliance Service initialized');
  }

  /**
   * Validate HIPAA compliance for a medical operation
   */
  async validateCompliance(
    operation: {
      type: 'consultation' | 'data_export' | 'research' | 'disclosure';
      userId: string;
      userRole: string;
      patientId: string;
      dataAccessed: string[];
      purpose: string;
      hasConsent?: boolean;
      encryptionEnabled?: boolean;
    }
  ): Promise<ComplianceValidationResult> {
    logger.info('Validating HIPAA compliance', {
      operation: operation.type,
      userId: operation.userId,
      patientId: operation.patientId,
    });

    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    const recommendations: string[] = [];

    // 1. Privacy Rule Compliance (45 CFR Part 164, Subpart E)
    const privacyCompliance = await this.validatePrivacyRule(operation, violations, warnings);

    // 2. Security Rule Compliance (45 CFR Part 164, Subpart C)
    const securityCompliance = this.validateSecurityRule(operation, violations, warnings);

    // 3. Breach Notification Compliance (45 CFR Part 164, Subpart D)
    const breachCompliance = this.validateBreachNotification(violations, warnings);

    // 4. Minimum Necessary Standard
    this.validateMinimumNecessary(operation, warnings, recommendations);

    // 5. Generate recommendations
    this.generateComplianceRecommendations(
      violations,
      warnings,
      recommendations
    );

    // Calculate overall risk
    const overallRiskLevel = this.calculateComplianceRisk(violations, warnings);

    const result: ComplianceValidationResult = {
      compliant: violations.length === 0,
      violations,
      warnings,
      recommendations,
      overallRiskLevel,
      privacyRuleCompliance: privacyCompliance,
      securityRuleCompliance: securityCompliance,
      breachNotificationCompliance: breachCompliance,
    };

    logger.info('HIPAA compliance validation complete', {
      compliant: result.compliant,
      violations: violations.length,
      warnings: warnings.length,
      riskLevel: overallRiskLevel,
    });

    return result;
  }

  /**
   * Detect and mask PHI in data
   */
  maskPHI(
    data: string | Record<string, any>,
    method: 'redaction' | 'pseudonymization' | 'encryption' = 'redaction'
  ): MaskedPHI {
    logger.debug('Masking PHI', { method });

    const originalText = typeof data === 'string' ? data : JSON.stringify(data);
    const phiElements = this.detectPHI(originalText);

    let maskedText = originalText;

    // Apply masking based on method
    phiElements.forEach((phi) => {
      switch (method) {
        case 'redaction':
          maskedText = maskedText.replace(phi.value, '[REDACTED]');
          break;

        case 'pseudonymization':
          const pseudonym = this.generatePseudonym(phi.value, phi.type);
          maskedText = maskedText.replace(phi.value, pseudonym);
          break;

        case 'encryption':
          const encrypted = this.encryptPHI(phi.value);
          maskedText = maskedText.replace(phi.value, encrypted);
          break;
      }
    });

    return {
      original: originalText,
      masked: maskedText,
      phiElements,
      maskingMethod: method,
    };
  }

  /**
   * Log PHI access for audit trail
   */
  logAccess(access: Omit<PHIAccessLog, 'timestamp' | 'auditId'>): PHIAccessLog {
    const log: PHIAccessLog = {
      ...access,
      timestamp: new Date(),
      auditId: this.generateAuditId(),
    };

    this.accessLogs.push(log);

    logger.info('PHI access logged', {
      auditId: log.auditId,
      userId: log.userId,
      action: log.action,
      patientId: log.patientId,
      authorized: log.authorized,
    });

    // Alert on unauthorized access
    if (!log.authorized) {
      logger.error('🚨 UNAUTHORIZED PHI ACCESS DETECTED', {
        auditId: log.auditId,
        userId: log.userId,
        patientId: log.patientId,
      });
      this.triggerBreachProtocol(log);
    }

    return log;
  }

  /**
   * Check if user has valid consent
   */
  async checkConsent(
    patientId: string,
    consentType: ConsentRecord['consentType'],
    requester: string
  ): Promise<{ hasConsent: boolean; consent?: ConsentRecord; reason?: string }> {
    const consents = this.consentRecords.get(patientId) || [];

    const validConsent = consents.find(
      (c) =>
        c.consentType === consentType &&
        c.status === 'active' &&
        (!c.expirationDate || c.expirationDate > new Date()) &&
        c.authorizedParties.includes(requester)
    );

    if (validConsent) {
      return { hasConsent: true, consent: validConsent };
    }

    // Determine why consent is missing
    let reason = 'No consent record found';
    const anyConsent = consents.find((c) => c.consentType === consentType);

    if (anyConsent) {
      if (anyConsent.status === 'revoked') {
        reason = 'Consent has been revoked';
      } else if (anyConsent.status === 'expired') {
        reason = 'Consent has expired';
      } else if (!anyConsent.authorizedParties.includes(requester)) {
        reason = 'Requester not authorized by consent';
      }
    }

    return { hasConsent: false, reason };
  }

  /**
   * Create consent record
   */
  createConsent(consent: Omit<ConsentRecord, 'consentId'>): ConsentRecord {
    const consentRecord: ConsentRecord = {
      ...consent,
      consentId: this.generateConsentId(),
    };

    const patientConsents = this.consentRecords.get(consent.patientId) || [];
    patientConsents.push(consentRecord);
    this.consentRecords.set(consent.patientId, patientConsents);

    logger.info('Consent created', {
      consentId: consentRecord.consentId,
      patientId: consent.patientId,
      type: consent.consentType,
    });

    return consentRecord;
  }

  /**
   * Revoke consent
   */
  revokeConsent(patientId: string, consentId: string): void {
    const consents = this.consentRecords.get(patientId) || [];
    const consent = consents.find((c) => c.consentId === consentId);

    if (consent) {
      consent.status = 'revoked';
      logger.info('Consent revoked', { consentId, patientId });
    }
  }

  /**
   * Validate encryption compliance
   */
  validateEncryption(
    config: {
      atRestAlgorithm?: string;
      atRestKeySize?: number;
      inTransitProtocol?: string;
      inTransitVersion?: number;
      keyRotationEnabled?: boolean;
      lastKeyRotation?: Date;
    }
  ): EncryptionValidation {
    const atRestCompliant =
      config.atRestAlgorithm === this.REQUIRED_ENCRYPTION_ALGORITHM &&
      (config.atRestKeySize || 0) >= this.REQUIRED_KEY_SIZE;

    const inTransitCompliant =
      config.inTransitProtocol === 'TLS' &&
      (config.inTransitVersion || 0) >= this.REQUIRED_TLS_VERSION;

    // Key rotation should happen at least annually
    const keyRotationCompliant = config.keyRotationEnabled === true;

    return {
      atRest: {
        enabled: !!config.atRestAlgorithm,
        algorithm: config.atRestAlgorithm || 'none',
        keySize: config.atRestKeySize || 0,
        compliant: atRestCompliant,
      },
      inTransit: {
        enabled: !!config.inTransitProtocol,
        protocol: config.inTransitProtocol || 'none',
        compliant: inTransitCompliant,
      },
      keyManagement: {
        rotationEnabled: config.keyRotationEnabled || false,
        lastRotation: config.lastKeyRotation,
        compliant: keyRotationCompliant,
      },
      overallCompliant: atRestCompliant && inTransitCompliant && keyRotationCompliant,
    };
  }

  /**
   * Initialize PHI detection patterns
   */
  private initializePHIPatterns(): void {
    // SSN pattern
    this.phiDetectionPatterns.set('ssn', [
      /\b\d{3}-\d{2}-\d{4}\b/g,
      /\b\d{9}\b/g,
    ]);

    // Phone number
    this.phiDetectionPatterns.set('phone_number', [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      /\(\d{3}\)\s*\d{3}[-.]?\d{4}/g,
    ]);

    // Email
    this.phiDetectionPatterns.set('email', [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ]);

    // Dates (DOB, admission dates, etc.)
    this.phiDetectionPatterns.set('dates', [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
    ]);

    // MRN (Medical Record Number) - typically 6-10 digits
    this.phiDetectionPatterns.set('mrn', [
      /\bMRN[:\s]*\d{6,10}\b/gi,
    ]);

    logger.debug('PHI detection patterns initialized');
  }

  /**
   * Detect PHI in text
   */
  private detectPHI(text: string): PHIElement[] {
    const detected: PHIElement[] = [];

    this.phiDetectionPatterns.forEach((patterns, type) => {
      patterns.forEach((pattern) => {
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          detected.push({
            type,
            value: match[0],
            location: {
              field: 'text',
              startIndex: match.index,
              endIndex: match.index ? match.index + match[0].length : undefined,
            },
            riskScore: this.calculatePHIRiskScore(type, match[0]),
            mustMask: this.mustMask(type),
          });
        }
      });
    });

    return detected;
  }

  /**
   * Calculate PHI risk score
   */
  private calculatePHIRiskScore(type: PHIType, value: string): number {
    // Higher risk for direct identifiers
    const highRiskTypes: PHIType[] = ['ssn', 'mrn', 'biometric_identifier'];
    if (highRiskTypes.includes(type)) {
      return 0.9;
    }

    const mediumRiskTypes: PHIType[] = ['name', 'phone_number', 'email'];
    if (mediumRiskTypes.includes(type)) {
      return 0.7;
    }

    return 0.5;
  }

  /**
   * Determine if PHI type must be masked
   */
  private mustMask(type: PHIType): boolean {
    // HIPAA requires masking of 18 identifiers
    const alwaysMask: PHIType[] = [
      'name',
      'geographic_subdivision',
      'dates',
      'phone_number',
      'email',
      'ssn',
      'mrn',
      'biometric_identifier',
    ];

    return alwaysMask.includes(type);
  }

  /**
   * Generate pseudonym for PHI
   */
  private generatePseudonym(value: string, type: PHIType): string {
    const hash = crypto
      .createHash('sha256')
      .update(value + this.encryptionKey.toString())
      .digest('hex')
      .substring(0, 8);

    return `[${type.toUpperCase()}_${hash}]`;
  }

  /**
   * Encrypt PHI value
   */
  private encryptPHI(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.REQUIRED_ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag().toString('hex');

    return `[ENC:${iv.toString('hex')}:${encrypted}:${authTag}]`;
  }

  /**
   * Validate Privacy Rule compliance
   */
  private async validatePrivacyRule(
    operation: any,
    violations: ComplianceViolation[],
    warnings: ComplianceWarning[]
  ): Promise<boolean> {
    let compliant = true;

    // Check consent for non-TPO uses
    if (!['treatment', 'payment', 'operations'].includes(operation.purpose.toLowerCase())) {
      const consentCheck = await this.checkConsent(
        operation.patientId,
        'disclosure',
        operation.userId
      );

      if (!consentCheck.hasConsent) {
        violations.push({
          rule: '45 CFR § 164.508',
          severity: 'critical',
          description: 'PHI disclosure requires patient authorization',
          remediation: 'Obtain valid patient consent before accessing PHI',
          potentialPenalty: '$50,000 per violation',
          mustReportToCMS: true,
        });
        compliant = false;
      }
    }

    // Check minimum necessary (Privacy Rule §164.502(b))
    if (operation.dataAccessed.length > 10) {
      warnings.push({
        category: 'Minimum Necessary',
        description: 'Large number of PHI fields accessed',
        recommendation: 'Review if all fields are necessary for stated purpose',
      });
    }

    return compliant;
  }

  /**
   * Validate Security Rule compliance
   */
  private validateSecurityRule(
    operation: any,
    violations: ComplianceViolation[],
    warnings: ComplianceWarning[]
  ): boolean {
    let compliant = true;

    // Administrative Safeguards (§164.308)
    if (!operation.userRole) {
      violations.push({
        rule: '45 CFR § 164.308(a)(3)',
        severity: 'major',
        description: 'User role not specified - violates workforce security requirements',
        remediation: 'Implement role-based access control (RBAC)',
        mustReportToCMS: false,
      });
      compliant = false;
    }

    // Technical Safeguards (§164.312)
    if (operation.encryptionEnabled === false) {
      violations.push({
        rule: '45 CFR § 164.312(a)(2)(iv)',
        severity: 'critical',
        description: 'Encryption not enabled for ePHI',
        remediation: 'Enable AES-256 encryption for all PHI at rest and TLS 1.2+ in transit',
        potentialPenalty: '$50,000 per violation',
        mustReportToCMS: true,
      });
      compliant = false;
    }

    return compliant;
  }

  /**
   * Validate Breach Notification compliance
   */
  private validateBreachNotification(
    violations: ComplianceViolation[],
    warnings: ComplianceWarning[]
  ): boolean {
    // Breach notification requirements (§164.404-414)
    // In production, check for:
    // - Breach detection mechanisms
    // - Notification procedures
    // - 60-day reporting timeline

    return true;
  }

  /**
   * Validate Minimum Necessary standard
   */
  private validateMinimumNecessary(
    operation: any,
    warnings: ComplianceWarning[],
    recommendations: string[]
  ): void {
    // §164.502(b) - minimum necessary standard
    if (operation.dataAccessed.includes('full_medical_record')) {
      warnings.push({
        category: 'Minimum Necessary',
        description: 'Full medical record accessed',
        recommendation: 'Access only specific fields required for the stated purpose',
      });
      recommendations.push(
        'Implement role-based data filtering to enforce minimum necessary principle'
      );
    }
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(
    violations: ComplianceViolation[],
    warnings: ComplianceWarning[],
    recommendations: string[]
  ): void {
    if (violations.length > 0) {
      recommendations.push('🚨 IMMEDIATE ACTION REQUIRED: Address critical violations');
    }

    if (warnings.some((w) => w.category === 'Minimum Necessary')) {
      recommendations.push('Implement granular access controls for PHI');
    }

    recommendations.push('Conduct regular HIPAA compliance audits (quarterly recommended)');
    recommendations.push('Provide annual HIPAA training to all workforce members');
  }

  /**
   * Calculate compliance risk level
   */
  private calculateComplianceRisk(
    violations: ComplianceViolation[],
    warnings: ComplianceWarning[]
  ): 'low' | 'moderate' | 'high' | 'critical' {
    const criticalViolations = violations.filter((v) => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      return 'critical';
    }

    const majorViolations = violations.filter((v) => v.severity === 'major');
    if (majorViolations.length > 0) {
      return 'high';
    }

    if (violations.length > 0 || warnings.length > 3) {
      return 'moderate';
    }

    return 'low';
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `AUDIT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate consent ID
   */
  private generateConsentId(): string {
    return `CONSENT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Trigger breach protocol
   */
  private triggerBreachProtocol(log: PHIAccessLog): void {
    // In production:
    // 1. Immediately notify security team
    // 2. Lock user account
    // 3. Begin breach investigation
    // 4. Prepare for potential OCR (Office for Civil Rights) reporting
    // 5. Document all actions taken

    logger.error('BREACH PROTOCOL TRIGGERED', {
      auditId: log.auditId,
      userId: log.userId,
      patientId: log.patientId,
      action: log.action,
    });
  }
}

// Export singleton instance
export const hipaaComplianceService = new HIPAAComplianceService();
