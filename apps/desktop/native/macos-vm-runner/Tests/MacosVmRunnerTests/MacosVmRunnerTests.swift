import Testing
import Darwin
import Foundation
@testable import MacosVmRunnerCore

private let fixtureWorkspacePath = "/tmp/project"

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

    @Test func prepareFailsClearlyWhenKernelIsMissing() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir, includeKernel: false)

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Linux VM kernel is missing from the packaged runtime."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareFailsClearlyWhenInitrdIsMissing() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir, includeInitrd: false)

        let result = handleCommand(arguments: ["prepare", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Linux VM initrd is missing from the packaged runtime."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func prepareCreatesRuntimeStateWhenBootAssetsExist() throws {
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

    @Test func startFailsClosedWhenDaemonCannotBeLaunchedFromHelperBinary() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        let workspace = temporaryRuntimeDir()
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true)

        let result = handleCommand(
            arguments: ["start", "--runtime-dir", runtimeDir.path, "--workspace", workspace.path]
        )

        #expect(result.exitCode == 0)
        #expect(
            result.response
                == JsonResponse(
                    ok: false,
                    state: "unavailable",
                    message: "Failed to start VM runner: VM daemon can only be launched from the macos-vm-runner helper."
                )
        )
        removeRuntimeDir(runtimeDir)
        removeRuntimeDir(workspace)
    }

    @Test func statusDoesNotReportReadyForStaleSocketWithoutLiveDaemon() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        let state = runtimeDir.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try "ready\n".write(
            to: state.appendingPathComponent("runner.sock"),
            atomically: true,
            encoding: .utf8
        )
        try "999999\n".write(
            to: state.appendingPathComponent("daemon.pid"),
            atomically: true,
            encoding: .utf8
        )

        let result = handleCommand(arguments: ["status", "--runtime-dir", runtimeDir.path])

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

    @Test func statusDoesNotReportReadyForStalePidReuseWithoutFreshHeartbeat() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        let state = runtimeDir.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try "ready\n".write(
            to: state.appendingPathComponent("runner.sock"),
            atomically: true,
            encoding: .utf8
        )
        try "\(getpid())\n".write(
            to: state.appendingPathComponent("daemon.pid"),
            atomically: true,
            encoding: .utf8
        )

        let result = handleCommand(arguments: ["status", "--runtime-dir", runtimeDir.path])

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

    @Test func statusDoesNotReportReadyForStaleHeartbeat() throws {
        let runtimeDir = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        let state = runtimeDir.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try "ready\n".write(
            to: state.appendingPathComponent("runner.sock"),
            atomically: true,
            encoding: .utf8
        )
        try "\(getpid())\n".write(
            to: state.appendingPathComponent("daemon.pid"),
            atomically: true,
            encoding: .utf8
        )
        let heartbeat = state.appendingPathComponent("daemon.heartbeat")
        try "old\n".write(to: heartbeat, atomically: true, encoding: .utf8)
        let staleDate = Date(timeIntervalSinceNow: -60)
        try FileManager.default.setAttributes([.modificationDate: staleDate], ofItemAtPath: heartbeat.path)

        let result = handleCommand(arguments: ["status", "--runtime-dir", runtimeDir.path])

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

    @Test func stopClearsRuntimeReadyStateMarkers() throws {
        let runtimeDir = temporaryRuntimeDir()
        let state = runtimeDir.appendingPathComponent("state", isDirectory: true)
        let logs = runtimeDir.appendingPathComponent("logs", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
        try "ready\n".write(
            to: state.appendingPathComponent("runner.sock"),
            atomically: true,
            encoding: .utf8
        )
        try "999999\n".write(
            to: state.appendingPathComponent("daemon.pid"),
            atomically: true,
            encoding: .utf8
        )
        try "stale\n".write(
            to: state.appendingPathComponent("daemon.heartbeat"),
            atomically: true,
            encoding: .utf8
        )
        try "previous failure\n".write(
            to: logs.appendingPathComponent("last-error.log"),
            atomically: true,
            encoding: .utf8
        )

        let result = handleCommand(arguments: ["stop", "--runtime-dir", runtimeDir.path])

        #expect(result.exitCode == 0)
        #expect(result.response == JsonResponse(ok: true, state: "disabled", message: "VM runner is stopped."))
        #expect(!FileManager.default.fileExists(atPath: state.appendingPathComponent("runner.sock").path))
        #expect(!FileManager.default.fileExists(atPath: state.appendingPathComponent("daemon.pid").path))
        #expect(!FileManager.default.fileExists(atPath: state.appendingPathComponent("daemon.heartbeat").path))
        #expect(!FileManager.default.fileExists(atPath: logs.appendingPathComponent("last-error.log").path))
        removeRuntimeDir(runtimeDir)
    }

    @Test func stopAndExecReturnStructuredResponses() {
        let stop = handleCommand(arguments: ["stop"])
        #expect(stop.exitCode == 0)
        #expect(stop.response == JsonResponse(ok: true, state: "disabled", message: "VM runner is stopped."))

        let exec = handleCommand(
            arguments: [
                "exec",
                "--workspace",
                fixtureWorkspacePath,
                "--cwd",
                fixtureWorkspacePath,
                "--",
                "pwd",
            ]
        )
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
                fixtureWorkspacePath,
                "--cwd",
                fixtureWorkspacePath,
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
                    message: "Failed to start VM runner: VM daemon can only be launched from the macos-vm-runner helper."
                )
        )
        removeRuntimeDir(runtimeDir)
    }

    @Test func execRejectsCwdOutsideWorkspaceBeforeGuestDispatch() throws {
        let runtimeDir = temporaryRuntimeDir()
        let workspace = temporaryRuntimeDir()
        let outside = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: true)

        let result = handleCommand(
            arguments: [
                "exec",
                "--runtime-dir",
                runtimeDir.path,
                "--workspace",
                workspace.path,
                "--cwd",
                outside.path,
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
                    message: "Command cwd is outside the selected Project workspace."
                )
        )
        removeRuntimeDir(runtimeDir)
        removeRuntimeDir(workspace)
        removeRuntimeDir(outside)
    }

    @Test func execMapsNestedWorkspaceCwdIntoGuestJob() throws {
        let runtimeDir = temporaryRuntimeDir()
        let workspace = temporaryRuntimeDir()
        let envDir = temporaryRuntimeDir()
        let envFile = envDir.appendingPathComponent("env.json")
        let nested = workspace.appendingPathComponent("src/module", isDirectory: true)
        try writeVmAssets(runtimeDir: runtimeDir)
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: envDir, withIntermediateDirectories: true)
        try #"{"AGENT_TEST":"hello ' vm","INVALID-NAME":"ignored"}"#.write(
            to: envFile,
            atomically: true,
            encoding: .utf8
        )
        try writeReadyState(runtimeDir: runtimeDir, workspace: workspace)

        let result = handleCommand(
            arguments: [
                "exec",
                "--runtime-dir",
                runtimeDir.path,
                "--workspace",
                workspace.path,
                "--cwd",
                nested.path,
                "--timeout-ms",
                "1000",
                "--max-output-bytes",
                "4096",
                "--env-file",
                envFile.path,
                "--",
                "pwd",
            ]
        )

        #expect(result.exitCode == 0)
        #expect(result.response.ok == false)
        #expect(result.response.message == "VM command did not complete before the timeout.")
        let jobRoot = runtimeDir.appendingPathComponent("state/commands/jobs", isDirectory: true)
        let jobs = try FileManager.default.contentsOfDirectory(at: jobRoot, includingPropertiesForKeys: nil)
        #expect(jobs.count == 1)
        let cwd = try String(contentsOf: jobs[0].appendingPathComponent("cwd"), encoding: .utf8)
        #expect(cwd == "/workspace/src/module\n")
        let command = try String(contentsOf: jobs[0].appendingPathComponent("command.sh"), encoding: .utf8)
        #expect(command == "pwd")
        let env = try String(contentsOf: jobs[0].appendingPathComponent("env.sh"), encoding: .utf8)
        #expect(env.contains("export AGENT_TEST="))
        #expect(env.contains("hello"))
        #expect(env.contains("vm"))
        #expect(!env.contains("INVALID-NAME"))

        removeRuntimeDir(runtimeDir)
        removeRuntimeDir(workspace)
        removeRuntimeDir(envDir)
    }

    @Test func execReturnsCompletedGuestJobResult() throws {
        let runtimeDir = temporaryRuntimeDir()
        let workspace = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true)
        try writeReadyState(runtimeDir: runtimeDir, workspace: workspace)

        DispatchQueue.global().async {
            let jobs = runtimeDir.appendingPathComponent("state/commands/jobs", isDirectory: true)
            while true {
                guard
                    let job = try? FileManager.default.contentsOfDirectory(
                        at: jobs,
                        includingPropertiesForKeys: nil
                    ).first
                else {
                    usleep(10_000)
                    continue
                }
                try? "hello\n".write(to: job.appendingPathComponent("stdout"), atomically: true, encoding: .utf8)
                try? "warn\n".write(to: job.appendingPathComponent("stderr"), atomically: true, encoding: .utf8)
                try? "7\n".write(to: job.appendingPathComponent("exit-code"), atomically: true, encoding: .utf8)
                try? "done\n".write(to: job.appendingPathComponent("done"), atomically: true, encoding: .utf8)
                break
            }
        }

        let result = handleCommand(
            arguments: [
                "exec",
                "--runtime-dir",
                runtimeDir.path,
                "--workspace",
                workspace.path,
                "--cwd",
                workspace.path,
                "--timeout-ms",
                "1000",
                "--max-output-bytes",
                "4096",
                "--",
                "echo hello",
            ]
        )

        #expect(result.exitCode == 0)
        #expect(result.response.ok == true)
        #expect(result.response.state == "ready")
        #expect(result.response.stdout == "hello\n")
        #expect(result.response.stderr == "warn\n")
        #expect(result.response.exitCode == 7)

        removeRuntimeDir(runtimeDir)
        removeRuntimeDir(workspace)
    }

    @Test func execRejectsRunningVmWithoutWorkspaceBinding() throws {
        let runtimeDir = temporaryRuntimeDir()
        let workspace = temporaryRuntimeDir()
        try writeVmAssets(runtimeDir: runtimeDir)
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true)
        try writeReadyState(runtimeDir: runtimeDir)

        let result = handleCommand(
            arguments: [
                "exec",
                "--runtime-dir",
                runtimeDir.path,
                "--workspace",
                workspace.path,
                "--cwd",
                workspace.path,
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
                    message: "VM runner is already started without a Project workspace."
                )
        )

        removeRuntimeDir(runtimeDir)
        removeRuntimeDir(workspace)
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
        includeKernel: Bool = true,
        includeInitrd: Bool = true,
        includeBootstrap: Bool = true
    ) throws {
        let images = runtimeDir.appendingPathComponent("images", isDirectory: true)
        try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
        let manifest = """
        {
          "schemaVersion": 2,
          "architecture": "arm64",
          "imageFormat": "raw",
          "image": "base-linux.img",
          "imageSha256": "placeholder-image-sha",
          "boot": {
            "loader": "linux",
            "kernel": "vmlinuz",
            "kernelSha256": "placeholder-kernel-sha",
            "initrd": "initrd.img",
            "initrdSha256": "placeholder-initrd-sha",
            "commandLine": "console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target"
          },
          "bootstrap": "guest-bootstrap.sh",
          "bootstrapSha256": "placeholder-bootstrap-sha",
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
        if includeKernel {
            FileManager.default.createFile(
                atPath: images.appendingPathComponent("vmlinuz").path,
                contents: Data("kernel-placeholder".utf8)
            )
        }
        if includeInitrd {
            FileManager.default.createFile(
                atPath: images.appendingPathComponent("initrd.img").path,
                contents: Data("initrd-placeholder".utf8)
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

    private func writeReadyState(runtimeDir: URL, workspace: URL? = nil) throws {
        let state = runtimeDir.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try "ready\n".write(
            to: state.appendingPathComponent("runner.sock"),
            atomically: true,
            encoding: .utf8
        )
        try "\(getpid())\n".write(
            to: state.appendingPathComponent("daemon.pid"),
            atomically: true,
            encoding: .utf8
        )
        try "\(Date().timeIntervalSince1970)\n".write(
            to: state.appendingPathComponent("daemon.heartbeat"),
            atomically: true,
            encoding: .utf8
        )
        if let workspace {
            try "\(workspace.resolvingSymlinksInPath().standardizedFileURL.path)\n".write(
                to: state.appendingPathComponent("workspace-root"),
                atomically: true,
                encoding: .utf8
            )
        }
    }
}
