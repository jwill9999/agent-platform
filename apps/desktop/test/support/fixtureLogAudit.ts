import ts from 'typescript';

const runtimeKey = 'AGENT_PLATFORM_DESKTOP_RUNTIME_DIR';
const logKey = 'AGENT_PLATFORM_DESKTOP_LOG_DIR';

function propertyName(node: ts.PropertyName): string | undefined {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
}

/** Follow actual inferred fixture properties, including imported helper return types. */
function declarationValue(symbol: ts.Symbol | undefined): ts.Expression | undefined {
  for (const declaration of symbol?.declarations ?? []) {
    if (
      (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) &&
      declaration.initializer
    )
      return declaration.initializer;
    if (ts.isShorthandPropertyAssignment(declaration)) return declaration.name;
  }
  return undefined;
}

function effectiveProperty(
  expression: ts.Expression,
  key: string,
  checker: ts.TypeChecker,
  seen = new Set<ts.Node>(),
): ts.Expression | undefined {
  if (seen.has(expression)) return undefined;
  const next = new Set(seen).add(expression);
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
    return effectiveProperty(expression.expression, key, checker, next);
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return objectProperty(expression, key, checker, next);
  }
  if (ts.isIdentifier(expression)) {
    const value = declarationValue(checker.getSymbolAtLocation(expression));
    if (value) return effectiveProperty(value, key, checker, next);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const value = effectiveProperty(expression.expression, expression.name.text, checker, next);
    if (value) return effectiveProperty(value, key, checker, next);
  }
  // Parameters typed as Awaited<ReturnType<typeof fixture>> retain original property declarations.
  return declarationValue(checker.getPropertyOfType(checker.getTypeAtLocation(expression), key));
}

function objectProperty(
  expression: ts.ObjectLiteralExpression,
  key: string,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>,
): ts.Expression | undefined {
  for (const property of [...expression.properties].reverse()) {
    if (ts.isSpreadAssignment(property)) {
      const value = effectiveProperty(property.expression, key, checker, seen);
      if (value) return value;
      const type = checker.getTypeAtLocation(property.expression);
      // Unknown or indexed spreads can overwrite an earlier owned value.
      if (
        type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ||
        checker.getIndexTypeOfType(type, ts.IndexKind.String)
      )
        return undefined;
    } else if (propertyName(property.name) === key) {
      return ts.isPropertyAssignment(property) ? property.initializer : undefined;
    }
  }
  return undefined;
}

function isElectronLaunch(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'launch')
    return false;
  const receiver = node.expression.expression;
  if (ts.isPropertyAccessExpression(receiver)) return receiver.name.text === '_electron';
  if (!ts.isIdentifier(receiver)) return false;
  const source = node.getSourceFile();
  return source.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false;
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) =>
          element.name.text === receiver.text &&
          (element.propertyName?.text ?? element.name.text) === '_electron',
      )
    );
  });
}

function isDirectElectronSpawn(node: ts.CallExpression): boolean {
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'spawn') return false;
  const executable = node.arguments[0];
  return (
    !!executable &&
    ts.isAsExpression(executable) &&
    ts.isCallExpression(executable.expression) &&
    executable.expression.arguments.some(
      (arg) => ts.isStringLiteral(arg) && arg.text === 'electron',
    )
  );
}

export interface FixtureLogLaunch {
  file: string;
  line: number;
  kind: 'launch' | 'spawn';
  valid: boolean;
}

/** Audit effective launch environments, rather than unrelated matching text in the file. */
export function auditFixtureLogLaunches(
  program: ts.Program,
  files: readonly string[],
): FixtureLogLaunch[] {
  const checker = program.getTypeChecker();
  const launches: FixtureLogLaunch[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) throw new Error(`Fixture source was not loaded: ${file}`);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && (isElectronLaunch(node) || isDirectElectronSpawn(node))) {
        const direct = isDirectElectronSpawn(node);
        const options = node.arguments[direct ? 2 : 0];
        const env = options && effectiveProperty(options, 'env', checker);
        const runtime = env && effectiveProperty(env, runtimeKey, checker);
        const log = env && effectiveProperty(env, logKey, checker);
        const valid =
          !!runtime &&
          !!log &&
          ts.isCallExpression(log) &&
          ts.isIdentifier(log.expression) &&
          log.expression.text === 'join' &&
          log.arguments.length === 2 &&
          log.arguments[0]?.getText() === runtime.getText() &&
          !!log.arguments[1] &&
          ts.isStringLiteral(log.arguments[1]) &&
          log.arguments[1].text === 'logs';
        launches.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          kind: direct ? 'spawn' : 'launch',
          valid,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return launches;
}
