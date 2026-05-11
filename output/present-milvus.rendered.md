---
title: A12 Docs RAG On Premise
subtitle: Build a RAG pipeline with Milvus
category: Technical Presentation
author: AI VN Team
date: 5.2026
doc_id: present-milvus
version: 1.0
---

## Agenda
- Goals of moving from Azure cloud to on premise
- Compare architecture solution on Azure cloud and on premise with Milvus
- How to sync data in ingestion on premise
- Compare their chunking strategy 
- Compare their retrieval strategy
- Compare their performance
- Leverage relationship of A12 components to help LLM reasoning better
- Suggestions & discussions

## Goals of moving from Azure cloud to on premise
- Minimize dependence on Azure cloud and reduce costs
- Ensure GDPR compliance and data sovereignty on our own infrastructure
- Maintain the same retrieval performance as A12 RAG on Azure
- Make it easy to control and address nuanced problems in A12 RAG

## Overview A12 RAG MCP architecture on Azure cloud
- Azure AI search

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-overview-architecture.png)

## Overview A12 RAG MCP architecture on premise

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-overview-architecture.png)

- Replace Azure AI Search with Milvus
- Remove Azure Storage dependency
- Keep Azure OpenAI for text-embedding-3-large

## A12 Docs ingestion on premise (1)
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-ingestion-flow.png)
- Ingestion still runs on a schedule
- Milvus manages data sync from MinIO
- Each A12 doc version maps to a partition in the Milvus collection — ANN search is scoped to one or more partitions explicitly

## A12 Docs ingestion on premise (2)
- Sample logs during data sync
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-sync-a12-version.png) 

## A12 Docs ingestion on premise (3)

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-sync-state.png)
- `a12_docs`: stores document chunks
- `a12_sync_jobs`: tracks ingestion jobs
- `a12_sync_state`: tracks synced document files

## Chunking Challenges: New features in roadmap

 ![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/chunk-challenges-in-roadmap.png)

## Chunking Challenges in A12 Docs (1)
- **Problem 1**: A12 Docs frequently contain intra-references — links pointing to other sections within the same document

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-docs-intra-references.png)

## Chunking Challenges in A12 Docs (2)
- The RAG pipeline cannot answer questions that depend on content from these intra-references

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/questions-have-intra-references.png)

## Chunking Challenges in A12 Docs (3)
- **Problem 2**: A12 Docs contain long code blocks that exceed chunk size limits

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-docs-long-code-block.png)

## Chunking Challenges in A12 Docs (4)

- **Problem 3**: A12 Docs contain long table blocks that span multiple chunks

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-docs-long-table-block.png)

## Chunking Challenges in A12 Docs (5)
- **Problem 4**: A12 Docs contain table placeholders in Markdown that are replaced during AsciiDoctor builds

![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-docs-table-placeholder.png)

## Compare their chunking strategy

| Azure AI Search | Milvus Search | Step type | Purpose 
|---|---|---|---|
| Split by headings (h1-h3) | Split by headings (h1-h4) | Common | - |
| Chunk by character limit (2000 chars, 500 overlap) | Chunk by recursive splitter, cap = 3000 chars, no overlap | Common | - |
| None | Append breadcrumb to chunk text | Specific | Separates similar text across different components; anchors chunks to their source document context |
| None | Detect inline code and tables | Specific | Future: preserve table headers across chunks, help the LLM retrieve full blocks via tools |
| None | Detect intra-references in chunks | Specific | Future: return referenced content within the chunk |
| None | Detect sections spanning multiple chunks | Specific |Provide a tool to retrieve the full section |

## Compare their chunking strategy - Chunk text in Milvus
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-chunk-text.png)

## Enhance chunking strategy - Consider aspects 

| Aspect | Azure AI search | On premise |
|---|---|---|
| Extend chunking logic | Difficult — requires additional Azure services (e.g. Azure Functions) | Easy — just change the code |
| Cost | Higher cost | Free |
| Dependencies | More dependencies | No additional dependencies |

## Compare retrieval strategy

| Azure AI Search | Milvus Search |
|---|---|
| Hybrid search (ANN search = 50, BM25 = 1000) | Hybrid search (ANN search = 50) |
| RRF (topK = 50) | RRF |
| Built-in semantic reranker | None |

### Reranker flexibility

- **Azure AI Search**: the semantic reranker is built-in and optional — no alternative rerankers are available
- **On-premise**: choose from Milvus's built-in rerankers or implement a fully custom reranker

## Compare A12 RAG Evaluation
- Azure AI Search
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-evaluation.png)
- Milvus search
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-evaluation.png)

## Evaluation Insights between Azure AI Search and Milvus search
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/evaluation-insights.png)

## Failed questions between two searches — Statistics

Failure = `context_precision < 0.5` **AND** `context_recall < 0.5`

| category | both | azure_only | milvus_only | total_failed | total_questions | failure_rate |
|---|---|---|---|---|---|---|
| dataservices | 0 | 0 | 0 | 0 | 25 | 0.0% |
| dev | 0 | 0 | 2 | 2 | 30 | 6.7% |
| plasma | 0 | 1 | 0 | 1 | 30 | 3.3% |
| quickstart_guide | 4 | 0 | 1 | 5 | 30 | 16.7% |
| uaa | 1 | 2 | 0 | 3 | 30 | 10.0% |
| **TOTAL** | **5** | **3** | **3** | **11** | **145** | **7.6%** |

- `quickstart_guide` is the hardest category for both engines (16.7% failure). Most of their failures due to [TABLE] placeholder and bad groundtruth

- The 3 azure-only and 3 milvus-only failures are complementary — each engine recovers what the other misses

## Failed questions between two searches (1)

| category | failed_in | question_text | ground_truth | root cause |
|---|---|---|---|---|
| quickstart_guide | both | What are the user roles that are available in all workspaces? | The roles admin, systemAdmin, guest and userManagementAdmin are available in all workspaces. | \[TABLE\] placeholder |
| quickstart_guide | both | What are the user roles that are not available in all workspaces? | The roles customer, shop and showcase are only available in the workspace e-commerce. | \[TABLE\] placeholder |
| quickstart_guide | both | What is the Data Modeler? | An older tool used to create and edit Document Models. This tool is deprecated and retired in new A12 versions. | Many relevance chunks |
| quickstart_guide | both | Can you give me an example of heterogeneity? | An example of heterogenity can be found in the e-commerce workspace in the products module where a heterogeneous list of products is shown. | Bad groundtruth |
| uaa | both | How can I disable CORS during authentication? | You can set the property `mgmtp.a12.uaa.authentication.cors.enable` to false. | \[TABLE\] placeholder |

## Failed questions between two searches (2)

| category | failed_in | question_text | ground_truth | azure_cr | milvus_cr |
|---|---|---|---|---|---|
| uaa | azure_only | Which Localizer does the UAA javascript-client use? | The UAA client uses a Localizer from `@com.mgmtp.a12.utils/utils-localization` as localizer props or by useContext | 0.0 | 1.0 |
| uaa | azure_only | What API function from UAA can I use to keep information between tabs? | UAA uses the UaaSecureStorage to store information, so if you want transfer information between tabs you can use the function transferSessionStorage. | 0.0 | 1.0 |
| plasma | azure_only | What are the three Plasma Design Principles? | The three Design Principles are Robustness, Efficiency and Accessibility | 0.0 | 1.0 |

## Failed questions between two searches (3)

| category | failed_in | question_text | ground_truth | azure_cr | milvus_cr |
|---|---|---|---|---|---|
| dev | milvus_only | How can validation be disabled for specific document models? | To disable validation for specific document models, use the `mgmtp.a12.workflows.skipPartialValidationForModels` property for task updates and completions. To fully disable validation, use the `mgmtp.a12.dataservices.documents.validation.skipForModels` property in Camunda Service. | 0.5 | 0.0 |
| quickstart_guide | milvus_only | What does BAP stand for? | Business Application Platform. | 1.0 | 0.0 |
| dev | milvus_only | What attachment handling is supported by A12WF? | A12WF only supports inline attachments using the provided `inlineAttachmentHandler`. | 1.0 | 0.0 |

## Leveraging A12 component relationships to improve search
- A12 docs are technical documents with strong dependencies between components.

| Layer | Name | Components |
|---|---|---|
| 0 | Utilities & Foundation | utils_localization, utils_logging_collections, utils_server_connector, base, plasma |
| 1 | Core Modeling Foundation | kernel, expression |
| 2 | Design-Time (Modeling) | sme, diagram_editor, tdg |
| 3 | Server Runtime | data_services, uaa, user_management, transformer, data_distribution, workflows |
| 4 | Client Runtime | client, form_engine, overview_engine, tree_engine, crud, relationship_engine, content_engine, notification_center |
| 5 | UI & Output | widgets, print_engine, cms |
| — | Cross-cutting | build_and_deployment, project_template, overall |

## Leveraging A12 component relationships — MCP instruction

| Before | After |
|---|---|
| Use `search_a12_docs` to search the A12 knowledge base (geta12.com). A12 is a model-driven enterprise application platform. The knowledge base contains versioned official documentation covering modeling, client/server runtime, design system, deployment, and more. | Use `search_a12_docs` to search the A12 knowledge base (geta12.com). A12 is a model-driven enterprise application platform with ~28 components organized in 6 architectural layers plus cross-cutting components:<br>- **Layer 0 — Utilities & Foundation**: utils_localization, utils_logging_collections, utils_server_connector, base, plasma<br>- **Layer 1 — Core Modeling Foundation**: kernel, expression<br>- **Layer 2 — Design-Time (Modeling)**: sme, diagram_editor, tdg<br>- **Layer 3 — Server Runtime**: data_services, uaa, user_management, transformer, data_distribution, workflows<br>- **Layer 4 — Client Runtime**: client, form_engine, overview_engine, tree_engine, crud, relationship_engine, content_engine, notification_center<br>- **Layer 5 — UI & Output**: widgets, print_engine, cms<br>- **Cross-cutting — Lifecycle & Onboarding**: build_and_deployment, project_template, overall |

## Leveraging A12 component relationships — Tool description

| Before | After |
|---|---|
| Search A12 platform documentation via semantic search. Returns ranked document chunks with scores. Supports filtering by A12 version. Does not generate answers. Returns raw documentation excerpts only. | Search A12 platform documentation via semantic search. Returns ranked document chunks with scores. Supports filtering by A12 version **and component**. Does not generate answers. Returns raw documentation excerpts only.<br><br>**Component Search Strategy** — If the first search surfaces an unexpected component, use the cluster list below to pick 1–2 related components for follow-up searches via the `a12_component` parameter. Clusters are intent-based, not exclusive — a component may belong to multiple clusters.<br><br>**Key clusters** — Frontend (UI rendering): client, form_engine, overview_engine, widgets · Modeling pipeline (how-to-model): sme, kernel, form_engine · Backend/API (server logic): data_services, uaa, workflows · Workflow (BPMN tasks): workflows, form_engine, data_services, client · Notifications (alerts/messaging): data_distribution, notification_center · Deployment (infra/setup): build_and_deployment, project_template, uaa, data_services · Getting started (orientation): overall, project_template |

## Claude Code with A12 RAG MCP in Azure
Sample prompt: In A12 Platform, how do I create a model like Student and manage them in table.
- Tool call 1
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-prompt-tool-call-1.png)
- Tool call 2
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-prompt-tool-call-2.png)
- Tool call 3
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-prompt-tool-call-3.png)

## # Claude Code with A12 RAG MCP in Azure (2)
- Answer
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-prompt-answer.png)

## Claude Code with A12 RAG MCP on premise
- Tool call 1
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-prompt-tool-call-1.png)
- Tool call 2
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-prompt-tool-call-2.png)

## Claude Code with A12 RAG MCP on premise (2)
- Answer
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-prompt-answer.png)

## Suggestions & discussions
- Suggestions
    - Convert the code from TypeScript to Python 
    -
