// =========================================================================
// CONFIGURATION ET VARIABLES GLOBALES
// =========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbxME4o_3Im50rtuS69NskoCZvVLwX70lmaZTvdJZ31kR_qcCr0QSOI1BMjgAni7R46AFA/exec";
let allJobs = [];
let isAdminLoggedIn = false;

// Initialisation dès que la page est prête
document.addEventListener('DOMContentLoaded', function() {
    loadJobs();
    setupEventListeners();
});

// Gestionnaires d'événements (Formulaires, Filtres, Menu)
function setupEventListeners() {
    const jobForm = document.getElementById('jobForm');
    if (jobForm) {
        jobForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitJob();
        });
    }

    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const locationFilter = document.getElementById('locationFilter');

    if (searchInput) searchInput.addEventListener('input', filterJobs);
    if (typeFilter) typeFilter.addEventListener('change', filterJobs);
    if (locationFilter) locationFilter.addEventListener('change', filterJobs);

    // Menu Hamburger Tactile / Mobile
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            if (navMenu.classList.contains('active')) {
                navMenu.style.display = 'flex';
                navMenu.style.flexDirection = 'column';
                navMenu.style.position = 'absolute';
                navMenu.style.top = '70px';
                navMenu.style.left = '0';
                navMenu.style.width = '100%';
                navMenu.style.background = 'white';
                navMenu.style.padding = '1rem';
                navMenu.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
            } else {
                navMenu.style.display = 'none';
            }
        });
    }
}

// =========================================================================
// ACTIONS RÉSEAU (COMMUNICATION AVEC GOOGLE SHEETS)
// =========================================================================

// 1. Charger les offres d'emploi
function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    jobsList.innerHTML = '<div class="loading">Chargement des offres...</div>';

    fetch(API_URL, {
        method: 'POST',
        redirect: 'follow', // Essentiel pour suivre la redirection 302 de Google
        headers: {
            'Content-Type': 'text/plain;charset=utf-8' // Format permissif anti-blocage mobile
        },
        body: JSON.stringify({ action: 'getJobs' })
    })
    .then(response => {
        if (!response.ok) throw new Error('Réponse réseau incorrecte');
        return response.json();
    })
    .then(data => {
        allJobs = Array.isArray(data) ? data : [];
        displayJobs(allJobs);
        updateStats();
    })
    .catch(error => {
        console.error('Erreur lors du chargement des offres:', error);
        jobsList.innerHTML = '<div class="loading">Erreur de connexion à la base de données. Veuillez réessayer.</div>';
    });
}

// 2. Connexion de l'Administrateur
function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    const loginError = document.getElementById('loginError');

    if (!password) {
        loginError.textContent = 'Veuillez entrer le mot de passe.';
        loginError.style.display = 'block';
        return;
    }

    fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ 
            action: 'checkPassword',
            password: password 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            isAdminLoggedIn = true;
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            loginError.style.display = 'none';
            document.getElementById('adminPassword').value = '';
        } else {
            loginError.textContent = data.message || 'Mot de passe incorrect.';
            loginError.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        loginError.textContent = 'Erreur de connexion. Veuillez réessayer.';
        loginError.style.display = 'block';
    });
}

// 3. Publier une nouvelle offre
function submitJob() {
    if (!isAdminLoggedIn) {
        alert('Vous devez être connecté pour ajouter une offre.');
        return;
    }

    const job = {
        title: document.getElementById('jobTitle').value,
        company: document.getElementById('jobCompany').value,
        location: document.getElementById('jobLocation').value,
        type: document.getElementById('jobType').value,
        description: document.getElementById('jobDescription').value,
        salary: document.getElementById('jobSalary').value || 'A négocier'
    };

    if (!job.title || !job.company || !job.location || !job.type || !job.description) {
        showFormMessage('Veuillez remplir tous les champs obligatoires.', 'error');
        return;
    }

    const password = prompt('Veuillez ré-entrer votre mot de passe pour valider l\'écriture :');
    if (!password) return;

    fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ 
            action: 'saveJob',
            password: password,
            job: job
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showFormMessage('Offre d\'emploi publiée avec succès !', 'success');
            document.getElementById('jobForm').reset();
            setTimeout(() => {
                loadJobs();
                showJobs();
            }, 1500);
        } else {
            showFormMessage(data.message || 'Erreur lors de la publication.', 'error');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showFormMessage('Erreur réseau lors de la publication.', 'error');
    });
}

// =========================================================================
// FONCTIONS DE RENDU ET INTERFACE (AFFICHAGE)
// =========================================================================

function displayJobs(jobs) {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    if (jobs.length === 0) {
        jobsList.innerHTML = '<div class="loading">Aucune offre d\'emploi disponible pour le moment.</div>';
        return;
    }

    jobsList.innerHTML = jobs.map(job => `
        <div class="job-card" onclick="viewJobDetail('${job.id}')">
            <div class="job-card-header">
                <div class="job-title">${escapeHtml(job.title)}</div>
                <div class="job-company">${escapeHtml(job.company)}</div>
            </div>
            <div class="job-meta">
                <div class="job-meta-item">📍 ${escapeHtml(job.location)}</div>
                <div class="job-meta-item">📅 ${job.date || ''}</div>
            </div>
            <div class="badge badge-type">${escapeHtml(job.type)}</div>
            <p class="job-description">${escapeHtml(job.description ? job.description.substring(0, 100) : '')}...</p>
            <div class="job-salary">${escapeHtml(job.salary || 'A négocier')}</div>
            <div class="job-actions">
                <button class="btn btn-primary" onclick="viewJobDetail('${job.id}'); event.stopPropagation();">Voir plus</button>
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
            (job.company && job.company.toLowerCase().includes(searchTerm)) ||
            (job.description && job.description.toLowerCase().includes(searchTerm));
        
        const matchType = !typeFilter || job.type === typeFilter;
        const matchLocation = !locationFilter || (job.location && job.location.toLowerCase().includes(locationFilter.toLowerCase()));

        return matchSearch && matchType && matchLocation;
    });

    displayJobs(filtered);
}

function viewJobDetail(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;

    const detailContent = document.getElementById('jobDetailContent');
    if (detailContent) {
        detailContent.innerHTML = `
            <div class="job-detail-content">
                <div class="job-detail-header">
                    <div class="job-detail-title">${escapeHtml(job.title)}</div>
                    <div class="job-detail-company">${escapeHtml(job.company)}</div>
                </div>
                <div class="job-detail-meta">
                    <div class="meta-item"><div class="meta-label">Localisation</div><div class="meta-value">📍 ${escapeHtml(job.location)}</div></div>
                    <div class="meta-item"><div class="meta-label">Type de contrat</div><div class="meta-value">${escapeHtml(job.type)}</div></div>
                    <div class="meta-item"><div class="meta-label">Salaire</div><div class="meta-value">${escapeHtml(job.salary || 'A négocier')}</div></div>
                    <div class="meta-item"><div class="meta-label">Date</div><div class="meta-value">📅 ${job.date || ''}</div></div>
                </div>
                <div class="job-detail-description">
                    <h3>Description du poste</h3>
                    <p>${job.description ? job.description.split('\n').map(p => escapeHtml(p)).join('</p><p>') : ''}</p>
                </div>
                <div class="job-actions">
                    <button class="btn btn-primary" onclick="applyJob('${job.id}')">Postuler</button>
                    <button class="btn btn-secondary" onclick="shareJob('${job.id}')">Partager</button>
                </div>
            </div>
        `;
    }
    showJobDetail();
}

// Navigation inter-pages
function showHome() { showPage('home'); }
function showJobs() { showPage('jobs'); loadJobs(); }
function showJobDetail() { showPage('jobDetail'); }
function showAdmin() {
    showPage('admin');
    if (!isAdminLoggedIn) {
        document.getElementById('adminLogin').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        window.scrollTo(0, 0);
    }
}

function logoutAdmin() {
    isAdminLoggedIn = false;
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    document.getElementById('jobForm').reset();
}

function showFormMessage(message, type) {
    const formMessage = document.getElementById('formMessage');
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.className = 'message show ' + type;
    setTimeout(() => formMessage.classList.remove('show', type), 5000);
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

function applyJob(jobId) {
    alert('Candidature transmise avec succès pour l\'offre : ' + jobId);
}

function shareJob(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (job && navigator.share) {
        navigator.share({
            title: job.title,
            text: `Offre d'emploi : ${job.title} - ${job.company}`,
            url: window.location.href
        });
    } else if (job) {
        alert('Détails de l\'offre : ' + job.title + ' - ' + job.company);
    }
}
