const oldData = localStorage.getItem("todo");
let lists = JSON.parse(localStorage.getItem("todo-lists")) || [];

if (oldData && lists.length === 0) {
    lists.push({
        id: Date.now().toString(),
        name: "Мій список",
        tasks: JSON.parse(oldData)
    });
    localStorage.removeItem("todo");
}

if (lists.length === 0) {
    lists.push({
        id: Date.now().toString(),
        name: "Загальне",
        tasks: []
    });
}

let activeListId = localStorage.getItem("active-list-id") || lists[0].id;

const todoInput = document.getElementById("new-task");
const todoList = document.querySelector(".scrollable-list");
const todoCount = document.getElementById("task-count");
const addButton = document.getElementById("add-task-btn");
const clearButton = document.getElementById("clear-completed");
const listsContainer = document.querySelector(".lists-container");
const addListButton = document.getElementById("add-list-btn");
const deleteListButton = document.getElementById("delete-list-btn");

const unifiedShareButton = document.getElementById("unified-share-btn");
const shareModal = document.getElementById("share-modal");
const userSearchInput = document.getElementById("user-search-input");
const userSearchResults = document.getElementById("user-search-results");
const externalShareBtn = document.getElementById("external-share-btn");

let saveTimeout;
function saveToLocalStorage() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem("todo-lists", JSON.stringify(lists));
        localStorage.setItem("active-list-id", activeListId);
    }, 100); 
}


document.addEventListener("DOMContentLoaded", () => {
    checkImportFromUrl();
    renderLists();
    renderTasks();
    
    addButton.addEventListener("click", addTask);
    todoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTask();
        }
    });
    
    clearButton.addEventListener("click", deleteCompletedTasks);
    addListButton.addEventListener("click", createNewList);
    deleteListButton.addEventListener("click", deleteCurrentList);

    if (unifiedShareButton) {
        unifiedShareButton.addEventListener("click", openShareModal);
    }
    
    if (externalShareBtn) {
        externalShareBtn.addEventListener("click", () => {
            closeShareModal();
            shareViaEmail();
        });
    }

    if (userSearchInput) {
        userSearchInput.addEventListener("input", handleUserSearch);
    }
});

function getActiveList() {
    return lists.find(list => list.id === activeListId) || lists[0];
}

function renderLists() {
    listsContainer.innerHTML = "";
    
    const fragment = document.createDocumentFragment();
    
    lists.forEach(list => {
        const btn = document.createElement("button");
        btn.classList.add("list-tab");
        btn.textContent = list.name;
        
        if (list.id === activeListId) {
            btn.classList.add("active-list");
        }
        
        btn.addEventListener("click", () => {
            activeListId = list.id;
            saveToLocalStorage();
            renderLists();
            renderTasks();
        });

        btn.addEventListener("dblclick", () => {
            renameList(list);
        });
        
        fragment.appendChild(btn);
    });
    
    listsContainer.appendChild(fragment);
}

function createNewList() {
    const listName = prompt("Введіть назву нового списку:", "Новий список");
    if (listName && listName.trim() !== "") {
        const newList = {
            id: Date.now().toString(),
            name: listName.trim(),
            tasks: []
        };
        lists.push(newList);
        activeListId = newList.id;
        saveToLocalStorage();
        renderLists();
        renderTasks();
    }
}

function deleteCurrentList() {
    if (lists.length <= 1) {
        alert("Не можна видалити останній список!");
        return;
    }
    
    if (confirm("Ви впевнені, що хочете видалити цей список і всі завдання в ньому?")) {
        lists = lists.filter(list => list.id !== activeListId);
        activeListId = lists[0].id;
        saveToLocalStorage();
        renderLists();
        renderTasks();
    }
}

function renameList(list) {
    const newName = prompt("Введіть нову назву списку:", list.name);
    if (newName !== null && newName.trim() !== "") {
        list.name = newName.trim();
        saveToLocalStorage();
        renderLists();
    }
}

function renderTasks() {
    const currentList = getActiveList();
    todoList.innerHTML = "";
    
    const fragment = document.createDocumentFragment();
    
    currentList.tasks.forEach((item, index) => {
        const li = document.createElement("li");
        if (item.disabled) li.classList.add("completed");

        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${item.disabled ? "checked" : ""}>
            <span class="task-text" style="margin-left: 10px; flex-grow: 1; cursor: pointer;" title="Натисніть для редагування">${item.text}</span>
        `;

        li.querySelector(".todo-checkbox")
            .addEventListener("change", () => toggleTask(index));

        li.querySelector(".task-text")
            .addEventListener("click", () => editTask(index, li));

        fragment.appendChild(li);
    });
    
    todoList.appendChild(fragment);
    todoCount.textContent = currentList.tasks.length;
}

function addTask() {
    const newTask = todoInput.value.trim();
    if (newTask !== "") {
        const currentList = getActiveList();
        currentList.tasks.push({ text: newTask, disabled: false });
        saveToLocalStorage();
        todoInput.value = "";
        renderTasks();
    }
}

function toggleTask(index) {
    const currentList = getActiveList();
    currentList.tasks[index].disabled = !currentList.tasks[index].disabled;
    saveToLocalStorage();
    renderTasks();
}

function editTask(index, liItem) {
    const currentList = getActiveList();
    const span = liItem.querySelector(".task-text");
    const currentText = currentList.tasks[index].text;

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.style.width = "100%";
    input.style.padding = "5px";
    input.style.fontFamily = "inherit";

    span.replaceWith(input);
    input.focus();

    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText) {
            currentList.tasks[index].text = newText;
            saveToLocalStorage();
        }
        renderTasks();
    };

    input.addEventListener("blur", saveEdit);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveEdit();
    });
}

function deleteCompletedTasks() {
    const currentList = getActiveList();
    currentList.tasks = currentList.tasks.filter(item => !item.disabled);
    saveToLocalStorage();
    renderTasks();
}

function openShareModal() {
    const currentList = getActiveList();
    if (currentList.tasks.length === 0) {
        alert("Список порожній!");
        return;
    }
    shareModal.style.display = 'flex';
    userSearchInput.focus();
}

function closeShareModal() {
    shareModal.style.display = 'none';
    userSearchInput.value = '';
    userSearchResults.style.display = 'none';
}

let searchTimeout;
function handleUserSearch(e) {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 1) {
        userSearchResults.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
            
            if (response.status === 401) {
                 userSearchResults.innerHTML = '<div style="color:red; cursor:default; padding:8px;">Увійдіть в акаунт!</div>';
                 userSearchResults.style.display = 'block';
                 return;
            }
            
            const users = await response.json();
            userSearchResults.innerHTML = '';
            
            if (users.length > 0) {
                userSearchResults.style.display = 'block';
                users.forEach(username => {
                    const div = document.createElement('div');
                    div.innerHTML = `👤 ${username}`;
                    div.style.padding = '8px';
                    div.style.cursor = 'pointer';
                    
                    div.onclick = () => confirmSendToUser(username);
                    userSearchResults.appendChild(div);
                });
            } else {
                userSearchResults.style.display = 'block';
                userSearchResults.innerHTML = '<div style="color:#999; cursor:default; padding:8px;">Користувача не знайдено</div>';
            }
        } catch (error) {
            console.error(error);
        }
    }, 300);
}

async function confirmSendToUser(username) {
    if (confirm(`Надіслати список користувачу ${username}?`)) {
        const currentList = getActiveList();
        
        try {
            const response = await fetch('/api/send-to-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    list_data: currentList
                })
            });
            
            const result = await response.json();
            if (result.status === 'success') {
                alert(`✅ Список надіслано ${username}!`);
                closeShareModal();
            } else {
                alert("Помилка: " + result.message);
            }
        } catch (e) {
            alert("Помилка з'єднання");
        }
    }
}

async function shareViaEmail() {
    const currentList = getActiveList();
    
    const originalText = externalShareBtn.innerText;
    externalShareBtn.innerText = "⏳ Saving...";
    externalShareBtn.disabled = true;

    try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentList)
        });

        const result = await response.json();

        if (result.status === 'success') {
            const shareUrl = `${window.location.origin}/?list_id=${result.id}`;
            const subject = encodeURIComponent(`Спільний список: ${currentList.name} 👽`);
            const tasksPreview = currentList.tasks.map(t => t.text).join(', ');
            const body = encodeURIComponent(
                `Привіт! Я створив список "${currentList.name}" (${tasksPreview}...).\n\n` +
                `Відкрий його тут:\n${shareUrl}`
            );

            if (navigator.share) {
                await navigator.share({
                    title: `Список ${currentList.name}`,
                    text: `Тримай список: ${shareUrl}`,
                    url: shareUrl
                });
            } else {
                window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
            }
        } else {
            alert("Помилка сервера: " + result.message);
        }

    } catch (error) {
        console.error("Error sharing:", error);
        alert("Не вдалося з'єднатися з сервером.");
    } finally {
        externalShareBtn.innerText = originalText;
        externalShareBtn.disabled = false;
    }
}

async function checkImportFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list_id');

    if (listId) {
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#2C5E50;color:white;padding:10px 20px;border-radius:20px;z-index:1000;";
        loadingMsg.innerText = "👽 Завантажую список із хмари...";
        document.body.appendChild(loadingMsg);

        try {
            const response = await fetch(`/api/get/${listId}`);
            const result = await response.json();

            loadingMsg.remove();

            if (result.status === 'success') {
                const importedList = result.data;
                importedList.name = importedList.name + " (Cloud)";
                
                if (confirm(`Знайдено спільний список: "${importedList.name}". Додати його собі?`)) {
                    importedList.id = Date.now().toString();
                    lists.push(importedList);
                    activeListId = importedList.id;
                    saveToLocalStorage();
                    window.history.replaceState({}, document.title, window.location.pathname);
                    alert("Список успішно завантажено! ✅");
                    renderLists();
                    renderTasks();
                }
            } else {
                alert("Цей список не знайдено (можливо, він був видалений).");
            }
        } catch (error) {
            console.error("Import error:", error);
            loadingMsg.remove();
            alert("Помилка завантаження списку.");
        }
    }
}


let isLoginMode = true;

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('auth-btn');
    const text = document.getElementById('toggle-auth-text');
    const emailInput = document.getElementById('auth-email');
    
    if (isLoginMode) {
        title.textContent = "Вхід";
        btn.textContent = "Увійти";
        text.textContent = "Немає акаунту?";
        emailInput.style.display = "none";
        btn.onclick = performLogin;
    } else {
        title.textContent = "Реєстрація";
        btn.textContent = "Зареєструватися";
        text.textContent = "Вже є акаунт?";
        emailInput.style.display = "block";
        btn.onclick = performRegister;
    }
}

async function performRegister() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value;
    
    if (!email.includes('@')) {
        alert("Введіть коректний Email!");
        return;
    }

    const response = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password, email})
    });
    
    const result = await response.json();
    alert(result.message);
    
    if (result.status === 'success') {
        toggleAuthMode();
    }
}

async function performLogin() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
        location.reload();
    } else {
        alert(result.message);
    }
}

async function logout() {
    await fetch('/api/logout', {method: 'POST'});
    location.reload();
}

async function loadMyLists() {
    try {
        const response = await fetch('/api/my-lists');
        const result = await response.json();
        
        if (result.status === 'success') {
            if (result.lists.length === 0) {
                alert("У вас ще немає збережених списків у хмарі.");
                return;
            }

            let text = "Ваші останні збережені списки:\n";
            result.lists.forEach((l, index) => {
                text += `${index + 1}. ${l.name} (ID: ...${l.id.slice(-4)})\n`;
            });
            text += "\nВведіть номер списку, щоб імпортувати його:";

            const choice = prompt(text);
            const index = parseInt(choice) - 1;
            
            if (!isNaN(index) && result.lists[index]) {
                window.location.href = `/?list_id=${result.lists[index].id}`;
            }
        }
    } catch (e) {
        console.error(e);
        alert("Помилка завантаження списків.");
    }
}