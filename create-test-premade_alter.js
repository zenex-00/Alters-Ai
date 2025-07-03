const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPremadePurchase() {
  const testUserId = "7ff7cc4a-0301-44a3-9804-a8d00e4bc980";
  const testAlterId = "1"; // Premade alter ID

  console.log("=== CREATING TEST PREMADE PURCHASE ===");
  console.log("User ID:", testUserId);
  console.log("Alter ID:", testAlterId);

  // First, get or create admin user ID for creator_id
  let adminId;
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", "admin@alters.ai")
    .limit(1);

  if (adminError || !adminData || adminData.length === 0) {
    console.log("Admin user not found, creating one...");
    const { data: newAdmin, error: createError } = await supabaseAdmin
      .from("users")
      .insert([
        {
          email: "admin@alters.ai",
          display_name: "Admin",
          firebase_uid: "admin",
          is_admin: true,
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error("Error creating admin user:", createError);
      return;
    }
    adminId = newAdmin.id;
  } else {
    adminId = adminData[0].id;
  }

  // Get or create admin in creatorsuser table
  const { data: creatorData, error: creatorError } = await supabaseAdmin
    .from("creatorsuser")
    .select("id")
    .eq("user_id", adminId)
    .limit(1);

  let creatorUserId;
  if (creatorError || !creatorData || creatorData.length === 0) {
    console.log("Creating admin creator record...");
    const { data: newCreator, error: createCreatorError } = await supabaseAdmin
      .from("creatorsuser")
      .insert([
        {
          user_id: adminId,
          is_creator: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (createCreatorError) {
      console.error("Error creating admin creator:", createCreatorError);
      return;
    }
    creatorUserId = newCreator.id;
  } else {
    creatorUserId = creatorData[0].id;
  }

  console.log("Using admin ID:", adminId);
  console.log("Using creator ID:", creatorUserId);

  // Create test purchase for premade alter
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert([
      {
        user_id: testUserId,
        creator_id: creatorUserId,
        alter_identifier: testAlterId.toString(), // Ensure it's stored as string
        type: "premade_alter",
        is_premade: true,
        purchase_date: new Date().toISOString(),
        payment_id: "test_premade_payment_" + Date.now(),
        amount: 9.99,
        created_at: new Date().toISOString(),
      },
    ])
    .select();

  if (purchaseError) {
    console.error("Error creating test premade purchase:", purchaseError);
    return;
  }

  console.log("Test premade purchase created successfully:", purchase[0]);

  // Now verify the purchase with the same query used in the app
  console.log("\n=== VERIFYING PURCHASE QUERY ===");
  const { data: queryResult, error: queryError } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("user_id", testUserId)
    .eq("alter_identifier", testAlterId.toString())
    .in("type", ["premade_alter", "premade"]);

  if (queryError) {
    console.error("Query error:", queryError);
    return;
  }

  console.log("Query result:", queryResult);
  console.log("Purchase found:", queryResult && queryResult.length > 0);

  if (queryResult && queryResult.length > 0) {
    console.log("✅ Purchase verification successful!");
    console.log("Purchase details:", JSON.stringify(queryResult[0], null, 2));
  } else {
    console.log("❌ Purchase verification failed!");
  }
}

createTestPremadePurchase().catch(console.error);
