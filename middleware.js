require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client with service role key for server-side operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Middleware to check if user is a creator
const isCreator = async (req, res, next) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      console.log("No Firebase UID in session");
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("Checking creator status for Firebase UID:", firebaseUid);

    // First, get the user's Supabase ID from the users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError) {
      console.error("Error finding user:", userError);
      return res.status(401).json({ error: "User not found" });
    }

    if (!userData || userData.length === 0) {
      console.log("User not found in users table");
      return res.status(401).json({ error: "User not found" });
    }

    console.log("Found user in Supabase:", userData);

    // Get the user ID from the first result
    const userId = userData[0].id;
    if (!userId) {
      console.error("No valid user ID found");
      return res.status(401).json({ error: "Invalid user ID" });
    }

    // Then check if they are a creator
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("is_creator")
      .eq("user_id", userId)
      .limit(1);

    if (creatorError) {
      console.error("Error checking creator status:", creatorError);
      return res.status(500).json({ error: "Failed to verify creator status" });
    }

    if (!creatorData) {
      console.log("No creator record found for user");
      return res.status(403).json({ error: "Not authorized as a creator" });
    }

    if (!creatorData.is_creator) {
      console.log("User is not a creator");
      return res.status(403).json({ error: "Not authorized as a creator" });
    }

    console.log("User is authorized as creator");
    next();
  } catch (error) {
    console.error("Creator middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  isCreator,
};
