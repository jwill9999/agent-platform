/**
 * Utilities for deriving tool definitions from an OpenAPI 3.0 specification.
 *
 * The harness uses `ToolDefinition` (name, description, parameters) for
 * LLM function calling. This module bridges OpenAPI operations to that shape
 * so the runtime can register API endpoints as callable tools.
 */

/** Lightweight tool shape compatible with the harness ToolDefinition. */
export type OpenApiToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** HTTP method for the operation. */
  method: string;
  /** URL path template (e.g. `/v1/agents/{id}`). */
  path: string;
};

/** Minimal typed view of an OpenAPI 3.0 document. */
type OpenApiPathItem = Record<string, unknown>;
type OpenApiDoc = {
  paths?: Record<string, OpenApiPathItem>;
  components?: { schemas?: Record<string, unknown> };
};

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

/**
 * Resolve a `$ref` pointer (e.g. `#/components/schemas/Agent`) against the
 * root document. Returns the referenced object or `undefined` if not found.
 */
function resolveRef(doc: OpenApiDoc, ref: string): Record<string, unknown> | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let current: unknown = doc;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'object' && current !== null
    ? (current as Record<string, unknown>)
    : undefined;
}

/** Extract parameter schemas from OpenAPI parameter objects into properties/required. */
function extractParamSchemas(allParams: Record<string, unknown>[]): {
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of allParams) {
    const name = param.name as string;
    const schema = param.schema as Record<string, unknown> | undefined;
    if (name && schema) {
      properties[name] = schema;
      if (param.required) required.push(name);
    }
  }

  return { properties, required };
}

/** Extract the request body schema, resolving `$ref` if present. */
function extractRequestBodySchema(
  doc: OpenApiDoc,
  operation: Record<string, unknown>,
): { schema: Record<string, unknown>; isRequired: boolean } | null {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  if (!requestBody) return null;

  const content = requestBody.content as Record<string, Record<string, unknown>> | undefined;
  const jsonContent = content?.['application/json'];
  if (!jsonContent?.schema) return null;

  let bodySchema = jsonContent.schema as Record<string, unknown>;
  if (bodySchema.$ref) {
    bodySchema = resolveRef(doc, bodySchema.$ref as string) ?? bodySchema;
  }

  return { schema: bodySchema, isRequired: !!requestBody.required };
}

/** Build a JSON Schema `parameters` object from path params + request body. */
function buildParameters(
  doc: OpenApiDoc,
  operation: Record<string, unknown>,
  pathParams: unknown[],
): Record<string, unknown> {
  const allParams = [
    ...(pathParams as Record<string, unknown>[]),
    ...((operation.parameters as Record<string, unknown>[]) ?? []),
  ];

  const { properties, required } = extractParamSchemas(allParams);

  const body = extractRequestBodySchema(doc, operation);
  if (body) {
    properties['body'] = body.schema;
    if (body.isRequired) required.push('body');
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Parse all operations from an OpenAPI 3.0 document into tool definitions.
 *
 * @param doc - A parsed OpenAPI document (JSON object, e.g. from `yaml.parse()`).
 * @returns An array of tool definitions, one per operation that has an `operationId`.
 */
export function openApiToToolDefinitions(doc: OpenApiDoc): OpenApiToolDefinition[] {
  const results: OpenApiToolDefinition[] = [];

  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    const pathParams = (pathItem.parameters as unknown[]) ?? [];

    for (const [method, value] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || typeof value !== 'object' || value === null) continue;

      const operation = value as Record<string, unknown>;
      const operationId = operation.operationId as string | undefined;
      if (!operationId) continue;

      const summary = (operation.summary as string) ?? '';
      const description = (operation.description as string) ?? summary;

      results.push({
        name: operationId,
        description: description || `${method.toUpperCase()} ${path}`,
        parameters: buildParameters(doc, operation, pathParams),
        method: method.toUpperCase(),
        path,
      });
    }
  }

  return results;
}
