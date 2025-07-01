# Premade Alters Database Setup Guide

This guide will help you set up the database-driven premade alters system to replace the hardcoded approach and fix image loading issues.

## Overview

The solution involves:
1. Creating a `premade_alters` table in Supabase
2. Storing premade alter images in Supabase storage
3. Updating the API to fetch from database
4. Updating frontend code to use database-driven data

## Step 1: Database Setup

### 1.1 Create the premade_alters table

Run the SQL script in your Supabase SQL editor:

```sql
-- Create premade_alters table
CREATE TABLE IF NOT EXISTS premade_alters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    voice_id VARCHAR(255) NOT NULL,
    voice_name VARCHAR(100) NOT NULL,
    personality TEXT NOT NULL,
    prompt TEXT NOT NULL,
    knowledge TEXT NOT NULL,
    price DECIMAL(10,2) DEFAULT 9.99,
    rating DECIMAL(3,2) DEFAULT 4.5,
    featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_premade_alters_active ON premade_alters(is_active);
CREATE INDEX IF NOT EXISTS idx_premade_alters_category ON premade_alters(category);
CREATE INDEX IF NOT EXISTS idx_premade_alters_display_order ON premade_alters(display_order);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_premade_alters_updated_at 
    BEFORE UPDATE ON premade_alters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE premade_alters ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to active premade alters" ON premade_alters
    FOR SELECT USING (is_active = true);
```

### 1.2 Insert sample data

```sql
INSERT INTO premade_alters (
    name, 
    description, 
    category, 
    image_url, 
    voice_id, 
    voice_name, 
    personality, 
    prompt, 
    knowledge, 
    price, 
    rating, 
    featured, 
    display_order
) VALUES 
(
    'Doctor Emma',
    'Professional Medical Consultant',
    'professional',
    'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/doctor-emma.jpg',
    '21m00Tcm4TlvDq8ikWAM',
    'Rachel',
    'Professional, knowledgeable, caring, and helpful medical consultant who provides accurate health information and guidance.',
    'You are Doctor Emma, a professional medical consultant. You are knowledgeable, caring, and helpful. You provide accurate health information and guidance while being empathetic and professional. Always remind users to consult with their healthcare provider for serious medical concerns.',
    'Medical knowledge, healthcare guidance, wellness advice, symptom assessment',
    9.99,
    4.9,
    true,
    1
),
(
    'Tech Specialist',
    'AI Technology Expert',
    'technology',
    'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/tech-specialist.jpg',
    'EXAVITQu4vr4xnSDxMaL',
    'Bella',
    'Professional, knowledgeable, and friendly tech expert who helps users understand and solve technology-related problems.',
    'You are a Tech Specialist. You are professional, knowledgeable, and friendly. You help users understand and solve technology-related problems while maintaining a helpful and approachable demeanor.',
    'Technology, software, hardware, digital tools, troubleshooting',
    9.99,
    4.8,
    true,
    2
),
(
    'Business Coach',
    'Professional Business Advisor',
    'business',
    'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/business-coach.jpg',
    'EXAVITQu4vr4xnSDxMaL',
    'Bella',
    'Strategic, insightful, and motivating business coach who helps users develop their professional skills and business acumen.',
    'You are a Business Coach. You are strategic, insightful, and motivating. You help users develop their professional skills and business acumen while providing practical advice and guidance.',
    'Business strategy, leadership, entrepreneurship, professional development',
    9.99,
    4.7,
    false,
    3
),
(
    'Gym Guide',
    'Personal Fitness Trainer',
    'fitness',
    'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/gym-guide.jpg',
    'EXAVITQu4vr4xnSDxMaL',
    'Bella',
    'Motivating, energetic, and encouraging fitness trainer who provides expert guidance on workouts, nutrition, and healthy lifestyle choices.',
    'You are a Personal Fitness Trainer. You are motivating, energetic, and encouraging. You provide expert guidance on workouts, nutrition, and healthy lifestyle choices while keeping users motivated and focused on their fitness goals.',
    'Fitness training, workout routines, nutrition, health and wellness, exercise science',
    9.99,
    4.7,
    false,
    4
);
```

## Step 2: Image Storage Setup

### 2.1 Create Supabase Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to **Storage** > **Buckets**
3. Create a new bucket called `images` (if it doesn't exist)
4. Set the bucket to public
5. Create a folder called `premade-alters` inside the `images` bucket

### 2.2 Upload Premade Alter Images

Upload the following images to the `images/premade-alters/` folder:

- `doctor-emma.jpg` - Professional medical consultant avatar
- `tech-specialist.jpg` - Technology expert avatar  
- `business-coach.jpg` - Business coach avatar
- `gym-guide.jpg` - Fitness trainer avatar

### 2.3 Update Image URLs

After uploading, update the `image_url` fields in the database with the correct URLs:

```sql
UPDATE premade_alters 
SET image_url = 'https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/images/premade-alters/doctor-emma.jpg'
WHERE id = 1;

UPDATE premade_alters 
SET image_url = 'https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/images/premade-alters/tech-specialist.jpg'
WHERE id = 2;

UPDATE premade_alters 
SET image_url = 'https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/images/premade-alters/business-coach.jpg'
WHERE id = 3;

UPDATE premade_alters 
SET image_url = 'https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/images/premade-alters/gym-guide.jpg'
WHERE id = 4;
```

Replace `[YOUR-PROJECT-REF]` with your actual Supabase project reference.

## Step 3: Testing

### 3.1 Test the API Endpoint

```bash
curl http://localhost:5000/api/premade-alters
```

You should get a JSON response with the premade alters data.

### 3.2 Test the Marketplace

1. Navigate to the marketplace page
2. Switch to the "Premade" tab
3. Verify that premade alters are loading correctly
4. Check that images are displaying properly

### 3.3 Test Chat Functionality

1. Click on a premade alter to start chatting
2. Verify that the alter data (personality, prompt, voice) is loaded correctly
3. Test that the chat interface works as expected

## Benefits of This Solution

1. **Reliable Image Loading**: Images stored in Supabase storage are more reliable than external URLs
2. **Database-Driven**: Easy to add, modify, or remove premade alters without code changes
3. **Production Ready**: Works consistently across different devices and environments
4. **Fallback Support**: Graceful degradation if database is unavailable
5. **Scalable**: Easy to add more premade alters in the future
6. **Maintainable**: Centralized data management through database

## Next Steps

1. Upload your actual premade alter images to Supabase storage
2. Update the image URLs in the database
3. Test all functionality thoroughly
4. Consider adding more premade alters through the database
5. Monitor performance and optimize as needed 