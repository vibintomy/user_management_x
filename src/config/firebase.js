import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to your Firebase service account JSON file
const serviceAccountPath = join(__dirname, '..', 'serviceAccount.json');

// Check if service account file exists
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase serviceAccount.json not found at:', serviceAccountPath);
  console.error('Please add your Firebase Admin SDK JSON file to src/serviceAccount.json');
} else {
  try {
    // Read the service account file
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
  }
}

export default admin;