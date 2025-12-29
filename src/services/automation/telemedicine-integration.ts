/**
 * Telemedicine Integration Service
 * Real-time monitoring and remote patient care integration
 * - Real-time vital signs monitoring
 * - Remote patient monitoring alerts
 * - Video consultation integration hooks
 * - Wearable device data ingestion (Fitbit, Apple Watch, etc.)
 * - IoMT (Internet of Medical Things) integration
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';
import config from '../../config';
import { ConsultationResult } from '../consultation-orchestration-service';

const logger = createLogger('TelemedicineIntegration');

/**
 * Vital signs data point
 */
export interface VitalSign {
  type: 'heart_rate' | 'blood_pressure' | 'temperature' | 'oxygen_saturation' | 'respiratory_rate' | 'glucose' | 'weight';
  value: number | { systolic: number; diastolic: number }; // BP is special
  unit: string;
  timestamp: Date;
  source: 'manual' | 'device' | 'wearable' | 'ehr';
  deviceId?: string;
  accuracy?: number; // 0.0-1.0
}

/**
 * Vital signs ingestion request
 */
export interface VitalSignsIngestionRequest {
  patientId: string;
  vitals: VitalSign[];
  consultationId?: string;
}

/**
 * Vital signs alert
 */
export interface VitalSignsAlert {
  alertId: string;
  patientId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'abnormal_vital' | 'trend_deterioration' | 'device_disconnected' | 'missed_reading';
  vitalSign?: VitalSign;
  message: string;
  recommendation: string;
  requiresImmediate: boolean;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Remote patient monitoring session
 */
export interface RPMSession {
  sessionId: string;
  patientId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'alert';
  monitoredVitals: VitalSign['type'][];
  alerts: VitalSignsAlert[];
  summaryStatistics: {
    vitalType: VitalSign['type'];
    min: number;
    max: number;
    avg: number;
    trend: 'improving' | 'stable' | 'worsening';
  }[];
}

/**
 * Wearable device data
 */
export interface WearableDeviceData {
  deviceId: string;
  deviceType: 'fitbit' | 'apple_watch' | 'garmin' | 'samsung_health' | 'whoop' | 'oura_ring';
  patientId: string;
  lastSync: Date;
  data: {
    steps?: number;
    heartRate?: VitalSign[];
    sleep?: {
      duration: number; // minutes
      quality: 'poor' | 'fair' | 'good' | 'excellent';
      stages: {
        deep: number;
        light: number;
        rem: number;
        awake: number;
      };
    };
    activity?: {
      type: string;
      duration: number; // minutes
      calories: number;
    }[];
    heartRateVariability?: number; // ms
    respiratoryRate?: number; // breaths per minute
    bloodOxygen?: number; // %
  };
}

/**
 * Video consultation context
 */
export interface VideoConsultationContext {
  consultationId: string;
  patientId: string;
  providerId: string;
  scheduledTime: Date;
  realtimeVitals?: VitalSign[];
  recentAlerts?: VitalSignsAlert[];
  patientHistory?: {
    priorConsultations: number;
    chronicConditions: string[];
    currentMedications: string[];
    recentVitals: VitalSign[];
  };
  aiRecommendations?: {
    suggestedQuestions: string[];
    riskFactors: string[];
    clinicalGuidelines: string[];
  };
}

/**
 * Alert generation result
 */
export interface AlertGenerationResult {
  alerts: VitalSignsAlert[];
  summary: {
    total: number;
    bySeverity: Record<VitalSignsAlert['severity'], number>;
    requiresImmediateAction: number;
  };
}

/**
 * Telemedicine Integration Service Class
 */
export class TelemedicineIntegration {
  private rpmAPI?: AxiosInstance;
  private wearableAPI?: AxiosInstance;
  private activeSessions: Map<string, RPMSession>;
  private alertThresholds: Map<VitalSign['type'], { min: number; max: number }>;

  constructor() {
    this.activeSessions = new Map();
    this.alertThresholds = this.initializeAlertThresholds();

    // Initialize RPM API if configured
    if (config.integrations?.telemedicine?.rpmApiKey) {
      this.rpmAPI = axios.create({
        baseURL: config.integrations.telemedicine.rpmApiUrl || 'https://api.rpm.healthcare',
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${config.integrations.telemedicine.rpmApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('RPM API initialized');
    }

    // Initialize Wearable API if configured
    if (config.integrations?.wearables?.apiKey) {
      this.wearableAPI = axios.create({
        baseURL: config.integrations.wearables.apiUrl || 'https://api.wearables.com',
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${config.integrations.wearables.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Wearable API initialized');
    }

    logger.info('Telemedicine Integration Service initialized', {
      hasRPMAPI: !!this.rpmAPI,
      hasWearableAPI: !!this.wearableAPI,
    });
  }

  /**
   * Ingest vital signs from devices/manual entry
   */
  async ingestVitals(
    request: VitalSignsIngestionRequest
  ): Promise<{
    ingested: number;
    alerts: VitalSignsAlert[];
    sessionId?: string;
  }> {
    try {
      logger.info('Ingesting vital signs', {
        patientId: request.patientId,
        vitalCount: request.vitals.length,
      });

      // Validate vitals
      const validVitals = this.validateVitals(request.vitals);

      // Store vitals (would persist to database)
      const storedCount = validVitals.length;

      // Generate alerts for abnormal vitals
      const alerts = await this.generateAlerts({
        patientId: request.patientId,
        vitals: validVitals,
        consultationId: request.consultationId,
      });

      // Update or create RPM session
      let sessionId: string | undefined;
      const activeSession = this.findActiveSession(request.patientId);
      if (activeSession) {
        this.updateSession(activeSession.sessionId, validVitals, alerts.alerts);
        sessionId = activeSession.sessionId;
      }

      logger.info('Vital signs ingestion complete', {
        patientId: request.patientId,
        ingested: storedCount,
        alertsGenerated: alerts.alerts.length,
      });

      return {
        ingested: storedCount,
        alerts: alerts.alerts,
        sessionId,
      };
    } catch (error: any) {
      logger.error('Failed to ingest vitals:', error);
      throw new Error(`Vital signs ingestion failed: ${error.message}`);
    }
  }

  /**
   * Generate alerts from vital signs
   */
  async generateAlerts(request: {
    patientId: string;
    vitals: VitalSign[];
    consultationId?: string;
  }): Promise<AlertGenerationResult> {
    try {
      logger.debug('Generating alerts from vitals', {
        patientId: request.patientId,
        vitalCount: request.vitals.length,
      });

      const alerts: VitalSignsAlert[] = [];

      // Check each vital against thresholds
      for (const vital of request.vitals) {
        const alert = this.checkVitalThreshold(vital, request.patientId);
        if (alert) {
          alerts.push(alert);
        }
      }

      // Check for trend deterioration
      const trendAlerts = await this.checkTrendDeterioration(
        request.patientId,
        request.vitals
      );
      alerts.push(...trendAlerts);

      // Calculate summary
      const summary = this.calculateAlertSummary(alerts);

      logger.debug('Alert generation complete', {
        totalAlerts: alerts.length,
        criticalAlerts: summary.bySeverity.CRITICAL,
      });

      return { alerts, summary };
    } catch (error: any) {
      logger.error('Failed to generate alerts:', error);
      return {
        alerts: [],
        summary: {
          total: 0,
          bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
          requiresImmediateAction: 0,
        },
      };
    }
  }

  /**
   * Prepare video consultation context
   */
  async prepareConsultationContext(
    consultationId: string,
    patientId: string,
    providerId: string
  ): Promise<VideoConsultationContext> {
    try {
      logger.info('Preparing video consultation context', {
        consultationId,
        patientId,
      });

      // Get real-time vitals
      const realtimeVitals = await this.getRecentVitals(patientId, 60); // Last 60 minutes

      // Get recent alerts
      const recentAlerts = await this.getRecentAlerts(patientId, 24); // Last 24 hours

      // Get patient history (would fetch from EHR)
      const patientHistory = await this.getPatientHistory(patientId);

      // Generate AI recommendations
      const aiRecommendations = this.generateConsultationRecommendations(
        realtimeVitals,
        recentAlerts,
        patientHistory
      );

      const context: VideoConsultationContext = {
        consultationId,
        patientId,
        providerId,
        scheduledTime: new Date(),
        realtimeVitals,
        recentAlerts,
        patientHistory,
        aiRecommendations,
      };

      logger.info('Video consultation context prepared', {
        consultationId,
        hasRealtimeVitals: realtimeVitals.length > 0,
        hasAlerts: recentAlerts.length > 0,
      });

      return context;
    } catch (error: any) {
      logger.error('Failed to prepare consultation context:', error);
      throw new Error(`Consultation context preparation failed: ${error.message}`);
    }
  }

  /**
   * Ingest wearable device data
   */
  async ingestWearableData(deviceData: WearableDeviceData): Promise<{
    vitalsExtracted: VitalSign[];
    alerts: VitalSignsAlert[];
  }> {
    try {
      logger.info('Ingesting wearable device data', {
        deviceId: deviceData.deviceId,
        deviceType: deviceData.deviceType,
        patientId: deviceData.patientId,
      });

      // Extract vital signs from wearable data
      const vitals = this.extractVitalsFromWearable(deviceData);

      // Ingest extracted vitals
      const ingestionResult = await this.ingestVitals({
        patientId: deviceData.patientId,
        vitals,
      });

      logger.info('Wearable data ingestion complete', {
        deviceId: deviceData.deviceId,
        vitalsExtracted: vitals.length,
        alertsGenerated: ingestionResult.alerts.length,
      });

      return {
        vitalsExtracted: vitals,
        alerts: ingestionResult.alerts,
      };
    } catch (error: any) {
      logger.error('Failed to ingest wearable data:', error);
      throw new Error(`Wearable data ingestion failed: ${error.message}`);
    }
  }

  /**
   * Start remote patient monitoring session
   */
  async startRPMSession(
    patientId: string,
    monitoredVitals: VitalSign['type'][]
  ): Promise<RPMSession> {
    const sessionId = `rpm_${Date.now()}_${patientId}`;

    const session: RPMSession = {
      sessionId,
      patientId,
      startTime: new Date(),
      status: 'active',
      monitoredVitals,
      alerts: [],
      summaryStatistics: [],
    };

    this.activeSessions.set(sessionId, session);

    logger.info('RPM session started', {
      sessionId,
      patientId,
      monitoredVitals,
    });

    return session;
  }

  /**
   * Stop remote patient monitoring session
   */
  async stopRPMSession(sessionId: string): Promise<RPMSession> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`RPM session ${sessionId} not found`);
    }

    session.endTime = new Date();
    session.status = 'completed';

    // Calculate summary statistics (would use actual data)
    session.summaryStatistics = this.calculateSessionStatistics(session);

    this.activeSessions.delete(sessionId);

    logger.info('RPM session stopped', {
      sessionId,
      duration: session.endTime.getTime() - session.startTime.getTime(),
      alerts: session.alerts.length,
    });

    return session;
  }

  /**
   * Get RPM session status
   */
  getRPMSession(sessionId: string): RPMSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Validate vital signs
   */
  private validateVitals(vitals: VitalSign[]): VitalSign[] {
    return vitals.filter((vital) => {
      // Check for required fields
      if (!vital.type || vital.value === undefined || !vital.timestamp) {
        logger.warn('Invalid vital sign - missing required fields', { vital });
        return false;
      }

      // Check for reasonable ranges
      if (!this.isVitalValueReasonable(vital)) {
        logger.warn('Invalid vital sign - value out of reasonable range', { vital });
        return false;
      }

      return true;
    });
  }

  /**
   * Check if vital value is within reasonable range
   */
  private isVitalValueReasonable(vital: VitalSign): boolean {
    switch (vital.type) {
      case 'heart_rate':
        return typeof vital.value === 'number' && vital.value > 0 && vital.value < 300;
      case 'temperature':
        return typeof vital.value === 'number' && vital.value > 80 && vital.value < 115; // Fahrenheit
      case 'oxygen_saturation':
        return typeof vital.value === 'number' && vital.value > 0 && vital.value <= 100;
      case 'respiratory_rate':
        return typeof vital.value === 'number' && vital.value > 0 && vital.value < 60;
      case 'glucose':
        return typeof vital.value === 'number' && vital.value > 0 && vital.value < 1000;
      case 'blood_pressure':
        if (typeof vital.value === 'object' && 'systolic' in vital.value) {
          return (
            vital.value.systolic > 0 &&
            vital.value.systolic < 300 &&
            vital.value.diastolic > 0 &&
            vital.value.diastolic < 200
          );
        }
        return false;
      default:
        return true;
    }
  }

  /**
   * Check vital against thresholds
   */
  private checkVitalThreshold(
    vital: VitalSign,
    patientId: string
  ): VitalSignsAlert | null {
    const threshold = this.alertThresholds.get(vital.type);
    if (!threshold) return null;

    let isAbnormal = false;
    let severity: VitalSignsAlert['severity'] = 'LOW';
    let message = '';

    if (vital.type === 'blood_pressure' && typeof vital.value === 'object') {
      const { systolic, diastolic } = vital.value;

      if (systolic >= 180 || diastolic >= 120) {
        isAbnormal = true;
        severity = 'CRITICAL';
        message = `Hypertensive crisis: ${systolic}/${diastolic} mmHg`;
      } else if (systolic >= 140 || diastolic >= 90) {
        isAbnormal = true;
        severity = 'HIGH';
        message = `Hypertension: ${systolic}/${diastolic} mmHg`;
      } else if (systolic < 90 || diastolic < 60) {
        isAbnormal = true;
        severity = 'MEDIUM';
        message = `Hypotension: ${systolic}/${diastolic} mmHg`;
      }
    } else if (typeof vital.value === 'number') {
      if (vital.value < threshold.min) {
        isAbnormal = true;
        severity = vital.value < threshold.min * 0.8 ? 'HIGH' : 'MEDIUM';
        message = `Low ${vital.type}: ${vital.value} ${vital.unit}`;
      } else if (vital.value > threshold.max) {
        isAbnormal = true;
        severity = vital.value > threshold.max * 1.2 ? 'HIGH' : 'MEDIUM';
        message = `High ${vital.type}: ${vital.value} ${vital.unit}`;
      }
    }

    if (!isAbnormal) return null;

    return {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      severity,
      type: 'abnormal_vital',
      vitalSign: vital,
      message,
      recommendation: this.getVitalRecommendation(vital, severity),
      requiresImmediate: severity === 'CRITICAL',
      timestamp: new Date(),
      acknowledged: false,
    };
  }

  /**
   * Check for trend deterioration
   */
  private async checkTrendDeterioration(
    patientId: string,
    currentVitals: VitalSign[]
  ): Promise<VitalSignsAlert[]> {
    // Simplified - would use historical data and trend analysis
    // For now, return empty array
    return [];
  }

  /**
   * Get vital recommendation
   */
  private getVitalRecommendation(
    vital: VitalSign,
    severity: VitalSignsAlert['severity']
  ): string {
    if (severity === 'CRITICAL') {
      return 'Immediate medical attention required. Contact emergency services.';
    }

    switch (vital.type) {
      case 'blood_pressure':
        return 'Monitor closely and consider antihypertensive medication adjustment';
      case 'heart_rate':
        return 'Check for arrhythmia and assess patient symptoms';
      case 'oxygen_saturation':
        return 'Provide supplemental oxygen if SpO2 < 90%';
      case 'temperature':
        return 'Assess for infection and consider antipyretic medication';
      case 'glucose':
        return 'Review insulin/medication dosing and dietary intake';
      default:
        return 'Clinical assessment recommended';
    }
  }

  /**
   * Extract vitals from wearable data
   */
  private extractVitalsFromWearable(deviceData: WearableDeviceData): VitalSign[] {
    const vitals: VitalSign[] = [];

    // Extract heart rate data
    if (deviceData.data.heartRate) {
      vitals.push(...deviceData.data.heartRate);
    }

    // Extract blood oxygen (if available)
    if (deviceData.data.bloodOxygen) {
      vitals.push({
        type: 'oxygen_saturation',
        value: deviceData.data.bloodOxygen,
        unit: '%',
        timestamp: deviceData.lastSync,
        source: 'wearable',
        deviceId: deviceData.deviceId,
      });
    }

    // Extract respiratory rate (if available)
    if (deviceData.data.respiratoryRate) {
      vitals.push({
        type: 'respiratory_rate',
        value: deviceData.data.respiratoryRate,
        unit: 'breaths/min',
        timestamp: deviceData.lastSync,
        source: 'wearable',
        deviceId: deviceData.deviceId,
      });
    }

    return vitals;
  }

  /**
   * Get recent vitals for patient
   */
  private async getRecentVitals(
    patientId: string,
    minutes: number
  ): Promise<VitalSign[]> {
    // Would fetch from database in production
    // For now, return empty array
    return [];
  }

  /**
   * Get recent alerts for patient
   */
  private async getRecentAlerts(
    patientId: string,
    hours: number
  ): Promise<VitalSignsAlert[]> {
    // Would fetch from database in production
    // For now, return empty array
    return [];
  }

  /**
   * Get patient history
   */
  private async getPatientHistory(patientId: string): Promise<
    VideoConsultationContext['patientHistory']
  > {
    // Would fetch from EHR in production
    return {
      priorConsultations: 0,
      chronicConditions: [],
      currentMedications: [],
      recentVitals: [],
    };
  }

  /**
   * Generate consultation recommendations
   */
  private generateConsultationRecommendations(
    realtimeVitals: VitalSign[],
    recentAlerts: VitalSignsAlert[],
    patientHistory?: VideoConsultationContext['patientHistory']
  ): VideoConsultationContext['aiRecommendations'] {
    const suggestedQuestions: string[] = [];
    const riskFactors: string[] = [];
    const clinicalGuidelines: string[] = [];

    // Analyze vitals for questions
    if (realtimeVitals.some((v) => v.type === 'blood_pressure')) {
      suggestedQuestions.push('How have you been managing your blood pressure medications?');
    }

    // Analyze alerts for risk factors
    if (recentAlerts.some((a) => a.severity === 'CRITICAL')) {
      riskFactors.push('Recent critical vital sign alerts');
    }

    return {
      suggestedQuestions,
      riskFactors,
      clinicalGuidelines,
    };
  }

  /**
   * Find active RPM session for patient
   */
  private findActiveSession(patientId: string): RPMSession | undefined {
    return Array.from(this.activeSessions.values()).find(
      (session) => session.patientId === patientId && session.status === 'active'
    );
  }

  /**
   * Update RPM session with new vitals and alerts
   */
  private updateSession(
    sessionId: string,
    vitals: VitalSign[],
    alerts: VitalSignsAlert[]
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.alerts.push(...alerts);

    // Update status if critical alerts
    if (alerts.some((a) => a.severity === 'CRITICAL')) {
      session.status = 'alert';
    }
  }

  /**
   * Calculate session statistics
   */
  private calculateSessionStatistics(
    session: RPMSession
  ): RPMSession['summaryStatistics'] {
    // Simplified - would calculate from actual data
    return [];
  }

  /**
   * Calculate alert summary
   */
  private calculateAlertSummary(alerts: VitalSignsAlert[]): AlertGenerationResult['summary'] {
    const summary = {
      total: alerts.length,
      bySeverity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      } as Record<VitalSignsAlert['severity'], number>,
      requiresImmediateAction: 0,
    };

    alerts.forEach((alert) => {
      summary.bySeverity[alert.severity]++;
      if (alert.requiresImmediate) {
        summary.requiresImmediateAction++;
      }
    });

    return summary;
  }

  /**
   * Initialize alert thresholds
   */
  private initializeAlertThresholds(): Map<
    VitalSign['type'],
    { min: number; max: number }
  > {
    const thresholds = new Map<VitalSign['type'], { min: number; max: number }>();

    // Normal ranges for adults
    thresholds.set('heart_rate', { min: 60, max: 100 }); // bpm
    thresholds.set('respiratory_rate', { min: 12, max: 20 }); // breaths/min
    thresholds.set('temperature', { min: 97.0, max: 99.5 }); // Fahrenheit
    thresholds.set('oxygen_saturation', { min: 95, max: 100 }); // %
    thresholds.set('glucose', { min: 70, max: 180 }); // mg/dL

    return thresholds;
  }
}

// Export singleton instance
export const telemedicineIntegration = new TelemedicineIntegration();
