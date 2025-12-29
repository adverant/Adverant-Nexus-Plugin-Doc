/**
 * Medical Prompt Builder
 * Builds medical-specific prompts and agent instructions for MageAgent orchestration
 *
 * This service determines WHICH medical agents are needed and WHAT they should analyze.
 * Actual orchestration is delegated to MageAgent service.
 */

import {
  AgentConfig,
  AgentSpawnDecision,
  ComplexityScore,
  SpawnFrequency,
} from '../types/agent-types';
import { agentRegistry } from './agent-registry';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('MedicalPromptBuilder');

/**
 * Agent selection request
 */
export interface AgentSelectionRequest {
  complexityScore: ComplexityScore;
  urgency: 'routine' | 'urgent' | 'emergent';
  symptoms?: string[];
  requiresImaging?: boolean;
  requiresLabs?: boolean;
  requiresDrugs?: boolean;
  requiresSurgery?: boolean;
  rareDiseaseSuspicion?: number;
  specialtyRequirements?: string[];
}

/**
 * Clinical case data for prompt building
 */
export interface ClinicalCaseData {
  patientId: string;
  chiefComplaint?: string;
  symptoms: string[];
  vitals?: Record<string, any>;
  labs?: Record<string, any>;
  imaging?: Record<string, any>;
  medicalHistory?: {
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
    surgeries?: string[];
  };
  urgency: 'routine' | 'urgent' | 'emergent';
  additionalContext?: string;
}

/**
 * Medical orchestration task for MageAgent
 */
export interface MedicalOrchestrationTask {
  task: string; // Main task description for MageAgent
  maxAgents: number; // Recommended agent count
  timeout: number; // Timeout in ms
  context: {
    caseType: 'clinical_consultation' | 'imaging_analysis' | 'drug_discovery' | 'telemedicine';
    urgency: string;
    agentInstructions: AgentInstruction[];
    clinicalData: ClinicalCaseData;
  };
  streamProgress: boolean;
}

/**
 * Individual agent instruction
 */
export interface AgentInstruction {
  agentId: string;
  specialty: string;
  displayName: string;
  role: string;
  specificInstructions: string;
  focusAreas: string[];
  expectedOutput: string;
  confidenceWeight: number;
}

/**
 * Medical Prompt Builder Class
 * Selects medical agents and builds prompts for MageAgent orchestration
 */
export class MedicalPromptBuilder {
  constructor() {
    logger.info('Medical Prompt Builder initialized');
  }

  /**
   * Select which medical agents are needed based on case complexity and requirements
   */
  public selectAgents(request: AgentSelectionRequest): AgentConfig[] {
    const agentsToSpawn: AgentConfig[] = [];

    logger.info('Determining agents to spawn...', {
      complexity: request.complexityScore.normalizedScore.toFixed(2),
      recommendedCount: request.complexityScore.agentCountRecommendation,
      urgency: request.urgency,
    });

    // 1. Always spawn: Primary care and documentation
    const alwaysSpawnAgents = agentRegistry.getAlwaysSpawnAgents();
    agentsToSpawn.push(...alwaysSpawnAgents);

    // 2. High urgency cases: Add emergency medicine
    if (request.urgency === 'urgent' || request.urgency === 'emergent') {
      const emergencyAgents = agentRegistry.getHighUrgencyAgents();
      agentsToSpawn.push(...emergencyAgents);
    }

    // 3. Keyword-triggered agents based on symptoms
    if (request.symptoms && request.symptoms.length > 0) {
      const keywordMatchedAgents = agentRegistry.findAgentsByKeywords(
        request.symptoms
      );
      // Add unique agents only
      for (const agent of keywordMatchedAgents) {
        if (!agentsToSpawn.find((a) => a.id === agent.id)) {
          agentsToSpawn.push(agent);
        }
      }
    }

    // 4. Add agents based on data requirements
    if (request.requiresImaging) {
      const radiologyAgent = agentRegistry.getAgent('radiology');
      if (radiologyAgent && !agentsToSpawn.find((a) => a.id === 'radiology')) {
        agentsToSpawn.push(radiologyAgent);
      }
    }

    if (request.requiresLabs) {
      const pathologyAgent = agentRegistry.getAgent('pathology');
      if (pathologyAgent && !agentsToSpawn.find((a) => a.id === 'pathology')) {
        agentsToSpawn.push(pathologyAgent);
      }
    }

    if (request.requiresDrugs) {
      const pharmacologyAgent = agentRegistry.getAgent('pharmacology');
      if (pharmacologyAgent && !agentsToSpawn.find((a) => a.id === 'pharmacology')) {
        agentsToSpawn.push(pharmacologyAgent);
      }
    }

    if (request.requiresSurgery) {
      const surgeryAgent = agentRegistry.getAgent('surgery');
      if (surgeryAgent && !agentsToSpawn.find((a) => a.id === 'surgery')) {
        agentsToSpawn.push(surgeryAgent);
      }
    }

    // 5. Rare disease specialist if high suspicion
    if (request.rareDiseaseSuspicion && request.rareDiseaseSuspicion > 0.5) {
      const rareDiseaseAgent = agentRegistry.getAgent('rare_disease_specialist');
      if (rareDiseaseAgent && !agentsToSpawn.find((a) => a.id === 'rare_disease_specialist')) {
        agentsToSpawn.push(rareDiseaseAgent);
      }
    }

    // 6. Add clinical research for complex cases
    if (request.complexityScore.normalizedScore > 0.6) {
      const researchAgent = agentRegistry.getAgent('clinical_research');
      if (researchAgent && !agentsToSpawn.find((a) => a.id === 'clinical_research')) {
        agentsToSpawn.push(researchAgent);
      }
    }

    // 7. Fill remaining slots with specialty-specific agents
    const targetCount = Math.min(
      request.complexityScore.agentCountRecommendation,
      config.agents.maxAgents
    );

    if (agentsToSpawn.length < targetCount && request.specialtyRequirements) {
      for (const specialty of request.specialtyRequirements) {
        if (agentsToSpawn.length >= targetCount) break;

        const specialtyAgent = agentRegistry.getAgent(specialty);
        if (specialtyAgent && !agentsToSpawn.find((a) => a.id === specialty)) {
          agentsToSpawn.push(specialtyAgent);
        }
      }
    }

    // 8. Ensure we don't exceed max agents
    const finalAgents = agentsToSpawn.slice(0, config.agents.maxAgents);

    logger.info(`Agent selection complete: ${finalAgents.length} agents`, {
      agents: finalAgents.map((a) => a.displayName),
      complexity: request.complexityScore.normalizedScore.toFixed(2),
    });

    return finalAgents;
  }

  /**
   * Build complete medical orchestration task for MageAgent
   */
  public buildMedicalOrchestrationTask(
    selectedAgents: AgentConfig[],
    clinicalData: ClinicalCaseData,
    complexityScore: ComplexityScore
  ): MedicalOrchestrationTask {
    logger.info('Building medical orchestration task', {
      agentCount: selectedAgents.length,
      complexity: complexityScore.normalizedScore.toFixed(2),
      urgency: clinicalData.urgency,
    });

    // Build individual agent instructions
    const agentInstructions = selectedAgents.map((agent) =>
      this.buildAgentInstruction(agent, clinicalData)
    );

    // Build main orchestration task description
    const taskDescription = this.buildTaskDescription(
      clinicalData,
      selectedAgents,
      complexityScore
    );

    // Determine timeout based on complexity
    const timeout = this.calculateTimeout(complexityScore);

    return {
      task: taskDescription,
      maxAgents: selectedAgents.length,
      timeout,
      context: {
        caseType: 'clinical_consultation',
        urgency: clinicalData.urgency,
        agentInstructions,
        clinicalData,
      },
      streamProgress: true,
    };
  }

  /**
   * Build instruction for a single medical agent
   */
  private buildAgentInstruction(
    agent: AgentConfig,
    clinicalData: ClinicalCaseData
  ): AgentInstruction {
    // Build specialty-specific focus areas
    const focusAreas = this.determineFocusAreas(agent, clinicalData);

    // Build specific instructions based on agent specialty
    const specificInstructions = this.buildSpecificInstructions(
      agent,
      clinicalData,
      focusAreas
    );

    return {
      agentId: agent.id,
      specialty: agent.specialty,
      displayName: agent.displayName,
      role: this.determineAgentRole(agent),
      specificInstructions,
      focusAreas,
      expectedOutput: this.defineExpectedOutput(agent),
      confidenceWeight: agent.baseConfidenceWeight,
    };
  }

  /**
   * Build main task description for MageAgent
   */
  private buildTaskDescription(
    clinicalData: ClinicalCaseData,
    selectedAgents: AgentConfig[],
    complexityScore: ComplexityScore
  ): string {
    const urgencyText =
      clinicalData.urgency === 'emergent'
        ? 'EMERGENT'
        : clinicalData.urgency === 'urgent'
        ? 'URGENT'
        : 'ROUTINE';

    return `# Medical Case Analysis - ${urgencyText}

## Case Overview
- **Chief Complaint**: ${clinicalData.chiefComplaint || 'Not specified'}
- **Symptoms**: ${clinicalData.symptoms.join(', ')}
- **Urgency Level**: ${clinicalData.urgency}
- **Case Complexity**: ${complexityScore.normalizedScore.toFixed(2)} (${complexityScore.agentCountRecommendation} agents recommended)

## Clinical Data
${this.formatClinicalData(clinicalData)}

## Medical Team
You are coordinating a multi-specialty medical team of ${selectedAgents.length} AI agents to analyze this case:

${selectedAgents
  .map(
    (agent, idx) =>
      `${idx + 1}. **${agent.displayName}** (${agent.specialty})\n   - ${agent.description}\n   - Capabilities: ${agent.capabilities.join(', ')}`
  )
  .join('\n\n')}

## Task Instructions
Each medical specialist should:
1. Review the complete clinical presentation
2. Provide differential diagnoses relevant to their specialty
3. Identify red flags or critical findings
4. Recommend appropriate diagnostic workup
5. Suggest evidence-based management strategies
6. Highlight any specialty-specific concerns

## Expected Deliverables
- **Primary Diagnosis**: Most likely diagnosis with ICD-10 code, confidence score, and supporting evidence
- **Differential Diagnoses**: Alternative diagnoses with reasoning
- **Recommendations**: Diagnostic tests, treatments, referrals, and monitoring plans
- **Risk Assessment**: Clinical risk level with supporting factors
- **Consensus**: Cross-specialty agreement on diagnosis and management

Please ensure all recommendations are evidence-based, HIPAA-compliant, and appropriate for the urgency level.`;
  }

  /**
   * Determine agent role in the medical team
   */
  private determineAgentRole(agent: AgentConfig): string {
    switch (agent.spawnFrequency) {
      case SpawnFrequency.ALWAYS:
        return 'primary_coordinator';
      case SpawnFrequency.HIGH_URGENCY:
        return 'emergency_specialist';
      default:
        return 'specialist_consultant';
    }
  }

  /**
   * Build specialty-specific instructions
   */
  private buildSpecificInstructions(
    agent: AgentConfig,
    clinicalData: ClinicalCaseData,
    focusAreas: string[]
  ): string {
    const baseInstructions = `As a ${agent.displayName}, your role is to provide expert analysis from the perspective of ${agent.specialty}.`;

    const focusInstruction =
      focusAreas.length > 0
        ? `\n\nSpecific focus areas for this case:\n${focusAreas.map((area) => `- ${area}`).join('\n')}`
        : '';

    const dataInstruction = this.buildDataSpecificInstructions(agent, clinicalData);

    const urgencyInstruction =
      clinicalData.urgency === 'emergent'
        ? '\n\n⚠️ EMERGENT CASE: Prioritize life-threatening conditions and immediate interventions.'
        : clinicalData.urgency === 'urgent'
        ? '\n\n⚡ URGENT CASE: Expedite evaluation and identify time-sensitive conditions.'
        : '';

    return `${baseInstructions}${focusInstruction}${dataInstruction}${urgencyInstruction}`;
  }

  /**
   * Build data-specific instructions for agent
   */
  private buildDataSpecificInstructions(
    agent: AgentConfig,
    clinicalData: ClinicalCaseData
  ): string {
    const instructions: string[] = [];

    if (agent.requiresSpecialData?.includes('imaging') && clinicalData.imaging) {
      instructions.push('\n\nReview imaging results and provide radiological interpretation.');
    }

    if (agent.requiresSpecialData?.includes('lab_results') && clinicalData.labs) {
      instructions.push('\n\nAnalyze laboratory results and identify abnormalities.');
    }

    if (
      agent.specialty === 'pharmacology' &&
      clinicalData.medicalHistory?.medications
    ) {
      instructions.push(
        '\n\nReview current medications for interactions, contraindications, and optimization.'
      );
    }

    return instructions.join('');
  }

  /**
   * Determine focus areas for agent based on clinical data
   */
  private determineFocusAreas(
    agent: AgentConfig,
    clinicalData: ClinicalCaseData
  ): string[] {
    const focusAreas: string[] = [];

    // Match symptoms to agent capabilities
    if (agent.triggerKeywords && clinicalData.symptoms.length > 0) {
      const relevantSymptoms = clinicalData.symptoms.filter((symptom) =>
        agent.triggerKeywords!.some((keyword) =>
          symptom.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (relevantSymptoms.length > 0) {
        focusAreas.push(`Symptom evaluation: ${relevantSymptoms.join(', ')}`);
      }
    }

    // Add capability-specific focus areas
    if (agent.capabilities.includes('differential_diagnosis')) {
      focusAreas.push('Comprehensive differential diagnosis');
    }

    if (agent.capabilities.includes('risk_stratification')) {
      focusAreas.push('Clinical risk assessment and stratification');
    }

    if (agent.capabilities.includes('treatment_planning')) {
      focusAreas.push('Evidence-based treatment recommendations');
    }

    return focusAreas;
  }

  /**
   * Define expected output for agent
   */
  private defineExpectedOutput(agent: AgentConfig): string {
    return `Provide a structured analysis including:
- Primary diagnosis with ICD-10 code and confidence level (0.0-1.0)
- Differential diagnoses (top 3-5) with reasoning
- Red flags or critical findings from ${agent.specialty} perspective
- Recommended diagnostic workup specific to ${agent.specialty}
- Treatment recommendations with evidence level
- Risk assessment and prognosis
- Any specialty-specific concerns or considerations`;
  }

  /**
   * Format clinical data for task description
   */
  private formatClinicalData(clinicalData: ClinicalCaseData): string {
    const sections: string[] = [];

    if (clinicalData.vitals && Object.keys(clinicalData.vitals).length > 0) {
      sections.push(
        `**Vital Signs**:\n${Object.entries(clinicalData.vitals)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')}`
      );
    }

    if (clinicalData.labs && Object.keys(clinicalData.labs).length > 0) {
      sections.push(
        `**Laboratory Results**:\n${Object.entries(clinicalData.labs)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')}`
      );
    }

    if (clinicalData.medicalHistory) {
      const history = clinicalData.medicalHistory;
      const historyParts: string[] = [];

      if (history.conditions && history.conditions.length > 0) {
        historyParts.push(`- Conditions: ${history.conditions.join(', ')}`);
      }
      if (history.medications && history.medications.length > 0) {
        historyParts.push(`- Medications: ${history.medications.join(', ')}`);
      }
      if (history.allergies && history.allergies.length > 0) {
        historyParts.push(`- Allergies: ${history.allergies.join(', ')}`);
      }

      if (historyParts.length > 0) {
        sections.push(`**Medical History**:\n${historyParts.join('\n')}`);
      }
    }

    if (clinicalData.additionalContext) {
      sections.push(`**Additional Context**:\n${clinicalData.additionalContext}`);
    }

    return sections.join('\n\n') || 'No additional clinical data provided.';
  }

  /**
   * Calculate timeout based on complexity
   */
  private calculateTimeout(complexityScore: ComplexityScore): number {
    // Base timeout: 2 minutes (120,000ms)
    // Add 30s per agent recommended
    // Max: 10 minutes (600,000ms)
    const baseTimeout = 120000;
    const perAgentTimeout = 30000;
    const calculatedTimeout =
      baseTimeout + complexityScore.agentCountRecommendation * perAgentTimeout;

    return Math.min(calculatedTimeout, 600000);
  }

  /**
   * Make spawn decision for a single agent (used internally by selectAgents)
   */
  public shouldSpawnAgent(
    agentConfig: AgentConfig,
    request: AgentSelectionRequest
  ): AgentSpawnDecision {
    // Check spawn frequency
    switch (agentConfig.spawnFrequency) {
      case SpawnFrequency.ALWAYS:
        return {
          shouldSpawn: true,
          reason: 'Always spawns for all cases',
          priority: 'high',
          estimatedCompletionTime: 30,
        };

      case SpawnFrequency.HIGH_URGENCY:
        if (request.urgency === 'urgent' || request.urgency === 'emergent') {
          return {
            shouldSpawn: true,
            reason: `High urgency case (${request.urgency})`,
            priority: 'critical',
            estimatedCompletionTime: 15,
          };
        }
        break;

      case SpawnFrequency.KEYWORD_TRIGGERED:
        if (request.symptoms && agentConfig.triggerKeywords) {
          const hasMatch = request.symptoms.some((symptom) =>
            agentConfig.triggerKeywords!.some((trigger) =>
              symptom.toLowerCase().includes(trigger.toLowerCase())
            )
          );
          if (hasMatch) {
            return {
              shouldSpawn: true,
              reason: 'Keyword match in symptoms',
              priority: 'high',
              estimatedCompletionTime: 45,
            };
          }
        }
        break;

      case SpawnFrequency.IMAGING_REQUESTS:
        if (request.requiresImaging) {
          return {
            shouldSpawn: true,
            reason: 'Imaging interpretation required',
            priority: 'high',
            estimatedCompletionTime: 60,
          };
        }
        break;

      case SpawnFrequency.LAB_REQUESTS:
        if (request.requiresLabs) {
          return {
            shouldSpawn: true,
            reason: 'Laboratory interpretation required',
            priority: 'medium',
            estimatedCompletionTime: 30,
          };
        }
        break;

      case SpawnFrequency.DRUG_QUERIES:
        if (request.requiresDrugs) {
          return {
            shouldSpawn: true,
            reason: 'Medication management required',
            priority: 'high',
            estimatedCompletionTime: 30,
          };
        }
        break;

      case SpawnFrequency.SURGICAL_CANDIDATES:
        if (request.requiresSurgery) {
          return {
            shouldSpawn: true,
            reason: 'Surgical evaluation required',
            priority: 'high',
            estimatedCompletionTime: 60,
          };
        }
        break;

      case SpawnFrequency.COMPLEX_CASES:
        if (request.complexityScore.normalizedScore > 0.6) {
          return {
            shouldSpawn: true,
            reason: 'Complex case requires additional expertise',
            priority: 'medium',
            estimatedCompletionTime: 90,
          };
        }
        break;

      case SpawnFrequency.RARE_SUSPICION:
        if (request.rareDiseaseSuspicion && request.rareDiseaseSuspicion > 0.5) {
          return {
            shouldSpawn: true,
            reason: 'High suspicion of rare disease',
            priority: 'high',
            estimatedCompletionTime: 120,
          };
        }
        break;
    }

    return {
      shouldSpawn: false,
      reason: 'Spawn conditions not met',
      priority: 'low',
      estimatedCompletionTime: 0,
    };
  }
}

// Export singleton instance
export const medicalPromptBuilder = new MedicalPromptBuilder();
