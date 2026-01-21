import Foundation

/// Sample data for previews and Phase 1 placeholder UI
/// Note: This data is for demonstration purposes. In later phases,
/// this will be replaced by real data from iMessage, Gmail, and Instagram.
extension SampleConversation {
    static let samples: [SampleConversation] = [
        // iMessage conversations
        SampleConversation(
            participant: "Sarah Chen",
            source: .iMessage,
            lastMessage: "Hey! Are we still meeting for coffee tomorrow?",
            lastMessageTime: Date().addingTimeInterval(-3600), // 1 hour ago
            unreadCount: 1,
            messages: [
                SampleMessage(content: "Hey Phoebe!", sender: "Sarah Chen", timestamp: Date().addingTimeInterval(-7200), isFromMe: false),
                SampleMessage(content: "Hi Sarah! What's up?", sender: "Me", timestamp: Date().addingTimeInterval(-7000), isFromMe: true),
                SampleMessage(content: "Hey! Are we still meeting for coffee tomorrow?", sender: "Sarah Chen", timestamp: Date().addingTimeInterval(-3600), isFromMe: false)
            ]
        ),
        SampleConversation(
            participant: "Mom",
            source: .iMessage,
            lastMessage: "Call me when you get a chance, sweetie",
            lastMessageTime: Date().addingTimeInterval(-86400), // 1 day ago
            unreadCount: 2,
            messages: [
                SampleMessage(content: "Hi honey, how are you?", sender: "Mom", timestamp: Date().addingTimeInterval(-90000), isFromMe: false),
                SampleMessage(content: "Call me when you get a chance, sweetie", sender: "Mom", timestamp: Date().addingTimeInterval(-86400), isFromMe: false)
            ]
        ),

        // Gmail conversations
        SampleConversation(
            participant: "Alex Rivera",
            source: .gmail,
            lastMessage: "RE: Project Update - Thanks for sending the latest designs...",
            lastMessageTime: Date().addingTimeInterval(-7200), // 2 hours ago
            unreadCount: 0,
            messages: [
                SampleMessage(content: "Hi Alex, here are the latest designs for review.", sender: "Me", timestamp: Date().addingTimeInterval(-14400), isFromMe: true),
                SampleMessage(content: "RE: Project Update - Thanks for sending the latest designs. I have a few comments...", sender: "Alex Rivera", timestamp: Date().addingTimeInterval(-7200), isFromMe: false)
            ]
        ),
        SampleConversation(
            participant: "LinkedIn",
            source: .gmail,
            lastMessage: "You have 3 new connection requests",
            lastMessageTime: Date().addingTimeInterval(-172800), // 2 days ago
            unreadCount: 1,
            messages: [
                SampleMessage(content: "You have 3 new connection requests waiting for your response.", sender: "LinkedIn", timestamp: Date().addingTimeInterval(-172800), isFromMe: false)
            ]
        ),

        // Instagram conversations
        SampleConversation(
            participant: "james.wilson",
            source: .instagram,
            lastMessage: "Love your latest post! Where was that taken?",
            lastMessageTime: Date().addingTimeInterval(-10800), // 3 hours ago
            unreadCount: 1,
            messages: [
                SampleMessage(content: "Love your latest post! Where was that taken?", sender: "james.wilson", timestamp: Date().addingTimeInterval(-10800), isFromMe: false)
            ]
        ),
        SampleConversation(
            participant: "photo_enthusiast",
            source: .instagram,
            lastMessage: "Would you be interested in a collab?",
            lastMessageTime: Date().addingTimeInterval(-259200), // 3 days ago
            unreadCount: 1,
            messages: [
                SampleMessage(content: "Hi! I really love your photography style.", sender: "photo_enthusiast", timestamp: Date().addingTimeInterval(-262800), isFromMe: false),
                SampleMessage(content: "Would you be interested in a collab?", sender: "photo_enthusiast", timestamp: Date().addingTimeInterval(-259200), isFromMe: false)
            ]
        )
    ]

    /// Single sample for simple previews
    static let sample = samples[0]

    /// Empty state
    static let empty: [SampleConversation] = []
}

extension SampleMessage {
    static let sample = SampleMessage(
        content: "This is a sample message",
        sender: "Sample User",
        timestamp: Date(),
        isFromMe: false
    )
}
