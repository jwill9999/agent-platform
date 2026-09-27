import { expect, it } from 'vitest';
import {
  assertExactCriterionPartition,
  assertFeatureEvaluationResult,
  type AgentResult,
} from '../src/contracts.js';
const result = (passed: string[], failed: string[]) =>
  ({ acceptanceCriteria: { passed, failed } }) as AgentResult;
it.each([
  [['first'], ['second']],
  [[], ['first', 'second']],
  [['first', 'second'], []],
])('accepts complete evaluator partitions: %j / %j', (passed, failed) => {
  expect(() =>
    assertExactCriterionPartition(result(passed!, failed!), ['first', 'second']),
  ).not.toThrow();
});
it.each([
  [['first'], ['first', 'second']],
  [['first'], []],
  [['first', 'first'], []],
  [['first'], ['unknown']],
])('rejects ambiguous or incomplete evaluator partitions: %j / %j', (passed, failed) => {
  expect(() =>
    assertExactCriterionPartition(result(passed!, failed!), ['first', 'second']),
  ).toThrow('exactly once');
});

it.each([
  { passed: ['first'], failed: [], status: 'needs_repair', transition: 'repair' },
  { passed: [], failed: ['first'], status: 'passed', transition: 'continue' },
  { passed: ['first'], failed: [], status: 'passed', transition: 'repair' },
  { passed: [], failed: ['first'], status: 'needs_repair', transition: 'continue' },
])('rejects contradictory evaluation verdict or routing %#', (item) => {
  const terminal = {
    ...result(item.passed, item.failed),
    status: item.status,
    recommendedTransition: item.transition,
    findings: [],
  } as AgentResult;
  expect(() => assertFeatureEvaluationResult(terminal, ['first'])).toThrow('contradicts');
});
it.each([true, false])('accepts coherent feature outcome: success=%s', (success) => {
  const terminal = {
    ...result(success ? ['first'] : [], success ? [] : ['first']),
    status: success ? 'passed' : 'needs_repair',
    recommendedTransition: success ? 'continue' : 'repair',
    findings: [],
  } as AgentResult;
  expect(() => assertFeatureEvaluationResult(terminal, ['first'])).not.toThrow();
});
