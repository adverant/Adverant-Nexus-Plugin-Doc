/**
 * Medical Safety Validator Service
 * Validates safety of AI-generated medical recommendations
 *
 * Features:
 * - Drug interaction conflict detection
 * - Contraindication checking
 * - Dose range validation
 * - Critical alert validation
 * - Clinical decision support safety checks
 * - Multi-layer safety validation
 *
 * Standards:
 * - FDA 21 CFR Part 11 (Electronic Records)
 * - HL7 Clinical Decision Support (CDS)
 * - AHRQ Patient Safety Standards
 */

import { createLogger } from '../../utils/logger';
import { drugSafetyService, DrugInteraction } from '../enrichment/drug-safety-service';

const logger = createLogger('MedicalSafetyValidator');

/**
 * Safety validation severity
 */
export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

/**
 * Medical recommendation to validate
 */
export interface MedicalRecommendation {
  recommendationType: 'diagnosis' | 'treatment' | 'medication' | 'procedure' | 'test' | 'referral';
  primaryRecommendation: string;
  medications?: MedicationRecommendation[];
  procedures?: ProcedureRecommendation[];
  tests?: TestRecommendation[];
  diagnosis?: DiagnosisRecommendation;
  patientContext: PatientContext;
  aiConfidence?: number;
  sources?: string[];
}

/**
 * Medication recommendation
 */
export interface MedicationRecommendation {
  drug: string;
  dose: number;
  doseUnit: string;
  frequency: string;
  route: 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'inhalation' | 'other';
  duration?: string;
  indication: string;
  priority?: 'immediate' | 'urgent' | 'routine';
}

/**
 * Procedure recommendation
 */
export interface ProcedureRecommendation {
  procedure: string;
  urgency: 'emergent' | 'urgent' | 'elective';
  indication: string;
  cptCode?: string;
}

/**
 * Test recommendation
 */
export interface TestRecommendation {
  test: string;
  urgency: 'stat' | 'urgent' | 'routine';
  indication: string;
}

/**
 * Diagnosis recommendation
 */
export interface DiagnosisRecommendation {
  condition: string;
  icd10Code?: string;
  confidence: number;
  differentials?: string[];
}

/**
 * Patient context for safety validation
 */
export interface PatientContext {
  age: number;
  weight?: number;
  sex: 'male' | 'female' | 'other';
  allergies: string[];
  currentMedications: string[];
  conditions: string[];
  renalFunction?: {
    creatinine: number;
    gfr: number; // Glomerular Filtration Rate
    stage?: 'normal' | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'stage_5';
  };
  hepaticFunction?: {
    alt: number;
    ast: number;
    bilirubin: number;
    status?: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  };
  pregnancy?: {
    status: boolean;
    trimester?: 1 | 2 | 3;
  };
  breastfeeding?: boolean;
}

/**
 * Safety validation result
 */
export interface SafetyValidationResult {
  safe: boolean;
  overallRisk: SafetySeverity;
  criticalAlerts: SafetyAlert[];
  warnings: SafetyAlert[];
  informational: SafetyAlert[];
  drugInteractionConflicts: DrugInteractionConflict[];
  contraindicationViolations: ContraindicationViolation[];
  doseRangeViolations: DoseRangeViolation[];
  recommendations: string[];
  requiresHumanReview: boolean;
  safetyScore: number; // 0-100, higher is safer
}

/**
 * Safety alert
 */
export interface SafetyAlert {
  severity: SafetySeverity;
  category: string;
  message: string;
  recommendation: string;
  source: string;
  mustInterrupt: boolean; // If true, must stop and get physician review
}

/**
 * Drug interaction conflict
 */
export interface DrugInteractionConflict {
  drug1: string;
  drug2: string;
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  description: string;
  clinicalEffect: string;
  recommendation: string;
  references: string[];
}

/**
 * Contraindication violation
 */
export interface ContraindicationViolation {
  drug: string;
  contraindication: string;
  reason: string;
  severity: 'absolute' | 'relative';
  alternatives: string[];
}

/**
 * Dose range violation
 */
export interface DoseRangeViolation {
  drug: string;
  recommendedDose: number;
  recommendedUnit: string;
  safeMinimum: number;
  safeMaximum: number;
  violationType: 'overdose' | 'underdose' | 'frequency_error';
  riskDescription: string;
  correctedDose: number;
}

/**
 * Medical Safety Validator Service
 */
export class MedicalSafetyValidatorService {
  // Drug dose ranges (mg unless specified)
  private dosageRanges: Map<string, { min: number; max: number; unit: string }>;

  // Absolute contraindications
  private absoluteContraindications: Map<string, string[]>;

  // Pregnancy category drugs (FDA categories)
  private pregnancyCategories: Map<string, 'A' | 'B' | 'C' | 'D' | 'X'>;

  constructor() {
    this.dosageRanges = new Map();
    this.absoluteContraindications = new Map();
    this.pregnancyCategories = new Map();

    this.initializeSafetyDatabase();

    logger.info('Medical Safety Validator initialized');
  }

  /**
   * Validate safety of medical recommendation
   */
  async validateRecommendation(
    recommendation: MedicalRecommendation
  ): Promise<SafetyValidationResult> {
    logger.info('Validating medical recommendation safety', {
      type: recommendation.recommendationType,
      hasMedications: (recommendation.medications?.length || 0) > 0,
    });

    const criticalAlerts: SafetyAlert[] = [];
    const warnings: SafetyAlert[] = [];
    const informational: SafetyAlert[] = [];
    const drugConflicts: DrugInteractionConflict[] = [];
    const contraindicationViolations: ContraindicationViolation[] = [];
    const doseViolations: DoseRangeViolation[] = [];
    const recommendations: string[] = [];

    // 1. Medication safety checks
    if (recommendation.medications && recommendation.medications.length > 0) {
      await this.validateMedicationSafety(
        recommendation.medications,
        recommendation.patientContext,
        criticalAlerts,
        warnings,
        drugConflicts,
        contraindicationViolations,
        doseViolations
      );
    }

    // 2. Procedure safety checks
    if (recommendation.procedures && recommendation.procedures.length > 0) {
      this.validateProcedureSafety(
        recommendation.procedures,
        recommendation.patientContext,
        criticalAlerts,
        warnings
      );
    }

    // 3. Diagnosis safety checks
    if (recommendation.diagnosis) {
      this.validateDiagnosisSafety(
        recommendation.diagnosis,
        recommendation.patientContext,
        warnings,
        informational
      );
    }

    // 4. AI confidence validation
    if (recommendation.aiConfidence !== undefined) {
      this.validateAIConfidence(
        recommendation.aiConfidence,
        recommendation.recommendationType,
        warnings,
        recommendations
      );
    }

    // 5. Special population checks
    this.validateSpecialPopulations(
      recommendation,
      criticalAlerts,
      warnings
    );

    // 6. Generate safety recommendations
    this.generateSafetyRecommendations(
      criticalAlerts,
      warnings,
      drugConflicts,
      contraindicationViolations,
      doseViolations,
      recommendations
    );

    // Calculate overall safety metrics
    const overallRisk = this.calculateOverallRisk(
      criticalAlerts,
      warnings,
      drugConflicts,
      contraindicationViolations,
      doseViolations
    );

    const safetyScore = this.calculateSafetyScore(
      criticalAlerts,
      warnings,
      informational,
      drugConflicts,
      contraindicationViolations,
      doseViolations
    );

    const requiresHumanReview = this.requiresHumanReview(
      criticalAlerts,
      overallRisk,
      recommendation.aiConfidence
    );

    const result: SafetyValidationResult = {
      safe: criticalAlerts.length === 0 && contraindicationViolations.filter(v => v.severity === 'absolute').length === 0,
      overallRisk,
      criticalAlerts,
      warnings,
      informational,
      drugInteractionConflicts: drugConflicts,
      contraindicationViolations,
      doseRangeViolations: doseViolations,
      recommendations,
      requiresHumanReview,
      safetyScore,
    };

    logger.info('Safety validation complete', {
      safe: result.safe,
      overallRisk,
      criticalAlerts: criticalAlerts.length,
      warnings: warnings.length,
      safetyScore,
      requiresHumanReview,
    });

    return result;
  }

  /**
   * Check safety constraints for clinical decision
   */
  async checkSafetyConstraints(
    decision: {
      type: string;
      details: string;
      targetPatient: PatientContext;
      urgency: 'emergent' | 'urgent' | 'routine';
    }
  ): Promise<{ constraintsViolated: string[]; safe: boolean }> {
    const constraintsViolated: string[] = [];

    // Age constraints
    if (decision.targetPatient.age < 18) {
      constraintsViolated.push('Pediatric patient - requires pediatric specialist review');
    }

    if (decision.targetPatient.age > 75) {
      constraintsViolated.push('Geriatric patient - review for polypharmacy and age-appropriate dosing');
    }

    // Pregnancy constraints
    if (decision.targetPatient.pregnancy?.status) {
      constraintsViolated.push('Pregnant patient - all recommendations must be reviewed for fetal safety');
    }

    // Renal function constraints
    if (decision.targetPatient.renalFunction?.stage &&
        ['stage_4', 'stage_5'].includes(decision.targetPatient.renalFunction.stage)) {
      constraintsViolated.push('Severe renal impairment - dose adjustments required for all medications');
    }

    // Multiple allergies constraint
    if (decision.targetPatient.allergies.length > 5) {
      constraintsViolated.push('Multiple drug allergies - enhanced allergy checking required');
    }

    return {
      constraintsViolated,
      safe: constraintsViolated.length === 0,
    };
  }

  /**
   * Flag critical alerts that require immediate attention
   */
  flagCriticalAlerts(validationResult: SafetyValidationResult): {
    hasCritical: boolean;
    mustStop: boolean;
    criticalSummary: string[];
  } {
    const mustStopAlerts = validationResult.criticalAlerts.filter((a) => a.mustInterrupt);
    const absoluteContraindications = validationResult.contraindicationViolations.filter(
      (v) => v.severity === 'absolute'
    );

    const criticalSummary: string[] = [];

    mustStopAlerts.forEach((alert) => {
      criticalSummary.push(`🚨 ${alert.category}: ${alert.message}`);
    });

    absoluteContraindications.forEach((contra) => {
      criticalSummary.push(`🚨 CONTRAINDICATION: ${contra.drug} - ${contra.reason}`);
    });

    validationResult.drugInteractionConflicts
      .filter((c) => c.severity === 'critical')
      .forEach((conflict) => {
        criticalSummary.push(`🚨 CRITICAL INTERACTION: ${conflict.drug1} + ${conflict.drug2} - ${conflict.description}`);
      });

    return {
      hasCritical: validationResult.criticalAlerts.length > 0,
      mustStop: mustStopAlerts.length > 0 || absoluteContraindications.length > 0,
      criticalSummary,
    };
  }

  /**
   * Validate medication safety
   */
  private async validateMedicationSafety(
    medications: MedicationRecommendation[],
    patient: PatientContext,
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[],
    drugConflicts: DrugInteractionConflict[],
    contraindicationViolations: ContraindicationViolation[],
    doseViolations: DoseRangeViolation[]
  ): Promise<void> {
    // Check each medication
    for (const med of medications) {
      // 1. Dose range validation
      const doseViolation = this.checkDoseRange(med, patient);
      if (doseViolation) {
        doseViolations.push(doseViolation);

        if (doseViolation.violationType === 'overdose') {
          criticalAlerts.push({
            severity: 'critical',
            category: 'Overdose Risk',
            message: `${med.drug} dose ${med.dose}${med.doseUnit} exceeds safe maximum`,
            recommendation: `Reduce dose to ${doseViolation.correctedDose}${med.doseUnit} or less`,
            source: 'Dosage Database',
            mustInterrupt: true,
          });
        }
      }

      // 2. Allergy check
      const allergyMatch = patient.allergies.find((allergy) =>
        med.drug.toLowerCase().includes(allergy.toLowerCase())
      );

      if (allergyMatch) {
        criticalAlerts.push({
          severity: 'critical',
          category: 'Allergy Alert',
          message: `Patient allergic to ${allergyMatch}, prescribed ${med.drug}`,
          recommendation: 'DO NOT ADMINISTER - Find alternative medication',
          source: 'Patient Allergy Record',
          mustInterrupt: true,
        });

        contraindicationViolations.push({
          drug: med.drug,
          contraindication: `Allergy to ${allergyMatch}`,
          reason: 'Patient has documented allergy',
          severity: 'absolute',
          alternatives: this.findAlternativeMedications(med.drug),
        });
      }

      // 3. Contraindication check
      const contraindications = this.checkContraindications(med.drug, patient);
      contraindicationViolations.push(...contraindications);

      // 4. Pregnancy safety
      if (patient.pregnancy?.status) {
        const pregnancyCategory = this.pregnancyCategories.get(med.drug.toLowerCase());
        if (pregnancyCategory === 'X') {
          criticalAlerts.push({
            severity: 'critical',
            category: 'Pregnancy Category X',
            message: `${med.drug} is contraindicated in pregnancy`,
            recommendation: 'DO NOT PRESCRIBE - Find pregnancy-safe alternative',
            source: 'FDA Pregnancy Categories',
            mustInterrupt: true,
          });
        } else if (pregnancyCategory === 'D') {
          warnings.push({
            severity: 'high',
            category: 'Pregnancy Category D',
            message: `${med.drug} may cause fetal harm`,
            recommendation: 'Use only if benefit outweighs risk - obtain OB consult',
            source: 'FDA Pregnancy Categories',
            mustInterrupt: false,
          });
        }
      }
    }

    // 5. Drug interaction check (all pairs)
    const allMedications = [...patient.currentMedications, ...medications.map(m => m.drug)];

    try {
      const safetyReport = await drugSafetyService.checkInteractions({
        medications: allMedications,
        allergies: patient.allergies,
        conditions: patient.conditions,
        age: patient.age,
        weight: patient.weight,
        renalFunction: patient.renalFunction?.stage,
        hepaticFunction: patient.hepaticFunction?.status,
      });

      // Convert to drug interaction conflicts
      safetyReport.drugInteractions.forEach((interaction) => {
        drugConflicts.push({
          drug1: interaction.drug1,
          drug2: interaction.drug2,
          severity: interaction.severity,
          description: interaction.description,
          clinicalEffect: interaction.clinicalEffects.join(', '),
          recommendation: interaction.recommendations.join('; '),
          references: interaction.references,
        });

        // Add critical alert for critical interactions
        if (interaction.severity === 'critical') {
          criticalAlerts.push({
            severity: 'critical',
            category: 'Drug Interaction',
            message: `Critical interaction: ${interaction.drug1} + ${interaction.drug2}`,
            recommendation: interaction.recommendations[0] || 'Review medication regimen',
            source: 'Drug Safety Service',
            mustInterrupt: true,
          });
        }
      });
    } catch (error: any) {
      logger.warn('Drug interaction check failed:', error);
      warnings.push({
        severity: 'medium',
        category: 'Safety Check Incomplete',
        message: 'Unable to complete comprehensive drug interaction check',
        recommendation: 'Perform manual drug interaction review',
        source: 'System',
        mustInterrupt: false,
      });
    }
  }

  /**
   * Validate procedure safety
   */
  private validateProcedureSafety(
    procedures: ProcedureRecommendation[],
    patient: PatientContext,
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[]
  ): void {
    procedures.forEach((proc) => {
      // Check age appropriateness
      if (patient.age > 80 && proc.urgency === 'elective') {
        warnings.push({
          severity: 'medium',
          category: 'Geriatric Procedure Risk',
          message: `Elective ${proc.procedure} in 80+ patient`,
          recommendation: 'Assess surgical risk score (e.g., ASA classification)',
          source: 'Geriatric Surgery Guidelines',
          mustInterrupt: false,
        });
      }

      // Pregnancy considerations
      if (patient.pregnancy?.status && proc.procedure.toLowerCase().includes('radiation')) {
        criticalAlerts.push({
          severity: 'critical',
          category: 'Radiation in Pregnancy',
          message: `Radiation-based procedure recommended for pregnant patient`,
          recommendation: 'Avoid radiation procedures - use ultrasound or MRI alternatives',
          source: 'Radiation Safety Guidelines',
          mustInterrupt: true,
        });
      }
    });
  }

  /**
   * Validate diagnosis safety
   */
  private validateDiagnosisSafety(
    diagnosis: DiagnosisRecommendation,
    patient: PatientContext,
    warnings: SafetyAlert[],
    informational: SafetyAlert[]
  ): void {
    // Low confidence diagnosis warning
    if (diagnosis.confidence < 0.6) {
      warnings.push({
        severity: 'medium',
        category: 'Low Diagnostic Confidence',
        message: `Diagnosis "${diagnosis.condition}" has low confidence (${(diagnosis.confidence * 100).toFixed(0)}%)`,
        recommendation: 'Consider additional testing and specialist consultation',
        source: 'AI Confidence Analysis',
        mustInterrupt: false,
      });
    }

    // Rare disease consideration
    const rareKeywords = ['rare', 'orphan', 'syndrome'];
    if (rareKeywords.some(kw => diagnosis.condition.toLowerCase().includes(kw))) {
      informational.push({
        severity: 'informational',
        category: 'Rare Disease',
        message: `Potential rare disease diagnosis: ${diagnosis.condition}`,
        recommendation: 'Consider genetics consult and specialized testing',
        source: 'Rare Disease Database',
        mustInterrupt: false,
      });
    }
  }

  /**
   * Validate AI confidence level
   */
  private validateAIConfidence(
    confidence: number,
    recommendationType: string,
    warnings: SafetyAlert[],
    recommendations: string[]
  ): void {
    // Critical decisions require high confidence
    const criticalTypes = ['medication', 'procedure', 'diagnosis'];

    if (criticalTypes.includes(recommendationType) && confidence < 0.7) {
      warnings.push({
        severity: 'high',
        category: 'Low AI Confidence',
        message: `AI confidence only ${(confidence * 100).toFixed(0)}% for ${recommendationType} recommendation`,
        recommendation: 'Require physician review before implementation',
        source: 'AI Safety Standards',
        mustInterrupt: false,
      });

      recommendations.push('⚠️ Low AI confidence - human physician review mandatory');
    }
  }

  /**
   * Validate special populations
   */
  private validateSpecialPopulations(
    recommendation: MedicalRecommendation,
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[]
  ): void {
    const patient = recommendation.patientContext;

    // Pediatric
    if (patient.age < 18) {
      warnings.push({
        severity: 'high',
        category: 'Pediatric Patient',
        message: 'Patient is pediatric - requires pediatric dosing and specialist review',
        recommendation: 'Verify all recommendations with pediatric specialist',
        source: 'Pediatric Safety Standards',
        mustInterrupt: false,
      });
    }

    // Severe renal impairment
    if (patient.renalFunction?.stage && ['stage_4', 'stage_5'].includes(patient.renalFunction.stage)) {
      warnings.push({
        severity: 'high',
        category: 'Severe Renal Impairment',
        message: 'Patient has severe renal impairment - all medications need dose adjustment',
        recommendation: 'Review all doses with nephrology and clinical pharmacist',
        source: 'Renal Dosing Guidelines',
        mustInterrupt: false,
      });
    }
  }

  /**
   * Check dose range
   */
  private checkDoseRange(
    med: MedicationRecommendation,
    patient: PatientContext
  ): DoseRangeViolation | null {
    const safeRange = this.dosageRanges.get(med.drug.toLowerCase());

    if (!safeRange) {
      return null; // No data available
    }

    if (med.doseUnit !== safeRange.unit) {
      return null; // Unit mismatch, can't compare
    }

    if (med.dose > safeRange.max) {
      return {
        drug: med.drug,
        recommendedDose: med.dose,
        recommendedUnit: med.doseUnit,
        safeMinimum: safeRange.min,
        safeMaximum: safeRange.max,
        violationType: 'overdose',
        riskDescription: `Dose exceeds maximum safe dose by ${((med.dose / safeRange.max - 1) * 100).toFixed(0)}%`,
        correctedDose: safeRange.max,
      };
    }

    if (med.dose < safeRange.min) {
      return {
        drug: med.drug,
        recommendedDose: med.dose,
        recommendedUnit: med.doseUnit,
        safeMinimum: safeRange.min,
        safeMaximum: safeRange.max,
        violationType: 'underdose',
        riskDescription: 'Dose below therapeutic minimum - may be ineffective',
        correctedDose: safeRange.min,
      };
    }

    return null;
  }

  /**
   * Check contraindications
   */
  private checkContraindications(
    drug: string,
    patient: PatientContext
  ): ContraindicationViolation[] {
    const violations: ContraindicationViolation[] = [];
    const contraList = this.absoluteContraindications.get(drug.toLowerCase()) || [];

    patient.conditions.forEach((condition) => {
      if (contraList.includes(condition.toLowerCase())) {
        violations.push({
          drug,
          contraindication: condition,
          reason: `${drug} is contraindicated in patients with ${condition}`,
          severity: 'absolute',
          alternatives: this.findAlternativeMedications(drug),
        });
      }
    });

    return violations;
  }

  /**
   * Find alternative medications
   */
  private findAlternativeMedications(drug: string): string[] {
    // In production, query drug database for therapeutic equivalents
    return ['Consult clinical pharmacist for alternatives'];
  }

  /**
   * Generate safety recommendations
   */
  private generateSafetyRecommendations(
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[],
    drugConflicts: DrugInteractionConflict[],
    contraindicationViolations: ContraindicationViolation[],
    doseViolations: DoseRangeViolation[],
    recommendations: string[]
  ): void {
    if (criticalAlerts.length > 0) {
      recommendations.push('🚨 CRITICAL SAFETY ISSUES - DO NOT PROCEED WITHOUT PHYSICIAN REVIEW');
    }

    if (contraindicationViolations.some(v => v.severity === 'absolute')) {
      recommendations.push('⚠️ Absolute contraindications detected - medications must be changed');
    }

    if (doseViolations.some(v => v.violationType === 'overdose')) {
      recommendations.push('⚠️ Overdose risk detected - reduce doses before administering');
    }

    if (drugConflicts.filter(c => c.severity === 'critical').length > 0) {
      recommendations.push('⚠️ Critical drug interactions - modify medication regimen');
    }

    if (warnings.length > 3) {
      recommendations.push('Multiple safety warnings detected - comprehensive review recommended');
    }

    recommendations.push('All AI recommendations must be reviewed by licensed physician before implementation');
  }

  /**
   * Calculate overall risk
   */
  private calculateOverallRisk(
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[],
    drugConflicts: DrugInteractionConflict[],
    contraindicationViolations: ContraindicationViolation[],
    doseViolations: DoseRangeViolation[]
  ): SafetySeverity {
    if (
      criticalAlerts.length > 0 ||
      contraindicationViolations.some(v => v.severity === 'absolute') ||
      doseViolations.some(v => v.violationType === 'overdose')
    ) {
      return 'critical';
    }

    const highSeverityWarnings = warnings.filter(w => w.severity === 'high').length;
    const criticalInteractions = drugConflicts.filter(c => c.severity === 'critical').length;

    if (highSeverityWarnings > 0 || criticalInteractions > 0) {
      return 'high';
    }

    if (warnings.length > 2 || drugConflicts.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate safety score (0-100)
   */
  private calculateSafetyScore(
    criticalAlerts: SafetyAlert[],
    warnings: SafetyAlert[],
    informational: SafetyAlert[],
    drugConflicts: DrugInteractionConflict[],
    contraindicationViolations: ContraindicationViolation[],
    doseViolations: DoseRangeViolation[]
  ): number {
    let score = 100;

    // Penalties
    score -= criticalAlerts.length * 25;
    score -= contraindicationViolations.filter(v => v.severity === 'absolute').length * 25;
    score -= doseViolations.filter(v => v.violationType === 'overdose').length * 20;
    score -= drugConflicts.filter(c => c.severity === 'critical').length * 15;
    score -= warnings.filter(w => w.severity === 'high').length * 10;
    score -= warnings.filter(w => w.severity === 'medium').length * 5;
    score -= drugConflicts.filter(c => c.severity === 'major').length * 5;

    return Math.max(0, score);
  }

  /**
   * Determine if human review required
   */
  private requiresHumanReview(
    criticalAlerts: SafetyAlert[],
    overallRisk: SafetySeverity,
    aiConfidence?: number
  ): boolean {
    // Always require review for critical issues
    if (criticalAlerts.length > 0 || overallRisk === 'critical') {
      return true;
    }

    // Require review for low AI confidence
    if (aiConfidence !== undefined && aiConfidence < 0.7) {
      return true;
    }

    // Require review for high risk
    if (overallRisk === 'high') {
      return true;
    }

    return false;
  }

  /**
   * Initialize safety database
   */
  private initializeSafetyDatabase(): void {
    // Common medication dosage ranges
    this.dosageRanges.set('metformin', { min: 500, max: 2000, unit: 'mg' });
    this.dosageRanges.set('lisinopril', { min: 2.5, max: 40, unit: 'mg' });
    this.dosageRanges.set('atorvastatin', { min: 10, max: 80, unit: 'mg' });
    this.dosageRanges.set('warfarin', { min: 1, max: 10, unit: 'mg' });

    // Absolute contraindications
    this.absoluteContraindications.set('metformin', ['severe renal impairment', 'lactic acidosis']);
    this.absoluteContraindications.set('ibuprofen', ['peptic ulcer', 'severe heart failure']);

    // Pregnancy categories
    this.pregnancyCategories.set('warfarin', 'X');
    this.pregnancyCategories.set('methotrexate', 'X');
    this.pregnancyCategories.set('lisinopril', 'D');
    this.pregnancyCategories.set('metformin', 'B');

    logger.info('Safety database initialized', {
      dosageRanges: this.dosageRanges.size,
      contraindications: this.absoluteContraindications.size,
      pregnancyCategories: this.pregnancyCategories.size,
    });
  }
}

// Export singleton instance
export const medicalSafetyValidator = new MedicalSafetyValidatorService();
