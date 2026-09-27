import { expect, it } from 'vitest';
import { assertExactCriterionPartition, type AgentResult } from '../src/contracts.js';
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
