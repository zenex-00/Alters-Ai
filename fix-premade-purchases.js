const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPremadePurchases() {
  console.log("=== FIXING PREMADE PURCHASE RECORDS ===");

  // Get all purchases with type 'premade_alter' but is_premade = false
  const { data: brokenPurchases, error: fetchError } = await supabaseAdmin
    .from("purchases")
    .select("id, alter_identifier, type, is_premade")
    .eq("type", "premade_alter")
    .eq("is_premade", false);

  if (fetchError) {
    console.error("Error fetching broken purchases:", fetchError);
    return;
  }

  console.log(`Found ${brokenPurchases.length} purchases to fix`);

  if (brokenPurchases.length === 0) {
    console.log("No purchases need fixing");
    return;
  }

  // Fix each purchase
  const fixPromises = brokenPurchases.map(async (purchase) => {
    const { error: updateError } = await supabaseAdmin
      .from("purchases")
      .update({ is_premade: true })
      .eq("id", purchase.id);

    if (updateError) {
      console.error(`Error updating purchase ${purchase.id}:`, updateError);
      return { success: false, id: purchase.id };
    }

    console.log(
      `Fixed purchase ${purchase.id} (alter: ${purchase.alter_identifier})`
    );
    return { success: true, id: purchase.id };
  });

  const results = await Promise.all(fixPromises);
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n=== RESULTS ===`);
  console.log(`Successfully fixed: ${successful} purchases`);
  console.log(`Failed to fix: ${failed} purchases`);

  // Verify the fix
  console.log("\n=== VERIFYING FIX ===");
  const { data: verifyData, error: verifyError } = await supabaseAdmin
    .from("purchases")
    .select("count")
    .eq("type", "premade_alter")
    .eq("is_premade", true);

  if (!verifyError) {
    console.log(
      "Purchases with type=premade_alter and is_premade=true:",
      verifyData
    );
  }
}

fixPremadePurchases().catch(console.error);
