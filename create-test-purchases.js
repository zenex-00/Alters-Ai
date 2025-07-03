const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPurchase() {
  console.log("=== CREATING TEST PURCHASE ===");

  const testUserId = "7ff7cc4a-0301-44a3-9804-a8d00e4bc980";
  const testAlterId = "1"; // Test with alter ID 1

  // First, check if user exists
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", testUserId)
    .limit(1);

  if (userError || !userData || userData.length === 0) {
    console.error("Test user not found:", testUserId);
    return;
  }

  // Get admin user as creator
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", "admin@alters.ai")
    .limit(1);

  if (adminError || !adminData || adminData.length === 0) {
    console.error("Admin user not found");
    return;
  }

  const adminId = adminData[0].id;

  // Get admin creator record
  const { data: creatorData, error: creatorError } = await supabaseAdmin
    .from("creatorsuser")
    .select("id")
    .eq("user_id", adminId)
    .limit(1);

  if (creatorError || !creatorData || creatorData.length === 0) {
    console.error("Admin creator not found");
    return;
  }

  const creatorUserId = creatorData[0].id;

  // Create test purchase
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("purchases")
    .insert([
      {
        user_id: testUserId,
        creator_id: creatorUserId,
        alter_identifier: testAlterId,
        type: "premade_alter",
        is_premade: true,
        purchase_date: new Date().toISOString(),
        payment_id: "test_payment_" + Date.now(),
        amount: 9.99,
        created_at: new Date().toISOString(),
      },
    ])
    .select();

  if (purchaseError) {
    console.error("Error creating test purchase:", purchaseError);
    return;
  }

  console.log("Test purchase created successfully:", purchase[0]);

  // Now test the query
  console.log("\n=== TESTING PURCHASE QUERY ===");
  const { data: queryResult, error: queryError } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type")
    .eq("user_id", testUserId)
    .eq("alter_identifier", testAlterId);

  if (queryError) {
    console.error("Query error:", queryError);
    return;
  }

  console.log("Query result:", queryResult);
  console.log("Purchase found:", queryResult && queryResult.length > 0);
}

createTestPurchase().catch(console.error);
