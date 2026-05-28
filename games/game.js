/* ==========================================================================
   1. АВТОМАТИЧНЕ МАСШТАБУВАННЯ СЦЕНИ (Щоб завжди влазило в екран)
   ========================================================================== */
function resizeGame() {
    const wrapper = document.getElementById('game-wrapper');
    const scene = document.getElementById('game-scene');
    
    // Сцена завжди має базовий розмір 1920x1080
    const baseWidth = 1920;
    const baseHeight = 1080;
    
    // Рахуємо коефіцієнт масштабування (щоб помістилося по ширині і висоті)
    const scale = Math.min(
        wrapper.clientWidth / baseWidth,
        wrapper.clientHeight / baseHeight
    );
    
    // Застосовуємо масштаб
    scene.style.transform = `scale(${scale})`;
}

// Викликаємо при завантаженні та при зміні розміру вікна
window.addEventListener('resize', resizeGame);
resizeGame();


/* ==========================================================================
   2. ІНІЦІАЛІЗАЦІЯ FIREBASE ТА БАЛАНСУ
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyC1HOC3_im8YiziljGqpR_0AvHLQctIfxQ",
    authDomain: "kurahivka-casino.firebaseapp.com",
    databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "kurahivka-casino"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const username = localStorage.getItem('casino_user');
if (!username) window.location.href = '../index.html'; // Якщо не авторизований - в лобі

let currentBalance = 0;
const userRef = database.ref('users_by_name/' + username.toLowerCase());

userRef.on('value', snap => {
    const data = snap.val();
    if (data && data.in_casino === false) {
        alert("ДОСТУП ЗАБЛОКОВАНО: Ви покинули казино.");
        window.location.href = '../index.html';
    }
    currentBalance = data ? (data.chips || 0) : 0;
    document.getElementById('balance-amount').innerText = currentBalance;
});


/* ==========================================================================
   3. НАЛАШТУВАННЯ СЛОТА ТА СИМВОЛІВ
   ========================================================================== */
// Використовуємо надійні SVG іконки з CDN для AAA якості
const standardSymbols = [
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f436.svg">', // Собака 1
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f429.svg">', // Собака 2
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43a.svg">', // Вовк/Хаскі
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f9b4.svg">', // Кістка
    '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f969.svg">', // М'ясо
    '<span class="card-symbol color-a">A</span>',
    '<span class="card-symbol color-k">K</span>',
    '<span class="card-symbol color-q">Q</span>',
    '<span class="card-symbol color-j">J</span>',
    '<span class="card-symbol color-10">10</span>'
]; 
const scatterSymbol = '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43e.svg">'; // Лапа (Scatter)
const wildSymbol = '<img src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f3e0.svg">'; // Будка (Wild)

const SYMBOL_HEIGHT = 180; // 165px символ + 15px відступ
const SYMBOLS_PER_REEL = 35; // Довжина стрічки для крутої анімації

let currentBet = 10;
let isSpinning = false;
let isBonusGame = false;
let freeSpinsLeft = 0;
let stickyWilds = {}; // Формат: { "0-1": 2 } (колонка-рядок: множник)

// Поточна матриця на екрані (3 рядки, 5 колонок)
let currentMatrix = [
    [standardSymbols[0], standardSymbols[1], standardSymbols[2], standardSymbols[3], standardSymbols[4]],
    [standardSymbols[5], standardSymbols[6], standardSymbols[7], standardSymbols[8], standardSymbols[9]],
    [standardSymbols[0], standardSymbols[1], standardSymbols[2], standardSymbols[3], standardSymbols[4]]
];

/* ==========================================================================
   4. ФІЗИКА БАРАБАНІВ (ГЕНЕРАЦІЯ ТА АНІМАЦІЯ)
   ========================================================================== */
function buildReels(matrixToShow) {
    for (let c = 0; c < 5; c++) {
        const strip = document.getElementById(`strip-${c}`);
        strip.innerHTML = ''; // Очищаємо стрічку
        
        // Генеруємо 35 символів для стрічки
        for (let i = 0; i < SYMBOLS_PER_REEL; i++) {
            const cell = document.createElement('div');
            cell.className = 'symbol-cell';
            cell.id = `cell-${c}-${i}`;
            
            // Перші 3 символи (0, 1, 2) - це ТЕ, ЩО ВИПАДЕ (результат спіну)
            if (i < 3) {
                let symbolHTML = matrixToShow[i][c];
                
                // Якщо це бонуска і тут є липка будка - малюємо її з множником
                if (isBonusGame && stickyWilds[`${c}-${i}`]) {
                    cell.innerHTML = `${wildSymbol}<div class="wild-multiplier">x${stickyWilds[`${c}-${i}`]}</div>`;
                    cell.classList.add('sticky');
                } else if (symbolHTML === wildSymbol) {
                    let mult = Math.random() > 0.5 ? 2 : 3; // Звичайна будка
                    cell.innerHTML = `${wildSymbol}<div class="wild-multiplier">x${mult}</div>`;
                } else {
                    cell.innerHTML = symbolHTML;
                }
            } 
            // Останні 3 символи (32, 33, 34) - це ТЕ, ЩО БУЛО НА ЕКРАНІ ДО СПІНУ
            else if (i >= SYMBOLS_PER_REEL - 3) {
                let oldRow = i - (SYMBOLS_PER_REEL - 3);
                cell.innerHTML = currentMatrix[oldRow][c];
            } 
            // Всі інші символи посередині - просто розмитий рандом для ефекту руху
            else {
                cell.innerHTML = standardSymbols[Math.floor(Math.random() * standardSymbols.length)];
                cell.classList.add('spinning-blur'); // Додаємо блюр
            }
            
            strip.appendChild(cell);
        }
        
        // Встановлюємо стрічку в самий низ (щоб було видно старий результат)
        const startY = -((SYMBOLS_PER_REEL - 3) * SYMBOL_HEIGHT);
        strip.style.transition = 'none';
        strip.style.transform = `translateY(${startY}px)`;
    }
}

// Ініціалізація барабанів при старті
buildReels(currentMatrix);

// Управління ставкою
function changeBet(amount) {
    if (isSpinning || isBonusGame) return;
    let newBet = currentBet + amount;
    if (newBet >= 10 && newBet <= 5000) {
        currentBet = newBet;
        document.getElementById('bet-amount').innerText = currentBet;
        document.getElementById('bonus-price').innerText = currentBet * 100;
    }
}
document.getElementById('bet-minus').addEventListener('click', () => changeBet(-10));
document.getElementById('bet-plus').addEventListener('click', () => changeBet(10));


/* ==========================================================================
   5. ІГРОВИЙ ЦИКЛ (СПІН, ГЕНЕРАЦІЯ РЕЗУЛЬТАТУ)
   ========================================================================== */
function generateRandomMatrix(forceBonus = false) {
    let newMatrix = [[], [], []];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            // Форсуємо скатери, якщо куплено бонус (падають на 1, 3, 5 барабани)
            if (forceBonus && r === 1 && (c === 0 || c === 2 || c === 4)) {
                newMatrix[r].push(scatterSymbol);
                continue;
            }
            
            let isScatterReel = (c === 0 || c === 2 || c === 4);
            // Шанс випадання Скаттера (лише на непарних барабанах)
            if (!isBonusGame && !forceBonus && isScatterReel && Math.random() < 0.06) {
                newMatrix[r].push(scatterSymbol);
            } else {
                // Будки (Wild) падають тільки на 2, 3 і 4 барабани
                if ((c === 1 || c === 2 || c === 3) && Math.random() < 0.12) {
                    newMatrix[r].push(wildSymbol);
                } else {
                    newMatrix[r].push(standardSymbols[Math.floor(Math.random() * standardSymbols.length)]);
                }
            }
        }
    }
    return newMatrix;
}

document.getElementById('spin-btn').addEventListener('click', async () => {
    if (isSpinning) return;
    if (!isBonusGame && currentBalance < currentBet) return alert("Недостатньо фішок!");
    
    isSpinning = true;
    updateStatus("КРУТИМО...", "#fff");
    
    // Списуємо ставку (якщо це не фріспін)
    if (!isBonusGame) {
        await userRef.update({ chips: currentBalance - currentBet });
    } else {
        freeSpinsLeft--;
    }
    
    executeSpin(false);
});

document.getElementById('buy-bonus-btn').addEventListener('click', async () => {
    const cost = currentBet * 100;
    if (isSpinning || isBonusGame) return;
    if (currentBalance < cost) return alert("Недостатньо фішок для покупки бонусу!");
    
    if(confirm(`Купити бонус за ${cost} 🪙?`)) {
        isSpinning = true;
        updateStatus("ПОКУПКА БОНУСУ...", "#fff");
        await userRef.update({ chips: currentBalance - cost });
        executeSpin(true); // true = force bonus scatters
    }
});

function executeSpin(forceBonus) {
    // 1. Генеруємо фінальний результат
    let targetMatrix = generateRandomMatrix(forceBonus);
    
    // 2. Логіка "Липких будок" у бонусці
    let scatterCount = 0;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            if (isBonusGame && !stickyWilds[`${c}-${r}`] && targetMatrix[r][c] === wildSymbol && (c === 1 || c === 2 || c === 3)) {
                stickyWilds[`${c}-${r}`] = Math.random() > 0.5 ? 2 : 3; 
            }
            if (targetMatrix[r][c] === scatterSymbol) scatterCount++;
        }
    }
    
    // 3. Відмальовуємо нові стрічки з результатами нагорі
    buildReels(targetMatrix);
    
    // 4. ЗАПУСКАЄМО АНІМАЦІЮ ПАДІННЯ (Затримка для кожного барабана)
    // Використовуємо cubic-bezier для ефекту різкого падіння і пружного відскоку
    for (let c = 0; c < 5; c++) {
        setTimeout(() => {
            const strip = document.getElementById(`strip-${c}`);
            strip.style.transition = 'transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1.15)';
            strip.style.transform = `translateY(0px)`;
            
            // Знімаємо блюр з фінальних символів
            setTimeout(() => {
                document.getElementById(`cell-${c}-0`).classList.remove('spinning-blur');
                document.getElementById(`cell-${c}-1`).classList.remove('spinning-blur');
                document.getElementById(`cell-${c}-2`).classList.remove('spinning-blur');
            }, 1000);
            
        }, c * 200); // Кожен наступний барабан стартує на 200мс пізніше
    }
    
    // 5. Чекаємо завершення анімації останнього барабана і перевіряємо виграш
    setTimeout(() => {
        currentMatrix = targetMatrix; // Оновлюємо поточну матрицю
        checkWin(scatterCount);
    }, 1500 + (4 * 200));
}

/* ==========================================================================
   6. ПЕРЕВІРКА ВИГРАШУ ТА БОНУСНОЇ ГРИ
   ========================================================================== */
async function checkWin(scatterCount) {
    let winAmount = 0;
    
    // Спрощена перевірка виграшу (3 в ряд по горизонталі)
    for (let r = 0; r < 3; r++) {
        if (currentMatrix[r][0] === currentMatrix[r][1] || currentMatrix[r][1] === wildSymbol) {
            if (Math.random() > 0.4) {
                let lineWin = currentBet * (Math.floor(Math.random() * 8) + 1);
                
                // Множимо на будки, якщо вони є
                let multiplier = 1;
                for(let c = 1; c <= 3; c++) {
                    if(stickyWilds[`${c}-${r}`]) multiplier += stickyWilds[`${c}-${r}`];
                }
                winAmount += (lineWin * (multiplier > 1 ? multiplier : 1));
            }
        }
    }

    if (winAmount > 0) {
        updateStatus(`ВИГРАШ: +${winAmount} 🪙`, "#00ff9d");
        await userRef.once('value').then(s => { userRef.update({ chips: s.val().chips + winAmount }); });
    } else if (!isBonusGame) {
        updateStatus("НЕ ПОЩАСТИЛО", "#888");
    }

    // Затримка перед наступною дією
    setTimeout(() => {
        if (!isBonusGame && scatterCount >= 3) {
            startBonusGame();
        } else if (isBonusGame && freeSpinsLeft <= 0) {
            endBonusGame();
        } else if (isBonusGame && freeSpinsLeft > 0) {
            updateStatus(`ФРІСПІНИ: ${freeSpinsLeft}`, "#ff3366");
            isSpinning = false;
        } else {
            isSpinning = false;
            updateStatus("ГОТОВИЙ ДО ГРИ", "#ffdf00");
        }
    }, 1200);
}

function startBonusGame() {
    isBonusGame = true;
    freeSpinsLeft = Math.floor(Math.random() * 9) + 9; // Від 9 до 18 спінів
    stickyWilds = {}; 
    
    alert(`🐾 БОНУСНА ГРА!\nВи виграли ${freeSpinsLeft} безкоштовних обертань.\nВсі будки тепер стають липкими!`);
    updateStatus(`🔥 БОНУСКА: ${freeSpinsLeft} 🔥`, "#ff3366");
    
    isSpinning = false;
}

function endBonusGame() {
    alert("Бонусні обертання завершені. Повертаємось до звичайної гри.");
    isBonusGame = false;
    stickyWilds = {}; 
    isSpinning = false;
    updateStatus("ГОТОВИЙ ДО ГРИ", "#ffdf00");
}

function updateStatus(text, color) {
    const statusEl = document.getElementById('status-screen');
    statusEl.innerText = text;
    statusEl.style.color = color;
}
