import SwiftUI

@main
struct phoebeOSApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowBackgroundDragBehavior(.enabled)
        .defaultSize(width: 1200, height: 800)
        .windowResizability(.contentMinSize)
    }
}
