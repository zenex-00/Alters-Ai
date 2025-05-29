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
      return res.redirect("/login");
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
      return res.redirect("/login");
    }

    if (!userData || userData.length === 0) {
      console.log("User not found in users table");
      return res.redirect("/login");
    }

    console.log("Found user in Supabase:", userData);

    // Get the user ID from the first result
    const userId = userData[0].id;
    if (!userId) {
      console.error("No valid user ID found");
      return res.redirect("/login");
    }

    // Then check if they are a creator
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("is_creator")
      .eq("user_id", userId)
      .limit(1);

    if (creatorError) {
      console.error("Error checking creator status:", creatorError);
      return res.redirect("/creator-page");
    }

    if (!creatorData || creatorData.length === 0 || !creatorData[0].is_creator) {
      console.log("User is not a creator");
      return res.redirect("/creator-page");
    }

    console.log("User is authorized as creator");
    next();
  } catch (error) {
    console.error("Creator middleware error:", error);
    return res.redirect("/creator-page");
  }
};

// Middleware to check if user has purchased a specific alter
const hasPurchasedAlter = async (req, res, next) => {
  try {
    const firebaseUid = req.session.userId;
    const alterId = req.params.alterId || req.query.alterId;

    if (!firebaseUid) {
      console.log("No Firebase UID in session");
      return res.redirect("/login");
    }

    if (!alterId) {
      console.log("No alter ID provided");
      return res.status(400).json({ error: "Alter ID is required" });
    }

    // First get the user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      console.error("Error finding user:", userError);
      return res.redirect("/login");
    }

    const userId = userData[0].id;

    // Check if user has purchased this alter
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("alter_id", alterId)
      .limit(1);

    if (purchaseError) {
      console.error("Error checking purchase status:", purchaseError);
      return res.status(500).json({ error: "Failed to check purchase status" });
    }

    if (!purchaseData || purchaseData.length === 0) {
      console.log("User has not purchased this alter");
      return res.status(403).json({ error: "You need to purchase this alter to access it" });
    }

    // User has purchased the alter, proceed
    next();
  } catch (error) {
    console.error("Error in hasPurchasedAlter middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  isCreator,
  hasPurchasedAlter
};
