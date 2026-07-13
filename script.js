// =========================================================================
// CONFIGURATION ET VARIABLES GLOBALES
// =========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbyYleex0RVbqlwuBsuZYU_2b-xJ59SfEJUtZUYedEzwTRE1lQ6R4HX0OnWpwOqgohHSuQ/exec";
let allJobs = [];
let adminToken = localStorage.getItem('adminToken') || null;

// Initialisation au chargement de la page DOM
document.addEventListener('DOMContentLoaded', function() {
    loadJobs();
    setupEventListeners();
    checkExistingSession();
});

function checkExistingSession() {
    if (adminToken) {
        if (document.getElementById('adminLogin')) document.getElementById('adminLogin').style.display = 'none';
        if (document.getElementById('adminPanel')) document.getElementById('adminPanel').style.display = 'block';
        buildAdminTable();
    }
}

function setupEventListeners() {
    const jobForm = document.getElementById('jobForm');
    if (jobForm) {
        jobForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitJob();
        });
    }

    // Filtres dynamiques en temps réel de la page publique
    ['searchInput', 'typeFilter', 'locationFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', filterJobs);
        if (el && el.tagName === 'SELECT') el.addEventListener('change', filterJobs);
    });
}

function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) {
        navMenu.classList.toggle('responsive-active');
    }
}

// TOGGLE ONGLETS DANS L'ESPACE BACKOFFICE
function switchAdminTab(tabName) {
    const tabForm = document.getElementById('adminTabForm');
    const tabList = document.getElementById('adminTabList');
    const btnForm = document.getElementById('tabNewJobBtn');
    const btnList = document.getElementById('tabManageJobsBtn');

    if (tabName === 'form') {
        tabForm.style.display = 'block';
        tabList.style.display = 'none';
        btnForm.className = 'btn btn-primary';
        btnList.className = 'btn btn-secondary';
    } else {
        tabForm.style.display = 'none';
        tabList.style.display = 'block';
        btnForm.className = 'btn btn-secondary';
        btnList.className = 'btn btn-primary';
        buildAdminTable(); // Actualiser le tableau de données
    }
}

// =========================================================================
// ACTIONS RÉSEAU ET REQUÊTES VERS GOOGLE SHEETS
// =========================================================================

// 1. Lire les offres (Index public)
function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    jobsList.innerHTML = '<div class="loading">Chargement sécurisé de l\'index...</div>';

    fetch(`${API_URL}?action=getJobs`, { method: 'GET' })
    .then(response => response.json())
    .then(data => {
        allJobs = Array.isArray(data) ? data : [];
        displayJobs(allJobs);
        updateStats();
        buildAdminTable();
    })
    .catch(error => {
        console.error('Erreur:', error);
        jobsList.innerHTML = '<div class="loading">Index indisponible ou erreur réseau.</div>';
    });
}

// 2. Connexion Session Admin
function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    const loginError = document.getElementById('loginError');

    if (!password) { return; }

    fetch(`${API_URL}?action=authenticateAdmin`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('adminToken', data.token);
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            loginError.style.display = 'none';
            document.getElementById('adminPassword').value = '';
            loadJobs();
        } else {
            loginError.textContent = data.error || 'Accès refusé.';
            loginError.style.display = 'block';
        }
    })
    .catch(() => {
        loginError.textContent = 'Erreur de communication avec le serveur.';
        loginError.style.display = 'block';
    });
}

// 3. Ajouter ou Modifier (CRUD)
function submitJob() {
    if (!adminToken) {
        alert('Session expirée.');
        logoutAdmin();
        return;
    }

    const editId = document.getElementById('editJobId').value;
    const job = {
        title: document.getElementById('jobTitle').value,
        company: document.getElementById('jobCompany').value,
        location: document.getElementById('jobLocation').value,
        type: document.getElementById('jobType').value,
        description: document.getElementById('jobDescription').value,
        salary: document.getElementById('jobSalary').value || 'A négocier'
    };

    if (editId) { job.id = editId; }
    const actionTarget = editId ? 'editJob' : 'addJob';

    fetch(`${API_URL}?action=${actionTarget}`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ token: adminToken, job: job })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showFormMessage(editId ? 'Offre modifiée avec succès !' : 'Offre publiée avec succès !', 'success');
            resetFormState();
            loadJobs();
            setTimeout(() => { switchAdminTab('list'); }, 1000);
        } else {
            showFormMessage(data.error || 'Autorisation refusée.', 'error');
        }
    })
    .catch(() => {
        showFormMessage('Incident de synchronisation de base de données.', 'error');
    });
}

// 4. Supprimer une ligne de l'index
function deleteJob(jobId) {
    if (!confirm('Voulez-vous retirer définitivement cette offre d\'emploi ?')) return;

    fetch(`${API_URL}?action=deleteJob`, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ token: adminToken, id: jobId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showFormMessage('L\'offre a été destituée avec succès.', 'success');
            loadJobs();
        } else {
            showFormMessage(data.error || 'Erreur d\'effacement.', 'error');
        }
    })
    .catch(() => {
        showFormMessage('Incident réseau pendant la suppression.', 'error');
    });
}

// =========================================================================
// RENDU VISUEL ET CONTRÔLE DES COMPOSANTS UI
// =========================================================================

function buildAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    const countSpan = document.getElementById('adminJobCount');
    if (!tbody) return;

    if (countSpan) countSpan.textContent = allJobs.length;

    if (allJobs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">Aucune offre active en ligne.</td></tr>`;
        return;
    }

    tbody.innerHTML = allJobs.map(job => `
        <tr style="border-bottom: 1px solid var(--border-light); transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 1rem 1.5rem;">
                <div style="font-weight:600; color:var(--brand-dark);">${escapeHtml(job.title)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">${escapeHtml(job.company)}</div>
            </td>
            <td style="padding: 1rem 1.5rem; color:var(--text-main);">${escapeHtml(job.location)}</td>
            <td style="padding: 1rem 1.5rem;"><span class="badge" style="margin:0; padding:0.25rem 0.5rem; font-size:0.75rem;">${escapeHtml(job.type)}</span></td>
            <td style="padding: 1rem 1.5rem; font-weight:600;">${escapeHtml(job.salary)}</td>
            <td style="padding: 1rem 1.5rem; text-align: right; display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="prepareEditJob('${job.id}')">✏️ Éditer</button>
                <button class="btn" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--brand-danger); color:white;" onclick="deleteJob('${job.id}')">🗑️ Retirer</button>
            </td>
        </tr>
    `).join('');
}

function prepareEditJob(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('editJobId').value = job.id;
    document.getElementById('jobTitle').value = job.title;
    document.getElementById('jobCompany').value = job.company;
    document.getElementById('jobLocation').value = job.location;
    document.getElementById('jobType').value = job.type;
    document.getElementById('jobDescription').value = job.description;
    document.getElementById('jobSalary').value = job.salary === 'A négocier' ? '' : job.salary;

    document.getElementById('formSectionTitle').textContent = "Modifier l'offre : " + job.title;
    document.getElementById('submitJobBtn').textContent = "Enregistrer les modifications";
    document.getElementById('cancelEditBtn').style.display = "inline-flex";

    switchAdminTab('form');
}

function resetFormState() {
    const form = document.getElementById('jobForm');
    if (form) form.reset();
    document.getElementById('editJobId').value = "";
    document.getElementById('formSectionTitle').textContent = "Nouvelle publication";
    document.getElementById('submitJobBtn').textContent = "Diffuser l'offre en ligne";
    document.getElementById('cancelEditBtn').style.display = "none";
}

function displayJobs(jobs) {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    if (jobs.length === 0) {
        jobsList.innerHTML = '<div class="loading">Aucune offre disponible pour le moment.</div>';
        return;
    }

    jobsList.innerHTML = jobs.map(job => `
        <div class="job-card" onclick="viewJobDetail('${job.id}')">
            <div>
                <div class="job-title">${escapeHtml(job.title)}</div>
                <div class="job-company">${escapeHtml(job.company)}</div>
                <div class="job-meta">
                    <div>📍 ${escapeHtml(job.location)}</div>
                    <div>📅 ${job.date || 'Récemment'}</div>
                </div>
                <div class="badge">${escapeHtml(job.type)}</div>
                <p class="job-description">${escapeHtml(job.description ? job.description.substring(0, 110) : '')}...</p>
            </div>
            <div class="job-footer">
                <div class="job-salary">${escapeHtml(job.salary || 'A négocier')}</div>
                <button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size:0.85rem;" onclick="viewJobDetail('${job.id}'); event.stopPropagation();">Voir</button>
            </div>
        </div>
    `).join('');
}

function filterJobs() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const locationFilter = document.getElementById('locationFilter').value;

    const filtered = allJobs.filter(job => {
        const matchSearch = !searchTerm || 
            (job.title && job.title.toLowerCase().includes(searchTerm)) ||
            (job.company && job.company.toLowerCase().includes(searchTerm));
        const matchType = !typeFilter || job.type === typeFilter;
        const matchLocation = !locationFilter || (job.location && job.location.toLowerCase().includes(locationFilter.toLowerCase()));
        return matchSearch && matchType && matchLocation;
    });
    displayJobs(filtered);
}

function viewJobDetail(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('jobDetailContent').innerHTML = `
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 2.5rem; box-shadow: var(--shadow-sm);">
            <div style="margin-bottom:2rem;">
                <div class="badge">${escapeHtml(job.type)}</div>
                <h1 style="font-size:2.3rem; font-weight:800; color:var(--brand-dark);">${escapeHtml(job.title)}</h1>
                <div style="color:var(--brand-primary); font-weight:700; font-size:1.2rem; margin-top:0.25rem;">${escapeHtml(job.company)}</div>
            </div>
            <div style="display: flex; gap: 2rem; margin-bottom: 2rem; padding: 1rem; background: var(--bg-global); border-radius: 8px; flex-wrap: wrap;">
                <div><strong>Lieu :</strong> 📍 ${escapeHtml(job.location)}</div>
                <div><strong>Salaire :</strong> 💵 ${escapeHtml(job.salary || 'A négocier')}</div>
                <div><strong>Date :</strong> 📅 ${job.date || 'Récemment'}</div>
            </div>
            <p style="white-space: pre-line; color:var(--text-main); font-size:1.05rem;">${escapeHtml(job.description)}</p>
        </div>
    `;
    switchPage('jobDetail');
}

function showHome() { switchPage('home'); }
function showJobs() { switchPage('jobs'); }
function showAdmin() { switchPage('admin'); checkExistingSession(); }

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    const menu = document.getElementById('navMenu');
    if (menu) menu.classList.remove('responsive-active');
}

function logoutAdmin() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    resetFormState();
}

function showFormMessage(message, type) {
    const formMessage = document.getElementById('formMessage');
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.className = 'message show ' + type;
    window.scrollTo(0,0);
    setTimeout(() => formMessage.classList.remove('show'), 4000);
}

function updateStats() {
    const statJobs = document.getElementById('stat-jobs');
    if (statJobs) statJobs.textContent = allJobs.length;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
