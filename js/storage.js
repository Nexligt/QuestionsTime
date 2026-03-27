const DB_NAME = "QuestionsTimeDB";
const DB_VERSION = 1;
let db;

function openDatabase(callback) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = function(event) {
    db = event.target.result;

    // Store pour les questions locales
    if (!db.objectStoreNames.contains("localQuestions")) {
      const store = db.createObjectStore("localQuestions", { keyPath: "id" });
      store.createIndex("tags", "tags", { multiEntry: true });
      store.createIndex("author", "author", { unique: false });
    }

    // Store pour les IDs des questions de base supprimées
    if (!db.objectStoreNames.contains("deletedBaseQuestions")) {
      db.createObjectStore("deletedBaseQuestions", { keyPath: "id" });
    }

    // Store pour les paramètres
    if (!db.objectStoreNames.contains("settings")) {
      db.createObjectStore("settings", { keyPath: "key" });
    }

    console.log("Stores créés / mis à jour");
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    console.log("Base ouverte avec succès");
    if (callback) callback();
  };

  request.onerror = function(event) {
    console.error("Erreur ouverture IndexedDB :", event.target.errorCode);
  };
}


// -----------------------------------
// Ajouter une question locale
// -----------------------------------
async function addLocalQuestion(questionObj) {
    const transaction = db.transaction(["localQuestions"], "readwrite");
    const store = transaction.objectStore("localQuestions");

    try {
        await new Promise((resolve, reject) => {
            const req = store.add(questionObj);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        });
        console.log("Question locale ajoutée :", questionObj);
        return true;
    } catch (err) {
        console.error("Erreur ajout question :", err);
        return false;
    }
}

// -----------------------------------
// Supprimer une question locale
// -----------------------------------
async function deleteLocalQuestion(id) {
    const transaction = db.transaction(["localQuestions"], "readwrite");
    const store = transaction.objectStore("localQuestions");

    try {
        // Vérifier si la question existe
        const question = await new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });

        if (!question) {
            console.log(`Question ${id} introuvable`);
            return false;
        }

        // Supprimer la question
        await new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        });

        console.log(`Question ${id} supprimée`);
        return true;

    } catch (err) {
        console.error(`Erreur lors de la suppression de ${id} :`, err);
        return false;
    }
}

// -----------------------------------
// Mettre à jour une question locale
// -----------------------------------
async function updateLocalQuestion(questionObj) {
    const transaction = db.transaction(["localQuestions"], "readwrite");
    const store = transaction.objectStore("localQuestions");

    try {
        await new Promise((resolve, reject) => {
            const req = store.put(questionObj); // put remplace ou ajoute
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e.target.error);
        });
        console.log("Question locale mise à jour :", questionObj);
        return true;
    } catch (err) {
        console.error("Erreur mise à jour question :", err);
        return false;
    }
}

// -----------------------------------
// Retourne si c'est une question local
// -----------------------------------
async function isLocalQuestion(id) {
  return localQuestions.some(q => q.id === id);
}


// -----------------------------------
// Renvoie vers la bonne fonction de delete
// -----------------------------------
async function deleteQuestion(id) {
  // Vérifie si l'id peut exister
  if (isNaN(id)) {
    return { success: false, type: null };
  }

  if (await isLocalQuestion(id)) {
      const success = await deleteLocalQuestion(id);
      return { success, type: "locale" };
  } else {
      const success = await deleteBaseQuestion(id);
      return { success, type: "base" };
  }
}

// -----------------------------------
// Gestion Setting
// -----------------------------------

async function saveSetting(key, value) {
    const transaction = db.transaction(["settings"], "readwrite");
    const store = transaction.objectStore("settings");

    return new Promise((resolve, reject) => {
        const request = store.put({ key, value });

        request.onsuccess = () => {
            resolve(true);
        };

        request.onerror = (event) => {
            console.error("Erreur saveSetting :", event.target.error);
            resolve(false);
        };
    });
}

async function getSetting(key) {
    const transaction = db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");

    return new Promise((resolve) => {
        const request = store.get(key);

        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };

        request.onerror = (event) => {
            console.error("Erreur getSetting :", event.target.error);
            resolve(null);
        };
    });
}




