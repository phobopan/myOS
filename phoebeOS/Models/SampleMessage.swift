import Foundation

/// Source type for messages (will be replaced by unified model in later phases)
enum MessageSource: String, CaseIterable, Identifiable {
    case iMessage = "iMessage"
    case gmail = "Gmail"
    case instagram = "Instagram"

    var id: String { rawValue }

    var iconName: String {
        switch self {
        case .iMessage: return "message.fill"
        case .gmail: return "envelope.fill"
        case .instagram: return "camera.fill"
        }
    }
}

/// A single message in a conversation
struct SampleMessage: Identifiable, Hashable {
    let id: UUID
    let content: String
    let sender: String
    let timestamp: Date
    let isFromMe: Bool

    init(id: UUID = UUID(), content: String, sender: String, timestamp: Date, isFromMe: Bool) {
        self.id = id
        self.content = content
        self.sender = sender
        self.timestamp = timestamp
        self.isFromMe = isFromMe
    }
}

/// A conversation with multiple messages
struct SampleConversation: Identifiable, Hashable {
    let id: UUID
    let participant: String
    let source: MessageSource
    let lastMessage: String
    let lastMessageTime: Date
    let unreadCount: Int
    let messages: [SampleMessage]

    init(
        id: UUID = UUID(),
        participant: String,
        source: MessageSource,
        lastMessage: String,
        lastMessageTime: Date,
        unreadCount: Int = 0,
        messages: [SampleMessage] = []
    ) {
        self.id = id
        self.participant = participant
        self.source = source
        self.lastMessage = lastMessage
        self.lastMessageTime = lastMessageTime
        self.unreadCount = unreadCount
        self.messages = messages
    }

    /// Formatted timestamp for display
    var formattedTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: lastMessageTime, relativeTo: Date())
    }
}
