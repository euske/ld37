/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/tilemap.ts" />
/// <reference path="../base/sprite.ts" />
/// <reference path="../base/animation.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let FONT_WARN: Font;
let SPRITES:SpriteSheet;
let BACKGROUNDS:SpriteSheet;
let TILES:SpriteSheet;
let SHADOW:HTMLImageSource;
let BULLET = new RectImageSource('white', new Rect(-3,-2,6,4));

addInitHook(() => {
    FONT = new Font(IMAGES['font'], 'white');
    FONT_WARN = new Font(IMAGES['font'], 'red', 4);
    BACKGROUNDS = new ImageSpriteSheet(
	IMAGES['backgrounds'], new Vec2(192,192), new Vec2(0,0));
    SPRITES = new ImageSpriteSheet(
	IMAGES['sprites'], new Vec2(16,16), new Vec2(8,8));
    TILES = new ImageSpriteSheet(
	IMAGES['tiles'], new Vec2(16,16), new Vec2(0,0));
    SHADOW = SPRITES.get(S.SHADOW, 1) as HTMLImageSource;
    SHADOW.dstRect = new Rect(-8, -6, 16, 16);
});

enum S {
    PLAYER = 0,
    GUEST_WORKER1 = 1,
    GUEST_WORKER2 = 2,
    GUEST_TARZAN = 3,
    GUEST_TOURIST = 4,
    GUEST_ASTRONAUT = 5,
    PUFF = 6,
    SHADOW = 6,
    COIN = 7,
    ENEMY = 8,
};

enum T {
    NONE = 0,
    BLOCK = 1,
    FLOOR = 2,
    PLAYER = 9,
};

enum B {
    OFFICE = 0,
    JUNGLE = 1,
    BEACH = 2,
    SPACE = 3,
};

class FloorInfo {
    y: number;
    name: string;
    info: string;
    bg: number;
    constructor(y: number, name: string, info: string, bg=B.OFFICE) {
	this.y = y;
	this.name = name;
	this.info = info;
	this.bg = bg;
    }
}

const FLOORS = [
    new FloorInfo(-2, 'B2', 'JUNGLE', B.JUNGLE), // 0
    new FloorInfo(-1, 'B1', 'OFFICE', B.OFFICE), // 1
    new FloorInfo(0, 'LOBBY', '', B.OFFICE),       // 2
    new FloorInfo(1, 'F1', 'OFFICE', B.OFFICE),  // 3
    new FloorInfo(2, 'F2', 'BEACH', B.BEACH),    // 4
    new FloorInfo(4, 'F4', 'OFFICE', B.OFFICE),  // 5
    new FloorInfo(7, 'F7', 'OFFICE', B.OFFICE),  // 6
    new FloorInfo(10, 'F2947', 'ORBIT', B.SPACE), // 7
];

class GuestInfo {
    sp: number;
    floors: FloorInfo[];
    lines0: string[];
    lines1: string[];
    constructor(sp: number, floors: FloorInfo[],
		lines0: string[], lines1: string[]) {
	this.sp = sp;
	this.floors = floors;
	this.lines0 = lines0;
	this.lines1 = lines1;
    }
}

const GUESTS = [
    new GuestInfo(
	S.GUEST_WORKER1,
	[FLOORS[0], FLOORS[1], FLOORS[2], FLOORS[3], FLOORS[4], FLOORS[5]],
	["Hi, could you get me to ?", "Morning, please go to ."],
	["Thank you!", "Thankee~~"]),
    new GuestInfo(
	S.GUEST_WORKER2,
	[FLOORS[1], FLOORS[3], FLOORS[5], FLOORS[6], FLOORS[6]],
	["Hiya, let me get to !", "I'm supposed to be at ."],
	["Hey, thanks!", "I'm late!"]),
    new GuestInfo(
	S.GUEST_TARZAN,
	[FLOORS[0], FLOORS[2]],
	["Hey! Me go to !", "Excuse me, I'd like to go to ."],
	["Thank you."]),
    new GuestInfo(
	S.GUEST_TOURIST,
	[FLOORS[2], FLOORS[4]],
	["Hi, where's ?", "I wanna go to !"],
	["Thanks, dude!"]),
    new GuestInfo(
	S.GUEST_ASTRONAUT,
	[FLOORS[7]],
	["Please take me to .", "!@#$%^&>_ <\*+ ?"],
	["Thank you very much!"]),
];

function drawArrow(ctx: CanvasRenderingContext2D, y: number) {
    let t = y*0.8;
    ctx.beginPath();
    ctx.moveTo(+1, 0);
    ctx.lineTo(+1, t);
    ctx.lineTo(+2, t);
    ctx.lineTo(0, y);
    ctx.lineTo(-2, t);
    ctx.lineTo(-1, t);
    ctx.lineTo(-1, 0);
    ctx.closePath();
    ctx.fill();
}



//  Bullet
//
class Bullet extends Projectile {

    tilemap: TileMap;

    constructor(elevator: Elevator, pos: Vec2, vx: number) {
	super(pos);
	this.movement = new Vec2(vx*8, 0);
	this.tilemap = elevator.tilemap;
	this.frame = this.tilemap.bounds;
	this.sprite.imgsrc = BULLET;
	this.collider = this.sprite.getBounds(new Vec2());
    }

    update() {
	super.update();
	let range = this.getCollider().getAABB();
	if (this.tilemap.findTileByCoord(
	    (c:number) => { return c != T.NONE; }, range)) {
	    this.stop();
	}
    }
}


//  Puff
//
class Puff extends Entity {

    constructor(pos: Vec2) {
	super(pos);
	this.lifetime = 0.2;
	this.sprite.imgsrc = SPRITES.get(S.PUFF);
    }

}


//  Passenger
//
class Passenger extends PhysicalEntity {

    elevator: Elevator;
    tilemap: TileMap;
    shadow: Sprite;
    downjump = false;

    constructor(elevator: Elevator, pos: Vec2) {
	super(pos);
	this.elevator = elevator;
	this.tilemap = elevator.tilemap;
	this.collider = SPRITES.get(0).getBounds();
	this.jumpfunc = ((vy:number, t:number) => {
	    return (0 <= t && t <= 5)? -6 : vy+this.elevator.gravity;
	});
	this.shadow = new EntitySprite(this);
	this.shadow.imgsrc = SHADOW;
	this.shadow.zOrder = -1;
    }
    
    start() {
	super.start();
	this.layer.addSprite(this.shadow);
    }
    
    stop() {
	this.layer.removeSprite(this.shadow);
	super.stop();
    }
    
    update() {
	super.update();
	this.shadow.visible = this.isLanded();
    }
    
    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.elevator.bounds];
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Rect[] {
	let ts = this.tilemap.tilesize;
	let rects = [] as Rect[];
	this.tilemap.apply((x:number, y:number, c:number) => {
	    switch (c) {
	    case T.FLOOR:
		if (!this.downjump || v.y < 0) {
		    rects.push(new Rect(x*ts, y*ts, ts, 8));
		}
		break;
	    case T.BLOCK:
		rects.push(new Rect(x*ts, y*ts, ts, ts));
		break;
	    }
	    return false;
	},
			   this.tilemap.coord2map(range));
	return rects;
    }
}


//  Coin
//
class Coin extends Passenger {

    movement: Vec2;
    direction: number;

    constructor(elevator: Elevator, pos: Vec2, direction=0) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(S.COIN, (0 < direction)? 0 : 1);
	this.movement = new Vec2(rnd(2)*2-1, 0).scale(2);
	this.direction = direction;
    }

    update() {
	let v = this.moveIfPossible(this.movement);
	if (v.isZero()) {
	    this.movement.x = -this.movement.x;
	}
	this.sprite.rotation += this.movement.x*0.1;
	super.update();
    }

    destroy() {
	this.stop();
	this.elevator.addPuff(this.pos);
    }

    collidedWith(e: Entity) {
	if (e instanceof Player ||
	    e instanceof Enemy) {
	    playSound(SOUNDS['coin']);
	    this.stop();
	    this.elevator.vote(this.direction);
	}
    }
}


//  Player
//
class Player extends Passenger {

    fired: Signal;
    usermove = new Vec2();
    direction = new Vec2(1,0);

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.fired = new Signal(this);
    }

    update() {
	this.moveIfPossible(this.usermove);
	let i = phase(this.getTime(), 0.5);
	this.sprite.imgsrc = SPRITES.get(S.PLAYER, i);
	super.update();
    }
    
    setMove(v: Vec2) {
	if (0 < this.elevator.gravity) {
	    if (v.y < 0) {
		this.setJump(+Infinity);
		this.downjump = false;
	    } else if (0 < v.y) {
		this.setJump(0);
		this.downjump = true;
	    } else {
		this.setJump(0);
		this.downjump = false;
	    }
	    this.usermove.y = 0;
	} else {
	    this.usermove.y = v.y*2;
	}
	
	this.usermove.x = v.x*4;
	if (v.x != 0) {
	    this.direction.x = v.x;
	    this.sprite.scale.x = v.x;
	}
    }

    fire() {
	let bullet = new Bullet(this.elevator, this.pos, this.direction.x);
	this.elevator.addTask(bullet);
	this.fired.fire();
    }
}


//  Enemy
//
class Enemy extends Passenger {

    movement = new Vec2();

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
    }

    update() {
	let i = phase(this.getTime(), 0.5);
	this.sprite.imgsrc = SPRITES.get(S.ENEMY, i);
	if (rnd(10) == 0) {
	    let vx = rnd(3)-1;
	    this.movement.x = vx*2;
	    this.sprite.scale.x = vx;
	    if (vx == 0) {
		this.setJump(0);
	    }
	}
	this.moveIfPossible(this.movement);
	super.update();
    }

    collidedWith(e: Entity) {
	if (e instanceof Bullet) {
	    e.stop();
	    this.stop();
	    this.elevator.addPuff(this.pos);
	}
    }
}


//  Guest
//
class Guest extends Passenger {

    movement = new Vec2();
    info: GuestInfo;
    goal: FloorInfo;
    exiting = false;

    constructor(elevator: Elevator, pos: Vec2, info: GuestInfo) {
	super(elevator, pos);
	this.info = info;
	let floor = elevator.getFloor();
	while (true) {
	    this.goal = choice(info.floors);
	    if (this.goal !== floor) break;
	}
    }

    update() {
	let i = phase(this.getTime(), 0.5);
	this.sprite.imgsrc = SPRITES.get(this.info.sp, i);
	if (this.exiting) {
	    if (Math.abs(this.pos.x - this.elevator.bounds.centerx()) < 16) {
		this.stop();
	    }
	} else if (rnd(10) == 0) {
	    let vx = rnd(3)-1;
	    this.movement.x = vx*2;
	    this.sprite.scale.x = vx;
	    if (vx == 0) {
		this.setJump(0);
	    }
	}
	this.moveIfPossible(this.movement);
	super.update();
    }

    exit() {
	this.exiting = true;
	this.movement.x = ((this.pos.x < this.elevator.bounds.centerx())? +2 : -2);
    }

    getLine0() {
	let line = choice(this.info.lines0);
	let n = line.length;
	return (line.substr(0,n-1)+this.goal.name+line.substr(n-1));
    }	

    getLine1() {
	let line = choice(this.info.lines1);
	return line;
    }	

    collidedWith(e: Entity) {
	if (e instanceof Bullet) {
	    e.stop();
	}
    }
}


//  Balloon
//
class Balloon extends DialogBox {

    eframe: Rect;
    entity: Entity;

    constructor(eframe: Rect, entity: Entity) {
	let textBox = new TextBox(new Rect(100,20,100,50), FONT);
	textBox.background = 'rgba(0,0,0,0.8)';
	textBox.borderColor = 'white';
	textBox.borderWidth = 2;
	textBox.lineSpace = 2;
	textBox.padding = 4;
	textBox.visible = false;
	super(textBox);
	this.eframe = eframe;
	this.entity = entity;
	this.autoHide = true;
    }

    update() {
	super.update();
	let pos = this.entity.pos;
	let frame = this.textbox.frame;
	let x = clamp(0, pos.x - frame.width/2, this.eframe.width-frame.width);
	let y = clamp(0, pos.y - 16 - frame.height, this.eframe.height-frame.height);
	frame.x = this.eframe.x + x;
	frame.y = this.eframe.y + y;
    }
    
}


//  Elevator
//
class Elevator extends Layer {

    game: Game;
    tilemap: TileMap;
    bounds: Rect;
    basepos = 0;
    shake = 0;

    floorIndex = 2;
    background: ImageSource = null;
    guest: Guest = null;

    poweron = true;
    dooropen = true;
    nextevent = 0;
    direction = 0;
    gravity = 1;
    
    private _curdoor = 1;
    
    constructor(game: Game, tilemap: TileMap) {
	super();
	this.game = game;
	this.tilemap = tilemap;
	this.bounds = tilemap.bounds;
    }

    init() {
	super.init();
	this.openDoor();
    }
    
    vote(direction: number) {
	this.direction = direction;
	// close door.
	this.dooropen = false;
	this.nextevent = 0;
	this.destroyCoins();
    }

    tick(t: number) {
	super.tick(t);
	// door: 0:open, 1:closed
	let door = (this.dooropen)? 0 : 1;
	if (door != this._curdoor) {
	    if (0.05 < Math.abs(door - this._curdoor)) {
		// door opening/closing.
		this._curdoor = (this._curdoor*0.4 + door*0.6);
	    } else {
		// door open/close completed.
		this._curdoor = door;
		if (door == 0) {
		    this.doorOpened(t);
		} else {
		    this.doorClosed(t);
		}
	    }
	} else if (t < this.nextevent) {
	    // waiting...
	    // 0 < gravity: elevator is up, altitude is up.
	    // 0 > gravity: elevator is down, altitude is down.
	} else if (this.dooropen) {
	    // close door.
	    this.closeDoor();
	} else if (!this.poweron) {
	    // outage end.
	    this.endOutage(t);
	} else if (Math.random() < this.game.getOutageProb()) {
	    // outage begin.
	    this.beginOutage(t);
	} else {
	    // open door.
	    this.openDoor();
	}

	// update the screenshake.
	this.basepos += this.shake;
	this.shake = (this.shake - this.basepos*0.4)*0.8;
    }

    openDoor() {
	this.floorIndex = clamp(0, this.floorIndex+this.direction, FLOORS.length-1);
	this.background = BACKGROUNDS.get(this.getFloor().bg);
	this.dooropen = true;
	this.game.updateStatus();
	playSound(SOUNDS['ring']);
    }

    closeDoor() {
	this.dooropen = false;
	playSound(SOUNDS['ring']);
    }
    
    doorClosed(t: number) {
	this.gravity = this.direction;
	this.shake = -this.gravity*2;
	this.nextevent = t+rnd(5, 10);
    }

    doorOpened(t: number) {
	this.shake = -this.gravity*2;
	this.gravity = 1;
	this.nextevent = Infinity;
	// add enemies.
	let p = new Vec2(rnd(this.tilemap.width), 0);
	let enemy = new Enemy(this, this.tilemap.map2coord(p).center());
	this.addTask(enemy);
	// add coins.
	p = new Vec2(rnd(this.tilemap.width), 0);
	let coin1 = new Coin(this, this.tilemap.map2coord(p).center(), -1);
	this.addTask(coin1);
	p = new Vec2(rnd(this.tilemap.width), 0);
	let coin2 = new Coin(this, this.tilemap.map2coord(p).center(), +1);
	this.addTask(coin2);
	// remove the guest.
	if (this.guest === null) {
	    this.spawnGuest();
	} else {
	    if (this.guest.goal === this.getFloor()) {
		this.game.addBalloon(this.guest.getLine1(), this.guest);
		this.guest.stopped.subscribe(() => {
		    this.guest = null;
		    this.game.addScore();
		    this.spawnGuest();
		});
		this.guest.exit();
	    }
	}
    }

    beginOutage(t: number) {
	this.poweron = false;
	this.nextevent = t+rnd(5, 8);
	this.game.beginOutage();
	this.game.addBalloon('Uh oh.', this.game.player, false);
    }

    endOutage(t: number) {
	this.poweron = true;
	this.nextevent = t+rnd(5, 10);
	this.game.endOutage();
	this.game.addBalloon('Phew.', this.game.player, false);
    }

    destroyCoins() {
	for (let e of this.entities) {
	    if (e instanceof Coin) {
		e.destroy();
	    }
	}
    }

    spawnGuest() {
	let info = this.game.chooseGuest();
	let x = (rnd(2) == 0)? (this.bounds.x+8) : (this.bounds.right()-8);
	this.guest = new Guest(this, new Vec2(x, this.bounds.bottom()-24), info);
	this.addTask(this.guest);
	this.game.updateStatus();
	this.game.addBalloon(this.guest.getLine0(), this.guest);
    }

    getFloor() {
	return FLOORS[this.floorIndex];
    }

    addPuff(pos: Vec2) {
	this.addTask(new Puff(pos));
    }
    
    render(ctx: CanvasRenderingContext2D, bx: number, by: number) {
	by += this.basepos;
	let rect = this.bounds;
	// frame.
	ctx.strokeStyle = 'gray';
	ctx.lineWidth = 4;
	ctx.strokeRect(bx-8, by-8, rect.width+16, rect.height+16);

	if (this.poweron) {
	    // background.
	    if (this._curdoor < 1.0) {
		if (this.background !== null) {
		    ctx.save();
		    ctx.translate(bx, by);
		    this.background.render(ctx);
		    ctx.restore();
		}
	    }

	    // elevator door.
	    let w = rect.width*this._curdoor/2;
	    ctx.fillStyle = '#889999';
	    ctx.fillRect(bx, by, w, rect.height);
	    ctx.fillRect(bx+rect.width-w, by, w, rect.height);
	    ctx.lineWidth = 2;
	    ctx.strokeStyle = '#444444';
	    ctx.beginPath();
	    ctx.moveTo(bx+w-1, by);
	    ctx.lineTo(bx+w-1, by+rect.height);
	    ctx.stroke();
	    ctx.strokeStyle = '#222222';
	    ctx.beginPath();
	    ctx.moveTo(bx+rect.width-w+1, by);
	    ctx.lineTo(bx+rect.width-w+1, by+rect.height);
	    ctx.stroke();

	    // tilemap and characters.
	    this.tilemap.renderFromBottomLeft(
		ctx, bx, by, TILES,
		(x:number,y:number,c:number)=>{ return c; });
	}
	
	super.render(ctx, bx, by);
    }
}


//  Game
// 
class Game extends GameScene {

    eframe: Rect;
    elevator: Elevator;
    tilemap: TileMap;
    player: Player;
    statusBox: TextBox;
    score: number;
    
    init() {
	super.init();
	this.score = 0;
	// prepare the map.
	const MAP = [ // 12x12
	    '000000000000',
	    '002200220022',
	    '000000000000',
	    '220022002200',
	    '000000000000',
	    '002200220022',
	    '000000000000',
	    '220022902200',
	    '000000000000',
	    '022002200220',
	    '000000000000',
	    '111111111111',
	];
	let tilemap = new TileMap(16, MAP.map((x:string) => { return str2array(x) }));
	// create the elevator.
	this.eframe = this.screen.resize(tilemap.bounds.width, tilemap.bounds.height, +1);
	this.eframe.x += 16;
	this.elevator = new Elevator(this, tilemap);
	this.statusBox = new TextBox(this.screen.resize(100, 100, -1, +1), FONT);
	// place a player.
	let p = tilemap.findTile((c:number) => { return (c == T.PLAYER); });
	this.player = new Player(this.elevator, tilemap.map2coord(p).center());
	this.player.jumped.subscribe(() => { playSound(SOUNDS['jump']); });
	this.player.fired.subscribe(() => { playSound(SOUNDS['gun']); });
	tilemap.set(p.x, p.y, 0);
	this.elevator.init();
	this.elevator.addTask(this.player);
	// additional thingamabob.
	this.updateStatus();
	// start music.
	this.startMusic();
    }

    tick(t: number) {
	super.tick(t);
	this.elevator.tick(t);
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v);
    }

    onButtonPressed(keysym: KeySym) {
	if (keysym == KeySym.Action) {
	    this.player.fire();
	}
    }

    render(ctx: CanvasRenderingContext2D, bx: number, by: number) {
	ctx.fillStyle = '#000000';
	ctx.fillRect(bx, by, this.screen.width, this.screen.height);
	this.elevator.render(ctx, bx+this.eframe.x, by+this.eframe.y);
	super.render(ctx, bx, by);
	this.statusBox.render(ctx, bx, by);
	// gravity indicator.
	ctx.fillStyle = '#00ff00';
	ctx.save();
	ctx.translate(bx+240, by+64);
	ctx.scale(4, 4);
	drawArrow(ctx, -this.elevator.direction*4);
	ctx.restore();
    }

    updateStatus() {
	this.statusBox.clear();
	let floor = this.elevator.getFloor();
	this.statusBox.addSegment(new Vec2(4,16), floor.name);
	if (this.elevator.dooropen) {
	    this.statusBox.addSegment(new Vec2(4,26), floor.info);
	}
	let guest = this.elevator.guest;
	if (guest !== null) {
	    this.statusBox.addSegment(new Vec2(4,96), 'GOAL: '+guest.goal.name);
	}
	this.statusBox.addSegment(new Vec2(4,200), 'SCORE:');
	this.statusBox.addSegment(new Vec2(4,210), this.score.toString());
    }

    addBalloon(text: string, entity: Entity, voiced=true) {
	if (voiced) {
	    playSound(SOUNDS['speak']);
	}
	let balloon = new Balloon(this.eframe, entity);
	balloon.addDisplay(text, 12);
	let task = balloon.addPause(1);
	task.stopped.subscribe(() => { balloon.stop(); });
	this.add(balloon);
    }

    beginOutage() {
	let textbox = new TextBox(this.eframe, FONT_WARN);
	textbox.lineSpace = 16;
	textbox.putText(['POWER', 'OUTAGE'], 'center', 'center');
	textbox.zOrder = 2;
	let task = new Blinker(textbox);
	task.interval = 0.5;
	task.lifetime = 3.0;
	this.add(task);
	APP.setMusic();
	playSound(SOUNDS['outage']);
    }

    endOutage() {
	let task = new SoundTask(SOUNDS['poweron']);
	task.stopped.subscribe(() => { this.startMusic(); })
	this.add(task);
    }

    startMusic() {
	//APP.setMusic(SOUNDS['music'], 0.025, 36.725);
    }

    addScore() {
	this.score++;
	this.updateStatus();
    }

    getOutageProb() {
	return 0.0;
    }
    chooseGuest() {
	// XXX depends on the current score.
	return choice(GUESTS);
    }
}
