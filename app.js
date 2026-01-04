/* ============================================
   VINTAGE COOKBOOK - CLIENT-SIDE JAVASCRIPT
   ============================================ */

// Configuration
const API_BASE_URL = '/api';

// Global state
let allRecipes = [];
let currentRecipeId = null;

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

/**
 * Format a date to a readable string
 */
function formatDate(timestamp) {
    if (!timestamp) return 'Recently added';
    
    try {
        const date = new Date(timestamp);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        return 'Recently added';
    }
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return 'just now';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return formatDate(timestamp);
    } catch (error) {
        return 'recently';
    }
}

/**
 * Capitalize first letter of each word
 */
function capitalize(str) {
    if (!str) return '';
    return str.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

/**
 * Show a temporary notification message
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#FFF5F5' : '#F0FFF4'};
        border: 2px solid ${type === 'error' ? '#E53E3E' : '#38A169'};
        color: ${type === 'error' ? '#742A2A' : '#22543D'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-family: 'Crimson Text', serif;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Parse ingredients string into array
 */
function parseIngredients(ingredientsText) {
    if (!ingredientsText) return [];
    return ingredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/* ============================================
   HOME PAGE FUNCTIONS
   ============================================ */

/**
 * Fetch and display recent recipes on home page
 */
async function fetchRecentRecipes() {
    const loadingEl = document.getElementById('loading');
    const recipesContainer = document.getElementById('recent-recipes');
    const emptyState = document.getElementById('empty-state');
    
    if (!recipesContainer) return;
    
    try {
        loadingEl.style.display = 'block';
        recipesContainer.innerHTML = '';
        
        const response = await fetch(`${API_BASE_URL}/recipes?recent=5`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch recipes');
        }
        
        const data = await response.json();
        const recipes = data.recipes || [];
        
        loadingEl.style.display = 'none';
        
        if (recipes.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        recipes.forEach(recipe => {
            const card = createRecipeCard(recipe);
            recipesContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error fetching recent recipes:', error);
        loadingEl.style.display = 'none';
        recipesContainer.innerHTML = `
            <div class="error-message" style="grid-column: 1/-1; text-align: center; color: var(--brown-medium);">
                <p>Unable to load recipes. Please try again later.</p>
            </div>
        `;
    }
}

/**
 * Create a recipe card element
 */
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.onclick = () => {
        if (window.location.pathname.includes('recipes.html')) {
            openRecipeModal(recipe.id);
        } else {
            window.location.href = `recipes.html?recipe=${recipe.id}`;
        }
    };
    
    // Create excerpt from instructions or ingredients
    const excerpt = recipe.instructions 
        ? recipe.instructions.substring(0, 120) + '...'
        : recipe.ingredients 
            ? parseIngredients(recipe.ingredients).slice(0, 3).join(', ') + '...'
            : 'A delicious family recipe';
    
    card.innerHTML = `
        <div class="recipe-card-header">
            <div>
                <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
                ${recipe.category ? `<span class="recipe-category">${capitalize(recipe.category)}</span>` : ''}
            </div>
        </div>
        ${recipe.prepTime || recipe.cookTime ? `
            <div class="recipe-meta">
                ${recipe.prepTime ? `<div class="recipe-meta-item">⏱ Prep: ${escapeHtml(recipe.prepTime)}</div>` : ''}
                ${recipe.cookTime ? `<div class="recipe-meta-item">🔥 Cook: ${escapeHtml(recipe.cookTime)}</div>` : ''}
            </div>
        ` : ''}
        <p class="recipe-excerpt">${escapeHtml(excerpt)}</p>
        <div class="recipe-date">Added ${formatDate(recipe.createdAt)}</div>
    `;
    
    return card;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/* ============================================
   RECIPE FORM FUNCTIONS
   ============================================ */

/**
 * Initialize the recipe form with validation and submission
 */
function initializeRecipeForm() {
    const form = document.getElementById('recipe-form');
    if (!form) return;
    
    form.addEventListener('submit', handleRecipeSubmit);
}

/**
 * Handle recipe form submission
 */
async function handleRecipeSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const errorEl = document.getElementById('form-error');
    const successEl = document.getElementById('form-success');
    
    // Hide previous messages
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    
    // Validate form
    const validationError = validateRecipeForm(form);
    if (validationError) {
        errorEl.textContent = validationError;
        errorEl.style.display = 'block';
        return;
    }
    
    // Prepare recipe data
    const formData = new FormData(form);
    const recipeData = {
        name: formData.get('name').trim(),
        category: formData.get('category'),
        prepTime: formData.get('prepTime').trim(),
        cookTime: formData.get('cookTime').trim(),
        ingredients: formData.get('ingredients').trim(),
        instructions: formData.get('instructions').trim(),
        notes: formData.get('notes').trim(),
        createdAt: new Date().toISOString()
    };
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        const response = await fetch(`${API_BASE_URL}/recipes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save recipe');
        }
        
        const result = await response.json();
        
        // Show success message
        successEl.style.display = 'block';
        form.reset();
        
        // Scroll to success message
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        showNotification('Recipe added successfully!', 'success');
        
    } catch (error) {
        console.error('Error submitting recipe:', error);
        errorEl.textContent = 'Failed to save recipe. Please try again.';
        errorEl.style.display = 'block';
        showNotification('Failed to save recipe', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

/**
 * Validate recipe form data
 */
function validateRecipeForm(form) {
    const name = form.name.value.trim();
    const category = form.category.value;
    const ingredients = form.ingredients.value.trim();
    const instructions = form.instructions.value.trim();
    
    if (!name) {
        return 'Please enter a recipe name.';
    }
    
    if (name.length < 3) {
        return 'Recipe name must be at least 3 characters long.';
    }
    
    if (!category) {
        return 'Please select a category.';
    }
    
    if (!ingredients) {
        return 'Please enter the ingredients.';
    }
    
    if (!instructions) {
        return 'Please enter the cooking instructions.';
    }
    
    if (instructions.length < 20) {
        return 'Instructions must be more detailed (at least 20 characters).';
    }
    
    return null;
}

/* ============================================
   RECIPES LISTING PAGE FUNCTIONS
   ============================================ */

/**
 * Fetch and display all recipes
 */
async function fetchAllRecipes() {
    const loadingEl = document.getElementById('recipes-loading');
    const recipesContainer = document.getElementById('recipes-container');
    const emptyState = document.getElementById('recipes-empty');
    
    if (!recipesContainer) return;
    
    try {
        loadingEl.style.display = 'block';
        recipesContainer.innerHTML = '';
        
        const response = await fetch(`${API_BASE_URL}/recipes`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch recipes');
        }
        
        const data = await response.json();
        allRecipes = data.recipes || [];
        
        loadingEl.style.display = 'none';
        
        if (allRecipes.length === 0) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <p class="empty-message">No recipes in the collection yet. Be the first to add one!</p>
                <a href="add-recipe.html" class="vintage-button">Add Your First Recipe</a>
            `;
            return;
        }
        
        displayRecipes(allRecipes);
        updateResultsCount(allRecipes.length, allRecipes.length);
        
        // Check if there's a recipe ID in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const recipeId = urlParams.get('recipe');
        if (recipeId) {
            openRecipeModal(recipeId);
        }
        
    } catch (error) {
        console.error('Error fetching recipes:', error);
        loadingEl.style.display = 'none';
        recipesContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: var(--brown-medium);">
                <p>Unable to load recipes. Please try again later.</p>
            </div>
        `;
    }
}

/**
 * Display recipes in the container
 */
function displayRecipes(recipes) {
    const recipesContainer = document.getElementById('recipes-container');
    const emptyState = document.getElementById('recipes-empty');
    
    if (!recipesContainer) return;
    
    recipesContainer.innerHTML = '';
    
    if (recipes.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Create a grid for recipe cards
    const grid = document.createElement('div');
    grid.className = 'recipe-grid';
    
    recipes.forEach(recipe => {
        const card = createRecipeCard(recipe);
        grid.appendChild(card);
    });
    
    recipesContainer.appendChild(grid);
}

/**
 * Initialize search and filter functionality
 */
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(performSearch, 300));
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', performSearch);
    }
}

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Perform search and filter
 */
function performSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    
    if (!searchInput || !categoryFilter) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;
    
    let filteredRecipes = allRecipes;
    
    // Filter by category
    if (selectedCategory) {
        filteredRecipes = filteredRecipes.filter(recipe => 
            recipe.category === selectedCategory
        );
    }
    
    // Filter by search term
    if (searchTerm) {
        filteredRecipes = filteredRecipes.filter(recipe => {
            const nameMatch = recipe.name.toLowerCase().includes(searchTerm);
            const ingredientsMatch = recipe.ingredients && 
                recipe.ingredients.toLowerCase().includes(searchTerm);
            const instructionsMatch = recipe.instructions && 
                recipe.instructions.toLowerCase().includes(searchTerm);
            
            return nameMatch || ingredientsMatch || instructionsMatch;
        });
    }
    
    displayRecipes(filteredRecipes);
    updateResultsCount(filteredRecipes.length, allRecipes.length);
}

/**
 * Update results count display
 */
function updateResultsCount(shown, total) {
    const resultsCount = document.getElementById('results-count');
    if (!resultsCount) return;
    
    if (shown === total) {
        resultsCount.textContent = `Showing all ${total} recipe${total !== 1 ? 's' : ''}`;
    } else {
        resultsCount.textContent = `Showing ${shown} of ${total} recipe${total !== 1 ? 's' : ''}`;
    }
}

/**
 * Clear search and filters
 */
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    
    performSearch();
}

/* ============================================
   RECIPE DETAIL MODAL FUNCTIONS
   ============================================ */

/**
 * Open recipe detail modal
 */
async function openRecipeModal(recipeId) {
    const modal = document.getElementById('recipe-modal');
    const recipeDetail = document.getElementById('recipe-detail');
    
    if (!modal || !recipeDetail) return;
    
    currentRecipeId = recipeId;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Show loading state
    recipeDetail.innerHTML = `
        <div class="loading-state">
            <div class="vintage-spinner"></div>
            <p>Loading recipe...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}`);
        
        if (!response.ok) {
            throw new Error('Recipe not found');
        }
        
        const data = await response.json();
        const recipe = data.recipe;
        
        displayRecipeDetail(recipe);
        fetchComments(recipeId);
        
    } catch (error) {
        console.error('Error fetching recipe:', error);
        recipeDetail.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem;">
                <p>Unable to load recipe details.</p>
                <button onclick="closeRecipeModal()" class="vintage-button">Close</button>
            </div>
        `;
    }
}

/**
 * Display recipe details in modal
 */
function displayRecipeDetail(recipe) {
    const recipeDetail = document.getElementById('recipe-detail');
    if (!recipeDetail) return;
    
    const ingredients = parseIngredients(recipe.ingredients);
    
    recipeDetail.innerHTML = `
        <div class="recipe-detail-header">
            <h2 class="recipe-detail-title">${escapeHtml(recipe.name)}</h2>
            ${recipe.category ? `<span class="recipe-category">${capitalize(recipe.category)}</span>` : ''}
            <div class="recipe-detail-meta">
                ${recipe.prepTime ? `<div>⏱ Prep: ${escapeHtml(recipe.prepTime)}</div>` : ''}
                ${recipe.cookTime ? `<div>🔥 Cook: ${escapeHtml(recipe.cookTime)}</div>` : ''}
                <div>📅 Added ${formatDate(recipe.createdAt)}</div>
            </div>
        </div>
        
        <div class="recipe-detail-section">
            <h3 class="recipe-detail-section-title">Ingredients</h3>
            <ul class="ingredients-list">
                ${ingredients.map(ingredient => 
                    `<li>${escapeHtml(ingredient)}</li>`
                ).join('')}
            </ul>
        </div>
        
        <div class="recipe-detail-section">
            <h3 class="recipe-detail-section-title">Instructions</h3>
            <div class="instructions-text">${escapeHtml(recipe.instructions)}</div>
        </div>
        
        ${recipe.notes ? `
            <div class="recipe-detail-section">
                <h3 class="recipe-detail-section-title">Notes & Tips</h3>
                <div class="notes-text">${escapeHtml(recipe.notes)}</div>
            </div>
        ` : ''}
    `;
}

/**
 * Close recipe detail modal
 */
function closeRecipeModal() {
    const modal = document.getElementById('recipe-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentRecipeId = null;
    
    // Clear URL parameter if present
    if (window.location.search.includes('recipe=')) {
        const url = new URL(window.location);
        url.searchParams.delete('recipe');
        window.history.replaceState({}, '', url);
    }
}

/* ============================================
   COMMENTS FUNCTIONS
   ============================================ */

/**
 * Fetch comments for a recipe
 */
async function fetchComments(recipeId) {
    const commentsList = document.getElementById('comments-list');
    const commentsLoading = document.getElementById('comments-loading');
    const noComments = document.getElementById('no-comments');
    
    if (!commentsList) return;
    
    try {
        commentsLoading.style.display = 'block';
        commentsList.innerHTML = '';
        noComments.style.display = 'none';
        
        const response = await fetch(`${API_BASE_URL}/comments?recipeId=${recipeId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch comments');
        }
        
        const data = await response.json();
        const comments = data.comments || [];
        
        commentsLoading.style.display = 'none';
        
        if (comments.length === 0) {
            noComments.style.display = 'block';
            return;
        }
        
        displayComments(comments);
        
    } catch (error) {
        console.error('Error fetching comments:', error);
        commentsLoading.style.display = 'none';
        noComments.style.display = 'block';
    }
}

/**
 * Display comments list
 */
function displayComments(comments) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    commentsList.innerHTML = '';
    
    // Sort comments by date (newest first)
    const sortedComments = comments.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    sortedComments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.username)}</span>
                <span class="comment-date">${formatRelativeTime(comment.createdAt)}</span>
            </div>
            <p class="comment-text">${escapeHtml(comment.comment)}</p>
        `;
        commentsList.appendChild(commentEl);
    });
}

/**
 * Initialize comment form
 */
function initializeCommentForm() {
    const commentForm = document.getElementById('comment-form');
    if (!commentForm) return;
    
    commentForm.addEventListener('submit', handleCommentSubmit);
}

// Initialize comment form when modal opens
document.addEventListener('DOMContentLoaded', () => {
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }
});

/**
 * Handle comment form submission
 */
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    if (!currentRecipeId) return;
    
    const form = event.target;
    const usernameInput = document.getElementById('comment-username');
    const commentInput = document.getElementById('comment-text');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const username = usernameInput.value.trim();
    const commentText = commentInput.value.trim();
    
    if (!username || !commentText) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    const commentData = {
        recipeId: currentRecipeId,
        username: username,
        comment: commentText,
        createdAt: new Date().toISOString()
    };
    
    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commentData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add comment');
        }
        
        // Clear form
        usernameInput.value = '';
        commentInput.value = '';
        
        // Refresh comments
        await fetchComments(currentRecipeId);
        
        showNotification('Comment added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding comment:', error);
        showNotification('Failed to add comment', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Comment';
    }
}

/* ============================================
   KEYBOARD SHORTCUTS
   ============================================ */

document.addEventListener('keydown', (event) => {
    // Close modal with Escape key
    if (event.key === 'Escape') {
        const modal = document.getElementById('recipe-modal');
        if (modal && modal.style.display === 'flex') {
            closeRecipeModal();
        }
    }
});

/* ============================================
   ANIMATIONS ON SCROLL
   ============================================ */

// Add fade-in animation for elements as they come into view
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements on page load
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.recipe-card, .welcome-box, .cta-box');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});