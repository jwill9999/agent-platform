import Testing
import Foundation
@testable import MacosVmRunnerCore

struct MacosVmRunnerTests {
    @Test func statusWithoutRuntimeDirReturnsDeterministicUnavailableJson() throws {
        let result = handleCommand(arguments: ["status"])

        #expect(result.exitCode == 0)
        #expect(
            try encodeResponse(result.response)
                == "{\"message\":\"VM runner runtime directory is not configured.\",\"mode\":\"macos-vm\",\"ok\":false,\"state\":\"unavailable\"}"
        )
    }

    @Test func prepareFailsClearlyWhenBaseImageIsMissing() {
        let runtimeDir = temporaryRuntimeDir()

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Linux VM image is missing from the packaged runtime."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareCreatesRuntimeStateWhenBaseImageExists() throws {
        let runtimeDir = temporaryRuntimeDir()
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: images.appendingPathComponent("base-linux.img").path,
            contents: Data()
        )

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(ok: true, state: "disabled", message: "VM runner runtime is prepared.")
        )
        #expect(
            FileManager.default.fileExists(
                atPath: runtimeDir.appendingPathComponent("state/machine-id").path
            )
        )
        #expect(
            FileManager.default.fileExists(
                atPath: runtimeDir.appendingPathComponent("logs").path
            )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func startDoesNotPretendVmIsReadyBeforeLifecycleIsImplemented() throws {
        let runtimeDir = temporaryRuntimeDir()
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: images.appendingPathComponent("base-linux.img").path,
            contents: Data()
        )

        let result = handleCommand(arguments: ["start", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(ok: false, state: "unavailable", message: "VM start is not implemented.")
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func stopAndExecReturnStructuredResponses() {
        let stop = handleCommand(arguments: ["stop"])
        #expect(stop.exitCode == 0)
        #expect(stop.response == JsonResponse(ok: true, state: "disabled", message: "VM runner is stopped."))

        let exec = handleCommand(arguments: ["exec", "--workspace", "/tmp/project", "--cwd", "/tmp/project", "--", "pwd"])
        #expect(exec.exitCode == 0)
        #expect(
            exec.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "VM runner runtime directory is not configured."
                )
        )
    }

    @Test func execFailsClosedWhenVmIsNotStarted() throws {
        let runtimeDir = temporaryRuntimeDir()
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        FileManager.default.createFile(
            atPath: images.appendingPathComponent("base-linux.img").path,
            contents: Data()
        )

        let result = handleCommand(
            arguments: [
                "exec",
                "--runtime-dir",
                runtimeDir.path,
                "--workspace",
                "/tmp/project",
                "--cwd",
                "/tmp/project",
                "--",
                "pwd",
            ]
        )

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "VM runner is prepared but not started."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func unknownCommandReturnsExitCodeTwo() {
        let result = handleCommand(arguments: ["unknown"])

        #expect(result.exitCode == 2)
        #expect(
            result.response ==
                JsonResponse(ok: false, state: "unavailable", message: "Unknown command: unknown")
        )
    }

    private func temporaryRuntimeDir() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
            .appendingPathComponent("agent-platform-macos-vm-runner-\(UUID().uuidString)", isDirectory: true)
    }

    private func removeRuntimeDir(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }
}
