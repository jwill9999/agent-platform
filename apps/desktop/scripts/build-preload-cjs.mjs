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
const repairMacosVmRuntimeIpcChannel = ${JSON.stringify(
    desktopBridge.repairMacosVmRuntimeIpcChannel,
  )};
const createProjectFolderIpcChannel = ${JSON.stringify(desktopBridge.createProjectFolderIpcChannel)};
const selectProjectFolderIpcChannel = ${JSON.stringify(desktopBridge.selectProjectFolderIpcChannel)};
const openProjectIdeIpcChannel = ${JSON.stringify(desktopBridge.openProjectIdeIpcChannel)};
const createTerminalIpcChannel = ${JSON.stringify(desktopBridge.createTerminalIpcChannel)};
const inputTerminalIpcChannel = ${JSON.stringify(desktopBridge.inputTerminalIpcChannel)};
const resizeTerminalIpcChannel = ${JSON.stringify(desktopBridge.resizeTerminalIpcChannel)};
const disposeTerminalIpcChannel = ${JSON.stringify(desktopBridge.disposeTerminalIpcChannel)};
const terminalDataIpcChannel = ${JSON.stringify(desktopBridge.terminalDataIpcChannel)};
const terminalExitIpcChannel = ${JSON.stringify(desktopBridge.terminalExitIpcChannel)};
const saveWorkspaceResourceIpcChannel = ${JSON.stringify(
    desktopBridge.saveWorkspaceResourceIpcChannel,
  )};
const openWorkspaceResourceIpcChannel = ${JSON.stringify(
    desktopBridge.openWorkspaceResourceIpcChannel,
  )};
const openWorkspaceExternalFallbackIpcChannel = ${JSON.stringify(
    desktopBridge.openWorkspaceExternalFallbackIpcChannel,
  )};
const openWorkspaceWebViewIpcChannel = ${JSON.stringify(desktopBridge.openWorkspaceWebViewIpcChannel)};
const closeWorkspaceWebViewIpcChannel = ${JSON.stringify(
    desktopBridge.closeWorkspaceWebViewIpcChannel,
  )};
const focusWorkspaceWebViewIpcChannel = ${JSON.stringify(
    desktopBridge.focusWorkspaceWebViewIpcChannel,
  )};
const listWorkspaceWebViewsIpcChannel = ${JSON.stringify(
    desktopBridge.listWorkspaceWebViewsIpcChannel,
  )};
const setWorkspaceWebViewBoundsIpcChannel = ${JSON.stringify(
    desktopBridge.setWorkspaceWebViewBoundsIpcChannel,
  )};
const goBackWorkspaceWebViewIpcChannel = ${JSON.stringify(
    desktopBridge.goBackWorkspaceWebViewIpcChannel,
  )};
const goForwardWorkspaceWebViewIpcChannel = ${JSON.stringify(
    desktopBridge.goForwardWorkspaceWebViewIpcChannel,
  )};
const reloadWorkspaceWebViewIpcChannel = ${JSON.stringify(
    desktopBridge.reloadWorkspaceWebViewIpcChannel,
  )};
const workspaceWebViewUpdatedIpcChannel = ${JSON.stringify(
    desktopBridge.workspaceWebViewUpdatedIpcChannel,
  )};

const desktopApi = {
  maintenance: {
    getResetLocalDataConfirmation: () => ipcRenderer.invoke(resetLocalDataConfirmationIpcChannel),
    repairMacosVmRuntime: () => ipcRenderer.invoke(repairMacosVmRuntimeIpcChannel),
    resetLocalData: (request) => ipcRenderer.invoke(resetLocalDataIpcChannel, request),
  },
  projects: {
    createFolder: (request) => ipcRenderer.invoke(createProjectFolderIpcChannel, request),
    openInIde: (request) => ipcRenderer.invoke(openProjectIdeIpcChannel, request),
    selectFolder: () => ipcRenderer.invoke(selectProjectFolderIpcChannel),
  },
  terminal: {
    create: (request) => ipcRenderer.invoke(createTerminalIpcChannel, request),
    input: (request) => ipcRenderer.invoke(inputTerminalIpcChannel, request),
    resize: (request) => ipcRenderer.invoke(resizeTerminalIpcChannel, request),
    dispose: (request) => ipcRenderer.invoke(disposeTerminalIpcChannel, request),
    onData: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on(terminalDataIpcChannel, listener);
      return () => ipcRenderer.removeListener(terminalDataIpcChannel, listener);
    },
    onExit: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on(terminalExitIpcChannel, listener);
      return () => ipcRenderer.removeListener(terminalExitIpcChannel, listener);
    },
  },
  workspace: {
    saveResourceAs: (request) => ipcRenderer.invoke(saveWorkspaceResourceIpcChannel, request),
    openResource: (request) => ipcRenderer.invoke(openWorkspaceResourceIpcChannel, request),
    openExternalFallback: (request) =>
      ipcRenderer.invoke(openWorkspaceExternalFallbackIpcChannel, request),
    openWebView: (request) => ipcRenderer.invoke(openWorkspaceWebViewIpcChannel, request),
    closeWebView: (request) => ipcRenderer.invoke(closeWorkspaceWebViewIpcChannel, request),
    focusWebView: (request) => ipcRenderer.invoke(focusWorkspaceWebViewIpcChannel, request),
    listWebViews: () => ipcRenderer.invoke(listWorkspaceWebViewsIpcChannel),
    setWebViewBounds: (request) =>
      ipcRenderer.invoke(setWorkspaceWebViewBoundsIpcChannel, request),
    goBackWebView: (request) => ipcRenderer.invoke(goBackWorkspaceWebViewIpcChannel, request),
    goForwardWebView: (request) => ipcRenderer.invoke(goForwardWorkspaceWebViewIpcChannel, request),
    reloadWebView: (request) => ipcRenderer.invoke(reloadWorkspaceWebViewIpcChannel, request),
    onWebViewUpdated: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on(workspaceWebViewUpdatedIpcChannel, listener);
      return () => ipcRenderer.removeListener(workspaceWebViewUpdatedIpcChannel, listener);
    },
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
    repairMacosVmRuntimeIpcChannel: readExportedStringConst(
      sourceFile,
      'repairMacosVmRuntimeIpcChannel',
    ),
    createProjectFolderIpcChannel: readExportedStringConst(
      sourceFile,
      'createProjectFolderIpcChannel',
    ),
    selectProjectFolderIpcChannel: readExportedStringConst(
      sourceFile,
      'selectProjectFolderIpcChannel',
    ),
    openProjectIdeIpcChannel: readExportedStringConst(sourceFile, 'openProjectIdeIpcChannel'),
    createTerminalIpcChannel: readExportedStringConst(sourceFile, 'createTerminalIpcChannel'),
    inputTerminalIpcChannel: readExportedStringConst(sourceFile, 'inputTerminalIpcChannel'),
    resizeTerminalIpcChannel: readExportedStringConst(sourceFile, 'resizeTerminalIpcChannel'),
    disposeTerminalIpcChannel: readExportedStringConst(sourceFile, 'disposeTerminalIpcChannel'),
    terminalDataIpcChannel: readExportedStringConst(sourceFile, 'terminalDataIpcChannel'),
    terminalExitIpcChannel: readExportedStringConst(sourceFile, 'terminalExitIpcChannel'),
    saveWorkspaceResourceIpcChannel: readExportedStringConst(
      sourceFile,
      'saveWorkspaceResourceIpcChannel',
    ),
    openWorkspaceResourceIpcChannel: readExportedStringConst(
      sourceFile,
      'openWorkspaceResourceIpcChannel',
    ),
    openWorkspaceExternalFallbackIpcChannel: readExportedStringConst(
      sourceFile,
      'openWorkspaceExternalFallbackIpcChannel',
    ),
    openWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'openWorkspaceWebViewIpcChannel',
    ),
    closeWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'closeWorkspaceWebViewIpcChannel',
    ),
    focusWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'focusWorkspaceWebViewIpcChannel',
    ),
    listWorkspaceWebViewsIpcChannel: readExportedStringConst(
      sourceFile,
      'listWorkspaceWebViewsIpcChannel',
    ),
    setWorkspaceWebViewBoundsIpcChannel: readExportedStringConst(
      sourceFile,
      'setWorkspaceWebViewBoundsIpcChannel',
    ),
    goBackWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'goBackWorkspaceWebViewIpcChannel',
    ),
    goForwardWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'goForwardWorkspaceWebViewIpcChannel',
    ),
    reloadWorkspaceWebViewIpcChannel: readExportedStringConst(
      sourceFile,
      'reloadWorkspaceWebViewIpcChannel',
    ),
    workspaceWebViewUpdatedIpcChannel: readExportedStringConst(
      sourceFile,
      'workspaceWebViewUpdatedIpcChannel',
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
