const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY 
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                    : undefined
            })
        });
    } catch (error) {
        console.error('Firebase init error:', error);
    }
}

module.exports = async (req, res) => {
    try {
        const db = admin.firestore();
        
        const envCheck = {
            projectId: process.env.FIREBASE_PROJECT_ID || 'MISSING',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'MISSING',
            privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY
        };

        let firestoreStatus = 'Not tested';
        try {
            const recipesRef = db.collection('recipes');
            const snapshot = await recipesRef.limit(1).get();
            firestoreStatus = `SUCCESS - ${snapshot.size} recipes found`;
        } catch (error) {
            firestoreStatus = `ERROR: ${error.message}`;
        }

        return res.status(200).json({
            status: 'OK',
            environment: envCheck,
            firestore: firestoreStatus
        });

    } catch (error) {
        return res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
};
