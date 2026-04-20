You’re now looking at two _very different philosophies of harness design_:

- OpenAI (Codex article): **tool-driven, execution loop centric**
- Anthropic (this article): **orchestration-driven, multi-agent control system**

Given the architecture you’ve been building (clean separation of **harness vs runtime vs tooling**, plugins, skills, LangGraph orchestration), this Anthropic piece is much closer to where you’re heading—but it also exposes some very specific gaps.

---

# 🧠 What this article is _really_ saying (distilled)

### 1. Harness = control system, not just a loop

Anthropic is explicit: performance gains didn’t come from better prompts—they came from:

- **task decomposition**
- **multi-agent separation of concerns**
- **structured feedback loops**
- **state handoff across time**

This aligns directly with your stance:

> “AI systems are systems design problems, not prompting problems”

---

### 2. The core architectural pattern

They converge on a **3-agent system**:

| Role               | Responsibility                     |
| ------------------ | ---------------------------------- |
| **Planner**        | Expands intent → structured spec   |
| **Generator**      | Executes work incrementally        |
| **Evaluator (QA)** | Critiques, tests, enforces quality |

This is effectively:

```
Intent → Plan → Build → Verify → Iterate
```

But critically:

> ❗ Evaluation is externalised, not self-reflection

---

### 3. The _real unlock_: evaluator separation

Their biggest finding:

> Models are bad at judging their own work.

So they:

- **split generation and evaluation**
- **tune evaluator to be sceptical**
- **force iteration based on critique**

This is _the GAN-like loop_ they reference.

---

### 4. Long-running execution requires **state engineering**

Two key mechanisms:

#### a) Context resets (or compaction)

- Prevent “context anxiety”
- Require **structured handoff artifacts**

#### b) File-based communication

Agents don’t chat—they:

```
write file → next agent reads → responds via file
```

This is subtle but important:

> They are building a _deterministic interface layer between agents_

---

### 5. Contracts over instructions

A particularly strong idea:

> Before work starts, generator + evaluator agree on a **“definition of done”**

They call this a **sprint contract**.

That’s effectively:

- testable acceptance criteria
- pre-agreed verification logic
- alignment before execution

---

### 6. QA is not optional at the frontier

Even with stronger models:

- Generator **misses edge cases**
- Generator **stubs features**
- Generator **looks correct but is broken**

Evaluator:

- runs Playwright
- tests real behaviour
- enforces thresholds

---

### 7. Harness complexity is **temporary**

A key forward-looking insight:

> Harness components should be continuously removed as models improve.

This is critical:

- harness ≠ permanent architecture
- harness = **adaptive scaffolding**

---

# 🔍 Mapping this to your architecture

You already have:

### ✅ Strong alignment

- Clean separation:
  - **Harness (control plane)**
  - **Runtime (execution engine)**
  - **Tools (capability layer)**

- Plugin system:
  - lifecycle hooks
  - memory injection
  - guardrails

- Skill system:
  - structured capability injection

- LangGraph orchestration:
  - node-based execution

- Memory layers:
  - session.md
  - beads (tasks)
  - mulch (experience)

👉 You are already **beyond most implementations** structurally.

---

# 🚨 Gap analysis (this is where it gets interesting)

## 1. ❌ No true **Evaluator agent (QA as first-class citizen)**

You have:

- guardrails
- validation
- tool constraints

But you **do not have a dedicated adversarial evaluator loop**

### What you're missing:

- independent QA agent persona
- sceptical grading behaviour
- iterative feedback loop into generator

### Impact:

Your system likely:

- passes “looks correct” outputs
- misses behavioural bugs
- lacks refinement cycles

---

## 2. ❌ No **formalised contract phase (Definition of Done)**

Anthropic introduces:

> Generator ↔ Evaluator negotiation BEFORE execution

You currently have:

- tasks (Beads)
- instructions
- constraints

But not:

```
Pre-execution agreement on:
- what will be built
- how it will be verified
```

### Missing construct:

- **Contract artifact**
- **Acceptance criteria schema**
- **Test plan before execution**

---

## 3. ⚠️ Weak **iteration loop (feedback-driven refinement)**

Your flow is closer to:

```
Plan → Execute → Return
```

Anthropic uses:

```
Plan → Execute → Evaluate → Refine → Repeat (N times)
```

### Missing:

- structured iteration cycles
- evaluator feedback injection
- convergence strategy

---

## 4. ❌ No **multi-agent role separation at runtime**

You have:

- “agent”
- “skills”
- “tools”

But not explicit runtime personas like:

- Planner agent
- Generator agent
- Evaluator agent

### Why it matters:

This separation:

- reduces cognitive overload per agent
- enables targeted prompting
- allows specialised tuning

---

## 5. ⚠️ Memory exists, but not **structured handoff artifacts**

You have:

- session.md
- compression
- mulch lessons

But Anthropic relies on:

> explicit, structured artifacts passed between agents

Examples:

- spec documents
- sprint contracts
- QA reports

### Missing:

- **artifact schema standardisation**
- deterministic inter-agent interface

---

## 6. ❌ No **real execution QA (Playwright / system testing loop)**

You _can_ do this (you’ve discussed Playwright MCP), but:

- it’s not **embedded as a required stage**
- it’s not tied to **pass/fail criteria**

Anthropic:

- enforces QA thresholds
- fails builds if criteria not met

---

## 7. ⚠️ Skills ≠ evaluation criteria

You have:

- skills (how to do things)

Anthropic adds:

- **criteria (how to judge things)**

This is a missing dimension.

### Example:

Instead of:

```
Skill: build frontend
```

They add:

```
Criteria:
- design quality
- originality
- usability
- craft
```

---

## 8. ❌ No **adaptive harness simplification strategy**

You haven't yet encoded:

> “When model capability increases, remove scaffolding”

Your system is currently:

- additive (plugins, skills, layers)

But not:

- subtractive (removing unnecessary complexity)

---

# 🧩 What you should add (prioritised)

## 🔴 Tier 1 (high impact, aligns with your roadmap)

### 1. Introduce Evaluator Agent

- Separate persona
- Different prompt
- Tuned to be critical
- Outputs structured feedback

---

### 2. Add Contract Phase (before execution)

New lifecycle hook:

```
onTaskStart →
  generate contract →
  validate contract →
  approve contract →
  execute
```

---

### 3. Implement Iteration Loop

In LangGraph:

```
Generator → Evaluator → Decision Node →
    (pass → next task)
    (fail → refine → loop back)
```

---

## 🟠 Tier 2 (system maturity)

### 4. Artifact system (formalise inter-agent communication)

Introduce typed artifacts:

```ts
type Artifact = ProductSpec | SprintContract | QAReport | ExecutionPlan;
```

---

### 5. Criteria engine

Attach evaluation criteria to:

- tasks
- skills
- domains

---

### 6. Real QA integration (Playwright MCP)

Make it:

- mandatory for certain task types
- tied to pass/fail thresholds

---

## 🟡 Tier 3 (forward-thinking / differentiation)

### 7. Adaptive harness

- detect model capability
- dynamically:
  - remove evaluator (simple tasks)
  - enable evaluator (complex tasks)

---

### 8. Multi-agent orchestration layer

Move from:

```
1 agent + tools
```

to:

```
orchestrator → specialised agents → shared artifacts
```

---

# ⚖️ Final perspective

If I’m blunt:

👉 Your architecture is **structurally ahead**
👉 But your execution model is still **single-agent dominant**

Anthropic’s key insight is:

> **Performance gains come from structured disagreement between agents**

Not just better tooling.

---

# 💡 The one takeaway to anchor on

If you only implement one thing from this article:

> **Add a sceptical evaluator that can fail the generator and force iteration**

That single change will:

- improve output quality
- reduce silent failures
- move you toward true “agentic systems”

---
