// marketplace-integration.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { getCurrentUser, syncUserToSupabase } from "./auth-sync.js";

// Initialize Supabase client
let supabaseClient = null;

// Initialize Supabase client with API keys
async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  try {
    // Fetch Supabase configuration from server
    const response = await fetch("/api-config");
    if (!response.ok) {
      throw new Error("Failed to fetch API configuration");
    }

    const config = await response.json();
    const supabaseUrl = config.supabase_url;
    const supabaseKey = config.supabase_key;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Create Supabase client
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    return supabaseClient;
  } catch (error) {
    console.error("Error initializing Supabase:", error);
    throw error;
  }
}

/**
 * Publish an alter to the marketplace
 * @param {Object} alterData - The alter data to publish
 * @returns {Promise<Object>} - Result of the operation
 */
export async function publishAlter(alterData) {
  try {
    // Ensure user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    // Ensure user is synced to Supabase
    await syncUserToSupabase(user);

    // Initialize Supabase
    const supabase = await initSupabase();

    // Prepare alter data for insertion
    const alterRecord = {
      name: alterData.name,
      description: alterData.description,
      personality: alterData.personality,
      prompt: alterData.prompt,
      knowledge: alterData.knowledge,
      voice_id: alterData.voiceId,
      avatar_url: alterData.avatarUrl || "",
      category: alterData.category,
      creator_name: alterData.creatorName,
      is_public: true,
    };

    // Insert alter into Supabase
    const { data, error } = await supabase
      .from("published_alters")
      .insert(alterRecord)
      .select();

    if (error) {
      console.error("Error publishing alter:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data[0] };
  } catch (error) {
    console.error("Error in publishAlter:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all published user alters
 * @returns {Promise<Object>} - Result containing alters or error
 */
export async function fetchUserAlters() {
  try {
    // Initialize Supabase
    const supabase = await initSupabase();

    // Fetch all public alters
    const { data, error } = await supabase
      .from("published_alters")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user alters:", error);
      return { success: false, error: error.message };
    }

    return { success: true, alters: data };
  } catch (error) {
    console.error("Error in fetchUserAlters:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a user alter from the marketplace
 * @param {string} alterId - The ID of the alter to delete
 * @returns {Promise<Object>} - Result of the operation
 */
export async function deleteUserAlter(alterId) {
  try {
    // Ensure user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    // Initialize Supabase
    const supabase = await initSupabase();

    // Delete the alter (RLS policies will ensure only the owner can delete)
    const { error } = await supabase
      .from("published_alters")
      .delete()
      .eq("id", alterId);

    if (error) {
      console.error("Error deleting alter:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteUserAlter:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch a specific alter by ID
 * @param {string} alterId - The ID of the alter to fetch
 * @returns {Promise<Object>} - Result containing alter or error
 */
export async function fetchAlterById(alterId) {
  try {
    // Initialize Supabase
    const supabase = await initSupabase();

    // Fetch the alter
    const { data, error } = await supabase
      .from("published_alters")
      .select("*")
      .eq("id", alterId)
      .single();

    if (error) {
      console.error("Error fetching alter:", error);
      return { success: false, error: error.message };
    }

    return { success: true, alter: data };
  } catch (error) {
    console.error("Error in fetchAlterById:", error);
    return { success: false, error: error.message };
  }
}
