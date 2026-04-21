---
title: "Vector Search Latency Is a Systems Problem"
date: 2026-01-12 09:00:00 +0200
domain: AI
tags: [ai, latency, retrieval, systems]
excerpt: "Retrieval quality matters, but vector search becomes a backend problem the moment it joins a real request path."
code_preview: |
  query
    -> embed
    -> retrieve topK
    -> rerank
    -> hydrate
    -> answer
---

Vector search is often introduced as a model capability, but in production it behaves like a distributed systems component. It has fan-out, hot partitions, cache behavior, tail latency, and operational cost.

## The latency budget

The expensive part is rarely just nearest-neighbor search. The request path includes embedding, network hops, index lookup, reranking, document hydration, and response generation.

## Practical controls

Start by measuring the path as separate spans. Then keep the first version intentionally narrow: one index, bounded metadata filters, fixed top-k, and a clear fallback when retrieval is slow.

## Backend framing

Treat retrieval like a dependency with an SLO. Give it a timeout, measure cache hit rate, and make the failure mode useful instead of mysterious.
