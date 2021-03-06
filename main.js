var canvas = document.getElementById("gameCanvas");
var context = canvas.getContext("2d");

var startFrameMillis = Date.now();
var endFrameMillis = Date.now();

// This function will return the time in seconds since the function 
// was last called
// You should only call this function once per frame
function getDeltaTime()
{
	endFrameMillis = startFrameMillis;
	startFrameMillis = Date.now();

		// Find the delta time (dt) - the change in time since the last drawFrame
		// We need to modify the delta time to something we can use.
		// We want 1 to represent 1 second, so if the delta is in milliseconds
		// we divide it by 1000 (or multiply by 0.001). This will make our 
		// animations appear at the right speed, though we may need to use
		// some large values to get objects movement and rotation correct
	var deltaTime = (startFrameMillis - endFrameMillis) * 0.001;
	
		// validate that the delta is within range
	if(deltaTime > 1)
		deltaTime = 1;
		
	return deltaTime;
}

//-------------------- Don't modify anything above here

var SCREEN_WIDTH = canvas.width;
var SCREEN_HEIGHT = canvas.height;


// some variables to calculate the Frames Per Second (FPS - this tells use
// how fast our game is running, and allows us to make the game run at a 
// constant speed)
var fps = 0;
var fpsCount = 0;
var fpsTime = 0;


//Game States
var STATE_SPLASH = 0;
var STATE_GAME = 1;
var STATE_DIED = 2;
var STATE_GAMEOVER = 3;
var STATE_VICTORY = 4;
var STATE_INTERMISSION = 5;

var gameState = STATE_SPLASH;

var menuTimer = 0;
var space = false;

var livesImage = document.createElement("img");
	livesImage.src = "HeartImage.png";

var healthImage = document.createElement("img");
	healthImage.src = "HealthImage.png";

var lives = 3;
var ammo = 5;

var score = 5000;
var highscore = 0;

var retry = false;


var player = new Player();
var keyboard = new Keyboard();

var ENEMY_MAXDX = METER * 5;
var ENEMY_ACCEL = ENEMY_MAXDX * 2;

var enemies = [];
var bullets = [];
var triggers = [];

var LAYER_COUNT = 3;
var LAYER_BACKGOUND = 0;
var LAYER_PLATFORMS = 1;
var LAYER_LADDERS = 2;

var LAYER_OBJECT_ENEMIES = 3;
var LAYER_OBJECT_TRIGGERS = 4;

var MAP = {tw: 60, th: 15};
var TILE = 35;
var TILESET_TILE = TILE * 2;
var TILESET_PADDING = 2;
var TILESET_SPACING = 2;
var TILESET_COUNT_X = 14;
var TILESET_COUNT_Y = 14;

//Physics Constants

// abitrary choice for 1m
var METER = TILE;

// very exaggerated gravity (6x)
var GRAVITY = METER * 9.8 * 6;

// max horizontal speed (10 tiles per second)
var MAXDX = METER * 10;

// max vertical speed (15 tiles per second)
var MAXDY = METER * 18;

// horizontal acceleration - take 1/2 second to reach maxdx
var ACCEL = MAXDX * 2;

// horizontal friction - take 1/6 second to stop from maxdx
var FRICTION = MAXDX * 6;

// (a large) instantaneous jump impulse
var JUMP = METER * 1500;

// load the image to use for the level tiles
var tileset = document.createElement("img");
tileset.src = "tileset.png";

var currentLevel = level1

function intersects(x1, y1, w1, h1, x2, y2, w2, h2)
{
	if(y2 + h2 < y1 ||
	x2 + w2 < x1 ||
	x2> x1 + w1 ||
	y2 > y1 + h1)
	{
		return false;
	}
	return true;
}

function cellAtPixelCoord(layer, x,y)
{
	if(x<0 || x>SCREEN_WIDTH ||  y<0)
		return 1;
	//Let the player fall out of the bottom of the screen
	if(y>SCREEN_HEIGHT)
		return 0;
	return cellAtTileCoord(layer, p2t(x), p2t(y));
};

function cellAtTileCoord(layer, tx, ty)
{
	if(tx<0 || tx>MAP.tw || ty<0) 
		return 1;
	//Let the player fall out of the bottom of the screen
	if(ty>=MAP.th)
		return 0;
	return cells[layer][ty][tx];
};

function tileToPixel(tile)
{
	return tile * TILE;
};

function pixelToTile(pixel)
{
	return Math.floor(pixel/TILE);
};

function bound(value, min, max)
{
	if(value < min)
		return min;
	if(value > max)
		return max;
	return value;
};


function drawMap()
{
	var maxTiles = Math.floor(SCREEN_WIDTH / TILE) + 2;
	var tileX = pixelToTile(player.position.x);
	var offsetX = TILE + Math.floor(player.position.x%TILE);

	startX = tileX - Math.floor(maxTiles / 2);

	if(startX < -1)
	{
		startX = 0;
		offsetX = 0;
	}

	if(startX > MAP.tw - maxTiles)
	{
		startX = MAP.tw - maxTiles + 1;
		offsetX = TILE;
	}

	worldOffsetX = startX * TILE + offsetX;

	for(var layerIdx=0; layerIdx<LAYER_COUNT; layerIdx++)
	{
		for( var y = 0; y < currentLevel.layers[layerIdx].height; y++ )
		{
			var idx = y * currentLevel.layers[layerIdx].width + startX;
			for( var x = startX; x < startX + maxTiles; x++ )
			{
				if( currentLevel.layers[layerIdx].data[idx] != 0 )
				{
					// the tiles in the Tiled map are base 1 (meaning a value of 0 means no tile), so subtract one from the tileset id to get the
					// so subtract one from the tileset id to get the
					// correct tile
					var tileIndex = currentLevel.layers[layerIdx].data[idx] - 1;
					var sx = TILESET_PADDING + (tileIndex % TILESET_COUNT_X) * (TILESET_TILE + TILESET_SPACING);
					var sy = TILESET_PADDING + (Math.floor(tileIndex / TILESET_COUNT_Y)) * (TILESET_TILE + TILESET_SPACING);
					context.drawImage(tileset, sx, sy, TILESET_TILE, TILESET_TILE, (x-startX)*TILE - offsetX, (y-1)*TILE, TILESET_TILE, TILESET_TILE);
				}
				idx++;
			}
		}
	}
}

var cells = []; // the array that holds our simplified collision data

var musicBackground;
var sfxFire;

function initialize()
{
	for(var layerIdx = 0; layerIdx < LAYER_COUNT; layerIdx++) { // initialize the collision map
		cells[layerIdx] = [];
		var idx = 0;
		for(var y = 0; y < currentLevel.layers[layerIdx].height; y++) {
			cells[layerIdx][y] = [];
			for(var x = 0; x < currentLevel.layers[layerIdx].width; x++) {
				if(currentLevel.layers[layerIdx].data[idx] != 0) {
					 // for each tile we find in the layer data, we need to create 4 collisions
					 // (because our collision squares are 35x35 but the tile in the
					// level are 70x70)
					cells[layerIdx][y][x] = 1;
					cells[layerIdx][y-1][x] = 1;
					cells[layerIdx][y-1][x+1] = 1;
					cells[layerIdx][y][x+1] = 1;
				}
				else if(cells[layerIdx][y][x] != 1) {
					// if we haven't set this cell's value, then set it to 0 now
					cells[layerIdx][y][x] = 0;
				}
				idx++;
			}
		}
	}

	idx = 0;
	for(var y = 0; y < currentLevel.layers[LAYER_OBJECT_ENEMIES].height; y++) 
	{
		for(var x = 0; x <  currentLevel.layers[LAYER_OBJECT_ENEMIES].width; x++)
		{
			if( currentLevel.layers[LAYER_OBJECT_ENEMIES].data[idx] != 0)
			{
				var px = tileToPixel(x);
				var py = tileToPixel(y);
				var e = new Enemy(px , py);
				enemies.push(e);
			}
			idx++;
		}
	} 

	idx = 0;
	for(var y = 0; y < currentLevel.layers[LAYER_OBJECT_TRIGGERS].height; y++) 
	{
		for(var x = 0; x <  currentLevel.layers[LAYER_OBJECT_TRIGGERS].width; x++)
		{
			if( currentLevel.layers[LAYER_OBJECT_TRIGGERS].data[idx] != 0)
			{
				var px = tileToPixel(x);
				var py = tileToPixel(y);
				console.log(px, py)
				var t = new Trigger(px, py);
				triggers.push(t);
			}
			idx++;
		}
	} 
}

function initializeMusic()
{


	backgroundLoop = new Howl(
	{
	    urls: ["backgroundLoop.ogg"],
	    loop: true,
	    buffer: true,
	    volume: 0.5

	});

	backgroundIntro = new Howl(
	{
		urls: ["backgroundIntro.ogg"],
		loop: false,
		buffer: true,
		volume: 0.5,
		onend: function()
		{
			backgroundIntro.stop()
			backgroundLoop.play()
		}
	} );





	sfxFire = new Howl(
	{
		urls: ["fireEffect.ogg"],
		buffer: true,
		volume: 0.4,
		onend: function()
		{
			isSfxPlaying = false;
		}

	} );

	sfxJump = new Howl(
	{
		urls: ["jumpEffect.ogg"],
		buffer: true,
		volume: 0.2,
		onend: function()
		{
			isSfxPlaying = false;
		}

	} );

	sfxPlayerDeath = new Howl(
	{
		urls: ["playerDeath.ogg"],
		buffer: true,
		volume: 0.2,
		onend: function()
		{
			isSfxPlaying = false;
		}

	} );

	sfxBegin = new Howl(
	{
		urls: ["begin.ogg"],
		buffer: true,
		volume: 0.2,
		onend: function()
		{
			isSfxPlaying = false;
		}

	} );

	sfxLevelComplete = new Howl(
	{
		urls: ["levelComplete.ogg"],
		buffer: true,
		volume: 0.2,
		onend: function()
		{
			isSfxPlaying = false;
		}

	} );

}

function runSplash(deltaTime)
{
	context.fillStyle = "#002e4d";
	context.font = "80px Arial";
	context.fillText("PLATFORMER", SCREEN_WIDTH/11, SCREEN_HEIGHT/3);
	context.fillStyle = "GREEN"
	context.font = "50px Arial";
	context.fillText("Race to the finish", SCREEN_WIDTH/6, SCREEN_HEIGHT/2);
	context.fillStyle = "black";
	context.font = "40px Lucida Console";
	context.fillText("Press SPACE to begin", SCREEN_WIDTH/8, SCREEN_HEIGHT/1.2);
	if(space == true)
	{
		space = false;
		sfxBegin.play();
		backgroundIntro.play();
		gameState = STATE_GAME;
		return;
	}
}


function runGame(deltaTime)
{

	player.update(deltaTime);

	drawMap(currentLevel);
	
	
	player.draw();

	score -= 1

	for(var i=0; i<enemies.length; i++)
	{
		enemies[i].update(deltaTime);
		//console.log(i)
	}

	for(var i=0; i<enemies.length; i++)
	{
		enemies[i].draw();
	}
	//console.log(bullets.length)
	for(var i=0; i<bullets.length; i++)
	{
		bullets[i].update(deltaTime);
	}

	for(var i=0; i<bullets.length; i++)
	{
		bullets[i].draw();
	}


	// update the frame counter 
	fpsTime += deltaTime;
	fpsCount++;
	if(fpsTime >= 1)
	{
		fpsTime -= 1;
		fps = fpsCount;
		fpsCount = 0;
	}		
	//draw the score
	context.fillStyle = "red";
	context.font="40px Comic Sans";
	var scoreText = "Score: " + score;
	context.fillText(scoreText, SCREEN_WIDTH - 200, 35);

	for(var i=0; i<lives; i++)
	{
		context.drawImage(livesImage, 20 + ((livesImage.width+2)*i), 10);
	}

	for(var i=0; i<ammo; i++)
	{
		context.drawImage(healthImage, 25 + ((healthImage.width+2)*i), 70);
	}

	// draw the FPS
	context.fillStyle = "#f00";
	context.font="14px Arial";
	context.fillText("FPS: " + fps, 5, 20, 100);


	//DEBUG DRAW LEVEL COLLISION DATA
	/*function DrawLevelCollisionData(tileLayer) {
	    for (var y = 0; y < level1.layers[tileLayer].height; y++) {
	        for (var x = 0; x < level1.layers[tileLayer].width; x++) {
	            if (cells[tileLayer][y][x] == 1) {
	                context.fillStyle = "#F00";
	                context.fillRect(TILE * x, TILE * y, TILE, TILE);
	            }
	        }
	    }
	}*/

	//DEBUG DRAW LEVEL COLLISION DATA
	/*function DrawLevelCollisionData() {
	    for (var y = 0; y < currentLevel.layers[LAYER_OBJECT_TRIGGERS].height; y++) {
	        for (var x = 0; x < currentLevel.layers[LAYER_OBJECT_TRIGGERS].width; x++) {
	            if (cells[LAYER_OBJECT_TRIGGERS][y][x] == 1) {
	                context.fillStyle = "#F00";
	                context.fillRect(TILE * x, TILE * y, TILE, TILE);
	            }
	        }
	    }
	}*/

	for(var k=0; k<triggers.length; k++)
	{
		
		if(intersects(player.position.x, player.position.y, player.width, player.height, triggers[k].position.x , triggers[k].position.y, TILE, TILE) == true)
			{
				backgroundIntro.stop()
				backgroundLoop.stop()
				sfxLevelComplete.play()
				if(currentLevel == level1)
				{
					gameState = STATE_INTERMISSION
				}
				else if(currentLevel == level2)
				{
					gameState = STATE_VICTORY;					
				}

					
			}
	}
	//death from falling out of the screen
	if(player.position.y > SCREEN_HEIGHT)
	{
		player.isDead = true
	}




	if (player.isDead == true)
	{
		sfxPlayerDeath.play()
		backgroundIntro.stop()
		backgroundLoop.stop()
		ammo = 5
		lives -= 1
		score = 0
		player.isDead = false

		if(lives <= 0)
		{
			gameState = STATE_GAMEOVER;
		}
		else
		{
			gameState = STATE_DIED;
		}
		return;
	}

	var hit=false;
	for(var i=0; i<bullets.length; i++)
	{
		bullets[i].update(deltaTime);
		if( bullets[i].position.x - worldOffsetX < 0 || bullets[i].position.x - worldOffsetX > SCREEN_WIDTH)
		{
			hit = true;
		}

		for(var j=0; j<enemies.length; j++)
		{
			if(intersects( bullets[i].position.x, bullets[i].position.y, TILE, TILE, enemies[j].position.x, enemies[j].position.y, TILE, TILE) == true)
			{

			// kill both the bullet and the enemy
			enemies[j].death(deltaTime);
			enemies.splice(j, 1);

			hit = true;
			// increment the player score
			
			break;
			}
		}
		if(hit == true)
		{
	
			bullets.splice(i, 1);
			break;
		}
	}
}

function runDied(deltaTime)
{
	backgroundIntro.stop()
	backgroundLoop.stop()

	context.fillStyle = "#4d0000"
	context.font = "70px Unicorn";
	context.fillText("You Died ", SCREEN_WIDTH/3.5, SCREEN_HEIGHT/3.5)
	context.font = "30px Arial Black";
	context.fillStyle = "black"
	context.font = "40px Boulder";
	context.fillText("Press E to try again", SCREEN_WIDTH/4, SCREEN_HEIGHT/1.2)
	if(retry == true)
	{
		backgroundIntro.stop()
		backgroundLoop.stop()
		retry = false;
		score = 5000;
		player.position.x = player.startPos.x
		player.position.y = player.startPos.y
		sfxBegin.play();
		backgroundIntro.play()
		ammo = 5;
		gameState = STATE_GAME;
		return;
	}
}


function runGameOver(deltaTime)
{
	//set the highscore
	backgroundIntro.stop()
	backgroundLoop.stop()

	context.fillStyle = "#4d0000"
	context.font = "70px Unicorn";
	context.fillText("GAME OVER ", SCREEN_WIDTH/5, SCREEN_HEIGHT/3.8)

	context.fillText("GAME OVER ", SCREEN_WIDTH/5, SCREEN_HEIGHT/2.6)

	context.fillText("GAME OVER ", SCREEN_WIDTH/5, SCREEN_HEIGHT/1.8)
	context.fillStyle = "Black";
	context.font = "40px Boulder";
	context.fillText("Press E to try again", SCREEN_WIDTH/4, SCREEN_HEIGHT/1.2)

	if(retry == true)
	{
		backgroundIntro.stop()
		backgroundLoop.stop()
		retry = false;
		score = 5000;
		player.position.x = player.startPos.x
		player.position.y = player.startPos.y
		sfxBegin.play();
		backgroundIntro.play()
		ammo = 5
		lives = 3
		currentLevel = level1
		initialize();
		gameState = STATE_GAME;
		return;
	}
}




function runVictory(deltaTime)
{
	backgroundIntro.stop()
	backgroundLoop.stop()	
	//set the highscore
	if(score >= highscore)
	{
		highscore = score;
	}

	context.fillStyle = "GREEN"
	context.font = "70px Unicorn";
	context.fillText("VICTORY", SCREEN_WIDTH/5, SCREEN_HEIGHT/3.5)
	context.fillStyle = "black"
	context.font = "40px Arial Black";
	context.fillText("HighScore: " + highscore, SCREEN_WIDTH/3.5, SCREEN_HEIGHT/1.5)
	context.font = "30px Arial Black";
	context.fillText("Score: " + score, SCREEN_WIDTH/3.5, SCREEN_HEIGHT/2)
	context.font = "40px Boulder";
	context.fillText("Press E to try again", SCREEN_WIDTH/4, SCREEN_HEIGHT/1.2)
	if(retry == true)
	{
		backgroundIntro.stop()
		backgroundLoop.stop()
		retry = false;
		score = 5000;
		player.position.x = player.startPos.x
		player.position.y = player.startPos.y
		sfxBegin.play();
		currentLevel = level1
		backgroundIntro.play()
		ammo = 5
		lives = 3
		initialize();
		gameState = STATE_GAME;
		return;
	}
}

function runIntermission(deltaTime)
{
	//set the highscore
	backgroundIntro.stop()
	backgroundLoop.stop()

	context.fillStyle = "GREEN"
	context.font = "60px Unicorn";
	context.fillText("LEVEL 1 COMPLETE", SCREEN_WIDTH/11, SCREEN_HEIGHT/3.5)
	context.fillStyle = "black"
	context.font = "40px Arial Black";
	context.fillText("Score: " + score, SCREEN_WIDTH/3.5, SCREEN_HEIGHT/2)
	context.font = "40px Boulder";
	context.fillText("Press E to begin level 2", SCREEN_WIDTH/4, SCREEN_HEIGHT/1.2)
	if(retry == true)
	{
		backgroundIntro.stop()
		backgroundLoop.stop()
		retry = false;
		score += 2000;
		currentLevel = level2
		player.position.x = player.startPos.x
		player.position.y = player.startPos.y
		ammo += 2
		sfxBegin.play();
		backgroundIntro.play()
		initialize();
		gameState = STATE_GAME;
		return;
	}
}

initialize();
initializeMusic();

function run()
{

	context.fillStyle = "#ccc";		
	context.fillRect(0, 0, canvas.width, canvas.height);

	var deltaTime = getDeltaTime();



	if(keyboard.isKeyDown(keyboard.KEY_SPACE) == true)
	{
		space = true;
	}
	else
	{
		space = false;
	}

	if(keyboard.isKeyDown(keyboard.KEY_E) == true) 
	{
		retry = true;
	}
	else
	{
		retry = false;
	}


	switch(gameState)
	{
		case STATE_SPLASH:
			runSplash(deltaTime)
			break;
		case STATE_GAME:
			runGame(deltaTime)
			break;
		case STATE_DIED:
			runDied(deltaTime)
			break;
		case STATE_GAMEOVER:
			runGameOver(deltaTime)
			break;
		case STATE_VICTORY:
			runVictory(deltaTime)
			break;
		case STATE_INTERMISSION:
			runIntermission(deltaTime)
			break;
	}
}







//-------------------- Don't modify anything below here


// This code will set up the framework so that the 'run' function is called 60 times per second.
// We have a some options to fall back on in case the browser doesn't support our preferred method.
(function() {
  var onEachFrame;
  if (window.requestAnimationFrame) {
    onEachFrame = function(cb) {
      var _cb = function() { cb(); window.requestAnimationFrame(_cb); }
      _cb();
    };
  } else if (window.mozRequestAnimationFrame) {
    onEachFrame = function(cb) {
      var _cb = function() { cb(); window.mozRequestAnimationFrame(_cb); }
      _cb();
    };
  } else {
    onEachFrame = function(cb) {
      setInterval(cb, 1000 / 60);
    }
  }
  
  window.onEachFrame = onEachFrame;
})();

window.onEachFrame(run);
