// Kurihiroi, Version 0.4.0
// Written in 2017, 2018, 2019 by yunari.
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.

// You should have received a copy of the CC0 Public Domain Dedication along
// with this software. If not, see:
// http://creativecommons.org/publicdomain/zero/1.0/

(function () {
    "use strict";

    // 設定
    var conf = {
        VERSION: "Version 0.4.0",
        ID_CANVAS: "js-kurihiroi-canvas",
        ID_BTN_RESET: "js-kurihiroi-btn-reset",
        URL_SPRITE: "sprite.png",
        URL_BACKGROUND: "background.png",
        URL_TITLE: "title.png",
        FONT: "bold 20px sans-serif",
        FONT_PAUSE: "bold 32px sans-serif",
        FONT_TOAST: "48px sans-serif"
    };

    // メッセージなどの文字列
    var strings = {
        SCORE: "Score",
        HIGHSCORE: "Hi",
        COMBO: "hits!",
        GAMEOVER: "Game over!",
        PAUSE: "クリックで もどる",
        START: "Start!",
        LEVELUP: "Level up!"
    };

    // レベルごとの定義
    // wait 敵が出現する時間間隔
    // next レベルアップに必要な得点
    // waitPlus 落下時間へのランダムなばらつき
    // どれもデフォルトは0
    var levelset = [
        {wait: 50, next: 100},
        {wait: 30, next: 500},
        {wait: 10, waitPlus: 40, next: 2500},
        {waitPlus: 50}
    ];

    // プレイヤーオブジェクト
    function makePlayer(initialX, initialY) {
        var that = {
            x: initialX,
            y: initialY,
            RADIUS: 12,
            HEIGHT: 24
        };
        var WALK_VEL = 4;
        var direction = -1; // -1: 左向き, 1: 右向き
        var distance = 0; // 移動先との距離
        var walkingTime = 0; // 移動中、1以上の値をとる
        var jumping = 0;
        var alive = true;

        // 生きているか?
        that.isAlive = function () {
            return alive;
        };

        // 敵にぶつかっているか?
        that.isHitEnemy = function (en) {
            var colledX = Math.abs(that.x - en.x) < that.RADIUS + en.RADIUS;
            var colledY = that.y - that.HEIGHT <= en.y;
            return colledX && colledY;
        };

        // 歩く
        function walk() {
            var destination = that.x + distance; // 移動先

            direction = (distance > 0
                ? 1
                : -1);
            if (Math.abs(distance) > WALK_VEL) {
                that.x += WALK_VEL * direction;
            } else {
                that.x = destination;
            }
        }

        // 更新
        that.update = function () {
            if (jumping > 0) {
                jumping -= 1;
            }
            if (alive && distance !== 0) {
                walk();
                distance = 0;
                walkingTime += 1;
            } else {
                walkingTime = 0;
            }
        };

        // 歩き先を座標で指定する
        that.setWalkingPos = function (x) {
            distance = x - that.x;
        };

        // 歩き先を向きで指定する
        that.setWalkingDir = function (dir) {
            distance = WALK_VEL * dir;
        };

        // ジャンプさせる
        that.onJump = function () {
            jumping = 4;
        };

        // ダメージを与える
        that.onDamage = function () {
            alive = false;
        };

        // 指定範囲内におさめる
        that.clipPosition = function (left, right) {
            var leftCliped = Math.max(that.x, left + that.RADIUS);
            that.x = Math.min(leftCliped, right - that.RADIUS);
        };

        // 表示
        that.render = function (g) {
            var sx = (alive
                ? (walkingTime === 0
                    ? 0
                    : 1 + Math.floor(walkingTime / 2) % 2)
                : 3);
            var sy = 1;

            if (jumping > 0) { // クリをかつぐ
                sx = 0;
                sy = 2;
                g.drawSprite(g.ctx, 2, 0, that.x - 16, that.y - 56);
            }
            g.drawSprite(g.ctx, sx, sy, that.x - 16, that.y - 32, direction);
        };

        return that;
    }

    // 敵キャラオブジェクト
    function makeEnemy(initialX, initialY) {
        var that = {
            x: initialX,
            y: initialY,
            RADIUS: 13
        };
        var vy = -2; // Y軸の移動量
        var opened = false; // 殻が割れている後はtrue
        var hitstop = 0; // 0より大きい間、地面でストップする
        var ttl = 100; // 0になると消える

        // 生きてるか?
        that.isAlive = function () {
            return ttl > 0;
        };

        // 拾えるか?
        that.canCatch = function () {
            return opened;
        };

        // 落下中か?
        that.isFall = function () {
            return vy >= 0;
        };

        // 更新
        that.update = function () {
            var MAX_FALL = 16;
            var BOUNCE = 14;

            if (hitstop <= 0) {
                vy = Math.min(vy + 1, MAX_FALL);
            } else {
                hitstop -= 1;
                if (hitstop <= 0) {
                    vy = -BOUNCE;
                    opened = true;
                }
            }
            that.y += vy;

            if (opened && ttl > 0) {
                ttl -= 1;
            }
        };

        // 地面との接触
        that.onGround = function (bottom) {
            var STOP = 4; // ストップするフレーム数

            if (vy > 0 && that.y >= bottom) {
                vy = 0;
                that.y = bottom;
                if (!opened) {
                    hitstop = STOP;
                }
            }
        };

        // キャッチされる
        that.onCatched = function () {
            ttl = 0;
        };

        // 表示
        that.render = function (g) {

            // 生存時間がこれを下回るとフェードアウト開始
            var FEEDOUT = 20;

            var sx = (opened
                ? 2 + Math.floor(ttl / 2) % 2
                : (hitstop > 0
                    ? 1
                    : 0));
            var sy = 0;

            g.ctx.save();
            if (ttl < FEEDOUT) {
                g.ctx.globalAlpha = ttl / FEEDOUT;
            }
            g.drawSprite(g.ctx, sx, sy, that.x - 16, that.y - 32);
            g.ctx.restore();
        };

        return that;
    }

    // 乱数生成関数を返す
    function makeGetRandom(range, record) {
        var history = [];

        if (range < record) {
            throw new Error("kurihiroi: range < record");
        }

        // 履歴とかぶらない乱数を作る
        function generate() {
            var n = Math.floor(range * Math.random());
            return (history.indexOf(n) !== -1
                ? generate()
                : n);
        }

        // 乱数を返し、履歴を記録する
        return function () {
            var n = generate();
            history.push(n);
            if (history.length > record) {
                history.shift();
            }
            return n;
        };
    }

    // コンボ管理オブジェクト
    function makeCombo() {
        var MAX_TIME = 30;
        var time = 0;
        var combo = 0;

        return {

            // 更新
            // 一定時間経つとコンボ数0
            update: function () {
                if (time > 0) {
                    time -= 1;
                    if (time <= 0) {
                        combo = 0;
                    }
                }
            },

            // コンボ数を表示する
            render: function (ctx) {
                ctx.fillStyle = "#FFFFCC";
                ctx.save();
                ctx.globalAlpha = time / MAX_TIME;
                ctx.font = conf.FONT_TOAST;
                ctx.textAlign = "right";
                ctx.fillText(combo + " " + strings.COMBO, 320 - 16, 48);
                ctx.restore();
            },

            // コンボ数を返す
            get: function () {
                return combo;
            },

            // コンボを増やす
            add: function () {
                combo += 1;
                time = MAX_TIME;
            }
        };
    }

    // ゲーム画面オブジェクト
    function makeGame(levelset) {
        var RETRYING_TIME = 40;
        var LEFT = 48; // 床の左端
        var RIGHT = 320 - LEFT; // 床の右端
        var GROUND_Y = 320 - 48; // 床の位置
        var EN_RANGE = 7; // 敵の出現範囲の細かさ
        var EN_MAX = 5; // 敵の数

        var player = makePlayer((LEFT + RIGHT) / 2, GROUND_Y);
        var combo = makeCombo();
        var score = 0;

        var enemies = [];
        var enWait = 30; // 0になると敵が出現する

        var levelTime = 0;
        var levelNo = 0;
        var falls = 0;
        var gameover = 0; // ミス後に1以上の値をとる

        // 乱数を返す関数
        var getRandom = makeGetRandom(EN_RANGE, EN_MAX);

        // 次のレベルが存在するか?
        function hasNextLevel() {
            return levelNo + 1 < levelset.length;
        }

        // レベルを上げる
        function addLevel() {
            levelTime = 0;
            levelNo += 1;
            enWait = 100;
        }

        // プレイヤーを動かす
        function updatePlayer(pl, cursor, keys) {
            if (cursor.tapping) {
                pl.setWalkingPos(cursor.x);
            } else if (keys.axes !== 0) {
                pl.setWalkingDir(keys.axes);
            }
            pl.update();
            pl.clipPosition(LEFT, RIGHT);
        }

        // 敵とプレイヤーの接触
        function hitEnemyPlayer(en, pl) {
            var BASE = 10; // 基本スコア
            var BONUS = 5; // コンボによる増分

            if (en.isFall() && pl.isAlive() && pl.isHitEnemy(en)) {
                if (en.canCatch()) {
                    en.onCatched();
                    score += combo.get() * BONUS + BASE;
                    combo.add();
                    pl.onJump();
                } else {
                    pl.onDamage();
                }
            }
        }

        // 敵を出現させる
        function encountEnemy() {
            var RANGE = RIGHT - LEFT;
            var TOP = 64;
            var DOWN = 160;
            var INTERVAL = 10; // 落下位置を下げる個数の基準
            var INC = 8; // 落下位置の下がる量

            enemies.push(makeEnemy(
                getRandom() / (EN_RANGE - 1) * RANGE + LEFT,
                Math.min(INC * Math.floor(falls / INTERVAL) + TOP, DOWN)
            ));
        }

        // 更新
        function update(cursor, keys) {
            var level = levelset[levelNo];

            levelTime += 1;
            if (!player.isAlive()) {
                gameover += 1;
            }

            combo.update();
            updatePlayer(player, cursor, keys);

            enemies = enemies.filter(function (en) {
                en.update();
                en.onGround(GROUND_Y);
                hitEnemyPlayer(en, player);
                return en.isAlive(); // 生存中の敵だけが配列に残る
            });

            enWait -= 1; // 敵キャラ出現待ち
            if (player.isAlive() && enWait <= 0) {

                // 次の敵を待つ時間は、レベルに応じて変動する
                enWait = ((level.wait || 0)
                    + Math.floor((level.waitPlus || 0) * Math.random()));
                if (enemies.length < EN_MAX) {
                    encountEnemy();
                    falls += 1;
                }
            }

            if (hasNextLevel() && score >= level.next) {
                addLevel();
            }
        }

        // トーストを表示
        function renderToast(ctx, time, str) {
            var BLINK = 20;
            var visibility = (time > RETRYING_TIME
                || time % BLINK / BLINK < 0.5);

            if (visibility) {
                ctx.fillStyle = "#FFFFFF";
                ctx.save();
                ctx.font = conf.FONT_TOAST;
                ctx.textAlign = "center";
                ctx.fillText(str, 160, 160);
                ctx.restore();
            }
        }

        // 表示
        function render(g) {
            var ctx = g.ctx;

            // 背景とキャラクター
            ctx.drawImage(g.imgLoader.getImage("background"), 0, 0);
            player.render(g);
            enemies.forEach(function (en) {
                en.render(g);
            });

            // スコア
            ctx.fillStyle = "#FFFFFF";
            ctx.save();
            ctx.font = conf.FONT;
            ctx.fillText(strings.SCORE + " " + score, 16, 32);
            ctx.restore();

            // トースト類
            if (combo.get() >= 2) {
                combo.render(ctx);
            }
            if (gameover > 0) {
                renderToast(ctx, gameover, strings.GAMEOVER);
            } else if (levelTime < 40) {
                renderToast(ctx, levelTime, (levelNo === 0
                    ? strings.START
                    : strings.LEVELUP));
            }
        }

        return {

            // ゲームオーバーか?
            isEnd: function () {
                return gameover >= RETRYING_TIME;
            },

            // スコアを返す
            getScore: function () {
                return score;
            },

            update: update,
            render: render
        };
    }

    // メインオブジェクト
    function makeMain() {
        var modeName = "";
        var paused = false;
        var highscore = 0;
        var game = null;

        // タイトルへ遷移する
        function gotoTitle() {
            modeName = "Title";
            if (game) {
                highscore = Math.max(game.getScore(), highscore);
            }
        }

        // ゲームを開始する
        function gotoGame() {
            modeName = "Game";
            paused = false;
            game = makeGame(levelset);
        }

        // ハイスコアを表示する
        function renderHighscore(ctx) {
            ctx.fillStyle = "#996666";
            ctx.save();
            ctx.font = conf.FONT;
            ctx.fillText(strings.HIGHSCORE + " " + highscore, 16, 32);
            ctx.restore();
        }

        // バージョン情報を表示する
        function renderVersion(ctx) {
            ctx.fillStyle = "#996666";
            ctx.save();
            ctx.font = conf.FONT;
            ctx.textAlign = "right";
            ctx.fillText(conf.VERSION, 320 - 16, 32);
            ctx.restore();
        }

        // ポーズ画面を表示する
        function renderPause(ctx) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, 0, 320, 320);

            ctx.fillStyle = "#FFFFFF";
            ctx.save();
            ctx.font = conf.FONT_PAUSE;
            ctx.textAlign = "center";
            ctx.fillText(strings.PAUSE, 160, 160);
            ctx.restore();
        }

        // モード別の動作
        var mode = {

            "Title": function (g, cursor, keys) {
                g.ctx.drawImage(g.imgLoader.getImage("title"), 0, 0);
                renderVersion(g.ctx);
                if (highscore > 0) {
                    renderHighscore(g.ctx);
                }

                if (cursor.clicked || keys.space) {
                    gotoGame();
                }
            },

            "Game": function (g, cursor, keys) {
                if (keys.esc) {
                    gotoTitle();
                    return;
                }

                if (!paused) {
                    game.update(cursor, keys);
                }
                game.render(g);
                if (paused) {
                    renderPause(g.ctx);
                }

                if (paused && cursor.clicked) {
                    paused = false;
                } else if (game.isEnd() && cursor.clicked) {
                    gotoTitle();
                }
            }
        };

        gotoTitle();
        return {

            // タイマー割り込み
            doTick: function (g, cursor, keys) {
                mode[modeName](g, cursor, keys);
            },

            // プレイ中か?
            isPlaying: function () {
                return modeName !== "Title";
            },

            // ポーズする
            setPause: function () {
                paused = true;
            },

            // リセットする
            reset: gotoTitle
        };
    }

    // スプライトの定義を元に表示用の関数を返す
    function makeSprite(img, w, h) {

        // 表示関数
        return function (ctx, sx, sy, dx, dy, opt_mirror) {
            var x = Math.floor(dx);
            var y = Math.floor(dy);

            ctx.save();
            if (opt_mirror > 0) {
                ctx.scale(-1, 1);
                x = -x - w;
            }
            ctx.drawImage(img, sx * w, sy * h, w, h, x, y, w, h);
            ctx.restore();
        };
    }

    // マウス・タッチパネルを抽象化し、カーソル状態取得関数を返す
    function makeCursorGetter(canvas) {
        var x = 0;
        var y = 0;
        var tapping = false; // ボタン押下中にtrue
        var swClicked = false;
        var idTouch = -1;

        // マウスの座標を更新する
        function moveClient(clientX, clientY) { // クライアント左上基準
            var rect = canvas.getBoundingClientRect();
            var coef = canvas.width / rect.width;
            x = Math.floor((clientX - rect.left) * coef);
            y = Math.floor((clientY - rect.top) * coef);
        }

        // マウスボタンが押される
        function startCursor(clientX, clientY) {
            moveClient(clientX, clientY);
            tapping = true;
        }

        // マウスボタンが離される
        function releaseCursor() {
            tapping = false;
            swClicked = (x >= 0
                && x < canvas.width
                && y >= 0
                && y < canvas.height);
        }

        // マウスイベント。主ボタンのみを監視する。

        window.addEventListener("mousemove", function (e) {
            if (tapping) {
                e.preventDefault();
            }
            moveClient(e.clientX, e.clientY);
        }, false);

        canvas.addEventListener("mousedown", function (e) {
            if (e.button === 0) {
                e.preventDefault();
                startCursor(e.clientX, e.clientY);
            }
        }, false);

        window.addEventListener("mouseup", function (e) {
            if (e.button === 0) {
                e.preventDefault();
                releaseCursor();
            }
        }, false);

        // タッチイベント
        // 最新のタッチのみを監視する

        canvas.addEventListener("touchstart", function (e) {
            var tch = e.changedTouches[0];
            e.preventDefault();
            idTouch = tch.identifier;
            startCursor(tch.clientX, tch.clientY);
        }, false);

        canvas.addEventListener("touchmove", function (e) {
            var tch = e.changedTouches[0];
            e.preventDefault();
            if (tch.identifier === idTouch) {
                moveClient(tch.clientX, tch.clientY);
            }
        }, false);

        canvas.addEventListener("touchend", function (e) {
            var tch = e.changedTouches[0];
            e.preventDefault();
            if (tapping && tch.identifier === idTouch) {
                releaseCursor();
            }
        }, false);

        // 最新のカーソル状態を返す関数
        return function () {
            var clicked = swClicked;
            swClicked = false;
            return {x: x, y: y, tapping: tapping, clicked: clicked};
        };
    }

    // キー入力管理オブジェクト
    function makeKeyManager() {
        var nowListen = false;
        var table = {
            32: false, // space
            37: false, // ArrowLeft
            39: false, // ArrowRight
            38: false, // ArrowUp
            40: false, // ArrowDown
            27: false // Escape
        };

        function onKeyboard(e) {
            var kc = e.keyCode;

            if (nowListen && table.hasOwnProperty(kc)) {
                e.preventDefault();
                table[kc] = e.type !== "keyup";
            }
        }

        window.addEventListener("keydown", onKeyboard);
        window.addEventListener("keyup", onKeyboard);

        return {

            start: function () {
                nowListen = true;
            },

            stop: function () {
                nowListen = false;
                Object.keys(table).forEach(function (key) {
                    table[key] = false;
                });
            },

            getKeys: function () {
                var axes = (table[37] !== table[39]
                    ? (table[39]
                        ? 1
                        : -1)
                    : 0);

                return {
                    axes: axes,
                    space: table[32],
                    esc: table[27]
                };
            }
        };
    }

    // 画像ローダオブジェクト
    function makeImageLoader(list) {
        var images = {};

        Object.keys(list).forEach(function (i) {
            var img = document.createElement("img");
            img.src = list[i];
            images[i] = img;
        });

        return {

            // 画像を返す
            getImage: function (name) {
                return images[name] || null;
            },

            // ロードが全て終わっているか?
            hasLoadedAll: function () {
                return Object.keys(images).every(function (i) {
                    return images[i].complete;
                });
            }
        };
    }

    // 初期化
    // 既定のIDを持つcanvas要素を検出してゲームを起動する
    function init() {
        var SLEEP = 50;

        var can = document.getElementById(conf.ID_CANVAS);
        if (!(can && can.getContext)) {
            throw new Error("kurihiroi: no canvas.");
        }

        var ctx = can.getContext("2d");
        var imgLoader = makeImageLoader({
            sprite: conf.URL_SPRITE,
            background: conf.URL_BACKGROUND,
            title: conf.URL_TITLE
        });
        var keyManager = makeKeyManager();

        var main = null;

        var getCursor = makeCursorGetter(can);
        var drawSprite = makeSprite(imgLoader.getImage("sprite"), 32, 32);

        // 画像読み込み完了時の動作
        function doLoaded(main) {
            var btn = document.getElementById(conf.ID_BTN_RESET);

            if (btn) {
                btn.addEventListener("click", function () {
                    btn.blur();
                    main.reset();
                });
            }

            window.addEventListener("click", function (e) {
                keyManager[(e.target === can
                    ? "start"
                    : "stop")]();
            });

            window.addEventListener("blur", function () {
                keyManager.stop();
                main.setPause();
            });
        }

        // タイマー割り込み
        setInterval(function () {
            if (!main && imgLoader.hasLoadedAll()) {
                main = makeMain();
                doLoaded(main);
            } else if (main) {
                main.doTick({
                    ctx: ctx,
                    imgLoader: imgLoader,
                    drawSprite: drawSprite
                }, getCursor(), keyManager.getKeys());
            }
        }, SLEEP);
    }

    init();
}());
