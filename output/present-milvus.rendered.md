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

## Chunking Challenges: New features in roadmap

 ![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/chunk-challenges-in-roadmap.png)

## Compare their chunking strategy - Common steps

| Azure AI Search | Milvus Search | 
|---|---|
| Split by headings (h1-h3) | Split by headings (h1-h4) |
| Chunk by character limit (2000 chars, 500 overlap) | Chunk by recursive splitter, cap = 3000 chars, no overlap |

## Compare their chunking strategy - Specific steps

| Azure AI Search | Milvus Search | Purpose |
|---|---|---|
| None | Append breadcrumb to chunk text | Separates similar text across different components; anchors chunks to their source document context |
| None | Detect inline code and tables | Future: preserve table headers across chunks, help the LLM retrieve full blocks via tools |
| None | Detect intra-references in chunks | Future: return referenced content within the chunk |
| None | Detect sections spanning multiple chunks |Provide a tool to retrieve the full section |

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
| Hybrid search | Hybrid search |
| RRF | RRF |
| Built-in semantic reranker | None |

## Compare retrieval strategy — Reranker flexibility

- **Azure AI Search**: the semantic reranker is built-in and optional — no alternative rerankers are available
- **On-premise**: choose from Milvus's built-in rerankers or implement a fully custom reranker

## Compare A12 RAG Evaluation
- Azure AI Search
|![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/azure-ai-search-evaluation.png)
- Milvus search
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/milvus-evaluation.png)|

## Evaluation Insights between Azure AI Search and Milvus search
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/evaluation-insights.png)

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

## Leveraging A12 component relationships (1)
- Enhanced MCP instructions to improve LLM reasoning
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-mcp-instruction.png)

## Leveraging A12 component relationships (2)
- Enhanced search tool descriptions so the LLM can reason about results and refine follow-up searches automatically
![alt text](/Users/ttdinh/Documents/Working/Presentation/A12_RAG/present-milvus-search/presentation/assets/a12-mcp-search-tool-description.png)

## Claude Code with A12 RAG MCP on premise

## Claude Code with A12 RAG MCP in Azure
