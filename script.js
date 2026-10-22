const games = [
  { id: 'bubble-blitz', title: 'Bubble Blitz', category: 'Tap games', mode: 'tap', emoji: '🫧', tagline: 'Dive in, pop sea life, and meet new targets.' },
  { id: 'reflex-rally', title: 'Reflex Rally', category: 'Reflex', mode: 'reaction', emoji: '⚡', tagline: 'Wait for green. Trust your reflexes.' },
  { id: 'number-ninja', title: 'Number Ninja', category: 'Brain teasers', mode: 'math', emoji: '🧠', tagline: 'Slice through a streak of quick sums.' },
  { id: 'pattern-party', title: 'Pattern Party', category: 'Memory', mode: 'memory', emoji: '🎨', tagline: 'Watch the lights. Repeat the sequence.' },
  { id: 'word-scramble', title: 'Word Scramble', category: 'Word play', mode: 'typing', emoji: '🔤', tagline: 'Unscramble a word before time runs out.' }
];

const grid = document.getElementById('gameGrid');
const filters = document.getElementById('filters');
const search = document.getElementById('search');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const modal = document.getElementById('gameModal');
const stage = document.getElementById('gameStage');
const title = document.getElementById('gameTitle');
const categoryLabel = document.getElementById('gameCategory');
const instructions = document.getElementById('gameInstructions');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('gameTimer');
const status = document.getElementById('gameStatus');

let activeFilter = 'All games';
let currentGame = null;
let score = 0;
let timeLeft = 20;
let timerId = null;
let reactionTimeout = null;
let reactionReady = false;
let reactionStarted = 0;
let memorySequence = [];
let memoryInput = [];
let memoryLocked = false;
let gameOver = false;
let currentWord = null;
let round = 0;
let streak = 0;
let hinted = false;
let gameTimeouts = [];

const filterNames = ['All games', ...games.map(game => game.category)];
filters.innerHTML = filterNames.map((name, index) =>
  `<button class="filter-button${index === 0 ? ' active' : ''}" type="button" data-filter="${name}">${index === 0 ? '✦ ' : ''}${name}</button>`
).join('');

function renderGames() {
  const query = search.value.trim().toLowerCase();
  const visibleGames = games.filter(game => {
    const matchesCategory = activeFilter === 'All games' || game.category === activeFilter;
    return matchesCategory && `${game.title} ${game.category} ${game.tagline}`.toLowerCase().includes(query);
  });
  grid.innerHTML = visibleGames.map(game => `
    <button class="game-card" type="button" data-game="${game.id}" aria-label="Play ${game.title}">
      <div class="card-top"><span class="game-icon">${game.emoji}</span><span class="game-category">${game.category}</span></div>
      <h3>${game.title}</h3><p>${game.tagline}</p><span class="card-arrow" aria-hidden="true">↗</span>
    </button>`).join('');
  resultCount.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'game' : 'games'}`;
  emptyState.hidden = visibleGames.length !== 0;
}

function setScore(value) {
  score = value;
  scoreDisplay.textContent = score;
}
function setStatus(message) { status.textContent = message; }
function setStage(markup) {
  stage.classList.remove('underwater-stage');
  stage.innerHTML = markup;
}
function scheduleGameTimeout(callback, delay) {
  const id = setTimeout(() => {
    gameTimeouts = gameTimeouts.filter(timeout => timeout !== id);
    callback();
  }, delay);
  gameTimeouts.push(id);
  return id;
}
function clearGameTimeouts() {
  gameTimeouts.forEach(clearTimeout);
  gameTimeouts = [];
}
function stopGameClocks() {
  clearInterval(timerId);
  clearTimeout(reactionTimeout);
  clearGameTimeouts();
}
function setTimer(seconds) {
  timeLeft = seconds;
  timerDisplay.innerHTML = `⏱ <strong>${timeLeft}</strong>s`;
  clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft -= 1;
    timerDisplay.innerHTML = `⏱ <strong>${timeLeft}</strong>s`;
    if (timeLeft <= 0) finishGame();
  }, 1000);
}

function openGame(game) {
  currentGame = game;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  startGame();
  document.getElementById('closeModal').focus();
}
function closeGame() {
  stopGameClocks();
  gameOver = true;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function startGame() {
  if (!currentGame) return;
  stopGameClocks();
  gameOver = false;
  reactionReady = false;
  memorySequence = [];
  memoryInput = [];
  memoryLocked = false;
  round = 0;
  streak = 0;
  hinted = false;
  setScore(0);
  title.textContent = currentGame.title;
  categoryLabel.textContent = currentGame.category;
  const copy = {
    tap: 'Dive into the reef! Pop the glowing sea creature, dodge decoys, and discover a new target after every three correct pops.',
    reaction: 'Wait for green, then tap as fast as you can. Jump early and you’ll lose a point.',
    math: 'Solve each changing challenge. Correct answers build your streak and earn bonus points.',
    memory: 'Watch the color sequence, then repeat it. Each perfect round adds another light.',
    typing: 'Unscramble the letters into a real word. Hints help, but a clean solve scores more.'
  };
  instructions.textContent = copy[currentGame.mode];
  setStatus('Ready when you are.');

  if (currentGame.mode === 'tap') {
    bubbleTargetType = 0;
    bubbleHits = 0;
    setTimer(30);
    renderBubbleBoard();
  } else if (currentGame.mode === 'reaction') {
    setTimer(25);
    showReactionWait();
  } else if (currentGame.mode === 'math') {
    setTimer(30);
    nextMathQuestion();
  } else if (currentGame.mode === 'memory') {
    setTimer(45);
    setStage('<div class="big-prompt">Ready?</div><p class="subtle">The sequence gets longer every round.</p><button class="play-button" type="button" id="memoryStart">Start the pattern</button>');
    stage.querySelector('#memoryStart').addEventListener('click', nextMemoryRound);
  } else {
    setTimer(40);
    nextWord();
  }
}
function finishGame() {
  if (gameOver) return;
  gameOver = true;
  stopGameClocks();
  setStatus('Round complete — fancy another?');
  setStage(`<div class="big-prompt">${score}<span style="font-size:16px;color:#aaa"> points</span></div><div class="result-message">${score >= 50 ? 'Brilliant run! ✨' : score > 0 ? 'Lovely playing! ✨' : 'Warm-up complete! ✨'}</div><button class="play-button" type="button" id="playAgain">Play again</button>`);
  stage.querySelector('#playAgain').addEventListener('click', startGame);
}

const bubbleIcons = ['🐠', '🐚', '🪼', '🐢', '🦀', '🐙', '🪸', '🐡', '🫧'];
const bubbleTargets = [
  { emoji: '🐠', name: 'clownfish' }, { emoji: '🐚', name: 'seashell' },
  { emoji: '🪼', name: 'jellyfish' }, { emoji: '🐢', name: 'sea turtle' },
  { emoji: '🦀', name: 'crab' }
];
let bubbleTarget = 0;
let bubbleTargetType = 0;
let bubbleHits = 0;
function renderBubbleBoard() {
  bubbleTarget = Math.floor(Math.random() * 9);
  const target = bubbleTargets[bubbleTargetType];
  const bubbles = bubbleIcons.map((icon, index) => {
    const isTarget = index === bubbleTarget;
    return `<button type="button" class="bubble-button${isTarget ? ' bubble-target' : ''}" data-bubble="${index}" aria-label="${isTarget ? `Pop the ${target.name}` : 'Sea-life decoy'}">${isTarget ? target.emoji : icon}</button>`;
  }).join('');
  setStage(`<div class="bubble-board">${bubbles}</div><span class="subtle">Streak: ${streak} · Find: ${target.emoji} ${target.name} · ${3 - (bubbleHits % 3)} to next sea friend</span>`);
  stage.classList.add('underwater-stage');
  stage.querySelectorAll('.bubble-button').forEach(button => button.addEventListener('click', () => {
    if (gameOver) return;
    if (Number(button.dataset.bubble) === bubbleTarget) {
      streak += 1;
      bubbleHits += 1;
      setScore(score + 10 + Math.min(streak - 1, 5) * 2);
      if (bubbleHits % 3 === 0) {
        bubbleTargetType = (bubbleTargetType + 1) % bubbleTargets.length;
        setStatus(`Three pops! A new sea friend is your target: ${bubbleTargets[bubbleTargetType].emoji}`);
      } else {
        setStatus(streak > 2 ? `${streak} in a row — lovely popping!` : 'Nice catch! Find the glowing sea friend.');
      }
    } else {
      streak = 0;
      setScore(Math.max(0, score - 5));
      setStatus('Oops, decoy! Your streak reset.');
    }
    renderBubbleBoard();
  }));
}

function showReactionWait() {
  reactionReady = false;
  setStage('<button class="reaction-pad" id="reactionButton" type="button">Wait for green…</button><span class="subtle">Your best is the one that counts.</span>');
  const button = stage.querySelector('#reactionButton');
  button.addEventListener('click', () => {
    if (gameOver) return;
    if (!reactionReady) {
      setScore(Math.max(0, score - 1));
      setStatus('Too soon! A point gone — steady now.');
      button.disabled = true;
      button.textContent = 'False start!';
      clearTimeout(reactionTimeout);
      reactionTimeout = setTimeout(showReactionWait, 700);
      return;
    }
    const reaction = Math.round(performance.now() - reactionStarted);
    setScore(score + Math.max(1, Math.round(1000 / reaction)));
    setStatus(`${reaction} ms — great reflexes! Wait for the next signal.`);
    showReactionWait();
  });
  reactionTimeout = setTimeout(() => {
    if (gameOver || !button.isConnected) return;
    reactionReady = true;
    reactionStarted = performance.now();
    button.classList.add('reaction-go');
    button.textContent = 'GO!';
  }, 900 + Math.random() * 2100);
}

function nextMathQuestion() {
  const difficulty = Math.min(2, Math.floor(score / 50));
  const max = difficulty === 0 ? 12 : difficulty === 1 ? 25 : 40;
  const operators = difficulty === 0 ? ['+', '−'] : ['+', '−', '×'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  let a = Math.floor(Math.random() * max) + 2;
  let b = Math.floor(Math.random() * max) + 2;
  if (operator === '−' && b > a) [a, b] = [b, a];
  if (operator === '×') { a = Math.floor(Math.random() * 12) + 2; b = Math.floor(Math.random() * 9) + 2; }
  const answer = operator === '+' ? a + b : operator === '−' ? a - b : a * b;
  setStage(`<span class="subtle">STREAK ${streak} · ${difficulty === 0 ? 'WARM UP' : difficulty === 1 ? 'LEVEL UP' : 'NINJA MODE'}</span><div class="big-prompt">${a} ${operator} ${b} = ?</div><form class="answer-row" id="mathForm"><input id="mathAnswer" type="number" inputmode="numeric" placeholder="Your answer" aria-label="Your answer" autocomplete="off"><button class="answer-button" type="submit">Check</button></form>`);
  const input = stage.querySelector('#mathAnswer');
  stage.querySelector('#mathForm').addEventListener('submit', event => {
    event.preventDefault();
    if (gameOver) return;
    if (input.value !== '' && Number(input.value) === answer) {
      streak += 1;
      setScore(score + 10 + Math.min(streak - 1, 4) * 2);
      setStatus(streak > 2 ? `${streak} correct in a row!` : 'Correct! Next one…');
      nextMathQuestion();
    } else {
      streak = 0;
      setScore(Math.max(0, score - 2));
      setStatus(`Not quite — the answer was ${answer}. Reset and go again!`);
      nextMathQuestion();
    }
  });
  input.focus();
}

const memoryColors = [
  { emoji: '🟣', color: '#7962d8' }, { emoji: '🟢', color: '#3f9d79' },
  { emoji: '🟠', color: '#c9793d' }, { emoji: '🔵', color: '#4789c7' }
];
function nextMemoryRound() {
  if (gameOver) return;
  round += 1;
  memorySequence.push(Math.floor(Math.random() * memoryColors.length));
  memoryInput = [];
  memoryLocked = true;
  setStatus('Watch carefully…');
  renderMemoryButtons();
  const buttons = [...stage.querySelectorAll('.memory-button')];
  let index = 0;
  const flashNext = () => {
    if (gameOver) return;
    if (index >= memorySequence.length) {
      memoryLocked = false;
      setStatus('Your turn — repeat the pattern!');
      return;
    }
    const button = buttons[memorySequence[index]];
    button.classList.add('lit');
    scheduleGameTimeout(() => {
      button.classList.remove('lit');
      index += 1;
      scheduleGameTimeout(flashNext, 220);
    }, 430);
  };
  scheduleGameTimeout(flashNext, 350);
}
function renderMemoryButtons() {
  setStage(`<div class="choice-row">${memoryColors.map((item, index) => `<button type="button" class="memory-button" data-color="${index}" style="background:${item.color}" aria-label="Color ${index + 1}">${item.emoji}</button>`).join('')}</div><span class="subtle">ROUND ${round} · ${memorySequence.length} ${memorySequence.length === 1 ? 'light' : 'lights'}</span>`);
  stage.querySelectorAll('.memory-button').forEach(button => button.addEventListener('click', () => {
    if (memoryLocked || gameOver) return;
    const picked = Number(button.dataset.color);
    const position = memoryInput.length;
    if (picked !== memorySequence[position]) {
      finishGame();
      setStatus(`Pattern missed on round ${round}. Lovely effort!`);
      return;
    }
    memoryInput.push(picked);
    if (memoryInput.length === memorySequence.length) {
      setScore(score + round * 10);
      setStatus(`Perfect round ${round}! Here comes a longer one.`);
      memoryLocked = true;
      scheduleGameTimeout(nextMemoryRound, 700);
    }
  }));
}

const wordBank = [
  { word: 'SUNSHINE', clue: 'A bright, sunny day' }, { word: 'GALAXY', clue: 'A vast collection of stars' },
  { word: 'WAFFLE', clue: 'A breakfast treat with little squares' }, { word: 'RAINBOW', clue: 'Colorful arc after rain' },
  { word: 'AVOCADO', clue: 'Green fruit often mashed on toast' }, { word: 'POPCORN', clue: 'A crunchy movie snack' },
  { word: 'CUPCAKE', clue: 'A tiny frosted cake' }, { word: 'PINEAPPLE', clue: 'A spiky tropical fruit' },
  { word: 'JELLYFISH', clue: 'A drifting sea creature' }, { word: 'MOONBEAM', clue: 'A ray of light from the night sky' },
  { word: 'BUTTERFLY', clue: 'A colorful insect with wings' }, { word: 'PUDDING', clue: 'A soft, sweet dessert' }
];
function scrambleWord(word) {
  let scrambled = word;
  for (let attempt = 0; attempt < 12 && scrambled === word; attempt += 1) {
    scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
  }
  if (scrambled === word) scrambled = word.slice(1) + word[0];
  return scrambled;
}
function nextWord() {
  const options = wordBank.filter(item => !currentWord || item.word !== currentWord.word);
  currentWord = options[Math.floor(Math.random() * options.length)];
  hinted = false;
  const scrambled = scrambleWord(currentWord.word);
  setStage(`<span class="subtle">WORD ${round + 1} · ${currentWord.word.length} LETTERS</span><div class="word-prompt scramble-prompt" aria-label="Scrambled letters">${scrambled.split('').join(' ')}</div><form class="answer-row" id="wordForm"><input class="type-input" id="wordAnswer" type="text" placeholder="Unscramble it…" aria-label="Unscrambled word" autocomplete="off" autocapitalize="characters"><button class="answer-button" type="submit">Solve</button></form><div class="word-tools"><button class="hint-button" type="button" id="wordHint">Need a hint?</button><span class="subtle" id="wordClue" aria-live="polite"></span></div>`);
  const input = stage.querySelector('#wordAnswer');
  stage.querySelector('#wordHint').addEventListener('click', () => {
    if (gameOver || hinted) return;
    hinted = true;
    setScore(Math.max(0, score - 3));
    stage.querySelector('#wordClue').textContent = currentWord.clue;
    setStatus('Hint used — solve it for 7 points.');
  });
  stage.querySelector('#wordForm').addEventListener('submit', event => {
    event.preventDefault();
    if (gameOver) return;
    if (input.value.trim().toUpperCase() === currentWord.word) {
      round += 1;
      streak += 1;
      const points = (hinted ? 7 : 12) + Math.min(streak - 1, 3) * 2;
      setScore(score + points);
      setStatus(streak > 2 ? `${streak} solved in a row — word wizard!` : 'Solved! Here comes another.');
      nextWord();
    } else {
      streak = 0;
      setStatus('Not quite — rearrange those letters and try again.');
      input.value = '';
      input.focus();
    }
  });
  input.focus();
}

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  filters.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('active', item === button));
  renderGames();
});
search.addEventListener('input', renderGames);
grid.addEventListener('click', event => {
  const card = event.target.closest('[data-game]');
  if (card) openGame(games.find(game => game.id === card.dataset.game));
});
document.getElementById('randomGame').addEventListener('click', () => openGame(games[Math.floor(Math.random() * games.length)]));
document.getElementById('closeModal').addEventListener('click', closeGame);
modal.addEventListener('click', event => { if (event.target.hasAttribute('data-close')) closeGame(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal.classList.contains('open')) closeGame();
  if (event.key === '/' && !modal.classList.contains('open') && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});

renderGames();
