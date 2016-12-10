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

function floorName(f: number) {
    if (f == 0) {
	return 'LOBBY';
    } else if (f < 0) {
	return "B"+Math.abs(f);
    } else {
	return "F"+f;
    }
}

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

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(S.GUEST);
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
}


//  Elevator
//
class Elevator extends Layer {

    game: Game;
    tilemap: TileMap;
    dooropen = false;
    background: ImageSource = null;

    gravity = 1;
    floor = 1;
    basepos = 0;
    accel = 0;
    guest: Guest = null;

    private _lastopen = 0;
    private _curdoor = 1;
    
    constructor(game: Game, tilemap: TileMap) {
	super();
	this.game = game;
	this.tilemap = tilemap;
    }

    vote(direction: number) {
    }

    tick(t: number) {
	super.tick(t);
	let door = (this.dooropen)? 0 : 1;
	if (door != this._curdoor) {
	    if (0.05 < Math.abs(door - this._curdoor)) {
		// door opening/closing.
		this._curdoor = (this._curdoor*0.4 + door*0.6);
	    } else {
		// door open/close completed.
		this._curdoor = door;
		// update gravity.
		if (this.dooropen) {
		    this.gravity = 1;
		} else {
		    this.gravity = choice([-2, -1, +1, +2]);
		    this.accel = -this.gravity*2;
		}
	    }
	} else if (this.dooropen) {
	    let dt = t - this._lastopen;
	    if (Math.random() < dt*0.05) {
		// close door.
		this._lastopen = t;
		this.dooropen = false;
	    }
	} else {
	    let dt = t - this._lastopen;
	    if (Math.random() < dt*0.05) {
		// open door.
		this._lastopen = t;
		this.dooropen = true;
		this.openFloor();
	    } else {
		// moving...
		// 0 < gravity: elevator is up, floor is up.
		// 0 > gravity: elevator is down, floor is down.
		this.floor += this.gravity*0.2;
	    }
	}
	// update the basepos.
	this.basepos += this.accel;
	this.accel = (this.accel - this.basepos*0.4)*0.8;
    }

    openFloor() {
	this.background = BACKGROUNDS.get(rnd(4));
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
	// add the guest.
	if (this.guest === null) {
	    this.guest = new Guest(this, new Vec2(this.tilemap.bounds.width/2, 8));
	    this.guest.stopped.subscribe(() => {
		this.guest = null;
	    });
	    this.addTask(this.guest);
	    this.game.addBalloon('HEY!', this.guest.pos);
	}
    }

    getFloor() {
	return floorName(int(this.floor));
    }

    addPuff(pos: Vec2) {
	this.addTask(new Puff(pos));
    }
    
    render(ctx: CanvasRenderingContext2D, bx: number, by: number) {
	let rect = this.tilemap.bounds;
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
    balloon: DialogBox;
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
	this.eframe = this.screen.resize(tilemap.bounds.width, tilemap.bounds.height);
	this.elevator = new Elevator(this, tilemap);
	// place a player.
	let p = tilemap.findTile((c:number) => { return (c == T.PLAYER); });
	this.player = new Player(this.elevator, tilemap.map2coord(p).center());
	tilemap.set(p.x, p.y, 0);
	this.elevator.addTask(this.player);
	// additional thingamabob.
	this.statusBox = new TextBox(this.screen.inflate(-8,-8), FONT);
	let textBox = new TextBox(new Rect(100,20,100,50), FONT);
	textBox.background = 'rgba(0,0,0,0.5)';
	textBox.borderColor = 'white';
	textBox.borderWidth = 2;
	textBox.padding = 4;
	this.balloon = new DialogBox(textBox);
	this.balloon.autoHide = true;
	this.balloon.textbox.visible = false;
	this.add(this.balloon);
    }

    tick(t: number) {
	super.tick(t);
	this.elevator.tick(t);
    }
    
    update() {
	super.update();
	this.statusBox.clear();
	this.statusBox.putText([this.elevator.getFloor()]);
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
	this.elevator.render(ctx, bx+this.eframe.x, by+this.eframe.y+this.elevator.basepos);
	super.render(ctx, bx, by);
	this.statusBox.render(ctx, bx, by);
	// gravity indicator.
	ctx.fillStyle = '#00ff00';
	ctx.save();
	ctx.translate(bx+20, by+60);
	ctx.scale(4, 4);
	drawArrow(ctx, this.elevator.gravity*4);
	ctx.restore();
    }

    addBalloon(text: string, pos: Vec2) {
	let frame = this.balloon.textbox.frame;
	let x = clamp(0, pos.x - frame.width/2, this.eframe.width-frame.width);
	let y = clamp(0, pos.y - frame.height, this.eframe.height-frame.height);
	frame.x = this.eframe.x + x;
	frame.y = this.eframe.y + y;
	this.balloon.addDisplay(text, 5);
	this.balloon.addPause(1);
    }
}
