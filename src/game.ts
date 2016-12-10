/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:SpriteSheet;
let BACKGROUNDS:SpriteSheet;
let TILES:SpriteSheet;
let BULLET = new RectImageSource('white', new Rect(-3,-2,6,4));

addInitHook(() => {
    FONT = new Font(IMAGES['font'], 'white');
    BACKGROUNDS = new ImageSpriteSheet(
	IMAGES['backgrounds'], new Vec2(192,192), new Vec2(0,0));
    //SPRITES = new ImageSpriteSheet(
    //IMAGES['sprites'], new Vec2(16,16), new Vec2(8,8));
    SPRITES = new SimpleSpriteSheet(
	[new RectImageSource('green', new Rect(-8,-8,16,16)), // player
	 new RectImageSource('purple', new Rect(-8,-8,16,16)), // enemy
	 new RectImageSource('pink', new Rect(-8,-8,16,16)), // guest
	 new RectImageSource('gray', new Rect(-4,-4,8,8)), // puff
	 new OvalImageSource('yellow', new Rect(-8,-8,16,16)), // yellow coin
	 new OvalImageSource('red', new Rect(-8,-8,16,16)), // red coin
	]);
    TILES = new SimpleSpriteSheet(
	[new RectImageSource(null, new Rect(0,0,16,16)), // 0
	 new RectImageSource('red', new Rect(0,0,16,16)), // 1
	 new RectImageSource('red', new Rect(0,0,16,8)),  // 2
	 null, null, null, null, null, null, null, null
	]);
});

enum S {
    PLAYER = 0,
    ENEMY = 1,
    GUEST = 2,
    PUFF = 3,
    COIN0 = 4,
    COIN1 = 5,
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
    bg: number;
    constructor(y: number, name: string, bg=B.OFFICE) {
	this.y = y;
	this.name = name;
	this.bg = bg;
    }
}

const FLOORS = [
    new FloorInfo(-2, 'B2: JUNGLE', B.JUNGLE),
    new FloorInfo(-1, 'B1: OFFICE', B.OFFICE),
    new FloorInfo(0, 'LOBBY', B.OFFICE),
    new FloorInfo(1, 'F1: OFFICE', B.OFFICE),
    new FloorInfo(2, 'F2: BEACH', B.BEACH),
    new FloorInfo(4, 'F4: OFFICE', B.OFFICE),
    new FloorInfo(7, 'F7: OFFICE', B.OFFICE),
    new FloorInfo(10, 'F2947: ORBIT', B.SPACE),
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
    downjump = false;

    constructor(elevator: Elevator, pos: Vec2) {
	super(pos);
	this.elevator = elevator;
	this.tilemap = elevator.tilemap;
	this.jumpfunc = ((vy:number, t:number) => {
	    return (0 <= t && t <= 5)? -6 : vy+this.elevator.gravity;
	});
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.tilemap.bounds];
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
	this.sprite.imgsrc = SPRITES.get((0 < direction)? S.COIN0 : S.COIN1);
	this.collider = this.sprite.getBounds(new Vec2());
	this.movement = new Vec2(rnd(2)*2-1, 0).scale(2);
	this.direction = direction;
    }

    update() {
	super.update();
	let v = this.moveIfPossible(this.movement);
	if (v.isZero()) {
	    this.movement.x = -this.movement.x;
	}
	if (3 <= this.getTime()) {
	    this.stop();
	    this.elevator.addPuff(this.pos);
	}
    }

    collidedWith(e: Entity) {
	if (e instanceof Player ||
	    e instanceof Enemy) {
	    this.stop();
	    this.elevator.vote(this.direction);
	}
    }
}


//  Player
//
class Player extends Passenger {

    usermove = new Vec2();
    direction = new Vec2(1,0);

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(S.PLAYER);
	this.collider = this.sprite.getBounds(new Vec2());
    }

    update() {
	super.update();
	this.moveIfPossible(this.usermove);
    }
    
    setMove(v: Vec2) {
	this.usermove.x = v.x*4;
	if (v.x != 0) {
	    this.direction.x = v.x;
	}
    }

    fire() {
	let bullet = new Bullet(this.elevator, this.pos, this.direction.x);
	this.elevator.addTask(bullet);
    }
}


//  Enemy
//
class Enemy extends Passenger {

    movement = new Vec2();

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(S.ENEMY);
	this.collider = this.sprite.getBounds(new Vec2());
    }

    update() {
	super.update();
	if (rnd(10) == 0) {
	    let vx = rnd(3)-1;
	    this.movement.x = vx*2;
	    if (vx == 0) {
		this.setJump(0);
	    }
	}
	this.moveIfPossible(this.movement);
    }

    collidedWith(e: Entity) {
	if (e instanceof Bullet) {
	    this.stop();
	    this.elevator.addPuff(this.pos);
	}
    }
}


//  Guest
//
class Guest extends Passenger {

    movement = new Vec2();
    goal: FloorInfo;

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(S.GUEST);
	this.collider = this.sprite.getBounds(new Vec2());
	this.goal = choice(FLOORS);
    }

    update() {
	super.update();
	if (rnd(10) == 0) {
	    let vx = rnd(3)-1;
	    this.movement.x = vx*2;
	    if (vx == 0) {
		this.setJump(0);
	    }
	}
	this.moveIfPossible(this.movement);
    }

    exit() {
	// XXX move towards the door.
	this.stop();
    }

    getLine() {
	return ('HEY! CAN YOU GET ME TO '+this.goal.name+'?');
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
	let y = clamp(0, pos.y - frame.height, this.eframe.height-frame.height);
	frame.x = this.eframe.x + x;
	frame.y = this.eframe.y + y;
    }
    
}


//  Elevator
//
class Elevator extends Layer {

    game: Game;
    tilemap: TileMap;
    basepos = 0;
    shake = 0;

    floor: FloorInfo = null;
    background: ImageSource = null;
    guest: Guest = null;

    dooropen = true;
    doornext = 10;
    gravity = 1;
    
    private _curdoor = 1;
    
    constructor(game: Game, tilemap: TileMap) {
	super();
	this.game = game;
	this.tilemap = tilemap;
	
	this.floor = FLOORS[2];	// lobby
	this.openDoor();
    }

    vote(direction: number) {
	// close door.
	this.dooropen = false;
	this.doornext = 0;
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
		// update gravity.
		if (door == 0) {
		    this.doorOpened(t);
		} else {
		    this.doorClosed(t);
		}
	    }
	} else if (t < this.doornext) {
	    // waiting...
	    // 0 < gravity: elevator is up, altitude is up.
	    // 0 > gravity: elevator is down, altitude is down.
	} else if (this.dooropen) {
	    // close door.
	    this.dooropen = false;
	} else {
	    // open door.
	    this.openDoor();
	}

	// update the screenshake.
	this.basepos += this.shake;
	this.shake = (this.shake - this.basepos*0.4)*0.8;
    }

    openDoor() {
	this.dooropen = true;
	this.background = BACKGROUNDS.get(this.floor.bg);
    }

    doorClosed(t: number) {
	this.gravity = choice([-2, -1, +1, +2]);
	this.shake = -this.gravity*2;
	this.doornext = t+5;
	// choose the next floor.
	this.floor = choice(FLOORS);
    }

    doorOpened(t: number) {
	this.gravity = 1;
	this.doornext = t+5;
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
	if (this.guest !== null) {
	    if (this.guest.goal === this.floor) {
		this.guest.exit();
		this.guest = null;
	    }
	}
	// add the guest.
	if (this.guest === null) {
	    this.guest = new Guest(this, new Vec2(this.tilemap.bounds.width/2, 8));
	    this.guest.stopped.subscribe(() => {
		this.guest = null;
	    });
	    this.addTask(this.guest);
	    this.game.addBalloon(this.guest.getLine(), this.guest);
	}
    }

    getFloor() {
	if (this.dooropen) {
	    return this.floor.name;
	} else {
	    return '---';
	}
    }

    addPuff(pos: Vec2) {
	this.addTask(new Puff(pos));
    }
    
    render(ctx: CanvasRenderingContext2D, bx: number, by: number) {
	by += this.basepos;
	let rect = this.tilemap.bounds;
	// frame.
	ctx.strokeStyle = 'gray';
	ctx.lineWidth = 4;
	ctx.strokeRect(bx-8, by-8, rect.width+16, rect.height+16);

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

	// tilemap and characters.
	this.tilemap.renderFromBottomLeft(
	    ctx, bx, by, TILES,
	    (x:number,y:number,c:number)=>{ return c; });
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
    
    init() {
	super.init();
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
	// place a player.
	let p = tilemap.findTile((c:number) => { return (c == T.PLAYER); });
	this.player = new Player(this.elevator, tilemap.map2coord(p).center());
	tilemap.set(p.x, p.y, 0);
	this.elevator.addTask(this.player);
	// additional thingamabob.
	this.statusBox = new TextBox(this.screen.resize(100, 100, -1, +1), FONT);
    }

    tick(t: number) {
	super.tick(t);
	this.elevator.tick(t);
	this.statusBox.clear();
	this.statusBox.addSegment(new Vec2(4,16), this.elevator.getFloor());
	let guest = this.elevator.guest;
	if (guest !== null) {
	    this.statusBox.addSegment(new Vec2(4,96), 'GOAL:');
	    this.statusBox.addSegment(new Vec2(4,106), guest.goal.name);
	}
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v);
	if (v.y < 0) {
	    this.player.setJump(+Infinity);
	    this.player.downjump = false;
	} else if (0 < v.y) {
	    this.player.setJump(0);
	    this.player.downjump = true;
	} else {
	    this.player.setJump(0);
	    this.player.downjump = false;
	}
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
	drawArrow(ctx, this.elevator.gravity*4);
	ctx.restore();
    }

    addBalloon(text: string, entity: Entity) {
	let balloon = new Balloon(this.eframe, entity);
	balloon.addDisplay(text, 8);
	let task = balloon.addPause(1);
	task.stopped.subscribe(() => { balloon.stop(); });
	this.add(balloon);
    }
}
