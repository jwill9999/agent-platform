# Epic: Web research tool pack

**Beads id:** `agent-platform-research-tools`  
**Planning source:** [Harness Gap Analysis](../planning/harness-gap-analysis-2026-04-29.md)

## Objective

Add source-aware web research tools that produce citation-ready evidence bundles. These tools should be safer and more useful than raw `http_request` for research, comparison, documentation lookup, and current-information tasks.

## Capability Map

```json
{
  "tools": ["web_search", "web_fetch", "source_bundle_summarize"],
  "evidence": ["url", "title", "published_at", "retrieved_at", "excerpt", "content_hash"],
  "fallbacks": ["browser_snapshot_for_js_pages"],
  "safety": ["url_guard", "robots_or_policy_check", "content_truncation", "citation_required"]
}
```

## Proposed Task Chain

| Task                              | Purpose                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `agent-platform-research-tools.1` | Define research contracts, source bundle schema, and citation policy     |
| `agent-platform-research-tools.2` | Implement guarded web fetch and content extraction                       |
| `agent-platform-research-tools.3` | Implement web search provider adapter and ranking                        |
| `agent-platform-research-tools.4` | Add source bundle summarization and citation rendering                   |
| `agent-platform-research-tools.5` | Add tests for current-info workflows, blocked URLs, and citation quality |

## Architecture

```mermaid
flowchart LR
    Query["Research query"] --> Search["web_search"]
    Search --> Results["Ranked results"]
    Results --> Fetch["web_fetch"]
    Fetch --> Bundle["Source bundle"]
    Bundle --> Answer["Cited answer"]
```

## Definition Of Done

- Research tools return structured source evidence.
- Answers can cite source bundles without copying large source text.
- URL safety checks match existing network policy.
- Tests cover search/fetch success, blocked targets, truncation, and citation metadata.
