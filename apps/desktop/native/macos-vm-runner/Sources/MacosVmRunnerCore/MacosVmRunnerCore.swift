import Foundation

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
    guard let paths = runtimePaths(runtimeDir: runtimeDir) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner runtime directory is not configured."
            )
        )
    }

    if let assetError = validateVmAssets(paths: paths) {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: assetError
            )
        )
    }

    guard fileExists(paths.runnerSocket) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner is prepared but not started."
            )
        )
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
    guard let paths = runtimePaths(runtimeDir: runtimeDir) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner runtime directory is not configured."
            )
        )
    }

    if let assetError = validateVmAssets(paths: paths) {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: assetError
            )
        )
    }

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
    guard let paths = runtimePaths(runtimeDir: runtimeDir) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner runtime directory is not configured."
            )
        )
    }

    if let assetError = validateVmAssets(paths: paths) {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: assetError
            )
        )
    }

    return CommandResult(
        response: JsonResponse(
            ok: false,
            state: "unavailable",
            message: "VM start is not implemented."
        )
    )
}

private func stop(runtimeDir: String?) -> CommandResult {
    if let paths = runtimePaths(runtimeDir: runtimeDir), fileExists(paths.runnerSocket) {
        try? FileManager.default.removeItem(at: paths.runnerSocket)
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
    guard let paths = runtimePaths(runtimeDir: runtimeDir) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner runtime directory is not configured."
            )
        )
    }

    if let assetError = validateVmAssets(paths: paths) {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: assetError
            )
        )
    }

    guard fileExists(paths.runnerSocket) else {
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner is prepared but not started."
            )
        )
    }

    return CommandResult(
        response: JsonResponse(
            ok: false,
            state: "unavailable",
            message: "VM command execution transport is not implemented."
        )
    )
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
        runnerSocket: state.appendingPathComponent("runner.sock", isDirectory: false)
    )
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
