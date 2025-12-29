/**
 * PubMed Integration Service
 * Searches 30M+ medical articles for evidence-based medicine
 * Uses NCBI E-utilities API
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';
import config from '../../config';

const logger = createLogger('PubMedService');

/**
 * PubMed search query
 */
export interface PubMedSearchQuery {
  query: string;
  dateRange?: 'last_year' | 'last_2_years' | 'last_5_years' | 'last_10_years';
  studyTypes?: Array<'randomized_controlled_trial' | 'meta_analysis' | 'systematic_review' | 'clinical_trial' | 'review'>;
  limit?: number;
  minRelevanceScore?: number;
}

/**
 * PubMed article result
 */
export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
  studyType: string;
  relevanceScore: number;
  citationCount?: number;
  evidenceLevel?: 'high' | 'moderate' | 'low' | 'very_low';
}

/**
 * Evidence-based recommendations
 */
export interface EvidenceBasedRecommendation {
  recommendation: string;
  evidenceLevel: 'high' | 'moderate' | 'low' | 'very_low';
  gradeStrength: 'strong' | 'conditional' | 'weak';
  supportingStudies: PubMedArticle[];
  consensus: string;
}

/**
 * PubMed Service Class
 */
export class PubMedService {
  private client: AxiosInstance;
  private readonly baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly apiKey?: string;

  constructor() {
    this.apiKey = config.integrations?.pubmed?.apiKey;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      params: {
        api_key: this.apiKey,
        retmode: 'json'
      }
    });

    logger.info('PubMed Service initialized', {
      hasApiKey: !!this.apiKey,
      baseURL: this.baseURL
    });
  }

  /**
   * Search PubMed for medical literature
   */
  async search(query: PubMedSearchQuery): Promise<PubMedArticle[]> {
    try {
      logger.info('Searching PubMed', { query: query.query, limit: query.limit });

      // Build search query with filters
      const searchQuery = this.buildSearchQuery(query);

      // Step 1: Search for PMIDs
      const pmids = await this.searchPMIDs(searchQuery, query.limit || 10);

      if (pmids.length === 0) {
        logger.warn('No PubMed results found', { query: searchQuery });
        return [];
      }

      // Step 2: Fetch article details
      const articles = await this.fetchArticleDetails(pmids);

      // Step 3: Score relevance
      const scoredArticles = this.scoreRelevance(articles, query.query);

      // Step 4: Filter by minimum relevance score
      const filtered = query.minRelevanceScore
        ? scoredArticles.filter(a => a.relevanceScore >= query.minRelevanceScore!)
        : scoredArticles;

      // Step 5: Grade evidence level
      const graded = this.gradeEvidence(filtered);

      logger.info('PubMed search complete', {
        found: graded.length,
        query: searchQuery
      });

      return graded;
    } catch (error: any) {
      logger.error('PubMed search failed:', error);
      throw new Error(`PubMed search failed: ${error.message}`);
    }
  }

  /**
   * Get evidence-based recommendations from literature
   */
  async getRecommendations(
    condition: string,
    patientContext?: any
  ): Promise<EvidenceBasedRecommendation[]> {
    try {
      logger.info('Fetching evidence-based recommendations', { condition });

      // Search for high-quality studies
      const articles = await this.search({
        query: `${condition} treatment management`,
        studyTypes: ['meta_analysis', 'systematic_review', 'randomized_controlled_trial'],
        dateRange: 'last_5_years',
        limit: 20,
        minRelevanceScore: 0.6
      });

      // Extract recommendations from abstracts
      const recommendations = this.extractRecommendations(articles, condition);

      logger.info('Recommendations extracted', {
        count: recommendations.length,
        condition
      });

      return recommendations;
    } catch (error: any) {
      logger.error('Failed to get recommendations:', error);
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }
  }

  /**
   * Build search query with filters
   */
  private buildSearchQuery(query: PubMedSearchQuery): string {
    let searchQuery = query.query;

    // Add date range filter
    if (query.dateRange) {
      const dateFilter = this.getDateFilter(query.dateRange);
      searchQuery += ` AND ${dateFilter}`;
    }

    // Add study type filters
    if (query.studyTypes && query.studyTypes.length > 0) {
      const typeFilters = query.studyTypes
        .map(type => this.getStudyTypeFilter(type))
        .join(' OR ');
      searchQuery += ` AND (${typeFilters})`;
    }

    return searchQuery;
  }

  /**
   * Search for PMIDs
   */
  private async searchPMIDs(query: string, limit: number): Promise<string[]> {
    const response = await this.client.get('/esearch.fcgi', {
      params: {
        db: 'pubmed',
        term: query,
        retmax: limit,
        sort: 'relevance'
      }
    });

    return response.data.esearchresult?.idlist || [];
  }

  /**
   * Fetch article details for PMIDs
   */
  private async fetchArticleDetails(pmids: string[]): Promise<any[]> {
    if (pmids.length === 0) return [];

    const response = await this.client.get('/esummary.fcgi', {
      params: {
        db: 'pubmed',
        id: pmids.join(',')
      }
    });

    const results = response.data.result;
    if (!results) return [];

    // Convert to array
    return pmids.map(pmid => results[pmid]).filter(Boolean);
  }

  /**
   * Score relevance of articles
   */
  private scoreRelevance(articles: any[], query: string): PubMedArticle[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    return articles.map(article => {
      const title = (article.title || '').toLowerCase();
      const abstract = (article.abstract || '').toLowerCase();

      // Calculate relevance score (0.0 - 1.0)
      let score = 0;
      let matches = 0;

      queryTerms.forEach(term => {
        if (title.includes(term)) {
          score += 0.5; // Title match worth more
          matches++;
        }
        if (abstract.includes(term)) {
          score += 0.3; // Abstract match
          matches++;
        }
      });

      const relevanceScore = Math.min(score / queryTerms.length, 1.0);

      return {
        pmid: article.uid,
        title: article.title || '',
        abstract: article.abstract || '',
        authors: article.authors?.map((a: any) => a.name) || [],
        journal: article.fulljournalname || article.source || '',
        publicationDate: article.pubdate || '',
        doi: article.elocationid || article.doi,
        studyType: this.detectStudyType(article),
        relevanceScore,
        citationCount: article.pmc_refs_count || 0
      };
    });
  }

  /**
   * Grade evidence level using GRADE system
   */
  private gradeEvidence(articles: PubMedArticle[]): PubMedArticle[] {
    return articles.map(article => {
      let evidenceLevel: 'high' | 'moderate' | 'low' | 'very_low' = 'very_low';

      // GRADE system based on study type
      switch (article.studyType) {
        case 'meta_analysis':
        case 'systematic_review':
          evidenceLevel = 'high';
          break;
        case 'randomized_controlled_trial':
          evidenceLevel = 'moderate';
          break;
        case 'clinical_trial':
          evidenceLevel = 'low';
          break;
        default:
          evidenceLevel = 'very_low';
      }

      // Adjust based on recency (newer = better)
      const year = parseInt(article.publicationDate?.split(' ')[0] || '2000');
      const currentYear = new Date().getFullYear();
      if (currentYear - year > 10) {
        evidenceLevel = this.downgradeEvidence(evidenceLevel);
      }

      return { ...article, evidenceLevel };
    });
  }

  /**
   * Extract recommendations from articles
   */
  private extractRecommendations(
    articles: PubMedArticle[],
    condition: string
  ): EvidenceBasedRecommendation[] {
    const recommendations: Map<string, EvidenceBasedRecommendation> = new Map();

    articles.forEach(article => {
      // Extract key recommendations from abstract
      const recs = this.parseRecommendationsFromAbstract(article.abstract);

      recs.forEach(rec => {
        const existing = recommendations.get(rec);
        if (existing) {
          existing.supportingStudies.push(article);
        } else {
          recommendations.set(rec, {
            recommendation: rec,
            evidenceLevel: article.evidenceLevel || 'very_low',
            gradeStrength: this.determineGradeStrength(article.evidenceLevel || 'very_low'),
            supportingStudies: [article],
            consensus: 'Supported by multiple studies'
          });
        }
      });
    });

    return Array.from(recommendations.values());
  }

  /**
   * Parse recommendations from abstract text
   */
  private parseRecommendationsFromAbstract(abstract: string): string[] {
    const recommendations: string[] = [];

    // Simple keyword-based extraction (would use NLP in production)
    const sentences = abstract.split(/[.!?]+/);

    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();
      if (
        lower.includes('recommend') ||
        lower.includes('should') ||
        lower.includes('treatment') ||
        lower.includes('effective')
      ) {
        recommendations.push(sentence.trim());
      }
    });

    return recommendations.slice(0, 3); // Top 3 recommendations per article
  }

  /**
   * Detect study type from article metadata
   */
  private detectStudyType(article: any): string {
    const title = (article.title || '').toLowerCase();
    const pubTypes = article.pubtype || [];

    if (pubTypes.includes('Meta-Analysis') || title.includes('meta-analysis')) {
      return 'meta_analysis';
    }
    if (pubTypes.includes('Systematic Review') || title.includes('systematic review')) {
      return 'systematic_review';
    }
    if (pubTypes.includes('Randomized Controlled Trial') || title.includes('randomized')) {
      return 'randomized_controlled_trial';
    }
    if (pubTypes.includes('Clinical Trial') || title.includes('clinical trial')) {
      return 'clinical_trial';
    }

    return 'observational';
  }

  /**
   * Get date filter for query
   */
  private getDateFilter(dateRange: string): string {
    const currentYear = new Date().getFullYear();
    switch (dateRange) {
      case 'last_year':
        return `${currentYear - 1}:${currentYear}[pdat]`;
      case 'last_2_years':
        return `${currentYear - 2}:${currentYear}[pdat]`;
      case 'last_5_years':
        return `${currentYear - 5}:${currentYear}[pdat]`;
      case 'last_10_years':
        return `${currentYear - 10}:${currentYear}[pdat]`;
      default:
        return `${currentYear - 5}:${currentYear}[pdat]`;
    }
  }

  /**
   * Get study type filter for query
   */
  private getStudyTypeFilter(studyType: string): string {
    switch (studyType) {
      case 'meta_analysis':
        return 'Meta-Analysis[pt]';
      case 'systematic_review':
        return 'Systematic Review[pt]';
      case 'randomized_controlled_trial':
        return 'Randomized Controlled Trial[pt]';
      case 'clinical_trial':
        return 'Clinical Trial[pt]';
      case 'review':
        return 'Review[pt]';
      default:
        return '';
    }
  }

  /**
   * Downgrade evidence level
   */
  private downgradeEvidence(level: string): 'high' | 'moderate' | 'low' | 'very_low' {
    switch (level) {
      case 'high':
        return 'moderate';
      case 'moderate':
        return 'low';
      case 'low':
        return 'very_low';
      default:
        return 'very_low';
    }
  }

  /**
   * Determine GRADE strength
   */
  private determineGradeStrength(evidenceLevel: string): 'strong' | 'conditional' | 'weak' {
    switch (evidenceLevel) {
      case 'high':
        return 'strong';
      case 'moderate':
        return 'conditional';
      default:
        return 'weak';
    }
  }
}

// Export singleton instance
export const pubMedService = new PubMedService();
