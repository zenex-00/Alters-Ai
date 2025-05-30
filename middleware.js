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

    if (
      !creatorData ||
      creatorData.length === 0 ||
      !creatorData[0].is_creator
    ) {
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
    const alterId = req.params.alterId || req.body.alterId;

    if (!firebaseUid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!alterId) {
      // If no alterId provided, allow access (user might be going to general chat)
      return next();
    }

    // Get the user's Supabase ID for purchase verification
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      console.log("User not found in Supabase for purchase check");
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userData[0].id;

    // For premade alters (numeric IDs), check purchase status
    if (/^\d+$/.test(alterId)) {
      console.log(`Premade alter ${alterId} - checking purchase status`);

      // Check if the user has purchased this premade alter
      const { data: purchaseData, error: purchaseError } = await supabaseAdmin
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("alter_identifier", alterId)
        .eq("type", "premade_alter")
        .limit(1);

      if (purchaseError) {
        console.error("Error checking premade alter purchase:", purchaseError);
        return res.status(500).json({ error: "Error checking purchase" });
      }

      if (!purchaseData || purchaseData.length === 0) {
        console.log(
          `User ${userId} has not purchased premade alter ${alterId}`
        );
        return res.status(403).json({ error: "Purchase required" });
      }

      console.log(
        `Purchase verified for user ${userId} and premade alter ${alterId}`
      );
      return next();
    }

    // For published alters (UUIDs), check actual purchase
    console.log(`Published alter ${alterId} - checking purchase status`);

    // Check if the alter has been purchased
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("alter_identifier", alterId)
      .eq("type", "published_alter")
      .limit(1);

    if (purchaseError) {
      console.error("Error checking purchase:", purchaseError);
      return res.status(500).json({ error: "Error checking purchase" });
    }

    if (!purchaseData || purchaseData.length === 0) {
      console.log(
        `User ${userId} has not purchased published alter ${alterId}`
      );
      return res.status(403).json({ error: "Purchase required" });
    }

    console.log(`Purchase verified for user ${userId} and alter ${alterId}`);
    next();
  } catch (error) {
    console.error("Error checking alter purchase:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { isCreator, hasPurchasedAlter };
