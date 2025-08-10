(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next').getContext('2d');
  const holdCanvas = document.getElementById('hold').getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  const COLS = 10,
    ROWS = 20;
  const BLOCK = Math.floor(canvas.width / COLS); // size per block
  const COLORS = {
    I: '#4ade80',
    O: '#f97316',
    T: '#60a5fa',
    S: '#34d399',
    Z: '#f87171',
    J: '#c084fc',
    L: '#eab308',
  };

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  };

  function rotate(matrix) {
    const N = matrix.length;
    const res = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) res[c][N - 1 - r] = matrix[r][c];
    return res;
  }

  function makePiece(type) {
    const shape = SHAPES[type].map((row) => row.slice());
    // make into square matrix
    const N = Math.max(shape.length, shape[0].length);
    const square = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) square[r][c] = shape[r][c];
    return { type, matrix: square, color: COLORS[type] };
  }

  function rndPiece() {
    // bag of 7 system
    if (!game.bag || game.bag.length === 0) {
      game.bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      // shuffle
      for (let i = game.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
      }
    }
    return makePiece(game.bag.pop());
  }

  function createMatrix(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  const game = {
    grid: createMatrix(COLS, ROWS),
    pos: { x: 3, y: 0 },
    cur: null,
    next: null,
    hold: null,
    bag: [],
    canHold: true,
    score: 0,
    lines: 0,
    level: 0,
    dropInterval: 1000,
    dropTimer: 0,
    lastTime: 0,
    running: false,
    paused: false,
  };

  function resetGame() {
    game.grid = createMatrix(COLS, ROWS);
    game.bag = [];
    game.cur = rndPiece();
    game.next = rndPiece();
    game.hold = null;
    game.pos = {
      x: Math.floor((COLS - game.cur.matrix[0].length) / 2),
      y: 0,
    };
    game.score = 0;
    game.lines = 0;
    game.level = 0;
    game.dropInterval = 1000;
    game.canHold = true;
    updateHUD();
    drawAll();
  }

  function collide(grid, piece, pos) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          const x = pos.x + c,
            y = pos.y + r;
          if (x < 0 || x >= COLS || y >= ROWS) return true;
          if (y >= 0 && grid[y][x]) return true;
        }
      }
    }
    return false;
  }

  function merge(grid, piece, pos) {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++)
        if (m[r][c] && pos.y + r >= 0) grid[pos.y + r][pos.x + c] = piece.color;
  }

  function clearLines() {
    let lines = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (gridRowFull(game.grid[r])) {
        game.grid.splice(r, 1);
        game.grid.unshift(Array(COLS).fill(0));
        lines++;
        r++; // re-check same index after splice
      }
    }
    if (lines > 0) {
      const points = [0, 40, 100, 300, 1200];
      game.score += (points[lines] || 0) * (game.level + 1);
      game.lines += lines;
      game.level = Math.floor(game.lines / 10);
      game.dropInterval = Math.max(100, 1000 - game.level * 75);
      updateHUD();
    }
  }

  function gridRowFull(row) {
    return row.every((cell) => cell !== 0);
  }

  function playerDrop() {
    game.pos.y++;
    if (collide(game.grid, game.cur, game.pos)) {
      game.pos.y--;
      merge(game.grid, game.cur, game.pos);
      // spawn next
      game.cur = game.next;
      game.next = rndPiece();
      game.pos = {
        x: Math.floor((COLS - game.cur.matrix[0].length) / 2),
        y: 0,
      };
      game.canHold = true;
      clearLines();
      if (collide(game.grid, game.cur, game.pos)) {
        // Game over
        game.running = false;
        alert('Game Over — Score: ' + game.score);
      }
    }
  }

  function hardDrop() {
    while (!collide(game.grid, game.cur, { x: game.pos.x, y: game.pos.y + 1 }))
      game.pos.y++;
    merge(game.grid, game.cur, game.pos);
    game.score += 2;
    game.cur = game.next;
    game.next = rndPiece();
    game.pos = {
      x: Math.floor((COLS - game.cur.matrix[0].length) / 2),
      y: 0,
    };
    game.canHold = true;
    clearLines();
    if (collide(game.grid, game.cur, game.pos)) {
      game.running = false;
      alert('Game Over — Score: ' + game.score);
    }
  }

  function rotatePlayer(dir) {
    const old = game.cur.matrix;
    const rotated = rotate(old);
    // try wall kicks (simple)
    const origX = game.pos.x;
    for (let shift of [0, -1, 1, -2, 2]) {
      game.cur.matrix = rotated;
      game.pos.x = origX + shift;
      if (!collide(game.grid, game.cur, game.pos)) return true;
    }
    game.cur.matrix = old;
    game.pos.x = origX;
    return false;
  }

  function hold() {
    if (!game.canHold) return;
    if (!game.hold) {
      game.hold = {
        type: game.cur.type,
        matrix: game.cur.matrix,
        color: game.cur.color,
      };
      game.cur = game.next;
      game.next = rndPiece();
    } else {
      const tmp = game.cur;
      game.cur = makePiece(game.hold.type);
      game.hold = {
        type: tmp.type,
        matrix: tmp.matrix,
        color: tmp.color,
      };
    }
    game.pos = {
      x: Math.floor((COLS - game.cur.matrix[0].length) / 2),
      y: 0,
    };
    game.canHold = false;
  }

  function move(dir) {
    game.pos.x += dir;
    if (collide(game.grid, game.cur, game.pos)) game.pos.x -= dir;
  }

  function updateHUD() {
    scoreEl.textContent = game.score;
    linesEl.textContent = game.lines;
    levelEl.textContent = game.level;
    drawMini(nextCanvas, game.next);
    drawMini(holdCanvas, game.hold);
  }

  function drawMini(ctx, piece) {
    ctx.clearRect(0, 0, 120, 120);
    ctx.save();
    ctx.scale(12, 12);
    ctx.translate(1, 1);
    if (!piece) return;
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++)
        if (m[r][c]) {
          drawBlock(ctx, c, r, piece.color, 1);
        }
    ctx.restore();
  }

  function drawBlock(ctxLocal, x, y, color, scale = BLOCK) {
    // ctxLocal might be 2d ctx scaled differently
    if (ctxLocal === ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.strokeRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
    } else {
      ctxLocal.fillStyle = color;
      ctxLocal.fillRect(x, y, 1 - 0.04, 1 - 0.04);
    }
  }

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r][c];
        if (cell) {
          ctx.fillStyle = cell;
          ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK - 1, BLOCK - 1);
        } else {
          // optional faint grid
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK - 0.6, BLOCK - 0.6);
        }
      }
    }
    // draw current piece
    const m = game.cur.matrix;
    for (let r = 0; r < m.length; r++)
      for (let c = 0; c < m[r].length; c++)
        if (m[r][c]) {
          const x = game.pos.x + c,
            y = game.pos.y + r;
          if (y >= 0) {
            ctx.fillStyle = game.cur.color;
            ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
          }
        }
  }

  // input
  document.addEventListener('keydown', (e) => {
    if (!game.running) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
      drawAll();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
      drawAll();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      playerDrop();
      game.score++;
      updateHUD();
      drawAll();
    } else if (e.code === 'Space') {
      e.preventDefault();
      hardDrop();
      updateHUD();
      drawAll();
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      rotatePlayer(-1);
      drawAll();
    } else if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      rotatePlayer(1);
      drawAll();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      hold();
      updateHUD();
      drawAll();
    }
  });

  // touch / buttons
  startBtn.addEventListener('click', () => {
    game.running = true;
    resetGame();
    last = performance.now();
    loop(last);
  });
  pauseBtn.addEventListener('click', () => {
    game.paused = !game.paused;
    pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
    if (!game.paused) {
      game.lastTime = performance.now();
      loop(game.lastTime);
    }
  });

  // main loop
  function loop(time) {
    if (!game.running || game.paused) return;
    const delta = time - (game.lastTime || time);
    game.lastTime = time;
    game.dropTimer += delta;
    if (game.dropTimer > game.dropInterval) {
      playerDrop();
      game.dropTimer = 0;
      updateHUD();
    }
    drawAll();
    requestAnimationFrame(loop);
  }

  // start with a ready screen
  function readyScreen() {
    ctx.fillStyle = '#07122a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#89c9f6';
    ctx.font = '20px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Press Start to Play',
      canvas.width / 2,
      canvas.height / 2 - 10
    );
  }

  // init
  resetGame();
  readyScreen();
})();
