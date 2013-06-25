var mongo = require('mongodb');
var notifier = require('mail-notifier');
var Twit = require('twit');
var config = require('./config.js');
var log = console.log;

var twit = new Twit(config.twit);
var postToTwitter = function (msg) {
  twit.post('statuses/update', { status: msg }, function(err, reply) {
    if ( err ) log(err);
  });
};

var player;
var collection;
mongo.connect(config.mongodb, function (err, db) {
  if (err) log(err);
  collection = db.collection('player');
  collection.findOne({id: 1}, function (err, obj) {
    if (err) log(err);
    player = new Player(obj);
  });
});


var oneOf = function (candidates) {
  var l = candidates.length;
  return candidates[ Math.floor( Math.random() * l ) ];
};

var Enemies = [
  'スライム',
  'ドラキー',
  'ゴースト',
  'まほうつかい',
  'キメラ',
  'ゴールドマン',
  'しりょうのきし',
  'メタルスライム',
  'メイジキメラ',
  'ドラゴン',
  'スターキメラ',
  'ゴーレム',
  'あくまのきし',
  'しにがみのきし',
  'ダースドラゴン',
  'りゅうおう'
];

var Player = function (opts) {
  this.init(opts);
};

Player.prototype = {
  init: function (opts) {
    this.name = opts.name;
    this.last = opts.last || opts.initial;
    this.initial = opts.initial;
    this.lastlv = Math.floor(this.initial - this.last);
  }
  , update: function (w) {
    this.current = w;
    var str = this.generateString();
    this.last = this.current;
    collection.update({id:1}, { '$set': {last: w}}, function (err, res) {
      if ( err ) log(err);
    });
    postToTwitter(str);
  }
  , enemyOf: function (lv) {
    if ( lv < 0 ) lv = 0;
    if ( lv > Enemies.length - 1 ) lv = Enemies.length - 1;
    return Enemies[lv];
  }
  , generateString: function () {
    var diff = Math.floor( (this.last - this.current) * 1000 );
    var abs_diff = Math.abs(diff);
    var lv = Math.floor( this.initial - this.current );
    var lvdiff = Math.abs( lv - this.lastlv );
    var me = this.name;
    var enemy = this.enemyOf(this.lastlv);
    var str = me + 'は体重計に乗った！\n';
    if ( diff < 0 ) {
      str += oneOf([ enemy + 'の攻撃！\n', 'しかし体重計は罠だった！\n' ]);
      if ( diff < -500 ) {
        str += 'つうこんのいちげき！';
      }
      str += me + 'は' + abs_diff + 'gのダメージをうけた！\n';
      if ( lvdiff ) {
        str += me + 'はしんでしまった！';
        str += 'レベルが' + lvdiff + 'kgさがった。';
      }
    }
    else if ( diff > 0 ) {
      str += me + 'の攻撃！\n';
      if ( diff > 500 ) {
        str += 'かいしんのいちげき！';
      }
      str += enemy + 'に' + abs_diff + 'gのダメージ！';
      if ( lvdiff ) {
        str += enemy + 'をやっつけた！';
        str += ' ' + me + 'はレベルが' + lvdiff + 'kgあがった！';
      }
    }
    else {
      str += oneOf([me, enemy]) + 'の攻撃！しかしあたらなかった！';
    }
    return str + '\n現在のレベル: ' + lv + ' #重クエ';
  }
};

notifier(config.imap).on('mail', function (mail) {
  if ( mail.subject.match(/^\[withings\]/) ) {
    var json;
    try {
      json = JSON.parse(mail.html);
    }
    catch (e) {
      log(e);
      return;
    }
    player.update(json.weight);
  }
}).start();


