const LEVELS = {
    easy: {
        name: "Könnyű", rows: 5, cols: 5,
        houses: [
            {r: 0, c: 0, size: 1}, 
            {r: 0, c: 2, size: 5},
            {r: 2, c: 1, size: 1},
            {r: 3, c: 3, size: 5},
            {r: 4, c: 0, size: 1}
        ]
    },
    medium: {
        name: "Közepes", rows: 7, cols: 7,
        houses: [
            {r: 0, c: 0, size: 12},
            {r: 0, c: 6, size: 4},
            {r: 3, c: 0, size: 1},
            {r: 3, c: 2, size: 1},
            {r: 5, c: 0, size: 7},
            {r: 5, c: 5, size: 3}
        ]
    },
    hard: {
        name: "Nehéz", rows: 10, cols: 10,
        houses: [
            {r: 0, c: 0, size: 12},
            {r: 0, c: 7, size: 7},
            {r: 2, c: 4, size: 2},
            {r: 4, c: 0, size: 5},
            {r: 4, c: 4, size: 1},
            {r: 4, c: 6, size: 2},
            {r: 4, c: 9, size: 1},
            {r: 6, c: 4, size: 1},
            {r: 6, c: 6, size: 1},
            {r: 6, c: 8, size: 1},
            {r: 7, c: 0, size: 13},
            {r: 7, c: 5, size: 1},
            {r: 8, c: 7, size: 4}
        ]
    }
};

let state = {
    board: [],
    levelId: '',
    playerName: '',
    startTime: 0,
    elapsedMsOffset: 0,
    timerRunning: false,
    timerRequestId: null,
    isDragging: false,
    dragMode: null
};

(function init() {
    refreshSavedGamesList();

    document.body.addEventListener('click', function(e) {
        if (e.target.matches('button[data-action="newGame"]')) startNewGame();
        else if (e.target.matches('button[data-action="loadGame"]')) loadGame();
        else if (e.target.matches('button[data-action="rules"]')) switchMenu('rulesScreen');
        else if (e.target.matches('button[data-action="leaderboard"]')) showLeaderboard();
        else if (e.target.matches('button[data-action="saveGame"]')) saveGame();
        else if (e.target.matches('.backToMain')) {
            stopTimer();
            switchMenu('mainMenu');
            refreshSavedGamesList();
        }
    });

    const boardEl = document.querySelector('.board-container');
    boardEl.addEventListener('contextmenu', e => e.preventDefault());
    boardEl.addEventListener('mousedown', handleMouseDown);
    boardEl.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseup', () => {
        if(state.isDragging) {
            state.isDragging = false;
            checkWinCondition();
        }
    });
})();

function switchMenu(screenName) {
    const menus = document.querySelectorAll('.menu');
    for (let menu of menus) {
        menu.classList.add('hidden');
    }
    const targetMenu = document.querySelector(`.menu[data-screen="${screenName}"]`);
    if (targetMenu) targetMenu.classList.remove('hidden');
}


function showCustomMessage(msg) {
    const modal = document.querySelector('.custom-modal');
    modal.innerText = msg;
    modal.classList.remove('hidden');
    
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 2500); 
}


function startNewGame() {
    const nameInputEl = document.querySelector('input[name="playerName"]');
    const nameInput = nameInputEl.value.trim();
    
    if (!nameInput) { 
        showCustomMessage("Kérlek, add meg a neved!"); 
        nameInputEl.classList.add('input-error');
        return; 
    } else {
        nameInputEl.classList.remove('input-error');
    }

    const difficultyInput = document.querySelector('input[name="difficulty"]:checked');
    if (!difficultyInput) return;
    const difficulty = difficultyInput.value;
    
    state.playerName = nameInput;
    state.levelId = difficulty;
    state.elapsedMsOffset = 0;
    
    const level = LEVELS[difficulty];
    state.board = Array.from({ length: level.rows }, () => Array(level.cols).fill('EMPTY'));
    level.houses.forEach(h => state.board[h.r][h.c] = 'HOUSE');

    setupGameScreen();
}

function setupGameScreen() {
    switchMenu('gameScreen');
    document.querySelector('.display-player').innerText = state.playerName;
    document.querySelector('.display-level').innerText = LEVELS[state.levelId].name;
    
    renderBoard();
    startTimer();
}


function renderBoard() {
    const boardEl = document.querySelector('.board-container');
    const level = LEVELS[state.levelId];
    boardEl.style.gridTemplateColumns = `repeat(${level.cols}, 1fr)`;
    boardEl.innerHTML = '';

    const { errors } = calculateErrors();

    for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            const val = state.board[r][c];
            if (val === 'HOUSE') {
                cell.classList.add('house');
                const house = level.houses.find(h => h.r === r && h.c === c);
                cell.innerHTML = `<span>${house.size}</span>`;
            } else if (val === 'WALL') {
                cell.classList.add('wall');
            } else if (val === 'ESTATE') {
                cell.classList.add('estate');
            }

            if (errors[r][c].small) cell.classList.add('error-small');
            if (errors[r][c].large) cell.classList.add('error-large');
            if (errors[r][c].wall) cell.classList.add('error-wall');

            boardEl.appendChild(cell);
        }
    }
}

function handleMouseDown(e) {
    if (!e.target.classList.contains('cell') || e.target.classList.contains('house')) return;
    state.isDragging = true;
    
    const r = parseInt(e.target.dataset.r, 10);
    const c = parseInt(e.target.dataset.c, 10);
    const currentVal = state.board[r][c];

    if (e.button === 0) { 
        state.dragMode = (currentVal === 'WALL') ? 'EMPTY' : 'WALL';
    } else if (e.button === 2) { 
        state.dragMode = (currentVal === 'ESTATE') ? 'EMPTY' : 'ESTATE';
    }
    applyMove(r, c, state.dragMode);
}

function handleMouseOver(e) {
    if (!state.isDragging || !e.target.classList.contains('cell') || e.target.classList.contains('house')) return;
    const r = parseInt(e.target.dataset.r, 10);
    const c = parseInt(e.target.dataset.c, 10);
    applyMove(r, c, state.dragMode);
}

function applyMove(r, c, mode) {
    if (state.board[r][c] !== mode) {
        state.board[r][c] = mode;
        renderBoard();
    }
}


function calculateErrors() {
    const level = LEVELS[state.levelId];
    let errors = Array.from({length: level.rows}, () => Array.from({length: level.cols}, () => ({small: false, large: false, wall: false})));
    let hasError = false;

    for (let r = 0; r < level.rows - 1; r++) {
        for (let c = 0; c < level.cols - 1; c++) {
            if (state.board[r][c] === 'WALL' && state.board[r+1][c] === 'WALL' && 
                state.board[r][c+1] === 'WALL' && state.board[r+1][c+1] === 'WALL') {
                errors[r][c].wall = errors[r+1][c].wall = errors[r][c+1].wall = errors[r+1][c+1].wall = true;
                hasError = true;
            }
        }
    }

    let visitedEstate = Array.from({length: level.rows}, () => Array(level.cols).fill(false));
    for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
            if (!visitedEstate[r][c] && (state.board[r][c] === 'ESTATE' || state.board[r][c] === 'HOUSE')) {
                let q = [{r, c}];
                visitedEstate[r][c] = true;
                let region = [];
                let housesInRegion = [];

                while (q.length > 0) {
                    let curr = q.shift();
                    region.push(curr);
                    if (state.board[curr.r][curr.c] === 'HOUSE') {
                        housesInRegion.push(level.houses.find(h => h.r === curr.r && h.c === curr.c));
                    }

                    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for (let [dr, dc] of dirs) {
                        let nr = curr.r + dr, nc = curr.c + dc;
                        if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && !visitedEstate[nr][nc] && (state.board[nr][nc] === 'ESTATE' || state.board[nr][nc] === 'HOUSE')) {
                            visitedEstate[nr][nc] = true;
                            q.push({r: nr, c: nc});
                        }
                    }
                }
                if (housesInRegion.length > 1) {
                    region.forEach(cell => errors[cell.r][cell.c].large = true);
                    hasError = true;
                } else if (housesInRegion.length === 1) {
                    if (region.length > housesInRegion[0].size) {
                        region.forEach(cell => errors[cell.r][cell.c].large = true);
                        hasError = true;
                    }
                }
            }
        }
    }

    let visitedAll = Array.from({length: level.rows}, () => Array(level.cols).fill(false));
    for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
            if (!visitedAll[r][c] && state.board[r][c] !== 'WALL') {
                let q = [{r, c}];
                visitedAll[r][c] = true;
                let region = [];
                let housesInRegion = [];

                while (q.length > 0) {
                    let curr = q.shift();
                    region.push(curr);
                    if (state.board[curr.r][curr.c] === 'HOUSE') {
                        housesInRegion.push(level.houses.find(h => h.r === curr.r && h.c === curr.c));
                    }

                    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for (let [dr, dc] of dirs) {
                        let nr = curr.r + dr, nc = curr.c + dc;
                        if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && !visitedAll[nr][nc] && state.board[nr][nc] !== 'WALL') {
                            visitedAll[nr][nc] = true;
                            q.push({r: nr, c: nc});
                        }
                    }
                }
                if (housesInRegion.length === 1) {
                    if (region.length < housesInRegion[0].size) {
                        region.forEach(cell => errors[cell.r][cell.c].small = true);
                        hasError = true;
                    } else if (region.length > housesInRegion[0].size) {
                        region.forEach(cell => errors[cell.r][cell.c].large = true);
                        hasError = true;
                    }
                }
            }
        }
    }
    return { errors, hasError };
}

function checkWinCondition() {
    const { hasError } = calculateErrors();
    if (hasError) return; 

    const level = LEVELS[state.levelId];
    let totalWalls = 0;
    let firstWall = null;
    let emptyWithoutHouse = false;
    let regionVisited = Array.from({length: level.rows}, () => Array(level.cols).fill(false));

    for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
            if (state.board[r][c] === 'WALL') {
                totalWalls++;
                if (!firstWall) firstWall = {r, c};
            } else if (!regionVisited[r][c]) {
                let q = [{r, c}];
                regionVisited[r][c] = true;
                let houseCount = 0;
                while (q.length > 0) {
                    let curr = q.shift();
                    if (state.board[curr.r][curr.c] === 'HOUSE') houseCount++;
                    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for (let [dr, dc] of dirs) {
                        let nr = curr.r + dr, nc = curr.c + dc;
                        if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && !regionVisited[nr][nc] && state.board[nr][nc] !== 'WALL') {
                            regionVisited[nr][nc] = true;
                            q.push({r: nr, c: nc});
                        }
                    }
                }
                if (houseCount !== 1) emptyWithoutHouse = true; 
            }
        }
    }
    if (emptyWithoutHouse) return;

    if (totalWalls > 0 && firstWall) {
        let visitedWalls = 0;
        let q = [firstWall];
        let wallVis = Array.from({length: level.rows}, () => Array(level.cols).fill(false));
        wallVis[firstWall.r][firstWall.c] = true;

        while (q.length > 0) {
            let curr = q.shift();
            visitedWalls++;
            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            for (let [dr, dc] of dirs) {
                let nr = curr.r + dr, nc = curr.c + dc;
                if (nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols && !wallVis[nr][nc] && state.board[nr][nc] === 'WALL') {
                    wallVis[nr][nc] = true;
                    q.push({r: nr, c: nc});
                }
            }
        }
        if (visitedWalls !== totalWalls) return; 
    }


    stopTimer();
    const finalSeconds = Math.floor((performance.now() - state.startTime + state.elapsedMsOffset) / 1000);
    
    let scores = JSON.parse(localStorage.getItem('nevenincs_scores') || '{"easy":[],"medium":[],"hard":[]}');
    scores[state.levelId].push({ name: state.playerName, time: finalSeconds });
    scores[state.levelId].sort((a, b) => a.time - b.time);
    localStorage.setItem('nevenincs_scores', JSON.stringify(scores));

    document.querySelector('.victory-player-name').innerText = state.playerName;
    document.querySelector('.victory-level-name').innerText = LEVELS[state.levelId].name;
    document.querySelector('.victory-time').innerText = formatTime(finalSeconds);
    
    switchMenu('victoryScreen');
}


function startTimer() {
    state.timerRunning = true;
    state.startTime = performance.now();
    requestAnimationFrame(updateTimer);
}

function stopTimer() {
    state.timerRunning = false;
    if (state.timerRequestId) {
        cancelAnimationFrame(state.timerRequestId);
    }
}

function updateTimer(timestamp) {
    if (!state.timerRunning) return;
    const currentMs = timestamp - state.startTime + state.elapsedMsOffset;
    const currentSeconds = Math.floor(currentMs / 1000);
    document.querySelector('.display-time').innerText = formatTime(currentSeconds);
    state.timerRequestId = requestAnimationFrame(updateTimer);
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function refreshSavedGamesList() {
    const selectEl = document.querySelector('select[name="savedGamesList"]');
    if (!selectEl) return;
    

    while (selectEl.options.length > 1) {
        selectEl.remove(1);
    }
    
    const saves = JSON.parse(localStorage.getItem('nevenincs_saves') || '[]');
    
    if (saves.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Nincs mentett játék";
        option.disabled = true;
        selectEl.appendChild(option);
    } else {
        saves.forEach((save, index) => {
            const option = document.createElement('option');
            option.value = index;
            const date = new Date(save.timestamp).toLocaleString('hu-HU');
            option.textContent = `${save.playerName} - ${LEVELS[save.levelId].name} (${formatTime(save.savedElapsedSeconds)}) - ${date}`;
            selectEl.appendChild(option);
        });
    }
}

function saveGame() {
    const currentSeconds = Math.floor((performance.now() - state.startTime + state.elapsedMsOffset) / 1000);
    

    let saves = JSON.parse(localStorage.getItem('nevenincs_saves') || '[]');
    

    const newSave = {
        playerName: state.playerName,
        levelId: state.levelId,
        board: state.board,
        savedElapsedSeconds: currentSeconds,
        timestamp: Date.now() 
    };

    saves.push(newSave);
    localStorage.setItem('nevenincs_saves', JSON.stringify(saves));
    
    showCustomMessage("Játékállás sikeresen elmentve!");
}

function loadGame() {
    const selectEl = document.querySelector('select[name="savedGamesList"]');
    const selectedIndex = selectEl.value;
    
    if (selectedIndex === "") {
        showCustomMessage("Kérlek, válassz ki egy mentést a betöltéshez!");
        return;
    }

    const saves = JSON.parse(localStorage.getItem('nevenincs_saves') || '[]');
    const data = saves[parseInt(selectedIndex, 10)];
    
    if (!data) {
        showCustomMessage("Hiba a mentés betöltésekor!");
        return;
    }

    state.playerName = data.playerName;
    state.levelId = data.levelId;
    state.board = data.board;
    state.elapsedMsOffset = data.savedElapsedSeconds * 1000; 
    
    setupGameScreen();
}

function showLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('nevenincs_scores') || '{"easy":[],"medium":[],"hard":[]}');
    let html = '';
    
    for (let levelKey in LEVELS) {
        html += `<h3>${LEVELS[levelKey].name} pálya</h3><ol>`;
        if (scores[levelKey].length === 0) {
            html += `<li>Még nincs befejezett játék.</li>`;
        } else {
            scores[levelKey].forEach(s => html += `<li>${s.name} - ${formatTime(s.time)}</li>`);
        }
        html += `</ol>`;
    }
    
    document.querySelector('.leaderboard-content').innerHTML = html;
    switchMenu('leaderboardScreen');
}