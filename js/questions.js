// Variables globales
let baseQuestions = [];          // Toutes les questions de base
let localQuestions = [];         // Toutes les questions locales
let deletedBaseQuestions = [];   // Tous les IDs de questions de base supprimées
let allQuestions = [];           // Fusion de base + locales (excluant les supprimées)


// -----------------------------------
// Charger toutes les questions
// -----------------------------------
async function loadAllQuestions() {
    try {
        // Charger les questions de base
        await loadBaseQuestions();

        // Charger les questions locales
        await loadAllLocalQuestions();

        // Charger les IDs supprimés
        await loadDeletedBaseIds();

        // Fusionner les questions
        const map = new Map();

        baseQuestions.forEach(q => {
            if (!deletedBaseQuestions.includes(q.id)) {
                map.set(q.id, q);
            }
        });

        localQuestions.forEach(q => {
            map.set(q.id, q);
        });

        allQuestions = Array.from(map.values());
        console.log("Questions fusionnées :", allQuestions);

        return allQuestions;
    } catch (err) {
        console.error("Erreur lors du chargement de toutes les questions :", err);
        allQuestions = [];
        return [];
    }
}

// ---------------------------------
// Chargement base JSON
// ---------------------------------
async function loadBaseQuestions() {
    try {
        const res = await fetch('data/questions.base.json');
        baseQuestions = await res.json();
        return baseQuestions;
    } catch (err) {
        console.error("Erreur loadBaseQuestions :", err);
        baseQuestions = [];
        return [];
    }
}

// ---------------------------------
// Chargement locales
// ---------------------------------
function loadAllLocalQuestions() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("localQuestions", "readonly");
        const store = tx.objectStore("localQuestions");
        const req = store.getAll();

        req.onsuccess = e => {
            localQuestions = e.target.result;
            resolve(localQuestions);
        };

        req.onerror = e => {
            console.error("Erreur loadAllLocalQuestions :", e.target.errorCode);
            localQuestions = [];
            resolve([]);
        };
    });
}

// ---------------------------------
// Chargement IDs supprimées
// ---------------------------------
function loadDeletedBaseIds() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("deletedBaseQuestions", "readonly");
        const store = tx.objectStore("deletedBaseQuestions");
        const req = store.getAllKeys();

        req.onsuccess = e => {
            deletedBaseQuestions = e.target.result;
            resolve(deletedBaseQuestions);
        };

        req.onerror = e => {
            console.error("Erreur loadDeletedBaseIds :", e.target.errorCode);
            deletedBaseQuestions = [];
            resolve([]);
        };
    });
}


// -----------------------------------
// Supprime une question de base JSON
// -----------------------------------
async function deleteBaseQuestion(id) {
    const transaction = db.transaction(["deletedBaseQuestions"], "readwrite");
    const store = transaction.objectStore("deletedBaseQuestions");

    const existing = await new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });

    if (!existing) {
        await new Promise((resolve, reject) => {
            const req = store.add({ id: id });
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        });

        // Mettre l'id au début de la liste
        if (!deletedBaseQuestions.includes(id)) deletedBaseQuestions.unshift(id);

        return true;
    } else {
        // Si déjà supprimée, on peut aussi la déplacer en tête
        deletedBaseQuestions = deletedBaseQuestions.filter(d => d !== id);
        deletedBaseQuestions.unshift(id);

        return false;
    }
}

// -----------------------------------
// Restaure une question de base JSON
// -----------------------------------
async function restaurerBaseQuestion(id) {
    if (!db) {
        console.error("DB non ouverte !");
        return false;
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("deletedBaseQuestions", "readwrite");
        const store = transaction.objectStore("deletedBaseQuestions");
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`Question de base ${id} restaurée`);
            resolve(true);
        };

        request.onerror = (event) => {
            console.error("Erreur restauration question de base :", event.target.errorCode);
            resolve(false); // on résout quand même pour ne pas bloquer
        };
    });
}