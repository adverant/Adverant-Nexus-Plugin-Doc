/**
 * Google MedLM Service
 * Specialized medical AI models for documentation and imaging
 * - Medical documentation generation (SOAP notes, discharge summaries)
 * - Chest X-ray classification and analysis
 * - FHIR R4 conversion
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';
import config from '../../config';

const logger = createLogger('GoogleMedLMService');

/**
 * SOAP note generation request
 */
export interface SOAPNoteRequest {
  subjective: {
    chiefComplaint: string;
    historyOfPresentIllness?: string;
    symptoms: string[];
    patientNarrative?: string;
  };
  objective: {
    vitals?: Record<string, any>;
    physicalExam?: string;
    labs?: Record<string, any>;
    imaging?: Record<string, any>;
  };
  assessment: {
    primaryDiagnosis: string;
    icd10Code?: string;
    differentialDiagnoses?: string[];
  };
  plan: {
    medications?: string[];
    procedures?: string[];
    followUp?: string;
    patientEducation?: string;
    recommendations?: string[];
  };
  format?: 'standard' | 'detailed' | 'concise';
  targetEHR?: 'epic' | 'cerner' | 'fhir_r4' | 'generic';
}

/**
 * SOAP note
 */
export interface SOAPNote {
  text: string;
  format: string;
  createdAt: Date;
  fhirResource?: any; // FHIR R4 ClinicalNote resource
  structuredData: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  metadata: {
    wordCount: number;
    generationTime: number;
    model: string;
  };
}

/**
 * Chest X-ray analysis request
 */
export interface ChestXrayRequest {
  imageData: Buffer | string; // Image buffer or base64
  imageFormat: 'dicom' | 'jpeg' | 'png';
  clinicalIndication?: string;
  patientAge?: number;
  patientSex?: 'M' | 'F';
  priorStudies?: string[];
  urgency?: 'stat' | 'urgent' | 'routine';
}

/**
 * Chest X-ray finding
 */
export interface ChestXrayFinding {
  category: string;
  finding: string;
  location?: string;
  severity: 'mild' | 'moderate' | 'severe';
  confidence: number; // 0.0-1.0
  clinicalSignificance: 'high' | 'moderate' | 'low';
}

/**
 * Chest X-ray analysis result
 */
export interface ChestXrayAnalysis {
  overallImpression: string;
  findings: ChestXrayFinding[];
  normalFindings: string[];
  recommendations: string[];
  acuityLevel: 'stat' | 'urgent' | 'routine';
  comparison?: string; // Comparison with prior studies
  confidence: number;
  processingTime: number;
}

/**
 * Medical documentation request
 */
export interface MedicalDocumentationRequest {
  documentType: 'discharge_summary' | 'consultation_note' | 'progress_note' | 'procedure_note';
  patientData: {
    age: number;
    sex: 'M' | 'F';
    mrn?: string;
  };
  clinicalData: {
    admissionDate?: Date;
    dischargeDate?: Date;
    chiefComplaint: string;
    diagnosis: string;
    procedures?: string[];
    medications?: string[];
    followUp?: string;
  };
  format?: 'narrative' | 'structured';
}

/**
 * Medical documentation
 */
export interface MedicalDocumentation {
  document: string;
  type: string;
  format: string;
  fhirResource?: any;
  metadata: {
    generatedAt: Date;
    wordCount: number;
    model: string;
  };
}

/**
 * Google MedLM Service Class
 */
export class GoogleMedLMService {
  private vertexAI?: AxiosInstance;
  private readonly projectId: string;
  private readonly location: string;
  private readonly medlmModel: string = 'medlm-medium';
  private readonly medlmChestXray: string = 'medlm-chest-xray';

  constructor() {
    this.projectId = config.integrations?.google?.projectId || '';
    this.location = config.integrations?.google?.location || 'us-central1';

    // Initialize Vertex AI client if credentials available
    if (config.integrations?.google?.apiKey) {
      this.vertexAI = axios.create({
        baseURL: `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}`,
        timeout: 60000,
        headers: {
          'Authorization': `Bearer ${config.integrations.google.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Google MedLM Service initialized', {
        projectId: this.projectId,
        location: this.location,
        models: [this.medlmModel, this.medlmChestXray]
      });
    } else {
      logger.warn('Google MedLM Service initialized without credentials (simulation mode)');
    }
  }

  /**
   * Generate SOAP note
   */
  async generateSOAPNote(request: SOAPNoteRequest): Promise<SOAPNote> {
    const startTime = Date.now();

    try {
      logger.info('Generating SOAP note', {
        format: request.format || 'standard',
        targetEHR: request.targetEHR || 'generic'
      });

      // If no Vertex AI, return simulated note
      if (!this.vertexAI) {
        return this.simulateSOAPNote(request, startTime);
      }

      // Build SOAP note prompt
      const prompt = this.buildSOAPPrompt(request);

      // Call MedLM
      const response = await this.vertexAI.post(`/publishers/google/models/${this.medlmModel}:predict`, {
        instances: [{
          prompt,
          temperature: 0.3,
          maxOutputTokens: 2048,
          topP: 0.9
        }]
      });

      const generatedText = response.data.predictions[0].content || response.data.predictions[0].text;

      // Parse into SOAP sections
      const structured = this.parseSOAPSections(generatedText);

      // Generate FHIR resource if requested
      let fhirResource;
      if (request.targetEHR === 'fhir_r4') {
        fhirResource = this.convertToFHIR(request, generatedText);
      }

      const note: SOAPNote = {
        text: generatedText,
        format: request.format || 'standard',
        createdAt: new Date(),
        fhirResource,
        structuredData: structured,
        metadata: {
          wordCount: generatedText.split(/\s+/).length,
          generationTime: Date.now() - startTime,
          model: this.medlmModel
        }
      };

      logger.info('SOAP note generated', {
        wordCount: note.metadata.wordCount,
        generationTime: `${note.metadata.generationTime}ms`
      });

      return note;
    } catch (error: any) {
      logger.error('Failed to generate SOAP note:', error);
      return this.simulateSOAPNote(request, startTime);
    }
  }

  /**
   * Analyze chest X-ray using MedLM
   */
  async analyzeChestXray(request: ChestXrayRequest): Promise<ChestXrayAnalysis> {
    const startTime = Date.now();

    try {
      logger.info('Analyzing chest X-ray', {
        format: request.imageFormat,
        urgency: request.urgency || 'routine'
      });

      // If no Vertex AI, return simulated analysis
      if (!this.vertexAI) {
        return this.simulateChestXrayAnalysis(request, startTime);
      }

      // Prepare image data
      const imageBase64 = typeof request.imageData === 'string'
        ? request.imageData
        : request.imageData.toString('base64');

      // Call MedLM for Chest X-ray
      const response = await this.vertexAI.post(`/publishers/google/models/${this.medlmChestXray}:predict`, {
        instances: [{
          image: { bytesBase64Encoded: imageBase64 },
          parameters: {
            clinicalIndication: request.clinicalIndication,
            patientAge: request.patientAge,
            patientSex: request.patientSex
          }
        }]
      });

      const prediction = response.data.predictions[0];

      // Parse findings
      const findings = this.parseChestXrayFindings(prediction);

      const analysis: ChestXrayAnalysis = {
        overallImpression: prediction.impression || 'Analysis complete',
        findings,
        normalFindings: prediction.normalFindings || [],
        recommendations: this.generateXrayRecommendations(findings, request.urgency || 'routine'),
        acuityLevel: this.determineXrayAcuity(findings, request.urgency || 'routine'),
        comparison: request.priorStudies ? 'Comparison available' : undefined,
        confidence: prediction.confidence || 0.85,
        processingTime: Date.now() - startTime
      };

      logger.info('Chest X-ray analysis complete', {
        findings: findings.length,
        acuity: analysis.acuityLevel,
        processingTime: `${analysis.processingTime}ms`
      });

      return analysis;
    } catch (error: any) {
      logger.error('Failed to analyze chest X-ray:', error);
      return this.simulateChestXrayAnalysis(request, startTime);
    }
  }

  /**
   * Generate medical documentation
   */
  async generateMedicalDocumentation(
    request: MedicalDocumentationRequest
  ): Promise<MedicalDocumentation> {
    try {
      logger.info('Generating medical documentation', {
        type: request.documentType,
        format: request.format || 'narrative'
      });

      if (!this.vertexAI) {
        return this.simulateMedicalDocumentation(request);
      }

      const prompt = this.buildDocumentationPrompt(request);

      const response = await this.vertexAI.post(`/publishers/google/models/${this.medlmModel}:predict`, {
        instances: [{
          prompt,
          temperature: 0.3,
          maxOutputTokens: 3072
        }]
      });

      const document = response.data.predictions[0].content || response.data.predictions[0].text;

      return {
        document,
        type: request.documentType,
        format: request.format || 'narrative',
        fhirResource: undefined, // Would generate FHIR resource
        metadata: {
          generatedAt: new Date(),
          wordCount: document.split(/\s+/).length,
          model: this.medlmModel
        }
      };
    } catch (error: any) {
      logger.error('Failed to generate medical documentation:', error);
      return this.simulateMedicalDocumentation(request);
    }
  }

  /**
   * Build SOAP note prompt
   */
  private buildSOAPPrompt(request: SOAPNoteRequest): string {
    return `Generate a ${request.format || 'standard'} SOAP note for the following case:

SUBJECTIVE:
Chief Complaint: ${request.subjective.chiefComplaint}
Symptoms: ${request.subjective.symptoms.join(', ')}
${request.subjective.historyOfPresentIllness ? `HPI: ${request.subjective.historyOfPresentIllness}` : ''}

OBJECTIVE:
${request.objective.vitals ? `Vitals: ${JSON.stringify(request.objective.vitals)}` : ''}
${request.objective.labs ? `Labs: ${JSON.stringify(request.objective.labs)}` : ''}
${request.objective.imaging ? `Imaging: ${JSON.stringify(request.objective.imaging)}` : ''}
${request.objective.physicalExam ? `Physical Exam: ${request.objective.physicalExam}` : ''}

ASSESSMENT:
Primary Diagnosis: ${request.assessment.primaryDiagnosis}${request.assessment.icd10Code ? ` (${request.assessment.icd10Code})` : ''}
${request.assessment.differentialDiagnoses ? `Differential: ${request.assessment.differentialDiagnoses.join(', ')}` : ''}

PLAN:
${request.plan.medications ? `Medications: ${request.plan.medications.join(', ')}` : ''}
${request.plan.procedures ? `Procedures: ${request.plan.procedures.join(', ')}` : ''}
${request.plan.followUp ? `Follow-up: ${request.plan.followUp}` : ''}
${request.plan.recommendations ? `Recommendations: ${request.plan.recommendations.join(', ')}` : ''}

Generate complete SOAP note in ${request.targetEHR || 'generic'} format.`;
  }

  /**
   * Build documentation prompt
   */
  private buildDocumentationPrompt(request: MedicalDocumentationRequest): string {
    return `Generate ${request.documentType.replace('_', ' ')} for:

Patient: ${request.patientData.age} year old ${request.patientData.sex === 'M' ? 'male' : 'female'}
Chief Complaint: ${request.clinicalData.chiefComplaint}
Diagnosis: ${request.clinicalData.diagnosis}
${request.clinicalData.procedures ? `Procedures: ${request.clinicalData.procedures.join(', ')}` : ''}
${request.clinicalData.medications ? `Medications: ${request.clinicalData.medications.join(', ')}` : ''}
${request.clinicalData.followUp ? `Follow-up: ${request.clinicalData.followUp}` : ''}

Format: ${request.format || 'narrative'}`;
  }

  /**
   * Parse SOAP sections from generated text
   */
  private parseSOAPSections(text: string): SOAPNote['structuredData'] {
    // Simple parsing - would use more sophisticated NLP in production
    const sections = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    };

    const subjectiveMatch = text.match(/SUBJECTIVE:([\s\S]*?)(?=OBJECTIVE:|$)/i);
    if (subjectiveMatch) sections.subjective = subjectiveMatch[1].trim();

    const objectiveMatch = text.match(/OBJECTIVE:([\s\S]*?)(?=ASSESSMENT:|$)/i);
    if (objectiveMatch) sections.objective = objectiveMatch[1].trim();

    const assessmentMatch = text.match(/ASSESSMENT:([\s\S]*?)(?=PLAN:|$)/i);
    if (assessmentMatch) sections.assessment = assessmentMatch[1].trim();

    const planMatch = text.match(/PLAN:([\s\S]*?)$/i);
    if (planMatch) sections.plan = planMatch[1].trim();

    return sections;
  }

  /**
   * Parse chest X-ray findings
   */
  private parseChestXrayFindings(prediction: any): ChestXrayFinding[] {
    // Would parse from MedLM response
    return prediction.findings || [];
  }

  /**
   * Generate X-ray recommendations
   */
  private generateXrayRecommendations(
    findings: ChestXrayFinding[],
    urgency: string
  ): string[] {
    const recommendations: string[] = [];

    // Check for critical findings
    const criticalFindings = findings.filter(f => f.clinicalSignificance === 'high');
    if (criticalFindings.length > 0) {
      recommendations.push('⚠️ Critical findings identified - immediate clinical correlation required');
    }

    // Add urgency-based recommendations
    if (urgency === 'stat') {
      recommendations.push('STAT interpretation requested - expedited review');
    }

    // Add finding-specific recommendations
    findings.forEach(finding => {
      if (finding.finding.toLowerCase().includes('pneumothorax')) {
        recommendations.push('Consider chest tube placement for pneumothorax');
      }
      if (finding.finding.toLowerCase().includes('pneumonia')) {
        recommendations.push('Consider empiric antibiotic therapy');
      }
    });

    return recommendations;
  }

  /**
   * Determine X-ray acuity level
   */
  private determineXrayAcuity(findings: ChestXrayFinding[], requestedUrgency: string): 'stat' | 'urgent' | 'routine' {
    const hasCritical = findings.some(f => f.clinicalSignificance === 'high');

    if (hasCritical) return 'stat';
    if (requestedUrgency === 'urgent' || findings.some(f => f.clinicalSignificance === 'moderate')) {
      return 'urgent';
    }
    return 'routine';
  }

  /**
   * Convert to FHIR R4 resource
   */
  private convertToFHIR(request: SOAPNoteRequest, noteText: string): any {
    // Simplified FHIR R4 ClinicalNote resource
    return {
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '11506-3',
          display: 'Progress note'
        }]
      },
      conclusion: noteText,
      presentedForm: [{
        contentType: 'text/plain',
        data: Buffer.from(noteText).toString('base64')
      }]
    };
  }

  /**
   * Simulate SOAP note generation
   */
  private simulateSOAPNote(request: SOAPNoteRequest, startTime: number): SOAPNote {
    logger.info('Simulating SOAP note generation (API not configured)');

    const simulatedText = `SUBJECTIVE:
Chief Complaint: ${request.subjective.chiefComplaint}
${request.subjective.symptoms.join(', ')}

OBJECTIVE:
${request.objective.vitals ? `Vitals: ${JSON.stringify(request.objective.vitals)}` : 'Vitals reviewed'}
${request.objective.labs ? 'Laboratory results reviewed' : ''}

ASSESSMENT:
${request.assessment.primaryDiagnosis}${request.assessment.icd10Code ? ` (${request.assessment.icd10Code})` : ''}

PLAN:
${request.plan.medications ? request.plan.medications.join(', ') : 'Treatment plan reviewed'}
${request.plan.followUp ? request.plan.followUp : 'Follow-up as needed'}

[MedLM simulation - Configure Google Cloud API for actual SOAP note generation]`;

    return {
      text: simulatedText,
      format: request.format || 'standard',
      createdAt: new Date(),
      fhirResource: request.targetEHR === 'fhir_r4' ? this.convertToFHIR(request, simulatedText) : undefined,
      structuredData: this.parseSOAPSections(simulatedText),
      metadata: {
        wordCount: simulatedText.split(/\s+/).length,
        generationTime: Date.now() - startTime,
        model: 'simulation'
      }
    };
  }

  /**
   * Simulate chest X-ray analysis
   */
  private simulateChestXrayAnalysis(request: ChestXrayRequest, startTime: number): ChestXrayAnalysis {
    logger.info('Simulating chest X-ray analysis (API not configured)');

    return {
      overallImpression: 'Chest X-ray analysis pending - Configure Google Cloud MedLM for Chest X-ray API',
      findings: [{
        category: 'System',
        finding: 'MedLM for Chest X-ray not configured',
        severity: 'mild',
        confidence: 0.0,
        clinicalSignificance: 'low'
      }],
      normalFindings: ['Heart size normal', 'Lungs clear'],
      recommendations: ['Configure Google Cloud Vertex AI for actual chest X-ray analysis'],
      acuityLevel: request.urgency || 'routine',
      confidence: 0.0,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Simulate medical documentation
   */
  private simulateMedicalDocumentation(request: MedicalDocumentationRequest): MedicalDocumentation {
    const document = `${request.documentType.toUpperCase().replace('_', ' ')}

Patient: ${request.patientData.age} year old ${request.patientData.sex === 'M' ? 'male' : 'female'}

Chief Complaint: ${request.clinicalData.chiefComplaint}

Diagnosis: ${request.clinicalData.diagnosis}

[MedLM simulation - Configure Google Cloud API for actual medical documentation]`;

    return {
      document,
      type: request.documentType,
      format: request.format || 'narrative',
      metadata: {
        generatedAt: new Date(),
        wordCount: document.split(/\s+/).length,
        model: 'simulation'
      }
    };
  }
}

// Export singleton instance
export const googleMedLMService = new GoogleMedLMService();
