# Quick Start Guide - DocAI

Get up and running with DocAI - Intelligent Document Processing in under 10 minutes.

---

## Prerequisites

Before starting, ensure you have:

- **Nexus Account**: Active subscription at [adverant.ai](https://adverant.ai)
- **API Key**: Generate from Dashboard > Settings > API Keys
- **Nexus CLI** (optional): For command-line installation

```bash
# Install Nexus CLI
npm install -g @adverant/nexus-cli
```

---

## Installation

### Via Nexus CLI (Recommended)

```bash
# Authenticate with your API key
nexus auth login

# Install the DocAI plugin
nexus plugin install nexus-doc

# Verify installation
nexus plugin list
```

### Via API

```bash
curl -X POST "https://api.adverant.ai/plugins/nexus-doc/install" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "status": "installed",
  "pluginId": "nexus-doc",
  "version": "1.0.0",
  "activatedAt": "2024-01-15T10:00:00Z"
}
```

### Via Dashboard

1. Navigate to **Nexus Marketplace**
2. Search for "DocAI" or browse the **Productivity** category
3. Click **Install Plugin**
4. Confirm installation and accept permissions

---

## Verify Installation

```bash
# Check plugin health
curl "https://api.adverant.ai/proxy/nexus-doc/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "capabilities": [
    "ocr-processing",
    "data-extraction",
    "document-classification",
    "template-matching",
    "validation",
    "export"
  ]
}
```

---

## First Document Processing Operation

### Via Dashboard

1. Navigate to **Plugins > DocAI**
2. Click **Process Document**
3. Upload your document (PDF, image, or scanned file)
4. Select **Document Type** (invoice, contract, form, etc.)
5. Choose **Extraction Mode**:
   - **Structured**: Extract to predefined schema
   - **Freeform**: AI-powered field detection
6. Click **Process**
7. View extracted data when processing completes

### Via API

#### Step 1: Upload and Process Document

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-doc/api/v1/doc/process" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@invoice.pdf" \
  -F "documentType=invoice" \
  -F "extractionMode=structured" \
  -F "options={\"language\":\"en\",\"ocrEnabled\":true}"
```

**Response:**
```json
{
  "documentId": "doc_7f3a9b2c",
  "status": "processing",
  "estimatedTime": 8,
  "documentType": "invoice",
  "pages": 2,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Step 2: Retrieve Processing Results

```bash
curl "https://api.adverant.ai/proxy/nexus-doc/api/v1/doc/documents/doc_7f3a9b2c" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "documentId": "doc_7f3a9b2c",
  "status": "completed",
  "processingTime": 6.2,
  "classification": {
    "type": "invoice",
    "confidence": 0.98,
    "subtype": "commercial_invoice"
  },
  "extraction": {
    "vendor": {
      "name": "Acme Corporation",
      "address": "123 Business Ave, San Francisco, CA 94102",
      "taxId": "12-3456789"
    },
    "invoiceNumber": "INV-2024-00142",
    "invoiceDate": "2024-01-15",
    "dueDate": "2024-02-15",
    "currency": "USD",
    "subtotal": 1150.00,
    "tax": 100.00,
    "total": 1250.00,
    "lineItems": [
      {
        "description": "Software License - Annual",
        "quantity": 1,
        "unitPrice": 950.00,
        "amount": 950.00
      },
      {
        "description": "Support Package",
        "quantity": 1,
        "unitPrice": 200.00,
        "amount": 200.00
      }
    ]
  },
  "validation": {
    "mathCorrect": true,
    "fieldsComplete": true,
    "warnings": []
  }
}
```

---

## SDK Examples

### TypeScript/JavaScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';
import * as fs from 'fs';

// Initialize client
const client = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

// Access DocAI plugin
const doc = client.plugin('nexus-doc');

// Process a document
async function processInvoice(filePath: string) {
  // Upload and process
  const job = await doc.process({
    file: fs.createReadStream(filePath),
    documentType: 'invoice',
    extractionMode: 'structured',
    options: {
      language: 'en',
      ocrEnabled: true
    }
  });

  console.log(`Processing started: ${job.documentId}`);

  // Wait for completion
  const result = await job.waitForCompletion();

  console.log('Extracted data:', result.extraction);
  console.log(`Vendor: ${result.extraction.vendor.name}`);
  console.log(`Total: $${result.extraction.total}`);

  return result;
}

// Classify unknown document
async function classifyDocument(filePath: string) {
  const classification = await doc.classify({
    file: fs.createReadStream(filePath)
  });

  console.log(`Document type: ${classification.type}`);
  console.log(`Confidence: ${(classification.confidence * 100).toFixed(1)}%`);

  return classification;
}

// Run examples
processInvoice('./documents/invoice.pdf');
classifyDocument('./documents/unknown-doc.pdf');
```

### Python

```python
import os
from nexus_sdk import NexusClient

# Initialize client
client = NexusClient(api_key=os.environ['NEXUS_API_KEY'])

# Access DocAI plugin
doc = client.plugin('nexus-doc')

def process_invoice(file_path: str) -> dict:
    """Process an invoice document and extract structured data."""

    # Upload and process
    with open(file_path, 'rb') as f:
        job = doc.process(
            file=f,
            document_type='invoice',
            extraction_mode='structured',
            options={
                'language': 'en',
                'ocr_enabled': True
            }
        )

    print(f"Processing started: {job.document_id}")

    # Wait for completion
    result = job.wait_for_completion()

    print(f"Extracted data:")
    print(f"  Vendor: {result.extraction['vendor']['name']}")
    print(f"  Invoice #: {result.extraction['invoiceNumber']}")
    print(f"  Total: ${result.extraction['total']}")

    return result

def extract_data_from_contract(file_path: str) -> dict:
    """Extract key terms from a contract document."""

    with open(file_path, 'rb') as f:
        result = doc.extract(
            file=f,
            fields=[
                'parties',
                'effective_date',
                'termination_date',
                'payment_terms',
                'obligations'
            ]
        )

    return result

# Example usage
if __name__ == '__main__':
    invoice_data = process_invoice('./documents/invoice.pdf')
    contract_data = extract_data_from_contract('./documents/contract.pdf')
```

---

## Rate Limits

Rate limits are enforced based on your subscription tier:

| Tier | Pages/Month | API Requests/Minute | Concurrent Jobs |
|------|-------------|---------------------|-----------------|
| **Starter** | 1,000 | 30 | 5 |
| **Professional** | 10,000 | 100 | 20 |
| **Enterprise** | Unlimited | Custom | Custom |

### Handling Rate Limits

When rate limited, you'll receive a `429` response:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retryAfter": 60,
      "currentUsage": 30,
      "limit": 30
    }
  }
}
```

Implement exponential backoff in your integration for production resilience.

---

## Next Steps

Now that you've processed your first document, explore these resources:

- **[Use Cases](USE-CASES.md)**: Industry-specific implementation examples
- **[Architecture](ARCHITECTURE.md)**: Technical deep dive and integration patterns
- **[API Reference](docs/api-reference/endpoints.md)**: Complete endpoint documentation
- **[Custom Extractors](docs/guides/custom-extractors.md)**: Train models for your document types

---

## Common Issues

### Document Processing Fails

- **Check file format**: Supported formats include PDF, PNG, JPG, TIFF, BMP
- **File size limit**: Maximum 50MB per document
- **Quality issues**: Ensure minimum 150 DPI for scanned documents

### Low Extraction Accuracy

- **Enable OCR**: Set `ocrEnabled: true` for scanned documents
- **Specify language**: Provide `language` parameter for non-English documents
- **Use templates**: Create custom templates for recurring document formats

### API Authentication Errors

- **Verify API key**: Ensure key is active in Dashboard > API Keys
- **Check permissions**: DocAI requires `plugins.execute` scope
- **Token expiry**: Refresh expired tokens

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/doc](https://docs.adverant.ai/plugins/doc)
- **Discord Community**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email Support**: support@adverant.ai
- **GitHub Issues**: [Report bugs](https://github.com/adverant/Adverant-Nexus-Plugin-Doc/issues)
