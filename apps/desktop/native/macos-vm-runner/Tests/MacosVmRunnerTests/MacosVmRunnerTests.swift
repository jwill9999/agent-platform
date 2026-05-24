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

    @Test func prepareFailsClearlyWhenAssetManifestIsMissing() {
        let runtimeDir = temporaryRuntimeDir()

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Linux VM asset manifest is missing from the packaged runtime."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareFailsClearlyWhenBaseImageIsMissing() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir, includeImage: false)

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

    @Test func prepareFailsClearlyWhenGuestBootstrapIsMissing() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir, includeBootstrap: false)

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Linux VM guest bootstrap is missing from the packaged runtime."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareFailsClearlyWhenManifestIsInvalid() throws {
        let runtimeDir = temporaryRuntimeDir()
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        try "{".write(to: images.appendingPathComponent("manifest.json"), atomically: true, encoding: .utf8)

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(result.response.ok == false)
        #expect(result.response.state == "unavailable")
        #expect(result.response.message.hasPrefix("Linux VM asset manifest is invalid:"))
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareCreatesRuntimeStateWhenBaseImageExists() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)

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
        try writeVmAssets(runtimeDir: runtimeDir)

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
        try writeVmAssets(runtimeDir: runtimeDir)

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

    private func writeVmAssets(
        runtimeDir: URL,
        includeImage: Bool = true,
        includeBootstrap: Bool = true
    ) throws {
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        let manifest = """
        {
          "schemaVersion": 1,
          "architecture": "arm64",
          "imageFormat": "raw",
          "image": "base-linux.img",
          "bootstrap": "guest-bootstrap.sh",
          "guestService": {
            "transport": "vsock",
            "port": 10240,
            "command": "/usr/local/bin/agent-platform-guest-service"
          }
        }
        """
        try manifest.write(
            to: images.appendingPathComponent("manifest.json"),
            atomically: true,
            encoding: .utf8
        )
        if includeImage {
            FileManager.default.createFile(
                atPath: images.appendingPathComponent("base-linux.img").path,
                contents: Data("raw-image-placeholder".utf8)
            )
        }
        if includeBootstrap {
            try "#!/bin/sh\n".write(
                to: images.appendingPathComponent("guest-bootstrap.sh"),
                atomically: true,
                encoding: .utf8
            )
        }
    }
}
