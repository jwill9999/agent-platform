import Foundation
import MacosVmRunnerCore

let result = handleCommand(arguments: Array(CommandLine.arguments.dropFirst()))

do {
    print(try encodeResponse(result.response))
    exit(result.exitCode)
} catch {
    fputs("{\"message\":\"Failed to encode VM runner response.\",\"mode\":\"macos-vm\",\"ok\":false,\"state\":\"unavailable\"}\n", stderr)
    exit(1)
}
