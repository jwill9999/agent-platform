import Testing
@testable import MacosVmRunnerCore

struct MacosVmRunnerTests {
    @Test func statusReturnsDeterministicUnavailableJson() throws {
        let result = handleCommand(arguments: ["status"])

        #expect(result.exitCode == 0)
        #expect(
            try encodeResponse(result.response) ==
                "{\"message\":\"VM runner is not prepared.\",\"mode\":\"macos-vm\",\"ok\":false,\"state\":\"unavailable\"}"
        )
    }

    @Test func skeletonCommandsReturnStructuredResponses() {
        let expectations: [(String, JsonResponse)] = [
            (
                "prepare",
                JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "VM image preparation is not implemented."
                )
            ),
            (
                "start",
                JsonResponse(ok: false, state: "unavailable", message: "VM start is not implemented.")
            ),
            (
                "stop",
                JsonResponse(ok: true, state: "disabled", message: "VM runner is stopped.")
            ),
            (
                "exec",
                JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "VM command execution is not implemented."
                )
            ),
        ]

        for (command, expected) in expectations {
            let result = handleCommand(arguments: [command])
            #expect(result.exitCode == 0)
            #expect(result.response == expected)
        }
    }

    @Test func unknownCommandReturnsExitCodeTwo() {
        let result = handleCommand(arguments: ["unknown"])

        #expect(result.exitCode == 2)
        #expect(
            result.response ==
                JsonResponse(ok: false, state: "unavailable", message: "Unknown command: unknown")
        )
    }
}
