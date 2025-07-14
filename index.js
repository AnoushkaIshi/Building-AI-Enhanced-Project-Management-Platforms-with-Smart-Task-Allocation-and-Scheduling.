// Application State
let currentUser = null;
let authToken = null;
let projects = [];
let tasks = [];
let users = [];
let analyticsChart = null;

// API Base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    checkAuth();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('projectForm').addEventListener('submit', handleCreateProject);
    document.getElementById('taskForm').addEventListener('submit', handleCreateTask);
}

// API Helper Functions
async function apiRequest(url, method = 'GET', data = null, auth = true) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (auth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const config = {
        method,
        headers
    };
    
    if (data) {
        config.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${url}`, config);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { user, token } = await apiRequest('/login', 'POST', { email, password }, false);
        currentUser = user;
        authToken = token;
        localStorage.setItem('authToken', token);
        showDashboard();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;

    try {
        const { user, token } = await apiRequest('/register', 'POST', { name, email, password, role }, false);
        currentUser = user;
        authToken = token;
        localStorage.setItem('authToken', token);
        showDashboard();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    showLogin();
}

function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
        // In a real app, you would verify the token and fetch user data
        authToken = token;
        showDashboard();
    } else {
        showLogin();
    }
}

// Dashboard initialization
async function initializeDashboard() {
    try {
        // Fetch all necessary data
        const [projectsData, tasksData, usersData] = await Promise.all([
            apiRequest('/projects'),
            apiRequest('/tasks'),
            apiRequest('/users')
        ]);
        
        projects = projectsData;
        tasks = tasksData;
        users = usersData;
        
        updateUserInfo();
        updateStats();
        renderProjects();
        renderTasks();
        renderAIInsights();
        initializeAnalytics();
        populateTaskAssignees();
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        alert('Failed to load dashboard data');
    }
}

// Update the rest of your frontend functions to use the API
// For example, update handleCreateProject:
async function handleCreateProject(e) {
    e.preventDefault();
    
    try {
        const newProject = await apiRequest('/projects', 'POST', {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDescription').value,
            deadline: document.getElementById('projectDeadline').value,
            priority: document.getElementById('projectPriority').value
        });
        
        projects.push(newProject);
        closeProjectModal();
        renderProjects();
        updateStats();
        
        // Show AI insight about new project
        setTimeout(() => {
            alert('🤖 AI Insight: New project created successfully! Based on similar projects, estimated completion time is 6-8 weeks. Optimal team size: 3-4 members.');
        }, 500);
    } catch (error) {
        alert('Failed to create project: ' + error.message);
    }
}

// Update handleCreateTask:
async function handleCreateTask(e) {
    e.preventDefault();
    
    try {
        const newTask = await apiRequest('/tasks', 'POST', {
            title: document.getElementById('taskTitle').value,
            projectId: document.getElementById('taskProject').value,
            assigneeId: document.getElementById('taskAssignee').value || undefined,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value
        });
        
        tasks.push(newTask);
        closeTaskModal();
        renderTasks();
        updateStats();
        renderAIInsights();
        
        const assignee = users.find(u => u.id === newTask.assigneeId);
        setTimeout(() => {
            alert(`🤖 AI Assignment: Task assigned to ${assignee.name}`);
        }, 500);
    } catch (error) {
        alert('Failed to create task: ' + error.message);
    }
}

// Update the rest of your frontend functions similarly...