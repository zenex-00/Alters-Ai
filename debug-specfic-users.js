const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSpecificUser() {
  const testUserId = "7ff7cc4a-0301-44a3-9804-a8d00e4bc980";

  console.log("=== DEBUGGING SPECIFIC USER PURCHASES ===");
  console.log("User ID:", testUserId);

  // Get all purchases for this user
  const { data: allPurchases, error: allError } = await supabaseAdmin
    .from("purchases")
    .select("*")
    .eq("user_id", testUserId);

  if (allError) {
    console.error("Error fetching user purchases:", allError);
    return;
  }

  console.log(`\nFound ${allPurchases.length} total purchases for this user:`);
  allPurchases.forEach((purchase, i) => {
    console.log(`${i + 1}. ID: ${purchase.id}`);
    console.log(
      `   Alter ID: '${
        purchase.alter_identifier
      }' (type: ${typeof purchase.alter_identifier})`
    );
    console.log(`   Type: '${purchase.type}'`);
    console.log(`   Is Premade: ${purchase.is_premade}`);
    console.log(`   Amount: ${purchase.amount}`);
    console.log(`   Created: ${purchase.created_at}`);
    console.log("   ---");
  });

  // Test specific queries for alter ID "1"
  console.log("\n=== TESTING QUERIES FOR ALTER ID '1' ===");

  // Query 1: Current middleware query
  const { data: result1, error: error1 } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("user_id", testUserId)
    .eq("alter_identifier", "1")
    .or("type.eq.premade_alter,is_premade.eq.true");

  console.log(
    `Current middleware query result: ${result1?.length || 0} matches`
  );
  if (result1?.length > 0) {
    console.log("  Found:", JSON.stringify(result1[0]));
  }

  // Query 2: Simple type check
  const { data: result2, error: error2 } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("user_id", testUserId)
    .eq("alter_identifier", "1")
    .eq("type", "premade_alter");

  console.log(
    `Type=premade_alter query result: ${result2?.length || 0} matches`
  );
  if (result2?.length > 0) {
    console.log("  Found:", JSON.stringify(result2[0]));
  }

  // Query 3: Simple is_premade check
  const { data: result3, error: error3 } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("user_id", testUserId)
    .eq("alter_identifier", "1")
    .eq("is_premade", true);

  console.log(`is_premade=true query result: ${result3?.length || 0} matches`);
  if (result3?.length > 0) {
    console.log("  Found:", JSON.stringify(result3[0]));
  }

  // Query 4: Combined simple check
  const { data: result4, error: error4 } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("user_id", testUserId)
    .eq("alter_identifier", "1")
    .eq("type", "premade_alter")
    .eq("is_premade", true);

  console.log(`Combined simple query result: ${result4?.length || 0} matches`);
  if (result4?.length > 0) {
    console.log("  Found:", JSON.stringify(result4[0]));
  }
}

debugSpecificUser().catch(console.error);
