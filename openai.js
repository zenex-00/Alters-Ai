export async function fetchOpenAIResponse(apiKey, userMessage) {
  try {
    // Get the chat prompt from VideoAgent if available
    let systemPrompt = "You are a helpful AI assistant.";
    let userPrompt = userMessage;

    if (
      window.videoAgent &&
      typeof window.videoAgent.buildChatPrompt === "function"
    ) {
      const fullPrompt = await window.videoAgent.buildChatPrompt(userMessage);

      // Split the full prompt into system and user parts
      const parts = fullPrompt.split("\n\nUser: ");
      if (parts.length === 2) {
        systemPrompt = parts[0];
        userPrompt = parts[1];
      } else {
        systemPrompt = fullPrompt;
        userPrompt = userMessage;
      }
    }

    console.log("openai.js: System prompt:", systemPrompt);
    console.log("openai.js: User message:", userPrompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();

    console.log("openai.js: Received response from OpenAI:", aiResponse);
    return aiResponse;
  } catch (error) {
    console.error("openai.js: Error fetching OpenAI response:", error);
    throw error;
  }
}
