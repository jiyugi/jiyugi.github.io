// Takodia, Version 0.1.0
// Written in 2019 by yunari.
// To the extent possible under law, the author(s) have dedicated all copyright
// and related and neighboring rights to this software to the public domain
// worldwide. This software is distributed without any warranty.

// You should have received a copy of the CC0 Public Domain Dedication along
// with this software. If not, see:
// http://creativecommons.org/publicdomain/zero/1.0/

(function () {
    "use strict";

    var LEFT = -1;
    var RIGHT = 1;
    var SIZE = 384;
    var SPEED = 4;

    var FONT = "20px sans-serif";
    var FONT_BIG = "32px sans-serif";
    var FONT_BIGGEST = "64px sans-serif";

    // Scoreなどの文字を上下中央揃えにする際、
    // textBaselineが "middle" だと一部のフォントで崩れるため、
    // より誤差の少ない "alphabetic" 指定で位置を下にずらす事で代用する。
    var GAP_Y = 7; // 下にずらす量

    var TIME_INTRO = 19;
    var TIME_ACTION = 10;
    var TIME_GOAL = 30;
    var TIME_EATEN = 80;

    var canvas = document.getElementById("takodia-canvas");
    var title = document.getElementById("takodia-titleimg"); // タイトル画像
    var sprite = document.getElementById("takodia-spriteimg"); // スプライト
    var background = document.getElementById("takodia-backgroundimg"); // 背景
    var frame = document.getElementById("takodia-frameimg"); // 枠
    var resetBtn = document.getElementById("takodia-reset");
    var nojs = document.getElementById("takodia-nojs");

    // カーソル情報。クリックの瞬間、clickedがtrueになる。
    var cursor = {x: 0, y: 0, active: false, clicked: false};

    var focused = true; // ページから離れるとfalseになる。
    var ctx;

    if (!(window.addEventListener && canvas.getContext)) {
        return;
    }
    if (nojs) {
        nojs.parentNode.removeChild(nojs);
    }

    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx = canvas.getContext("2d");

    // 汎用関数

    function round(n) { // 5捨5入
        return (Number(n) > 0
            ? Math.floor(n + 0.5)
            : Math.ceil(n - 0.5));
    }

    // キャラクターコントローラー
    // 各キャラクターは x, y の2D座標を持つ。

    function makeItem(type) { // アイテムを作る。
        return {x: 0, y: 0, active: true, type: type};
    }

    function makeActor() { // アクター(可動キャラクター)を作る。
        return {x: 0, y: 0, vx: 0, vy: 0, direction: LEFT};
    }

    function clip(p, rect, hook) { // rect内に収める。
        var preX = p.x;
        var preY = p.y;

        p.x = Math.max(Math.min(p.x, rect.x + rect.sizeX), rect.x);
        p.y = Math.max(Math.min(p.y, rect.y + rect.sizeY), rect.y);

        if (typeof hook === "function" && !(preX === p.x && preY === p.y)) {
            hook(preX, preY); // はみ出した時のフック処理
        }
    }

    function randomiseXY(p, rect) { // rect内のランダムな位置に配置。
        p.x = rect.x + Math.floor(rect.sizeX * Math.random());
        p.y = rect.y + Math.floor(rect.sizeY * Math.random());
    }

    function isNear(a, b, range) { // 距離がrange以下か?
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return dx * dx + dy * dy <= range * range;
    }

    function isNearSome(list, p, range) { // list中にpと近いものがあるか?
        if (list.length === 0) {
            return false;
        }
        return (isNear(list[0], p, range)
            || isNearSome(list.slice(1), p, range));
    }

    function turnTo(a, b) { // アクターに他キャラクターの方を向かせる。
        a.direction = (a.x < b.x
            ? RIGHT
            : LEFT);
    }

    function move(a) { // アクターを動かす。
        a.x += a.vx;
        a.y += a.vy;
    }

    function setVelocity(a, rad, step) { // アクターの速度を向き・速さで指定
        a.vx = round(step * Math.cos(rad));
        a.vy = round(step * Math.sin(rad));
        if (a.vx !== 0) {
            a.direction = (a.vx < 0
                ? LEFT
                : RIGHT);
        }
    }

    function chase(a, b) { // アクターに他キャラクターを追いかけさせる。
        setVelocity(a, Math.atan2(b.y - a.y, b.x - a.x), SPEED);
    }

    // 敵にタコを追わせる。hateが小さいと気まぐれ
    function chasePlayer(en, pl, hate) {

        // 角度を求める。
        // 'ahead'ぶん進ませた位置を使い、先回りする。
        var ahead = Math.min(Math.floor(hate / 10), 10);
        var rad = Math.atan2(
            pl.y + pl.vy * ahead - en.y,
            pl.x + pl.vx * ahead - en.x
        );

        // 角度にばらつきを与える。
        var range = Math.max(300 - 2 * hate, 90);
        var widly = range * (Math.random() - 0.5) * Math.PI / 180;

        setVelocity(en, rad + widly, SPEED);
    }

    function bounce(en, x, y) { // 敵が壁や障害物で跳ね返る。
        if (en.vx * (en.x + en.vx) <= en.vx * x) {
            en.x -= en.vx;
            en.vx *= -1;
        }
        if (en.vy * (en.y + en.vy) <= en.vy * y) {
            en.y -= en.vy;
            en.vy *= -1;
        }
    }

    // ゲームロジック

    // キャラ移動範囲
    var field = {x: 48, y: 48, sizeX: SIZE - 2 * 48, sizeY: SIZE - 2 * 48};

    var item = { // アイテムの種類
        gem: {value: 1, imgName: "itemGem"},
        tri: {value: 3, imgName: "itemTri"},
        met: {value: 0, imgName: "itemMet"}
    };

    var player = makeActor(); // タコ
    var enemy = makeActor(); // 敵
    var wave = {x: 0, y: 0, ttl: 0}; // アイテム取得時の波
    var itemList = [];

    // ツボ
    var pot = {x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2), active: true};

    var met = false; // メット装着フラグ
    var shock = 0; // 敵が動けないターン数

    var jewel = 0; // 宝石所持数
    var score = 0; // 宝石を持ち帰った数
    var time = 0; // 経過フレーム数
    var hiscore = 0;

    var gameUpdater = {}; // シーンごとの処理テーブル
    var scene = "intro"; // 現在のシーン名。gameUpdaterの添字になる。
    var sceneTime = 0; // シーンごとの経過フレーム数

    function saveScore() { // ハイスコアを記録する。
        if (score > hiscore) {
            hiscore = score;
        }
    }

    function gotoScene(str) { // シーンを切り替える。
        scene = str;
        sceneTime = 0;
    }

    // 各キャラ初期化。他キャラと距離を置く。

    function resetItem(list) {
        var MAX = 7;
        var metflag = score >= 50;

        function put(type) {
            var gem = makeItem(type);
            do {
                randomiseXY(gem, field);
            } while (isNearSome(list.concat([pot]), gem, 80));
            list.push(gem);
        }

        list.length = 0;
        put(item.tri);
        while (list.length < MAX) {
            put(item.gem);
        }
        if (metflag) {
            put(item.met);
        }
    }

    function resetEnemy(en) {
        randomiseXY(en, field);
        if (isNearSome(itemList.concat([pot]), en, 80)) {
            return resetEnemy(en);
        }
    }

    function resetWave(x, y) { // アイテム取得時の波を発生させる。
        wave.x = x;
        wave.y = y;
        wave.ttl = 10;
    }

    function respawn() { // 開始/再開
        if (getGemCount(itemList) === 0) {
            resetItem(itemList);
        }
        player.x = pot.x;
        player.y = pot.y - 32;
        met = false;
        shock = 0;
        resetEnemy(enemy);

        turnTo(player, enemy);
        turnTo(enemy, player);

        gotoScene("intro");
    }

    function initGame() { // 開始時のみ行う初期化
        jewel = 0;
        score = 0;
        itemList = [];
        respawn();
    }

    function startAction() { // キャラに行動開始させる。
        chase(player, cursor);
        if (shock > 0) {
            enemy.vx = 0;
            enemy.vy = 0;
        } else {
            chasePlayer(enemy, player, score);
        }
    }

    function getGemCount(list) { // 宝石の数を数える。
        var cnt = 0;
        var i;

        for (i = 0; i < list.length; i += 1) {
            if (list[i].active && list[i].type.value > 0) {
                cnt += 1;
            }
        }
        return cnt;
    }

    function getColliedItem(list, a, range) { // ぶつかっている宝石を返す。
        var o = list[0];
        if (!o) {
            return null;
        }
        return ((o.active && isNear(a, o, range))
            ? o
            : getColliedItem(list.slice(1), a, range));
    }

    function checkItem(list, pl) { // 宝石とタコの当たり判定。
        var o = getColliedItem(list, pl, 25);
        if (o) {
            o.active = false;
            jewel += o.type.value;
            resetWave(o.x, o.y);
            if (o.type === item.met) {
                met = true;
            }
        }
    }

    function checkItemEnemy(list, en) { // 宝石と敵の当たり判定。
        var o = getColliedItem(list, en, 25);
        if (o) {
            bounce(en, o.x, o.y);
        }
    }

    function hitMet() { // メットで敵を防ぐ。
        shock = 2;
        bounce(enemy, player.x, player.y);
        player.vx = 0;
        player.vy = 0;
    }

    function doAction() { // キャラを動かし、移動後の処理をする。
        move(player);
        clip(player, field);

        move(enemy);
        clip(enemy, field, function (preX, preY) {
            bounce(enemy, preX, preY);
        });
        checkItemEnemy(itemList.concat([pot]), enemy); // potもactiveを持つ。

        checkItem(itemList, player);
        if (jewel > 0 && isNear(player, pot, 25)) {
            gotoScene("goal");
        } else if (isNear(player, enemy, 25)) {
            if (met) {
                hitMet();
                met = false;
            } else if (shock === 0) {
                turnTo(enemy, player);
                gotoScene("eaten");
            }
        }
    }

    // シーンごとの処理

    gameUpdater.idle = function () { // 操作待ち
        if (cursor.clicked) {
            startAction();
            gotoScene("action");
            sceneTime += 1;
            doAction();
        }
    };

    gameUpdater.intro = function () { // ツボから出てくる
       if (sceneTime >= TIME_INTRO) {
           gotoScene("idle");
       }
    };

    gameUpdater.goal = function () { // ツボに入る
        player.x = Math.floor((player.x + pot.x) / 2);
        player.y = Math.floor((player.y + pot.y - 16) / 2);

        if (sceneTime >= TIME_GOAL) {
            score += jewel;
            jewel = 0;
            respawn();
        }
    };

    gameUpdater.eaten = function () { // 食べられる
        var dx = -16 * enemy.direction;

        enemy.x = Math.floor((enemy.x + player.x + dx) / 2);
        enemy.y = Math.floor((enemy.y + player.y) / 2);

        if (sceneTime >= TIME_EATEN) {
            gotoScene("gameover");
        }
    };

    gameUpdater.action = function () { // 行動中
        doAction();
        if (sceneTime >= TIME_ACTION) {
            if (shock > 0) {
                shock -= 1;
            }
            gotoScene("idle");
        }
    };

    gameUpdater.title = function () { // タイトル画面
        if (cursor.clicked) {
            initGame();
        }
    };

    gameUpdater.gameover = function () { // ゲームオーバー
        if (cursor.clicked) {
            saveScore();
            gotoScene("title");
        }
    };

    function update() { // 状態更新
        time += 1;
        sceneTime += 1;
        if (wave.ttl > 0) {
            wave.ttl -= 1;
        }
        gameUpdater[scene](); // シーンごとの処理
    }

    // 表示

    function makeCell(x, y, w, h) { // スプライト画像から1枚を切り出す。
        w = w || 1;
        h = h || 1;
        return {x: 32 * x, y: 32 * y, sizeX: w * 32, sizeY: h * 32};
    }

    function shift(re, n) { // スプライトの切り出し範囲を右にずらす。
        var dx = re.sizeX * n;
        return {x: re.x + dx, y: re.y, sizeX: re.sizeX, sizeY: re.sizeY};
    }

    var cell = { // スプライトの分割情報
        player: makeCell(0, 0),
        playerH: makeCell(2, 0),
        playerU: makeCell(4, 0),
        playerD: makeCell(6, 0),
        playerIntro: makeCell(0, 3),
        playerGoal: makeCell(7, 3),
        met: makeCell(1, 0),
        enemy: makeCell(0, 2),
        enemyEatFirst: makeCell(4, 1, 1, 2),
        enemyEatEnd: makeCell(6, 2, 2, 1),
        itemGem: makeCell(0, 1),
        itemTri: makeCell(1, 1),
        itemMet: makeCell(2, 1),
        pot: makeCell(6, 1),
        guideDot: makeCell(8, 0),
        balloon: makeCell(9, 0),
        balloonD: makeCell(9, 1),
        gemIcon: makeCell(3, 1)
    };

    function drawSprite(rect, x, y, dir) { // dirがRIGHTなら反転
        var w = rect.sizeX;
        var h = rect.sizeY;

        ctx.save();
        if (dir === RIGHT) {
            ctx.scale(-1, 1);
            ctx.translate(-(2 * x + w), 0);
        }
        ctx.drawImage(sprite, rect.x, rect.y, w, h, x, y, w, h);
        ctx.restore();
    }

    function setFont(font, align, baseline) { // フォント関連を一括指定
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
    }

    function renderPlayer(pl) {
        var dy = 0;
        var rect = cell.player;

        if (scene === "intro") {
            dy = 16;
            if (sceneTime < 15) {
                rect = shift(cell.playerIntro, Math.floor(sceneTime / 3));
            } else {
                dy -= (sceneTime - 15) * 4;
                rect = shift(cell.playerIntro, 6);
            }
        } else if (scene === "action" || scene === "eaten") {
            rect = cell[(Math.abs(pl.vy) <= 1
                ? "playerH"
                : (pl.vy < 0
                    ? "playerU"
                    : "playerD"))];
            if (scene === "action") { // 泳ぐ。
                rect = shift(rect, Math.floor(sceneTime / 2) % 2);
            }
        } else if (scene === "goal") {
            rect = shift(cell.playerGoal, Math.floor(sceneTime / 7));
        }

        drawSprite(rect, pl.x - 16, pl.y - 16 + dy, pl.direction);
        if (met && !(scene === "goal" || scene === "intro")) {
            drawSprite(cell.met, pl.x - 16, pl.y - 24, pl.direction);
        }
    }

    function renderEnemy(en) {
        var dx = -16;
        var dy = -16;
        var rect = shift(cell.enemy, Math.floor(time / 5) % 4);

        if (scene === "eaten") {
            if (sceneTime < 40) {
                rect = cell.enemyEatFirst;
                dy = -31 - sceneTime % 2;
            } else {
                rect = cell.enemyEatEnd;
                if (sceneTime >= 60 && sceneTime < 70) {
                    rect = shift(rect, 1);
                }
                dx = -32 + 16 * en.direction;
            }
        }

        drawSprite(rect, en.x + dx, en.y + dy, en.direction);
    }

    function renderItem(list) {
        var o;
        var i;
        for (i = 0; i < list.length; i += 1) {
            o = list[i];
            if (o.active) {
                drawSprite(cell[o.type.imgName], o.x - 16, o.y - 16, LEFT);
            }
        }
    }

    function renderBackground() {
        var w = SIZE;
        var h = w;
        var x = time % w;

        ctx.drawImage(background, 0, 0, w, h, x, 0, w, h);
        ctx.drawImage(background, 0, 0, w, h, x - w, 0, w, h);
        ctx.drawImage(background, 0, h, w, h, -x, 0, w, h);
        ctx.drawImage(background, 0, h, w, h, -x + w, 0, w, h);
    }

    function renderGuide(pl, csr) {
        var rad = Math.atan2(csr.y - pl.y, csr.x - pl.x);
        var vx = 2 * round(SPEED * Math.cos(rad));
        var vy = 2 * round(SPEED * Math.sin(rad));
        var i;

        for (i = 3; i <= 5; i += 1) {
            drawSprite(cell.guideDot, pl.x - 16 + vx * i, pl.y - 16 + vy * i);
        }
    }

    function renderGoal() {
        var MAX = 20;
        var pad = Math.floor((SIZE / 2) * (sceneTime / MAX));

        ctx.fillStyle = "#699";
        ctx.fillRect(0, 0, pad, SIZE);
        ctx.fillRect(SIZE - pad, 0, pad, SIZE);
        ctx.fillRect(0, 0, SIZE, pad);
        ctx.fillRect(0, SIZE - pad, SIZE, pad);
    }

    function renderBalloon() {
        var rect = cell.balloon;
        var dy = -40;
        var dy2 = dy + 13;

        if (player.y < field.y + 32) {
            rect = cell.balloonD;
            dy = 8;
            dy2 = dy + 19;
        }
        drawSprite(rect, player.x + 12, player.y + dy, LEFT);

        setFont(FONT, "center", "alphabetic");
        ctx.fillText(jewel, player.x + 28, player.y + dy2 + GAP_Y);
    }

    function renderScore() {
        setFont(FONT, "left", "alphabetic");
        ctx.fillStyle = "#333";
        ctx.fillText("Score " + score, 32, 16 + GAP_Y);
    }

    function renderHiscore() {
        setFont(FONT, "right", "alphabetic");
        ctx.fillStyle = "#333";
        ctx.fillText("Hi " + hiscore, SIZE - 32, 16 + GAP_Y);
    }

    function renderStatus() {
        var i;

        if (score <= 0 || scene !== "intro" || sceneTime % 10 >= 5) {
            renderScore();
        }
        if (hiscore > 0) {
            renderHiscore();
        }
        for (i = 0; i < jewel; i += 1) {
            drawSprite(cell.gemIcon, 32 + i * 24, SIZE - 32, LEFT);
        }
    }

    function renderWave() {
        var radius = 40 * (1 - wave.ttl / 10);

        ctx.strokeStyle = "#ffc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wave.x + 0.5, wave.y + 0.5, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    function renderGame() {
        renderBackground();
        ctx.drawImage(frame, 0, 0);
        drawSprite(cell.pot, pot.x - 16, pot.y - 16, LEFT);
        if (scene !== "eaten" || sceneTime < 40) {
            renderPlayer(player);
        }
        if (shock === 0 || time % 8 < 4) {
            renderEnemy(enemy);
        }
        renderItem(itemList);
        if (cursor.active && scene === "idle") {
            renderGuide(player, cursor);
        } else if (jewel > 0 && (scene === "idle" || scene === "action")) {
            renderBalloon();
        }
        if (wave.ttl > 0) {
            renderWave(wave);
        }
        if (scene === "goal") {
            renderGoal();
        }
        renderStatus();
    }

    function renderGameover() {
        var half = SIZE / 2;
        var q = SIZE / 4;

        ctx.fillStyle = "#699";
        ctx.fillRect(0, 0, SIZE, SIZE);

        setFont(FONT_BIG, "center", "middle");
        ctx.fillStyle = "#ffc";
        ctx.fillText("You are eaten!!", half, q);
        ctx.fillText("Score", half, half - 48);
        if (hiscore > 0) {
            ctx.fillText("Hi " + hiscore, half, 3 * q);
        }

        setFont(FONT_BIGGEST, "center", "middle");
        ctx.fillText(score, half, half);
    }

    function render() { // 再描画
        if (scene === "title") {
            ctx.drawImage(title, 0, 0);
            if (hiscore > 0) {
                renderHiscore();
            }
        } else if (scene === "gameover") {
            renderGameover();
        } else {
            renderGame();
        }
    }

    function doTick() { // フレームごとの処理
        if (
            focused
            && title.complete
            && sprite.complete
            && background.complete
            && frame.complete
        ) {
            update();
            render();
        }
        cursor.clicked = false;
    }

    // ブラウザイベント

    // カーソルを動かす。引数はHTMLページ左上からの相対座標
    function moveOnClient(x, y) {
        var rect = canvas.getBoundingClientRect();
        var coef = SIZE / rect.width;

        cursor.x = Math.floor(coef * (x - rect.left));
        cursor.y = Math.floor(coef * (y - rect.top));
    }

    function startCursor(x, y) { // マウスボタンが押される。
        cursor.active = true;
        moveOnClient(x, y);
    }

    function releaseCursor() { // マウスボタンを離す。
        cursor.active = false;
        cursor.clicked = (cursor.x >= 0
            && cursor.x < SIZE
            && cursor.y >= 0
            && cursor.y < SIZE);
    }

    window.addEventListener("mousedown", function (e) {
        if (e.button === 0 && e.target === canvas) {
            e.preventDefault();
            startCursor(e.clientX, e.clientY);
        }
    }, false);

    window.addEventListener("mousemove", function (e) {
        if (cursor.active) {
            e.preventDefault();
            moveOnClient(e.clientX, e.clientY);
        }
    }, false);

    window.addEventListener("mouseup", function (e) {
        if (e.button === 0 && cursor.active) {
            e.preventDefault();
            releaseCursor();
        }
    }, false);

    // タッチイベント
    (function () {
        var id = 0;

        canvas.addEventListener("touchstart", function (e) {
            var tch = e.changedTouches[0];

            e.preventDefault();
            id = tch.identifier;
            startCursor(tch.clientX, tch.clientY);
        }, false);

        canvas.addEventListener("touchmove", function (e) {
            var tch = e.changedTouches[0];

            e.preventDefault();
            if (cursor.active && tch.identifier === id) {
                moveOnClient(tch.clientX, tch.clientY);
            }
        }, false);

        canvas.addEventListener("touchend", function (e) {
            var tch = e.changedTouches[0];

            e.preventDefault();
            if (cursor.active && tch.identifier === id) {
                releaseCursor();
            }
        }, false);
    }());

    // フォーカスが離れたときに動作を停止させる。
    window.addEventListener("blur", function () {
        focused = false;
        cursor.active = false;
    }, false);

    // 再びフォーカスされた時に動作を再開する。
    window.addEventListener("focus", function () {
        focused = true;
    }, false);

    // リセットボタンがあれば処理を割り当てる。
    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            resetBtn.blur();
            saveScore();
            gotoScene("title");
        }, false);
    }

    // 起動
    gotoScene("title");
    setInterval(doTick, 50);
}());
