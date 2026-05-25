import Darwin
import Foundation
import Virtualization

public struct JsonResponse: Codable, Equatable {
    public let ok: Bool
    public let mode: String
    public let state: String
    public let message: String
    public let stdout: String?
    public let stderr: String?
    public let exitCode: Int?
    public let durationMs: Int?

    public init(
        ok: Bool,
        mode: String = "macos-vm",
        state: String,
        message: String,
        stdout: String? = nil,
        stderr: String? = nil,
        exitCode: Int? = nil,
        durationMs: Int? = nil
    ) {
        self.ok = ok
        self.mode = mode
        self.state = state
        self.message = message
        self.stdout = stdout
        self.stderr = stderr
        self.exitCode = exitCode
        self.durationMs = durationMs
    }
}

public struct CommandResult: Equatable {
    public let response: JsonResponse
    public let exitCode: Int32

    public init(response: JsonResponse, exitCode: Int32 = 0) {
        self.response = response
        self.exitCode = exitCode
    }
}

private struct VmConfigDiagnostics: Codable {
    let bootLoader: String
    let kernel: String
    let initrd: String
    let kernelExists: Bool
    let initrdExists: Bool
    let baseImage: String
    let baseImageExists: Bool
    let bootCommandLine: String
    let cpus: Int
    let memoryMB: UInt64
    let maximumAllowedCPUCount: Int
    let maximumAllowedMemoryMB: UInt64
    let storageDevices: Int
    let directorySharingDevices: Int
    let serialPorts: Int
    let entropyDevices: Int
    let memoryBalloonDevices: Int
    let platform: String
    let machineIdentifier: Bool
    let helperPath: String
    let hostArch: String
    let virtualizationEntitlementPresent: Bool
}

public func handleCommand(arguments: [String]) -> CommandResult {
    let command = arguments.first ?? "status"
    let options = parseOptions(Array(arguments.dropFirst()))

    switch command {
    case "status":
        return status(runtimeDir: options["runtime-dir"])
    case "prepare":
        return prepare(runtimeDir: options["runtime-dir"])
    case "start":
        return start(runtimeDir: options["runtime-dir"])
    case "stop":
        return stop(runtimeDir: options["runtime-dir"])
    case "exec":
        return execute(runtimeDir: options["runtime-dir"], arguments: Array(arguments.dropFirst()))
    case "daemon":
        return daemon(runtimeDir: options["runtime-dir"], workspacePath: options["workspace"])
    default:
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "Unknown command: \(command)"
            ),
            exitCode: 2
        )
    }
}

private func status(runtimeDir: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    guard vmIsRunning(paths: paths) else {
        return unavailableResult("VM runner is prepared but not started.")
    }

    return CommandResult(
        response: JsonResponse(
            ok: true,
            state: "ready",
            message: "VM runner is ready."
        )
    )
}

private func prepare(runtimeDir: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    do {
        try prepareRuntimeDirectories(paths: paths)
        return CommandResult(
            response: JsonResponse(
                ok: true,
                state: "disabled",
                message: "VM runner runtime is prepared."
            )
        )
    } catch {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "Failed to prepare VM runtime directory: \(error.localizedDescription)"
            )
        )
    }
}

private func start(runtimeDir: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    if vmIsRunning(paths: paths) {
        return CommandResult(
            response: JsonResponse(
                ok: true,
                state: "ready",
                message: "VM runner is already running."
            )
        )
    }

    do {
        try prepareRuntimeDirectories(paths: paths)
        clearRuntimeState(paths: paths)
        try launchDaemon(paths: paths, workspacePath: nil)
        if waitUntilReady(paths: paths, timeoutSeconds: 15) {
            return CommandResult(
                response: JsonResponse(
                    ok: true,
                    state: "ready",
                    message: "VM runner is ready."
                )
            )
        }
        let message = readText(paths.lastError) ?? "VM did not become ready before the startup timeout."
        return unavailableResult(message)
    } catch {
        return unavailableResult("Failed to start VM runner: \(error.localizedDescription)")
    }
}

private func stop(runtimeDir: String?) -> CommandResult {
    if let paths = runtimePaths(runtimeDir: runtimeDir) {
        if let pid = readPid(paths.daemonPid) {
            _ = Darwin.kill(pid, SIGTERM)
        }
        clearRuntimeState(paths: paths)
    }

    return CommandResult(
        response: JsonResponse(
            ok: true,
            state: "disabled",
            message: "VM runner is stopped."
        )
    )
}

private func execute(runtimeDir: String?, arguments: [String]) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    guard let workspace = parseOption("workspace", from: arguments), !workspace.isEmpty else {
        return unavailableResult("Command workspace is not configured.")
    }
    guard let cwd = parseOption("cwd", from: arguments), !cwd.isEmpty else {
        return unavailableResult("Command cwd is not configured.")
    }

    let workspacePath = canonicalPath(workspace)
    let cwdPath = canonicalPath(cwd)
    guard path(cwdPath, isInside: workspacePath) else {
        return unavailableResult("Command cwd is outside the selected Project workspace.")
    }

    if vmIsRunning(paths: paths) {
        let runningWorkspacePath = readText(paths.workspaceRoot)?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let runningWorkspacePath, runningWorkspacePath != workspacePath {
            return unavailableResult("VM runner is already started for a different Project workspace.")
        }
    } else {
        do {
            try prepareRuntimeDirectories(paths: paths)
            clearRuntimeState(paths: paths)
            try launchDaemon(paths: paths, workspacePath: workspacePath)
            guard waitUntilReady(paths: paths, timeoutSeconds: 15) else {
                let message = readText(paths.lastError) ?? "VM did not become ready before the startup timeout."
                return unavailableResult(message)
            }
        } catch {
            return unavailableResult("Failed to start VM runner: \(error.localizedDescription)")
        }
    }

    let command = commandAfterSeparator(arguments)
    guard !command.isEmpty else {
        return unavailableResult("Command is not configured.")
    }

    let timeoutMs = parsePositiveIntOption("timeout-ms", from: arguments, defaultValue: 30_000)
    let maxOutputBytes = parsePositiveIntOption("max-output-bytes", from: arguments, defaultValue: 65_536)
    let environment = loadCommandEnvironment(envFile: parseOption("env-file", from: arguments))
    let guestCwd = guestWorkspacePath(workspacePath: workspacePath, cwdPath: cwdPath)
    return dispatchGuestCommand(
        paths: paths,
        command: command,
        environment: environment,
        guestCwd: guestCwd,
        timeoutMs: timeoutMs,
        maxOutputBytes: maxOutputBytes
    )
}

private func daemon(runtimeDir: String?, workspacePath rawWorkspacePath: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }
    let workspacePath = rawWorkspacePath.map(canonicalPath)

    do {
        try prepareRuntimeDirectories(paths: paths)
        let configuration = try buildVirtualMachineConfiguration(paths: paths, workspacePath: workspacePath)
        let virtualMachine = VZVirtualMachine(configuration: configuration)
        var startupError: Error?
        var startupCompleted = false
        virtualMachine.start { result in
            if case let .failure(error) = result {
                startupError = error
            }
            startupCompleted = true
        }
        let startupDeadline = Date().addingTimeInterval(45)
        while !startupCompleted && Date() < startupDeadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.2))
        }
        guard startupCompleted else {
            let message = "VM startup callback did not complete before the startup timeout."
            try message.write(to: paths.lastError, atomically: true, encoding: .utf8)
            return unavailableResult(message)
        }
        if let startupError {
            let message = describeError(startupError)
            try message.write(
                to: paths.lastError,
                atomically: true,
                encoding: .utf8
            )
            return unavailableResult("VM failed to start: \(startupError.localizedDescription)")
        }
        try writeDaemonHeartbeat(paths: paths)
        if let workspacePath {
            try "\(workspacePath)\n".write(to: paths.workspaceRoot, atomically: true, encoding: .utf8)
        }
        try "ready\n".write(to: paths.runnerSocket, atomically: true, encoding: .utf8)
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            try? writeDaemonHeartbeat(paths: paths)
        }
        RunLoop.current.run()
        return CommandResult(
            response: JsonResponse(ok: true, state: "disabled", message: "VM runner daemon stopped.")
        )
    } catch {
        try? describeError(error).write(to: paths.lastError, atomically: true, encoding: .utf8)
        return unavailableResult("VM daemon failed: \(error.localizedDescription)")
    }
}

private struct RuntimePaths {
    let root: URL
    let images: URL
    let state: URL
    let logs: URL
    let manifest: URL
    let baseImage: URL
    let kernel: URL
    let initrd: URL
    let guestBootstrap: URL
    let machineId: URL
    let daemonPid: URL
    let daemonHeartbeat: URL
    let workspaceRoot: URL
    let lastError: URL
    let diagnostics: URL
    let runnerSocket: URL
    let commandRoot: URL
    let commandJobs: URL
    let guestConsoleLog: URL
}

private struct VmAssetManifest: Codable {
    let schemaVersion: Int
    let architecture: String
    let imageFormat: String
    let image: String
    let imageSha256: String
    let boot: Boot
    let bootstrap: String
    let bootstrapSha256: String
    let guestService: GuestService
}

private struct Boot: Codable {
    let loader: String
    let kernel: String
    let kernelSha256: String
    let initrd: String
    let initrdSha256: String
    let commandLine: String
}

private struct GuestService: Codable {
    let transport: String
    let port: Int
    let command: String
}

private struct RuntimeValidation {
    let paths: RuntimePaths?
    let result: CommandResult?
}

private func unavailableResult(_ message: String) -> CommandResult {
    CommandResult(response: JsonResponse(ok: false, state: "unavailable", message: message))
}

private func validateRuntime(runtimeDir: String?) -> RuntimeValidation {
    guard let paths = runtimePaths(runtimeDir: runtimeDir) else {
        return RuntimeValidation(
            paths: nil,
            result: unavailableResult("VM runner runtime directory is not configured.")
        )
    }

    if let assetError = validateVmAssets(paths: paths) {
        return RuntimeValidation(paths: nil, result: unavailableResult(assetError))
    }

    return RuntimeValidation(paths: paths, result: nil)
}

private func runtimePaths(runtimeDir: String?) -> RuntimePaths? {
    guard let runtimeDir, !runtimeDir.isEmpty else {
        return nil
    }
    let root = URL(fileURLWithPath: runtimeDir, isDirectory: true)
    let images = root.appendingPathComponent("images", isDirectory: true)
    let state = root.appendingPathComponent("state", isDirectory: true)
    let logs = root.appendingPathComponent("logs", isDirectory: true)
    return RuntimePaths(
        root: root,
        images: images,
        state: state,
        logs: logs,
        manifest: images.appendingPathComponent("manifest.json", isDirectory: false),
        baseImage: images.appendingPathComponent("base-linux.img", isDirectory: false),
        kernel: images.appendingPathComponent("vmlinuz", isDirectory: false),
        initrd: images.appendingPathComponent("initrd.img", isDirectory: false),
        guestBootstrap: images.appendingPathComponent("guest-bootstrap.sh", isDirectory: false),
        machineId: state.appendingPathComponent("machine-id", isDirectory: false),
        daemonPid: state.appendingPathComponent("daemon.pid", isDirectory: false),
        daemonHeartbeat: state.appendingPathComponent("daemon.heartbeat", isDirectory: false),
        workspaceRoot: state.appendingPathComponent("workspace-root", isDirectory: false),
        lastError: logs.appendingPathComponent("last-error.log", isDirectory: false),
        diagnostics: logs.appendingPathComponent("vm-config.json", isDirectory: false),
        runnerSocket: state.appendingPathComponent("runner.sock", isDirectory: false),
        commandRoot: state.appendingPathComponent("commands", isDirectory: true),
        commandJobs: state.appendingPathComponent("commands/jobs", isDirectory: true),
        guestConsoleLog: logs.appendingPathComponent("guest-console.log", isDirectory: false)
    )
}

private func prepareRuntimeDirectories(paths: RuntimePaths) throws {
    try FileManager.default.createDirectory(at: paths.images, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: paths.state, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: paths.logs, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: paths.commandJobs, withIntermediateDirectories: true)
    _ = try loadOrCreateMachineIdentifier(paths: paths)
}

private func clearRuntimeState(paths: RuntimePaths) {
    clearReadyState(paths: paths)
    try? FileManager.default.removeItem(at: paths.lastError)
}

private func clearReadyState(paths: RuntimePaths) {
    try? FileManager.default.removeItem(at: paths.runnerSocket)
    try? FileManager.default.removeItem(at: paths.daemonPid)
    try? FileManager.default.removeItem(at: paths.daemonHeartbeat)
    try? FileManager.default.removeItem(at: paths.workspaceRoot)
}

private func vmIsRunning(paths: RuntimePaths) -> Bool {
    guard fileExists(paths.runnerSocket), let pid = readPid(paths.daemonPid) else {
        return false
    }
    return Darwin.kill(pid, 0) == 0 &&
        daemonProcessMatchesCurrentExecutable(pid: pid) &&
        heartbeatIsFresh(paths: paths)
}

private func readPid(_ url: URL) -> pid_t? {
    guard let text = readText(url), let value = Int32(text.trimmingCharacters(in: .whitespacesAndNewlines)) else {
        return nil
    }
    return pid_t(value)
}

private func readText(_ url: URL) -> String? {
    try? String(contentsOf: url, encoding: .utf8)
}

private func writeDaemonHeartbeat(paths: RuntimePaths) throws {
    try "\(Date().timeIntervalSince1970)\n".write(
        to: paths.daemonHeartbeat,
        atomically: true,
        encoding: .utf8
    )
}

private func heartbeatIsFresh(paths: RuntimePaths) -> Bool {
    let maxHeartbeatAge: TimeInterval = 5
    guard
        let attributes = try? FileManager.default.attributesOfItem(atPath: paths.daemonHeartbeat.path),
        let modifiedAt = attributes[.modificationDate] as? Date
    else {
        return false
    }
    return Date().timeIntervalSince(modifiedAt) <= maxHeartbeatAge
}

private func daemonProcessMatchesCurrentExecutable(pid: pid_t) -> Bool {
    guard let currentExecutablePath = CommandLine.arguments.first else {
        return false
    }
    var pathBuffer = [CChar](repeating: 0, count: Int(MAXPATHLEN))
    let pathLength = proc_pidpath(pid, &pathBuffer, UInt32(pathBuffer.count))
    guard pathLength > 0 else {
        return false
    }
    let daemonPath = URL(fileURLWithPath: String(cString: pathBuffer)).resolvingSymlinksInPath().path
    let currentPath = URL(fileURLWithPath: currentExecutablePath).resolvingSymlinksInPath().path
    return daemonPath == currentPath
}

private func dispatchGuestCommand(
    paths: RuntimePaths,
    command: String,
    environment: [String: String],
    guestCwd: String,
    timeoutMs: Int,
    maxOutputBytes: Int
) -> CommandResult {
    let startedAt = Date()
    let job = paths.commandJobs.appendingPathComponent(UUID().uuidString, isDirectory: true)
    do {
        try FileManager.default.createDirectory(at: job, withIntermediateDirectories: true)
        try command.write(to: job.appendingPathComponent("command.sh"), atomically: true, encoding: .utf8)
        try commandEnvironmentShell(environment)
            .write(to: job.appendingPathComponent("env.sh"), atomically: true, encoding: .utf8)
        try "\(guestCwd)\n".write(to: job.appendingPathComponent("cwd"), atomically: true, encoding: .utf8)
        try "\(timeoutMs)\n".write(to: job.appendingPathComponent("timeout-ms"), atomically: true, encoding: .utf8)
        try "\(maxOutputBytes)\n".write(
            to: job.appendingPathComponent("max-output-bytes"),
            atomically: true,
            encoding: .utf8
        )
        try "pending\n".write(to: job.appendingPathComponent("ready"), atomically: true, encoding: .utf8)

        let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0 + 1)
        while Date() < deadline {
            if fileExists(job.appendingPathComponent("done")) {
                let stdout = readText(job.appendingPathComponent("stdout")) ?? ""
                let stderr = readText(job.appendingPathComponent("stderr")) ?? ""
                let exitCodeText = readText(job.appendingPathComponent("exit-code")) ?? "1"
                let exitCode = Int(exitCodeText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 1
                try? FileManager.default.removeItem(at: job)
                return CommandResult(
                    response: JsonResponse(
                        ok: true,
                        state: "ready",
                        message: "Command completed.",
                        stdout: truncateText(stdout, maxLength: maxOutputBytes),
                        stderr: truncateText(stderr, maxLength: maxOutputBytes),
                        exitCode: exitCode,
                        durationMs: Int(Date().timeIntervalSince(startedAt) * 1000)
                    )
                )
            }
            Thread.sleep(forTimeInterval: 0.05)
        }
        try? "cancel\n".write(to: job.appendingPathComponent("cancel"), atomically: true, encoding: .utf8)
        return unavailableResult("VM command did not complete before the timeout.")
    } catch {
        try? FileManager.default.removeItem(at: job)
        return unavailableResult("Failed to dispatch VM command: \(error.localizedDescription)")
    }
}

private func loadCommandEnvironment(envFile: String?) -> [String: String] {
    guard let envFile, let data = FileManager.default.contents(atPath: envFile) else {
        return [:]
    }
    guard
        let parsed = try? JSONSerialization.jsonObject(with: data),
        let values = parsed as? [String: String]
    else {
        return [:]
    }
    return values.filter { isValidEnvironmentName($0.key) }
}

private func commandEnvironmentShell(_ environment: [String: String]) -> String {
    environment
        .sorted { $0.key < $1.key }
        .map { "export \($0.key)=\(shellQuote($0.value))" }
        .joined(separator: "\n") + "\n"
}

private func isValidEnvironmentName(_ name: String) -> Bool {
    guard let first = name.unicodeScalars.first else { return false }
    guard first == "_" || CharacterSet.letters.contains(first) else { return false }
    return name.unicodeScalars.allSatisfy { scalar in
        scalar == "_" || CharacterSet.alphanumerics.contains(scalar)
    }
}

private func shellQuote(_ value: String) -> String {
    "'\(value.replacingOccurrences(of: "'", with: "'\\\\''"))'"
}

private func canonicalPath(_ path: String) -> String {
    URL(fileURLWithPath: path).resolvingSymlinksInPath().standardizedFileURL.path
}

private func path(_ candidate: String, isInside root: String) -> Bool {
    candidate == root || candidate.hasPrefix("\(root)/")
}

private func guestWorkspacePath(workspacePath: String, cwdPath: String) -> String {
    guard path(cwdPath, isInside: workspacePath) else {
        return "/workspace"
    }
    let suffix = String(cwdPath.dropFirst(workspacePath.count))
    return suffix.isEmpty ? "/workspace" : "/workspace\(suffix)"
}

private func truncateText(_ text: String, maxLength: Int) -> String {
    if text.count <= maxLength {
        return text
    }
    return String(text.prefix(maxLength))
}

private func launchDaemon(paths: RuntimePaths, workspacePath: String?) throws {
    guard let executablePath = CommandLine.arguments.first, executablePath.hasSuffix("macos-vm-runner") else {
        throw RuntimeError("VM daemon can only be launched from the macos-vm-runner helper.")
    }
    let executable = URL(fileURLWithPath: executablePath)
    let stdoutURL = paths.logs.appendingPathComponent("daemon.out.log")
    let stderrURL = paths.logs.appendingPathComponent("daemon.err.log")
    FileManager.default.createFile(atPath: stdoutURL.path, contents: nil)
    FileManager.default.createFile(atPath: stderrURL.path, contents: nil)
    let stdout = try FileHandle(forWritingTo: stdoutURL)
    let stderr = try FileHandle(forWritingTo: stderrURL)
    let process = Process()
    process.executableURL = executable
    var arguments = ["daemon", "--runtime-dir", paths.root.path]
    if let workspacePath {
        arguments.append(contentsOf: ["--workspace", workspacePath])
    }
    process.arguments = arguments
    process.standardOutput = stdout
    process.standardError = stderr
    try process.run()
    try "\(process.processIdentifier)\n".write(to: paths.daemonPid, atomically: true, encoding: .utf8)
}

private func waitUntilReady(paths: RuntimePaths, timeoutSeconds: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeoutSeconds)
    while Date() < deadline {
        if vmIsRunning(paths: paths) {
            return true
        }
        if fileExists(paths.lastError) {
            clearReadyState(paths: paths)
            return false
        }
        Thread.sleep(forTimeInterval: 0.2)
    }
    if let pid = readPid(paths.daemonPid) {
        _ = Darwin.kill(pid, SIGTERM)
    }
    clearReadyState(paths: paths)
    return false
}

private func buildVirtualMachineConfiguration(
    paths: RuntimePaths,
    workspacePath: String?
) throws -> VZVirtualMachineConfiguration {
    let manifest = try loadVmAssetManifest(paths: paths)
    let platform = VZGenericPlatformConfiguration()
    platform.machineIdentifier = try loadOrCreateMachineIdentifier(paths: paths)
    let bootLoader = VZLinuxBootLoader(kernelURL: paths.kernel)
    bootLoader.initialRamdiskURL = paths.initrd
    bootLoader.commandLine = manifest.boot.commandLine

    let diskAttachment = try VZDiskImageStorageDeviceAttachment(
        url: paths.baseImage,
        readOnly: false,
        cachingMode: .automatic,
        synchronizationMode: .fsync
    )
    let disk = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)

    let configuration = VZVirtualMachineConfiguration()
    configuration.platform = platform
    configuration.bootLoader = bootLoader
    configuration.cpuCount = min(2, VZVirtualMachineConfiguration.maximumAllowedCPUCount)
    configuration.memorySize = min(
        2 * 1024 * 1024 * 1024,
        VZVirtualMachineConfiguration.maximumAllowedMemorySize
    )
    configuration.storageDevices = [disk]
    configuration.directorySharingDevices = try makeDirectorySharingDevices(
        paths: paths,
        workspacePath: workspacePath
    )
    configuration.serialPorts = [try makeGuestConsoleSerialPort(paths: paths)]
    configuration.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    configuration.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]
    try configuration.validate()
    try writeVmConfigDiagnostics(configuration: configuration, manifest: manifest, paths: paths)
    return configuration
}

private func makeGuestConsoleSerialPort(paths: RuntimePaths) throws -> VZSerialPortConfiguration {
    FileManager.default.createFile(atPath: paths.guestConsoleLog.path, contents: nil)
    let output = try FileHandle(forWritingTo: paths.guestConsoleLog)
    let attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: nil,
        fileHandleForWriting: output
    )
    let serialPort = VZVirtioConsoleDeviceSerialPortConfiguration()
    serialPort.attachment = attachment
    return serialPort
}

private func makeDirectorySharingDevices(
    paths: RuntimePaths,
    workspacePath: String?
) throws -> [VZDirectorySharingDeviceConfiguration] {
    var devices: [VZDirectorySharingDeviceConfiguration] = []
    if let workspacePath {
        let workspaceDirectory = VZSharedDirectory(url: URL(fileURLWithPath: workspacePath), readOnly: false)
        let workspaceShare = VZSingleDirectoryShare(directory: workspaceDirectory)
        let workspaceDevice = VZVirtioFileSystemDeviceConfiguration(tag: "agentworkspace")
        workspaceDevice.share = workspaceShare
        devices.append(workspaceDevice)
    }

    try FileManager.default.createDirectory(at: paths.commandRoot, withIntermediateDirectories: true)
    let commandDirectory = VZSharedDirectory(url: paths.commandRoot, readOnly: false)
    let commandShare = VZSingleDirectoryShare(directory: commandDirectory)
    let commandDevice = VZVirtioFileSystemDeviceConfiguration(tag: "agentcommands")
    commandDevice.share = commandShare
    devices.append(commandDevice)
    return devices
}

private struct RuntimeError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? {
        message
    }
}

private func describeError(_ error: Error) -> String {
    let nsError = error as NSError
    var lines = [
        error.localizedDescription,
        "domain: \(nsError.domain)",
        "code: \(nsError.code)",
    ]
    if let failureReason = nsError.localizedFailureReason {
        lines.append("failureReason: \(failureReason)")
    }
    if let recoverySuggestion = nsError.localizedRecoverySuggestion {
        lines.append("recoverySuggestion: \(recoverySuggestion)")
    }
    if !nsError.userInfo.isEmpty {
        lines.append("userInfo: \(nsError.userInfo)")
    }
    return lines.joined(separator: "\n")
}

private func writeVmConfigDiagnostics(
    configuration: VZVirtualMachineConfiguration,
    manifest: VmAssetManifest,
    paths: RuntimePaths
) throws {
    let diagnostics = VmConfigDiagnostics(
        bootLoader: "VZLinuxBootLoader",
        kernel: paths.kernel.path,
        initrd: paths.initrd.path,
        kernelExists: fileExists(paths.kernel),
        initrdExists: fileExists(paths.initrd),
        baseImage: paths.baseImage.path,
        baseImageExists: fileExists(paths.baseImage),
        bootCommandLine: manifest.boot.commandLine,
        cpus: configuration.cpuCount,
        memoryMB: configuration.memorySize / 1024 / 1024,
        maximumAllowedCPUCount: VZVirtualMachineConfiguration.maximumAllowedCPUCount,
        maximumAllowedMemoryMB: VZVirtualMachineConfiguration.maximumAllowedMemorySize / 1024 / 1024,
        storageDevices: configuration.storageDevices.count,
        directorySharingDevices: configuration.directorySharingDevices.count,
        serialPorts: configuration.serialPorts.count,
        entropyDevices: configuration.entropyDevices.count,
        memoryBalloonDevices: configuration.memoryBalloonDevices.count,
        platform: "VZGenericPlatformConfiguration",
        machineIdentifier: true,
        helperPath: CommandLine.arguments.first ?? "",
        hostArch: hostArchitecture(),
        virtualizationEntitlementPresent: hasVirtualizationEntitlement()
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(diagnostics).write(to: paths.diagnostics, options: [.atomic])
}

private func hostArchitecture() -> String {
    var systemInfo = utsname()
    uname(&systemInfo)
    return withUnsafePointer(to: &systemInfo.machine) { pointer in
        pointer.withMemoryRebound(to: CChar.self, capacity: 1) {
            String(cString: $0)
        }
    }
}

private func hasVirtualizationEntitlement() -> Bool {
    guard let task = SecTaskCreateFromSelf(nil) else {
        return false
    }
    let value = SecTaskCopyValueForEntitlement(
        task,
        "com.apple.security.virtualization" as CFString,
        nil
    )
    return (value as? Bool) == true
}

private func fileExists(_ url: URL) -> Bool {
    FileManager.default.fileExists(atPath: url.path)
}

private func validateVmAssets(paths: RuntimePaths) -> String? {
    guard fileExists(paths.manifest) else {
        return "Linux VM asset manifest is missing from the packaged runtime."
    }

    let manifest: VmAssetManifest
    do {
        manifest = try loadVmAssetManifest(paths: paths)
    } catch {
        return "Linux VM asset manifest is invalid: \(error.localizedDescription)"
    }

    guard manifest.schemaVersion == 2 else {
        return "Linux VM asset manifest schema version is unsupported."
    }
    guard manifest.architecture == "arm64" else {
        return "Linux VM image architecture is unsupported."
    }
    guard manifest.imageFormat == "raw" else {
        return "Linux VM image format is unsupported."
    }
    guard manifest.image == "base-linux.img" else {
        return "Linux VM asset manifest image path is unsupported."
    }
    guard !manifest.imageSha256.isEmpty else {
        return "Linux VM image checksum is not configured."
    }
    guard manifest.boot.loader == "linux" else {
        return "Linux VM boot loader is unsupported."
    }
    guard manifest.boot.kernel == "vmlinuz" else {
        return "Linux VM kernel path is unsupported."
    }
    guard !manifest.boot.kernelSha256.isEmpty else {
        return "Linux VM kernel checksum is not configured."
    }
    guard manifest.boot.initrd == "initrd.img" else {
        return "Linux VM initrd path is unsupported."
    }
    guard !manifest.boot.initrdSha256.isEmpty else {
        return "Linux VM initrd checksum is not configured."
    }
    guard !manifest.boot.commandLine.isEmpty else {
        return "Linux VM kernel command line is not configured."
    }
    guard manifest.bootstrap == "guest-bootstrap.sh" else {
        return "Linux VM asset manifest bootstrap path is unsupported."
    }
    guard !manifest.bootstrapSha256.isEmpty else {
        return "Linux VM guest bootstrap checksum is not configured."
    }
    guard manifest.guestService.transport == "vsock" else {
        return "Linux VM guest service transport is unsupported."
    }
    guard manifest.guestService.port == 10240 else {
        return "Linux VM guest service port is unsupported."
    }
    guard !manifest.guestService.command.isEmpty else {
        return "Linux VM guest service command is not configured."
    }
    guard fileExists(paths.baseImage) else {
        return "Linux VM image is missing from the packaged runtime."
    }
    guard fileExists(paths.kernel) else {
        return "Linux VM kernel is missing from the packaged runtime."
    }
    guard fileExists(paths.initrd) else {
        return "Linux VM initrd is missing from the packaged runtime."
    }
    guard fileExists(paths.guestBootstrap) else {
        return "Linux VM guest bootstrap is missing from the packaged runtime."
    }

    return nil
}

private func loadVmAssetManifest(paths: RuntimePaths) throws -> VmAssetManifest {
    let data = try Data(contentsOf: paths.manifest)
    return try JSONDecoder().decode(VmAssetManifest.self, from: data)
}

private func loadOrCreateMachineIdentifier(paths: RuntimePaths) throws -> VZGenericMachineIdentifier {
    if let data = try? Data(contentsOf: paths.machineId),
       let identifier = VZGenericMachineIdentifier(dataRepresentation: data)
    {
        return identifier
    }

    let identifier = VZGenericMachineIdentifier()
    try identifier.dataRepresentation.write(to: paths.machineId, options: [.atomic])
    return identifier
}

private func parseOptions(_ arguments: [String]) -> [String: String] {
    var options: [String: String] = [:]
    var index = 0
    while index < arguments.count {
        let argument = arguments[index]
        if argument == "--" {
            break
        }
        if argument.hasPrefix("--"), index + 1 < arguments.count {
            options[String(argument.dropFirst(2))] = arguments[index + 1]
            index += 2
            continue
        }
        index += 1
    }
    return options
}

private func parseOption(_ name: String, from arguments: [String]) -> String? {
    parseOptions(arguments)[name]
}

private func parsePositiveIntOption(_ name: String, from arguments: [String], defaultValue: Int) -> Int {
    guard let raw = parseOption(name, from: arguments), let value = Int(raw), value > 0 else {
        return defaultValue
    }
    return value
}

private func commandAfterSeparator(_ arguments: [String]) -> String {
    guard let separatorIndex = arguments.firstIndex(of: "--") else {
        return ""
    }
    return arguments.dropFirst(separatorIndex + 1).joined(separator: " ")
}

public func encodeResponse(_ response: JsonResponse) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(response)
    return String(decoding: data, as: UTF8.self)
}
