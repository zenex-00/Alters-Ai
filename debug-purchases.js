const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPurchases() {
  console.log("=== DEBUGGING PURCHASES TABLE ===");

  // Get all purchases
  const { data: allPurchases, error: allError } = await supabaseAdmin
    .from("purchases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (allError) {
    console.error("Error fetching all purchases:", allError);
    return;
  }

  console.log("\n--- ALL RECENT PURCHASES ---");
  allPurchases.forEach((purchase, i) => {
    console.log(`${i + 1}. Purchase ID: ${purchase.id}`);
    console.log(`   User ID: ${purchase.user_id}`);
    console.log(
      `   Alter Identifier: '${
        purchase.alter_identifier
      }' (type: ${typeof purchase.alter_identifier})`
    );
    console.log(`   Type: ${purchase.type}`);
    console.log(`   Is Premade: ${purchase.is_premade}`);
    console.log(`   Amount: ${purchase.amount}`);
    console.log(`   Created: ${purchase.created_at}`);
    console.log("   ---");
  });

  // Test specific user
  const testUserId = "7ff7cc4a-0301-44a3-9804-a8d00e4bc980";
  console.log(`\n--- PURCHASES FOR USER: ${testUserId} ---`);

  const { data: userPurchases, error: userError } = await supabaseAdmin
    .from("purchases")
    .select("*")
    .eq("user_id", testUserId);

  if (userError) {
    console.error("Error fetching user purchases:", userError);
    return;
  }

  console.log(`Found ${userPurchases.length} purchases for this user:`);
  userPurchases.forEach((purchase, i) => {
    console.log(
      `${i + 1}. Alter: '${purchase.alter_identifier}' | Type: ${
        purchase.type
      } | Premade: ${purchase.is_premade}`
    );
  });

  // Test different query variations
  console.log("\n--- TESTING QUERY VARIATIONS ---");

  const testAlterIds = ["1", "2", "3"];

  for (const alterId of testAlterIds) {
    console.log(`\nTesting alter ID: ${alterId}`);

    // Test current query
    const { data: result1, error: error1 } = await supabaseAdmin
      .from("purchases")
      .select("id, alter_identifier, type")
      .eq("user_id", testUserId)
      .eq("alter_identifier", alterId);

    console.log(`  Current query result: ${result1?.length || 0} matches`);
    if (result1?.length > 0) {
      console.log(`    Found: ${JSON.stringify(result1[0])}`);
    }

    // Test with is_premade flag
    const { data: result2, error: error2 } = await supabaseAdmin
      .from("purchases")
      .select("id, alter_identifier, type, is_premade")
      .eq("user_id", testUserId)
      .eq("alter_identifier", alterId)
      .eq("is_premade", true);

    console.log(`  With is_premade=true: ${result2?.length || 0} matches`);

    // Test with different type
    const { data: result3, error: error3 } = await supabaseAdmin
      .from("purchases")
      .select("id, alter_identifier, type, is_premade")
      .eq("user_id", testUserId)
      .eq("alter_identifier", alterId)
      .eq("type", "premade_alter");

    console.log(`  With type=premade_alter: ${result3?.length || 0} matches`);
  }

  // Check if there are any purchases with prefixed IDs
  console.log("\n--- CHECKING FOR PREFIXED ALTER IDS ---");
  const { data: prefixedPurchases, error: prefixError } = await supabaseAdmin
    .from("purchases")
    .select("alter_identifier, type, is_premade")
    .ilike("alter_identifier", "premade_%");

  console.log(
    `Found ${prefixedPurchases?.length || 0} purchases with 'premade_' prefix:`
  );
  prefixedPurchases?.forEach((p) => {
    console.log(
      `  - '${p.alter_identifier}' | Type: ${p.type} | Premade: ${p.is_premade}`
    );
  });
}

debugPurchases().catch(console.error);
