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
require("dotenv").config();

// Initialize Firebase Admin with service account
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const port = 3000;

const app = express();
app.use(express.json());

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase client with environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "Uploads/");
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
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Middleware to protect premium routes
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

app.get("/creator-studio", guardRoute, (req, res) => {
  res.sendFile(path.join(__dirname, "Creator-Studio .h tml"));
});

app.get("/customize", guardRoute, (req, res) => {
  res.sendFile(path.join(__dirname, "customize.html"));
});

app.get("/chat", guardRoute, (req, res) => {
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
    // Use localhost for development; warn about production requirements
    const baseUrl = `http://localhost:${port}`;
    if (!baseUrl.startsWith("https")) {
      console.warn(
        "Using non-HTTPS URL (%s) for Stripe checkout. For production or real transactions, use a public HTTPS URL (e.g., via ngrok).",
        baseUrl
      );
    }

    const session = await stripe.checkout.sessions.create({
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
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
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
      res.redirect("/creator-studio");
    } else {
      res.redirect("/creator-page");
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.redirect("/creator-page");
  }
});

// Return the ngrok URL
app.get("/ngrok-url", (req, res) => {
  const ngrokUrl = process.env.NGROK_URL;
  if (!ngrokUrl || ngrokUrl.includes("localhost")) {
    console.error("ERROR: Invalid or missing NGROK_URL in .env file");
    return res
      .status(500)
      .json({ error: "NGROK_URL not configured correctly" });
  }
  console.log("Ngrok URL requested:", ngrokUrl);
  res.json({ ngrok_url: ngrokUrl });
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

  try {
    // Upload to Supabase Storage
    const filePath = `avatars/public/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(req.file.path);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(filePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true,
          cacheControl: "3600",
        });
      if (!error) break;
      updateError = error;
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
    } = supabase.storage.from("images").getPublicUrl(filePath);

    // Clean up local file
    await fsPromises.unlink(req.file.path);

    console.log("Image uploaded to Supabase:", publicUrl);
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("Image upload error:", error);
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
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

  try {
    // Upload to Supabase Storage
    const filePath = `files/public/${req.file.filename}`;
    const fileBuffer = await fsPromises.readFile(req.file.path);

    let uploadError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("images")
        .upload(filePath, fileBuffer, {
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
    } = supabase.storage.from("images").getPublicUrl(filePath);

    // Clean up local file
    await fsPromises.unlink(req.file.path);

    console.log("Audio uploaded to Supabase:", publicUrl);
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("Audio upload error:", error);
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
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

  try {
    // Parse document content
    const filePath = path.join(__dirname, "Uploads", req.file.filename);
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
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
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

    res.json({ success: true });
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

server.listen(port, () => {
  console.log(`Server started on port localhost:${port}`);
  console.log("NGROK_URL from .env:", process.env.NGROK_URL || "Not set");
});
