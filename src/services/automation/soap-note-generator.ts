/**
 * SOAP Note Generator Service
 * Automated medical documentation using Google MedLM
 * - <5 second SOAP note generation (MedLM optimized)
 * - FHIR R4 conversion for interoperability
 * - Integration with consultation results
 * - Multiple output formats (EHR-specific)
 */

import { createLogger } from '../../utils/logger';
import { googleMedLMService, SOAPNoteRequest, SOAPNote } from '../google-medlm/medlm-service';
import { ConsultationResult } from '../consultation-orchestration-service';

const logger = createLogger('SOAPNoteGenerator');

/**
 * Consultation-to-SOAP request
 */
export interface ConsultationSOAPRequest {
  consultationResult: ConsultationResult;
  patientId: string;
  patientDemographics?: {
    age: number;
    sex: 'M' | 'F';
    mrn?: string;
  };
  clinicianNotes?: string;
  format?: 'standard' | 'detailed' | 'concise';
  targetEHR?: 'epic' | 'cerner' | 'fhir_r4' | 'generic';
}

/**
 * Structured clinical findings
 */
export interface StructuredFindings {
  subjective: {
    chiefComplaint: string;
    symptoms: string[];
    historyOfPresentIllness: string;
    reviewOfSystems: string[];
  };
  objective: {
    vitals: Record<string, any>;
    physicalExam: string[];
    labResults: Record<string, any>;
    imagingResults: string[];
    diagnosticTests: string[];
  };
  assessment: {
    primaryDiagnosis: {
      condition: string;
      icd10Code: string;
      confidence: number;
    };
    differentialDiagnoses: Array<{
      condition: string;
      icd10Code?: string;
      probability: number;
    }>;
    riskFactors: string[];
    prognosis: string;
  };
  plan: {
    medications: Array<{
      name: string;
      dose: string;
      frequency: string;
      route: string;
      duration: string;
    }>;
    procedures: string[];
    labOrders: string[];
    imagingOrders: string[];
    referrals: string[];
    followUp: {
      timeframe: string;
      instructions: string;
    };
    patientEducation: string[];
    preventiveCare: string[];
  };
}

/**
 * SOAP note with metadata
 */
export interface GeneratedSOAPNote extends SOAPNote {
  consultationId: string;
  patientId: string;
  structuredFindings: StructuredFindings;
  billableCodes?: {
    icd10: string[];
    cpt: string[];
    drg?: string;
  };
  qualityMetrics?: {
    completeness: number; // 0.0-1.0
    clinicalAccuracy: number;
    complianceScore: number;
  };
}

/**
 * SOAP Note Generator Service Class
 */
export class SOAPNoteGenerator {
  constructor() {
    logger.info('SOAP Note Generator initialized');
  }

  /**
   * Generate SOAP note from consultation results
   * Target: <5 seconds generation time (MedLM optimized)
   */
  async generateFromConsultation(
    request: ConsultationSOAPRequest
  ): Promise<GeneratedSOAPNote> {
    const startTime = Date.now();

    try {
      logger.info('Generating SOAP note from consultation', {
        consultationId: request.consultationResult.consultation_id,
        patientId: request.patientId,
        format: request.format || 'standard',
      });

      // Step 1: Structure findings from consultation
      const structuredFindings = this.structureFindings(
        request.consultationResult,
        request.clinicianNotes
      );

      // Step 2: Build SOAP note request for MedLM
      const soapRequest = this.buildSOAPRequest(
        structuredFindings,
        request.patientDemographics,
        request.format,
        request.targetEHR
      );

      // Step 3: Generate SOAP note using MedLM (<5s target)
      const soapNote = await googleMedLMService.generateSOAPNote(soapRequest);

      // Step 4: Extract billable codes
      const billableCodes = this.extractBillableCodes(structuredFindings);

      // Step 5: Calculate quality metrics
      const qualityMetrics = this.assessQualityMetrics(soapNote, structuredFindings);

      // Step 6: Assemble final result
      const generatedNote: GeneratedSOAPNote = {
        ...soapNote,
        consultationId: request.consultationResult.consultation_id,
        patientId: request.patientId,
        structuredFindings,
        billableCodes,
        qualityMetrics,
      };

      const generationTime = Date.now() - startTime;

      logger.info('SOAP note generation complete', {
        consultationId: request.consultationResult.consultation_id,
        wordCount: soapNote.metadata.wordCount,
        generationTime: `${generationTime}ms`,
        targetMet: generationTime < 5000,
        qualityScore: qualityMetrics.completeness.toFixed(2),
      });

      return generatedNote;
    } catch (error: any) {
      logger.error('Failed to generate SOAP note:', error);
      throw new Error(`SOAP note generation failed: ${error.message}`);
    }
  }

  /**
   * Generate quick SOAP note (concise format, <3s target)
   */
  async generateQuickNote(
    consultationResult: ConsultationResult,
    patientId: string
  ): Promise<GeneratedSOAPNote> {
    return this.generateFromConsultation({
      consultationResult,
      patientId,
      format: 'concise',
      targetEHR: 'generic',
    });
  }

  /**
   * Structure clinical findings from consultation results
   */
  structureFindings(
    consultation: ConsultationResult,
    clinicianNotes?: string
  ): StructuredFindings {
    logger.debug('Structuring clinical findings from consultation', {
      consultationId: consultation.consultation_id,
    });

    // Extract subjective data
    const subjective = this.extractSubjectiveData(consultation, clinicianNotes);

    // Extract objective data
    const objective = this.extractObjectiveData(consultation);

    // Extract assessment data
    const assessment = this.extractAssessmentData(consultation);

    // Extract plan data
    const plan = this.extractPlanData(consultation);

    return {
      subjective,
      objective,
      assessment,
      plan,
    };
  }

  /**
   * Convert SOAP note to FHIR R4 format
   */
  convertToFHIR(soapNote: GeneratedSOAPNote): any {
    logger.debug('Converting SOAP note to FHIR R4', {
      consultationId: soapNote.consultationId,
    });

    // Build comprehensive FHIR R4 DiagnosticReport
    return {
      resourceType: 'DiagnosticReport',
      id: soapNote.consultationId,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note',
          },
        ],
        text: 'Clinical Progress Note',
      },
      subject: {
        reference: `Patient/${soapNote.patientId}`,
      },
      effectiveDateTime: soapNote.createdAt.toISOString(),
      issued: soapNote.createdAt.toISOString(),
      conclusion: soapNote.text,
      conclusionCode: soapNote.billableCodes?.icd10.map((code) => ({
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code,
            display: this.getICD10Display(code),
          },
        ],
      })),
      presentedForm: [
        {
          contentType: 'text/plain',
          language: 'en-US',
          data: Buffer.from(soapNote.text).toString('base64'),
          title: 'SOAP Note',
        },
      ],
    };
  }

  /**
   * Extract subjective data from consultation
   */
  private extractSubjectiveData(
    consultation: ConsultationResult,
    clinicianNotes?: string
  ): StructuredFindings['subjective'] {
    // Extract from individual agent analyses
    const symptoms: string[] = [];
    const reviewOfSystems: string[] = [];

    consultation.individual_analyses.forEach((analysis) => {
      if (analysis.findings) {
        symptoms.push(...analysis.findings);
      }
    });

    // Build HPI from consensus
    const hpi = this.buildHistoryOfPresentIllness(consultation, clinicianNotes);

    return {
      chiefComplaint: consultation.consensus.primaryDiagnosis.condition,
      symptoms: [...new Set(symptoms)], // Deduplicate
      historyOfPresentIllness: hpi,
      reviewOfSystems,
    };
  }

  /**
   * Extract objective data from consultation
   */
  private extractObjectiveData(
    consultation: ConsultationResult
  ): StructuredFindings['objective'] {
    const vitals: Record<string, any> = {};
    const physicalExam: string[] = [];
    const labResults: Record<string, any> = {};
    const imagingResults: string[] = [];
    const diagnosticTests: string[] = [];

    // Extract from agent findings
    consultation.individual_analyses.forEach((analysis) => {
      if (analysis.findings) {
        physicalExam.push(...analysis.findings);
      }
    });

    return {
      vitals,
      physicalExam: [...new Set(physicalExam)],
      labResults,
      imagingResults,
      diagnosticTests,
    };
  }

  /**
   * Extract assessment data from consultation
   */
  private extractAssessmentData(
    consultation: ConsultationResult
  ): StructuredFindings['assessment'] {
    const primaryDiagnosis = {
      condition: consultation.consensus.primaryDiagnosis.condition,
      icd10Code: consultation.consensus.primaryDiagnosis.icd10Code || 'TBD',
      confidence: consultation.consensus.primaryDiagnosis.confidence,
    };

    const differentialDiagnoses = consultation.consensus.differentialDiagnoses.map(
      (diff: any) => ({
        condition: diff.condition,
        icd10Code: diff.icd10Code,
        probability: diff.confidence,
      })
    );

    // Extract risk factors from agent analyses
    const riskFactors: string[] = [];
    consultation.individual_analyses.forEach((analysis) => {
      if (analysis.concerns) {
        riskFactors.push(...analysis.concerns);
      }
    });

    const prognosis = this.determinePrognosis(consultation);

    return {
      primaryDiagnosis,
      differentialDiagnoses,
      riskFactors: [...new Set(riskFactors)],
      prognosis,
    };
  }

  /**
   * Extract plan data from consultation
   */
  private extractPlanData(
    consultation: ConsultationResult
  ): StructuredFindings['plan'] {
    const medications: StructuredFindings['plan']['medications'] = [];
    const procedures: string[] = [];
    const labOrders: string[] = [];
    const imagingOrders: string[] = [];
    const referrals: string[] = [];
    const patientEducation: string[] = [];
    const preventiveCare: string[] = [];

    // Extract from recommendations
    consultation.consensus.recommendations.forEach((rec: any) => {
      switch (rec.type) {
        case 'medication':
          // Parse medication recommendation
          const med = this.parseMedicationRecommendation(rec.recommendation);
          if (med) medications.push(med);
          break;
        case 'procedure':
          procedures.push(rec.recommendation);
          break;
        case 'lab':
          labOrders.push(rec.recommendation);
          break;
        case 'imaging':
          imagingOrders.push(rec.recommendation);
          break;
        case 'referral':
          referrals.push(rec.recommendation);
          break;
        case 'education':
          patientEducation.push(rec.recommendation);
          break;
        case 'preventive':
          preventiveCare.push(rec.recommendation);
          break;
      }
    });

    return {
      medications,
      procedures,
      labOrders,
      imagingOrders,
      referrals,
      followUp: {
        timeframe: this.determineFollowUpTimeframe(consultation),
        instructions: 'Follow up with primary care provider',
      },
      patientEducation,
      preventiveCare,
    };
  }

  /**
   * Build SOAP request for MedLM
   */
  private buildSOAPRequest(
    findings: StructuredFindings,
    demographics?: ConsultationSOAPRequest['patientDemographics'],
    format?: string,
    targetEHR?: string
  ): SOAPNoteRequest {
    return {
      subjective: {
        chiefComplaint: findings.subjective.chiefComplaint,
        historyOfPresentIllness: findings.subjective.historyOfPresentIllness,
        symptoms: findings.subjective.symptoms,
        patientNarrative: demographics
          ? `${demographics.age} year old ${demographics.sex === 'M' ? 'male' : 'female'}`
          : undefined,
      },
      objective: {
        vitals: findings.objective.vitals,
        physicalExam: findings.objective.physicalExam.join('\n'),
        labs: findings.objective.labResults,
        imaging: {
          results: findings.objective.imagingResults,
        },
      },
      assessment: {
        primaryDiagnosis: findings.assessment.primaryDiagnosis.condition,
        icd10Code: findings.assessment.primaryDiagnosis.icd10Code,
        differentialDiagnoses: findings.assessment.differentialDiagnoses.map(
          (d) => d.condition
        ),
      },
      plan: {
        medications: findings.plan.medications.map(
          (m) => `${m.name} ${m.dose} ${m.frequency}`
        ),
        procedures: findings.plan.procedures,
        followUp: findings.plan.followUp.instructions,
        patientEducation: findings.plan.patientEducation.join('\n'),
        recommendations: [
          ...findings.plan.labOrders,
          ...findings.plan.imagingOrders,
          ...findings.plan.referrals,
        ],
      },
      format: format as any,
      targetEHR: targetEHR as any,
    };
  }

  /**
   * Extract billable codes from structured findings
   */
  private extractBillableCodes(findings: StructuredFindings): GeneratedSOAPNote['billableCodes'] {
    // ICD-10 codes
    const icd10: string[] = [findings.assessment.primaryDiagnosis.icd10Code];

    findings.assessment.differentialDiagnoses.forEach((diff) => {
      if (diff.icd10Code) {
        icd10.push(diff.icd10Code);
      }
    });

    // CPT codes (would be mapped from procedures)
    const cpt: string[] = [];
    findings.plan.procedures.forEach((proc) => {
      const code = this.mapProcedureToCPT(proc);
      if (code) cpt.push(code);
    });

    return {
      icd10: [...new Set(icd10)], // Deduplicate
      cpt: [...new Set(cpt)],
      drg: undefined, // Would be calculated based on diagnosis and procedures
    };
  }

  /**
   * Assess quality metrics for generated note
   */
  private assessQualityMetrics(
    note: SOAPNote,
    findings: StructuredFindings
  ): GeneratedSOAPNote['qualityMetrics'] {
    // Completeness: Check if all sections are populated
    let completeness = 0.0;
    if (note.structuredData.subjective) completeness += 0.25;
    if (note.structuredData.objective) completeness += 0.25;
    if (note.structuredData.assessment) completeness += 0.25;
    if (note.structuredData.plan) completeness += 0.25;

    // Clinical accuracy: Based on structured findings presence
    let clinicalAccuracy = 0.8; // Default high (MedLM trained)
    if (findings.assessment.primaryDiagnosis.confidence > 0.8) clinicalAccuracy = 0.95;

    // Compliance: Check required elements
    let complianceScore = 1.0;
    if (!findings.assessment.primaryDiagnosis.icd10Code) complianceScore -= 0.2;
    if (findings.plan.medications.length === 0 && findings.plan.procedures.length === 0) {
      complianceScore -= 0.1;
    }

    return {
      completeness,
      clinicalAccuracy,
      complianceScore: Math.max(0, complianceScore),
    };
  }

  /**
   * Helper: Build history of present illness
   */
  private buildHistoryOfPresentIllness(
    consultation: ConsultationResult,
    clinicianNotes?: string
  ): string {
    const parts: string[] = [];

    if (clinicianNotes) {
      parts.push(clinicianNotes);
    }

    parts.push(
      `Patient presents with ${consultation.consensus.primaryDiagnosis.condition}.`
    );

    // Add key findings from agents
    consultation.individual_analyses.slice(0, 2).forEach((analysis) => {
      if (analysis.findings && analysis.findings.length > 0) {
        parts.push(analysis.findings[0]);
      }
    });

    return parts.join(' ');
  }

  /**
   * Helper: Determine prognosis
   */
  private determinePrognosis(consultation: ConsultationResult): string {
    const confidence = consultation.consensus.primaryDiagnosis.confidence;

    if (confidence > 0.8) {
      return 'Good prognosis with appropriate treatment';
    } else if (confidence > 0.6) {
      return 'Fair prognosis, requires close monitoring';
    } else {
      return 'Guarded prognosis, further evaluation needed';
    }
  }

  /**
   * Helper: Parse medication recommendation
   */
  private parseMedicationRecommendation(
    recommendation: string
  ): StructuredFindings['plan']['medications'][0] | null {
    // Simple parsing - would use NLP in production
    return {
      name: recommendation,
      dose: 'As directed',
      frequency: 'As directed',
      route: 'PO',
      duration: 'As needed',
    };
  }

  /**
   * Helper: Determine follow-up timeframe
   */
  private determineFollowUpTimeframe(consultation: ConsultationResult): string {
    const confidence = consultation.consensus.primaryDiagnosis.confidence;

    if (confidence < 0.6) {
      return '1-2 weeks';
    } else if (confidence < 0.8) {
      return '2-4 weeks';
    } else {
      return '4-6 weeks or as needed';
    }
  }

  /**
   * Helper: Map procedure to CPT code
   */
  private mapProcedureToCPT(procedure: string): string | null {
    // Simplified mapping - would use comprehensive CPT database
    const procedureLower = procedure.toLowerCase();

    if (procedureLower.includes('x-ray')) return '71045';
    if (procedureLower.includes('ct scan')) return '71250';
    if (procedureLower.includes('mri')) return '71550';
    if (procedureLower.includes('ultrasound')) return '76700';
    if (procedureLower.includes('ekg') || procedureLower.includes('ecg')) return '93000';

    return null;
  }

  /**
   * Helper: Get ICD-10 display name
   */
  private getICD10Display(code: string): string {
    // Would use ICD-10 lookup table in production
    return `ICD-10 ${code}`;
  }
}

// Export singleton instance
export const soapNoteGenerator = new SOAPNoteGenerator();
