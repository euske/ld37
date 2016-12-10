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
let TILES:SpriteSheet;
addInitHook(() => {
    FONT = new Font(IMAGES['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	IMAGES['sprites'], new Vec2(16,16), new Vec2(8,8));
    TILES = new SimpleSpriteSheet(
	[new RectImageSource(null, new Rect(0,0,16,16)),
	 new RectImageSource('red', new Rect(0,0,16,16)),
	 null, null, null, null, null, null, null, null]
    );
});
const JUMPFUNC = ((vy:number, t:number) => {
    return (0 <= t && t <= 5)? -6 : vy+1;
});

enum Tile {
    NONE = 0,
    OBSTACLE = 1,
    PLAYER = 9,
};


//  Player
//
class Player extends PhysicalEntity {

    game: Game;
    usermove: Vec2;

    constructor(game: Game, pos: Vec2) {
	super(pos);
	this.game = game;
	this.sprite.imgsrc = SPRITES.get(0);
	this.collider = this.sprite.getBounds(new Vec2());
	this.usermove = new Vec2();
	this.jumpfunc = JUMPFUNC;
    }

    update() {
	super.update();
	this.moveIfPossible(this.usermove);
    }
    
    setMove(v: Vec2) {
	this.usermove.x = v.x*4;
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.game.screen];
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Rect[] {
	let tilemap = this.game.tilemap;
	return tilemap.getTileRects(tilemap.isObstacle, range);
    }
}


//  Game
// 
class Game extends GameScene {

    scoreBox: TextBox;
    score: number;

    player: Player;
    tilemap: TileMap;
    
    init() {
	super.init();
	const MAP = [
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
	this.tilemap = new TileMap(16, MAP.map((x:string) => { return str2array(x) }));
	this.tilemap.isObstacle = ((c:number) => { return (c == Tile.OBSTACLE); });
	let p = this.tilemap.findTile((c:number) => { return (c == Tile.PLAYER); });
	this.player = new Player(this, this.tilemap.map2coord(p).center());
	this.add(this.player);
	this.scoreBox = new TextBox(this.screen.inflate(-8,-8), FONT);
	this.score = 0;
	this.updateScore();
    }

    update() {
	super.update();
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v);
    }

    onButtonPressed(keysym: KeySym) {
	if (keysym == KeySym.Action) {
	    this.player.setJump(+Infinity);
	}
    }

    onButtonReleased(keysym: KeySym) {
	if (keysym == KeySym.Action) {
	    this.player.setJump(0);
	}
    }

    render(ctx: CanvasRenderingContext2D, bx: number, by: number) {
	ctx.fillStyle = 'rgb(0,0,128)';
	ctx.fillRect(bx, by, this.screen.width, this.screen.height);
	this.tilemap.renderFromBottomLeft(
	    ctx, bx, by, TILES,
	    (x:number,y:number,c:number)=>{ return c; });
	super.render(ctx, bx, by);
	this.scoreBox.render(ctx, bx, by);
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
    }
}
