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
const crypto = require("crypto");
require("dotenv").config();

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
    saveUninitialized: true,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'strict'
    },
  })
);

// Middleware to sync Firebase user with Supabase
async function syncUserMiddleware(req, res, next) {
  if (req.session.firebaseUser && !req.session.supabaseUserId) {
    try {
      // Check if user exists in Supabase
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', req.session.firebaseUser.uid)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        console.error('Error checking for existing user:', error);
      }
      
      if (data) {
        // User exists, store Supabase ID in session
        req.session.supabaseUserId = data.id;
      } else {
        // User doesn't exist, create a new one
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            firebase_uid: req.session.firebaseUser.uid,
            display_name: req.session.firebaseUser.displayName || '',
            email: req.session.firebaseUser.email || '',
            photo_url: req.session.firebaseUser.photoURL || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();
        
        if (insertError) {
          console.error('Error creating user in Supabase:', insertError);
        } else {
          req.session.supabaseUserId = newUser[0].id;
        }
      }
    } catch (error) {
      console.error('Error in syncUserMiddleware:', error);
    }
  }
  next();
}

// Apply user sync middleware to all routes
app.use(syncUserMiddleware);

// Middleware to protect premium routes (not used for creator-studio, customize, or chat)
function guardRoute(req, res, next) {
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

app.get("/creator-studio", (req, res) => {
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

// Handle dynamic routes for marketplace alters
app.get("/markeplace/:alterId.html", async (req, res) => {
  const alterId = req.params.alterId;
  
  // Check if it's a static pre-made alter
  const staticPath = path.join(__dirname, "markeplace", `${alterId}.html`);
  if (fs.existsSync(staticPath)) {
    return res.sendFile(staticPath);
  }
  
  // If not static, try to fetch from database
  try {
    const { data, error } = await supabase
      .from('published_alters')
      .select('*')
      .eq('id', alterId)
      .single();
    
    if (error || !data) {
      console.error('Error fetching alter:', error || 'Alter not found');
      return res.status(404).send('Alter not found');
    }
    
    // TODO: In a production app, you would render a template with the alter data
    // For now, redirect to marketplace
    res.redirect('/marketplace');
  } catch (error) {
    console.error('Error in dynamic alter route:', error);
    res.status(500).send('Server error');
  }
});

// Handle "Create Your Own Alter" button click
app.post("/start-customize", (req, res) => {
  req.session.allowedAccess = true;
  res.redirect("/customize");
});

// API endpoint to handle login and Firebase user sync
app.post("/api/login", async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Get user details from Firebase
    const firebaseUser = await admin.auth().getUser(uid);
    
    // Store in session
    req.session.firebaseUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified
    };
    
    // Sync to Supabase happens in middleware
    
    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// API endpoint to get configuration
app.get("/api-config", (req, res) => {
  res.json({
    elevenlabs_key: process.env.ELEVENLABS_API_KEY,
    did_key: process.env.DID_API_KEY,
    openai_key: process.env.OPENAI_API_KEY,
    supabase_url: process.env.SUPABASE_URL,
    supabase_key: process.env.SUPABASE_ANON_KEY
  });
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
  express.raw({ type: "application/json" }), // Parse raw body for webhook signature
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      // Verify webhook signature
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
            const userId = session.client_reference_id; // From create-checkout-session
            const email = session.customer_details?.email;

            let supabaseUserId = userId;
            if (email) {
              // Try to find or create user in Supabase auth
              const { data: authUser, error: userError } =
                await supabaseAdmin.auth.admin.getUserByEmail(email);
              if (userError) {
                console.warn(
                  "Error fetching user by email:",
                  userError.message
                );
              }

              if (authUser?.user) {
                supabaseUserId = authUser.user.id;
              } else {
                // Create a new user in Supabase auth
                const { data: newUser, error: createError } =
                  await supabaseAdmin.auth.admin.createUser({
                    email,
                    email_confirm: true,
                    user_metadata: { stripe_customer_id: customerId },
                  });
                if (createError) {
                  console.error(
                    "Error creating Supabase user:",
                    createError.message
                  );
                  throw createError;
                }
                supabaseUserId = newUser.user.id;
                console.log("Created new Supabase user:", supabaseUserId);
              }
            }

            if (supabaseUserId) {
              // Upsert creator record in creatorsuser table
              const { error: upsertError } = await supabaseAdmin
                .from("creatorsuser")
                .upsert(
                  {
                    id: supabaseUserId,
                    stripe_customer_id: customerId,
                    is_creator: true,
                    created_at: new Date().toISOString(),
                  },
                  { onConflict: "id" }
                );

              if (upsertError) {
                console.error("Error upserting creator:", upsertError.message);
                throw upsertError;
              }

              console.log(
                `Creator saved for user ${supabaseUserId}, customer ${customerId}`
              );
            } else {
              console.warn(
                "No user ID or email available for creator creation",
                {
                  customerId,
                  email,
                  userId,
                }
              );
            }
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
      console.error("Webhook processing error:", error.message);
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
    filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    // Extract text content from document
    let documentContent = "";
    if (fileType === "application/pdf") {
      const dataBuffer = await fsPromises.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      documentContent = pdfData.text;
    } else if (fileType === "text/plain") {
      documentContent = await fsPromises.readFile(filePath, "utf8");
    }

    // Upload to Supabase Storage
    const supabaseFilePath = `documents/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(filePath);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(supabaseFilePath, fileBuffer, {
          contentType: fileType,
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
      documentUrl: publicUrl,
      documentName: fileName,
      documentContent: documentContent,
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
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.use(express.static(__dirname));

// Start server
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
