// Generated by CoffeeScript 1.9.3
(function() {
  var Room, _, bunyan, get_memory_usage, log, settings, spawn, spawnSync, ygopro;

  _ = require('underscore');

  _.str = require('underscore.string');

  _.mixin(_.str.exports());

  spawn = require('child_process').spawn;

  spawnSync = require('child_process').spawnSync;

  ygopro = require('./ygopro.js');

  bunyan = require('bunyan');

  settings = require('./config.json');

  log = bunyan.createLogger({
    name: "mycard-room"
  });

  get_memory_usage = function() {
    var actualFree, buffers, cached, free, line, lines, percentUsed, prc_free, total;
    prc_free = spawnSync("free", []);
    lines = prc_free.stdout.toString().split(/\n/g);
    line = lines[1].split(/\s+/);
    total = parseInt(line[1], 10);
    free = parseInt(line[3], 10);
    buffers = parseInt(line[5], 10);
    cached = parseInt(line[6], 10);
    actualFree = free + buffers + cached;
    percentUsed = parseFloat(((1 - (actualFree / total)) * 100).toFixed(2));
    return percentUsed;
  };

  Room = (function() {
    Room.all = [];

    Room.find_or_create_by_name = function(name) {
      var room;
      if (room = this.find_by_name(name)) {
        return room;
      } else if (get_memory_usage() >= 90) {
        return null;
      } else {
        return new Room(name);
      }
    };

    Room.find_by_name = function(name) {
      var result;
      result = _.find(this.all, function(room) {
        return room.name === name;
      });
      return result;
    };

    Room.find_by_port = function(port) {
      return _.find(this.all, function(room) {
        return room.port === port;
      });
    };

    Room.validate = function(name) {
      var client_name, client_name_and_pass, client_pass;
      client_name_and_pass = name.split('$', 2);
      client_name = client_name_and_pass[0];
      client_pass = client_name_and_pass[1];
      return !_.find(Room.all, function(room) {
        var room_name, room_name_and_pass, room_pass;
        room_name_and_pass = room.name.split('$', 2);
        room_name = room_name_and_pass[0];
        room_pass = room_name_and_pass[1];
        return client_name === room_name && client_pass !== room_pass;
      });
    };

    function Room(name) {
      var draw_count, lflist, param, rule, start_hand, start_lp, time_limit;
      this.name = name;
      this.alive = true;
      this.players = [];
      this.status = 'starting';
      this.established = false;
      this.watcher_buffers = [];
      this.watchers = [];
      Room.all.push(this);
      this.hostinfo = {
        lflist: 0,
        rule: settings.modules.enable_TCG_as_default ? 2 : 0,
        mode: 0,
        enable_priority: false,
        no_check_deck: false,
        no_shuffle_deck: false,
        start_lp: 8000,
        start_hand: 5,
        draw_count: 1,
        time_limit: 180
      };
      if (name.slice(0, 2) === 'M#') {
        this.hostinfo.mode = 1;
      } else if (name.slice(0, 2) === 'T#') {
        this.hostinfo.mode = 2;
        this.hostinfo.start_lp = 16000;
      } else if ((param = name.match(/^(\d)(\d)(T|F)(T|F)(T|F)(\d+),(\d+),(\d+)/i))) {
        this.hostinfo.rule = parseInt(param[1]);
        this.hostinfo.mode = parseInt(param[2]);
        this.hostinfo.enable_priority = param[3] === 'T';
        this.hostinfo.no_check_deck = param[4] === 'T';
        this.hostinfo.no_shuffle_deck = param[5] === 'T';
        this.hostinfo.start_lp = parseInt(param[6]);
        this.hostinfo.start_hand = parseInt(param[7]);
        this.hostinfo.draw_count = parseInt(param[8]);
      } else if (((param = name.match(/(.+)#/)) !== null) && ((param[1].length <= 2 && param[1].match(/(S|N|M|T)(0|1|2|T|A)/i)) || (param[1].match(/^(S|N|M|T)(0|1|2|O|T|A)(0|1|O|T)/i)))) {
        rule = param[1].toUpperCase();
        log.info("C", rule);
        switch (rule.charAt(0)) {
          case "M":
          case "1":
            this.hostinfo.mode = 1;
            break;
          case "T":
          case "2":
            this.hostinfo.mode = 2;
            this.hostinfo.start_lp = 16000;
            break;
          default:
            this.hostinfo.mode = 0;
        }
        switch (rule.charAt(1)) {
          case "0":
          case "O":
            this.hostinfo.rule = 0;
            break;
          case "1":
          case "T":
            this.hostinfo.rule = 1;
            break;
          default:
            this.hostinfo.rule = 2;
        }
        switch (rule.charAt(2)) {
          case "1":
          case "T":
            this.hostinfo.lflist = settings.modules.TCG_banlist_id;
            break;
          default:
            this.hostinfo.lflist = 0;
        }
        if ((param = parseInt(rule.charAt(3).match(/\d/))) > 0) {
          this.hostinfo.time_limit = param * 60;
        }
        switch (rule.charAt(4)) {
          case "T":
          case "1":
            this.hostinfo.enable_priority = true;
            break;
          default:
            this.hostinfo.enable_priority = false;
        }
        switch (rule.charAt(5)) {
          case "T":
          case "1":
            this.hostinfo.no_check_deck = true;
            break;
          default:
            this.hostinfo.no_check_deck = false;
        }
        switch (rule.charAt(6)) {
          case "T":
          case "1":
            this.hostinfo.no_shuffle_deck = true;
            break;
          default:
            this.hostinfo.no_shuffle_deck = false;
        }
        if ((param = parseInt(rule.charAt(7).match(/\d/))) > 0) {
          this.hostinfo.start_lp = param * 4000;
        }
        if ((param = parseInt(rule.charAt(8).match(/\d/))) > 0) {
          this.hostinfo.start_hand = param;
        }
        if ((param = parseInt(rule.charAt(9).match(/\d/))) >= 0) {
          this.hostinfo.draw_count = param;
        }
      } else if ((param = name.match(/(.+)#/)) !== null) {
        rule = param[1].toUpperCase();
        log.info("233", rule);
        if (rule.match(/(^|，|,)(M|MATCH)(，|,|$)/)) {
          this.hostinfo.mode = 1;
        }
        if (rule.match(/(^|，|,)(T|TAG)(，|,|$)/)) {
          this.hostinfo.mode = 2;
          this.hostinfo.start_lp = 16000;
        }
        if (rule.match(/(^|，|,)(TCGONLY|TO)(，|,|$)/)) {
          this.hostinfo.rule = 1;
          this.hostinfo.lflist = settings.modules.TCG_banlist_id;
        }
        if (rule.match(/(^|，|,)(OT|TCG)(，|,|$)/)) {
          this.hostinfo.rule = 2;
        }
        if ((param = rule.match(/(^|，|,)LP(\d+)(，|,|$)/))) {
          start_lp = parseInt(param[2]);
          if (start_lp <= 0) {
            start_lp = 1;
          }
          if (start_lp >= 99999) {
            start_lp = 99999;
          }
          this.hostinfo.start_lp = start_lp;
        }
        if ((param = rule.match(/(^|，|,)(TIME|TM|TI)(\d+)(，|,|$)/))) {
          time_limit = parseInt(param[3]);
          if (time_limit <= 0) {
            time_limit = 180;
          }
          if (time_limit >= 1 && time_limit <= 60) {
            time_limit = time_limit * 60;
          }
          if (time_limit >= 999) {
            time_limit = 999;
          }
          this.hostinfo.time_limit = time_limit;
        }
        if ((param = rule.match(/(^|，|,)(START|ST)(\d+)(，|,|$)/))) {
          start_hand = parseInt(param[3]);
          if (start_hand <= 0) {
            start_hand = 1;
          }
          if (start_hand >= 40) {
            start_hand = 40;
          }
          this.hostinfo.start_hand = start_hand;
        }
        if ((param = rule.match(/(^|，|,)(DRAW|DR)(\d+)(，|,|$)/))) {
          draw_count = parseInt(param[3]);
          if (draw_count >= 35) {
            draw_count = 35;
          }
          this.hostinfo.draw_count = draw_count;
        }
        if ((param = rule.match(/(^|，|,)(LFLIST|LF)(\d+)(，|,|$)/))) {
          lflist = parseInt(param[3]) - 1;
          this.hostinfo.lflist = lflist;
        }
        if (rule.match(/(^|，|,)(NOLFLIST|NF)(，|,|$)/)) {
          this.hostinfo.lflist = -1;
        }
        if (rule.match(/(^|，|,)(NOUNIQUE|NU)(，|,|$)/)) {
          this.hostinfo.rule = 3;
        }
        if (rule.match(/(^|，|,)(NOCHECK|NC)(，|,|$)/)) {
          this.hostinfo.no_check_deck = true;
        }
        if (rule.match(/(^|，|,)(NOSHUFFLE|NS)(，|,|$)/)) {
          this.hostinfo.no_shuffle_deck = true;
        }
        if (rule.match(/(^|，|,)(IGPRIORITY|PR)(，|,|$)/)) {
          this.hostinfo.enable_priority = true;
        }
      }
      param = [0, this.hostinfo.lflist, this.hostinfo.rule, this.hostinfo.mode, (this.hostinfo.enable_priority ? 'T' : 'F'), (this.hostinfo.no_check_deck ? 'T' : 'F'), (this.hostinfo.no_shuffle_deck ? 'T' : 'F'), this.hostinfo.start_lp, this.hostinfo.start_hand, this.hostinfo.draw_count, this.hostinfo.time_limit];
      this.process = spawn('./ygopro', param, {
        cwd: 'ygocore'
      });
      this.process.on('exit', (function(_this) {
        return function(code) {
          if (!_this.disconnector) {
            _this.disconnector = 'server';
          }
          _this["delete"]();
        };
      })(this));
      this.process.stdout.setEncoding('utf8');
      this.process.stdout.once('data', (function(_this) {
        return function(data) {
          _this.established = true;
          _this.port = parseInt(data);
          _.each(_this.players, function(player) {
            player.server.connect(_this.port, '127.0.0.1', function() {
              var buffer, i, len, ref;
              ref = player.pre_establish_buffers;
              for (i = 0, len = ref.length; i < len; i++) {
                buffer = ref[i];
                player.server.write(buffer);
              }
              player.established = true;
              player.pre_establish_buffers = null;
            });
          });
        };
      })(this));
    }

    Room.prototype["delete"] = function() {
      var index;
      if (this.deleted) {
        return;
      }
      this.watcher_buffers = [];
      this.players = [];
      if (this.watcher) {
        this.watcher.end();
      }
      this.deleted = true;
      index = _.indexOf(Room.all, this);
      if (index !== -1) {
        Room.all.splice(index, 1);
      }
    };

    Room.prototype.connect = function(client) {
      this.players.push(client);
      if (this.established) {
        client.server.connect(this.port, '127.0.0.1', function() {
          var buffer, i, len, ref;
          ref = client.pre_establish_buffers;
          for (i = 0, len = ref.length; i < len; i++) {
            buffer = ref[i];
            client.server.write(buffer);
          }
          client.established = true;
          client.pre_establish_buffers = [];
        });
      }
    };

    Room.prototype.disconnect = function(client, error) {
      var index;
      if (client.is_post_watcher) {
        ygopro.stoc_send_chat_to_room(this, client.name + " " + '退出了观战' + (error ? ": " + error : ''));
        index = _.indexOf(this.watchers, client);
        if (index !== -1) {
          this.watchers.splice(index, 1);
        }
        client.room = null;
      } else {
        index = _.indexOf(this.players, client);
        if (index !== -1) {
          this.players.splice(index, 1);
        }
        if (this.players.length) {
          ygopro.stoc_send_chat_to_room(this, client.name + " " + '离开了游戏' + (error ? ": " + error : ''));
          client.room = null;
        } else {
          this.process.kill();
          client.room = null;
          this["delete"]();
        }
      }
    };

    return Room;

  })();

  module.exports = Room;

}).call(this);
