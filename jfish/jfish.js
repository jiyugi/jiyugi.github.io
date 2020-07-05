// jfish(Sakanasukui), Version 1.3.0
// Written in 2017, 2018, 2019 by yunari.
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.

// You should have received a copy of the CC0 Public Domain Dedication along
// with this software. If not, see:
// http://creativecommons.org/publicdomain/zero/1.0/

(function() {
    "use strict";

    // 設定データ
    var settings = {
        VERSION: "Version 1.3.0",

        ID_DISPLAY: "jfish-display",
        ID_RESET: "btn-reset",
        ID_SOUND: "chk-sound",
        ID_VIB: "chk-vibrate",

        FONT: "bold 20px sans-serif",
        FONT_LARGE: "48px sans-serif",
        FONT_POPUP: "64px sans-serif",

        STR_GAMEOVER: "GAME OVER",
        STR_HISCORE: "Hi",
        STR_LOAD_SND: "Now loading sounds..",
        STR_SCORE: "Score",
        STR_GAUGE: "ポイ",

        WIDTH: 320,
        HEIGHT: 320
    };

    // 画像の読み込み情報
    var images = {
        COVER: "data/cover.png",
        FISH: "data/fish.png",
        POI: "data/poi-sprite.png",
        POI_ICON: "data/poi-icon.png"
    };

    // サウンドの読み込み情報 {pattern: 振動のパターン, src: URI}
    var sounds = {
        gameStart: {
            pattern: [400],
            src: "data/start.ogg"
        },
        poiBroken: {
            pattern: [400],
            src: "data/break.ogg"
        },
        fishCatched: {
            pattern: [50],
            src: "data/catch.ogg"
        },
        poiFishTail: {
            pattern: [25, 50, 25, 50, 50],
            src: "data/damage.ogg"
        },
        oneup: {
            src: "data/oneup.ogg"
        },
        vibTest: {
            pattern: [50]
        }
    };

    /**
    計算オブジェクト
    */
    var calc = {};

    /**
    点が円に入っているかを返す
    @param {Number} px 点のx座標
    @param {Number} py 点のy座標
    @param {Number} cx 円の中心のx座標
    @param {Number} cy 円の中心のy座標
    @param {Number} cr 円の半径
    @return {Boolean} 入っていればtrue
    */
    calc.isPointInCircle = function(px, py, cx, cy, cr) {
        return (
            (Math.pow(cx - px, 2) + Math.pow(cy - py, 2)) <=
            Math.pow(cr, 2)
        );
    };

    /**
    点が矩形に入っているかを返す
    @param {Number} px 点のx座標
    @param {Number} px 点のy座標
    @param {Number} rx 矩形の左上のx座標
    @param {Number} ry 矩形の左上のy座標
    @param {Number} rw 矩形の横幅
    @param {Number} rh 矩形の縦幅
    @return {Boolean} 入っていればtrue
    */
    calc.isPointInRect = function(px, py, rx, ry, rw, rh) {
        return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
    };

    /**
    ポインターオブジェクト
    @constructor
    */
    var Pointer = function() {
        this.x = 0;
        this.y = 0;
        this.tapping = false; // タップ中にtrue
        this.active = false; // 画面内にある時true
        this.clicked = false; // クリックの瞬間にtrue
    };

    /**
    ポインタの位置を変更する 小数点以下は切り捨てとなる
    @param x {Number} 新しいx位置
    @param y {Number} 新しいy位置
    */
    Pointer.prototype.setPosition = function(x, y) {
        this.x = Math.floor(x);
        this.y = Math.floor(y);
    };

    /**
    ポインタのx座標
    @return {Number}
    */
    Pointer.prototype.getX = function() {
        return this.x;
    };

    /**
    ポインタのy座標
    @return {nNmber}
    */
    Pointer.prototype.getY = function() {
        return this.y;
    };

    /**
    ポインタのタップ状態を変更
    @param {Boolean} bool trueなら触る、falseなら離す
    */
    Pointer.prototype.setTapping = function(bool) {
        this.tapping = bool;
        if (!bool && this.active) {
            this.clicked = true;
        }
    };

    /**
    ポインタのアクティブ状態を変更
    @param {Boolen} bool 画面内ならtrue
    */
    Pointer.prototype.setActive = function(bool) {
        this.active = bool;
    };

    /**
    ポインタが画面内にあるか?
    @return {Boolean} あればtrue
    */
    Pointer.prototype.isActive = function() {
        return this.active;
    };

    /**
    ポインタのマウスボタンが押されているか?
    @return {Boolean} 押されていて、かつ画面内ならtrue
    */
    Pointer.prototype.isTapping = function() {
        return this.tapping && this.isActive();
    };

    /**
    クリックされたか?
    @return {Boolean} クリックされたならtrue
    */
    Pointer.prototype.isClicked = function() {
        return this.clicked;
    };

    /**
    クリック状態をリセット
    */
    Pointer.prototype.releaseClick = function() {
        this.clicked = false;
    };

    /**
    アセットローダー
    読み込みの必要なアセットを扱う(継承用)
    @constructor
    */
    var Loader = function() {
        this.assets = {};
    };

    /**
    アセットのオブジェクトを作る
    @param {String} src アセットのURI
    @return {Object} アセット
    */
    Loader.prototype.makeAsset = function() {
        return {};
    };

    /**
    アセットのURIを返す
    @param {Object} o なんらかの情報
    @return {String} アセットのURI
    */
    Loader.prototype.makeSrc = function(o) {
        return o;
    };

    /**
    アセットを読み込む
    @param {Object} hash なんらかのアセットの読み込み情報
    */
    Loader.prototype.loadAssets = function(hash) {
        Object.keys(hash).forEach(function(key) {
            var src = this.makeSrc(hash[key]);
            var asset = null;

            if (src) {
                asset = this.makeAsset(src);
                if (asset) {
                    this.assets[src] = asset;
                }
            }
        }, this);
    };

    /**
    指定したURIのアセットが読み込まれているか?
    @param {String} src アセットのURI
    @return {Boolean} 読み込まれていたらtrue
    */
    Loader.prototype.hasLoaded = function() {
        return true;
    };

    /**
    アセットが全て読み込まれたか?
    @return {Boolean} 読み込まれていたらtrue
    */
    Loader.prototype.hasLoadedAll = function() {
        return Object.keys(this.assets).every(this.hasLoaded, this);
    };

    /**
    画像用のアセットローダー
    @constructor
    @extends {Loader}
    */
    var ImageLoader = function() {
        Loader.call(this);
    };
    ImageLoader.prototype = Object.create(Loader.prototype);

    /**
    @override
    @return {Image} 画像
    */
    ImageLoader.prototype.makeAsset = function(src) {
        var img = new Image();
        img.src = src;
        return img;
    };

    /**
    @override
    */
    ImageLoader.prototype.hasLoaded = function(src) {
        return Boolean(this.assets[src] && this.assets[src].complete);
    };

    /**
    画像を返す
    @return {Image}
    */
    ImageLoader.prototype.getImage = function(src) {
        return this.assets[src] || null;
    };

    /**
    音と振動用のアセットローダー
    @constructor
    */
    var SoundManager = function() {
        Loader.call(this);
        this.enableSound = false;
        this.enableVibrate = false;
    };
    SoundManager.prototype = Object.create(Loader.prototype);

    /**
    @override
    */
    SoundManager.prototype.makeAsset = function(src) {
        return (window.Audio
            ? new window.Audio(src)
            : null);
    };

    /**
    @override
    */
    SoundManager.prototype.makeSrc = function(sound) {
        return sound.src || null;
    };

    /**
    @override
    @return {Boolean} 読み込みエラーも完了とみなす(ブラウザ互換のため)
    */
    SoundManager.prototype.hasLoaded = function(src) {
        var audio = this.assets[src];
        return Boolean(audio && audio.readyState !== 4 || !audio.error);
    };

    /**
    音・振動用のアセットローダー
    @param sound {Object} 音情報オブジェクト
    */
    SoundManager.prototype.playSound = function(sound) {
        var vib = sound.pattern;
        var src = sound.src;

        if (vib && this.enableVibrate && navigator.vibrate) {
            navigator.vibrate(vib);
        }
        if (
            src &&
            this.enableSound &&
            this.assets[src] &&
            this.hasLoaded(src)
        ) {
            // 直接鳴らすと再生するたびに再生位置の初期化が必要で、
            // 同じ音を同時に鳴らす事ができないので、コピーを鳴らす。
            this.assets[src].cloneNode().play();
        }
    };

    /**
    魚オブジェクト
    @constructor
    */
    var Fish = function() {
        this.active = true; // 破棄すべき時にtrue
        this.x = 0;
        this.y = 0;
        this.frame = 0;
        this.angle = 180; // 現在の角度
        this.scale = 1; // 大きさの倍率
    };

    Fish.prototype.speed = 2; // 魚の早さ
    Fish.prototype.baseScore = 5; // 得点

    /**
    しっぽのx座標を返す y座標はないので注意
    @return {Number} しっぽのx座標
    */
    Fish.prototype.getTailX = function() {
        return this.x + 16 * this.scale;
    };

    /**
    魚を捕まえたときの得点を返す
    @return {Number} 得点
    */
    Fish.prototype.getScore = function() {
        return Math.floor(this.baseScore * this.scale);
    };

    /**
    魚を描画するときの画像のサイズを返す
    @return {Number} 正方形の大きさ
    */
    Fish.prototype.getSize = function() {
        return 48 * this.scale;
    };

    /**
    魚をすくった時のダメージを返す
    @return {Number} ダメージ量
    */
    Fish.prototype.getDamage = function() {
        return Math.floor(1.5 * this.scale);
    };

    /**
    魚のしっぽをすくったときのダメージを返す
    @return {Number} ダメージ量
    */
    Fish.prototype.getDamageTail = function() {
        return Math.floor(10 * this.scale);
    };

    /**
    魚の状態を更新する
    @param {Poi} ポイ
    */
    Fish.prototype.update = function(poi) {
        var a = 180;
        var b = 1 - Math.abs(poi.x - this.x) / 128;
        var r;

        // 泳ぐ向きを決める
        if (poi.state && b > 0 && poi.y !== this.y) {
            a += (poi.y > this.y
                ? 30
                : -30);
        }

        // 泳ぐ向きが↑になるように角度を変える
        if (this.angle !== a) {
            this.angle += (this.angle < a
                ? 3
                : -3);
        }

        // 角度によって移動
        r = this.angle / 180 * Math.PI;
        this.x += this.speed * Math.cos(r);
        this.y += this.speed * Math.sin(r);

        // アニメーション
        this.frame += this.speed;

        // 消す
        if (this.x + this.getSize() < 0) {
            this.active = false;
        }
    };

    /**
    早い魚オブジェクト
    @constructor
    @extends {Fish}
    */
    var FasterFish = function() {
        Fish.call(this);
    };
    FasterFish.prototype = Object.create(Fish.prototype);

    FasterFish.prototype.speed = 4;
    FasterFish.prototype.baseScore = 7;

    /**
    ポイオブジェクト
    @constructor
    */
    var Poi = function() {
        this.x = 0;
        this.y = 0;
        this.state = false; // 動作中はtrue
        this.flaw = 0; // 受けたダメージ
    };

    Poi.prototype.size = 128; // 画像の大きさ
    Poi.prototype.capacty = 50; // 耐久度
    Poi.prototype.radius = 56; // 半径
    Poi.prototype.centerRadius = 32; // 中心部の半径

    /**
    @return {Number} ポイの画像の大きさ
    */
    Poi.prototype.getSize = function() {
        return this.size;
    };

    /**
    ポイに傷を与える
    耐久度の限界を越えることはない
    @param {Number} value 与える傷の大きさ
    */
    Poi.prototype.addFlaw = function(value) {
        this.flaw = Math.min(this.flaw + Math.floor(value), this.capacty);
    };

    /**
    ポイが破れたか?
    @return {Boolen} 破れていればtrue
    */
    Poi.prototype.isBroken = function() {
        return this.flaw >= this.capacty;
    };

    /**
    ポイの耐久度の割合を返す
    @return {Number} 割合(0.0から1.0)
    */
    Poi.prototype.getRatio = function() {
        return 1 - this.flaw / this.capacty;
    };

    /**
    波オブジェクト
    @constructor
    */
    var Wave = function(x, y, score, tail) {
        this.x = x;
        this.y = y;
        this.score = score;
        this.frame = 0;
        this.tail = tail;
    };

    Wave.prototype.frameWait = 10;

    /**
    状態を更新する
    */
    Wave.prototype.update = function() {
        this.frame = Math.min(this.frame + 1, this.frameWait);
    };

    /**
    オブジェクトが有効か?
    @return {Boolean} 削除されるべきならfalse
    */
    Wave.prototype.isAlive = function() {
        return this.frame < this.frameWait;
    };

    /**
    空間オブジェクト
    @constructor
    */
    var World = function() {
        this.score = 0;
        this.frame = 0;
        this.leftPoi = 1;
        this.fishes = [];
        this.poi = new Poi();
        this.wave = null;
        this.gameEndCounter = 30;
        this.bonusList = [500, 1000, 2000];
        this.lastFish = null;
    };

    /**
    現在の得点を返す
    @return {Number} 得点
    */
    World.prototype.getScore = function() {
        return this.score;
    };

    /**
    得点を加える
    @param {Number} n 加える量
    */
    World.prototype.addScore = function(n) {
        this.score += n;
    };

    /**
    ゲームが完全に終わったかを返す
    @return {Boolean} 終わっているならtrue
    */
    World.prototype.isEnd = function() {
        return (
            this.poi.flaw >= this.poi.capacty &&
            this.gameEndCounter === 0
        );
    };

    /**
    ポイを使って魚の捕獲を試みる
    破れてしまった時は点を増やさない
    @param {SoundManager} sm 音と振動
    */
    World.prototype.catchFishes = function(sm) {
        var count = 0;
        var score = 0;
        var bak = this.fishes;
        var tail = false; // しっぽをすくったらtrue

        this.fishes = this.fishes.filter(function(fish) {
            if (calc.isPointInCircle(
                fish.x,
                fish.y,
                this.poi.x,
                this.poi.y,
                this.poi.radius
            )) {
                score += fish.getScore();
                count += 1;
                if (calc.isPointInCircle(
                    fish.getTailX(),
                    fish.y,
                    this.poi.x,
                    this.poi.y,
                    this.poi.centerRadius
                )) {
                    this.poi.addFlaw(fish.getDamageTail());
                    tail = true;
                } else {
                    this.poi.addFlaw(fish.getDamage());
                }
                return false; // 魚は消える
            }
            return true; // 魚は残る
        }, this);

        if (this.poi.isBroken()) { // 破れた場合は捕まえた魚を無かった事にする
            count = 0;
            score = 0;
            this.fishes = bak;
            sm.playSound(sounds.poiBroken);
        } else if (count > 0) {
            score *= count;
            this.addScore(score);
            sm.playSound(tail
                ? sounds.poiFishTail
                : sounds.fishCatched);
        }
        this.wave = new Wave(this.poi.x, this.poi.y, score, tail);
    };

    /**
    新しい魚を作る
    魚の大きさの倍率は1.0から2.0の間で16段階
    魚のy座標は画面のタテ幅から上下にPADDINGぶん狭めた範囲で、
    直前の魚と重なりすぎないようランダムに決められる
    */
    World.prototype.createFish = function() {
        var RANKS = 16;
        var PROB_FASTER = 0.4; // 早い魚の出現率
        var PADDING = 64;
        var fish = null;
        var lastY = 0;

        fish = (Math.random() <= PROB_FASTER
            ? new FasterFish()
            : new Fish());
        if (this.lastFish) {
            lastY = this.lastFish.y - PADDING;
        }
        fish.scale = 1 + Math.floor(Math.random() * RANKS) / RANKS;
        fish.x = settings.WIDTH + fish.getSize();
        fish.y = PADDING + (
            (lastY + 32 + (Math.random() * 128)) %
            (settings.HEIGHT - 2 * PADDING)
        );
        this.lastFish = fish;

        return fish;
    };

    /**
    空間を更新する
    @param {Pointer} pointer ポインタオブジェクト
    @param {SoundManager} sm 音と振動
    */
    World.prototype.update = function(pointer, sm) {
        var SEC = 20; // 1秒
        var PROB_FISH = 0.6; // 1秒おきに魚が出現する割合

        // 波の動き
        if (this.wave) {
            this.wave.update();
            if (!this.wave.isAlive()) {
                this.wave = null;
            }
        }

        // ポイの動き
        if (this.poi.isBroken()) {
            this.poi.state = 1;
            if (this.leftPoi >= 1 && pointer.isClicked()) {
                this.poi = new Poi();
                this.leftPoi -= 1;
                pointer.setTapping(false);
            }
        } else {
            if (pointer.isTapping()) {
                this.poi.x = pointer.getX();
                this.poi.y = pointer.getY() - 32; // 操作性のため少しずらす
            }

            // ポイのオン / オフ
            if (!this.poi.state && pointer.isTapping()) {
                this.poi.state = true;
            } else if (this.poi.state && !pointer.isTapping()) {
                this.poi.state = false;

                // ポインターが画面外へ出るなどした場合、falseを返す
                // 画面内で離した時のみ、魚をとらえる
                if (pointer.isActive()) {
                    this.catchFishes(sm);
                }
            }
        }

        // ポイのボーナス
        if (this.bonusList.length > 0 && this.score >= this.bonusList[0]) {
            this.leftPoi += 1;
            this.bonusList.shift();
            sm.playSound(sounds.oneup);
        }

        // 魚たちを動かす
        // 不要になった魚はメモリから削除される
        this.fishes = this.fishes.filter(function(fish) {
            fish.update(this.poi);
            return fish.active; // trueなら次フレームも残る
        }, this);

        // 新しい魚を出す
        if (this.frame === 0 || (
            this.fishes.length < 5 &&
            this.frame % SEC === 0 &&
            Math.random() <= PROB_FISH
        )) {
            this.fishes.push(this.createFish());

            // 小さい順に並び替える
            this.fishes = this.fishes.sort(function(a, b) {
                return b.getSize() - a.getSize();
            });
        }

        // GAME OVER 処理
        if (this.poi.isBroken() && this.leftPoi === 0) {

            // このカウンタは World() で初期化される
            this.gameEndCounter = Math.max(this.gameEndCounter - 1, 0);
        }

        this.frame += 1;
    };

    /**
    魚を描画する
    @param {CanvasRenderingContext2D} ctx
    @param {Image} img 魚の画像
    @param {Fish} fish 描画したい魚
    */
    World.prototype.drawFish = function(ctx, img, fish) {
        var r = 15 * fish.frame / 180 * Math.PI;
        var x = fish.x;
        var y = fish.y;
        var sw = 1 + Math.sin(r) * 0.05;
        var sh = 1 + Math.cos(r) * 0.05;
        var size = fish.getSize();
        var middle = -(size / 2);

        ctx.save();
        ctx.transform(sw, 0, 0, sh, x, y);
        ctx.drawImage(img, middle, middle, size, size);
        ctx.restore();
    };

    /**
    ポイのアイコンを描画する
    */
    World.prototype.drawPoiIcon = function(ctx, picon) {
        var ICON_SIZE = 32;
        var x = settings.WIDTH - 36;
        var y = settings.HEIGHT - ICON_SIZE - 4;
        var i;

        for (i = 0; i < this.leftPoi; i += 1) {
            ctx.drawImage(picon, x, y);
            x -= ICON_SIZE;
        }
    };

    /**
    ポイを描画する
    @param {Object} ctx 描画する
    @param {Image} img ポイの画像
    @param {Poi} poi ポイオブジェクト
    */
    World.prototype.drawPoi = function(ctx, img, poi) {
        var size = poi.getSize();
        var middle  = -(size / 2);

        ctx.drawImage(
            img,
            (poi.isBroken()
                ? 128
                : 0),
            0,
            size,
            size,
            poi.x + middle,
            poi.y + middle,
            size,
            size
        );
    };

    /**
    波を描画する
    */
    World.prototype.drawWave = function(ctx, poi, wave) {
        var rad = 1 - wave.frame / wave.frameWait;
        var dx = (wave.tail
            ? wave.frame % 2 * 10 - 5
            : 0);

        ctx.save();
        ctx.strokeStyle = "#9cf";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            wave.x + 0.5 + dx,
            wave.y + 0.5,
            poi.radius * rad,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
            wave.x + 0.5 + dx,
            wave.y + 0.5,
            poi.centerRadius * rad,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        if (wave.score > 0) {
            ctx.fillStyle = "#fff";
            ctx.font = settings.FONT_POPUP;
            ctx.textAlign = "center";
            ctx.fillText(wave.score, wave.x, wave.y - wave.frame * 1);
        }
        ctx.restore();
    };

    /**
    ゲーム画面を描画する
    @param {CanvasRenderingContext2D} ctx
    @param {ImageLoader} il 画像ローダー
    */
    World.prototype.draw = function(ctx, il) {
        var pimg = il.getImage(images.POI);
        var fimg = il.getImage(images.FISH);
        var picon = il.getImage(images.POI_ICON);
        var midX = Math.floor(settings.WIDTH / 2);
        var midY = Math.floor(settings.HEIGHT / 2);
        var gaugeW;

        ctx.save();

        // 背景

        ctx.fillStyle = "#39c";
        ctx.fillRect(0, 0, settings.WIDTH, settings.HEIGHT);

        // キャラクタ

        if (this.poi.state) {
            this.drawPoi(ctx, pimg, this.poi);
        }
        this.fishes.forEach(this.drawFish.bind(this, ctx, fimg));
        if (this.wave) {
            this.drawWave(ctx, this.poi, this.wave);
        }
        this.drawPoiIcon(ctx, picon); // 残り数

        // ゲージ

        ctx.fillStyle = "#fff";
        ctx.font = settings.FONT;
        ctx.fillText(settings.STR_GAUGE, 10, 24);

        gaugeW = settings.WIDTH - 72;
        ctx.fillStyle = "#333";
        ctx.fillRect(60, 15, gaugeW, 2);
        ctx.fillStyle = "#f93";
        ctx.fillRect(60, 15, Math.floor(this.poi.getRatio() * gaugeW + 0.5), 4);

        // スコア

        ctx.fillStyle = "#fff";
        ctx.font = settings.FONT;
        ctx.fillText(
            [settings.STR_SCORE, this.score].join(" "),
            10,
            settings.HEIGHT - 10
        );

        // GAME OVER 表示
        if (
            this.poi.isBroken() &&
            this.leftPoi === 0 &&
            this.gameEndCounter % 10 < 5
        ) {
            ctx.font = settings.FONT_LARGE;
            ctx.textAlign = "center";
            ctx.fillStyle = "#333";
            ctx.fillText(settings.STR_GAMEOVER, midX + 3, midY + 3);
            ctx.fillStyle = "#fff";
            ctx.fillText(settings.STR_GAMEOVER, midX, midY);
        }

        ctx.restore();
    };

    /**
    フェーズ
    */
    var Phases = {
        LOADING: -1,
        TITLE: 0,
        PLAYING: 1
    };

    /**
    ゲーム全体 オブジェクト
    @constructor
    */
    var Game = function() {
        this.phase = Phases.LOADING;
        this.highScore = 0;
        this.world = null;
    };

    /**
    タイトル画面に戻る
    */
    Game.prototype.gotoTitle = function() {
        if (this.world) {
            this.highScore = Math.max(this.highScore, this.world.score);
            this.world = null;
        }
        this.phase = Phases.LOADING;
    };

    /**
    ゲーム全体のフレーム毎の処理
    @param {Pointer} ptr
    @param {SoundManager} sm
    @param {CanvasRenderingContext2D} ctx
    @param {ImageLoader} il
    */
    Game.prototype.enterFrame = function(ptr, sm, ctx, il) {
        switch (this.phase) {
        case Phases.LOADING:
            if (il.hasLoadedAll()) {
                this.world = new World();
                this.phase = Phases.TITLE;
            }
            break;
        case Phases.TITLE:
            ctx.drawImage(il.getImage(images.COVER), 0, 0);
            ctx.fillStyle = "#966";
            ctx.font = settings.FONT;
            ctx.save();
            ctx.textAlign = "right";
            ctx.fillText(settings.VERSION, settings.WIDTH - 10, 24);
            ctx.restore();

            if (this.highScore > 0) {
                ctx.fillText(
                    [settings.STR_HISCORE, this.highScore].join(" "),
                    8,
                    24
                );
            }

            if (ptr.isClicked()) {
                this.phase = Phases.PLAYING;
                ptr.setTapping(false);
                sm.playSound(sounds.gameStart);
            }

            break;
        case Phases.PLAYING:
            this.world.update(ptr, sm);
            this.world.draw(ctx, il);

            if (this.world.isEnd() && ptr.isClicked()) {
                ptr.setTapping(false);
                this.gotoTitle();
            }

            break;
            // defaultなし
        }
        ptr.releaseClick();
    };

    /**
    メイン オブジェクト
    @constructor
    */
    var Main = function() {
        this.canvas = document.getElementById(settings.ID_DISPLAY);
        this.context = this.canvas.getContext("2d");
        this.pointer = new Pointer();
        this.imgLoader = new ImageLoader();
        this.sndManager = new SoundManager();
        this.game = new Game();
        this.flagLoadedSnd = false;
        this.imgLoader.loadAssets(images);
    };

    /**
    フレーム毎の処理
    */
    Main.prototype.enterFrame = function() {
        var ctx = this.context;

        // 音声読み込み中の割り込み
        if (this.sndManager.enableSound && !this.flagLoadedSnd) {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, settings.WIDTH, 32);
            ctx.font = settings.FONT;
            ctx.fillStyle = "#fff";
            ctx.fillText(settings.STR_LOAD_SND, 8, 24);

            if (this.sndManager.hasLoadedAll()) {
                this.flagLoadedSnd = true;
            }
        } else {
            this.game.enterFrame(
                this.pointer,
                this.sndManager,
                ctx,
                this.imgLoader
            );
        }
    };

    /**
    マウス処理
    */
    Main.prototype.setUpMouse = function() {
        var ptr = this.pointer;
        var elm = this.canvas;

        var onClient = function (e) {
            var rect = e.target.getBoundingClientRect();
            var scale = settings.WIDTH / rect.width;

            ptr.setPosition(
                Math.floor((e.clientX - rect.left) * scale),
                Math.floor((e.clientY - rect.top) * scale)
            );
        };

        elm.addEventListener("mousedown", function(e) {
            e.preventDefault();
            if (e.button === 0) {
                onClient(e);
                ptr.setTapping(true);
                ptr.setActive(true);
            }
        });

        window.addEventListener("mouseup", function(e) {
            if (e.button === 0) {
                if (e.target === elm) {
                    e.preventDefault();
                } else {
                    ptr.setActive(false);
                }
                ptr.setTapping(false);
            }
        });

        elm.addEventListener("mouseover", function(e) {
            e.preventDefault();
            ptr.setActive(true);
        });

        elm.addEventListener("mouseout", function(e) {
            e.preventDefault();
            onClient(e);
            ptr.setActive(false);
        });

        elm.addEventListener("mousemove", onClient);
    };

    /**
    タッチ処理
    */
    Main.prototype.setUpTouch = function() {
        var ptr = this.pointer;
        var elm = this.canvas;
        var id = 0;

        var release = function() {
            ptr.setTapping(false);
            id = 0;
        };

        var callback = function(e) {
            var touch = e.changedTouches[0];
            var rect = null;
            var scale;
            var x;
            var y;

            e.preventDefault();

            if (id === 0 && e.type === "touchstart") {
                id = touch.identifier;
                ptr.setTapping(true);
            } else if (e.type === "touchend") {
                id = 0;
            }

            if (id === touch.identifier) {
                rect = e.target.getBoundingClientRect();
                scale = settings.WIDTH / rect.width;
                x = Math.floor((touch.clientX - rect.left) * scale);
                y = Math.floor((touch.clientY - rect.top) * scale);

                if (calc.isPointInRect(
                    x,
                    y,
                    0,
                    0,
                    settings.WIDTH,
                    settings.HEIGHT
                )) {
                    ptr.setActive(true);
                    ptr.setPosition(x, y);
                } else {
                    ptr.setActive(false);
                }
            }
        };

        elm.addEventListener("touchstart", callback, false);
        elm.addEventListener("touchmove", callback, false);
        elm.addEventListener("touchend", release, false);
        elm.addEventListener("touchcancel", release, false);
    };

    /**
    ボタン類
    */
    Main.prototype.setUpUI = function() {
        var btReset = document.getElementById(settings.ID_RESET);
        var chkSnd = document.getElementById(settings.ID_SOUND);
        var chkVib = document.getElementById(settings.ID_VIB);

        if (btReset) {
            btReset.addEventListener("click", function() {
                btReset.blur();
                this.game.gotoTitle();
            }.bind(this), false);
        }

        if (chkSnd) {
            chkSnd.checked = false;
            chkSnd.addEventListener("change", function(e) {
                chkSnd.blur();
                this.sndManager.enableSound = e.target.checked;
                if (chkSnd.checked) {
                    this.sndManager.loadAssets(sounds);
                }
            }.bind(this), false);
        }

        if (chkVib) {
            chkVib.checked = false;
            chkVib.addEventListener("change", function(e) {
                chkVib.blur();
                this.sndManager.enableVibrate = e.target.checked;
                if (chkVib.checked) {
                    this.sndManager.playSound(sounds.vibTest);
                }
            }.bind(this), false);
        }
    };

    /**
    タイマー処理
    */
    Main.prototype.setUpTimer = function() {
        var WAIT = 50;
        var repaint = this.enterFrame.bind(this);
        var timer;

        addEventListener("focus", function() {
            if (timer === 0) {
                timer = setInterval(repaint, WAIT);
            }
        }, false);

        addEventListener("blur", function() {
            clearInterval(timer);
            timer = 0;
        }, false);

        timer = setInterval(repaint, WAIT);
    };

    /**
    ゲーム開始
    */
    Main.prototype.setUp = function() {
        this.setUpMouse();
        this.setUpTouch();
        this.setUpUI();
        this.setUpTimer();
    };

    new Main().setUp();
}());
