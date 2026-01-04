const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY 
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined;

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                privateKey: privateKey
            })
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

module.exports = async (req, res) => {
    try {
        const db = admin.firestore();
        
        const envVars = {
            projectId: process.env.FIREBASE_PROJECT_ID || 'MISSING',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'MISSING',
            privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY,
            privateKeyPrefix: process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 30) 
                : 'MISSING'
        };

        let firestoreTest = 'Not tested';
        try {
            const recipesRef = db.collection('recipes');
            const snapshot = await recipesRef.limit(1).get();
            firestoreTest = `SUCCESS - Found ${snapshot.size} recipes`;
        } catch (error) {
            firestoreTest = `ERROR: ${error.message}`;
        }

        return res.status(200).json({
            status: 'Firebase connection test',
            environmentVariables: envVars,
            firestoreTest: firestoreTest
        });

    } catch (error) {
        return res.status(500).json({
            status: 'ERROR',
            error: error.message,
            environmentVariables: {
                projectId: process.env.FIREBASE_PROJECT_ID || 'MISSING',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'MISSING',
                privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY
            }
        });
    }
};
```

5. **Commit:** "Add test endpoint"

### Step 2: Wait for Deployment

1. Go to Vercel dashboard
2. Wait for the green "Ready" status (about 1 minute)

### Step 3: Visit the NEW Test URL
```
https://your-project.vercel.app/api/test
