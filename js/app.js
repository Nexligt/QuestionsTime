// ===== Historique des questions =====
let questionHistory = [];   // toutes les questions vues (mode strict)
let recentHistory = [];     // 10 dernières questions (mode libre)

// Liste globale de tous les tags connus
let allTags = [];
let currentTags = [];

const RECENT_LIMIT = 10;

// ===== Pop-Up Add Appli ====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Empêche l’affichage automatique du popup du navigateur
    e.preventDefault();
    // Sauvegarde l’événement pour plus tard
    deferredPrompt = e;

    // Affiche ton popup personnalisé
    showInstallPopup();
});

function showInstallPopup() {
    const popup = document.getElementById('installPopup');
    popup.style.display = 'block';

    const installBtn = document.getElementById('installBtn');
    const cancelBtn = document.getElementById('cancelInstallBtn');

    installBtn.addEventListener('click', async () => {
        popup.style.display = 'none';
        if (deferredPrompt) {
            deferredPrompt.prompt(); // Affiche le popup du navigateur
            const choiceResult = await deferredPrompt.userChoice;
            console.log('Choix utilisateur :', choiceResult.outcome);
            deferredPrompt = null;
        }
    });

    cancelBtn.addEventListener('click', () => {
        popup.style.display = 'none';
    });
}

// ===== Mode strict =====
let strictMode = true; // true = strict ON, false = strict OFF

const questionForm = document.getElementById("QuestionForm");
const mainContainer = document.querySelector("main.container");


const home = document.getElementById("home");

home?.addEventListener("click", () => {

    document.getElementById("startText").style.display = "none";
    
    const title = document.getElementById("title");
    const header = document.querySelector(".header h1");

    const titleRect = title.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();

    const deltaY = headerRect.top - titleRect.top; // distance verticale à parcourir
    const deltaScale = headerRect.height / titleRect.height;
    title.style.transform = `translateY(${deltaY}px) scale(${deltaScale})`;
    document.body.classList.add("app-started");
    

    setTimeout(() => {
        home.style.display = "none";
    }, 600);

});


//-----------APP-------------

const strictToggle = document.getElementById("strictToggle");

// Initialisation du bouton Strict selon l'état
strictToggle.classList.remove("strict-on", "strict-off");
strictToggle.classList.add(strictMode ? "strict-on" : "strict-off");
strictToggle.innerText = strictMode ? "Strict" : "Libre";

// Au clic → basculer le mode
strictToggle.addEventListener("click", () => {
    strictMode = !strictMode;

    strictToggle.classList.remove("strict-on", "strict-off");
    strictToggle.classList.add(strictMode ? "strict-on" : "strict-off");
    strictToggle.innerText = strictMode ? "Strict" : "Libre";
    strictToggle.offsetHeight;  // force repaint

    // Sauvegarde
    saveSetting("strictMode", strictMode);
});


// Initialisation après ouverture de la DB
openDatabase(async () => {
    await loadAllQuestions();
    console.log("Questions fusionnées :", allQuestions);

    allTags = Array.from(new Set(allQuestions.flatMap(q => q.tags)));

    await genererTagsAvecbox(); // crée les tags + box 3 états
    
    await loadSettings();

    afficherQuestionAleatoireAvecFiltres(); // affiche la première question
});

async function loadSettings() {
    const [
        strict,
        qHistory,
        rHistory,
        filters
    ] = await Promise.all([
        getSetting("strictMode"),
        getSetting("questionHistory"),
        getSetting("recentHistory"),
        getSetting("activeFilters")
    ]);

    if (strict !== null) strictMode = strict;
    if (qHistory) questionHistory = qHistory;
    if (rHistory) recentHistory = rHistory;

    if (filters) {
        activeFilters = filters;
        await loadActiveFilters();
    }
}


document.getElementById("filterToggle").addEventListener("click", () => {
    const f = document.getElementById("filters");
    f.style.display = (f.style.display === "none") ? "block" : "none";
    
    // changer le texte du bouton
    filterToggle.innerText = (f.style.display === "none") ? "Afficher" : "Masquer";
});

// Bouton Nouvelle question
document.getElementById("btnNouvelle").addEventListener("click", () => {
    afficherQuestionAleatoireAvecFiltres();
});


// Bouton Supprimer
btnSupprimer.addEventListener("click", async () => {
    const id = parseInt(document.getElementById("currentQuestionId").value);
    try {
        const result = await deleteQuestion(id);
        if(result.success) {
            document.getElementById("message").innerText =
                result.type === "locale"
                ? `Question ${id} locale supprimée`
                : `Question ${id} de base masquée`;
            
            // Mettre à jour la liste fusionnée et afficher une nouvelle question
            await loadAllQuestions();

            await genererTagsAvecbox();
            await loadActiveFilters();
            renderDeletedQuestions();
            afficherQuestionAleatoireAvecFiltres();
        } else {
            document.getElementById("message").innerText = `Question introuvable ou déjà supprimée`;
        }

    } catch (err) {
        console.error(err);
        document.getElementById("message").innerText = "Erreur lors de la suppression";
    }
});


// -----------------------------------
// Mettre à jour les filtres actifs
// -----------------------------------
async function updateActiveFilters() {
    const boxes = Array.from(document.querySelectorAll("#filters div[data-tag]"));
    activeFilters = {};

    boxes.forEach(box => {
        activeFilters[box.dataset.tag] = box.dataset.state;
    });

    await saveSetting("activeFilters", activeFilters);
}

// -----------------------------------
// Charger les filtres actifs
// -----------------------------------
async function loadActiveFilters() {

    const boxes = document.querySelectorAll("#filters div[data-tag]");

    boxes.forEach(box => {
        const state = activeFilters[box.dataset.tag] || "neutre";
        box.dataset.state = state;

        switch (state) {
            case "neutre":
                box.innerText = "";
                box.style.backgroundColor = "#eee";
                box.style.color = "";
                break;

            case "inclus":
                box.innerText = "✓";
                box.style.backgroundColor = "green";
                box.style.color = "white";
                break;

            case "exclu":
                box.innerText = "✗";
                box.style.backgroundColor = "red";
                box.style.color = "white";
                break;
        }
    });
}



// Fonction pour afficher une question aléatoire
function afficherQuestionAleatoireAvecFiltres() {
    const boxes = Array.from(document.querySelectorAll("#filters div[data-tag]"));

    const inclus = new Set();
    const exclu = new Set();

    boxes.forEach(box => {
        if (box.dataset.state === "inclus") inclus.add(box.dataset.tag);
        if (box.dataset.state === "exclu") exclu.add(box.dataset.tag);
    });

    // Filtrer les questions
    let filtered = allQuestions.filter(q => {
        if (q.tags.some(tag => exclu.has(tag))) return false;
        for (let tag of inclus) {
            if (!q.tags.includes(tag)) return false;
        }
        return true;
    });

    const result = getRandomQuestion(filtered);

    if (result.error) {
        document.getElementById("questionText").innerText = result.error;
        document.getElementById("currentQuestionId").value = "";
        return;
    }

    // Afficher la question tirée
    document.getElementById("questionText").innerText = result.question.texte;
    document.getElementById("currentQuestionId").value = result.question.id;
    document.getElementById("message").innerText = "";

}

// Fonction pour afficher une question par id (facultatif)
function afficherQuestionParId(id) {
    const question = allQuestions.find(q => q.id === id);
    if (question) {
        document.getElementById("questionText").innerText = question.texte;
        document.getElementById("currentQuestionId").value = question.id;
        document.getElementById("message").innerText = "";
    }
}


function getRandomQuestion(filteredQuestions) {
    if (filteredQuestions.length === 0) {
        return { error: "Aucune question ne correspond aux filtres" };
    }

    let candidates;

    if (strictMode) {
        // Mode strict : exclure toutes les questions déjà vues
        candidates = filteredQuestions.filter(q => !questionHistory.includes(q.id));
        if (candidates.length === 0) {
            return { error: "Toutes les questions ont déjà été vues (mode strict)" };
        }
        const index = Math.floor(Math.random() * candidates.length);
        const question = candidates[index];
        questionHistory.push(question.id);

        // Après avoir ajouté la question à questionHistory ou recentHistory
        saveSetting("questionHistory", questionHistory);
        saveSetting("recentHistory", recentHistory);

        return { question };        

    } else {
        // Mode libre : exclure les dernières questions, de base les 10 dernières
        candidates = filteredQuestions.filter(q => !recentHistory.includes(q.id));

        // Si il ne reste rien alors on remets toutes les questions sauf la dernière
        if (candidates.length === 0) {
            const lastId = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1] : null;
            candidates = lastId !== null ? filteredQuestions.filter(q => q.id !== lastId) : filteredQuestions;
            recentHistory = lastId !== null ? [lastId] : [];
        }

        // Si il ne reste rien encore rien c'est donc qu'il n'y que une question possible, on garde celle-ci
        if (candidates.length === 0) candidates = filteredQuestions

        const index = Math.floor(Math.random() * candidates.length);
        const question = candidates[index];

        // Mettre à jour l’historique
        recentHistory.push(question.id);

        // Garder seulement les N dernières questions, N = nombre total de questions disponibles
        if (recentHistory.length > RECENT_LIMIT || recentHistory.length >filteredQuestions.length) {
            recentHistory.shift();
        }

        // Après avoir ajouté la question à questionHistory ou recentHistory
        saveSetting("questionHistory", questionHistory);
        saveSetting("recentHistory", recentHistory);

        return { question };
    }
}

document.getElementById("btnResetHistory").addEventListener("click", () => {
    questionHistory = [];
    recentHistory = [];
    saveSetting("questionHistory", questionHistory);
    saveSetting("recentHistory", recentHistory);
    document.getElementById("message").innerText = "Historique réinitialisé !";
});







// Générer la liste unique de tags depuis toutes les questions
async function genererTagsAvecbox() {
    const filtersDiv = document.getElementById("filters");
    filtersDiv.innerHTML = ""; // vide le conteneur

    const tags = [...allTags].sort();

    tags.forEach(tag => {
        const box = document.createElement("div");
        box.style.display = "inline-block";
        box.style.width = "30px";
        box.style.height = "30px";
        box.style.lineHeight = "30px";
        box.style.margin = "5px";
        box.style.textAlign = "center";
        box.style.border = "2px solid #ccc";
        box.style.borderRadius = "4px";
        box.style.cursor = "pointer";
        box.style.userSelect = "none";
        box.dataset.tag = tag;
        box.dataset.state = "neutre";
        box.innerText = "";
        box.style.backgroundColor = "#eee";

        const label = document.createElement("span");
        label.innerText = " " + tag;
        label.style.marginRight = "15px";

        const wrapper = document.createElement("div");
        wrapper.style.display = "inline-flex";
        wrapper.style.alignItems = "center";
        wrapper.style.marginRight = "10px";
        wrapper.appendChild(box);
        wrapper.appendChild(label);
        filtersDiv.appendChild(wrapper);

        box.addEventListener("click", async () => {
            switch (box.dataset.state) {
                case "neutre":
                    box.dataset.state = "inclus";
                    box.innerText = "✓";
                    box.style.backgroundColor = "green";
                    box.style.color = "white";
                    break;

                case "inclus":
                    box.dataset.state = "exclu";
                    box.innerText = "✗";
                    box.style.backgroundColor = "red";
                    box.style.color = "white";
                    break;

                case "exclu":
                    box.dataset.state = "neutre";
                    box.innerText = "";
                    box.style.backgroundColor = "#eee";
                    box.style.color = "";
                    break;
            }

            await updateActiveFilters();
        });
    });
}

// #region DeletedQuestions
// ==================================================
// Gestion des Questions supprimées
// ==================================================

let deletedPage = 0;
const PAGE_SIZE = 10;

document.getElementById("btnDeletedQuestions").addEventListener("click", () => {

    const menu = document.getElementById("deletedMenu");

    // afficher / cacher le menu
    if (menu.style.display === "none") {
        deletedPage = 0; // revenir à la première page
        renderDeletedQuestions();
        menu.style.display = "block";
    } else {
        menu.style.display = "none";
    }

});

// ------------- Render ------------

function renderDeletedQuestions() {

    const container = document.getElementById("deletedMenu");
    container.innerHTML = "";
    container.classList.add("deleted-container"); // pour le CSS

    // -------- En-tête --------
    const header = document.createElement("div");
    header.className = "deleted-header";

    if (deletedBaseQuestions.length === 0) {
        header.innerText = "La liste des questions supprimées est vide";
        container.appendChild(header);
        return;
    } else {
        header.innerText = "Questions supprimées : " + deletedBaseQuestions.length;
        container.appendChild(header);
    }

    // -------- Pagination --------
    const start = deletedPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = deletedBaseQuestions.slice(start, end);

    const list = document.createElement("div");
    list.className = "deleted-list";

    pageItems.forEach(id => {

        const question = baseQuestions.find(q => q.id === id);

        const card = document.createElement("div");
        card.className = "deleted-card";

        const textDiv = document.createElement("div");
        textDiv.className = "deleted-text";
        textDiv.innerHTML = "<b>ID " + id + "</b> : " +
            (question ? question.texte : "Question introuvable");

        const btn = document.createElement("button");
        btn.className = "btn primary small";
        btn.innerText = "Restaurer";
        btn.onclick = () => restaurerQuestion(id);

        card.appendChild(textDiv);
        card.appendChild(btn);

        list.appendChild(card);
    });

    container.appendChild(list);

    // -------- Navigation --------
    const nav = document.createElement("div");
    nav.className = "deleted-nav";

    const totalPages = Math.ceil(deletedBaseQuestions.length / PAGE_SIZE);

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn small";
    prevBtn.innerText = "◀";
    prevBtn.disabled = deletedPage === 0;
    prevBtn.onclick = prevDeleted;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn small";
    nextBtn.innerText = "▶";
    nextBtn.disabled = deletedPage >= totalPages - 1;
    nextBtn.onclick = nextDeleted;

    const pageInfo = document.createElement("span");
    pageInfo.className = "deleted-page";
    pageInfo.innerText = `Page ${deletedPage + 1} / ${totalPages}`;

    nav.appendChild(prevBtn);
    nav.appendChild(pageInfo);
    nav.appendChild(nextBtn);

    container.appendChild(nav);
}

// ------------- Navigation ------------

function nextDeleted() {
    if ((deletedPage + 1) * PAGE_SIZE < deletedBaseQuestions.length) {
        deletedPage++;
        renderDeletedQuestions();
    }
}

function prevDeleted() {
    if (deletedPage > 0) {
        deletedPage--;
        renderDeletedQuestions();
    }
}

// ------------- Actions ------------

async function restaurerQuestion(id) {

    const success = await restaurerBaseQuestion(id);

    if (success) {
        deletedBaseQuestions = deletedBaseQuestions.filter(q => q !== id);
        renderDeletedQuestions();
        await loadAllQuestions();

        // Mettre à jour la liste globale des tags si il y a des nouveaux
        const newTags = Array.from(new Set(allQuestions.flatMap(q => q.tags)));

        const tagsChanged =
            newTags.length !== allTags.length ||
            newTags.some(tag => !allTags.includes(tag));

        if (tagsChanged) {
            allTags = newTags;
            await genererTagsAvecbox();
            await loadActiveFilters();
        }
    }
}
// #endregion


// #region UpdateQuestion
// ==================================================
// Gestion de l'update des question :
//    - local : le texte est remplacé / tag ajouté ou supprimé
//    - base  : une question local est créé avec le meme id pour surcharger la question base
// ==================================================

const btnEditQuestion = document.getElementById("btnEditQuestion");
let editingQuestionId = null; // null = nouvelle question, sinon ID de la question à modifier

// Bouton Modifier la question affichée
document.getElementById("btnEditQuestion").addEventListener("click", () => {
    const currentId = document.getElementById("currentQuestionId").value;
    if (!currentId) return alert("Aucune question sélectionnée pour modification !");

    const question = allQuestions.find(q => q.id == currentId);
    if (!question) return alert("Question introuvable !");

    // Cacher la zone d'affichage des questions
    mainContainer.style.display = "none";

    // On passe en mode édition
    editingQuestionId = question.id;

    // Pré-remplir le formulaire
    document.getElementById("questionTextInput").value = question.texte || "";

    // Réinitialiser les tags
    currentTags = [...question.tags]; // les tags de la question
    allTags = Array.from(new Set(allQuestions.flatMap(q => q.tags))); // tous les tags connus
    renderTags();

    tagInput.value = "";
    hideSuggestions();

    // Afficher le formulaire
    document.getElementById("headerQuestionForm").textContent = "Modifier la Question";
    questionForm.style.display = "flex";
});

// #endregion


// #region AddQuestion
// ==================================================
// Gestion de l'ajout de question (Local)
// ==================================================

// Éléments
const tagInput = document.getElementById("tagInput");
const addTagBtn = document.getElementById("addTagBtn");
const tagListDiv = document.getElementById("tagList");
const tagSuggestionsDiv = document.getElementById("tagSuggestions");
const btnNewQuestion = document.getElementById("btnNewQuestion");
const btnCancelEdit = document.getElementById("btnCancelEdit");

btnNewQuestion.addEventListener("click", () => {
    // Cacher la zone d'affichage existante
    mainContainer.style.display = "none";

    editingQuestionId = null;

    // Réinitialiser les tags
    allTags = Array.from(new Set(allQuestions.flatMap(q => q.tags))); // tous les tags connus
    currentTags = [];
    renderTags();

    // Réinitialiser le formulaire
    document.getElementById("questionAuthor").value = "";
    document.getElementById("questionTextInput").value = "";
    tagInput.value = "";
    hideSuggestions();

    // Afficher le formulaire si caché
    document.getElementById("headerQuestionForm").textContent = "Nouvelle Question";
    questionForm.style.display = "flex";
});

btnCancelEdit.addEventListener("click", () => {
    // Afficher la zone d'affichage existante
    mainContainer.style.display = "block";
    editingQuestionId = null;

    // Cacher le formulaire si caché
    questionForm.style.display = "none";
});

// ----------------------------------
// Gestion visuelle des tags choisis
// ----------------------------------
function renderTags() {
    tagListDiv.innerHTML = "";
    currentTags.forEach(tag => {
        const span = document.createElement("span");
        span.textContent = tag + " ";
        span.style.marginRight = "5px";

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "x";
        removeBtn.style.marginLeft = "3px";
        removeBtn.onclick = () => {
            currentTags = currentTags.filter(t => t !== tag);
            renderTags();
        };

        span.appendChild(removeBtn);
        tagListDiv.appendChild(span);
    });
}

// ----------------------------------
// Ajouter un tag
// ----------------------------------
function addTag(tag) {
    tag = tag.trim().toLowerCase();
    if (!tag) return;

    if (!currentTags.includes(tag)) {
        currentTags.unshift(tag); // Ajoute en premier
    }

    tagInput.value = "";
    renderTags();
}

addTagBtn.addEventListener("click", () => addTag(tagInput.value));

tagInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        addTag(tagInput.value);
    }
});

// ----------------------------------
// Suggestions de tags
// ----------------------------------
function showSuggestions() {
    const val = tagInput.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const suggestions = allTags.filter(t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(val) && !currentTags.includes(t));
    tagSuggestionsDiv.innerHTML = "";
    if (suggestions.length === 0) {
        tagSuggestionsDiv.style.display = "none";
        return;
    }
    suggestions.forEach(tag => {
        const div = document.createElement("div");
        div.textContent = tag;
        div.style.padding = "2px 5px";
        div.style.cursor = "pointer";
        div.addEventListener("click", () => addTag(tag));
        tagSuggestionsDiv.appendChild(div);
    });
    tagSuggestionsDiv.style.display = "block";
}

function hideSuggestions() {
    tagSuggestionsDiv.style.display = "none";
}

tagInput.addEventListener("input", showSuggestions);
tagInput.addEventListener("click", showSuggestions);
document.addEventListener("click", e => {
    if (!tagSuggestionsDiv.contains(e.target) && e.target !== tagInput && e.target !== addTagBtn) {
        hideSuggestions();
    }
});

// ----------------------------------
// Soumission de la question
// ----------------------------------
document.getElementById("submitQuestion").addEventListener("click", async () => {
    const author = document.getElementById("questionAuthor").value.trim();
    const texte = document.getElementById("questionTextInput").value.trim();

    if (!author || !texte) {
        alert("L'auteur et le texte de la question sont obligatoires !");
        return;
    }

    if (author === "base") {
        alert("L'auteur base ne peut pas etre utiliser");
        return;
    }

    let questionObj;
    let idToUse;

    if (editingQuestionId) {
        // Mode édition
        idToUse = editingQuestionId;
        const original = allQuestions.find(q => q.id === idToUse);

        if (!original) {
            alert("Question introuvable !");
            return;
        }

        if (await isLocalQuestion(idToUse)) {
            // Question locale → on modifie directement
            questionObj = {
                id: idToUse,
                author,
                texte,
                tags: [...currentTags]
            };
            await updateLocalQuestion(questionObj);
        } else {
            // Question de base → créer une question locale avec le même ID
            questionObj = {
                id: idToUse,
                author,
                texte,
                tags: [...currentTags]
            };
            await addLocalQuestion(questionObj);
        }
    } else {
        // Nouvelle question
        idToUse = Date.now();
        questionObj = {
            id: idToUse,
            author,
            texte,
            tags: [...currentTags]
        };
        await addLocalQuestion(questionObj);
    }

    // Recharge les questions fusionnées
    await loadAllQuestions();

    // Mettre à jour la liste globale des tags si il y a des nouveaux
    const newTags = Array.from(new Set(allQuestions.flatMap(q => q.tags)));

    const tagsChanged =
        newTags.length !== allTags.length ||
        newTags.some(tag => !allTags.includes(tag));

    if (tagsChanged) {
        allTags = newTags;
        await genererTagsAvecbox();
        await loadActiveFilters();
    }

    alert(editingQuestionId ? "Question modifiée !" : "Question ajoutée !");

    afficherQuestionParId(idToUse);

    // Afficher la zone d'affichage existante
    mainContainer.style.display = "block";

    // Cacher le formulaire 
    questionForm.style.display = "none";

    // Réinitialiser le formulaire
    document.getElementById("questionAuthor").value = "";
    document.getElementById("questionTextInput").value = "";
    currentTags = [];
    renderTags();
    editingQuestionId = null;
});
// #endregion