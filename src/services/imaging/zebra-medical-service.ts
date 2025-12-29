/**
 * Zebra Medical Vision AI Service
 *
 * Provides:
 * - Comprehensive multi-modality imaging analysis (CT, MRI, X-ray)
 * - 13+ clinical findings across 7 anatomical systems
 * - Opportunistic screening (incidental findings)
 * - Population health analytics
 * - Automated radiology reporting
 *
 * Integration: Zebra Medical Vision AI Platform
 * FDA: Multiple 510(k) clearances for clinical findings
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

/**
 * Imaging modality
 */
export type ZebraModality = 'CT' | 'MRI' | 'XRAY' | 'MAMMOGRAPHY';

/**
 * Anatomical system
 */
export type AnatomicalSystem =
  | 'CARDIOVASCULAR'
  | 'PULMONARY'
  | 'MUSCULOSKELETAL'
  | 'HEPATIC'
  | 'RENAL'
  | 'NEUROLOGICAL'
  | 'ONCOLOGY';

/**
 * Clinical finding types detected by Zebra Medical
 */
export type ZebraFindingType =
  // Cardiovascular
  | 'CORONARY_ARTERY_CALCIUM'
  | 'AORTIC_ANEURYSM'
  | 'CARDIAC_HYPERTROPHY'
  // Pulmonary
  | 'LUNG_NODULE'
  | 'EMPHYSEMA'
  | 'PNEUMOTHORAX'
  | 'PLEURAL_EFFUSION'
  // Musculoskeletal
  | 'VERTEBRAL_COMPRESSION_FRACTURE'
  | 'OSTEOPOROSIS'
  | 'HIP_FRACTURE'
  // Hepatic
  | 'FATTY_LIVER'
  | 'LIVER_LESION'
  | 'CIRRHOSIS'
  // Renal
  | 'KIDNEY_STONE'
  | 'HYDRONEPHROSIS'
  // Oncology
  | 'BREAST_DENSITY'
  | 'SUSPICIOUS_LESION';

/**
 * Imaging study input for Zebra Medical
 */
export interface ZebraStudyInput {
  studyId: string;
  patientId: string;
  modality: ZebraModality;
  anatomicalRegion: string;
  dicomUrl?: string;
  priorStudies?: string[]; // For comparison
  enableOpportunisticScreening?: boolean; // Detect incidental findings
  targetedFindings?: ZebraFindingType[]; // Specific findings to look for
}

/**
 * Clinical finding detected
 */
export interface ZebraFinding {
  findingType: ZebraFindingType;
  system: AnatomicalSystem;
  detected: boolean;
  confidence: number; // 0.0-1.0
  severity: 'MINIMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
  quantification?: {
    measurement: number;
    unit: string;
    referenceRange?: string;
  };
  location?: {
    anatomicalSite: string;
    laterality?: 'LEFT' | 'RIGHT' | 'BILATERAL';
  };
  description: string;
  clinicalSignificance: string;
  followUpRecommendation: string;
  changeFromPrior?: {
    status: 'NEW' | 'STABLE' | 'IMPROVED' | 'WORSENED';
    description: string;
  };
}

/**
 * Zebra Medical analysis result
 */
export interface ZebraAnalysisResult {
  studyId: string;
  analysisId: string;
  modality: ZebraModality;
  findings: ZebraFinding[];
  incidentalFindings: ZebraFinding[]; // Opportunistic screening
  overallRiskScore: number; // 0-100
  structuredReport: string;
  processingTime: number; // seconds
  metadata: {
    analyzedAt: Date;
    algorithmsApplied: string[];
    fdaClearedAlgorithms: string[];
  };
}

/**
 * Opportunistic screening report
 */
export interface OpportunisticScreeningReport {
  screeningPerformed: string[]; // Systems screened
  findingsDetected: number;
  significantFindings: ZebraFinding[];
  preventiveActions: string[];
  estimatedHealthImpact: string;
}

/**
 * Zebra Medical Vision AI Service
 *
 * Comprehensive imaging analysis platform:
 * - 13+ clinical findings across 7 anatomical systems
 * - Opportunistic screening for incidental findings
 * - Automated calcium scoring, lung nodule detection, liver analysis
 * - Population health insights
 *
 * Performance:
 * - 90%+ sensitivity/specificity across algorithms
 * - 50%+ reduction in missed incidental findings
 * - FDA 510(k) cleared for multiple indications
 */
export class ZebraMedicalService {
  private client: AxiosInstance;
  private simulationMode: boolean;

  constructor() {
    const apiKey = process.env.ZEBRA_MEDICAL_API_KEY;
    const baseUrl = process.env.ZEBRA_MEDICAL_API_URL || 'https://api.zebra-med.com/v2';

    if (!apiKey) {
      logger.warn('⚠️  ZEBRA_MEDICAL_API_KEY not configured - using simulation mode');
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
        timeout: 120000, // 2 minutes
      });
    }

    logger.info('Zebra Medical Service initialized', { simulationMode: this.simulationMode });
  }

  /**
   * Comprehensive imaging analysis with opportunistic screening
   *
   * Analyzes for:
   * - Targeted findings (requested by physician)
   * - Incidental findings (opportunistic screening)
   * - Multi-system assessment
   */
  async analyzeImaging(input: ZebraStudyInput): Promise<ZebraAnalysisResult> {
    const startTime = Date.now();

    try {
      logger.info('Analyzing imaging with Zebra Medical Vision AI', {
        studyId: input.studyId,
        modality: input.modality,
        enableOpportunisticScreening: input.enableOpportunisticScreening,
      });

      if (this.simulationMode) {
        return this.simulateAnalysis(input, startTime);
      }

      // Real Zebra Medical API call
      const response = await this.client.post('/analyze', {
        study_id: input.studyId,
        patient_id: input.patientId,
        modality: input.modality,
        anatomical_region: input.anatomicalRegion,
        dicom_url: input.dicomUrl,
        prior_studies: input.priorStudies,
        enable_opportunistic_screening: input.enableOpportunisticScreening ?? true,
        targeted_findings: input.targetedFindings,
      });

      const processingTime = (Date.now() - startTime) / 1000;

      return this.mapZebraResponse(response.data, processingTime);
    } catch (error: any) {
      logger.error('Zebra Medical analysis failed:', error);
      throw new Error(`Zebra Medical imaging analysis failed: ${error.message}`);
    }
  }

  /**
   * Coronary artery calcium (CAC) scoring
   *
   * Automated Agatston calcium score from CT chest
   * Predicts 10-year cardiovascular risk
   */
  async calculateCalciumScore(input: {
    studyId: string;
    patientId: string;
    dicomUrl?: string;
  }): Promise<{
    agatstonScore: number;
    riskCategory: 'MINIMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
    tenYearCVDRisk: number; // Percentage
    recommendations: string[];
  }> {
    const analysis = await this.analyzeImaging({
      studyId: input.studyId,
      patientId: input.patientId,
      modality: 'CT',
      anatomicalRegion: 'CHEST',
      dicomUrl: input.dicomUrl,
      targetedFindings: ['CORONARY_ARTERY_CALCIUM'],
    });

    const cacFinding = analysis.findings.find(f => f.findingType === 'CORONARY_ARTERY_CALCIUM');

    if (!cacFinding || !cacFinding.quantification) {
      return {
        agatstonScore: 0,
        riskCategory: 'MINIMAL',
        tenYearCVDRisk: 5,
        recommendations: ['Continue routine preventive care'],
      };
    }

    const agatstonScore = cacFinding.quantification.measurement;

    // Risk stratification based on Agatston score
    let riskCategory: 'MINIMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
    let tenYearCVDRisk: number;
    let recommendations: string[];

    if (agatstonScore === 0) {
      riskCategory = 'MINIMAL';
      tenYearCVDRisk = 5;
      recommendations = [
        'Continue routine preventive care',
        'Lifestyle modification (diet, exercise)',
        'Repeat CAC in 5-10 years',
      ];
    } else if (agatstonScore < 100) {
      riskCategory = 'MILD';
      tenYearCVDRisk = 10;
      recommendations = [
        'Consider statin therapy',
        'Aggressive risk factor modification',
        'Repeat CAC in 3-5 years',
      ];
    } else if (agatstonScore < 400) {
      riskCategory = 'MODERATE';
      tenYearCVDRisk = 20;
      recommendations = [
        'Statin therapy recommended',
        'Cardiology referral',
        'Consider stress testing',
        'Aggressive lipid management',
      ];
    } else {
      riskCategory = 'SEVERE';
      tenYearCVDRisk = 35;
      recommendations = [
        'High-intensity statin therapy',
        'Cardiology consultation required',
        'Stress test or coronary CTA',
        'Aspirin therapy if no contraindications',
        'Consider PCSK9 inhibitor',
      ];
    }

    return {
      agatstonScore,
      riskCategory,
      tenYearCVDRisk,
      recommendations,
    };
  }

  /**
   * Lung nodule detection and tracking
   *
   * Detects and characterizes lung nodules
   * Provides Lung-RADS classification
   */
  async detectLungNodules(input: {
    studyId: string;
    patientId: string;
    dicomUrl?: string;
    priorStudies?: string[];
  }): Promise<{
    nodules: Array<{
      size: number; // mm
      location: string;
      lungRADS: '1' | '2' | '3' | '4A' | '4B' | '4X';
      malignancyRisk: number; // 0-100%
      recommendation: string;
    }>;
  }> {
    const analysis = await this.analyzeImaging({
      studyId: input.studyId,
      patientId: input.patientId,
      modality: 'CT',
      anatomicalRegion: 'CHEST',
      dicomUrl: input.dicomUrl,
      priorStudies: input.priorStudies,
      targetedFindings: ['LUNG_NODULE'],
    });

    const noduleFindings = analysis.findings.filter(f => f.findingType === 'LUNG_NODULE');

    return {
      nodules: noduleFindings.map(nodule => {
        const size = nodule.quantification?.measurement || 0;

        // Lung-RADS classification based on size
        let lungRADS: '1' | '2' | '3' | '4A' | '4B' | '4X';
        let malignancyRisk: number;
        let recommendation: string;

        if (size < 6) {
          lungRADS = '2';
          malignancyRisk = 1;
          recommendation = 'Annual screening CT';
        } else if (size < 8) {
          lungRADS = '3';
          malignancyRisk = 2;
          recommendation = '6-month follow-up CT';
        } else if (size < 15) {
          lungRADS = '4A';
          malignancyRisk = 8;
          recommendation = '3-month follow-up CT, consider PET-CT';
        } else {
          lungRADS = '4B';
          malignancyRisk = 20;
          recommendation = 'PET-CT, biopsy, or surgical consultation';
        }

        return {
          size,
          location: nodule.location?.anatomicalSite || 'Unknown',
          lungRADS,
          malignancyRisk,
          recommendation,
        };
      }),
    };
  }

  /**
   * Generate opportunistic screening report
   *
   * Identifies incidental findings that could prevent future disease
   */
  generateOpportunisticScreeningReport(
    analysisResult: ZebraAnalysisResult
  ): OpportunisticScreeningReport {
    const significantFindings = analysisResult.incidentalFindings.filter(
      f => f.severity === 'MODERATE' || f.severity === 'SEVERE'
    );

    const systemsScreened = [
      ...new Set(analysisResult.incidentalFindings.map(f => f.system)),
    ];

    const preventiveActions: string[] = [];

    // Generate preventive actions based on findings
    significantFindings.forEach(finding => {
      switch (finding.findingType) {
        case 'CORONARY_ARTERY_CALCIUM':
          preventiveActions.push('Initiate cardiovascular risk reduction (statin, lifestyle)');
          break;
        case 'OSTEOPOROSIS':
          preventiveActions.push('DEXA scan and osteoporosis treatment evaluation');
          break;
        case 'FATTY_LIVER':
          preventiveActions.push('Evaluate for metabolic syndrome, lifestyle modification');
          break;
        case 'LUNG_NODULE':
          preventiveActions.push('Smoking cessation, follow-up CT per Lung-RADS');
          break;
      }
    });

    return {
      screeningPerformed: systemsScreened,
      findingsDetected: analysisResult.incidentalFindings.length,
      significantFindings,
      preventiveActions,
      estimatedHealthImpact:
        significantFindings.length > 0
          ? 'Early detection may prevent serious complications and improve outcomes'
          : 'No significant actionable findings detected',
    };
  }

  /**
   * Map Zebra Medical API response to internal format
   */
  private mapZebraResponse(data: any, processingTime: number): ZebraAnalysisResult {
    const findings: ZebraFinding[] = (data.findings || []).map((f: any) => ({
      findingType: f.finding_type,
      system: f.system,
      detected: f.detected,
      confidence: f.confidence,
      severity: f.severity,
      quantification: f.quantification,
      location: f.location,
      description: f.description,
      clinicalSignificance: f.clinical_significance,
      followUpRecommendation: f.follow_up_recommendation,
      changeFromPrior: f.change_from_prior,
    }));

    const incidentalFindings: ZebraFinding[] = (data.incidental_findings || []).map((f: any) => ({
      findingType: f.finding_type,
      system: f.system,
      detected: f.detected,
      confidence: f.confidence,
      severity: f.severity,
      quantification: f.quantification,
      location: f.location,
      description: f.description,
      clinicalSignificance: f.clinical_significance,
      followUpRecommendation: f.follow_up_recommendation,
    }));

    return {
      studyId: data.study_id,
      analysisId: data.analysis_id,
      modality: data.modality,
      findings,
      incidentalFindings,
      overallRiskScore: data.overall_risk_score || 0,
      structuredReport: data.structured_report || '',
      processingTime,
      metadata: {
        analyzedAt: new Date(data.analyzed_at),
        algorithmsApplied: data.algorithms_applied || [],
        fdaClearedAlgorithms: data.fda_cleared_algorithms || [],
      },
    };
  }

  /**
   * Simulate Zebra Medical analysis for development/testing
   */
  private simulateAnalysis(input: ZebraStudyInput, startTime: number): ZebraAnalysisResult {
    logger.warn('🔬 SIMULATION MODE: Generating simulated Zebra Medical analysis');

    const processingTime = 0.8; // Instant for simulation

    // Simulate comprehensive findings based on modality
    const findings = this.generateSimulatedFindings(input.modality, input.anatomicalRegion);

    // Simulate incidental findings if opportunistic screening enabled
    const incidentalFindings =
      input.enableOpportunisticScreening !== false
        ? this.generateSimulatedIncidentalFindings(input.modality)
        : [];

    const overallRiskScore = this.calculateRiskScore(findings, incidentalFindings);

    const structuredReport = this.generateStructuredReport(findings, incidentalFindings);

    return {
      studyId: input.studyId,
      analysisId: `zebra_sim_${Date.now()}`,
      modality: input.modality,
      findings,
      incidentalFindings,
      overallRiskScore,
      structuredReport,
      processingTime,
      metadata: {
        analyzedAt: new Date(),
        algorithmsApplied: ['CAC Scoring', 'Lung Nodule Detection', 'Liver Analysis'],
        fdaClearedAlgorithms: ['Coronary Calcium', 'Emphysema', 'Fatty Liver'],
      },
    };
  }

  /**
   * Generate simulated findings
   */
  private generateSimulatedFindings(
    modality: ZebraModality,
    anatomicalRegion: string
  ): ZebraFinding[] {
    const findings: ZebraFinding[] = [];

    if (modality === 'CT' && anatomicalRegion.includes('CHEST')) {
      // Coronary artery calcium
      findings.push({
        findingType: 'CORONARY_ARTERY_CALCIUM',
        system: 'CARDIOVASCULAR',
        detected: true,
        confidence: 0.96,
        severity: 'MODERATE',
        quantification: {
          measurement: 245,
          unit: 'Agatston units',
          referenceRange: '<100 low risk, 100-400 moderate risk',
        },
        description: 'Moderate coronary artery calcification (Agatston score: 245)',
        clinicalSignificance: '10-year cardiovascular disease risk: ~20%',
        followUpRecommendation: 'Cardiology referral, statin therapy, repeat CAC in 3-5 years',
      });

      // Lung nodule
      findings.push({
        findingType: 'LUNG_NODULE',
        system: 'PULMONARY',
        detected: true,
        confidence: 0.89,
        severity: 'MILD',
        quantification: {
          measurement: 5.2,
          unit: 'mm',
        },
        location: {
          anatomicalSite: 'Right upper lobe',
          laterality: 'RIGHT',
        },
        description: '5.2mm solid nodule in right upper lobe',
        clinicalSignificance: 'Lung-RADS 2 (benign appearance)',
        followUpRecommendation: 'Annual screening CT per Lung-RADS guidelines',
      });
    }

    return findings;
  }

  /**
   * Generate simulated incidental findings
   */
  private generateSimulatedIncidentalFindings(modality: ZebraModality): ZebraFinding[] {
    const incidentalFindings: ZebraFinding[] = [];

    if (modality === 'CT') {
      // Fatty liver (common incidental finding)
      incidentalFindings.push({
        findingType: 'FATTY_LIVER',
        system: 'HEPATIC',
        detected: true,
        confidence: 0.92,
        severity: 'MODERATE',
        description: 'Hepatic steatosis (fatty liver) detected',
        clinicalSignificance: 'Associated with metabolic syndrome',
        followUpRecommendation: 'Evaluate for diabetes, dyslipidemia; lifestyle modification',
      });

      // Vertebral compression fracture
      incidentalFindings.push({
        findingType: 'VERTEBRAL_COMPRESSION_FRACTURE',
        system: 'MUSCULOSKELETAL',
        detected: true,
        confidence: 0.87,
        severity: 'MILD',
        location: {
          anatomicalSite: 'T12 vertebral body',
        },
        description: 'Mild compression fracture of T12 (15% height loss)',
        clinicalSignificance: 'May indicate osteoporosis',
        followUpRecommendation: 'DEXA scan, evaluate for osteoporosis treatment',
      });
    }

    return incidentalFindings;
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(findings: ZebraFinding[], incidentalFindings: ZebraFinding[]): number {
    const allFindings = [...findings, ...incidentalFindings];

    if (allFindings.length === 0) {
      return 0;
    }

    const severityScores = {
      MINIMAL: 10,
      MILD: 25,
      MODERATE: 50,
      SEVERE: 90,
    };

    const scores = allFindings.map(f => severityScores[f.severity] * f.confidence);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return Math.round(averageScore);
  }

  /**
   * Generate structured radiology report
   */
  private generateStructuredReport(
    findings: ZebraFinding[],
    incidentalFindings: ZebraFinding[]
  ): string {
    const sections: string[] = [];

    sections.push('AUTOMATED IMAGING ANALYSIS REPORT (Zebra Medical Vision AI)');
    sections.push('\n--- PRIMARY FINDINGS ---');

    if (findings.length > 0) {
      findings.forEach((f, idx) => {
        sections.push(`\n${idx + 1}. ${f.findingType}: ${f.description}`);
        sections.push(`   Severity: ${f.severity} (Confidence: ${(f.confidence * 100).toFixed(1)}%)`);
        sections.push(`   Recommendation: ${f.followUpRecommendation}`);
      });
    } else {
      sections.push('No significant primary findings detected.');
    }

    if (incidentalFindings.length > 0) {
      sections.push('\n--- INCIDENTAL FINDINGS (Opportunistic Screening) ---');
      incidentalFindings.forEach((f, idx) => {
        sections.push(`\n${idx + 1}. ${f.findingType}: ${f.description}`);
        sections.push(`   Clinical Significance: ${f.clinicalSignificance}`);
        sections.push(`   Recommendation: ${f.followUpRecommendation}`);
      });
    }

    sections.push('\n--- DISCLAIMER ---');
    sections.push(
      'This AI-generated report is for clinical decision support only. All findings require radiologist confirmation.'
    );

    return sections.join('\n');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return {
      clinicalFindings: '13+',
      anatomicalSystems: '7',
      sensitivitySpecificity: '90%+',
      incidentalFindingDetectionImprovement: '50%+',
      fdaStatus: 'Multiple 510(k) clearances',
      algorithmsAvailable: [
        'Coronary Artery Calcium',
        'Lung Nodule Detection',
        'Emphysema Quantification',
        'Fatty Liver Detection',
        'Vertebral Compression Fracture',
        'Aortic Aneurysm',
        'Osteoporosis',
      ],
    };
  }
}

// Singleton instance
export const zebraMedicalService = new ZebraMedicalService();
