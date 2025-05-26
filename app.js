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
const { isCreator } = require("./middleware");

// Initialize Firebase Admin with service account
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const port = process.env.PORT || 3000; // Use Render.com PORT or default to 3000

const app = express();
app.use(express.json());

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client with anon key for general use
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize Supabase client with service_role key for server-side operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// Middleware to track session state
app.use(
  session({
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

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/chat-alter", (req, res) => {
  res.sendFile(path.join(__dirname, "chat-alter.html"));
});

app.get("/pricing", (req, res) => {
  res.sendFile(path.join(__dirname, "Pricing.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "About.html"));
});

app.get("/marketplace", (req, res) => {
  res.sendFile(path.join(__dirname, "Marketplace.html"));
});

app.get("/creator-page", (req, res) => {
  res.sendFile(path.join(__dirname, "Creator-Page.html"));
});

app.get("/creator-studio", isCreator, (req, res) => {
  console.log("Accessing /creator-studio, session:", {
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
  });
  res.sendFile(path.join(__dirname, "Creator-Studio.html"));
});

app.get("/customize", (req, res) => {
  console.log("Accessing /customize, session:", {
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
  });
  res.sendFile(path.join(__dirname, "customize.html"));
});

app.get("/chat", (req, res) => {
  console.log("Accessing /chat, session:", {
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
  });
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
        : `localhost:${port}`;
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

// Stripe webhook handler
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
      console.log("Webhook received:", {
        type: event.type,
        id: event.id,
        timestamp: new Date(event.created * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Webhook signature verification failed:", error.message);
      return res
        .status(400)
        .json({ error: "Webhook signature verification failed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("Processing checkout.session.completed:", {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            customerId: session.customer,
            clientReferenceId: session.client_reference_id,
          });

          if (session.payment_status === "paid") {
            const customerId = session.customer;
            const firebaseUid = session.client_reference_id;
            const email = session.customer_details?.email;

            // First, find or create the user in the users table
            let userRecord;
            const { data: existingUser, error: userError } = await supabaseAdmin
              .from("users")
              .select("id")
              .eq("firebase_uid", firebaseUid)
              .single();

            if (userError) {
              console.log("User not found, creating new user...");
              // Create new user if not found
              const { data: newUser, error: createError } = await supabaseAdmin
                .from("users")
                .insert([
                  {
                    firebase_uid: firebaseUid,
                    email: email,
                    display_name: session.customer_details?.name || null,
                  },
                ])
                .select()
                .single();

              if (createError) {
                console.error("Error creating user:", createError);
                throw createError;
              }
              userRecord = newUser;
              console.log("New user created:", userRecord);
            } else {
              userRecord = existingUser;
              console.log("Existing user found:", userRecord);
            }

            // Check if creator record already exists
            const { data: existingCreator, error: creatorCheckError } =
              await supabaseAdmin
                .from("creatorsuser")
                .select("*")
                .eq("user_id", userRecord.id)
                .single();

            if (creatorCheckError && creatorCheckError.code !== "PGRST116") {
              console.error(
                "Error checking existing creator:",
                creatorCheckError
              );
              throw creatorCheckError;
            }

            if (existingCreator) {
              console.log("Updating existing creator record:", existingCreator);
              // Update existing creator record
              const { error: updateError } = await supabaseAdmin
                .from("creatorsuser")
                .update({
                  stripe_customer_id: customerId,
                  is_creator: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userRecord.id);

              if (updateError) {
                console.error("Error updating creator:", updateError);
                throw updateError;
              }
            } else {
              console.log("Creating new creator record");
              // Create new creator record
              const { error: insertError } = await supabaseAdmin
                .from("creatorsuser")
                .insert([
                  {
                    user_id: userRecord.id,
                    stripe_customer_id: customerId,
                    is_creator: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ]);

              if (insertError) {
                console.error("Error creating creator:", insertError);
                throw insertError;
              }
            }

            console.log("Creator record processed successfully:", {
              userId: userRecord.id,
              customerId: customerId,
            });
          } else {
            console.log("Payment not paid, skipping creator creation");
          }
          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

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
      .single();

    if (alterError) {
      console.error("Error fetching alter:", alterError);
      return res.status(404).json({ error: "Alter not found" });
    }

    if (alterData.user_id !== userId) {
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
      .single();

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
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from("creatorsuser")
      .select("is_creator")
      .eq("user_id", userData.id)
      .maybeSingle();

    if (creatorError) {
      if (creatorError.code === "PGRST116") {
        console.log("No creator record found for user");
        return res.json({ isCreator: false });
      }
      console.error("Error checking creator status:", creatorError);
      return res.json({ isCreator: false });
    }

    const isCreator = creatorData?.is_creator || false;
    console.log("Creator status check result:", {
      userId: userData.id,
      isCreator,
    });
    res.json({ isCreator });
  } catch (error) {
    console.error("Error in check-creator-status:", error);
    res.json({ isCreator: false });
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

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
