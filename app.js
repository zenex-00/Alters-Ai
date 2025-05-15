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
const FirebaseStore = require("connect-session-firebase")(session);
require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = [
  "STRIPE_SECRET_KEY",
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "DID_API_KEY",
  "OPEN_AI_API_KEY",
  "ELEVENLABS_API_KEY",
];
if (process.env.NODE_ENV === "production") {
  requiredEnvVars.push("RENDER_EXTERNAL_URL");
}
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// Initialize Firebase Admin with service account
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`, // Add database URL
});

// Initialize Firestore and Realtime Database
const db = admin.firestore();
const rtdb = admin.database();

const port = process.env.PORT || 3000;

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
const isProduction = process.env.NODE_ENV === "production";
app.use(
  session({
    store: new FirebaseStore({
      database: rtdb,
      sessions: "sessions",
      reapInterval: 24 * 60 * 60 * 1000,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Middleware to protect premium routes
async function guardRoute(req, res, next) {
  console.log("guardRoute: Session data:", {
    userId: req.session.userId,
    isCreator: req.session.isCreator,
    allowedAccess: req.session.allowedAccess,
  });

  // Check session
  if (req.session.isCreator || req.session.allowedAccess) {
    console.log("guardRoute: Access granted via session");
    return next();
  }

  // Check Firestore for creator status
  if (req.session.userId) {
    try {
      const userDoc = await db
        .collection("users")
        .doc(req.session.userId)
        .get();
      console.log(
        "guardRoute: Firestore user data:",
        userDoc.exists ? userDoc.data() : "Not found"
      );
      if (userDoc.exists && userDoc.data().isCreator) {
        req.session.isCreator = true; // Sync session
        await req.session.save(); // Ensure session is saved
        console.log("guardRoute: Access granted via Firestore");
        return next();
      }
    } catch (error) {
      console.error("guardRoute: Error checking Firestore:", error);
    }
  }

  console.log("guardRoute: Redirecting to /login");
  res.redirect("/login");
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
  res.sendFile(path.join(__dirname, "Creator-Studio.html"));
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
app.post("/start-customize", async (req, res) => {
  req.session.allowedAccess = true;
  await req.session.save();
  res.redirect("/customize");
});

// Stripe checkout session creation
app.post("/create-checkout-session", async (req, res) => {
  try {
    // Determine the base URL based on the environment
    const baseUrl = isProduction
      ? process.env.RENDER_EXTERNAL_URL
      : `http://localhost:${port}`;

    // Validate baseUrl
    if (!baseUrl) {
      console.error("ERROR: RENDER_EXTERNAL_URL not set in production");
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (isProduction && !baseUrl.startsWith("https")) {
      console.error("ERROR: Non-HTTPS URL (%s) used in production", baseUrl);
      return res.status(500).json({ error: "HTTPS required in production" });
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
  console.log("payment-success: Processing session ID:", sessionId);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      console.log(
        "payment-success: Payment confirmed, userId:",
        req.session.userId
      );
      // Set session flag
      req.session.isCreator = true;

      // Store creator status in Firestore if user is authenticated
      if (req.session.userId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await db.collection("users").doc(req.session.userId).set(
              {
                isCreator: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log("payment-success: Firestore updated, isCreator: true");
            break;
          } catch (error) {
            console.warn(
              `payment-success: Firestore attempt ${attempt} failed:`,
              error
            );
            if (attempt === 3) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      // Save session before redirect
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("payment-success: Session save error:", err);
            reject(err);
          } else {
            console.log("payment-success: Session saved");
            resolve();
          }
        });
      });

      res.redirect("/creator-studio");
    } else {
      console.log(
        "payment-success: Payment not confirmed, redirecting to creator-page"
      );
      res.redirect("/creator-page");
    }
  } catch (error) {
    console.error("payment-success: Error:", error);
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

    // Initialize user in Firestore if not exists
    const userRef = db.collection("users").doc(decodedToken.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({
        email: decodedToken.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isCreator: false,
      });
    }

    await req.session.save();
    console.log("auth/google: Session saved for user:", decodedToken.uid);
    res.json({ success: true });
  } catch (error) {
    console.error("auth/google: Error:", error);
    res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// Handle Sign Out
app.post("/auth/signout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("auth/signout: Session destruction error:", err);
      return res.status(500).json({ error: "Failed to sign out" });
    }
    console.log("auth/signout: Session destroyed");
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
  console.log(
    `Server started on port ${isProduction ? "Render" : "localhost"}:${port}`
  );
  console.log(
    "Base URL:",
    isProduction ? process.env.RENDER_EXTERNAL_URL : `http://localhost:${port}`
  );
});
