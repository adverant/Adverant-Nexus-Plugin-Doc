# DocAI - Technical Documentation

## API Reference

### Base URL

```
https://api.adverant.ai/proxy/nexus-doc/api/v1/doc
```

### Authentication

All API requests require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

#### Required Scopes

| Scope | Description |
|-------|-------------|
| `doc:read` | Read processed documents |
| `doc:write` | Upload and process documents |
| `doc:extract` | Access extraction features |
| `doc:classify` | Access classification features |

---

## API Endpoints

### Document Processing

#### Process Document

```http
POST /process
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Document file (PDF, PNG, JPG, TIFF) |
| `documentType` | string | No | Expected document type |
| `extractionMode` | string | No | `structured`, `freeform`, `template` |
| `language` | string | No | Language code (default: auto-detect) |
| `options` | object | No | Processing options |

**Example:**

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-doc/api/v1/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@invoice.pdf" \
  -F "documentType=invoice" \
  -F "extractionMode=structured" \
  -F 'options={"includeConfidence": true, "extractTables": true}'
```

**Response:**

```json
{
  "documentId": "doc_abc123",
  "status": "processing",
  "estimatedTime": 5,
  "documentType": "invoice",
  "pages": 2,
  "queuePosition": 3,
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### Get Processed Document

```http
GET /documents/:id
```

**Response:**

```json
{
  "documentId": "doc_abc123",
  "status": "completed",
  "documentType": "invoice",
  "pages": 2,
  "classification": {
    "type": "invoice",
    "subtype": "commercial_invoice",
    "confidence": 0.98
  },
  "extraction": {
    "vendor": {
      "value": "Acme Corp",
      "confidence": 0.99,
      "boundingBox": { "x": 50, "y": 100, "width": 150, "height": 25 }
    },
    "invoiceNumber": {
      "value": "INV-2024-001",
      "confidence": 0.97
    },
    "date": {
      "value": "2024-01-15",
      "confidence": 0.98
    },
    "dueDate": {
      "value": "2024-02-15",
      "confidence": 0.95
    },
    "total": {
      "value": 1250.00,
      "currency": "USD",
      "confidence": 0.99
    },
    "subtotal": {
      "value": 1100.00,
      "confidence": 0.97
    },
    "tax": {
      "value": 150.00,
      "rate": 0.136,
      "confidence": 0.96
    },
    "lineItems": [
      {
        "description": "Software License - Annual",
        "quantity": 1,
        "unitPrice": 800.00,
        "total": 800.00,
        "confidence": 0.95
      },
      {
        "description": "Support Package",
        "quantity": 1,
        "unitPrice": 300.00,
        "total": 300.00,
        "confidence": 0.94
      }
    ],
    "paymentTerms": {
      "value": "Net 30",
      "confidence": 0.92
    },
    "vendorAddress": {
      "street": "123 Business Ave",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "country": "USA",
      "confidence": 0.94
    }
  },
  "ocr": {
    "fullText": "INVOICE\nAcme Corp\n123 Business Ave...",
    "pages": [
      {
        "pageNumber": 1,
        "text": "INVOICE\nAcme Corp...",
        "tables": [
          {
            "rows": 3,
            "columns": 4,
            "cells": [...]
          }
        ]
      }
    ]
  },
  "summary": "Invoice from Acme Corp dated January 15, 2024 for $1,250.00 covering software license renewal and support package. Payment due by February 15, 2024.",
  "validation": {
    "mathCorrect": true,
    "requiredFieldsPresent": true,
    "warnings": []
  },
  "processed_at": "2025-01-15T10:00:05Z"
}
```

### Batch Processing

#### Batch Process Documents

```http
POST /batch
```

**Request Body:**

```json
{
  "documents": [
    {
      "url": "https://storage.example.com/invoice1.pdf",
      "documentType": "invoice"
    },
    {
      "url": "https://storage.example.com/invoice2.pdf",
      "documentType": "invoice"
    }
  ],
  "options": {
    "extractionMode": "structured",
    "includeConfidence": true,
    "webhook_url": "https://api.yourapp.com/webhook/doc-processed"
  }
}
```

**Response:**

```json
{
  "batchId": "batch_xyz789",
  "status": "queued",
  "totalDocuments": 2,
  "estimatedCompletion": "2025-01-15T10:05:00Z"
}
```

#### Get Batch Status

```http
GET /batch/:id/status
```

**Response:**

```json
{
  "batchId": "batch_xyz789",
  "status": "processing",
  "progress": {
    "total": 2,
    "completed": 1,
    "failed": 0,
    "pending": 1
  },
  "documents": [
    { "documentId": "doc_abc123", "status": "completed" },
    { "documentId": "doc_def456", "status": "processing" }
  ]
}
```

### Classification

#### Classify Document

```http
POST /classify
```

**Request Body (multipart/form-data):**

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Document file |
| `categories` | string[] | Optional: limit to specific categories |

**Response:**

```json
{
  "documentId": "doc_abc123",
  "classification": {
    "primary": {
      "type": "invoice",
      "confidence": 0.98
    },
    "secondary": [
      { "type": "purchase_order", "confidence": 0.15 },
      { "type": "receipt", "confidence": 0.08 }
    ],
    "attributes": {
      "language": "en",
      "isDigital": true,
      "hasHandwriting": false,
      "pageOrientation": "portrait",
      "quality": "high"
    }
  },
  "routing": {
    "suggestedDepartment": "accounts_payable",
    "suggestedWorkflow": "invoice_processing",
    "priority": "normal"
  }
}
```

### Data Extraction

#### Extract Data from Document

```http
POST /extract
```

**Request Body:**

```json
{
  "documentId": "doc_abc123",
  "extractorId": "extractor_invoice_v2",
  "fields": ["vendor", "total", "date", "lineItems"],
  "options": {
    "includeConfidence": true,
    "includeBoundingBoxes": true,
    "validateMath": true
  }
}
```

### Summarization

#### Generate Document Summary

```http
POST /summarize
```

**Request Body:**

```json
{
  "documentId": "doc_abc123",
  "summaryType": "executive | detailed | bullet_points | comparison",
  "maxLength": 500,
  "focusAreas": ["financial_terms", "key_dates", "obligations"]
}
```

**Response:**

```json
{
  "documentId": "doc_abc123",
  "summary": {
    "executive": "This commercial invoice from Acme Corp totaling $1,250.00 covers annual software license renewal ($800) and support package ($300). Payment is due within 30 days (by February 15, 2024).",
    "keyPoints": [
      "Invoice Total: $1,250.00 (including $150.00 tax)",
      "Payment Due: February 15, 2024 (Net 30)",
      "Vendor: Acme Corp, New York, NY"
    ],
    "entities": {
      "organizations": ["Acme Corp"],
      "amounts": [1250.00, 800.00, 300.00, 150.00],
      "dates": ["2024-01-15", "2024-02-15"]
    }
  }
}
```

### Custom Extractors

#### Create Custom Extractor

```http
POST /extractors
```

**Request Body:**

```json
{
  "name": "Custom Invoice Extractor",
  "baseType": "invoice",
  "fields": [
    {
      "name": "purchase_order_number",
      "type": "string",
      "pattern": "PO-\\d{6}",
      "required": true
    },
    {
      "name": "cost_center",
      "type": "string",
      "location_hints": ["top_right", "header"]
    },
    {
      "name": "approval_signature",
      "type": "signature",
      "required": false
    }
  ],
  "validationRules": [
    {
      "rule": "total_equals_sum_of_line_items",
      "tolerance": 0.01
    }
  ]
}
```

#### List Custom Extractors

```http
GET /extractors
```

### Document Comparison

#### Compare Two Documents

```http
POST /compare
```

**Request Body:**

```json
{
  "document1_id": "doc_abc123",
  "document2_id": "doc_def456",
  "comparison_type": "full | fields_only | text_diff",
  "fields_to_compare": ["total", "terms", "parties"]
}
```

**Response:**

```json
{
  "comparison_id": "cmp_xyz789",
  "documents": ["doc_abc123", "doc_def456"],
  "differences": [
    {
      "field": "total",
      "document1_value": 1250.00,
      "document2_value": 1350.00,
      "difference": 100.00,
      "significance": "high"
    },
    {
      "field": "terms",
      "document1_value": "Net 30",
      "document2_value": "Net 45",
      "significance": "medium"
    }
  ],
  "similarity_score": 0.85,
  "summary": "Documents differ primarily in payment terms and total amount."
}
```

---

## Rate Limits

| Tier | Pages/min | Batch Size | Extractors |
|------|-----------|------------|------------|
| Starter | 10 | 10 | 2 |
| Professional | 100 | 100 | 10 |
| Enterprise | 1000 | 1000 | Unlimited |

---

## Data Models

### Document

```typescript
interface ProcessedDocument {
  documentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  documentType: string;
  pages: number;
  classification: Classification;
  extraction: Record<string, ExtractedField>;
  ocr: OCRResult;
  summary?: string;
  validation: ValidationResult;
  created_at: string;
  processed_at?: string;
}

interface Classification {
  type: string;
  subtype?: string;
  confidence: number;
}

interface ExtractedField {
  value: unknown;
  confidence: number;
  boundingBox?: BoundingBox;
  source?: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

interface OCRResult {
  fullText: string;
  pages: PageOCR[];
  languages: string[];
}

interface PageOCR {
  pageNumber: number;
  text: string;
  words: WordOCR[];
  lines: LineOCR[];
  tables?: Table[];
}

interface ValidationResult {
  mathCorrect: boolean;
  requiredFieldsPresent: boolean;
  warnings: string[];
  errors: string[];
}
```

### Extractor

```typescript
interface CustomExtractor {
  extractorId: string;
  name: string;
  baseType?: string;
  fields: FieldDefinition[];
  validationRules: ValidationRule[];
  training_status: 'draft' | 'training' | 'ready';
  accuracy?: number;
  created_at: string;
}

interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'address' | 'signature' | 'table';
  pattern?: string;
  location_hints?: string[];
  required: boolean;
  default?: unknown;
}

interface ValidationRule {
  rule: string;
  tolerance?: number;
  severity: 'error' | 'warning';
}
```

---

## SDK Integration

### JavaScript/TypeScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const client = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

// Process a document
const doc = await client.doc.process({
  file: invoiceFile,
  documentType: 'invoice',
  extractionMode: 'structured'
});

// Wait for processing to complete
const result = await client.doc.waitForCompletion(doc.documentId, {
  timeout: 60000,
  pollInterval: 2000
});

console.log(`Invoice from: ${result.extraction.vendor.value}`);
console.log(`Total: $${result.extraction.total.value}`);
console.log(`Confidence: ${result.extraction.total.confidence * 100}%`);

// Batch process multiple documents
const batch = await client.doc.batch.create({
  documents: [
    { url: 'https://storage.example.com/invoice1.pdf', documentType: 'invoice' },
    { url: 'https://storage.example.com/invoice2.pdf', documentType: 'invoice' }
  ],
  options: { extractionMode: 'structured' }
});

// Get summary
const summary = await client.doc.summarize(doc.documentId, {
  summaryType: 'executive',
  maxLength: 200
});
```

### Python

```python
from nexus_sdk import NexusClient

client = NexusClient(api_key=os.environ["NEXUS_API_KEY"])

# Process document
with open("invoice.pdf", "rb") as f:
    doc = client.doc.process(
        file=f,
        document_type="invoice",
        extraction_mode="structured"
    )

# Wait for completion
result = client.doc.wait_for_completion(doc["documentId"], timeout=60)

print(f"Vendor: {result['extraction']['vendor']['value']}")
print(f"Total: ${result['extraction']['total']['value']}")

# Extract line items
for item in result["extraction"]["lineItems"]:
    print(f"  - {item['description']}: ${item['total']}")

# Create custom extractor
extractor = client.doc.extractors.create(
    name="Custom PO Extractor",
    base_type="purchase_order",
    fields=[
        {"name": "approval_code", "type": "string", "required": True},
        {"name": "budget_code", "type": "string", "pattern": r"BUD-\d{4}"}
    ]
)
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `document.processed` | Document processing complete |
| `document.failed` | Document processing failed |
| `batch.completed` | Batch processing complete |
| `extractor.trained` | Custom extractor training complete |

### Webhook Payload

```json
{
  "event": "document.processed",
  "timestamp": "2025-01-15T10:00:05Z",
  "data": {
    "documentId": "doc_abc123",
    "status": "completed",
    "documentType": "invoice",
    "pages": 2,
    "processingTime": 4.5
  }
}
```

---

## Supported Document Types

| Category | Types |
|----------|-------|
| **Financial** | invoice, receipt, purchase_order, bank_statement, check |
| **Legal** | contract, nda, agreement, court_document, patent |
| **Healthcare** | medical_record, insurance_claim, prescription, lab_report |
| **HR** | resume, w2, i9, employment_contract, tax_form |
| **Identity** | passport, drivers_license, id_card, visa |
| **General** | form, letter, report, email, memo |

## Supported Languages

DocAI supports 100+ languages including:
- Latin scripts: English, Spanish, French, German, Italian, Portuguese
- CJK: Chinese (Simplified/Traditional), Japanese, Korean
- Cyrillic: Russian, Ukrainian
- Arabic scripts: Arabic, Persian, Urdu
- Indic: Hindi, Tamil, Telugu

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `DOCUMENT_NOT_FOUND` | 404 | Document does not exist |
| `PROCESSING_FAILED` | 500 | Document processing error |
| `UNSUPPORTED_FORMAT` | 400 | File format not supported |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit |
| `PAGE_LIMIT_EXCEEDED` | 402 | Monthly page limit reached |
| `OCR_FAILED` | 500 | OCR engine error |
| `EXTRACTOR_NOT_FOUND` | 404 | Custom extractor not found |

---

## Deployment Requirements

### Container Specifications

| Resource | Value |
|----------|-------|
| CPU | 2000m (2 cores) |
| Memory | 4096 MB |
| Disk | 20 GB |
| Timeout | 300,000 ms (5 min) |
| Max Concurrent Jobs | 20 |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis for job queue |
| `MAGEAGENT_URL` | Yes | MageAgent service URL |
| `GRAPHRAG_URL` | Yes | GraphRAG for caching |
| `FILEPROCESS_URL` | Yes | File processing service |
| `OCR_ENGINE` | Yes | OCR engine configuration |
| `STORAGE_BUCKET` | Yes | Cloud storage for documents |

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/health` | General health check |
| `/ready` | Readiness probe |
| `/live` | Liveness probe |

---

## Quotas and Limits

### By Pricing Tier

| Limit | Starter | Professional | Enterprise |
|-------|---------|--------------|------------|
| Pages/month | 1,000 | 10,000 | Unlimited |
| Max File Size | 10 MB | 50 MB | 200 MB |
| Custom Extractors | 2 | 10 | Unlimited |
| Document Types | 5 | 25 | All |
| OCR Languages | 5 | 25 | 100+ |
| Summarization | Basic | Advanced | Advanced |
| API Access | - | Yes | Yes |
| SLA | - | 99% | 99.99% |

### Pricing

| Tier | Monthly |
|------|---------|
| Starter | $49 |
| Professional | $149 |
| Enterprise | Custom |

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/doc](https://docs.adverant.ai/plugins/doc)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
- **GitHub Issues**: [Report a bug](https://github.com/adverant/Adverant-Nexus-Plugin-Doc/issues)
