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
        return execute(runtimeDir: options["runtime-dir"])
    case "daemon":
        return daemon(runtimeDir: options["runtime-dir"])
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
        try FileManager.default.createDirectory(at: paths.images, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: paths.state, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: paths.logs, withIntermediateDirectories: true)
        if !fileExists(paths.machineId) {
            try UUID().uuidString.write(to: paths.machineId, atomically: true, encoding: .utf8)
        }
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
        try launchDaemon(paths: paths)
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

private func execute(runtimeDir: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    guard fileExists(paths.runnerSocket) else {
        return unavailableResult("VM runner is prepared but not started.")
    }

    return unavailableResult("VM command execution transport is not implemented.")
}

private func daemon(runtimeDir: String?) -> CommandResult {
    let validation = validateRuntime(runtimeDir: runtimeDir)
    guard let paths = validation.paths else { return validation.result! }

    do {
        try prepareRuntimeDirectories(paths: paths)
        let configuration = try buildVirtualMachineConfiguration(paths: paths)
        let virtualMachine = VZVirtualMachine(configuration: configuration)
        let semaphore = DispatchSemaphore(value: 0)
        var startupError: Error?
        virtualMachine.start { result in
            if case let .failure(error) = result {
                startupError = error
            }
            semaphore.signal()
        }
        semaphore.wait()
        if let startupError {
            try startupError.localizedDescription.write(
                to: paths.lastError,
                atomically: true,
                encoding: .utf8
            )
            return unavailableResult("VM failed to start: \(startupError.localizedDescription)")
        }
        try "ready\n".write(to: paths.runnerSocket, atomically: true, encoding: .utf8)
        RunLoop.current.run()
        return CommandResult(
            response: JsonResponse(ok: true, state: "disabled", message: "VM runner daemon stopped.")
        )
    } catch {
        try? error.localizedDescription.write(to: paths.lastError, atomically: true, encoding: .utf8)
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
    let guestBootstrap: URL
    let machineId: URL
    let efiVariableStore: URL
    let daemonPid: URL
    let lastError: URL
    let runnerSocket: URL
}

private struct VmAssetManifest: Codable {
    let schemaVersion: Int
    let architecture: String
    let imageFormat: String
    let image: String
    let bootstrap: String
    let guestService: GuestService
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
        guestBootstrap: images.appendingPathComponent("guest-bootstrap.sh", isDirectory: false),
        machineId: state.appendingPathComponent("machine-id", isDirectory: false),
        efiVariableStore: state.appendingPathComponent("efi-variable-store", isDirectory: false),
        daemonPid: state.appendingPathComponent("daemon.pid", isDirectory: false),
        lastError: logs.appendingPathComponent("last-error.log", isDirectory: false),
        runnerSocket: state.appendingPathComponent("runner.sock", isDirectory: false)
    )
}

private func prepareRuntimeDirectories(paths: RuntimePaths) throws {
    try FileManager.default.createDirectory(at: paths.images, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: paths.state, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: paths.logs, withIntermediateDirectories: true)
    if !fileExists(paths.machineId) {
        try UUID().uuidString.write(to: paths.machineId, atomically: true, encoding: .utf8)
    }
}

private func clearRuntimeState(paths: RuntimePaths) {
    try? FileManager.default.removeItem(at: paths.runnerSocket)
    try? FileManager.default.removeItem(at: paths.daemonPid)
    try? FileManager.default.removeItem(at: paths.lastError)
}

private func vmIsRunning(paths: RuntimePaths) -> Bool {
    guard fileExists(paths.runnerSocket), let pid = readPid(paths.daemonPid) else {
        return false
    }
    return Darwin.kill(pid, 0) == 0
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

private func launchDaemon(paths: RuntimePaths) throws {
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
    process.arguments = ["daemon", "--runtime-dir", paths.root.path]
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
            return false
        }
        Thread.sleep(forTimeInterval: 0.2)
    }
    if let pid = readPid(paths.daemonPid) {
        _ = Darwin.kill(pid, SIGTERM)
    }
    return false
}

private func buildVirtualMachineConfiguration(paths: RuntimePaths) throws -> VZVirtualMachineConfiguration {
    if !fileExists(paths.efiVariableStore) {
        _ = try VZEFIVariableStore(creatingVariableStoreAt: paths.efiVariableStore)
    }
    let platform = VZGenericPlatformConfiguration()
    let bootLoader = VZEFIBootLoader()
    bootLoader.variableStore = VZEFIVariableStore(url: paths.efiVariableStore)

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
    configuration.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    configuration.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]
    try configuration.validate()
    return configuration
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

private func fileExists(_ url: URL) -> Bool {
    FileManager.default.fileExists(atPath: url.path)
}

private func validateVmAssets(paths: RuntimePaths) -> String? {
    guard fileExists(paths.manifest) else {
        return "Linux VM asset manifest is missing from the packaged runtime."
    }

    let manifest: VmAssetManifest
    do {
        let data = try Data(contentsOf: paths.manifest)
        manifest = try JSONDecoder().decode(VmAssetManifest.self, from: data)
    } catch {
        return "Linux VM asset manifest is invalid: \(error.localizedDescription)"
    }

    guard manifest.schemaVersion == 1 else {
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
    guard manifest.bootstrap == "guest-bootstrap.sh" else {
        return "Linux VM asset manifest bootstrap path is unsupported."
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
    guard fileExists(paths.guestBootstrap) else {
        return "Linux VM guest bootstrap is missing from the packaged runtime."
    }

    return nil
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

public func encodeResponse(_ response: JsonResponse) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(response)
    return String(decoding: data, as: UTF8.self)
}
