/**
 * OpenTelemetry initialization for distributed tracing
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import config from '../config';

let sdk: NodeSDK | null = null;

export function initializeTelemetry(): void {
  if (!config.telemetry.enabled) {
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: config.telemetry.otlpEndpoint,
  });

  sdk = new NodeSDK({
    serviceName: config.telemetry.serviceName,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable file system instrumentation to reduce noise
        },
      }),
    ],
  });

  sdk.start();
}

export function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}
