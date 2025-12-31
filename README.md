
<h1 align="center">Nexus Doc</h1>

<p align="center">
  <strong>Intelligent Document Processing</strong>
</p>

<p align="center">
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-Doc/actions"><img src="https://github.com/adverant/Adverant-Nexus-Plugin-Doc/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-Doc/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://marketplace.adverant.ai/plugins/doc"><img src="https://img.shields.io/badge/Nexus-Marketplace-purple.svg" alt="Nexus Marketplace"></a>
  <a href="https://discord.gg/adverant"><img src="https://img.shields.io/discord/123456789?color=7289da&label=Discord" alt="Discord"></a>
</p>

<p align="center">
  <a href="#features">Features</a> -
  <a href="#quick-start">Quick Start</a> -
  <a href="#use-cases">Use Cases</a> -
  <a href="#pricing">Pricing</a> -
  <a href="#documentation">Documentation</a>
</p>

---

## Transform Documents into Actionable Intelligence

**Nexus Doc** is an enterprise-grade intelligent document processing platform that combines state-of-the-art OCR, AI-powered extraction, classification, and summarization. Process invoices, contracts, forms, and any document type at scale with 99.9% accuracy.

### Why Nexus Doc?

- **99.9% Extraction Accuracy**: Industry-leading OCR and AI extraction
- **80% Cost Reduction**: Automate manual document processing workflows
- **100+ Document Types**: Pre-trained models for common document formats
- **Enterprise Security**: SOC2 compliant, end-to-end encryption
- **Real-Time Processing**: Process thousands of documents per minute

---

## Features

### Advanced OCR Engine

Extract text from any document with unmatched precision:

| Capability | Description |
|------------|-------------|
| **Multi-Language OCR** | Support for 100+ languages including CJK characters |
| **Handwriting Recognition** | Read handwritten notes and signatures |
| **Table Extraction** | Preserve complex table structures |
| **Layout Analysis** | Understand document structure and hierarchy |
| **Low-Quality Recovery** | Process faded, damaged, or low-resolution documents |

### Intelligent Data Extraction

AI-powered field extraction and validation:

- **Named Entity Recognition**: Automatically identify names, dates, amounts, addresses
- **Custom Field Training**: Train extractors for your specific document types
- **Cross-Reference Validation**: Validate extracted data against business rules
- **Confidence Scoring**: Know when human review is needed
- **Template Matching**: Fast extraction for standardized forms

### Document Classification

Automatic routing and categorization:

- **Multi-Class Classification**: Sort documents by type, department, priority
- **Hierarchical Taxonomy**: Support for complex classification schemes
- **Continuous Learning**: Models improve with feedback
- **Routing Rules**: Automatic workflow triggering based on classification
- **Duplicate Detection**: Identify and flag duplicate submissions

### AI Summarization

Transform lengthy documents into actionable insights:

- **Executive Summaries**: One-page summaries of complex documents
- **Key Point Extraction**: Bullet-point highlights
- **Comparison Analysis**: Side-by-side document comparison
- **Q&A Interface**: Ask questions about document content
- **Multi-Document Synthesis**: Combine insights from multiple sources

---

## Quick Start

### Installation

```bash
# Via Nexus Marketplace (Recommended)
nexus plugin install nexus-doc

# Or via API
curl -X POST "https://api.adverant.ai/plugins/nexus-doc/install" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Process Your First Document

```bash
# Upload and process a document
curl -X POST "https://api.adverant.ai/proxy/nexus-doc/api/v1/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@invoice.pdf" \
  -F "documentType=invoice" \
  -F "extractionMode=structured"
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "status": "processing",
  "estimatedTime": 5,
  "documentType": "invoice",
  "pages": 2
}
```

### Get Extraction Results

```bash
curl "https://api.adverant.ai/proxy/nexus-doc/api/v1/documents/doc_abc123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "status": "completed",
  "classification": {
    "type": "invoice",
    "confidence": 0.98
  },
  "extraction": {
    "vendor": "Acme Corp",
    "invoiceNumber": "INV-2024-001",
    "date": "2024-01-15",
    "total": 1250.00,
    "lineItems": [...]
  },
  "summary": "Invoice from Acme Corp for software license renewal..."
}
```

---

## Use Cases

### Finance & Accounting

#### 1. Invoice Processing
Automatically extract vendor, line items, amounts, and payment terms from invoices. Integrate with ERP systems for automated AP workflows.

#### 2. Receipt Management
Process expense receipts, extract merchant, date, and amount for automated expense reporting and compliance.

#### 3. Bank Statement Analysis
Extract transactions, categorize spending, and reconcile accounts automatically.

### Legal & Compliance

#### 4. Contract Analysis
Extract key terms, obligations, and dates from contracts. Identify non-standard clauses and risk factors.

#### 5. Regulatory Document Processing
Process compliance documents, extract required fields, and ensure regulatory adherence.

#### 6. Discovery & E-Discovery
Process large document sets for legal discovery, with keyword search and relevance scoring.

### Healthcare

#### 7. Medical Records Processing
Extract patient information, diagnoses, and treatment details while maintaining HIPAA compliance.

#### 8. Insurance Claims
Process insurance claims, extract relevant fields, and route for appropriate handling.

### Human Resources

#### 9. Resume Parsing
Extract candidate information, skills, and experience from resumes in any format.

#### 10. Employee Onboarding
Process ID documents, tax forms, and other onboarding paperwork automatically.

---

## Architecture

```
+------------------------------------------------------------------+
|                       Nexus Doc Plugin                            |
+------------------------------------------------------------------+
|  +---------------+  +----------------+  +---------------------+   |
|  |   OCR         |  |  Extraction    |  |   Classification    |   |
|  |   Engine      |  |  Pipeline      |  |   Engine            |   |
|  +-------+-------+  +-------+--------+  +----------+----------+   |
|          |                  |                      |              |
|          v                  v                      v              |
|  +----------------------------------------------------------+    |
|  |                 AI Processing Layer                       |    |
|  |  +----------+ +----------+ +----------+ +------------+   |    |
|  |  |Language  | |Vision    | |NER       | |Summarize   |   |    |
|  |  |Models    | |Models    | |Models    | |Models      |   |    |
|  |  +----------+ +----------+ +----------+ +------------+   |    |
|  +----------------------------------------------------------+    |
|          |                                                        |
|          v                                                        |
|  +----------------------------------------------------------+    |
|  |                 Validation & Export                       |    |
|  |    JSON  |  XML  |  CSV  |  Webhook  |  ERP Integration  |    |
|  +----------------------------------------------------------+    |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    Nexus Core Services                            |
|  +----------+  +----------+  +----------+  +----------+           |
|  |MageAgent |  | GraphRAG |  |FileProc  |  | Billing  |           |
|  |  (AI)    |  | (Cache)  |  |(Files)   |  |(Usage)   |           |
|  +----------+  +----------+  +----------+  +----------+           |
+------------------------------------------------------------------+
```

---

## Pricing

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| **Price** | $0/mo | $99/mo | $399/mo | Custom |
| **Pages/month** | 100 | 2,500 | 25,000 | Unlimited |
| **Document Types** | 5 | 25 | All | All + Custom |
| **OCR Languages** | 5 | 25 | 100+ | All |
| **Custom Extractors** | - | 2 | 10 | Unlimited |
| **Summarization** | - | Basic | Advanced | Advanced |
| **API Access** | - | Yes | Yes | Yes |
| **Batch Processing** | - | Yes | Yes | Priority |
| **SLA** | - | 99% | 99.5% | 99.99% |
| **Support** | Community | Email | Priority | Dedicated |

[View on Nexus Marketplace](https://marketplace.adverant.ai/plugins/doc)

---

## Supported Document Types

| Category | Document Types |
|----------|----------------|
| **Financial** | Invoices, Receipts, Purchase Orders, Bank Statements |
| **Legal** | Contracts, NDAs, Agreements, Court Documents |
| **Healthcare** | Medical Records, Insurance Claims, Prescriptions |
| **HR** | Resumes, W-2s, I-9s, Employment Contracts |
| **Identity** | Passports, Driver's Licenses, ID Cards |
| **General** | Forms, Letters, Reports, Emails |

---

## Documentation

- [Installation Guide](docs/getting-started/installation.md)
- [Configuration](docs/getting-started/configuration.md)
- [Quick Start](docs/getting-started/quickstart.md)
- [API Reference](docs/api-reference/endpoints.md)
- [Custom Extractor Training](docs/guides/custom-extractors.md)
- [Integration Guide](docs/guides/integrations.md)

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Process a document |
| `GET` | `/documents/:id` | Get processing result |
| `POST` | `/batch` | Batch process documents |
| `GET` | `/batch/:id/status` | Get batch status |
| `POST` | `/classify` | Classify document |
| `POST` | `/summarize` | Generate document summary |
| `POST` | `/extractors` | Create custom extractor |
| `GET` | `/extractors` | List custom extractors |
| `POST` | `/compare` | Compare two documents |

Full API documentation: [docs/api-reference/endpoints.md](docs/api-reference/endpoints.md)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adverant/Adverant-Nexus-Plugin-Doc.git
cd Adverant-Nexus-Plugin-Doc

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

---

## Community & Support

- **Documentation**: [docs.adverant.ai/plugins/doc](https://docs.adverant.ai/plugins/doc)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
- **GitHub Issues**: [Report a bug](https://github.com/adverant/Adverant-Nexus-Plugin-Doc/issues)

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Transforming documents with <a href="https://adverant.ai">Adverant</a></strong>
</p>

<p align="center">
  <a href="https://adverant.ai">Website</a> -
  <a href="https://docs.adverant.ai">Docs</a> -
  <a href="https://marketplace.adverant.ai">Marketplace</a> -
  <a href="https://twitter.com/adverant">Twitter</a>
</p>
