class ChatHistoryManager {
  constructor() {
    this.currentConversationId = null;
  }

  async getUserConversations() {
    try {
      const response = await fetch("/api/chat/conversations");
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }
  }

  async deleteConversation(conversationId) {
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}`,
        {
          method: "DELETE",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return false;
    }
  }

  async clearConversationHistory(conversationId) {
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/clear`,
        {
          method: "POST",
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error clearing conversation:", error);
      return false;
    }
  }

  formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }

  async getConversationSummary(conversationId) {
    try {
      const response = await fetch(`/api/chat/history/${conversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation summary");
      }
      const data = await response.json();
      const messages = data.messages || [];

      // Return basic stats about the conversation
      return {
        messageCount: messages.length,
        lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
        hasHistory: messages.length > 0,
      };
    } catch (error) {
      console.error("Error getting conversation summary:", error);
      return { messageCount: 0, lastMessage: null, hasHistory: false };
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChatHistoryManager;
} else {
  window.ChatHistoryManager = ChatHistoryManager;
}
