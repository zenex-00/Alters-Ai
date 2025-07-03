require("dotenv").config();
const express = require("express");
const http = require("http");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");
const Stripe = require("stripe");
const admin = require("firebase-admin");
const getRawBody = require("raw-body");
const { isCreator, hasPurchasedAlter } = require("./middleware");
const crypto = require("crypto");

// Initialize Firebase Admin with service account
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Supabase clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create a Supabase session store
class SupabaseSessionStore extends session.Store {
  constructor(supabase) {
    super();
    this.supabase = supabase;
  }

  async get(sid, callback) {
    try {
      const { data, error } = await this.supabase
        .from("sessions")
        .select("sess")
        .eq("sid", sid)
        .maybeSingle(); // Use maybeSingle instead of single to handle no rows case

      if (error) {
        console.error("Session get error:", error);
        return callback(error);
      }

      if (!data) {
        return callback(null, null);
      }

      try {
        const session = JSON.parse(data.sess);
        callback(null, session);
      } catch (parseError) {
        console.error("Session parse error:", parseError);
        callback(parseError);
      }
    } catch (err) {
      console.error("Session get error:", err);
      callback(err);
    }
  }

  async set(sid, sess, callback) {
    try {
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const { error } = await this.supabase.from("sessions").upsert(
        {
          sid,
          sess: JSON.stringify(sess),
          expires,
          created_at: new Date(),
        },
        {
          onConflict: "sid",
        }
      );

      if (error) {
        console.error("Session set error:", error);
        return callback(error);
      }
      callback();
    } catch (err) {
      console.error("Session set error:", err);
      callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      const { error } = await this.supabase
        .from("sessions")
        .delete()
        .eq("sid", sid);

      if (error) {
        console.error("Session destroy error:", error);
        return callback(error);
      }
      callback();
    } catch (err) {
      console.error("Session destroy error:", err);
      callback(err);
    }
  }
}

const PORT = process.env.PORT || 5000;
const app = express();

// Initialize session store with Supabase
const sessionStore = new SupabaseSessionStore(supabaseAdmin);

// Middleware to track session state
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "alter-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
    },
    proxy: process.env.NODE_ENV === "production", // Trust the reverse proxy
  })
);

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("Webhook triggered - Received event");

    const sig = req.headers["stripe-signature"];
    console.log("Stripe signature:", sig);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("Webhook event constructed successfully:", event.type);
    } catch (err) {
      console.error("Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      console.log("Processing checkout.session.completed event");
      const session = event.data.object;
      console.log("[WEBHOOK] Session data:", JSON.stringify(session, null, 2));

      try {
        // Get the Firebase UID from the client_reference_id
        const firebaseUid = session.client_reference_id;
        console.log("[WEBHOOK] Firebase UID from session:", firebaseUid);

        if (!firebaseUid) {
          console.error("[WEBHOOK] No Firebase UID found in session");
          return res.status(400).json({ error: "No Firebase UID found" });
        }

        // Get the alter ID from metadata (for alter purchases)
        const alterId = session.metadata?.alter_id;
        console.log("[WEBHOOK] alterId from session.metadata:", alterId);
        if (!alterId) {
          console.error(
            "[WEBHOOK] No alter ID found in session metadata and not a creator package"
          );
          return res.status(400).json({ error: "No alter ID found" });
        }

        // First, get the user's Supabase ID
        console.log(
          "[WEBHOOK] Querying Supabase for user with Firebase UID:",
          firebaseUid
        );
        const { data: userData, error: userError } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("firebase_uid", firebaseUid)
          .limit(1);
        if (userError) {
          console.error("[WEBHOOK] Supabase user query error:", userError);
          return res.status(500).json({ error: "Failed to find user" });
        }
        console.log("[WEBHOOK] Supabase user query result:", userData);
        if (!userData || userData.length === 0) {
          console.error("[WEBHOOK] No user found in Supabase");
          return res.status(404).json({ error: "User not found" });
        }
        const userId = userData[0].id;
        console.log("[WEBHOOK] Found Supabase user ID:", userId);

        // Get the admin user ID
        const adminId = await ensureAdminUser();
        console.log("[WEBHOOK] Using admin ID:", adminId);

        // Clean the alter ID and determine type
        let cleanAlterId = alterId;
        let alterType;

        console.log("[WEBHOOK] Processing alter ID:", alterId);

        if (alterId.startsWith("premade_")) {
          cleanAlterId = alterId.replace("premade_", "");
          alterType = "premade_alter";
          console.log(
            "[WEBHOOK] Alter ID type: Premade (from prefix), clean ID:",
            cleanAlterId
          );
        } else if (/^\d+$/.test(alterId)) {
          cleanAlterId = alterId;
          alterType = "premade_alter";
          console.log(
            "[WEBHOOK] Alter ID type: Premade (numeric), clean ID:",
            cleanAlterId
          );
        } else if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            alterId
          )
        ) {
          cleanAlterId = alterId;
          alterType = "published_alter";
          console.log("[WEBHOOK] Alter ID type: Published (UUID)");
        } else {
          console.error("[WEBHOOK] Invalid alter ID format:", alterId);
          return res.status(400).json({ error: "Invalid alter ID format" });
        }

        let alterData;

        if (alterType === "premade_alter") {
          console.log(
            "[WEBHOOK] Processing premade alter with ID:",
            cleanAlterId
          );
          // Fetch premade alter from database instead of using hardcoded data
          const { data: premadeAlter, error: alterError } = await supabaseAdmin
            .from("premade_alters")
            .select("*")
            .eq("id", parseInt(cleanAlterId))
            .single();
          if (alterError || !premadeAlter) {
            console.error(
              "[WEBHOOK] Error fetching premade alter:",
              alterError
            );
            // Fallback to basic data if alter not found in database
            alterData = {
              id: cleanAlterId,
              name: `Premade Alter ${cleanAlterId}`,
              type: "premade",
              description: "AI Digital Twin",
              category: "general",
            };
          } else {
            alterData = {
              id: premadeAlter.id.toString(),
              name: premadeAlter.name,
              type: "premade",
              description: premadeAlter.description,
              category: premadeAlter.category,
            };
          }
          console.log("[WEBHOOK] Using premade alter data:", alterData);
        } else {
          console.log(
            "[WEBHOOK] Processing published alter with UUID:",
            cleanAlterId
          );
          // For published alters, fetch from published_alters table
          const { data: publishedAlter, error: alterError } =
            await supabaseAdmin
              .from("published_alters")
              .select("*")
              .eq("id", cleanAlterId)
              .single();
          if (alterError) {
            console.error(
              "[WEBHOOK] Error fetching published alter:",
              alterError
            );
            return res.status(500).json({ error: "Error processing purchase" });
          }
          alterData = { ...publishedAlter, type: "published" };
          console.log("[WEBHOOK] Using published alter data:", alterData);
        }

        let creatorId = adminId; // Default to admin for premade alters
        if (alterType === "published_alter") {
          creatorId = alterData.user_id;
        }

        // Get the creatorsuser.id for the creator
        const { data: creatorData, error: creatorError } = await supabaseAdmin
          .from("creatorsuser")
          .select("id")
          .eq("user_id", creatorId)
          .limit(1);
        if (creatorError) {
          console.error("[WEBHOOK] Error fetching creator:", creatorError);
          return res.status(500).json({ error: "Failed to fetch creator" });
        }
        if (!creatorData || creatorData.length === 0) {
          console.error("[WEBHOOK] No creator found for user ID:", creatorId);
          return res.status(500).json({ error: "Creator not found" });
        }
        const creatorUserId = creatorData[0].id;
        console.log("[WEBHOOK] Using creator ID:", creatorUserId);

        // Store the purchase in the database - ensure cleanAlterId is stored as string
        const isPremadeAlter = alterType === "premade_alter";
        console.log("[WEBHOOK] Creating purchase record:", {
          user_id: userId,
          creator_id: creatorUserId,
          alter_identifier: cleanAlterId.toString(),
          type: alterType,
          is_premade: isPremadeAlter,
          purchase_date: new Date().toISOString(),
          payment_id: session.payment_intent,
          amount: session.amount_total / 100,
          created_at: new Date().toISOString(),
        });
        const { error: purchaseError } = await supabaseAdmin
          .from("purchases")
          .insert([
            {
              user_id: userId,
              creator_id: creatorUserId,
              alter_identifier: cleanAlterId.toString(),
              type: alterType,
              is_premade: isPremadeAlter,
              purchase_date: new Date().toISOString(),
              payment_id: session.payment_intent,
              amount: session.amount_total / 100,
              created_at: new Date().toISOString(),
            },
          ]);
        if (purchaseError) {
          console.error("[WEBHOOK] Error storing purchase:", purchaseError);
          return res.status(500).json({ error: "Failed to store purchase" });
        }
        console.log(
          "[WEBHOOK] Purchase successfully recorded in database with alter_identifier:",
          cleanAlterId.toString()
        );
        return res.json({ received: true });
      } catch (error) {
        console.error("[WEBHOOK] Webhook processing error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // For any other event type, just acknowledge receipt
    return res.json({ received: true });
  }
);

app.use(express.json());

// Function to ensure admin user exists
async function ensureAdminUser() {
  try {
    // Check if admin user exists in users table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", "admin@alters.ai")
      .limit(1);

    if (adminError) {
      console.error("Error checking admin user:", adminError);
      throw adminError;
    }

    let adminId;

    if (!adminData || adminData.length === 0) {
      // Create admin user if it doesn't exist
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
        throw createError;
      }

      console.log("Admin user created:", newAdmin);
      adminId = newAdmin.id;
    } else {
      adminId = adminData[0].id;
    }

    // Check if admin exists in creatorsuser table
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("user_id")
      .eq("user_id", adminId)
      .limit(1);

    if (creatorError) {
      console.error("Error checking admin creator status:", creatorError);
      throw creatorError;
    }

    if (!creatorData || creatorData.length === 0) {
      // Create admin in creatorsuser table
      const { error: createCreatorError } = await supabaseAdmin
        .from("creatorsuser")
        .insert([
          {
            user_id: adminId,
            is_creator: true,
            created_at: new Date().toISOString(),
          },
        ]);

      if (createCreatorError) {
        console.error("Error creating admin creator:", createCreatorError);
        throw createCreatorError;
      }

      console.log("Admin creator created");
    }

    return adminId;
  } catch (error) {
    console.error("Error in ensureAdminUser:", error);
    throw error;
  }
}

// Call ensureAdminUser when server starts
ensureAdminUser().catch(console.error);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir); // Use the same uploads directory path
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext =
      file.mimetype === "audio/mpeg"
        ? ".mp3"
        : file.mimetype === "application/pdf"
        ? ".pdf"
        : file.mimetype === "text/plain"
        ? ".txt"
        : path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// Multer for image uploads
const imageUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed."), false);
    }
  },
});

// Multer for audio uploads
const audioUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "audio/mpeg" || file.mimetype === "audio/mp3") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed."), false);
    }
  },
}).single("audio");

// Multer for document uploads
const documentUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and TXT files are allowed."), false);
    }
  },
}).single("document");

// Middleware to protect premium routes (not used for creator-studio, customize, or chat)
function guardRoute(req, res, next) {
  console.log("Guard Route Check:", {
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
    userId: req.session.userId,
    sessionID: req.sessionID,
    cookies: req.cookies,
  });

  if (req.session.isCreator || req.session.allowedAccess) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/chat-alter", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "chat-alter.html"));
});

app.get("/chat-alter/:alterId", isAuthenticated, (req, res) => {
  // Pass the alterId to the frontend via a script tag or query parameter
  res.sendFile(path.join(__dirname, "chat-alter.html"));
});

app.get("/pricing", (req, res) => {
  res.sendFile(path.join(__dirname, "Pricing.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "About.html"));
});

app.get("/marketplace", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "Marketplace.html"));
});

app.get("/creator-page", (req, res) => {
  res.sendFile(path.join(__dirname, "Creator-Page.html"));
});

app.get("/creator-studio", isAuthenticated, isCreator, (req, res) => {
  res.sendFile(path.join(__dirname, "Creator-Studio.html"));
});

app.get("/customize", isAuthenticated, isCreator, (req, res) => {
  res.sendFile(path.join(__dirname, "customize.html"));
});

app.get("/chat", isAuthenticated, isCreator, (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "Login-Page.html"));
});

// Handle "Create Your Own Alter" button click
app.post("/start-customize", (req, res) => {
  req.session.allowedAccess = true;
  res.redirect("/customize");
});

// Stripe checkout session creation
app.post("/create-checkout-session", async (req, res) => {
  try {
    // Dynamically determine baseUrl based on environment
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host =
      process.env.NODE_ENV === "production"
        ? req.headers.host
        : `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    const sessionConfig = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Creator Studio Package",
            },
            unit_amount: 5000, // $50.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/creator-page`,
    };

    // Only include client_reference_id if userId is a non-empty string
    if (req.session.userId && req.session.userId.trim() !== "") {
      sessionConfig.client_reference_id = req.session.userId;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create Stripe checkout session for alter purchase
app.post("/create-alter-checkout-session", async (req, res) => {
  try {
    const { alterId, alterName, price } = req.body;

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host =
      process.env.NODE_ENV === "production"
        ? req.headers.host
        : `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    const sessionConfig = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Alter: ${alterName}`,
              description: "AI Digital Twin purchase",
            },
            unit_amount: Math.round(price * 100), // Convert price to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/alter-purchase-success?session_id={CHECKOUT_SESSION_ID}&alter_id=${alterId}`,
      cancel_url: `${baseUrl}/marketplace`,
      metadata: {
        alter_id: alterId, // Add alter ID to metadata
      },
    };

    // Include client_reference_id if user is logged in
    if (req.session.userId && req.session.userId.trim() !== "") {
      sessionConfig.client_reference_id = req.session.userId;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Handle successful payment
app.get("/payment-success", async (req, res) => {
  const sessionId = req.query.session_id;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      req.session.isCreator = true;
      console.log(
        "Payment successful, setting isCreator:",
        req.session.isCreator
      );
      // Explicitly save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/creator-page");
        }
        console.log("Session saved, redirecting to /creator-studio");
        res.redirect("/creator-studio"); // Redirects to Creator-Studio.html
      });
    } else {
      console.log("Payment not paid, redirecting to /creator-page");
      res.redirect("/creator-page");
    }
  } catch (error) {
    console.error("Payment verification error:", error.message);
    res.redirect("/creator-page");
  }
});

// Test route to confirm server is running
app.get("/test", (req, res) => {
  console.log("Test route accessed");
  res.json({ message: "Server is running correctly" });
});

// Handle image upload
app.post("/upload", imageUpload.single("avatar"), async (req, res) => {
  console.log("Image upload route accessed, file:", req.file);
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).json({ error: "No image uploaded." });
  }

  let filePath;
  try {
    filePath = req.file.path; // Upload to Supabase Storage with page-specific path
    // Get the referrer URL to determine which page the upload came from
    const referrer = req.get("Referer") || "";
    let folder = "general";

    if (referrer.includes("chat.html")) {
      folder = "chat";
    } else if (referrer.includes("business-alter.html")) {
      folder = "business";
    } else if (referrer.includes("doctor-alter.html")) {
      folder = "doctor";
    } else if (referrer.includes("GymGuide-alter.html")) {
      folder = "gym";
    }

    const supabaseFilePath = `avatars/${folder}/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(filePath);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(supabaseFilePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true,
          cacheControl: "3600",
        });
      if (!error) break;
      uploadError = error;
      console.warn(`Supabase upload attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (uploadError) {
      console.error("Supabase image upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(supabaseFilePath);

    // Clean up local file
    await fsPromises.unlink(filePath);

    console.log("Image uploaded to Supabase:", publicUrl);
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("Image upload error:", error);
    if (filePath) {
      try {
        await fsPromises.unlink(filePath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Handle audio upload
app.post("/upload-audio", audioUpload, async (req, res) => {
  console.log("Audio upload route accessed, file:", req.file);
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).json({ error: "No audio file uploaded." });
  }

  let filePath;
  try {
    filePath = req.file.path;
    // Upload to Supabase Storage
    const supabaseFilePath = `files/public/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(filePath);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(supabaseFilePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true,
          cacheControl: "3600",
        });
      if (!error) break;
      uploadError = error;
      console.warn(`Supabase upload attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (uploadError) {
      console.error("Supabase audio upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(supabaseFilePath);

    // Clean up local file
    await fsPromises.unlink(filePath);

    console.log("Audio uploaded to Supabase:", publicUrl);
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("Audio upload error:", error);
    if (filePath) {
      try {
        await fsPromises.unlink(filePath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Handle document upload
app.post("/upload-document", documentUpload, async (req, res) => {
  console.log("Document upload route accessed, file:", req.file);
  if (!req.file) {
    console.error("No file uploaded");
    return res.status(400).json({ error: "No document uploaded." });
  }

  let filePath;
  try {
    filePath = path.join(__dirname, "Uploads", req.file.filename);
    // Parse document content
    let documentContent = "";
    if (req.file.mimetype === "application/pdf") {
      const dataBuffer = await fsPromises.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      documentContent = pdfData.text;
    } else if (req.file.mimetype === "text/plain") {
      documentContent = await fsPromises.readFile(filePath, "utf-8");
    }

    if (!documentContent) {
      throw new Error("Failed to extract content from the file.");
    }

    // Upload to Supabase Storage
    const supabaseFilePath = `documents/public/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(filePath);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(supabaseFilePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true,
          cacheControl: "3600",
        });
      if (!error) break;
      uploadError = error;
      console.warn(`Supabase upload attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (uploadError) {
      console.error("Supabase document upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(supabaseFilePath);

    // Clean up local file
    await fsPromises.unlink(filePath);

    console.log("Document uploaded to Supabase:", publicUrl);
    res.json({
      documentName: req.file.originalname,
      documentUrl: publicUrl,
      documentContent,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    if (filePath) {
      try {
        await fsPromises.unlink(filePath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }
    res
      .status(500)
      .json({ error: error.message || "Failed to process document." });
  }
});

// Handle Google Auth
app.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Set session
    req.session.userId = decodedToken.uid;
    req.session.email = decodedToken.email;
    req.session.allowedAccess = true;

    console.log("Google Auth Success:", {
      userId: decodedToken.uid,
      email: decodedToken.email,
      sessionID: req.sessionID,
    });

    // Upsert user in Supabase users table
    const { uid, email, name, picture } = decodedToken;
    const { data, error } = await supabaseAdmin.from("users").upsert(
      [
        {
          firebase_uid: uid,
          email: email,
          display_name: name || null,
          photo_url: picture || null,
        },
      ],
      { onConflict: "firebase_uid" }
    );

    if (error) {
      console.error("Supabase user upsert error:", error);
      return res.status(500).json({ error: "Failed to upsert user" });
    }

    // Explicitly save session before sending response
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Failed to save session" });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// Handle Sign Out
app.post("/auth/signout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Failed to sign out" });
    }
    res.json({ success: true });
  });
});

////```tool_code
// This commit fixes an issue where the creator status wasn't being properly saved after a Stripe checkout, and updates the webhook handler to correctly process creator package purchases.
// API configuration endpoint
app.get("/api-config", (req, res) => {
  res.json({
    key: process.env.DID_API_KEY,
    openai_key: process.env.OPEN_AI_API_KEY,
    elevenlabs_key: process.env.ELEVENLABS_API_KEY,
    url: "https://api.d-id.com",
  });
});

// API route to publish an alter to the marketplace
app.post("/api/publish-alter", isCreator, async (req, res) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Look up the Supabase UUID from your users table
    const { data: userRows, error: userLookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userLookupError || !userRows || userRows.length === 0) {
      return res.status(401).json({ error: "User not found in users table" });
    }
    const userId = userRows[0].id; // This is the UUID

    const {
      name,
      description,
      personality,
      prompt,
      knowledge,
      voice_id,
      avatar_url,
      category,
      is_public,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !description ||
      !personality ||
      !prompt ||
      !knowledge ||
      !category
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from("published_alters")
      .insert([
        {
          user_id: userId,
          name,
          description,
          personality,
          prompt,
          knowledge,
          voice_id,
          avatar_url,
          category,
          is_public: is_public !== undefined ? is_public : true,
        },
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, alter: data[0] });
  } catch (err) {
    console.error("Publish alter error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API route to get user's published alters (for Creator Studio)
app.get("/api/user-alters", isCreator, async (req, res) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Look up the Supabase UUID from users table
    const { data: userRows, error: userLookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userLookupError || !userRows || userRows.length === 0) {
      return res.status(401).json({ error: "User not found in users table" });
    }
    const userId = userRows[0].id;

    // Fetch user's published alters
    const { data, error } = await supabaseAdmin
      .from("published_alters")
      .select(`*, users: user_id (display_name, photo_url)`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch user's alters" });
    }

    res.json(data);
  } catch (err) {
    console.error("Fetch user alters error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API route to get all published alters for the marketplace
app.get("/api/published-alters", async (req, res) => {
  try {
    // Fetch all public alters, join with users for creator info
    const { data, error } = await supabaseAdmin
      .from("published_alters")
      .select(`*, users: user_id (display_name, photo_url)`)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch published alters" });
    }

    // Map to include creator_name and creator_avatar for card UI
    const alters = data.map((alter) => ({
      ...alter,
      creator_name: alter.users?.display_name || "Unknown",
      creator_avatar: alter.users?.photo_url || "/placeholder.svg",
    }));

    res.json(alters);
  } catch (err) {
    console.error("Fetch published alters error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API route to get premade alters from database
app.get("/api/premade-alters", async (req, res) => {
  try {
    console.log("Fetching premade alters from database...");

    // Fetch all premade alters from the database
    const { data, error } = await supabaseAdmin
      .from("premade_alters")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch premade alters", details: error });
    }

    console.log("Found", data?.length || 0, "premade alters");

    // Map the data to match the expected format
    const alters = data.map((alter) => ({
      id: alter.id.toString(),
      name: alter.name,
      description: alter.description,
      category: alter.category,
      image: alter.image_url,
      voiceId: alter.voice_id,
      voiceName: alter.voice_name,
      personality: alter.personality,
      prompt: alter.prompt,
      knowledge: alter.knowledge,
      price: alter.price || 9.99,
      rating: alter.rating || 4.5,
      verified: true,
      featured: alter.featured || false,
      type: "premade",
      creator: "AlterStudio",
      creatorAvatar: alter.image_url || alter.image || "/placeholder.svg",
      link: `/marketplace/premade-${alter.id}.html`,
    }));

    res.json(alters);
  } catch (err) {
    console.error("Fetch premade alters error:", err);
    res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// Test endpoint to check database connection
app.get("/api/test-db", async (req, res) => {
  try {
    console.log("Testing database connection...");

    const { data, error } = await supabaseAdmin
      .from("premade_alters")
      .select("count")
      .limit(1);

    if (error) {
      console.error("Database test error:", error);
      return res
        .status(500)
        .json({ error: "Database connection failed", details: error });
    }

    res.json({ success: true, message: "Database connection working", data });
  } catch (err) {
    console.error("Database test error:", err);
    res
      .status(500)
      .json({ error: "Database test failed", details: err.message });
  }
});

// Debug endpoint to check purchases table
app.get("/api/debug/purchases/:userId?", async (req, res) => {
  try {
    let query = supabaseAdmin
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.params.userId) {
      query = query.eq("user_id", req.params.userId);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error("Debug purchases error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch purchases", details: error });
    }

    res.json({
      success: true,
      purchases: data,
      count: data?.length || 0,
      message: "Recent purchases data",
    });
  } catch (err) {
    console.error("Debug purchases error:", err);
    res.status(500).json({ error: "Debug failed", details: err.message });
  }
});

// API route to delete a published alter
app.delete("/api/published-alters/:alterId", async (req, res) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Look up the Supabase UUID from users table
    const { data: userRows, error: userLookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userLookupError || !userRows || userRows.length === 0) {
      return res.status(401).json({ error: "User not found in users table" });
    }
    const userId = userRows[0].id;

    // First, verify that the alter belongs to the user
    const { data: alterData, error: alterError } = await supabaseAdmin
      .from("published_alters")
      .select("user_id")
      .eq("id", req.params.alterId)
      .limit(1);

    if (alterError) {
      console.error("Error fetching alter:", alterError);
      return res.status(404).json({ error: "Alter not found" });
    }

    if (!alterData || alterData.length === 0) {
      return res.status(404).json({ error: "Alter not found" });
    }

    if (alterData[0].user_id !== userId) {
      return res
        .status(403)
        .json({ error: "You don't have permission to delete this alter" });
    }

    // Delete the alter
    const { error: deleteError } = await supabaseAdmin
      .from("published_alters")
      .delete()
      .eq("id", req.params.alterId)
      .eq("user_id", userId); // Extra safety check

    if (deleteError) {
      console.error("Error deleting alter:", deleteError);
      return res.status(500).json({ error: "Failed to delete alter" });
    }

    res.json({ success: true, message: "Alter deleted successfully" });
  } catch (err) {
    console.error("Delete alter error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auth status endpoint
app.get("/api/auth/status", (req, res) => {
  console.log("Auth Status Check:", {
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
    userId: req.session.userId,
    sessionID: req.sessionID,
  });

  res.json({
    authenticated: !!req.session.userId,
    isCreator: !!req.session.isCreator,
    allowedAccess: !!req.session.allowedAccess,
  });
});

// Route to check creator status
app.get("/api/check-creator-status", async (req, res) => {
  try {
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      console.log("No Firebase UID in session");
      return res.json({ isCreator: false });
    }

    // First get the user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError) {
      console.error("Error finding user:", userError);
      return res.json({ isCreator: false });
    }

    if (!userData) {
      console.log("User not found in users table");
      return res.json({ isCreator: false });
    }

    console.log("Found user in Supabase:", userData);

    // Then check creator status
    const { data: creatorRows, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("is_creator")
      .eq("user_id", userData.id)
      .limit(1); // Only take one

    if (creatorError) {
      console.error("Error checking creator status:", creatorError);
      return res.json({ isCreator: false });
    }

    const isCreator =
      creatorRows && creatorRows.length > 0 ? creatorRows[0].is_creator : false;
    res.json({ isCreator });
  } catch (error) {
    console.error("Error in check-creator-status:", error);
    res.json({ isCreator: false });
  }
});

// Check if an alter has been purchased
app.get("/api/check-purchase/:alterId", async (req, res) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    console.log("[DEBUG] /api/check-purchase/:alterId called");
    console.log("[DEBUG] Session firebaseUid:", firebaseUid);
    if (!firebaseUid) {
      console.log("No Firebase UID in session for purchase check");
      return res.json({ purchased: false });
    }

    let alterId = req.params.alterId;
    console.log("[DEBUG] Checking purchase for alter ID:", alterId);

    // Get the user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      console.log("User not found in Supabase");
      return res.json({ purchased: false });
    }

    const userId = userData[0].id;
    console.log("[DEBUG] Resolved Supabase userId:", userId);

    // Handle premade alter IDs (both prefixed and numeric)
    if (alterId.startsWith("premade_")) {
      alterId = alterId.replace("premade_", "");
    }

    // For premade alters (numeric IDs), check if user has purchased it
    const isNumericId = /^\d+$/.test(alterId);

    if (isNumericId) {
      console.log(
        "[DEBUG] Premade alter detected, checking purchase status for ID:",
        alterId
      );

      // First verify it's a valid premade alter by checking the database
      const { data: premadeAlter, error: premadeError } = await supabaseAdmin
        .from("premade_alters")
        .select("id")
        .eq("id", parseInt(alterId))
        .eq("is_active", true)
        .limit(1);

      if (premadeError || !premadeAlter || premadeAlter.length === 0) {
        console.log("Invalid or inactive premade alter ID:", alterId);
        return res.json({ purchased: false });
      }

      // Check if the user has purchased this premade alter - handle both old and new purchase records
      const { data: purchaseData, error: purchaseError } = await supabaseAdmin
        .from("purchases")
        .select("id, alter_identifier, type, is_premade")
        .eq("user_id", userId)
        .eq("alter_identifier", alterId.toString())
        .in("type", ["premade_alter", "premade"]) // Handle both type values
        .limit(1);

      if (purchaseError) {
        console.error("Error checking premade alter purchase:", purchaseError);
        return res.json({ purchased: false });
      }

      console.log(
        "[DEBUG] Purchase query result for alterId",
        alterId,
        ":",
        purchaseData
      );
      console.log("[DEBUG] Query parameters:", {
        userId,
        alterId: alterId.toString(),
      });

      if (purchaseData && purchaseData.length > 0) {
        console.log("[DEBUG] User has purchased premade alter:", alterId);
        return res.json({ purchased: true });
      } else {
        console.log("[DEBUG] User has not purchased premade alter:", alterId);
        return res.json({ purchased: false });
      }
    }

    // For published alters (UUIDs), check actual purchase
    console.log("[DEBUG] Published alter detected, checking purchase records");

    // Check if the alter has been purchased using the purchases table
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("alter_identifier", alterId)
      .limit(1);

    if (purchaseError) {
      console.error("Error checking purchase:", purchaseError);
      return res.json({ purchased: false });
    }

    if (purchaseData && purchaseData.length > 0) {
      console.log("[DEBUG] User has purchased published alter:", alterId);
      return res.json({ purchased: true });
    } else {
      console.log("[DEBUG] User has not purchased published alter:", alterId);
      return res.json({ purchased: false });
    }
  } catch (error) {
    console.error("Error in check-purchase:", error);
    res.json({ purchased: false });
  }
});

// Debug endpoint: List all purchases for the current user
app.get("/api/debug-purchases", async (req, res) => {
  try {
    const firebaseUid = req.session.userId;
    console.log("[DEBUG] /api/debug-purchases called");
    console.log("[DEBUG] Session firebaseUid:", firebaseUid);
    if (!firebaseUid) {
      return res.status(401).json({ error: "No Firebase UID in session" });
    }
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);
    if (userError || !userData || userData.length === 0) {
      return res.status(401).json({ error: "User not found in Supabase" });
    }
    const userId = userData[0].id;
    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from("purchases")
      .select(
        "id, alter_identifier, type, is_premade, payment_id, amount, purchase_date"
      )
      .eq("user_id", userId);
    if (purchasesError) {
      return res.status(500).json({ error: "Failed to fetch purchases" });
    }
    res.json({ userId, purchases });
  } catch (error) {
    console.error("[DEBUG] Error in /api/debug-purchases:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API route to get creator's earnings stats (7% commission for published alters)
app.get("/api/creator/earnings-stats", async (req, res) => {
  try {
    // Get Firebase UID from session
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Look up the Supabase UUID from users table
    const { data: userRows, error: userLookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userLookupError || !userRows || userRows.length === 0) {
      return res.status(401).json({ error: "User not found in users table" });
    }
    const userId = userRows[0].id;

    // Get the creator's row in creatorsuser
    const { data: creatorRows, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (creatorError || !creatorRows || creatorRows.length === 0) {
      return res.status(401).json({ error: "Creator not found" });
    }
    const creatorUserId = creatorRows[0].id;

    // Get all purchases for this creator (published alters only)
    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from("purchases")
      .select("amount, type, purchase_date")
      .eq("creator_id", creatorUserId)
      .eq("type", "published_alter");

    if (purchasesError) {
      return res.status(500).json({ error: "Failed to fetch purchases" });
    }

    // Calculate stats
    let totalEarnings = 0;
    let totalSales = 0;
    let monthlyRevenue = 0;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Calculate total amount first
    let totalAmount = 0;
    purchases.forEach((purchase) => {
      totalAmount += purchase.amount;
      totalSales += 1;
      const purchaseDate = new Date(purchase.purchase_date);
      if (
        purchaseDate.getMonth() === thisMonth &&
        purchaseDate.getFullYear() === thisYear
      ) {
        monthlyRevenue += purchase.amount * 0.7; // 70% of purchase amount
      }
    });

    // Calculate 70% of total amount
    totalEarnings = totalAmount * 0.7;

    // Count active alters
    const { data: alters, error: altersError } = await supabaseAdmin
      .from("published_alters")
      .select("id")
      .eq("user_id", userId)
      .eq("is_public", true);
    const activeAlters = alters && alters.length ? alters.length : 0;

    res.json({
      totalEarnings,
      totalSales,
      activeAlters,
      monthlyRevenue,
    });
  } catch (err) {
    console.error("Earnings stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve static files
app.use("/Uploads", express.static(uploadsDir));
app.use(express.static(__dirname));
app.use("/css", express.static(path.join(__dirname, "")));
app.use("/js", express.static(path.join(__dirname, "")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(400).json({ error: err.message });
});

const server = http.createServer(app);

// Graceful shutdown to prevent memory leaks
const gracefulShutdown = () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

// Handle process termination
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Handle successful alter purchase
app.get("/alter-purchase-success", async (req, res) => {
  const { session_id, alter_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      // Serve the success page with alter_id parameter
      res.sendFile(path.join(__dirname, "alter-purchase-success.html"));
    } else {
      res.redirect("/marketplace");
    }
  } catch (error) {
    console.error("Error handling successful purchase:", error);
    res.redirect("/marketplace");
  }
});

// API endpoint to refresh purchase status (for debugging)
app.post("/api/refresh-purchase-status", async (req, res) => {
  try {
    const { alterId, alterType } = req.body;
    const firebaseUid = req.session.userId;

    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const userId = userData[0].id;
    let checkId = alterId;

    // For premade alters, use clean numeric ID for API call
    if (alterType === "premade") {
      if (alterId.startsWith("premade_")) {
        checkId = alterId.replace("premade_", "");
      }
    }

    // Check purchase status
    const response = await fetch(
      `${req.protocol}://${req.get("host")}/api/check-purchase/${checkId}`
    );
    if (response.ok) {
      const { purchased } = await response.json();
      return res.json({
        purchased,
        alterId: checkId,
        alterType,
        originalId: alterId,
      });
    } else {
      return res.status(500).json({ error: "Failed to check purchase status" });
    }
  } catch (error) {
    console.error("Error refreshing purchase status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Note: chat-alter routes are now defined above in the main routes section

// Get or create conversation for a user and alter
app.post("/api/chat/conversation", async (req, res) => {
  try {
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { alterId, alterType } = req.body;

    // Get user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const userId = userData[0].id;

    // Check if conversation already exists
    const { data: existingConv, error: convError } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, title")
      .eq("user_id", userId)
      .eq("alter_id", alterId)
      .eq("alter_type", alterType)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (convError) {
      console.error("Error checking conversation:", convError);
      return res.status(500).json({ error: "Failed to check conversation" });
    }

    let conversationId;
    if (existingConv && existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await supabaseAdmin
        .from("chat_conversations")
        .insert({
          user_id: userId,
          alter_id: alterId,
          alter_type: alterType,
          title: `Chat with ${alterId}`,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
        return res.status(500).json({ error: "Failed to create conversation" });
      }
      conversationId = newConv.id;
    }

    res.json({ conversationId });
  } catch (error) {
    console.error("Conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get conversation history
app.get("/api/chat/history/:conversationId", async (req, res) => {
  try {
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { conversationId } = req.params;

    // Get user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const userId = userData[0].id;

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Process chat message with history
app.post("/api/chat/message", async (req, res) => {
  try {
    const firebaseUid = req.session.userId;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { conversationId, message, alterContext } = req.body;

    // Get user's Supabase ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .limit(1);

    if (userError || !userData || userData.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const userId = userData[0].id;

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("chat_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get recent message history (last 20 messages for better context)
    const { data: recentMessages, error: historyError } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyError) {
      console.error("Error fetching history:", historyError);
      return res.status(500).json({ error: "Failed to fetch history" });
    }

    // Reverse to get chronological order and format for better context
    const messageHistory = (recentMessages || []).reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Save user message
    const { error: saveUserError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
      });

    if (saveUserError) {
      console.error("Error saving user message:", saveUserError);
      return res.status(500).json({ error: "Failed to save message" });
    }

    // Generate AI response using OpenAI with history
    const { fetchOpenAIResponseWithHistory } = await import("./openai.js");
    const response = await fetchOpenAIResponseWithHistory(
      process.env.OPEN_AI_API_KEY,
      message,
      messageHistory,
      alterContext
    );

    // Save AI response
    const { error: saveAIError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: response,
      });

    if (saveAIError) {
      console.error("Error saving AI message:", saveAIError);
      return res.status(500).json({ error: "Failed to save AI response" });
    }

    // Update conversation timestamp
    await supabaseAdmin
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    res.json({ response });
  } catch (error) {
    console.error("Chat processing error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { message, history, alterContext } = req.body;

    // You would typically use the message and history to interact with a language model
    // and the alterContext to customize the response based on the selected alter.
    // For example, you might adjust the prompt based on the alter's personality.

    // This is placeholder logic. Replace this with your actual chat processing logic.
    const response = `Echo: ${message}`; // Placeholder response

    res.json({ response });
  } catch (error) {
    console.error("Chat processing error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

app.post("/generate-audio", async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    // Use the voiceId to select the appropriate voice for text-to-speech generation.
    // This is placeholder logic. Replace this with your actual audio generation logic.
    const audioUrl = `https://example.com/audio/${voiceId}/${text}`; // Placeholder audio URL

    res.json({ audioUrl });
  } catch (error) {
    console.error("Audio generation error:", error);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

// Create stream endpoint for D-ID video streaming
app.post("/create-stream", async (req, res) => {
  try {
    const { avatarUrl, voiceId } = req.body;

    console.log("Creating stream with:", { avatarUrl, voiceId });

    // D-ID API configuration
    const DID_API_URL = "https://api.d-id.com";
    const API_KEY = process.env.DID_API_KEY;

    if (!API_KEY) {
      console.error("D-ID API key not configured");
      return res.status(500).json({ error: "D-ID API not configured" });
    }

    // Create stream with D-ID
    const response = await fetch(`${DID_API_URL}/talks/streams`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(API_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: avatarUrl,
        voice: {
          provider: "11labs",
          voice_id: voiceId || "EXAVITQu4vr4xnSDxMaL", // Default to Bella voice
        },
        config: {
          stitch: true,
          result_format: "mp4",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("D-ID API error:", response.status, errorText);
      return res.status(response.status).json({
        error: "Failed to create stream",
        details: errorText,
      });
    }

    const data = await response.json();
    console.log("Stream created successfully:", data.id);

    res.json({
      streamId: data.id,
      sessionId: data.session_id,
    });
  } catch (error) {
    console.error("Create stream error:", error);
    res.status(500).json({ error: "Failed to create stream" });
  }
});
