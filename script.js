// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyBZV2NoG6CpkqtgL1CMtGo6h4tVQFPL5fY",
    authDomain: "alenochka-tictactoe.firebaseapp.com",
    databaseURL: "https://alenochka-tictactoe-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "alenochka-tictactoe",
    storageBucket: "alenochka-tictactoe.appspot.com",
    messagingSenderId: "458796541632",
    appId: "1:458796541632:web:8b9d8f9b8b8f9b8b8b8f9b"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Добавим отладку подключения
database.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        console.log('Подключено к Firebase');
    } else {
        console.log('Отключено от Firebase');
    }
});

// Константы
const X_CLASS = 'x';
const O_CLASS = 'o';
const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// DOM элементы
const cellElements = document.querySelectorAll('[data-cell]');
const board = document.getElementById('board');
const statusText = document.getElementById('status');
const restartButton = document.getElementById('restartButton');
const leaveGameButton = document.getElementById('leaveGame');
const loginMenu = document.getElementById('loginMenu');
const mainMenu = document.getElementById('mainMenu');
const gameContainer = document.getElementById('gameContainer');
const playerNameInput = document.getElementById('playerName');
const saveNameButton = document.getElementById('saveNameBtn');
const createGameButton = document.getElementById('createGame');
const joinGameButton = document.getElementById('joinGame');
const gameCodeInput = document.getElementById('gameCode');
const welcomeMessage = document.getElementById('welcomeMessage');
const winsElement = document.getElementById('wins');
const lossesElement = document.getElementById('losses');
const player1NameElement = document.getElementById('player1Name');
const player2NameElement = document.getElementById('player2Name');
const player1ScoreElement = document.getElementById('player1Score').querySelector('.score');
const player2ScoreElement = document.getElementById('player2Score').querySelector('.score');
const currentGameCodeElement = document.getElementById('currentGameCode');

// Состояние игры
let currentGame = null;
let playerName = '';
let playerSymbol = '';
let isMyTurn = false;
let gameStats = { wins: 0, losses: 0 };

// Инициализация
loadPlayerData();
setupEventListeners();

function loadPlayerData() {
    const savedName = localStorage.getItem('playerName');
    const savedStats = localStorage.getItem('gameStats');
    
    if (savedName) {
        playerName = savedName;
        showMainMenu();
        updateWelcomeMessage();
    }
    
    if (savedStats) {
        gameStats = JSON.parse(savedStats);
        updateStats();
    }
}

function setupEventListeners() {
    saveNameButton.addEventListener('click', saveName);
    createGameButton.addEventListener('click', createGame);
    joinGameButton.addEventListener('click', joinGame);
    leaveGameButton.addEventListener('click', leaveGame);
    restartButton.addEventListener('click', requestRestart);
}

function saveName() {
    const name = playerNameInput.value.trim();
    if (name.length < 2) {
        alert('Имя должно содержать минимум 2 символа');
        return;
    }
    
    playerName = name;
    localStorage.setItem('playerName', name);
    showMainMenu();
    updateWelcomeMessage();
}

function updateWelcomeMessage() {
    welcomeMessage.textContent = `Добро пожаловать, ${playerName}! 💝`;
}

function updateStats() {
    winsElement.textContent = gameStats.wins;
    lossesElement.textContent = gameStats.losses;
    localStorage.setItem('gameStats', JSON.stringify(gameStats));
}

function showMainMenu() {
    loginMenu.style.display = 'none';
    mainMenu.style.display = 'block';
    gameContainer.style.display = 'none';
}

function showGame() {
    loginMenu.style.display = 'none';
    mainMenu.style.display = 'none';
    gameContainer.style.display = 'block';
}

function createGame() {
    const gameId = generateGameCode();
    console.log('Создание новой игры с кодом:', gameId);

    currentGame = gameId;
    playerSymbol = X_CLASS;
    isMyTurn = true;

    const gameData = {
        board: Array(9).fill(''),
        currentTurn: X_CLASS,
        status: 'waiting',
        winner: null,
        player1: {
            name: playerName,
            score: 0
        },
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref(`games/${gameId}`).set(gameData)
        .then(() => {
            console.log('Игра успешно создана');
            startGame(gameId);
            currentGameCodeElement.innerText = `Код игры: ${gameId}`;
            updatePlayerNames();
            
            // Добавим автоматическое удаление старых игр
            setTimeout(() => {
                database.ref(`games/${gameId}`).onDisconnect().remove();
            }, 1000);
        })
        .catch(error => {
            console.error('Ошибка при создании игры:', error);
            alert('Произошла ошибка при создании игры. Попробуйте снова.');
        });
}

function joinGame() {
    const gameId = gameCodeInput.value.trim().toUpperCase();
    if (!gameId) {
        alert('Пожалуйста, введите код игры');
        return;
    }

    console.log('Попытка присоединиться к игре:', gameId);

    database.ref(`games/${gameId}`).once('value')
        .then(snapshot => {
            const game = snapshot.val();
            console.log('Получены данные игры:', game);

            if (!game) {
                alert('Игра не найдена. Проверьте код и попробуйте снова.');
                return;
            }
            if (game.status !== 'waiting') {
                alert('К этой игре нельзя присоединиться. Возможно, игра уже началась или завершена.');
                return;
            }

            currentGame = gameId;
            playerSymbol = O_CLASS;
            isMyTurn = false;

            database.ref(`games/${gameId}`).update({
                status: 'playing',
                player2: {
                    name: playerName,
                    score: 0
                }
            }).then(() => {
                console.log('Успешно присоединились к игре');
                startGame(gameId);
                currentGameCodeElement.innerText = `Код игры: ${gameId}`;
                updatePlayerNames();
            }).catch(error => {
                console.error('Ошибка при присоединении к игре:', error);
                alert('Произошла ошибка при присоединении к игре. Попробуйте снова.');
            });
        })
        .catch(error => {
            console.error('Ошибка при проверке игры:', error);
            alert('Произошла ошибка при поиске игры. Попробуйте снова.');
        });
}

function startGame(gameId) {
    showGame();
    
    database.ref(`games/${gameId}`).on('value', snapshot => {
        const game = snapshot.val();
        if (!game) return;

        updateBoard(game.board);
        updateGameStatus(game);
        updateScores(game);

        if (game.status === 'playing') {
            isMyTurn = game.currentTurn === playerSymbol;
            updateStatus();
        }
    });

    cellElements.forEach(cell => {
        cell.addEventListener('click', handleClick, { once: true });
    });
}

function handleClick(e) {
    if (!isMyTurn) return;
    
    const cell = e.target;
    const index = [...cellElements].indexOf(cell);

    database.ref(`games/${currentGame}/board/${index}`).set(playerSymbol);
    database.ref(`games/${currentGame}/currentTurn`).set(playerSymbol === X_CLASS ? O_CLASS : X_CLASS);

    checkWinningCondition();
}

function updateBoard(board) {
    cellElements.forEach((cell, index) => {
        cell.classList.remove(X_CLASS, O_CLASS);
        const value = board[index];
        if (value) {
            cell.classList.add(value);
            cell.innerHTML = value === X_CLASS ? '❤️' : '🌸';
        } else {
            cell.innerHTML = '';
        }
    });
}

function updateGameStatus(game) {
    if (game.winner) {
        const isWinner = game.winner === playerSymbol;
        statusText.innerText = isWinner ? 
            'Ты победил(а)! 💝' : 'Твоя половинка победила! 💝';
        
        if (!game.statsUpdated) {
            if (isWinner) {
                gameStats.wins++;
            } else {
                gameStats.losses++;
            }
            updateStats();
            database.ref(`games/${currentGame}/statsUpdated`).set(true);
        }
    } else if (game.status === 'draw') {
        statusText.innerText = 'Ничья! Любовь победила! 💕';
    } else {
        updateStatus();
    }
}

function updateStatus() {
    if (isMyTurn) {
        statusText.innerText = 'Твой ход, любимая! 💝';
    } else {
        statusText.innerText = 'Ход твоей половинки... 💕';
    }
}

function updatePlayerNames() {
    database.ref(`games/${currentGame}`).once('value', snapshot => {
        const game = snapshot.val();
        if (game.player1) {
            player1NameElement.textContent = game.player1.name;
        }
        if (game.player2) {
            player2NameElement.textContent = game.player2.name;
        }
    });
}

function updateScores(game) {
    if (game.player1 && game.player2) {
        player1ScoreElement.textContent = game.player1.score || 0;
        player2ScoreElement.textContent = game.player2.score || 0;
    }
}

function checkWinningCondition() {
    database.ref(`games/${currentGame}/board`).once('value', snapshot => {
        const board = snapshot.val();
        const win = WINNING_COMBINATIONS.some(combination => {
            return combination.every(index => {
                return board[index] === playerSymbol;
            });
        });

        if (win) {
            database.ref(`games/${currentGame}`).update({
                winner: playerSymbol,
                status: 'finished'
            });
            
            // Обновляем счет победителя
            const scorePath = playerSymbol === X_CLASS ? 'player1/score' : 'player2/score';
            database.ref(`games/${currentGame}/${scorePath}`).transaction(score => (score || 0) + 1);
        } else if (board.every(cell => cell)) {
            database.ref(`games/${currentGame}`).update({
                status: 'draw'
            });
        }
    });
}

function requestRestart() {
    if (currentGame) {
        database.ref(`games/${currentGame}`).update({
            board: Array(9).fill(''),
            currentTurn: X_CLASS,
            status: 'playing',
            winner: null,
            statsUpdated: false
        });
    }
}

function leaveGame() {
    if (currentGame) {
        database.ref(`games/${currentGame}`).off();
        database.ref(`games/${currentGame}`).remove();
    }
    showMainMenu();
}

function generateGameCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Анимация сердечек
function createHeart() {
    const heart = document.createElement('div');
    heart.classList.add('floating-heart');
    heart.innerHTML = Math.random() > 0.5 ? '❤️' : '🌸';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = Math.random() * 3 + 2 + 's';
    document.body.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 5000);
}

setInterval(createHeart, 3000);

// Добавим функцию для очистки старых игр
function cleanupOldGames() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    database.ref('games').orderByChild('createdAt').endAt(oneHourAgo)
        .once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                childSnapshot.ref.remove();
            });
        });
}

// Запускаем очистку старых игр каждый час
setInterval(cleanupOldGames, 60 * 60 * 1000); 