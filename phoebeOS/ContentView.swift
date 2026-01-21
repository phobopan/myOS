import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            // Main content area - placeholder for now
            VStack {
                Text("phoebeOS")
                    .font(.largeTitle)
                    .fontWeight(.medium)
                    .foregroundStyle(.white)

                Text("Foundation Ready")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .frame(minWidth: 900, minHeight: 600)
        .background(VisualEffectView().ignoresSafeArea())
    }
}

#Preview {
    ContentView()
}
