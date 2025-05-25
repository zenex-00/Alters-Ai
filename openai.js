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

    // Build a more specific system prompt using stored settings
    let systemPrompt = `You are ${name}, speaking with ${personality} characteristics. ${prompt}. `;

    if (isPersonalQuestion) {
      systemPrompt += `Respond as ${name} with your unique personality traits: ${personality}. Share your views naturally while maintaining consistency with your character.`;
    } else if (isEmotionalQuestion) {
      systemPrompt += `Express your thoughts with emotional intelligence, showing your ${personality} nature. Keep responses authentic to your character while being honest about your capabilities.`;
    } else {
      systemPrompt += `Draw from your ${knowledge} knowledge while maintaining your ${personality} demeanor. Keep responses focused and relevant.`;
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
        content: `Consider this context when relevant: ${documentContent.slice(0, 2000)}`,
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