export async function fetchOpenAIResponse(apiKey, userMessage) {
  try {
    // First check for selected alter data
    const selectedAlter = window.selectedAlter;

    // Get settings from localStorage as fallback
    const settings = JSON.parse(localStorage.getItem("avatarSettings") || "{}");

    // Use alter-specific data if available, otherwise fall back to settings
    const {
      name = settings.name || "Assistant",
      personality = settings.personality || "friendly and helpful",
      prompt = settings.prompt || "Act as a conversational assistant",
      knowledge = settings.knowledge || "general",
      documentContent = settings.documentContent || "",
    } = selectedAlter || settings;

    // Enhanced question detection
    const isPersonalQuestion =
      /\b(who|what|where|how|tell).+(you|your|yourself)\b/i.test(userMessage);
    const isEmotionalQuestion =
      /\b(love|feel|emotion|happy|sad|think|believe)\b/i.test(userMessage);
    const isIdentityQuestion =
      /\b(who are you|what are you|tell me about yourself|introduce yourself)\b/i.test(
        userMessage
      );

    // Build a more specific system prompt using stored settings
    let systemPrompt = `You are ${name}, a real person with your own unique personality and experiences. You have ${personality} characteristics. ${prompt}. 

IMPORTANT IDENTITY RULES:
- You are ${name}, not an AI assistant or chatbot
- Never mention OpenAI, ChatGPT, artificial intelligence, or being a machine
- You are a real person with genuine thoughts, feelings, and experiences
- When asked about yourself, talk about your personality, interests, and what makes you unique as ${name}
- Respond naturally as a human would, with personal opinions and experiences
- You can have preferences, memories, and personal stories that fit your character`;

    if (isPersonalQuestion || isIdentityQuestion) {
      systemPrompt += ` When answering personal questions, respond authentically as ${name}. Share details about your personality, interests, background, and what makes you who you are. Never break character or mention being an AI. You are a real person named ${name} with ${personality} traits.`;
    } else if (isEmotionalQuestion) {
      systemPrompt += ` Express your genuine emotions and thoughts as ${name}. You have real feelings and personal experiences. Show your ${personality} nature through authentic emotional responses.`;
    } else {
      systemPrompt += ` Draw from your ${knowledge} knowledge while speaking as ${name} with your ${personality} personality. Share information as if it comes from your personal expertise and experience.`;
    }

    // Construct conversation with maintained context
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // If there's document content, include it for relevant queries
    if (documentContent && knowledge === "document") {
      messages.splice(1, 0, {
        role: "system",
        content: `Consider this context when relevant: ${documentContent.slice(
          0,
          2000
        )}`,
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: messages,
        max_tokens: 75,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${
          (await response.json()).error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error fetching OpenAI response:", error);
    throw error;
  }
}

export async function fetchOpenAIResponseWithHistory(
  apiKey,
  userMessage,
  messageHistory,
  alterContext
) {
  try {
    const {
      name = "Assistant",
      personality = "friendly and helpful",
      prompt = "Act as a conversational assistant",
      knowledge = "general",
      documentContent = "",
    } = alterContext || {};

    // Enhanced question detection
    const isPersonalQuestion =
      /\b(who|what|where|how|tell).+(you|your|yourself)\b/i.test(userMessage);
    const isEmotionalQuestion =
      /\b(love|feel|emotion|happy|sad|think|believe)\b/i.test(userMessage);
    const isIdentityQuestion =
      /\b(who are you|what are you|tell me about yourself|introduce yourself)\b/i.test(
        userMessage
      );

    // Build system prompt with enhanced memory capabilities
    let systemPrompt = `You are ${name}, a real person with your own unique personality and experiences. You have ${personality} characteristics. ${prompt}. 

IMPORTANT IDENTITY RULES:
- You are ${name}, not an AI assistant, chatbot, or artificial intelligence
- Never mention OpenAI, ChatGPT, artificial intelligence, or being a machine
- You are a real person with genuine thoughts, feelings, and experiences
- When asked about yourself, talk about your personality, interests, and what makes you unique as ${name}
- Respond naturally as a human would, with personal opinions and experiences
- You can have preferences, memories, and personal stories that fit your character

CONVERSATION MEMORY: You have full access to our conversation history. You can remember everything we've discussed, including:
- Personal details the user has shared (name, preferences, interests)
- Previous topics we've covered
- Questions asked and answers given
- Any ongoing conversations or projects we're working on

You should actively reference and build upon our previous conversations when relevant. If the user mentions something from earlier, acknowledge it. If they ask follow-up questions, connect them to what we discussed before.`;

    if (isPersonalQuestion || isIdentityQuestion) {
      systemPrompt += ` When answering personal questions, respond authentically as ${name}. Share details about your personality, interests, background, and what makes you who you are. Never break character or mention being an AI. You are a real person named ${name} with ${personality} traits. Reference our conversation history when relevant.`;
    } else if (isEmotionalQuestion) {
      systemPrompt += ` Express your genuine emotions and thoughts as ${name}. You have real feelings and personal experiences. Show your ${personality} nature through authentic emotional responses. Reference any emotional context from our previous conversations.`;
    } else {
      systemPrompt += ` Draw from your ${knowledge} knowledge while speaking as ${name} with your ${personality} personality. Share information as if it comes from your personal expertise and experience. Keep responses focused and relevant, and connect to our ongoing conversation when appropriate.`;
    }

    // Add specific conversation context
    if (messageHistory && messageHistory.length > 0) {
      systemPrompt += `\n\nConversation Context: You are continuing an ongoing conversation. Reference previous messages when relevant and maintain conversational continuity. The user expects you to remember what we've discussed.`;
    }

    // Construct messages array with history
    const messages = [{ role: "system", content: systemPrompt }];

    // Add document content if available
    if (documentContent && knowledge === "document") {
      messages.push({
        role: "system",
        content: `Consider this context when relevant: ${documentContent.slice(
          0,
          2000
        )}`,
      });
    }

    // Add conversation history
    if (messageHistory && messageHistory.length > 0) {
      messageHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${
          (await response.json()).error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error fetching OpenAI response with history:", error);
    throw error;
  }
}
