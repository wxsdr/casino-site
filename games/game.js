/* ==========================================================================
   1. АВТОМАСШТАБИРОВАНИЕ СЦЕНЫ
   ========================================================================== */
function resizeGame() {
    const wrapper = document.getElementById('game-wrapper');
    const scene = document.getElementById('game-scene');
    const baseWidth = 1920;
    const baseHeight = 1080;
    
    const scale = Math.min(
        wrapper.clientWidth / baseWidth,
        wrapper.clientHeight / baseHeight
    );
    scene.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizeGame);
resizeGame();


/* ==========================================================================
   2. СИСТЕМНЫЕ МОДАЛЬНЫЕ ОКНА И FIREBASE
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
        btnCancel.className = 'modal-btn cancel'; btnCancel.innerText = 'НЕТ';
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

const firebaseConfig = {
    apiKey: "AIzaSyC1HOC3_im8YiziljGqpR_0AvHLQctIfxQ",
    authDomain: "kurahivka-casino.firebaseapp.com",
    databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "kurahivka-casino"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const username = localStorage.getItem('casino_user');
if (!username) window.location.href = '../index.html';

let currentBalance = 0;
const userRef = database.ref('users_by_name/' + username.toLowerCase());

userRef.on('value', snap => {
    const data = snap.val();
    if (data && data.in_casino === false) {
        showModal("ДОСТУП ЗАКРЫТ", "Вы покинули территорию казино.", false, () => window.location.href = '../index.html');
    }
    currentBalance = data ? (data.chips || 0) : 0;
    document.getElementById('balance-amount').innerText = currentBalance;
});


/* ==========================================================================
   3. ЧАСТИЦЫ И СПЕЦЭФФЕКТЫ
   ========================================================================== */
function initParticles() {
    const container = document.getElementById('particles-container');
    for(let i=0; i<35; i++) {
        let p = document.createElement('div');
        p.style.position = 'absolute'; p.style.width = '6px'; p.style.height = '6px';
        p.style.background = '#fff'; p.style.borderRadius = '50%';
        p.style.boxShadow = '0 0 15px 5px #ffdf00'; p.style.opacity = '0';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = (Math.random() * 50 + 50) + 'vh';
        p.style.animation = `floatFirefly ${Math.random()*5+3}s linear infinite ${Math.random()*5}s`;
        
        const keyframes = `
        @keyframes floatFirefly {
            0% { transform: translateY(0) scale(0); opacity: 0; }
            20% { opacity: 0.8; transform: translateY(-20vh) scale(1); }
            100% { transform: translateY(-100vh) translateX(${Math.random()*100-50}px) scale(0.5); opacity: 0; }
        }`;
        const styleSheet = document.createElement("style"); styleSheet.innerText = keyframes; document.head.appendChild(styleSheet);
        container.appendChild(p);
    }
}
initParticles();

function spawnCoinShower() {
    const shower = document.getElementById('coin-shower');
    shower.style.display = 'block'; shower.innerHTML = '';
    for(let i=0; i<100; i++) {
        let coin = document.createElement('div');
        coin.className = 'falling-coin';
        coin.style.left = Math.random() * 100 + 'vw';
        coin.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
        coin.style.animationDelay = (Math.random() * 1.5) + 's';
        shower.appendChild(coin);
    }
    setTimeout(() => { shower.style.display = 'none'; shower.innerHTML = ''; }, 4000);
}


/* ==========================================================================
   4. ЛОГИКА СЛОТА И УПРАВЛЕНИЕ СТАВКАМИ
   ========================================================================== */
const standardSymbols = [
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f436.svg">',
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f429.svg">',
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43a.svg">',
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9b4.svg">',
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f969.svg">',
    '<span class="card-symbol color-a">A</span>',
    '<span class="card-symbol color-k">K</span>',
    '<span class="card-symbol color-q">Q</span>',
    '<span class="card-symbol color-j">J</span>',
    '<span class="card-symbol color-10">10</span>'
]; 
const scatterSymbol = '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43e.svg">'; 
const wildSymbol = '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f3e0.svg">'; 

const SYMBOL_HEIGHT = 180; 
const SYMBOLS_PER_REEL = 35; 

let currentBet = 10;
let isSpinning = false;
let isBonusGame = false;
let activeBonusType = null; // 'sticky' | 'raining'
let freeSpinsLeft = 0;
let stickyWilds = {}; 

let currentMatrix = [
    [standardSymbols[0], standardSymbols[1], standardSymbols[2], standardSymbols[3], standardSymbols[4]],
    [standardSymbols[5], standardSymbols[6], standardSymbols[7], standardSymbols[8], standardSymbols[9]],
    [standardSymbols[0], standardSymbols[1], standardSymbols[2], standardSymbols[3], standardSymbols[4]]
];

// РУЧНОЙ ВВОД СТАВКИ
const betInput = document.getElementById('bet-input');
const bonusPriceDisplay = document.getElementById('bonus-price');

function updateBet(newBet) {
    if (isSpinning || isBonusGame) {
        betInput.value = currentBet; // Возвращаем обратно, если крутится
        return;
    }
    newBet = parseInt(newBet);
    if (isNaN(newBet) || newBet < 10) newBet = 10;
    if (newBet > 50000) newBet = 50000;
    
    currentBet = newBet;
    betInput.value = currentBet;
    bonusPriceDisplay.innerText = currentBet * 100;
}

document.getElementById('bet-minus').addEventListener('click', () => updateBet(currentBet - 10));
document.getElementById('bet-plus').addEventListener('click', () => updateBet(currentBet + 10));
betInput.addEventListener('change', (e) => updateBet(e.target.value));


/* ==========================================================================
   5. ВРАЩЕНИЕ БАРАБАНОВ
   ========================================================================== */
function buildReels(matrixToShow) {
    for (let c = 0; c < 5; c++) {
        const strip = document.getElementById(`strip-${c}`);
        strip.innerHTML = ''; 
        
        for (let i = 0; i < SYMBOLS_PER_REEL; i++) {
            const cell = document.createElement('div');
            cell.className = 'symbol-cell';
            cell.id = `cell-${c}-${i}`;
            
            if (i < 3) {
                let symbolHTML = matrixToShow[i][c];
                
                // Рендерим липкие будки, если активен режим 'sticky'
                if (isBonusGame && activeBonusType === 'sticky' && stickyWilds[`${c}-${i}`]) {
                    cell.innerHTML = `${wildSymbol}<div class="wild-multiplier">x${stickyWilds[`${c}-${i}`]}</div>`;
                    cell.classList.add('sticky');
                } 
                // Рендерим случайно упавшие будки (или Raining Wilds)
                else if (symbolHTML === wildSymbol) {
                    let mult = Math.random() > 0.5 ? 2 : 3; 
                    cell.innerHTML = `${wildSymbol}<div class="wild-multiplier">x${mult}</div>`;
                    cell.classList.add('sticky');
                } else {
                    cell.innerHTML = symbolHTML;
                }
            } 
            else if (i >= SYMBOLS_PER_REEL - 3) {
                let oldRow = i - (SYMBOLS_PER_REEL - 3);
                cell.innerHTML = currentMatrix[oldRow][c];
            } 
            else {
                cell.innerHTML = standardSymbols[Math.floor(Math.random() * standardSymbols.length)];
                cell.classList.add('spinning-blur'); 
            }
            strip.appendChild(cell);
        }
        
        const startY = -((SYMBOLS_PER_REEL - 3) * SYMBOL_HEIGHT);
        strip.style.transition = 'none';
        strip.style.transform = `translateY(${startY}px)`;
    }
}

buildReels(currentMatrix);

function generateRandomMatrix(forceBonus = false) {
    let newMatrix = [[], [], []];
    
    // Переменная для режима Raining Wilds
    let rainingWildsToDrop = 0;
    if (isBonusGame && activeBonusType === 'raining') {
        rainingWildsToDrop = Math.floor(Math.random() * 6) + 1; // 1-6 будок каждый спин
    }

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            if (forceBonus && r === 1 && (c === 0 || c === 2 || c === 4)) {
                newMatrix[r].push(scatterSymbol); continue;
            }
            
            let isScatterReel = (c === 0 || c === 2 || c === 4);
            if (!isBonusGame && !forceBonus && isScatterReel && Math.random() < 0.05) {
                newMatrix[r].push(scatterSymbol);
            } 
            // Добавляем Raining Wilds
            else if (isBonusGame && activeBonusType === 'raining' && rainingWildsToDrop > 0 && (c === 1 || c === 2 || c === 3) && Math.random() < 0.3) {
                newMatrix[r].push(wildSymbol);
                rainingWildsToDrop--;
            }
            // Обычные Wilds (только в основной игре)
            else if (!isBonusGame && (c === 1 || c === 2 || c === 3) && Math.random() < 0.12) {
                newMatrix[r].push(wildSymbol);
            } else {
                newMatrix[r].push(standardSymbols[Math.floor(Math.random() * standardSymbols.length)]);
            }
        }
    }
    return newMatrix;
}


/* ==========================================================================
   6. ИГРОВОЙ ЦИКЛ И ВЫБОР БОНУСА
   ========================================================================== */
document.getElementById('spin-btn').addEventListener('click', async () => {
    if (isSpinning) return;
    updateBet(betInput.value); // Синхронизируем перед спином
    
    if (!isBonusGame && currentBalance < currentBet) return showModal("Ошибка", "Недостаточно фишек!");
    
    isSpinning = true; lockButtons(true);
    setStatus("ВРАЩЕНИЕ...", "#fff");
    
    if (!isBonusGame) await userRef.update({ chips: currentBalance - currentBet });
    else freeSpinsLeft--;

    executeSpin(false);
});

// ПОКУПКА БОНУСА (Открываем меню выбора)
document.getElementById('buy-bonus-btn').addEventListener('click', () => {
    const cost = currentBet * 100;
    if (isSpinning || isBonusGame) return;
    if (currentBalance < cost) return showModal("Ошибка", `Недостаточно фишек!\nНужно: ${cost} 🪙`);
    
    showModal("ПОКУПКА БОНУСА", `Оплатить ${cost} 🪙 для запуска?`, true, async () => {
        isSpinning = true; lockButtons(true);
        await userRef.update({ chips: currentBalance - cost });
        setStatus("АКТИВАЦИЯ...", "#fff");
        executeSpin(true); // Вращаем и выдаем скаттеры
    });
});

function executeSpin(forceBonus) {
    let targetMatrix = generateRandomMatrix(forceBonus);
    let scatterCount = 0;
    
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            // Если режим Sticky - сохраняем будки навсегда
            if (isBonusGame && activeBonusType === 'sticky' && !stickyWilds[`${c}-${r}`] && targetMatrix[r][c] === wildSymbol && (c === 1 || c === 2 || c === 3)) {
                stickyWilds[`${c}-${r}`] = Math.random() > 0.5 ? 2 : 3; 
            }
            if (targetMatrix[r][c] === scatterSymbol) scatterCount++;
        }
    }
    
    buildReels(targetMatrix);
    
    for (let c = 0; c < 5; c++) {
        setTimeout(() => {
            const strip = document.getElementById(`strip-${c}`);
            strip.style.transition = 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1.15)';
            strip.style.transform = `translateY(0px)`;
            
            setTimeout(() => {
                document.getElementById(`cell-${c}-0`).classList.remove('spinning-blur');
                document.getElementById(`cell-${c}-1`).classList.remove('spinning-blur');
                document.getElementById(`cell-${c}-2`).classList.remove('spinning-blur');
            }, 800);
            
        }, c * 150);
    }
    
    setTimeout(() => {
        currentMatrix = targetMatrix; 
        checkWin(scatterCount);
    }, 1200 + (4 * 150));
}

async function checkWin(scatterCount) {
    let winAmount = 0;
    let hasBigWin = false;

    for (let r = 0; r < 3; r++) {
        // Упрощенная проверка выигрыша (горизонталь)
        if (currentMatrix[r][0] === currentMatrix[r][1] || currentMatrix[r][1] === wildSymbol) {
            if (Math.random() > 0.4) {
                document.getElementById(`cell-0-${r}`).classList.add('win-glow'); // Заметка: id ячеек создаются как cell-Колонка-Ряд
                document.getElementById(`cell-1-${r}`).classList.add('win-glow');
                document.getElementById(`cell-2-${r}`).classList.add('win-glow');
                
                let lineWin = currentBet * (Math.floor(Math.random() * 8) + 1);
                let multiplier = 1;
                for(let c = 1; c <= 3; c++) {
                    // Учитываем сохраненные множители для Sticky, либо проверяем Raining на лету
                    if (isBonusGame && activeBonusType === 'sticky' && stickyWilds[`${c}-${r}`]) {
                        multiplier += stickyWilds[`${c}-${r}`];
                    } else if (currentMatrix[r][c] === wildSymbol) {
                        multiplier += 2; // Базовый множитель для обычной игры или Raining
                    }
                }
                winAmount += (lineWin * (multiplier > 1 ? multiplier : 1));
            }
        }
    }

    if (winAmount > 0) {
        setStatus(`ВЫИГРЫШ: +${winAmount} 🪙`, "#00ff9d");
        await userRef.once('value').then(s => { userRef.update({ chips: s.val().chips + winAmount }); });
        
        if (winAmount >= currentBet * 20) {
            spawnCoinShower();
            hasBigWin = true;
        }
    } else if (!isBonusGame) {
        setStatus("НЕ ПОВЕЗЛО", "#888");
    }

    let delay = hasBigWin ? 2500 : 1000;

    setTimeout(() => {
        if (!isBonusGame && scatterCount >= 3) {
            // ОТКРЫВАЕМ МЕНЮ ВЫБОРА БОНУСА
            document.getElementById('bonus-choice-modal').style.display = 'flex';
            setTimeout(() => document.getElementById('bonus-choice-modal').classList.add('show'), 10);
        } else if (isBonusGame && freeSpinsLeft <= 0) {
            endBonusGame();
        } else if (isBonusGame && freeSpinsLeft > 0) {
            setStatus(`ФРИСПИНЫ: ${freeSpinsLeft}`, "#ff3366", true);
            isSpinning = false;
        } else {
            resetControls();
        }
    }, delay);
}

// ЭТУ ФУНКЦИЮ ВЫЗЫВАЮТ КНОПКИ В МЕНЮ
window.selectBonus = function(type) {
    document.getElementById('bonus-choice-modal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('bonus-choice-modal').style.display = 'none';
        
        isBonusGame = true;
        activeBonusType = type;
        stickyWilds = {}; 
        
        if (type === 'sticky') {
            freeSpinsLeft = Math.floor(Math.random() * 9) + 7; // 7 - 15
            setStatus(`🔥 ЛИПКИЕ БУДКИ: ${freeSpinsLeft} 🔥`, "#ffdf00", true);
        } else {
            freeSpinsLeft = Math.floor(Math.random() * 16) + 15; // 15 - 30
            setStatus(`🌧 ДОЖДЬ ИЗ БУДОК: ${freeSpinsLeft} 🌧`, "#00d4ff", true);
        }
        
        isSpinning = false; 
    }, 300);
}

function endBonusGame() {
    showModal("БОНУС ЗАВЕРШЕН", "Все бесплатные вращения использованы.");
    isBonusGame = false;
    activeBonusType = null;
    stickyWilds = {}; 
    resetControls();
}

function resetControls() {
    isSpinning = false; lockButtons(false); 
    setStatus("ГОТОВ К ИГРЕ", "#ffdf00", false);
    document.querySelectorAll('.win-glow').forEach(el => el.classList.remove('win-glow'));
}

function lockButtons(lock) {
    document.getElementById('spin-btn').disabled = lock; 
    document.getElementById('buy-bonus-btn').disabled = lock;
    betInput.disabled = lock;
    document.querySelectorAll('.bet-btn').forEach(btn => btn.disabled = lock);
}

function setStatus(text, color, isBonus = false) {
    const st = document.getElementById('status-text');
    st.innerText = text; st.style.color = color;
    if(isBonus) st.classList.add('bonus-active'); else st.classList.remove('bonus-active');
}
