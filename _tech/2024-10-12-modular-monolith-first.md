---
title: "Modular Monolith First"
date: 2024-10-12 11:20:00 +0300
domain: BACKEND
tags: [architecture, backend, monolith]
excerpt: "Why service boundaries should be earned by evidence instead of copied from diagrams."
code_preview: |
  module orders
  module billing
  module inventory

  boundaries first
  network later
---

Microservices solve real problems, but they also introduce new ones: distributed tracing, deployment choreography, schema compatibility, and network failure as a daily concern.

## Start with boundaries

A modular monolith is not a compromise. It is a way to force domain boundaries into code before turning those boundaries into network calls.

## Migration signal

Split a service when ownership, scaling pressure, release cadence, or data isolation makes the split cheaper than staying together.

## The payoff

Good modules make extraction possible. Poor modules make microservices expensive.
