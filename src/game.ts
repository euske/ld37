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
let SPRITES:ImageSpriteSheet;
let BACKGROUNDS:ImageSpriteSheet;
let TILES:SpriteSheet;
let BULLET = new RectImageSource('white', new Rect(-3,-2,6,4));
addInitHook(() => {
    FONT = new Font(IMAGES['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	IMAGES['sprites'], new Vec2(16,16), new Vec2(8,8));
    BACKGROUNDS = new ImageSpriteSheet(
	IMAGES['backgrounds'], new Vec2(192,192), new Vec2(0,0));
    TILES = new SimpleSpriteSheet(
	[new RectImageSource(null, new Rect(0,0,16,16)),
	 new RectImageSource('red', new Rect(0,0,16,16)),
	 null, null, null, null, null, null, null, null]
    );
});

enum Tile {
    NONE = 0,
    OBSTACLE = 1,
    PLAYER = 9,
};

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
	this.movement = new Vec2(0, vx*8);
	this.tilemap = elevator.tilemap;
	this.frame = this.tilemap.bounds;
	this.sprite.imgsrc = BULLET;
	this.collider = this.sprite.getBounds(new Vec2());
    }

    update() {
	super.update();
	let range = this.getCollider().getAABB();
	if (this.tilemap.findTileByCoord(this.tilemap.isObstacle, range)) {
	    this.stop();
	}
    }
}


//  Passenger
//
class Passenger extends PhysicalEntity {

    elevator: Elevator;
    tilemap: TileMap;

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
	return this.tilemap.getTileRects(this.tilemap.isObstacle, range);
    }
}


//  Player
//
class Player extends Passenger {

    usermove = new Vec2();
    direction = new Vec2(1,0);

    constructor(elevator: Elevator, pos: Vec2) {
	super(elevator, pos);
	this.sprite.imgsrc = SPRITES.get(0);
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
	this.sprite.imgsrc = SPRITES.get(1);
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

    tilemap: TileMap;
    dooropen = false;
    background: ImageSource = null;

    gravity = 1;
    floor = 1;
    basepos = 0;
    accel = 0;

    private _lastopen = 0;
    private _curdoor = 1;
    
    constructor(tilemap: TileMap) {
	super();
	this.tilemap = tilemap;
    }

    tick(t: number) {
	super.tick(t);
	let door = (this.dooropen)? 0 : 1;
	if (door != this._curdoor) {
	    if (0.1 < Math.abs(door - this._curdoor)) {
		// door opening/closing.
		this._curdoor = (this._curdoor + door)/2;
	    } else {
		// door open/close completed.
		this._curdoor = door;
		// update gravity.
		if (this.dooropen) {
		    this.gravity = 1;
		} else {
		    this.gravity = rnd(5)-2;
		    this.accel = this.gravity;
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
		this.updateFloor();
	    } else {
		// moving...
		this.floor -= this.gravity;
	    }
	}
	// update the basepos.
	this.basepos += this.accel;
	this.accel = (this.accel - this.basepos*0.4)*0.8;
    }

    updateFloor() {
	this.background = BACKGROUNDS.get(rnd(4));
	// add enemies.
	let p = new Vec2(rnd(this.tilemap.width), 0);
	let enemy = new Enemy(this, this.tilemap.map2coord(p).center());
	this.addTask(enemy);
    }

    getFloor() {
	let f = int(this.floor);
	return (f <= 0)? "BF"+Math.abs(f) : "F"+f;
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

    elevator: Elevator;
    tilemap: TileMap;
    player: Player;
    statusBox: TextBox;
    
    init() {
	super.init();
	const MAP = [ // 12x12
	    '000000000000',
	    '001100110011',
	    '000000000000',
	    '110011001100',
	    '000000000000',
	    '001100110011',
	    '000000000000',
	    '110011901100',
	    '000000000000',
	    '011001100110',
	    '000000000000',
	    '111111111111',
	];
	let tilemap = new TileMap(16, MAP.map((x:string) => { return str2array(x) }));
	tilemap.isObstacle = ((c:number) => { return (c == Tile.OBSTACLE); });
	this.elevator = new Elevator(tilemap);
	let p = tilemap.findTile((c:number) => { return (c == Tile.PLAYER); });
	this.player = new Player(this.elevator, tilemap.map2coord(p).center());
	tilemap.set(p.x, p.y, 0);
	this.elevator.addTask(this.player);
	this.statusBox = new TextBox(this.screen.inflate(-8,-8), FONT);
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
	} else if (0 < v.y) {
	    this.player.setJump(0);
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
	let ex = (this.screen.width - this.elevator.tilemap.bounds.width)/2;
	let ey = (this.screen.height - this.elevator.tilemap.bounds.height)/2;
	this.elevator.render(ctx, bx+ex, by+ey+this.elevator.basepos);
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
}
