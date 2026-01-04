/**
 * VINTAGE COOKBOOK - COMMENTS API
 * Serverless function for handling recipe comments
 * 
 * This function connects to Firebase Firestore and handles:
 * - GET /api/comments?recipeId=xxx - Get comments for a recipe
 * - POST /api/comments - Add new comment to a recipe
 */

// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (reuse existing app if already initialized)
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
        console.error('Firebase initialization error:', error);
    }
}

const db = admin.firestore();

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Main handler function
 */
module.exports = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    try {
        const { method, query } = req;

        // Route based on method
        if (method === 'GET') {
            // Get comments for a recipe
            return await getComments(req, res, query.recipeId);
        } else if (method === 'POST') {
            // Add new comment
            return await addComment(req, res);
        } else {
            return res.status(405).json({ 
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST']
            });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};

/**
 * Get all comments for a specific recipe
 */
async function getComments(req, res, recipeId) {
    try {
        if (!recipeId) {
            return res.status(400).json({
                error: 'Recipe ID is required',
                message: 'Please provide recipeId as a query parameter'
            });
        }

        const commentsRef = db.collection('comments');
        const snapshot = await commentsRef
            .where('recipeId', '==', recipeId)
            .orderBy('createdAt', 'desc')
            .get();

        const comments = [];
        snapshot.forEach(doc => {
            comments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json({
            success: true,
            count: comments.length,
            recipeId: recipeId,
            comments: comments
        });
    } catch (error) {
        console.error('Error getting comments:', error);
        return res.status(500).json({ 
            error: 'Failed to retrieve comments',
            message: error.message 
        });
    }
}

/**
 * Add a new comment to a recipe
 */
async function addComment(req, res) {
    try {
        const commentData = req.body;

        // Validate required fields
        if (!commentData.recipeId || !commentData.username || !commentData.comment) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['recipeId', 'username', 'comment']
            });
        }

        // Verify that the recipe exists
        const recipeRef = db.collection('recipes').doc(commentData.recipeId);
        const recipeDoc = await recipeRef.get();

        if (!recipeDoc.exists) {
            return res.status(404).json({
                error: 'Recipe not found',
                recipeId: commentData.recipeId
            });
        }

        // Sanitize and prepare comment data
        const newComment = {
            recipeId: sanitizeString(commentData.recipeId),
            username: sanitizeString(commentData.username),
            comment: sanitizeString(commentData.comment),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Validate comment length
        if (newComment.comment.length < 1 || newComment.comment.length > 1000) {
            return res.status(400).json({
                error: 'Invalid comment length',
                message: 'Comment must be between 1 and 1000 characters'
            });
        }

        // Validate username length
        if (newComment.username.length < 1 || newComment.username.length > 100) {
            return res.status(400).json({
                error: 'Invalid username length',
                message: 'Username must be between 1 and 100 characters'
            });
        }

        // Add to Firestore
        const docRef = await db.collection('comments').add(newComment);

        // Get the created document
        const doc = await docRef.get();

        return res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comment: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        return res.status(500).json({ 
            error: 'Failed to add comment',
            message: error.message 
        });
    }
}

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(input) {
    if (!input) return '';
    if (typeof input !== 'string') return String(input);
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
}
