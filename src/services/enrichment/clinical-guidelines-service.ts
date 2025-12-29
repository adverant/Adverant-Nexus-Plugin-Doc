/**
 * Clinical Guidelines Service
 * Provides evidence-based clinical guidelines from AHA, ACC, WHO, CDC, etc.
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('ClinicalGuidelinesService');

/**
 * Clinical guideline
 */
export interface ClinicalGuideline {
  id: string;
  title: string;
  organization: string;
  year: number;
  specialty: string;
  condition: string;
  recommendations: GuidelineRecommendation[];
  evidenceBase: string;
  url?: string;
}

/**
 * Guideline recommendation
 */
export interface GuidelineRecommendation {
  recommendation: string;
  classOfRecommendation: 'I' | 'IIa' | 'IIb' | 'III';
  levelOfEvidence: 'A' | 'B' | 'C';
  description: string;
}

/**
 * Clinical Guidelines Service Class
 */
export class ClinicalGuidelinesService {
  // In-memory guideline database (would use real database in production)
  private guidelines: Map<string, ClinicalGuideline[]>;

  constructor() {
    this.guidelines = new Map();
    this.loadGuidelines();
    logger.info('Clinical Guidelines Service initialized');
  }

  /**
   * Get guidelines for condition
   */
  async getGuidelines(condition: string, specialty?: string): Promise<ClinicalGuideline[]> {
    try {
      logger.info('Fetching clinical guidelines', { condition, specialty });

      const conditionKey = condition.toLowerCase();
      let guidelines = this.guidelines.get(conditionKey) || [];

      // Filter by specialty if provided
      if (specialty) {
        guidelines = guidelines.filter(g => g.specialty.toLowerCase() === specialty.toLowerCase());
      }

      // Sort by year (newest first)
      guidelines.sort((a, b) => b.year - a.year);

      logger.info('Guidelines retrieved', {
        condition,
        count: guidelines.length
      });

      return guidelines;
    } catch (error: any) {
      logger.error('Failed to get guidelines:', error);
      throw new Error(`Failed to get guidelines: ${error.message}`);
    }
  }

  /**
   * Get recommendations for specific condition and context
   */
  async getRecommendations(
    condition: string,
    patientContext?: any
  ): Promise<GuidelineRecommendation[]> {
    const guidelines = await this.getGuidelines(condition);

    // Extract all Class I recommendations (strongest)
    const classIRecommendations = guidelines.flatMap(g =>
      g.recommendations.filter(r => r.classOfRecommendation === 'I')
    );

    // Extract Class IIa recommendations (reasonable)
    const classIIaRecommendations = guidelines.flatMap(g =>
      g.recommendations.filter(r => r.classOfRecommendation === 'IIa')
    );

    // Combine with priority to Class I
    return [...classIRecommendations, ...classIIaRecommendations];
  }

  /**
   * Load guidelines into memory
   */
  private loadGuidelines(): void {
    // AHA/ACC STEMI Guidelines 2023
    this.addGuideline({
      id: 'aha-acc-stemi-2023',
      title: '2023 ACC/AHA/SCAI Guideline for Coronary Artery Revascularization',
      organization: 'AHA/ACC',
      year: 2023,
      specialty: 'cardiology',
      condition: 'myocardial infarction',
      evidenceBase: 'Systematic review of RCTs and observational studies',
      url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001168',
      recommendations: [
        {
          recommendation: 'Immediate reperfusion therapy for STEMI patients',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Primary PCI should be performed within 90 minutes of first medical contact for STEMI patients'
        },
        {
          recommendation: 'Dual antiplatelet therapy (DAPT) for 12 months',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Aspirin + P2Y12 inhibitor (ticagrelor or prasugrel preferred over clopidogrel)'
        },
        {
          recommendation: 'High-intensity statin therapy',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Initiate high-intensity statin therapy (atorvastatin 80mg or rosuvastatin 40mg)'
        }
      ]
    });

    // AHA/ASA Stroke Guidelines 2023
    this.addGuideline({
      id: 'aha-asa-stroke-2023',
      title: '2023 Guideline for the Management of Patients With Acute Ischemic Stroke',
      organization: 'AHA/ASA',
      year: 2023,
      specialty: 'neurology',
      condition: 'stroke',
      evidenceBase: 'Systematic review of RCTs',
      url: 'https://www.ahajournals.org/stroke',
      recommendations: [
        {
          recommendation: 'IV alteplase within 4.5 hours of symptom onset',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'For eligible patients, administer IV tPA within 4.5 hours of last known well time'
        },
        {
          recommendation: 'Mechanical thrombectomy for large vessel occlusion',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Endovascular therapy within 6 hours (up to 24h for select patients) for anterior circulation LVO'
        }
      ]
    });

    // ACC/AHA Atrial Fibrillation Guidelines 2023
    this.addGuideline({
      id: 'acc-aha-afib-2023',
      title: '2023 ACC/AHA/ACCP/HRS Guideline for the Diagnosis and Management of Atrial Fibrillation',
      organization: 'ACC/AHA',
      year: 2023,
      specialty: 'cardiology',
      condition: 'atrial fibrillation',
      evidenceBase: 'Systematic review and meta-analysis',
      url: 'https://www.ahajournals.org/circulation/atrial-fibrillation',
      recommendations: [
        {
          recommendation: 'Oral anticoagulation for stroke prevention (CHADS2-VASc ≥2)',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'DOACs preferred over warfarin for non-valvular AF'
        },
        {
          recommendation: 'Rate control as initial strategy',
          classOfRecommendation: 'I',
          levelOfEvidence: 'B',
          description: 'Beta-blockers or non-dihydropyridine CCBs for rate control'
        }
      ]
    });

    // ADA Diabetes Guidelines 2024
    this.addGuideline({
      id: 'ada-diabetes-2024',
      title: '2024 Standards of Care in Diabetes',
      organization: 'ADA',
      year: 2024,
      specialty: 'endocrinology',
      condition: 'diabetes',
      evidenceBase: 'Consensus from clinical trials',
      url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
      recommendations: [
        {
          recommendation: 'HbA1c target <7% for most adults',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Individualize targets based on patient factors'
        },
        {
          recommendation: 'Metformin as first-line therapy',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Initiate metformin along with lifestyle modifications at diagnosis'
        },
        {
          recommendation: 'SGLT2i or GLP-1 RA for patients with established CVD or CKD',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Add agent with proven cardiovascular benefit'
        }
      ]
    });

    // GOLD COPD Guidelines 2024
    this.addGuideline({
      id: 'gold-copd-2024',
      title: '2024 Global Strategy for Prevention, Diagnosis and Management of COPD',
      organization: 'GOLD',
      year: 2024,
      specialty: 'pulmonology',
      condition: 'copd',
      evidenceBase: 'International consensus',
      url: 'https://goldcopd.org/',
      recommendations: [
        {
          recommendation: 'Smoking cessation interventions for all COPD patients',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Most effective intervention to reduce disease progression'
        },
        {
          recommendation: 'Long-acting bronchodilators for symptomatic patients',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'LABA or LAMA monotherapy or combination'
        }
      ]
    });

    // WHO COVID-19 Guidelines 2024
    this.addGuideline({
      id: 'who-covid-2024',
      title: 'WHO COVID-19 Clinical Management: Living Guideline',
      organization: 'WHO',
      year: 2024,
      specialty: 'infectious disease',
      condition: 'covid-19',
      evidenceBase: 'Living systematic review',
      url: 'https://www.who.int/publications/i/item/WHO-2019-nCoV-clinical-2023.2',
      recommendations: [
        {
          recommendation: 'Corticosteroids for severe and critical COVID-19',
          classOfRecommendation: 'I',
          levelOfEvidence: 'A',
          description: 'Dexamethasone 6mg daily (or equivalent) for up to 10 days'
        },
        {
          recommendation: 'IL-6 receptor blockers for severe COVID-19',
          classOfRecommendation: 'IIa',
          levelOfEvidence: 'B',
          description: 'Tocilizumab or sarilumab in addition to corticosteroids'
        }
      ]
    });

    logger.info(`Loaded ${this.countGuidelines()} clinical guidelines`);
  }

  /**
   * Add guideline to database
   */
  private addGuideline(guideline: ClinicalGuideline): void {
    const key = guideline.condition.toLowerCase();
    const existing = this.guidelines.get(key) || [];
    existing.push(guideline);
    this.guidelines.set(key, existing);
  }

  /**
   * Count total guidelines
   */
  private countGuidelines(): number {
    let count = 0;
    this.guidelines.forEach(guidelines => {
      count += guidelines.length;
    });
    return count;
  }

  /**
   * Search guidelines by keywords
   */
  async searchGuidelines(keywords: string[]): Promise<ClinicalGuideline[]> {
    const results: ClinicalGuideline[] = [];
    const keywordLower = keywords.map(k => k.toLowerCase());

    this.guidelines.forEach(guidelines => {
      guidelines.forEach(guideline => {
        const searchText = `${guideline.title} ${guideline.condition} ${guideline.specialty}`.toLowerCase();

        if (keywordLower.some(keyword => searchText.includes(keyword))) {
          results.push(guideline);
        }
      });
    });

    // Sort by year (newest first)
    return results.sort((a, b) => b.year - a.year);
  }
}

// Export singleton instance
export const clinicalGuidelinesService = new ClinicalGuidelinesService();
