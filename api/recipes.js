/**
 * VINTAGE COOKBOOK - RECIPES API
 * Serverless function for handling recipe CRUD operations
 * 
 * This function connects to Firebase Firestore and handles:
 * - GET /api/recipes - Retrieve all recipes
 * - GET /api/recipes?recent=5 - Get 5 most recent recipes
 * - POST /api/recipes - Create new recipe
 * - GET /api/recipes/:id - Get single recipe by ID
 */

// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY 
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                    : undefined
            }),
            databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

const db = admin.firestore();
// Explicitly set the database settings
db.settings({
    ignoreUndefinedProperties: true
});

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        const { method, query, url } = req;
        
        // Extract recipe ID from URL if present (remove query string first)
        const urlWithoutQuery = url.split('?')[0];
        const urlParts = urlWithoutQuery.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        const recipeId = (lastPart && lastPart !== 'recipes') ? lastPart : null;

        // Route based on method and parameters
        if (method === 'GET' && query.recent) {
            // Get recent recipes (check this BEFORE checking recipeId)
            return await getRecentRecipes(req, res, parseInt(query.recent));
        } else if (method === 'GET' && recipeId) {
            // Get single recipe by ID
            return await getRecipeById(req, res, recipeId);
        } else if (method === 'GET') {
            // Get all recipes
            return await getAllRecipes(req, res);
        } else if (method === 'POST') {
            // Create new recipe
            return await createRecipe(req, res);
        } else if (method === 'DELETE' && recipeId) {
            // Delete recipe (optional feature)
            return await deleteRecipe(req, res, recipeId);
        } else {
            return res.status(405).json({ 
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST', 'DELETE']
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
 * Get all recipes from Firestore
 */
async function getAllRecipes(req, res) {
    try {
        const recipesRef = db.collection('recipes');
        const snapshot = await recipesRef
            .orderBy('createdAt', 'desc')
            .get();

        const recipes = [];
        snapshot.forEach(doc => {
            recipes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json({
            success: true,
            count: recipes.length,
            recipes: recipes
        });
    } catch (error) {
        console.error('Error getting all recipes:', error);
        return res.status(500).json({ 
            error: 'Failed to retrieve recipes',
            message: error.message 
        });
    }
}

/**
 * Get recent recipes (limited number)
 */
async function getRecentRecipes(req, res, limit = 5) {
    try {
        const recipesRef = db.collection('recipes');
        const snapshot = await recipesRef
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const recipes = [];
        snapshot.forEach(doc => {
            recipes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return res.status(200).json({
            success: true,
            count: recipes.length,
            recipes: recipes
        });
    } catch (error) {
        console.error('Error getting recent recipes:', error);
        return res.status(500).json({ 
            error: 'Failed to retrieve recent recipes',
            message: error.message 
        });
    }
}

/**
 * Get single recipe by ID
 */
async function getRecipeById(req, res, recipeId) {
    try {
        const recipeRef = db.collection('recipes').doc(recipeId);
        const doc = await recipeRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                error: 'Recipe not found',
                recipeId: recipeId
            });
        }

        return res.status(200).json({
            success: true,
            recipe: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        console.error('Error getting recipe by ID:', error);
        return res.status(500).json({ 
            error: 'Failed to retrieve recipe',
            message: error.message 
        });
    }
}

/**
 * Create new recipe
 */
async function createRecipe(req, res) {
    try {
        const recipeData = req.body;

        // Validate required fields
        if (!recipeData.name || !recipeData.ingredients || !recipeData.instructions) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'ingredients', 'instructions']
            });
        }

        // Sanitize and prepare data
        const newRecipe = {
            name: sanitizeString(recipeData.name),
            category: sanitizeString(recipeData.category) || 'uncategorized',
            prepTime: sanitizeString(recipeData.prepTime) || '',
            cookTime: sanitizeString(recipeData.cookTime) || '',
            ingredients: sanitizeString(recipeData.ingredients),
            instructions: sanitizeString(recipeData.instructions),
            notes: sanitizeString(recipeData.notes) || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to Firestore
        const docRef = await db.collection('recipes').add(newRecipe);

        // Get the created document
        const doc = await docRef.get();

        return res.status(201).json({
            success: true,
            message: 'Recipe created successfully',
            recipe: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        console.error('Error creating recipe:', error);
        return res.status(500).json({ 
            error: 'Failed to create recipe',
            message: error.message 
        });
    }
}

/**
 * Delete recipe by ID (optional feature)
 */
async function deleteRecipe(req, res, recipeId) {
    try {
        const recipeRef = db.collection('recipes').doc(recipeId);
        const doc = await recipeRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                error: 'Recipe not found',
                recipeId: recipeId
            });
        }

        await recipeRef.delete();

        return res.status(200).json({
            success: true,
            message: 'Recipe deleted successfully',
            recipeId: recipeId
        });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        return res.status(500).json({ 
            error: 'Failed to delete recipe',
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
        .substring(0, 10000); // Limit length
}
