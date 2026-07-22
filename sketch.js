// ============================================================
// Multi-Level Blob Fighter with Bottom Screen Controls
// ============================================================

// --- Game States ---
const STATE_START = "start";
const STATE_FIGHT = "fight";
const STATE_WIN = "win";

let gameState = STATE_START;
let winner = null;
let currentLevel = 1;
const MAX_LEVELS = 3;

// --- Timer Settings ---
let matchTimer = 60; // 60-second timer per round
let lastTimerCheck = 0;

// --- Sound & Image Assets ---
let punchSound, winSound, bgMusic;
let startBgImg, fightBgImg;

// --- Global Entities ---
let fighter1, fighter2;
let platforms = [];

// Physics Constant
const GRAVITY = 0.55;

// Level Palette Definitions
const LEVEL_PALETTES = {
  1: { p1: [0, 200, 180], p2: [255, 150, 30] }, // Cyan vs Orange
  2: { p1: [50, 230, 80], p2: [220, 40, 200] }, // Neon Green vs Magenta
  3: { p1: [255, 215, 0], p2: [130, 50, 240] }, // Gold vs Purple
};

// ============================================================
// FIGHTER CLASS
// ============================================================
class Fighter {
  constructor(x, y, controls, label) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;

    // Mechanics & Physics
    this.vx = 0;
    this.vy = 0;
    this.speed = 0.65;
    this.maxSpeed = 4.2;
    this.jumpForce = -11.5;
    this.friction = 0.82;
    this.r = 24;
    this.onGround = false;

    // Visuals
    this.label = label;
    this.blobT = random(100);
    this.colour = color(255);

    // Controls mapping
    this.controls = controls;

    // Stats
    this.maxHealth = 3;
    this.health = 3;

    // Combat states
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 16;
    this.attackCooldown = 0;
    this.punchReach = 45;
    this.punchDir = 1;

    this.isBlocking = false;
    this.hitFlash = 0;
    this.hitLanded = false;
  }

  resetPosition() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.isAttacking = false;
    this.hitLanded = false;
  }

  updateColor(c) {
    this.colour = c;
  }

  update() {
    if (gameState !== STATE_FIGHT) return;

    this.handleInput();
    this.applyPhysics();

    if (this.isAttacking) {
      this.attackTimer--;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hitLanded = false;
        this.attackCooldown = 18;
      }
    }

    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.hitFlash > 0) this.hitFlash--;
  }

  handleInput() {
    // Horizontal Movement
    if (keyIsDown(this.controls.left)) this.vx -= this.speed;
    if (keyIsDown(this.controls.right)) this.vx += this.speed;

    this.vx = constrain(this.vx, -this.maxSpeed, this.maxSpeed);

    if (!keyIsDown(this.controls.left) && !keyIsDown(this.controls.right)) {
      this.vx *= this.friction;
    }

    // Jumping
    if (keyIsDown(this.controls.jump) && this.onGround) {
      this.vy = this.jumpForce;
      this.onGround = false;
    }

    // Shield / Blocking
    this.isBlocking = keyIsDown(this.controls.block);
  }

  applyPhysics() {
    // Apply Gravity
    this.vy += GRAVITY;

    this.x += this.vx;
    this.y += this.vy;

    // Horizontal Stage Boundaries
    this.x = constrain(this.x, this.r, width - this.r);

    // Fall Out-of-Bounds Reset
    if (this.y > height + 80) {
      this.takeHit();
      this.resetPosition();
    }

    this.onGround = false;
  }

  startAttack(targetX) {
    if (this.isAttacking || this.attackCooldown > 0) return;

    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.hitLanded = false;
    this.punchDir = targetX > this.x ? 1 : -1;

    if (punchSound && punchSound.isLoaded()) punchSound.play();
  }

  getPunchX() {
    return this.x + this.punchDir * this.punchReach;
  }

  takeHit() {
    if (this.isBlocking) return;

    this.health--;
    this.hitFlash = 12;

    if (this.health <= 0) {
      this.health = 0;
      handleKnockout(this.label === "P1" ? "P2" : "P1");
    }
  }

  draw() {
    push();

    // Shield Aura
    if (this.isBlocking) {
      noFill();
      stroke(255, 255, 255, 180);
      strokeWeight(3);
      ellipse(this.x, this.y, (this.r + 12) * 2, (this.r + 12) * 2);
    }

    // Fist / Shoot Projection
    if (this.isAttacking) {
      fill(this.hitFlash > 0 ? color(255) : this.colour);
      noStroke();
      ellipse(this.getPunchX(), this.y, 18, 18);
    }

    // Blob Mesh Body
    fill(this.hitFlash > 0 ? color(255) : this.colour);
    noStroke();

    beginShape();
    let numPoints = 36;
    for (let i = 0; i < numPoints; i++) {
      let angle = (TWO_PI / numPoints) * i;
      let noiseVal = noise(
        cos(angle) * 0.8 + this.blobT,
        sin(angle) * 0.8 + this.blobT,
      );
      let r = this.r + map(noiseVal, 0, 1, -5, 5);
      vertex(this.x + cos(angle) * r, this.y + sin(angle) * r);
    }
    endShape(CLOSE);

    // Eyes
    fill(10);
    ellipse(this.x - 7, this.y - 5, 6, 6);
    ellipse(this.x + 7, this.y - 5, 6, 6);

    pop();

    this.blobT += 0.015;
  }
}

// ============================================================
// PRELOAD & SETUP
// ============================================================
function preload() {
  try {
    punchSound = loadSound("assets/sounds/sound_effect_action.mp3");
    winSound = loadSound("assets/sounds/sound_effect_change_state.mp3");
    bgMusic = loadSound("assets/sounds/background_music.mp3");

    startBgImg = loadImage("assets/images/first_scene_background.jpeg");
    fightBgImg = loadImage("assets/images/second_scene_background.jpeg");
  } catch (e) {
    console.log("Assets missing - running with procedural graphics.");
  }
}

function setup() {
  createCanvas(800, 450);

  // Control keys: P1 (WASD, F, G) | P2 (Arrows, K, L)
  fighter1 = new Fighter(
    100,
    300,
    { left: 65, right: 68, jump: 87, attack: 70, block: 71 },
    "P1",
  );

  fighter2 = new Fighter(
    700,
    300,
    {
      left: LEFT_ARROW,
      right: RIGHT_ARROW,
      jump: UP_ARROW,
      attack: 75,
      block: 76,
    },
    "P2",
  );

  loadLevel(1);
}

// ============================================================
// LEVEL & STAGE SETUP
// ============================================================
function loadLevel(lvl) {
  currentLevel = lvl;
  matchTimer = 60;
  lastTimerCheck = millis();

  // Color dynamic assignment
  let pal = LEVEL_PALETTES[currentLevel];
  fighter1.updateColor(color(pal.p1[0], pal.p1[1], pal.p1[2]));
  fighter2.updateColor(color(pal.p2[0], pal.p2[1], pal.p2[2]));

  fighter1.resetPosition();
  fighter2.resetPosition();

  // Color-coded Obstacles & Moving Platforms per level layout
  if (currentLevel === 1) {
    platforms = [
      { x: 0, y: 380, w: 800, h: 35, owner: "neutral" },
      { x: 80, y: 290, w: 160, h: 16, owner: "P1" },
      { x: 560, y: 290, w: 160, h: 16, owner: "P2" },
      { x: 320, y: 200, w: 160, h: 16, owner: "neutral" },
    ];
  } else if (currentLevel === 2) {
    platforms = [
      { x: 0, y: 380, w: 260, h: 35, owner: "P1" },
      { x: 540, y: 380, w: 260, h: 35, owner: "P2" },
      { x: 280, y: 300, w: 240, h: 16, owner: "neutral" },
      {
        x: 100,
        y: 200,
        w: 130,
        h: 16,
        owner: "P1",
        isMoving: true,
        speed: 2.5,
        minX: 80,
        maxX: 300,
      },
      {
        x: 570,
        y: 200,
        w: 130,
        h: 16,
        owner: "P2",
        isMoving: true,
        speed: -2.5,
        minX: 470,
        maxX: 690,
      },
    ];
  } else if (currentLevel === 3) {
    platforms = [
      { x: 0, y: 380, w: 800, h: 35, owner: "neutral" },
      { x: 60, y: 300, w: 120, h: 16, owner: "P1" },
      { x: 620, y: 300, w: 120, h: 16, owner: "P2" },
      {
        x: 220,
        y: 220,
        w: 120,
        h: 16,
        owner: "P1",
        isMoving: true,
        speed: 3,
        minX: 200,
        maxX: 480,
      },
      {
        x: 460,
        y: 150,
        w: 120,
        h: 16,
        owner: "P2",
        isMoving: true,
        speed: -3,
        minX: 200,
        maxX: 480,
      },
      { x: 340, y: 90, w: 120, h: 16, owner: "neutral" },
    ];
  }
}

// ============================================================
// MAIN LOOP
// ============================================================
function draw() {
  if (gameState === STATE_START) {
    drawStartScreen();
  } else if (gameState === STATE_FIGHT) {
    if (fightBgImg) image(fightBgImg, 0, 0, width, height);
    else background(25);

    updateMatchTimer();
    updateMovingPlatforms();
    resolvePlatformCollisions(fighter1);
    resolvePlatformCollisions(fighter2);

    fighter1.update();
    fighter2.update();

    checkHits();

    drawPlatforms();
    fighter1.draw();
    fighter2.draw();
    drawHUD();
    drawBottomControls(); // Renders keyboard commands at bottom of screen
  } else if (gameState === STATE_WIN) {
    drawWinScreen();
  }
}

// ============================================================
// LOGIC & TIMERS
// ============================================================
function updateMatchTimer() {
  if (millis() - lastTimerCheck >= 1000) {
    matchTimer--;
    lastTimerCheck = millis();

    if (matchTimer <= 0) {
      matchTimer = 60;
      fighter1.resetPosition();
      fighter2.resetPosition();
    }
  }
}

function handleKnockout(victorLabel) {
  if (currentLevel < MAX_LEVELS) {
    loadLevel(currentLevel + 1);
  } else {
    gameState = STATE_WIN;
    winner = victorLabel;
    if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
    if (winSound && winSound.isLoaded()) winSound.play();
  }
}

function updateMovingPlatforms() {
  for (let p of platforms) {
    if (p.isMoving) {
      p.x += p.speed;
      if (p.x >= p.maxX || p.x <= p.minX) {
        p.speed *= -1;
      }
    }
  }
}

function resolvePlatformCollisions(f) {
  for (let p of platforms) {
    let fLeft = f.x - f.r;
    let fRight = f.x + f.r;
    let fBottom = f.y + f.r;

    let overlapsX = fRight > p.x && fLeft < p.x + p.w;
    let landingOnTop = f.vy >= 0 && fBottom >= p.y && fBottom <= p.y + 16;

    if (overlapsX && landingOnTop) {
      f.y = p.y - f.r;
      f.vy = 0;
      f.onGround = true;

      if (p.isMoving) {
        f.x += p.speed;
        f.x = constrain(f.x, f.r, width - f.r);
      }
    }
  }
}

function checkHits() {
  if (fighter1.isAttacking && !fighter1.hitLanded) {
    let fistX = fighter1.getPunchX();
    if (dist(fistX, fighter1.y, fighter2.x, fighter2.y) < fighter2.r + 12) {
      fighter2.takeHit();
      fighter1.hitLanded = true;
    }
  }

  if (fighter2.isAttacking && !fighter2.hitLanded) {
    let fistX = fighter2.getPunchX();
    if (dist(fistX, fighter2.y, fighter1.x, fighter1.y) < fighter1.r + 12) {
      fighter1.takeHit();
      fighter2.hitLanded = true;
    }
  }
}

// ============================================================
// DRAWING HELPERS
// ============================================================
function drawPlatforms() {
  noStroke();
  let pal = LEVEL_PALETTES[currentLevel];

  for (let p of platforms) {
    if (p.owner === "P1") {
      fill(pal.p1[0], pal.p1[1], pal.p1[2]);
    } else if (p.owner === "P2") {
      fill(pal.p2[0], pal.p2[1], pal.p2[2]);
    } else {
      fill(100, 110, 125);
    }
    rect(p.x, p.y, p.w, p.h, 6);
  }
}

function drawHUD() {
  let barW = 180;
  let barH = 16;
  let barY = 35;

  let pal = LEVEL_PALETTES[currentLevel];

  // P1 Health
  let p1W = map(fighter1.health, 0, fighter1.maxHealth, 0, barW);
  fill(40);
  rect(30, barY, barW, barH, 4);
  fill(pal.p1[0], pal.p1[1], pal.p1[2]);
  rect(30, barY, p1W, barH, 4);

  // P2 Health
  let p2W = map(fighter2.health, 0, fighter2.maxHealth, 0, barW);
  fill(40);
  rect(width - 30 - barW, barY, barW, barH, 4);
  fill(pal.p2[0], pal.p2[1], pal.p2[2]);
  rect(width - 30 - p2W, barY, p2W, barH, 4);

  // Text Info
  fill(255);
  textSize(14);
  noStroke();
  textAlign(LEFT);
  text(`P1 (LVL ${currentLevel})`, 30, barY - 6);
  textAlign(RIGHT);
  text(`P2 (LVL ${currentLevel})`, width - 30, barY - 6);

  // Center Timer & Level Display
  textAlign(CENTER);
  textSize(22);
  text(`${matchTimer}s`, width / 2, barY + 12);
  textSize(12);
  fill(200);
  text(`STAGE ${currentLevel} / ${MAX_LEVELS}`, width / 2, barY + 28);
}

// Draw Keyboard Controls Legend across bottom of screen
function drawBottomControls() {
  let pal = LEVEL_PALETTES[currentLevel];
  let barH = 32;
  let barY = height - barH;

  // Dark overlay bar at bottom
  fill(15, 15, 20, 220);
  noStroke();
  rect(0, barY, width, barH);

  // Top border line
  stroke(60);
  strokeWeight(1);
  line(0, barY, width, barY);

  noStroke();
  textSize(11);

  // P1 Controls (Left Side)
  textAlign(LEFT);
  fill(pal.p1[0], pal.p1[1], pal.p1[2]);
  text("P1:", 15, height - 11);
  fill(220);
  text("MOVE: [A][D] | JUMP: [W] | SHOOT: [F] | SHIELD: [G]", 40, height - 11);

  // P2 Controls (Right Side)
  textAlign(RIGHT);
  fill(220);
  text(
    "MOVE: [◄][►] | JUMP: [▲] | SHOOT: [K] | SHIELD: [L]",
    width - 40,
    height - 11,
  );
  fill(pal.p2[0], pal.p2[1], pal.p2[2]);
  text(":P2", width - 15, height - 11);
}

function drawStartScreen() {
  if (startBgImg) image(startBgImg, 0, 0, width, height);
  else background(15);

  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER);
  textSize(48);
  text("COLOR BRAWL: ARENA", width / 2, height / 2 - 60);

  textSize(16);
  fill(200);
  text(
    "Fight across 3 color-coded platform arenas!",
    width / 2,
    height / 2 - 20,
  );

  textSize(13);
  fill(0, 220, 200);
  text(
    "P1: MOVE [A/D]  JUMP [W]  SHOOT [F]  SHIELD [G]",
    width / 2,
    height / 2 + 25,
  );
  fill(255, 160, 40);
  text(
    "P2: MOVE [◄/►]  JUMP [▲]  SHOOT [K]  SHIELD [L]",
    width / 2,
    height / 2 + 50,
  );

  fill(255);
  textSize(15);
  text("Press ENTER to start match", width / 2, height / 2 + 105);
}

function drawWinScreen() {
  background(20);

  fill(winner === "P1" ? color(0, 200, 180) : color(255, 150, 30));
  textAlign(CENTER);
  textSize(52);
  text(winner + " CHAMPION!", width / 2, height / 2 - 30);

  fill(255);
  textSize(16);
  text("Press ENTER to restart from Level 1", width / 2, height / 2 + 40);
}

// ============================================================
// INPUT HANDLING
// ============================================================
function keyPressed() {
  if (keyCode === ENTER) {
    if (gameState === STATE_START || gameState === STATE_WIN) {
      gameState = STATE_FIGHT;
      loadLevel(1);
      if (bgMusic && bgMusic.isLoaded() && !bgMusic.isPlaying()) {
        bgMusic.loop();
      }
    }
  }

  if (gameState === STATE_FIGHT) {
    if (keyCode === 70) fighter1.startAttack(fighter2.x); // F Key (Shoot/Attack)
    if (keyCode === 75) fighter2.startAttack(fighter1.x); // K Key (Shoot/Attack)
  }
}
