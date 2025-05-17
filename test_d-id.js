const fetch = require("node-fetch");
const base64 = require("base-64");
require("dotenv").config();

async function getDidCredits() {
  const url = "https://api.d-id.com/credits";
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) {
    throw new Error("D-ID API key not found in environment variables");
  }
  const base64AuthString = base64.encode(apiKey);

  const headers = {
    accept: "application/json",
    Authorization: `Basic ${base64AuthString}`,
  };

  const response = await fetch(url, { headers });
  const data = await response.json();
  return data;
}

async function main() {
  try {
    const didCredits = await getDidCredits();
    // Extracting just the 'remaining' and 'total' values
    const creditsSummary = {
      remaining: didCredits.remaining,
      total: didCredits.total,
    };
    console.log("Credits Summary:", creditsSummary);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
