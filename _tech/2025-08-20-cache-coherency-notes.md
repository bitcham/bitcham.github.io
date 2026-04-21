---
title: "Cache Coherency Notes for Application Developers"
date: 2025-08-20 14:30:00 +0300
domain: CS
tags: [cs, cache, consistency]
excerpt: "A compact bridge between computer science cache ideas and the caches we ship inside backend systems."
code_preview: |
  write -> database
        -> invalidate key
        -> publish event
        -> refresh read model
---

Most application cache bugs are not caused by caching itself. They come from unclear ownership of freshness.

## Name the contract

Before adding a cache, decide whether it is a performance cache, a correctness cache, or a derived read model. Each one has a different invalidation story.

## Common trap

Time-based expiry is useful, but it is not a complete consistency model. If users can immediately observe stale state after a write, the product needs to accept that tradeoff explicitly.

## Durable approach

Keep the write path boring, make invalidation observable, and prefer simple cache keys that can be reasoned about during an incident.
