/* ==========================================================================
   1. СМАРТ-МАСШТАБУВАННЯ (AAA-СТАНДАРТ)
   ========================================================================== */
function resizeGame() {
    const scene = document.getElementById('game-scene');
    // Обчислюємо доступне місце (висота екрану мінус 70px на верхню панель)
    const availableHeight = window.innerHeight - 70;
    const availableWidth = window.innerWidth;
    
    // Розраховуємо масштаб, щоб 1920x1080 завжди ідеально вписувалось
    const scaleX = availableWidth / 1920;
    const scaleY = availableHeight / 1080;
    const scale = Math.min(scaleX, scaleY);
    
    scene.style.transform = `scale(${scale})`;
}

// Запускаємо при старті та при зміні розміру вікна
window.addEventListener('resize', resizeGame);
resizeGame();

/* ==========================================================================
   2. КАСТОМНІ МОДАЛЬНІ ВІКНА
   ========================================================================== */
function showModal(title, desc, isConfirm = false, onConfirm = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    const actionsBox = document.getElementById('modal-actions');
    actionsBox.innerHTML = '';

    if (isConfirm) {
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'modal-btn confirm'; btnConfirm.innerText = 'ТАК';
        btnConfirm.onclick = () => { closeModal(); if(onConfirm) onConfirm(); };
        
        const btnCancel = document.createElement('button');
        btnCancel.className = 'modal-btn cancel'; btnCancel.innerText = 'НІ';
        btnCancel.onclick = closeModal;

        actionsBox.appendChild(btnConfirm); actionsBox.appendChild(btnCancel);
    } else {
        const btnOk = document.createElement('button');
        btnOk.className = 'modal-btn confirm'; btnOk.innerText = 'ОК';
        btnOk.onclick = closeModal; actionsBox.appendChild(btnOk);
    }
    const overlay = document.getElementById('ui-modal');
    overlay.style.display = 'flex'; setTimeout(() => overlay.classList.add('show'), 10);
}
function closeModal() {
    const overlay = document.getElementById('ui-modal');
    overlay.classList.remove('show'); setTimeout(() => overlay.style.display = 'none', 300);
}

/* ==========================================================================
   3. FIREBASE ТА БАЛАНС
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyC1HOC3_im8YiziljGqpR_0AvHLQctIfxQ",
    authDomain: "kurahivka-casino.firebaseapp.com",
    databaseURL: "https://kurah
