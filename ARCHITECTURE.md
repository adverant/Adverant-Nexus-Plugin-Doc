# Architecture Guide - DocAI

Technical architecture and system design for DocAI - Intelligent Document Processing.

---

## System Overview

DocAI is built on a modular, microservices architecture designed for high throughput, accuracy, and scalability. The system processes documents through a multi-stage pipeline that combines OCR, AI-powered extraction, classification, and validation.

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Dashboard]
        B[REST API]
        C[SDK Clients]
        D[Webhook Consumers]
    end

    subgraph "API Gateway"
        E[Nexus Gateway]
        E --> F[Authentication]
        E --> G[Rate Limiting]
        E --> H[Request Routing]
    end

    subgraph "DocAI Plugin Container"
        I[Document Ingestion Service]
        J[OCR Engine]
        K[Classification Engine]
        L[Extraction Pipeline]
        M[Validation Service]
        N[Export Service]
    end

    subgraph "AI Processing Layer"
        O[Vision Models]
        P[Language Models]
        Q[NER Models]
        R[Custom Extractors]
    end

    subgraph "Nexus Core Services"
        S[MageAgent - AI Orchestration]
        T[FileProcess - File Handling]
        U[GraphRAG - Knowledge Cache]
        V[Billing - Usage Tracking]
    end

    subgraph "Data Layer"
        W[(Document Store)]
        X[(Extraction Cache)]
        Y[(Template Registry)]
        Z[(Audit Log)]
    end

    A --> E
    B --> E
    C --> E

    E --> I
    I --> J
    J --> K
    K --> L
    L --> M
    M --> N

    J --> O
    K --> P
    L --> Q
    L --> R

    I --> S
    L --> S
    I --> T
    L --> U
    N --> V

    I --> W
    L --> X
    L --> Y
    M --> Z

    N --> D
```

---

## Core Components

### 1. Document Ingestion Service

The ingestion service handles document upload, format detection, and preprocessing.

**Responsibilities:**
- Accept documents via API upload, URL fetch, or S3/GCS bucket
- Detect file format and validate against supported types
- Generate document ID and create processing job
- Route to appropriate processing pipeline based on document characteristics

**Supported Formats:**

| Format | Extensions | Max Size | Notes |
|--------|-----------|----------|-------|
| PDF | .pdf | 50MB | Native text + scanned |
| Images | .png, .jpg, .jpeg, .tiff, .bmp | 25MB | Auto-deskew enabled |
| Office | .docx, .xlsx | 25MB | Converted to PDF |
| Email | .eml, .msg | 10MB | Attachments extracted |

### 2. OCR Engine

Multi-engine OCR system optimized for different document types and quality levels.

```mermaid
flowchart LR
    A[Document Page] --> B{Quality Analysis}
    B -->|High Quality| C[Native Text Extraction]
    B -->|Medium Quality| D[Standard OCR]
    B -->|Low Quality| E[Enhanced OCR Pipeline]

    E --> F[Preprocessing]
    F --> G[Deskew]
    G --> H[Denoise]
    H --> I[Contrast Enhancement]
    I --> J[Multi-Engine OCR]

    C --> K[Text Output]
    D --> K
    J --> K

    K --> L[Layout Analysis]
    L --> M[Structured Text + Coordinates]
```

**OCR Capabilities:**
- 100+ language support including CJK character sets
- Handwriting recognition for printed and cursive text
- Table structure preservation with cell boundary detection
- Mathematical formula recognition
- Barcode and QR code extraction

### 3. Classification Engine

AI-powered document classification with hierarchical taxonomy support.

**Classification Architecture:**

```mermaid
flowchart TB
    A[Document] --> B[Feature Extraction]
    B --> C[Visual Features]
    B --> D[Text Features]
    B --> E[Layout Features]

    C --> F[CNN Classifier]
    D --> G[Transformer Classifier]
    E --> H[Layout Classifier]

    F --> I[Ensemble Voting]
    G --> I
    H --> I

    I --> J{Confidence > 0.85?}
    J -->|Yes| K[Final Classification]
    J -->|No| L[Human Review Queue]

    K --> M[Route to Extractor]
```

**Supported Document Categories:**

| Category | Document Types | Model Accuracy |
|----------|---------------|----------------|
| Financial | Invoice, Receipt, PO, Statement | 99.2% |
| Legal | Contract, NDA, Agreement | 98.7% |
| Healthcare | Claim, Medical Record, Prescription | 98.4% |
| Identity | Passport, License, ID Card | 99.5% |
| HR | Resume, W-2, I-9, Offer Letter | 98.1% |

### 4. Extraction Pipeline

Multi-stage extraction pipeline combining template matching and AI-powered extraction.

```mermaid
sequenceDiagram
    participant D as Document
    participant T as Template Matcher
    participant AI as AI Extractor
    participant V as Validator
    participant O as Output

    D->>T: Check template registry
    alt Template Found
        T->>T: Apply template rules
        T->>V: Extracted fields
    else No Template
        T->>AI: Route to AI extraction
        AI->>AI: NER + Layout Analysis
        AI->>AI: Field Detection
        AI->>V: Extracted fields
    end

    V->>V: Validate field types
    V->>V: Cross-reference validation
    V->>V: Business rule validation

    alt Validation Passed
        V->>O: Structured output
    else Validation Failed
        V->>O: Output + warnings
    end
```

**Extraction Methods:**

| Method | Use Case | Speed | Accuracy |
|--------|----------|-------|----------|
| Template Matching | High-volume, consistent formats | Fast | 99%+ |
| AI Extraction | Variable formats, unknown layouts | Medium | 95%+ |
| Hybrid | Known vendors with variations | Fast | 98%+ |
| Custom Models | Domain-specific documents | Medium | 97%+ |

### 5. Validation Service

Multi-layer validation ensuring data quality and consistency.

**Validation Layers:**

1. **Schema Validation**: Field types, required fields, format patterns
2. **Mathematical Validation**: Sum verification, tax calculations
3. **Cross-Reference Validation**: Match against master data, previous documents
4. **Business Rule Validation**: Custom rules per document type
5. **Anomaly Detection**: Flag unusual values or patterns

### 6. Export Service

Flexible export to multiple formats and destinations.

**Export Formats:**
- JSON (structured data)
- XML (configurable schema)
- CSV (tabular data)
- Webhook (real-time push)
- Direct integration (ERP, CRM, custom APIs)

---

## Data Flow

### Document Processing Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant I as Ingestion
    participant O as OCR
    participant CL as Classifier
    participant E as Extractor
    participant V as Validator
    participant S as Storage
    participant W as Webhook

    C->>G: POST /process (file)
    G->>G: Authenticate + Rate limit
    G->>I: Forward request

    I->>I: Generate document ID
    I->>S: Store original document
    I->>C: Return job ID

    I->>O: Queue for OCR
    O->>O: Text extraction
    O->>S: Store OCR results

    O->>CL: Classification request
    CL->>CL: Analyze document
    CL->>S: Store classification

    CL->>E: Route to extractor
    E->>E: Field extraction
    E->>S: Store extraction

    E->>V: Validation request
    V->>V: Multi-layer validation
    V->>S: Store final result

    V->>W: Send webhook notification

    C->>G: GET /documents/:id
    G->>S: Retrieve result
    S->>C: Return processed document
```

### Batch Processing Flow

```mermaid
flowchart TB
    A[Batch Upload] --> B[Job Scheduler]
    B --> C[Priority Queue]

    C --> D[Worker Pool]
    D --> E[Worker 1]
    D --> F[Worker 2]
    D --> G[Worker N]

    E --> H[Processing Pipeline]
    F --> H
    G --> H

    H --> I[Results Aggregator]
    I --> J{All Complete?}
    J -->|No| C
    J -->|Yes| K[Batch Complete]

    K --> L[Export Package]
    K --> M[Webhook Notification]
```

---

## Security Model

### Data Protection

```mermaid
flowchart LR
    subgraph "In Transit"
        A[TLS 1.3]
        B[Certificate Pinning]
    end

    subgraph "At Rest"
        C[AES-256 Encryption]
        D[Key Management - HSM]
    end

    subgraph "In Processing"
        E[Isolated Containers]
        F[Memory Encryption]
        G[No Persistent Storage]
    end

    subgraph "Access Control"
        H[RBAC]
        I[API Key Scopes]
        J[Audit Logging]
    end
```

### Security Features

| Layer | Protection | Implementation |
|-------|------------|----------------|
| Transport | TLS 1.3 | Mandatory HTTPS, HSTS |
| Authentication | API Keys + JWT | Scoped permissions, rotation |
| Authorization | RBAC | Per-document access control |
| Encryption | AES-256 | Customer-managed keys available |
| Isolation | Container | No cross-tenant data access |
| Audit | Immutable logs | All operations logged |
| Compliance | SOC2, HIPAA | Certified annually |

### Data Retention

- **Processing Data**: Deleted after 24 hours (configurable)
- **Extraction Results**: Retained per customer policy
- **Audit Logs**: 7-year retention
- **Original Documents**: Customer-controlled retention

---

## API Reference

### Base URL
```
https://api.adverant.ai/proxy/nexus-doc/api/v1/doc
```

### Authentication
```bash
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Upload and process document |
| `POST` | `/classify` | Classify document type only |
| `POST` | `/extract` | Extract data from document |
| `GET` | `/documents/:id` | Get processed document |
| `GET` | `/documents/:id/status` | Get processing status |
| `DELETE` | `/documents/:id` | Delete document |
| `POST` | `/batch` | Create batch job |
| `GET` | `/batch/:id` | Get batch status |
| `POST` | `/templates` | Create extraction template |
| `GET` | `/templates` | List templates |
| `GET` | `/templates/:id` | Get template details |
| `PUT` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete template |

### Process Document

```bash
POST /process
Content-Type: multipart/form-data

file: <binary>
documentType: invoice | contract | receipt | form | auto
extractionMode: structured | freeform
options: {
  "language": "en",
  "ocrEnabled": true,
  "templateId": "tpl_xxx",
  "webhook": "https://your-server.com/webhook"
}
```

**Response:**
```json
{
  "documentId": "doc_7f3a9b2c",
  "status": "processing",
  "estimatedTime": 8,
  "pages": 2,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Get Document

```bash
GET /documents/:id
```

**Response:**
```json
{
  "documentId": "doc_7f3a9b2c",
  "status": "completed",
  "classification": {
    "type": "invoice",
    "confidence": 0.98
  },
  "extraction": {
    "vendor": { ... },
    "invoiceNumber": "INV-001",
    "total": 1250.00,
    "lineItems": [ ... ]
  },
  "validation": {
    "passed": true,
    "warnings": []
  },
  "metadata": {
    "pages": 2,
    "processingTime": 6.2,
    "ocrConfidence": 0.96
  }
}
```

---

## Scaling Architecture

### Horizontal Scaling

```mermaid
flowchart TB
    subgraph "Load Balancer"
        LB[Nexus Gateway]
    end

    subgraph "Processing Tier"
        P1[DocAI Pod 1]
        P2[DocAI Pod 2]
        P3[DocAI Pod N]
    end

    subgraph "Worker Tier"
        W1[OCR Worker Pool]
        W2[Extraction Worker Pool]
        W3[Validation Worker Pool]
    end

    subgraph "Queue System"
        Q1[Priority Queue]
        Q2[Standard Queue]
        Q3[Batch Queue]
    end

    LB --> P1
    LB --> P2
    LB --> P3

    P1 --> Q1
    P2 --> Q2
    P3 --> Q3

    Q1 --> W1
    Q2 --> W2
    Q3 --> W3
```

### Performance Specifications

| Metric | Starter | Professional | Enterprise |
|--------|---------|--------------|------------|
| Concurrent Jobs | 5 | 20 | Custom |
| Processing Timeout | 5 min | 5 min | 10 min |
| Max File Size | 25MB | 50MB | 100MB |
| Throughput | 100 pages/hr | 1,000 pages/hr | 10,000+ pages/hr |
| SLA Uptime | 99% | 99.5% | 99.99% |

### Resource Allocation

```yaml
# Kubernetes resource configuration
resources:
  cpuMillicores: 2000
  memoryMB: 4096
  diskGB: 20
  timeoutMs: 300000
  maxConcurrentJobs: 20
```

---

## Integration Points

### Nexus Core Services

| Service | Integration | Purpose |
|---------|------------|---------|
| MageAgent | AI orchestration | LLM inference for extraction |
| FileProcess | File handling | Upload, conversion, storage |
| GraphRAG | Knowledge cache | Template and extraction caching |
| Billing | Usage tracking | Page count, API call metering |

### External Integrations

```mermaid
flowchart LR
    D[DocAI] --> E[ERP Systems]
    D --> F[CRM Platforms]
    D --> G[Document Management]
    D --> H[Workflow Automation]

    E --> E1[SAP]
    E --> E2[Oracle]
    E --> E3[NetSuite]

    F --> F1[Salesforce]
    F --> F2[HubSpot]

    G --> G1[SharePoint]
    G --> G2[Box]
    G --> G3[Google Drive]

    H --> H1[Zapier]
    H --> H2[Power Automate]
    H --> H3[Workato]
```

### Webhook Events

```json
{
  "event": "document.processed",
  "documentId": "doc_7f3a9b2c",
  "timestamp": "2024-01-15T10:31:00Z",
  "status": "completed",
  "data": {
    "classification": "invoice",
    "extractionComplete": true,
    "validationPassed": true
  }
}
```

**Available Events:**
- `document.processed` - Processing completed
- `document.failed` - Processing failed
- `document.validation_warning` - Validation issues detected
- `batch.completed` - Batch job completed
- `template.trained` - Custom template ready

---

## Monitoring and Observability

### Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `doc_processing_time` | End-to-end processing duration | > 30s |
| `doc_ocr_confidence` | OCR quality score | < 0.8 |
| `doc_extraction_accuracy` | Field extraction accuracy | < 0.95 |
| `doc_queue_depth` | Pending jobs in queue | > 100 |
| `doc_error_rate` | Processing failure rate | > 1% |

### Health Endpoints

```bash
# Liveness check
GET /live
# Returns 200 if service is running

# Readiness check
GET /ready
# Returns 200 if service can accept requests

# Health check with details
GET /health
# Returns detailed health status
```

---

## Next Steps

- **[Quick Start](QUICKSTART.md)**: Get started in 10 minutes
- **[Use Cases](USE-CASES.md)**: Industry implementation examples
- **[API Reference](docs/api-reference/endpoints.md)**: Complete endpoint documentation
