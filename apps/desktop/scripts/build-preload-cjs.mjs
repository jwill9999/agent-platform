import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import ts from 'typescript';

const desktopRoot = resolve(import.meta.dirname, '..');
const sourceDir = join(desktopRoot, 'src/preload');
const outputDir = join(desktopRoot, 'dist/preload');

mkdirSync(outputDir, { recursive: true });

for (const entry of readdirSync(sourceDir)) {
  if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) {
    continue;
  }

  const sourcePath = join(sourceDir, entry);
  const source = readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      isolatedModules: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
    fileName: sourcePath,
  });
  const outputName = `${basename(entry, extname(entry))}.js`;

  writeFileSync(join(outputDir, outputName), compiled.outputText);
}

const desktopBridge = loadDesktopBridgeContract();

writeFileSync(
  join(outputDir, 'preload.js'),
  `"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const desktopBridgeApiName = ${JSON.stringify(desktopBridge.desktopBridgeApiName)};
const resetLocalDataIpcChannel = ${JSON.stringify(desktopBridge.resetLocalDataIpcChannel)};
const resetLocalDataConfirmationIpcChannel = ${JSON.stringify(
    desktopBridge.resetLocalDataConfirmationIpcChannel,
  )};
const createProjectFolderIpcChannel = ${JSON.stringify(desktopBridge.createProjectFolderIpcChannel)};
const selectProjectFolderIpcChannel = ${JSON.stringify(desktopBridge.selectProjectFolderIpcChannel)};

const desktopApi = {
  maintenance: {
    getResetLocalDataConfirmation: () => ipcRenderer.invoke(resetLocalDataConfirmationIpcChannel),
    resetLocalData: (request) => ipcRenderer.invoke(resetLocalDataIpcChannel, request),
  },
  projects: {
    createFolder: (request) => ipcRenderer.invoke(createProjectFolderIpcChannel, request),
    selectFolder: () => ipcRenderer.invoke(selectProjectFolderIpcChannel),
  },
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
};

contextBridge.exposeInMainWorld(desktopBridgeApiName, desktopApi);
`,
);

writeFileSync(join(outputDir, 'package.json'), `${JSON.stringify({ type: 'commonjs' })}\n`);

function loadDesktopBridgeContract() {
  const sourcePath = join(sourceDir, 'desktopBridge.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2022, true);

  return {
    desktopBridgeApiName: readExportedStringConst(sourceFile, 'desktopBridgeApiName'),
    resetLocalDataIpcChannel: readExportedStringConst(sourceFile, 'resetLocalDataIpcChannel'),
    resetLocalDataConfirmationIpcChannel: readExportedStringConst(
      sourceFile,
      'resetLocalDataConfirmationIpcChannel',
    ),
    createProjectFolderIpcChannel: readExportedStringConst(
      sourceFile,
      'createProjectFolderIpcChannel',
    ),
    selectProjectFolderIpcChannel: readExportedStringConst(
      sourceFile,
      'selectProjectFolderIpcChannel',
    ),
  };
}

function readExportedStringConst(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer &&
        ts.isStringLiteral(declaration.initializer)
      ) {
        return declaration.initializer.text;
      }
    }
  }

  throw new Error(`Missing exported string constant ${name} in desktop preload contract.`);
}

function hasExportModifier(statement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}
