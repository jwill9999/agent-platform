import Foundation

public struct JsonResponse: Codable, Equatable {
    public let ok: Bool
    public let mode: String
    public let state: String
    public let message: String

    public init(ok: Bool, mode: String = "macos-vm", state: String, message: String) {
        self.ok = ok
        self.mode = mode
        self.state = state
        self.message = message
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

    switch command {
    case "status":
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM runner is not prepared."
            )
        )
    case "prepare":
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM image preparation is not implemented."
            )
        )
    case "start":
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM start is not implemented."
            )
        )
    case "stop":
        return CommandResult(
            response: JsonResponse(
                ok: true,
                state: "disabled",
                message: "VM runner is stopped."
            )
        )
    case "exec":
        return CommandResult(
            response: JsonResponse(
                ok: false,
                state: "unavailable",
                message: "VM command execution is not implemented."
            )
        )
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

public func encodeResponse(_ response: JsonResponse) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(response)
    return String(decoding: data, as: UTF8.self)
}
