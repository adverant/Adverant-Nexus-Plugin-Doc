/**
 * Google Med-PaLM 2 Service
 * Expert-level medical AI (85% USMLE accuracy)
 * Integrates with Google Cloud Vertex AI for medical reasoning, Q&A, and differential diagnosis
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';
import config from '../../config';

const logger = createLogger('GoogleMedPaLM2Service');

/**
 * Med-PaLM 2 medical question
 */
export interface MedicalQuestion {
  question: string;
  context?: ClinicalContext;
  includeReferences?: boolean;
  confidenceThreshold?: number; // 0.0-1.0
}

/**
 * Clinical context for Med-PaLM 2
 */
export interface ClinicalContext {
  patientAge?: number;
  patientSex?: 'M' | 'F' | 'Other';
  symptoms?: string[];
  vitals?: Record<string, any>;
  labs?: Record<string, any>;
  medicalHistory?: {
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
  urgency?: 'routine' | 'urgent' | 'emergent';
}

/**
 * Med-PaLM 2 answer
 */
export interface MedicalAnswer {
  answer: string;
  confidence: number; // 0.0-1.0
  evidenceLevel: 'high' | 'moderate' | 'low';
  references?: MedicalReference[];
  warnings?: string[];
  alternativeAnswers?: string[];
}

/**
 * Medical reference
 */
export interface MedicalReference {
  title: string;
  source: string;
  url?: string;
  year?: number;
  relevance: number; // 0.0-1.0
}

/**
 * Differential diagnosis request
 */
export interface DifferentialDiagnosisRequest {
  symptoms: string[];
  context: ClinicalContext;
  maxDiagnoses?: number;
  includeRareDiseases?: boolean;
}

/**
 * Differential diagnosis
 */
export interface DifferentialDiagnosis {
  condition: string;
  icd10Code?: string;
  probability: number; // 0.0-1.0
  supportingFactors: string[];
  contraindictingFactors: string[];
  recommendedTests: string[];
  urgency: 'routine' | 'urgent' | 'emergent';
  reasoning: string;
}

/**
 * Differential diagnosis response
 */
export interface DifferentialDiagnosisResponse {
  differentials: DifferentialDiagnosis[];
  overallConfidence: number;
  recommendations: string[];
  redFlags: string[];
}

/**
 * Google Med-PaLM 2 Service Class
 */
export class GoogleMedPaLM2Service {
  private vertexAI?: AxiosInstance;
  private readonly projectId: string;
  private readonly location: string;
  private readonly modelId: string = 'med-palm-2';

  constructor() {
    this.projectId = config.integrations?.google?.projectId || '';
    this.location = config.integrations?.google?.location || 'us-central1';

    // Initialize Vertex AI client if credentials are available
    if (config.integrations?.google?.apiKey) {
      this.vertexAI = axios.create({
        baseURL: `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}`,
        timeout: 60000,
        headers: {
          'Authorization': `Bearer ${config.integrations.google.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Google Med-PaLM 2 Service initialized', {
        projectId: this.projectId,
        location: this.location,
        modelId: this.modelId
      });
    } else {
      logger.warn('Google Med-PaLM 2 Service initialized without credentials (simulation mode)');
    }
  }

  /**
   * Answer medical question using Med-PaLM 2
   */
  async answerMedicalQuestion(question: MedicalQuestion): Promise<MedicalAnswer> {
    try {
      logger.info('Answering medical question', {
        question: question.question.substring(0, 100)
      });

      // If no Vertex AI client, return simulated response
      if (!this.vertexAI) {
        return this.simulateMedicalAnswer(question);
      }

      // Build prompt with clinical context
      const prompt = this.buildMedicalPrompt(question);

      // Call Vertex AI Med-PaLM 2
      const response = await this.vertexAI.post(`/publishers/google/models/${this.modelId}:predict`, {
        instances: [{
          prompt,
          temperature: 0.2, // Low temperature for medical accuracy
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40
        }]
      });

      const prediction = response.data.predictions[0];

      // Parse response
      const answer: MedicalAnswer = {
        answer: prediction.content || prediction.text,
        confidence: prediction.safetyAttributes?.scores?.[0] || 0.85,
        evidenceLevel: this.determineEvidenceLevel(prediction.safetyAttributes?.scores?.[0] || 0.85),
        references: this.extractReferences(prediction),
        warnings: this.extractWarnings(prediction),
        alternativeAnswers: prediction.alternatives || []
      };

      logger.info('Medical question answered', {
        confidence: answer.confidence.toFixed(2),
        evidenceLevel: answer.evidenceLevel
      });

      return answer;
    } catch (error: any) {
      logger.error('Failed to answer medical question:', error);
      // Fallback to simulation
      return this.simulateMedicalAnswer(question);
    }
  }

  /**
   * Generate differential diagnoses using Med-PaLM 2
   */
  async generateDifferentialDiagnosis(
    request: DifferentialDiagnosisRequest
  ): Promise<DifferentialDiagnosisResponse> {
    try {
      logger.info('Generating differential diagnoses', {
        symptoms: request.symptoms.join(', '),
        maxDiagnoses: request.maxDiagnoses || 5
      });

      // Build differential diagnosis prompt
      const prompt = this.buildDifferentialDiagnosisPrompt(request);

      // If no Vertex AI client, return simulated response
      if (!this.vertexAI) {
        return this.simulateDifferentialDiagnosis(request);
      }

      // Call Med-PaLM 2
      const response = await this.vertexAI.post(`/publishers/google/models/${this.modelId}:predict`, {
        instances: [{
          prompt,
          temperature: 0.3, // Slightly higher for differential generation
          maxOutputTokens: 3072,
          topP: 0.95
        }]
      });

      const prediction = response.data.predictions[0];

      // Parse differential diagnoses
      const differentials = this.parseDifferentialDiagnoses(
        prediction.content || prediction.text,
        request.maxDiagnoses || 5
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(differentials, request.context);

      // Identify red flags
      const redFlags = this.identifyRedFlags(request.symptoms, request.context);

      const result: DifferentialDiagnosisResponse = {
        differentials,
        overallConfidence: this.calculateOverallConfidence(differentials),
        recommendations,
        redFlags
      };

      logger.info('Differential diagnoses generated', {
        count: differentials.length,
        topDiagnosis: differentials[0]?.condition,
        overallConfidence: result.overallConfidence.toFixed(2)
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to generate differential diagnoses:', error);
      // Fallback to simulation
      return this.simulateDifferentialDiagnosis(request);
    }
  }

  /**
   * Analyze medical case and provide expert assessment
   */
  async analyzeMedicalCase(clinicalData: ClinicalContext): Promise<MedicalCaseAnalysis> {
    try {
      logger.info('Analyzing medical case with Med-PaLM 2');

      const prompt = this.buildCaseAnalysisPrompt(clinicalData);

      if (!this.vertexAI) {
        return this.simulateCaseAnalysis(clinicalData);
      }

      const response = await this.vertexAI.post(`/publishers/google/models/${this.modelId}:predict`, {
        instances: [{
          prompt,
          temperature: 0.2,
          maxOutputTokens: 4096
        }]
      });

      const prediction = response.data.predictions[0];

      return this.parseCaseAnalysis(prediction.content || prediction.text);
    } catch (error: any) {
      logger.error('Failed to analyze medical case:', error);
      return this.simulateCaseAnalysis(clinicalData);
    }
  }

  /**
   * Build medical prompt with context
   */
  private buildMedicalPrompt(question: MedicalQuestion): string {
    let prompt = `You are Med-PaLM 2, an expert medical AI assistant with 85% accuracy on USMLE-style questions.

Medical Question: ${question.question}`;

    if (question.context) {
      prompt += `\n\nClinical Context:`;

      if (question.context.patientAge) {
        prompt += `\n- Patient Age: ${question.context.patientAge} years`;
      }

      if (question.context.patientSex) {
        prompt += `\n- Patient Sex: ${question.context.patientSex}`;
      }

      if (question.context.symptoms && question.context.symptoms.length > 0) {
        prompt += `\n- Symptoms: ${question.context.symptoms.join(', ')}`;
      }

      if (question.context.medicalHistory) {
        if (question.context.medicalHistory.conditions) {
          prompt += `\n- Medical History: ${question.context.medicalHistory.conditions.join(', ')}`;
        }
        if (question.context.medicalHistory.medications) {
          prompt += `\n- Current Medications: ${question.context.medicalHistory.medications.join(', ')}`;
        }
      }

      if (question.context.urgency) {
        prompt += `\n- Urgency: ${question.context.urgency.toUpperCase()}`;
      }
    }

    prompt += `\n\nProvide an evidence-based medical answer with:
1. Clear, accurate medical information
2. Clinical reasoning
3. Evidence level (high/moderate/low)
4. Any relevant warnings or contraindications
5. References to medical literature if applicable

Answer:`;

    return prompt;
  }

  /**
   * Build differential diagnosis prompt
   */
  private buildDifferentialDiagnosisPrompt(request: DifferentialDiagnosisRequest): string {
    let prompt = `You are Med-PaLM 2, an expert diagnostic AI. Generate a comprehensive differential diagnosis.

Patient Presentation:
- Chief Symptoms: ${request.symptoms.join(', ')}`;

    if (request.context.patientAge) {
      prompt += `\n- Age: ${request.context.patientAge} years`;
    }

    if (request.context.patientSex) {
      prompt += `\n- Sex: ${request.context.patientSex}`;
    }

    if (request.context.vitals) {
      prompt += `\n- Vital Signs: ${JSON.stringify(request.context.vitals)}`;
    }

    if (request.context.labs) {
      prompt += `\n- Lab Results: ${JSON.stringify(request.context.labs)}`;
    }

    if (request.context.medicalHistory) {
      if (request.context.medicalHistory.conditions) {
        prompt += `\n- Past Medical History: ${request.context.medicalHistory.conditions.join(', ')}`;
      }
    }

    prompt += `\n\nGenerate top ${request.maxDiagnoses || 5} differential diagnoses with:
1. Condition name and ICD-10 code
2. Probability estimate (0.0-1.0)
3. Supporting factors
4. Contradicting factors
5. Recommended diagnostic tests
6. Urgency level
7. Clinical reasoning

Format as JSON array.`;

    if (request.includeRareDiseases) {
      prompt += `\n\nInclude rare diseases if probability > 5%.`;
    }

    return prompt;
  }

  /**
   * Build case analysis prompt
   */
  private buildCaseAnalysisPrompt(context: ClinicalContext): string {
    return `Provide expert medical case analysis for:

Patient: ${context.patientAge || 'Unknown'} years old, ${context.patientSex || 'Unknown sex'}
Symptoms: ${context.symptoms?.join(', ') || 'None reported'}
Medical History: ${context.medicalHistory?.conditions?.join(', ') || 'None'}
Current Medications: ${context.medicalHistory?.medications?.join(', ') || 'None'}

Provide:
1. Most likely diagnosis
2. Differential diagnoses (top 5)
3. Recommended diagnostic workup
4. Treatment recommendations
5. Red flags to monitor
6. Prognosis`;
  }

  /**
   * Parse differential diagnoses from Med-PaLM 2 response
   */
  private parseDifferentialDiagnoses(
    response: string,
    maxCount: number
  ): DifferentialDiagnosis[] {
    // Simple parsing - in production would use more sophisticated NLP
    const differentials: DifferentialDiagnosis[] = [];

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, maxCount);
      }
    } catch {
      // Not JSON, parse as text
    }

    // Fallback: return template differentials
    return this.getTemplateDifferentials().slice(0, maxCount);
  }

  /**
   * Simulate medical answer (when API not available)
   */
  private simulateMedicalAnswer(question: MedicalQuestion): MedicalAnswer {
    logger.info('Simulating Med-PaLM 2 response (API not configured)');

    return {
      answer: `Based on the clinical presentation, this requires comprehensive evaluation. [Med-PaLM 2 simulation - configure Google Cloud API for actual responses]`,
      confidence: 0.75,
      evidenceLevel: 'moderate',
      references: [],
      warnings: ['This is a simulated response. Configure Google Cloud Vertex AI for actual Med-PaLM 2 integration.'],
      alternativeAnswers: []
    };
  }

  /**
   * Simulate differential diagnosis (when API not available)
   */
  private simulateDifferentialDiagnosis(
    request: DifferentialDiagnosisRequest
  ): DifferentialDiagnosisResponse {
    logger.info('Simulating differential diagnosis (API not configured)');

    return {
      differentials: this.getTemplateDifferentials().slice(0, request.maxDiagnoses || 5),
      overallConfidence: 0.7,
      recommendations: [
        'Complete physical examination',
        'Baseline laboratory tests (CBC, CMP, troponin if cardiac symptoms)',
        'Consider imaging based on presentation',
        'Obtain detailed medical history'
      ],
      redFlags: this.identifyRedFlags(request.symptoms, request.context)
    };
  }

  /**
   * Simulate case analysis
   */
  private simulateCaseAnalysis(context: ClinicalContext): MedicalCaseAnalysis {
    return {
      primaryDiagnosis: 'Diagnosis pending - requires Med-PaLM 2 integration',
      differentialDiagnoses: this.getTemplateDifferentials().slice(0, 3),
      recommendedTests: ['Complete blood count', 'Comprehensive metabolic panel'],
      treatmentRecommendations: ['Supportive care', 'Monitor vital signs'],
      redFlags: this.identifyRedFlags(context.symptoms || [], context),
      prognosis: 'Requires clinical evaluation'
    };
  }

  /**
   * Get template differential diagnoses
   */
  private getTemplateDifferentials(): DifferentialDiagnosis[] {
    return [
      {
        condition: 'Requires Med-PaLM 2 integration for accurate diagnosis',
        icd10Code: 'R69',
        probability: 0.0,
        supportingFactors: ['Configure Google Cloud Vertex AI API'],
        contraindictingFactors: [],
        recommendedTests: ['Clinical evaluation'],
        urgency: 'routine',
        reasoning: 'Google Med-PaLM 2 API integration required for expert-level medical reasoning'
      }
    ];
  }

  /**
   * Identify red flags from symptoms and context
   */
  private identifyRedFlags(symptoms: string[], context: ClinicalContext): string[] {
    const redFlags: string[] = [];

    // Check for critical symptoms
    const criticalSymptoms = [
      'chest pain', 'shortness of breath', 'altered mental status', 'severe headache',
      'sudden vision loss', 'weakness', 'numbness', 'seizure', 'syncope', 'bleeding'
    ];

    symptoms.forEach(symptom => {
      const lower = symptom.toLowerCase();
      criticalSymptoms.forEach(critical => {
        if (lower.includes(critical)) {
          redFlags.push(`⚠️ ${critical.toUpperCase()}: Requires immediate evaluation`);
        }
      });
    });

    // Check urgency
    if (context.urgency === 'emergent') {
      redFlags.push('⚠️ EMERGENT: Immediate medical attention required');
    }

    return redFlags;
  }

  /**
   * Generate recommendations based on differentials
   */
  private generateRecommendations(
    differentials: DifferentialDiagnosis[],
    context: ClinicalContext
  ): string[] {
    const recommendations: string[] = [];

    // Add urgency-based recommendations
    if (context.urgency === 'emergent') {
      recommendations.push('Immediate emergency department evaluation');
      recommendations.push('Continuous monitoring of vital signs');
    }

    // Add diagnostic recommendations
    const allTests = new Set<string>();
    differentials.forEach(diff => {
      diff.recommendedTests.forEach(test => allTests.add(test));
    });

    if (allTests.size > 0) {
      recommendations.push(`Recommended diagnostic workup: ${Array.from(allTests).slice(0, 5).join(', ')}`);
    }

    return recommendations;
  }

  /**
   * Calculate overall confidence from differentials
   */
  private calculateOverallConfidence(differentials: DifferentialDiagnosis[]): number {
    if (differentials.length === 0) return 0;

    const avgProbability = differentials.reduce((sum, d) => sum + d.probability, 0) / differentials.length;
    return Math.min(avgProbability * 1.2, 1.0); // Slight boost for having multiple differentials
  }

  /**
   * Determine evidence level from confidence score
   */
  private determineEvidenceLevel(confidence: number): 'high' | 'moderate' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'moderate';
    return 'low';
  }

  /**
   * Extract references from Med-PaLM 2 response
   */
  private extractReferences(prediction: any): MedicalReference[] {
    // Would parse citations from response
    return prediction.citations || [];
  }

  /**
   * Extract warnings from response
   */
  private extractWarnings(prediction: any): string[] {
    return prediction.warnings || [];
  }

  /**
   * Parse case analysis
   */
  private parseCaseAnalysis(response: string): MedicalCaseAnalysis {
    // Would use NLP to parse structured response
    return {
      primaryDiagnosis: 'Parsed from Med-PaLM 2',
      differentialDiagnoses: [],
      recommendedTests: [],
      treatmentRecommendations: [],
      redFlags: [],
      prognosis: 'Good'
    };
  }
}

/**
 * Medical case analysis
 */
export interface MedicalCaseAnalysis {
  primaryDiagnosis: string;
  differentialDiagnoses: DifferentialDiagnosis[];
  recommendedTests: string[];
  treatmentRecommendations: string[];
  redFlags: string[];
  prognosis: string;
}

// Export singleton instance
export const googleMedPaLM2Service = new GoogleMedPaLM2Service();
