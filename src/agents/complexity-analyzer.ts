/**
 * Complexity Analyzer
 * Analyzes medical case complexity and determines optimal agent count
 */

import { ComplexityFactors, ComplexityScore } from '../types/agent-types';
import config from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComplexityAnalyzer');

export class ComplexityAnalyzer {
  private weights = {
    symptoms: config.complexityWeights.symptoms,
    urgency: config.complexityWeights.urgency,
    history: config.complexityWeights.history,
    dataVolume: config.complexityWeights.dataVolume,
    specialties: config.complexityWeights.specialties,
    rareDisease: config.complexityWeights.rareDisease,
  };

  /**
   * Analyze complexity of a medical case
   */
  public analyze(factors: ComplexityFactors): ComplexityScore {
    logger.info('Analyzing case complexity...', {
      symptomCount: factors.symptomCount,
      urgency: factors.urgencyLevel,
      comorbidities: factors.comorbidityCount,
    });

    // Calculate individual complexity components
    const symptomComplexity = this.calculateSymptomComplexity(factors);
    const clinicalDataComplexity = this.calculateClinicalDataComplexity(factors);
    const patientComplexity = this.calculatePatientComplexity(factors);
    const diagnosticComplexity = this.calculateDiagnosticComplexity(factors);
    const urgencyFactor = this.calculateUrgencyFactor(factors.urgencyLevel);

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore({
      symptomComplexity,
      clinicalDataComplexity,
      patientComplexity,
      diagnosticComplexity,
      urgencyFactor,
    });

    // Normalize to 0-1 range
    const normalizedScore = Math.min(overallScore, 1.0);

    // Determine agent count recommendation
    const agentCountRecommendation = this.determineAgentCount(normalizedScore);

    // Estimate processing time
    const estimatedProcessingTime = this.estimateProcessingTime(
      normalizedScore,
      agentCountRecommendation
    );

    const score: ComplexityScore = {
      overallScore,
      breakdown: {
        symptomComplexity,
        clinicalDataComplexity,
        patientComplexity,
        diagnosticComplexity,
        urgencyFactor,
      },
      normalizedScore,
      agentCountRecommendation,
      estimatedProcessingTime,
    };

    logger.info('Complexity analysis complete', {
      normalizedScore: normalizedScore.toFixed(2),
      agentCount: agentCountRecommendation,
      estimatedTime: `${estimatedProcessingTime}s`,
    });

    return score;
  }

  /**
   * Calculate symptom-based complexity
   */
  private calculateSymptomComplexity(factors: ComplexityFactors): number {
    // Normalize symptom count (0-10 symptoms -> 0-1)
    const symptomCountScore = Math.min(factors.symptomCount / 10, 1.0);

    // Symptom severity (already 0-1)
    const severityScore = factors.symptomSeverity;

    // Symptom duration (acute = simpler, chronic = more complex)
    const durationScore = factors.symptomDuration;

    // Average the three factors
    return (symptomCountScore + severityScore + durationScore) / 3;
  }

  /**
   * Calculate clinical data complexity
   */
  private calculateClinicalDataComplexity(factors: ComplexityFactors): number {
    // Abnormal vital signs (already 0-1)
    const vitalsScore = factors.vitalSignsAbnormal;

    // Abnormal lab results (already 0-1)
    const labsScore = factors.labResultsAbnormal;

    // Imaging required adds complexity
    const imagingScore = factors.imagingRequired ? 0.5 : 0;

    // Data volume (already 0-1)
    const volumeScore = factors.dataVolume;

    // Weighted average
    return (vitalsScore * 0.3 + labsScore * 0.3 + imagingScore * 0.2 + volumeScore * 0.2);
  }

  /**
   * Calculate patient-specific complexity
   */
  private calculatePatientComplexity(factors: ComplexityFactors): number {
    // Age factor (very young and very old are more complex)
    const ageFactor = this.calculateAgeFactor(factors.age);

    // Comorbidities (normalize: 0-5 conditions -> 0-1)
    const comorbidityScore = Math.min(factors.comorbidityCount / 5, 1.0);

    // Medications (normalize: 0-10 medications -> 0-1)
    const medicationScore = Math.min(factors.medicationCount / 10, 1.0);

    // Allergies (normalize: 0-5 allergies -> 0-1)
    const allergyScore = Math.min(factors.allergyCount / 5, 1.0);

    // Previous treatment failures add significant complexity
    const failureScore = Math.min(factors.previousTreatmentFailures / 3, 1.0);

    // Weighted average
    return (
      ageFactor * 0.2 +
      comorbidityScore * 0.3 +
      medicationScore * 0.2 +
      allergyScore * 0.1 +
      failureScore * 0.2
    );
  }

  /**
   * Calculate age factor (U-shaped curve)
   */
  private calculateAgeFactor(age: number): number {
    // Pediatrics (<18): 0.5-0.8
    if (age < 18) {
      return 0.5 + (18 - age) / 36; // Younger = more complex
    }
    // Adults (18-65): 0.3-0.5
    else if (age <= 65) {
      return 0.3 + (age - 18) / 235; // Slight increase with age
    }
    // Elderly (>65): 0.5-0.9
    else {
      return 0.5 + Math.min((age - 65) / 35, 0.4); // Older = more complex
    }
  }

  /**
   * Calculate diagnostic complexity
   */
  private calculateDiagnosticComplexity(factors: ComplexityFactors): number {
    // Number of specialties needed (normalize: 0-5 specialties -> 0-1)
    const specialtyScore = Math.min(factors.specialtyRequirements.length / 5, 1.0);

    // Differential diagnosis breadth (already 0-1)
    const differentialScore = factors.differentialBreadth;

    // Rare disease suspicion (already 0-1)
    const rareDiseaseScore = factors.rareDiseaseSuspicion;

    // Multi-system involvement adds significant complexity
    const multiSystemScore = factors.multiSystemInvolvement ? 0.8 : 0.2;

    // Symptom progression
    const progressionScore = this.calculateProgressionScore(
      factors.symptomProgressionRate
    );

    // Weighted average
    return (
      specialtyScore * 0.25 +
      differentialScore * 0.2 +
      rareDiseaseScore * 0.25 +
      multiSystemScore * 0.2 +
      progressionScore * 0.1
    );
  }

  /**
   * Calculate symptom progression score
   */
  private calculateProgressionScore(rate: 'stable' | 'improving' | 'worsening'): number {
    switch (rate) {
      case 'improving':
        return 0.2; // Less complex
      case 'stable':
        return 0.5; // Moderate
      case 'worsening':
        return 0.9; // More complex
      default:
        return 0.5;
    }
  }

  /**
   * Calculate urgency factor
   */
  private calculateUrgencyFactor(urgency: 'routine' | 'urgent' | 'emergent'): number {
    switch (urgency) {
      case 'routine':
        return 0.3;
      case 'urgent':
        return 0.6;
      case 'emergent':
        return 1.0;
      default:
        return 0.5;
    }
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(breakdown: {
    symptomComplexity: number;
    clinicalDataComplexity: number;
    patientComplexity: number;
    diagnosticComplexity: number;
    urgencyFactor: number;
  }): number {
    return (
      breakdown.symptomComplexity * this.weights.symptoms +
      breakdown.urgencyFactor * this.weights.urgency +
      breakdown.patientComplexity * this.weights.history +
      breakdown.clinicalDataComplexity * this.weights.dataVolume +
      breakdown.diagnosticComplexity * this.weights.specialties +
      breakdown.diagnosticComplexity * this.weights.rareDisease // Diagnostic complexity includes rare disease
    );
  }

  /**
   * Determine optimal agent count based on complexity score
   */
  private determineAgentCount(normalizedScore: number): number {
    // Agent count mapping based on complexity
    if (normalizedScore < 0.2) {
      return 1; // Simple case - single agent sufficient
    } else if (normalizedScore < 0.4) {
      return Math.floor(2 + normalizedScore * 5); // 2-3 agents
    } else if (normalizedScore < 0.6) {
      return Math.floor(3 + normalizedScore * 5); // 3-5 agents
    } else if (normalizedScore < 0.8) {
      return Math.floor(5 + normalizedScore * 5); // 5-8 agents
    } else {
      // Very complex case - 8-15 agents
      const baseCount = 8;
      const additionalAgents = Math.floor((normalizedScore - 0.8) * 35); // Scale up to 7 more
      return Math.min(baseCount + additionalAgents, config.agents.maxAgents);
    }
  }

  /**
   * Estimate processing time based on complexity and agent count
   */
  private estimateProcessingTime(
    normalizedScore: number,
    agentCount: number
  ): number {
    // Base time: 15 seconds per agent
    const baseTime = agentCount * 15;

    // Complexity multiplier (1.0 - 2.0)
    const complexityMultiplier = 1.0 + normalizedScore;

    // Parallel processing efficiency (more agents = some overhead)
    const parallelismFactor = 0.7 + (agentCount / config.agents.maxAgents) * 0.3;

    // Final estimate
    const estimatedTime = Math.ceil(
      baseTime * complexityMultiplier * parallelismFactor
    );

    return estimatedTime;
  }

  /**
   * Quick complexity check (for triage)
   */
  public quickCheck(
    symptomCount: number,
    urgency: 'routine' | 'urgent' | 'emergent',
    comorbidityCount: number
  ): { complexity: 'low' | 'medium' | 'high' | 'critical'; agentCount: number } {
    // Simple heuristic for quick triage
    let score = 0;

    // Symptoms contribution
    if (symptomCount > 5) score += 0.3;
    else if (symptomCount > 2) score += 0.15;

    // Urgency contribution
    if (urgency === 'emergent') score += 0.5;
    else if (urgency === 'urgent') score += 0.25;

    // Comorbidities contribution
    if (comorbidityCount > 3) score += 0.3;
    else if (comorbidityCount > 1) score += 0.15;

    // Determine complexity level
    let complexity: 'low' | 'medium' | 'high' | 'critical';
    let agentCount: number;

    if (score < 0.3) {
      complexity = 'low';
      agentCount = 1;
    } else if (score < 0.5) {
      complexity = 'medium';
      agentCount = 3;
    } else if (score < 0.7) {
      complexity = 'high';
      agentCount = 6;
    } else {
      complexity = 'critical';
      agentCount = 10;
    }

    logger.info('Quick complexity check', {
      symptomCount,
      urgency,
      comorbidityCount,
      complexity,
      agentCount,
    });

    return { complexity, agentCount };
  }

  /**
   * Get complexity description for user-facing messages
   */
  public getComplexityDescription(score: number): string {
    if (score < 0.2) {
      return 'Straightforward case - minimal complexity';
    } else if (score < 0.4) {
      return 'Moderate complexity - standard evaluation';
    } else if (score < 0.6) {
      return 'Complex case - multi-specialty evaluation recommended';
    } else if (score < 0.8) {
      return 'Highly complex - comprehensive multi-specialist assessment';
    } else {
      return 'Critical complexity - full specialist team mobilization';
    }
  }
}

// Export singleton instance
export const complexityAnalyzer = new ComplexityAnalyzer();
