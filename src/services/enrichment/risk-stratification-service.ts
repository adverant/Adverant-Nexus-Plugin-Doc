/**
 * Risk Stratification Service
 * Calculates clinical risk scores: TIMI, GRACE, CHADS2-VASc, HAS-BLED, etc.
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('RiskStratificationService');

/**
 * TIMI Score input (for ACS - Acute Coronary Syndrome)
 */
export interface TIMIScoreInput {
  age: number;
  hasCADRiskFactors: boolean; // ≥3 CAD risk factors (HTN, DM, smoking, family history, dyslipidemia)
  hasKnownCAD: boolean; // Known coronary stenosis ≥50%
  aspirinUseIn7Days: boolean;
  severAnginaSymptoms: boolean; // ≥2 anginal events in 24h
  stDeviationOnECG: boolean; // ST changes ≥0.5mm
  elevatedCardiacMarkers: boolean; // Troponin or CK-MB
}

/**
 * GRACE Score input (for ACS mortality risk)
 */
export interface GRACEScoreInput {
  age: number;
  heartRate: number; // bpm
  systolicBP: number; // mmHg
  creatinine: number; // mg/dL
  killipClass: 1 | 2 | 3 | 4; // Heart failure classification
  cardiacArrest: boolean;
  elevatedCardiacMarkers: boolean;
  stDeviationOnECG: boolean;
}

/**
 * CHADS2-VASc Score input (for stroke risk in AF)
 */
export interface CHADS2VAScInput {
  age: number;
  sex: 'M' | 'F';
  hasCongestiveHeartFailure: boolean;
  hasHypertension: boolean;
  hasDiabetes: boolean;
  hasStrokeOrTIA: boolean;
  hasVascularDisease: boolean; // MI, PAD, aortic plaque
}

/**
 * HAS-BLED Score input (for bleeding risk on anticoagulation)
 */
export interface HASBLEDInput {
  hasHypertension: boolean; // Uncontrolled >160 systolic
  abnormalRenalFunction: boolean; // Dialysis, transplant, Cr >2.26
  abnormalLiverFunction: boolean; // Cirrhosis, bilirubin >2x normal
  hasStroke: boolean;
  bleedingHistory: boolean; // Previous bleeding or anemia
  labileINR: boolean; // TTR <60%
  isElderly: boolean; // Age >65
  takingDrugs: boolean; // Antiplatelet, NSAIDs
  alcoholUse: boolean; // ≥8 drinks/week
}

/**
 * Risk score result
 */
export interface RiskScoreResult {
  score: number;
  riskLevel: 'low' | 'intermediate' | 'high' | 'very_high';
  interpretation: string;
  recommendations: string[];
  mortality?: string; // Mortality percentage (if applicable)
}

/**
 * Complete risk assessment
 */
export interface RiskAssessment {
  scores: {
    timi?: RiskScoreResult;
    grace?: RiskScoreResult;
    chads2vasc?: RiskScoreResult;
    hasbled?: RiskScoreResult;
  };
  overallRisk: 'low' | 'intermediate' | 'high' | 'very_high';
  clinicalRecommendations: string[];
}

/**
 * Risk Stratification Service Class
 */
export class RiskStratificationService {
  constructor() {
    logger.info('Risk Stratification Service initialized');
  }

  /**
   * Calculate TIMI Score for ACS
   * Range: 0-7 points
   */
  calculateTIMI(input: TIMIScoreInput): RiskScoreResult {
    let score = 0;

    // Age ≥65
    if (input.age >= 65) score += 1;

    // ≥3 CAD risk factors
    if (input.hasCADRiskFactors) score += 1;

    // Known CAD (stenosis ≥50%)
    if (input.hasKnownCAD) score += 1;

    // Aspirin use in past 7 days
    if (input.aspirinUseIn7Days) score += 1;

    // Severe angina (≥2 episodes in 24h)
    if (input.severAnginaSymptoms) score += 1;

    // ST deviation ≥0.5mm on ECG
    if (input.stDeviationOnECG) score += 1;

    // Elevated cardiac markers
    if (input.elevatedCardiacMarkers) score += 1;

    // Determine risk level
    let riskLevel: 'low' | 'intermediate' | 'high' | 'very_high';
    let interpretation: string;
    let recommendations: string[];

    if (score <= 2) {
      riskLevel = 'low';
      interpretation = 'Low risk (4.7% risk of death, MI, or urgent revascularization at 14 days)';
      recommendations = [
        'Consider outpatient management if clinically stable',
        'Follow-up stress testing within 72 hours',
        'Continue dual antiplatelet therapy'
      ];
    } else if (score <= 4) {
      riskLevel = 'intermediate';
      interpretation = 'Intermediate risk (19.9% risk of death, MI, or urgent revascularization at 14 days)';
      recommendations = [
        'Admit for observation and medical management',
        'Consider early invasive strategy (angiography within 24-48h)',
        'Initiate DAPT, anticoagulation, and statin therapy',
        'Cardiology consultation'
      ];
    } else {
      riskLevel = 'high';
      interpretation = 'High risk (41% risk of death, MI, or urgent revascularization at 14 days)';
      recommendations = [
        '⚠️ URGENT: Immediate cardiology consultation',
        'Early invasive strategy (angiography within 2-24h)',
        'Aggressive medical therapy (DAPT, anticoagulation, GP IIb/IIIa inhibitor)',
        'Admit to cardiac care unit',
        'Consider immediate catheterization'
      ];
    }

    logger.info('TIMI Score calculated', { score, riskLevel });

    return { score, riskLevel, interpretation, recommendations };
  }

  /**
   * Calculate GRACE Score for ACS
   * Range: 0-372 points
   */
  calculateGRACE(input: GRACEScoreInput): RiskScoreResult {
    let score = 0;

    // Age
    if (input.age < 40) score += 0;
    else if (input.age <= 49) score += 18;
    else if (input.age <= 59) score += 36;
    else if (input.age <= 69) score += 55;
    else if (input.age <= 79) score += 73;
    else score += 91;

    // Heart rate
    if (input.heartRate < 70) score += 0;
    else if (input.heartRate <= 89) score += 7;
    else if (input.heartRate <= 109) score += 13;
    else if (input.heartRate <= 149) score += 23;
    else score += 36;

    // Systolic BP
    if (input.systolicBP < 80) score += 63;
    else if (input.systolicBP <= 99) score += 58;
    else if (input.systolicBP <= 119) score += 47;
    else if (input.systolicBP <= 139) score += 37;
    else if (input.systolicBP <= 159) score += 26;
    else if (input.systolicBP <= 199) score += 11;
    else score += 0;

    // Creatinine
    if (input.creatinine < 0.4) score += 2;
    else if (input.creatinine <= 0.79) score += 5;
    else if (input.creatinine <= 1.19) score += 8;
    else if (input.creatinine <= 1.59) score += 11;
    else if (input.creatinine <= 1.99) score += 14;
    else if (input.creatinine <= 3.99) score += 23;
    else score += 31;

    // Killip class
    switch (input.killipClass) {
      case 1:
        score += 0;
        break;
      case 2:
        score += 21;
        break;
      case 3:
        score += 43;
        break;
      case 4:
        score += 64;
        break;
    }

    // Cardiac arrest
    if (input.cardiacArrest) score += 43;

    // Elevated cardiac markers
    if (input.elevatedCardiacMarkers) score += 15;

    // ST deviation
    if (input.stDeviationOnECG) score += 30;

    // Determine risk level and mortality
    let riskLevel: 'low' | 'intermediate' | 'high' | 'very_high';
    let mortality: string;
    let interpretation: string;
    let recommendations: string[];

    if (score <= 108) {
      riskLevel = 'low';
      mortality = '<1%';
      interpretation = `Low risk (${mortality} in-hospital mortality)`;
      recommendations = [
        'Standard medical management',
        'Consider early discharge if stable',
        'Follow-up within 2 weeks'
      ];
    } else if (score <= 140) {
      riskLevel = 'intermediate';
      mortality = '1-3%';
      interpretation = `Intermediate risk (${mortality} in-hospital mortality)`;
      recommendations = [
        'Admit to telemetry or cardiac care unit',
        'Consider invasive strategy within 24-72h',
        'Optimize medical therapy'
      ];
    } else if (score <= 200) {
      riskLevel = 'high';
      mortality = '3-8%';
      interpretation = `High risk (${mortality} in-hospital mortality)`;
      recommendations = [
        'Admit to cardiac care unit',
        'Early invasive strategy (angiography within 24h)',
        'Aggressive medical therapy',
        'Cardiology consultation'
      ];
    } else {
      riskLevel = 'very_high';
      mortality = '>8%';
      interpretation = `Very high risk (${mortality} in-hospital mortality)`;
      recommendations = [
        '⚠️ CRITICAL: Immediate cardiac care unit admission',
        'Urgent invasive strategy (angiography within 2h)',
        'Consider mechanical circulatory support',
        'Intensive care monitoring'
      ];
    }

    logger.info('GRACE Score calculated', { score, riskLevel, mortality });

    return { score, riskLevel, interpretation, recommendations, mortality };
  }

  /**
   * Calculate CHADS2-VASc Score for stroke risk
   * Range: 0-9 points
   */
  calculateCHADS2VASc(input: CHADS2VAScInput): RiskScoreResult {
    let score = 0;

    // Congestive heart failure
    if (input.hasCongestiveHeartFailure) score += 1;

    // Hypertension
    if (input.hasHypertension) score += 1;

    // Age
    if (input.age >= 75) score += 2;
    else if (input.age >= 65) score += 1;

    // Diabetes
    if (input.hasDiabetes) score += 1;

    // Stroke/TIA
    if (input.hasStrokeOrTIA) score += 2;

    // Vascular disease
    if (input.hasVascularDisease) score += 1;

    // Sex (female)
    if (input.sex === 'F') score += 1;

    // Determine risk level
    let riskLevel: 'low' | 'intermediate' | 'high' | 'very_high';
    let interpretation: string;
    let recommendations: string[];

    if (score === 0) {
      riskLevel = 'low';
      interpretation = 'Low risk (0% annual stroke risk)';
      recommendations = [
        'No anticoagulation recommended',
        'Consider aspirin or no therapy',
        'Reassess annually'
      ];
    } else if (score === 1) {
      riskLevel = 'low';
      interpretation = 'Low risk (1.3% annual stroke risk)';
      recommendations = [
        'Consider anticoagulation (oral anticoagulant preferred over aspirin)',
        'Shared decision-making with patient',
        'Assess bleeding risk with HAS-BLED score'
      ];
    } else if (score === 2) {
      riskLevel = 'intermediate';
      interpretation = 'Intermediate risk (2.2% annual stroke risk)';
      recommendations = [
        'Anticoagulation recommended (oral anticoagulant preferred)',
        'Options: Warfarin (INR 2-3) or DOAC (apixaban, rivaroxaban, edoxaban, dabigatran)',
        'Assess bleeding risk with HAS-BLED score'
      ];
    } else {
      riskLevel = 'high';
      interpretation = `High risk (${3.2 + (score - 2) * 1.5}% annual stroke risk)`;
      recommendations = [
        '⚠️ Anticoagulation strongly recommended',
        'Oral anticoagulant therapy (DOAC or warfarin)',
        'Assess and mitigate bleeding risk',
        'Patient education on stroke prevention'
      ];
    }

    logger.info('CHADS2-VASc Score calculated', { score, riskLevel });

    return { score, riskLevel, interpretation, recommendations };
  }

  /**
   * Calculate HAS-BLED Score for bleeding risk
   * Range: 0-9 points
   */
  calculateHASBLED(input: HASBLEDInput): RiskScoreResult {
    let score = 0;

    // Hypertension (uncontrolled)
    if (input.hasHypertension) score += 1;

    // Abnormal renal function
    if (input.abnormalRenalFunction) score += 1;

    // Abnormal liver function
    if (input.abnormalLiverFunction) score += 1;

    // Stroke
    if (input.hasStroke) score += 1;

    // Bleeding history
    if (input.bleedingHistory) score += 1;

    // Labile INR
    if (input.labileINR) score += 1;

    // Elderly (>65)
    if (input.isElderly) score += 1;

    // Drugs (antiplatelet, NSAIDs)
    if (input.takingDrugs) score += 1;

    // Alcohol use
    if (input.alcoholUse) score += 1;

    // Determine risk level
    let riskLevel: 'low' | 'intermediate' | 'high' | 'very_high';
    let interpretation: string;
    let recommendations: string[];

    if (score <= 2) {
      riskLevel = 'low';
      interpretation = `Low bleeding risk (${1.13 + score * 0.5}% annual risk)`;
      recommendations = [
        'Anticoagulation benefit likely outweighs risk',
        'Proceed with anticoagulation if indicated',
        'Standard monitoring'
      ];
    } else if (score === 3) {
      riskLevel = 'intermediate';
      interpretation = 'Intermediate bleeding risk (3.74% annual risk)';
      recommendations = [
        'Caution with anticoagulation',
        'Address modifiable risk factors',
        'More frequent monitoring',
        'Patient education on bleeding signs'
      ];
    } else {
      riskLevel = 'high';
      interpretation = `High bleeding risk (${3.74 + (score - 3) * 2}% annual risk)`;
      recommendations = [
        '⚠️ High bleeding risk - careful consideration required',
        'Address all modifiable risk factors',
        'Consider left atrial appendage occlusion if anticoagulation contraindicated',
        'Frequent monitoring and patient education',
        'Avoid NSAIDs and antiplatelet agents if possible'
      ];
    }

    logger.info('HAS-BLED Score calculated', { score, riskLevel });

    return { score, riskLevel, interpretation, recommendations };
  }

  /**
   * Comprehensive risk assessment
   */
  assessRisk(scores: {
    timi?: TIMIScoreInput;
    grace?: GRACEScoreInput;
    chads2vasc?: CHADS2VAScInput;
    hasbled?: HASBLEDInput;
  }): RiskAssessment {
    const results: RiskAssessment = {
      scores: {},
      overallRisk: 'low',
      clinicalRecommendations: []
    };

    // Calculate requested scores
    if (scores.timi) {
      results.scores.timi = this.calculateTIMI(scores.timi);
    }

    if (scores.grace) {
      results.scores.grace = this.calculateGRACE(scores.grace);
    }

    if (scores.chads2vasc) {
      results.scores.chads2vasc = this.calculateCHADS2VASc(scores.chads2vasc);
    }

    if (scores.hasbled) {
      results.scores.hasbled = this.calculateHASBLED(scores.hasbled);
    }

    // Determine overall risk (highest risk level from all scores)
    const riskLevels = Object.values(results.scores).map(s => s.riskLevel);
    if (riskLevels.includes('very_high')) {
      results.overallRisk = 'very_high';
    } else if (riskLevels.includes('high')) {
      results.overallRisk = 'high';
    } else if (riskLevels.includes('intermediate')) {
      results.overallRisk = 'intermediate';
    } else {
      results.overallRisk = 'low';
    }

    // Aggregate clinical recommendations
    Object.values(results.scores).forEach(scoreResult => {
      results.clinicalRecommendations.push(...scoreResult.recommendations);
    });

    // Deduplicate recommendations
    results.clinicalRecommendations = [...new Set(results.clinicalRecommendations)];

    logger.info('Comprehensive risk assessment complete', {
      overallRisk: results.overallRisk,
      scoresCalculated: Object.keys(results.scores).length
    });

    return results;
  }
}

// Export singleton instance
export const riskStratificationService = new RiskStratificationService();
