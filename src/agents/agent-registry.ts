/**
 * Agent Registry
 * Registry of all available medical AI agents with their configurations
 */

import { AgentConfig, MedicalSpecialty, SpawnFrequency } from '../types/agent-types';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentRegistry');

/**
 * Complete registry of medical AI agents
 */
export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  // ============================================================================
  // PRIMARY CARE & EMERGENCY
  // ============================================================================
  primary_care: {
    id: 'primary_care',
    specialty: MedicalSpecialty.PRIMARY_CARE,
    displayName: 'Primary Care Physician',
    description: 'General medicine, initial assessment, coordination of care',
    spawnFrequency: SpawnFrequency.ALWAYS,
    baseConfidenceWeight: 0.8,
    capabilities: [
      'general_assessment',
      'differential_diagnosis',
      'treatment_planning',
      'care_coordination',
      'health_maintenance',
      'patient_education',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },

  emergency_medicine: {
    id: 'emergency_medicine',
    specialty: MedicalSpecialty.EMERGENCY_MEDICINE,
    displayName: 'Emergency Medicine Physician',
    description: 'Acute care, triage, emergency stabilization',
    spawnFrequency: SpawnFrequency.HIGH_URGENCY,
    baseConfidenceWeight: 0.95,
    capabilities: [
      'emergency_triage',
      'acute_care',
      'rapid_diagnosis',
      'stabilization',
      'trauma_assessment',
      'critical_decision_making',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },

  // ============================================================================
  // CORE MEDICAL SPECIALTIES
  // ============================================================================
  cardiology: {
    id: 'cardiology',
    specialty: MedicalSpecialty.CARDIOLOGY,
    displayName: 'Cardiologist',
    description: 'Cardiovascular disease diagnosis and management',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'chest pain',
      'heart',
      'cardiac',
      'arrhythmia',
      'hypertension',
      'angina',
      'myocardial',
      'palpitations',
      'coronary',
      'heart failure',
      'valve',
      'ecg',
      'ekg',
    ],
    baseConfidenceWeight: 1.0,
    capabilities: [
      'cardiac_diagnosis',
      'ecg_interpretation',
      'heart_failure_management',
      'arrhythmia_evaluation',
      'coronary_disease_assessment',
      'cardiac_risk_stratification',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['vitals', 'ecg'],
  },

  neurology: {
    id: 'neurology',
    specialty: MedicalSpecialty.NEUROLOGY,
    displayName: 'Neurologist',
    description: 'Neurological disorders diagnosis and management',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'headache',
      'seizure',
      'stroke',
      'dizziness',
      'weakness',
      'numbness',
      'tremor',
      'memory',
      'confusion',
      'paralysis',
      'neuropathy',
      'migraine',
      'vertigo',
    ],
    baseConfidenceWeight: 0.95,
    capabilities: [
      'neurological_examination',
      'stroke_evaluation',
      'seizure_management',
      'headache_diagnosis',
      'movement_disorder_assessment',
      'cognitive_evaluation',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['imaging', 'neurological_exam'],
  },

  pulmonology: {
    id: 'pulmonology',
    specialty: MedicalSpecialty.PULMONOLOGY,
    displayName: 'Pulmonologist',
    description: 'Respiratory disease diagnosis and management',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'shortness of breath',
      'dyspnea',
      'cough',
      'wheezing',
      'asthma',
      'copd',
      'pneumonia',
      'lung',
      'respiratory',
      'oxygen',
      'pulmonary',
      'chest xray',
    ],
    baseConfidenceWeight: 0.9,
    capabilities: [
      'respiratory_diagnosis',
      'pulmonary_function_interpretation',
      'asthma_copd_management',
      'oxygen_therapy',
      'ventilation_assessment',
      'lung_imaging_interpretation',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['imaging', 'pulmonary_function'],
  },

  gastroenterology: {
    id: 'gastroenterology',
    specialty: MedicalSpecialty.GASTROENTEROLOGY,
    displayName: 'Gastroenterologist',
    description: 'Digestive system disorders diagnosis and management',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'abdominal pain',
      'nausea',
      'vomiting',
      'diarrhea',
      'constipation',
      'blood in stool',
      'liver',
      'hepatitis',
      'ibd',
      'crohns',
      'colitis',
      'gerd',
      'gastric',
    ],
    baseConfidenceWeight: 0.9,
    capabilities: [
      'gi_diagnosis',
      'liver_disease_management',
      'inflammatory_bowel_disease',
      'endoscopy_interpretation',
      'nutrition_assessment',
      'gi_bleeding_management',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['lab_results', 'imaging'],
  },

  endocrinology: {
    id: 'endocrinology',
    specialty: MedicalSpecialty.ENDOCRINOLOGY,
    displayName: 'Endocrinologist',
    description: 'Hormonal and metabolic disorders',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'diabetes',
      'thyroid',
      'glucose',
      'hormone',
      'metabolic',
      'insulin',
      'weight',
      'fatigue',
      'endocrine',
      'adrenal',
      'pituitary',
    ],
    baseConfidenceWeight: 0.9,
    capabilities: [
      'diabetes_management',
      'thyroid_disorder_diagnosis',
      'hormone_replacement',
      'metabolic_syndrome_management',
      'endocrine_testing_interpretation',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['lab_results'],
  },

  oncology: {
    id: 'oncology',
    specialty: MedicalSpecialty.ONCOLOGY,
    displayName: 'Oncologist',
    description: 'Cancer diagnosis and treatment',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'cancer',
      'tumor',
      'malignancy',
      'mass',
      'lump',
      'metastasis',
      'chemotherapy',
      'radiation',
      'biopsy',
      'oncology',
    ],
    baseConfidenceWeight: 0.95,
    capabilities: [
      'cancer_staging',
      'treatment_planning',
      'chemotherapy_management',
      'tumor_board_recommendations',
      'palliative_care',
      'survivorship_care',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['imaging', 'pathology', 'lab_results'],
  },

  infectious_disease: {
    id: 'infectious_disease',
    specialty: MedicalSpecialty.INFECTIOUS_DISEASE,
    displayName: 'Infectious Disease Specialist',
    description: 'Infectious disease diagnosis and antimicrobial management',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'fever',
      'infection',
      'sepsis',
      'hiv',
      'hepatitis',
      'tb',
      'pneumonia',
      'meningitis',
      'antibiotic',
      'antimicrobial',
    ],
    baseConfidenceWeight: 0.95,
    capabilities: [
      'infection_diagnosis',
      'antimicrobial_stewardship',
      'sepsis_management',
      'hiv_management',
      'travel_medicine',
      'outbreak_investigation',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['lab_results', 'microbiology'],
  },

  // ============================================================================
  // DIAGNOSTIC SPECIALTIES
  // ============================================================================
  radiology: {
    id: 'radiology',
    specialty: MedicalSpecialty.RADIOLOGY,
    displayName: 'Radiologist',
    description: 'Medical imaging interpretation',
    spawnFrequency: SpawnFrequency.IMAGING_REQUESTS,
    baseConfidenceWeight: 1.0,
    capabilities: [
      'xray_interpretation',
      'ct_interpretation',
      'mri_interpretation',
      'ultrasound_interpretation',
      'pet_interpretation',
      'image_guided_procedures',
    ],
    defaultModel: 'openai/gpt-4o', // Multimodal for images
    requiresSpecialData: ['imaging'],
  },

  pathology: {
    id: 'pathology',
    specialty: MedicalSpecialty.PATHOLOGY,
    displayName: 'Pathologist',
    description: 'Laboratory and tissue diagnosis',
    spawnFrequency: SpawnFrequency.LAB_REQUESTS,
    baseConfidenceWeight: 1.0,
    capabilities: [
      'histopathology',
      'cytopathology',
      'laboratory_interpretation',
      'molecular_diagnostics',
      'blood_bank_management',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['lab_results', 'pathology'],
  },

  // ============================================================================
  // THERAPEUTIC SPECIALTIES
  // ============================================================================
  pharmacology: {
    id: 'pharmacology',
    specialty: MedicalSpecialty.PHARMACOLOGY,
    displayName: 'Clinical Pharmacist',
    description: 'Medication management and drug therapy optimization',
    spawnFrequency: SpawnFrequency.DRUG_QUERIES,
    baseConfidenceWeight: 1.0,
    capabilities: [
      'drug_interaction_checking',
      'medication_reconciliation',
      'dosing_optimization',
      'adverse_reaction_management',
      'therapeutic_drug_monitoring',
      'pharmacogenomics',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },

  surgery: {
    id: 'surgery',
    specialty: MedicalSpecialty.SURGERY,
    displayName: 'Surgeon',
    description: 'Surgical evaluation and operative planning',
    spawnFrequency: SpawnFrequency.SURGICAL_CANDIDATES,
    baseConfidenceWeight: 0.9,
    capabilities: [
      'surgical_candidacy_assessment',
      'operative_planning',
      'postoperative_management',
      'surgical_complications',
      'minimally_invasive_techniques',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['imaging', 'lab_results'],
  },

  psychiatry: {
    id: 'psychiatry',
    specialty: MedicalSpecialty.PSYCHIATRY,
    displayName: 'Psychiatrist',
    description: 'Mental health diagnosis and treatment',
    spawnFrequency: SpawnFrequency.KEYWORD_TRIGGERED,
    triggerKeywords: [
      'depression',
      'anxiety',
      'mood',
      'psychosis',
      'bipolar',
      'schizophrenia',
      'suicidal',
      'mental health',
      'psychiatric',
    ],
    baseConfidenceWeight: 0.85,
    capabilities: [
      'psychiatric_evaluation',
      'psychopharmacology',
      'crisis_intervention',
      'mood_disorder_management',
      'psychotherapy_recommendations',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },

  // ============================================================================
  // SUPPORT SPECIALTIES
  // ============================================================================
  clinical_research: {
    id: 'clinical_research',
    specialty: MedicalSpecialty.CLINICAL_RESEARCH,
    displayName: 'Clinical Research Specialist',
    description: 'Evidence synthesis and clinical trial matching',
    spawnFrequency: SpawnFrequency.COMPLEX_CASES,
    baseConfidenceWeight: 0.85,
    capabilities: [
      'literature_review',
      'evidence_synthesis',
      'clinical_trial_matching',
      'guideline_interpretation',
      'research_protocol_design',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },

  medical_documentation: {
    id: 'medical_documentation',
    specialty: MedicalSpecialty.MEDICAL_DOCUMENTATION,
    displayName: 'Medical Documentation Specialist',
    description: 'Clinical documentation and coding',
    spawnFrequency: SpawnFrequency.ALWAYS,
    baseConfidenceWeight: 0.8,
    capabilities: [
      'soap_note_generation',
      'icd10_coding',
      'cpt_coding',
      'billing_optimization',
      'documentation_compliance',
    ],
    defaultModel: 'anthropic/claude-3.5-haiku', // Fast and cost-effective
  },

  rare_disease_specialist: {
    id: 'rare_disease_specialist',
    specialty: MedicalSpecialty.RARE_DISEASE_SPECIALIST,
    displayName: 'Rare Disease Specialist',
    description: 'Rare and complex disease diagnosis',
    spawnFrequency: SpawnFrequency.RARE_SUSPICION,
    baseConfidenceWeight: 0.95,
    capabilities: [
      'rare_disease_diagnosis',
      'genetic_disorder_evaluation',
      'orphan_drug_therapy',
      'specialized_testing',
      'multidisciplinary_coordination',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    requiresSpecialData: ['genetic_testing', 'specialized_labs'],
  },
};

/**
 * Agent Registry Manager
 */
export class AgentRegistry {
  private agents: Map<string, AgentConfig>;

  constructor() {
    this.agents = new Map(Object.entries(AGENT_REGISTRY));
    logger.info(`Agent registry initialized with ${this.agents.size} agents`);
  }

  /**
   * Get agent configuration by ID
   */
  public getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  public getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by spawn frequency
   */
  public getAgentsBySpawnFrequency(frequency: SpawnFrequency): AgentConfig[] {
    return this.getAllAgents().filter((agent) => agent.spawnFrequency === frequency);
  }

  /**
   * Get agents by specialty
   */
  public getAgentsBySpecialty(specialty: MedicalSpecialty): AgentConfig | undefined {
    return this.getAllAgents().find((agent) => agent.specialty === specialty);
  }

  /**
   * Find agents by keywords
   */
  public findAgentsByKeywords(keywords: string[]): AgentConfig[] {
    const matchedAgents: AgentConfig[] = [];

    for (const agent of this.getAllAgents()) {
      if (!agent.triggerKeywords) continue;

      // Check if any keyword matches
      const hasMatch = keywords.some((keyword) =>
        agent.triggerKeywords!.some((trigger) =>
          keyword.toLowerCase().includes(trigger.toLowerCase()) ||
          trigger.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      if (hasMatch) {
        matchedAgents.push(agent);
      }
    }

    return matchedAgents;
  }

  /**
   * Get agents that always spawn
   */
  public getAlwaysSpawnAgents(): AgentConfig[] {
    return this.getAgentsBySpawnFrequency(SpawnFrequency.ALWAYS);
  }

  /**
   * Get high urgency agents
   */
  public getHighUrgencyAgents(): AgentConfig[] {
    return this.getAgentsBySpawnFrequency(SpawnFrequency.HIGH_URGENCY);
  }

  /**
   * Get agent count
   */
  public getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Validate agent exists
   */
  public hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();
