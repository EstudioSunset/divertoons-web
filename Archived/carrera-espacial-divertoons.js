document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.querySelector('.game-container');
    const characterSelection = document.querySelector('.character-selection');
    const gameArea = document.querySelector('.game-area');
    const player = document.getElementById('player');
    const obstacle = document.getElementById('obstacle');
    const scoreDisplay = document.getElementById('score');
    const timeDisplay = document.getElementById('time');
    const levelDisplay = document.getElementById('level');
    const gameOverScreen = document.querySelector('.game-over');
    const finalScoreDisplay = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const discountMessage = document.getElementById('discount-message');
    const discountCodeDisplay = document.getElementById('discount-code');
    const characters = document.querySelectorAll('.character');

    let gameInterval;
    let timerInterval;
    let score = 0;
    let time = 0;
    let level = 1;
    let isJumping = false;
    let obstacleSpeed = 1.5;
    let character = 'sun';

    function startGame() {
        characterSelection.classList.add('hidden');
        gameArea.classList.remove('hidden');
        player.classList.remove('sun-player', 'moon-player', 'cool-emoji-player');
        player.classList.add(`${character}-player`);
        score = 0;
        time = 0;
        level = 1;
        isJumping = false;
        obstacleSpeed = 1.5;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = time;
        levelDisplay.textContent = level;
        obstacle.classList.remove('obstacle-moving');
        obstacle.style.right = '-50px';
        discountMessage.classList.add('hidden');

        gameInterval = setInterval(updateGame, 20);
        timerInterval = setInterval(updateTimer, 1000);
        obstacle.style.animationDuration = `${obstacleSpeed}s`;
        obstacle.classList.add('obstacle-moving');
    }

    function updateGame() {
        if (isGameOver()) {
            endGame();
            return;
        }

        score++;
        scoreDisplay.textContent = score;

        if (score % 500 === 0 && level < 10) {
            level++;
            levelDisplay.textContent = level;
            obstacleSpeed *= 0.9; // Aumenta la velocidad
            obstacle.style.animationDuration = `${obstacleSpeed}s`;
        }
    }

    function updateTimer() {
        time++;
        timeDisplay.textContent = time;
    }

    function jump() {
        if (!isJumping) {
            isJumping = true;
            player.classList.add('jumping');
            setTimeout(() => {
                player.classList.remove('jumping');
                isJumping = false;
            }, 500);
        }
    }

    function isGameOver() {
        const playerRect = player.getBoundingClientRect();
        const obstacleRect = obstacle.getBoundingClientRect();

        return (
            playerRect.bottom > 285 &&
            playerRect.left < obstacleRect.right &&
            playerRect.right > obstacleRect.left
        );
    }

    function endGame() {
        clearInterval(gameInterval);
        clearInterval(timerInterval);
        gameArea.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.textContent = score;

        if (score > 3000) {
            discountMessage.classList.remove('hidden');
        }
    }

    restartButton.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        characterSelection.classList.remove('hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (gameArea.classList.contains('hidden')) return;
        if (e.code === 'Space') {
            jump();
        }
    });

    characters.forEach(char => {
        char.addEventListener('click', function() {
            character = this.id;
            startGame();
        });
    });
});