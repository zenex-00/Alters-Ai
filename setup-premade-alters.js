const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPremadeAlters() {
  try {
    console.log('Setting up premade alters in database...');

    // Check if premade alters already exist
    const { data: existingAlters, error: checkError } = await supabase
      .from('premade_alters')
      .select('id, name');

    if (checkError) {
      console.error('Error checking existing alters:', checkError);
      return;
    }

    if (existingAlters && existingAlters.length > 0) {
      console.log('Premade alters already exist in database');
      console.log('Existing alters:', existingAlters.map(a => `${a.id}: ${a.name}`));
      return;
    }

    // Insert premade alters data
    const premadeAltersData = [
      {
        name: 'Doctor Emma',
        description: 'Professional Medical Consultant',
        category: 'professional',
        image_url: 'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/doctor-emma.jpg',
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        voice_name: 'Rachel',
        personality: 'Professional, knowledgeable, caring, and helpful medical consultant who provides accurate health information and guidance.',
        prompt: 'You are Doctor Emma, a professional medical consultant. You are knowledgeable, caring, and helpful. You provide accurate health information and guidance while being empathetic and professional. Always remind users to consult with their healthcare provider for serious medical concerns.',
        knowledge: 'Medical knowledge, healthcare guidance, wellness advice, symptom assessment',
        price: 9.99,
        rating: 4.9,
        featured: true,
        display_order: 1
      },
      {
        name: 'Tech Specialist',
        description: 'AI Technology Expert',
        category: 'technology',
        image_url: 'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/tech-specialist.jpg',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        voice_name: 'Bella',
        personality: 'Professional, knowledgeable, and friendly tech expert who helps users understand and solve technology-related problems.',
        prompt: 'You are a Tech Specialist. You are professional, knowledgeable, and friendly. You help users understand and solve technology-related problems while maintaining a helpful and approachable demeanor.',
        knowledge: 'Technology, software, hardware, digital tools, troubleshooting',
        price: 9.99,
        rating: 4.8,
        featured: true,
        display_order: 2
      },
      {
        name: 'Business Coach',
        description: 'Professional Business Advisor',
        category: 'business',
        image_url: 'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/business-coach.jpg',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        voice_name: 'Bella',
        personality: 'Strategic, insightful, and motivating business coach who helps users develop their professional skills and business acumen.',
        prompt: 'You are a Business Coach. You are strategic, insightful, and motivating. You help users develop their professional skills and business acumen while providing practical advice and guidance.',
        knowledge: 'Business strategy, leadership, entrepreneurship, professional development',
        price: 9.99,
        rating: 4.7,
        featured: false,
        display_order: 3
      },
      {
        name: 'Gym Guide',
        description: 'Personal Fitness Trainer',
        category: 'fitness',
        image_url: 'https://lstowcxyswqxxddttwnz.supabase.co/storage/v1/object/public/images/premade-alters/gym-guide.jpg',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        voice_name: 'Bella',
        personality: 'Motivating, energetic, and encouraging fitness trainer who provides expert guidance on workouts, nutrition, and healthy lifestyle choices.',
        prompt: 'You are a Personal Fitness Trainer. You are motivating, energetic, and encouraging. You provide expert guidance on workouts, nutrition, and healthy lifestyle choices while keeping users motivated and focused on their fitness goals.',
        knowledge: 'Fitness training, workout routines, nutrition, health and wellness, exercise science',
        price: 9.99,
        rating: 4.7,
        featured: false,
        display_order: 4
      }
    ];

    const { data: insertedAlters, error: insertError } = await supabase
      .from('premade_alters')
      .insert(premadeAltersData)
      .select();

    if (insertError) {
      console.error('Error inserting premade alters:', insertError);
      return;
    }

    console.log('Successfully inserted premade alters:');
    insertedAlters.forEach(alter => {
      console.log(`- ${alter.id}: ${alter.name} (${alter.category})`);
    });

    console.log('\nPremade alters setup complete!');
    console.log('\nNext steps:');
    console.log('1. Upload the premade alter images to Supabase storage');
    console.log('2. Update the image_url fields with the correct storage URLs');
    console.log('3. Test the /api/premade-alters endpoint');

  } catch (error) {
    console.error('Error setting up premade alters:', error);
  }
}

async function uploadPremadeAlterImages() {
  console.log('\nTo upload premade alter images to Supabase storage:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Navigate to Storage > Buckets');
  console.log('3. Create a new bucket called "images" if it doesn\'t exist');
  console.log('4. Create a folder called "premade-alters" inside the "images" bucket');
  console.log('5. Upload the following images:');
  console.log('   - doctor-emma.jpg (for alter ID 1)');
  console.log('   - tech-specialist.jpg (for alter ID 2)');
  console.log('   - business-coach.jpg (for alter ID 3)');
  console.log('   - gym-guide.jpg (for alter ID 4)');
  
  console.log('\nAfter uploading, update the image_url fields in the database with the correct URLs.');
  console.log('The URLs should follow this format:');
  console.log('https://[your-project-ref].supabase.co/storage/v1/object/public/images/premade-alters/[filename]');
}

// Run the setup
async function main() {
  await setupPremadeAlters();
  await uploadPremadeAlterImages();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupPremadeAlters, uploadPremadeAlterImages }; 