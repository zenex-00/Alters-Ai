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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_premade_alters_active ON premade_alters(is_active);
CREATE INDEX IF NOT EXISTS idx_premade_alters_category ON premade_alters(category);
CREATE INDEX IF NOT EXISTS idx_premade_alters_display_order ON premade_alters(display_order);

-- Insert sample premade alters data
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

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_premade_alters_updated_at 
    BEFORE UPDATE ON premade_alters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE premade_alters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to active premade alters
CREATE POLICY "Allow public read access to active premade alters" ON premade_alters
    FOR SELECT USING (is_active = true); 