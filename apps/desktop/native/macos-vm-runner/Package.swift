// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MacosVmRunner",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "macos-vm-runner", targets: ["MacosVmRunner"])
    ],
    targets: [
        .target(name: "MacosVmRunnerCore"),
        .executableTarget(name: "MacosVmRunner", dependencies: ["MacosVmRunnerCore"]),
        .testTarget(name: "MacosVmRunnerTests", dependencies: ["MacosVmRunnerCore"]),
    ]
)
