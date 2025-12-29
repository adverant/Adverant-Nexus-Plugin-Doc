/**
 * Aidoc AI Service - Critical Findings Detection in CT/MRI
 *
 * Provides:
 * - 60%+ reduction in time-to-diagnosis for critical findings
 * - Automated detection of stroke, pulmonary embolism, nexus bleeds
 * - Priority triage for radiologists
 * - Real-time alerts for life-threatening conditions
 *
 * Integration: Aidoc Medical AI Platform
 * FDA: Class II Medical Device (510(k) cleared)
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

/**
 * Supported imaging modalities
 */
export type ImagingModality = 'CT_NEXUS' | 'CT_CHEST' | 'CT_SPINE' | 'MRI_NEXUS' | 'CT_ABDOMEN';

/**
 * Critical finding types detected by Aidoc
 */
export type CriticalFindingType =
  | 'INTRACRANIAL_HEMORRHAGE'
  | 'ISCHEMIC_STROKE'
  | 'PULMONARY_EMBOLISM'
  | 'CERVICAL_SPINE_FRACTURE'
  | 'AORTIC_DISSECTION'
  | 'PNEUMOTHORAX'
  | 'MASS_LESION';

/**
 * Severity levels for findings
 */
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

/**
 * Imaging study input
 */
export interface ImagingStudyInput {
  studyId: string;
  patientId: string;
  modality: ImagingModality;
  dicomUrl?: string; // URL to DICOM files
  dicomSeries?: string[]; // DICOM series instance UIDs
  clinicalContext?: {
    symptoms?: string[];
    urgency?: 'STAT' | 'URGENT' | 'ROUTINE';
    clinicalHistory?: string;
  };
}

/**
 * Critical finding detected
 */
export interface CriticalFinding {
  findingType: CriticalFindingType;
  severity: SeverityLevel;
  confidence: number; // 0.0-1.0
  location: {
    anatomicalRegion: string;
    laterality?: 'LEFT' | 'RIGHT' | 'BILATERAL';
    coordinates?: {
      x: number;
      y: number;
      z: number;
    };
  };
  description: string;
  clinicalSignificance: string;
  recommendedAction: string;
  timeToTriage: number; // minutes
}

/**
 * Aidoc analysis result
 */
export interface AidocAnalysisResult {
  studyId: string;
  analysisId: string;
  modality: ImagingModality;
  criticalFindings: CriticalFinding[];
  hasCriticalFindings: boolean;
  overallSeverity: SeverityLevel;
  radiologistAlerted: boolean;
  processingTime: number; // seconds
  aiConfidence: number; // 0.0-1.0
  recommendations: string[];
  metadata: {
    analyzedAt: Date;
    seriesAnalyzed: number;
    imagesAnalyzed: number;
  };
}

/**
 * Aidoc triage priority
 */
export interface TriagePriority {
  priority: 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
  estimatedTimeToRadiologist: number; // minutes
  reasoning: string;
  criticalFindingsCount: number;
}

/**
 * Aidoc AI Service
 *
 * Detects critical findings in CT/MRI scans:
 * - Intracranial hemorrhage (sensitivity 95%+)
 * - Ischemic stroke (ASPECTS scoring)
 * - Pulmonary embolism (sensitivity 92%+)
 * - Cervical spine fractures
 * - Aortic dissection
 */
export class AidocService {
  private client: AxiosInstance;
  private simulationMode: boolean;

  constructor() {
    const apiKey = process.env.AIDOC_API_KEY;
    const baseUrl = process.env.AIDOC_API_URL || 'https://api.aidoc.com/v1';

    if (!apiKey) {
      logger.warn('⚠️  AIDOC_API_KEY not configured - using simulation mode');
      this.simulationMode = true;
      this.client = axios.create({ baseURL: baseUrl });
    } else {
      this.simulationMode = false;
      this.client = axios.create({
        baseURL: baseUrl,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60s for image processing
      });
    }

    logger.info('Aidoc AI Service initialized', { simulationMode: this.simulationMode });
  }

  /**
   * Analyze imaging study for critical findings
   *
   * Average processing time: 30-90 seconds
   * Alerts radiologists in <2 minutes for critical findings
   */
  async analyzeImaging(input: ImagingStudyInput): Promise<AidocAnalysisResult> {
    const startTime = Date.now();

    try {
      logger.info('Analyzing imaging study with Aidoc AI', {
        studyId: input.studyId,
        modality: input.modality,
      });

      if (this.simulationMode) {
        return this.simulateAnalysis(input, startTime);
      }

      // Real Aidoc API call
      const response = await this.client.post('/analyze', {
        study_id: input.studyId,
        patient_id: input.patientId,
        modality: input.modality,
        dicom_url: input.dicomUrl,
        dicom_series: input.dicomSeries,
        clinical_context: input.clinicalContext,
        enable_critical_alerts: true,
      });

      const processingTime = (Date.now() - startTime) / 1000;

      return this.mapAidocResponse(response.data, processingTime);
    } catch (error: any) {
      logger.error('Aidoc analysis failed:', error);
      throw new Error(`Aidoc imaging analysis failed: ${error.message}`);
    }
  }

  /**
   * Get triage priority for imaging study
   *
   * Determines urgency based on detected findings
   */
  async getTriagePriority(analysisResult: AidocAnalysisResult): Promise<TriagePriority> {
    const criticalCount = analysisResult.criticalFindings.filter(
      f => f.severity === 'CRITICAL'
    ).length;

    const highCount = analysisResult.criticalFindings.filter(
      f => f.severity === 'HIGH'
    ).length;

    // IMMEDIATE: Any critical findings (stroke, nexus bleed, PE)
    if (criticalCount > 0) {
      return {
        priority: 'IMMEDIATE',
        estimatedTimeToRadiologist: 2, // <2 minutes
        reasoning: `${criticalCount} critical finding(s) detected requiring immediate radiologist review`,
        criticalFindingsCount: criticalCount,
      };
    }

    // URGENT: High severity findings
    if (highCount > 0) {
      return {
        priority: 'URGENT',
        estimatedTimeToRadiologist: 15, // <15 minutes
        reasoning: `${highCount} high-severity finding(s) requiring urgent review`,
        criticalFindingsCount: 0,
      };
    }

    // ROUTINE: No critical or high-severity findings
    return {
      priority: 'ROUTINE',
      estimatedTimeToRadiologist: 60, // Standard workflow
      reasoning: 'No critical findings detected, routine radiologist review',
      criticalFindingsCount: 0,
    };
  }

  /**
   * Check if imaging study has life-threatening findings
   */
  hasLifeThreateningFindings(analysisResult: AidocAnalysisResult): boolean {
    const lifeThreatening: CriticalFindingType[] = [
      'INTRACRANIAL_HEMORRHAGE',
      'ISCHEMIC_STROKE',
      'PULMONARY_EMBOLISM',
      'AORTIC_DISSECTION',
    ];

    return analysisResult.criticalFindings.some(finding =>
      lifeThreatening.includes(finding.findingType) && finding.severity === 'CRITICAL'
    );
  }

  /**
   * Map Aidoc API response to internal format
   */
  private mapAidocResponse(data: any, processingTime: number): AidocAnalysisResult {
    const criticalFindings: CriticalFinding[] = (data.findings || []).map((f: any) => ({
      findingType: f.finding_type,
      severity: f.severity,
      confidence: f.confidence,
      location: {
        anatomicalRegion: f.location.anatomical_region,
        laterality: f.location.laterality,
        coordinates: f.location.coordinates,
      },
      description: f.description,
      clinicalSignificance: f.clinical_significance,
      recommendedAction: f.recommended_action,
      timeToTriage: f.time_to_triage || 0,
    }));

    const overallSeverity = this.calculateOverallSeverity(criticalFindings);

    return {
      studyId: data.study_id,
      analysisId: data.analysis_id,
      modality: data.modality,
      criticalFindings,
      hasCriticalFindings: criticalFindings.length > 0,
      overallSeverity,
      radiologistAlerted: data.radiologist_alerted || false,
      processingTime,
      aiConfidence: data.ai_confidence || 0.9,
      recommendations: data.recommendations || [],
      metadata: {
        analyzedAt: new Date(data.analyzed_at),
        seriesAnalyzed: data.series_analyzed || 0,
        imagesAnalyzed: data.images_analyzed || 0,
      },
    };
  }

  /**
   * Simulate Aidoc analysis for development/testing
   */
  private simulateAnalysis(input: ImagingStudyInput, startTime: number): AidocAnalysisResult {
    logger.warn('🔬 SIMULATION MODE: Generating simulated Aidoc analysis');

    // Simulate realistic processing time (30-90s)
    const processingTime = 0.5; // Instant for simulation

    // Simulate critical findings based on modality
    const criticalFindings = this.generateSimulatedFindings(input.modality, input.clinicalContext);

    const overallSeverity = this.calculateOverallSeverity(criticalFindings);

    return {
      studyId: input.studyId,
      analysisId: `aidoc_sim_${Date.now()}`,
      modality: input.modality,
      criticalFindings,
      hasCriticalFindings: criticalFindings.length > 0,
      overallSeverity,
      radiologistAlerted: criticalFindings.some(f => f.severity === 'CRITICAL'),
      processingTime,
      aiConfidence: 0.92,
      recommendations: this.generateRecommendations(criticalFindings),
      metadata: {
        analyzedAt: new Date(),
        seriesAnalyzed: 3,
        imagesAnalyzed: 150,
      },
    };
  }

  /**
   * Generate simulated critical findings based on modality
   */
  private generateSimulatedFindings(
    modality: ImagingModality,
    clinicalContext?: ImagingStudyInput['clinicalContext']
  ): CriticalFinding[] {
    const findings: CriticalFinding[] = [];

    // Simulate findings based on modality and clinical context
    switch (modality) {
      case 'CT_NEXUS':
        // Simulate potential intracranial hemorrhage or stroke
        if (clinicalContext?.symptoms?.some(s => s.includes('headache') || s.includes('stroke'))) {
          findings.push({
            findingType: 'INTRACRANIAL_HEMORRHAGE',
            severity: 'CRITICAL',
            confidence: 0.94,
            location: {
              anatomicalRegion: 'Left basal ganglia',
              laterality: 'LEFT',
              coordinates: { x: 45, y: 120, z: 88 },
            },
            description: 'Acute intracranial hemorrhage measuring approximately 2.3 cm in diameter',
            clinicalSignificance: 'Life-threatening finding requiring immediate neurosurgical consultation',
            recommendedAction: 'STAT neurosurgery consult, repeat CT in 6 hours, blood pressure control',
            timeToTriage: 1.5,
          });
        }
        break;

      case 'CT_CHEST':
        // Simulate potential pulmonary embolism
        if (clinicalContext?.symptoms?.some(s => s.includes('chest pain') || s.includes('dyspnea'))) {
          findings.push({
            findingType: 'PULMONARY_EMBOLISM',
            severity: 'CRITICAL',
            confidence: 0.91,
            location: {
              anatomicalRegion: 'Right main pulmonary artery',
              laterality: 'RIGHT',
            },
            description: 'Filling defect in right main pulmonary artery consistent with acute pulmonary embolism',
            clinicalSignificance: 'Acute PE requiring immediate anticoagulation',
            recommendedAction: 'Initiate anticoagulation, assess hemodynamic stability, consider thrombolysis',
            timeToTriage: 2.0,
          });
        }
        break;

      case 'CT_SPINE':
        // Simulate potential cervical spine fracture
        findings.push({
          findingType: 'CERVICAL_SPINE_FRACTURE',
          severity: 'HIGH',
          confidence: 0.88,
          location: {
            anatomicalRegion: 'C5 vertebral body',
          },
          description: 'Compression fracture of C5 vertebral body with 20% height loss',
          clinicalSignificance: 'Unstable fracture requiring spinal immobilization',
          recommendedAction: 'Maintain spinal precautions, orthopedic spine consult, MRI for ligamentous injury',
          timeToTriage: 3.0,
        });
        break;
    }

    return findings;
  }

  /**
   * Calculate overall severity from all findings
   */
  private calculateOverallSeverity(findings: CriticalFinding[]): SeverityLevel {
    if (findings.length === 0) {
      return 'LOW';
    }

    const severities = findings.map(f => f.severity);

    if (severities.includes('CRITICAL')) {
      return 'CRITICAL';
    }
    if (severities.includes('HIGH')) {
      return 'HIGH';
    }
    if (severities.includes('MODERATE')) {
      return 'MODERATE';
    }
    return 'LOW';
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: CriticalFinding[]): string[] {
    const recommendations: string[] = [];

    if (findings.length === 0) {
      recommendations.push('No critical findings detected - routine radiologist review');
      return recommendations;
    }

    // Life-threatening findings
    const critical = findings.filter(f => f.severity === 'CRITICAL');
    if (critical.length > 0) {
      recommendations.push('IMMEDIATE radiologist notification required');
      recommendations.push('Alert emergency department attending physician');
      recommendations.push('Consider specialist consultation (neurosurgery, cardiothoracic, etc.)');
    }

    // High severity findings
    const high = findings.filter(f => f.severity === 'HIGH');
    if (high.length > 0) {
      recommendations.push('Urgent radiologist review within 15 minutes');
      recommendations.push('Notify ordering physician of high-severity findings');
    }

    return recommendations;
  }

  /**
   * Get performance metrics
   *
   * Aidoc reported outcomes:
   * - 60% reduction in time-to-diagnosis for critical findings
   * - 95%+ sensitivity for intracranial hemorrhage
   * - 92%+ sensitivity for pulmonary embolism
   * - <2 minute radiologist notification for critical findings
   */
  getPerformanceMetrics(): any {
    return {
      timeReduction: '60%+',
      intracranialHemorrhageSensitivity: 0.95,
      pulmonaryEmbolismSensitivity: 0.92,
      criticalFindingAlertTime: '<2 minutes',
      fdaStatus: 'Class II Medical Device (510(k) cleared)',
      modalitiesSupported: ['CT_NEXUS', 'CT_CHEST', 'CT_SPINE', 'MRI_NEXUS', 'CT_ABDOMEN'],
    };
  }
}

// Singleton instance
export const aidocService = new AidocService();
