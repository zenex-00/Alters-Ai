// auth-sync.js
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Firebase Auth
let auth = null;
let supabaseClient = null;
let currentUser = null;

/**
 * Initialize Firebase Auth
 */
async function initFirebaseAuth() {
  if (auth) return auth;
  
  try {
    // Get Firebase auth from the global firebase object
    auth = getAuth();
    return auth;
  } catch (error) {
    console.error('Error initializing Firebase Auth:', error);
    throw error;
  }
}

/**
 * Initialize Supabase client
 */
async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  
  try {
    // Fetch Supabase configuration from server
    const response = await fetch('/api-config');
    if (!response.ok) {
      throw new Error('Failed to fetch API configuration');
    }
    
    const config = await response.json();
    const supabaseUrl = config.supabase_url;
    const supabaseKey = config.supabase_key;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    // Create Supabase client
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    return supabaseClient;
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    throw error;
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<Object|null>} The current user or null if not authenticated
 */
export async function getCurrentUser() {
  // If we already have the current user, return it
  if (currentUser) return currentUser;
  
  try {
    // Initialize Firebase Auth
    const auth = await initFirebaseAuth();
    
    // Get the current user from Firebase Auth
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        
        if (user) {
          // User is signed in
          const { uid, displayName, email, photoURL } = user;
          
          // Create user object with Firebase data
          currentUser = {
            firebaseUid: uid,
            displayName,
            email,
            photoURL,
            supabaseUserId: null
          };
          
          // Try to get Supabase user ID
          try {
            const supabase = await initSupabase();
            const { data, error } = await supabase
              .from('users')
              .select('id')
              .eq('firebase_uid', uid)
              .single();
            
            if (!error && data) {
              currentUser.supabaseUserId = data.id;
            }
          } catch (error) {
            console.error('Error getting Supabase user ID:', error);
          }
        } else {
          // User is signed out
          currentUser = null;
        }
        
        resolve(currentUser);
      });
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sync Firebase user to Supabase
 * @param {Object} user - The Firebase user object
 * @returns {Promise<Object>} - The synced user with Supabase ID
 */
export async function syncUserToSupabase(user) {
  if (!user || !user.firebaseUid) {
    throw new Error('Invalid user object');
  }
  
  try {
    // Initialize Supabase
    const supabase = await initSupabase();
    
    // Check if user already exists in Supabase
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', user.firebaseUid)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error('Error checking for existing user:', fetchError);
      throw fetchError;
    }
    
    if (existingUser) {
      // User exists, update their information
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: user.displayName || existingUser.display_name,
          email: user.email || existingUser.email,
          photo_url: user.photoURL || existingUser.photo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id);
      
      if (updateError) {
        console.error('Error updating user in Supabase:', updateError);
        throw updateError;
      }
      
      // Update the current user object with Supabase ID
      user.supabaseUserId = existingUser.id;
      currentUser = user;
      
      return user;
    } else {
      // User doesn't exist, create a new one
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          firebase_uid: user.firebaseUid,
          display_name: user.displayName || '',
          email: user.email || '',
          photo_url: user.photoURL || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        console.error('Error creating user in Supabase:', insertError);
        throw insertError;
      }
      
      // Update the current user object with Supabase ID
      user.supabaseUserId = newUser[0].id;
      currentUser = user;
      
      return user;
    }
  } catch (error) {
    console.error('Error syncing user to Supabase:', error);
    throw error;
  }
}

// Initialize auth on script load
initFirebaseAuth().catch(console.error);
