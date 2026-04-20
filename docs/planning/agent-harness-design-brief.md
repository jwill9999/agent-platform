# Agent Harness Enhancement Design Brief

## Purpose

This document defines the architectural improvements required to evolve the current agent harness into a multi-agent, contract-driven, evaluation-first system.

---

## Problem Statement

AI systems struggle with:

- Long-running task coherence
- Poor self-evaluation
- Silent failure and incomplete outputs

---

## Target Outcome

A system that can:

- Plan effectively
- Define "done" explicitly
- Execute incrementally
- Evaluate independently
- Iterate until quality thresholds are met

---

## Core Architecture

### Roles

- Planner: Expands intent into structured spec
- Generator: Implements features
- Evaluator: Validates and critiques outputs

---

## Key Additions

### 1. Work Contract

Defines:

- Scope
- Deliverables
- Acceptance criteria
- Verification methods

### 2. Evaluation Loop

Flow:
Plan → Contract → Execute → Evaluate → Refine → Repeat

### 3. Artifacts

- ProductSpec
- WorkContract
- EvaluationReport
- RemediationPlan

---

## Acceptance Criteria Example

- Functionality works end-to-end
- UI is usable and consistent
- No critical bugs
- Meets defined spec

---

## Implementation Priorities

1. Add evaluator agent
2. Introduce contract phase
3. Implement iteration loop
4. Define criteria packs
5. Integrate QA tooling

---

## Success Metrics

- Reduced incomplete outputs
- Improved behavioural correctness
- Clear pass/fail validation
- Controlled iteration cycles

---

## Final Principle

This system improves quality through structured disagreement between generation and evaluation.
