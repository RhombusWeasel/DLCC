function glog(){
    log(arguments[0])
    for (i = 1; i < arguments.length; i++){
        log(arguments[i])
    }
}

function getData(type, ident, val){
    var query = {}
    query._type = type
    query[ident] = val
    var obj = findObjs(query)[0];
    if (obj){
        return obj;
    }else{
        glog('__utils getData Couldn\'t find:', ...arguments)
        return false;
    };
}

function getDeck(name){
    //return getData('deck', 'name', name);
    return findObjs({
        _type:'deck',
        name: name
    })[0];
};

function getPlayer(id){
    return findObjs({
        _type:'player',
        _id: id
    })[0];
};

function getCharacterSheet(name){
    return findObjs({
        _type:'character',
        name: name
    })[0];
};

function getToken(id){
    return findObjs({
        _type:'graphic',
        _id: id
    })[0];
};

function getAttribute(id, name){
    var obj = findObjs({
        type: 'attribute',
        characterid: id,
        name: name 
    })[0];
    if (obj) {
        return obj.get('current');
    };
    return false;
}

function getHand(id){
    return findObjs({
        _type: 'hand',
        _parentid: id
    })[0];
};

function getAllData(type){
    return findObjs({
        _type: type
    });
};

function getPlayerData(msg){
    return {
        player: getPlayer(msg.playerid),
        char:   getCharacterSheet(msg.who),
        hand:   getHand(msg.id),
    };
};

function getDiceRoll(id, skill, attr){
    var lvl = getAttribute(id, skill+'lvl')
    if (lvl){
        log(lvl)
        var dtype = getAttribute(id, attr+'dtype')
        if (dtype) {
            log(dtype)
            return lvl+dtype
        };
    };
    return false;
};

function doDiceRoll(usr, skill, attr, mod){
    glog('Skill roll attempt:', usr, skill, attr, mod)
    if (!mod) {
        mod = 0
    };
    var lvl = getAttribute(usr.char.id, skill+'lvl', attr+'lvl')
    if (!lvl){
        lvl = getAttribute(usr.char.id, attr+'lvl')
        mod = mod + -8
    };
    var dtype = getAttribute(usr.char.id, attr+'dtype')
    if (dtype) {
        sendChat(usr.char.get('name'), '/r '+lvl+dtype+'!!k1+'+mod.toString())
    };
};

function checkGM(msg){
    var player = getPlayer(msg.playerid)
    if (player && player.get('_lastpage') != ''){
        return true;
    };
    return false;
};

var card_order = ['Joker', 'Ace','King','Queen','Jack','Ten','Nine','Eight','Seven','Six','Five','Four','Three','Two']
var suit_order = ['Red', 'Black', 'Spades', 'Hearts', 'Diamonds', 'Clubs']

var combat = false

commands = {
    '!test': function(msg, args){
        sendChat('DLCC', 'Responding.')
        return args;
    },
    '!help': function(msg, args){
        var target = '/w '+msg.who.split(' ')[0]+' '
        if (args[0] == 'test'){
            sendChat('DLCC', target+'Sends a test ping to the script to check it is running.')
        }else if (args[0] == 'help'){
            sendChat('DLCC', target+'Sends help info to the chat.')
        }else{
            sendChat('DLCC', target+'Help Topics: [!test](!help test) [!help](!help help)')
        }
        return args;
    },
    '!setmarshal': function(msg, args){
        if (checkGM(msg)){
            var player = getPlayer(msg.playerid)
            state.dlcc.marshal_name = player.get('_displayname').split(' ')[0]
            sendChat('DLCC', '/w '+state.dlcc.marshal_name+' You have been set as the Game Marshal.')
        };
        return args;
    },
    '!recall': function(msg, args){
        if (checkGM(msg)){
            sendChat('Marshal', '/e gathers the deck')
            var deck = getDeck('action_deck');
            if (args[0] == 'all'){
                recallCards(deck.id);
                args.shift()
            }else{
                recallCards(deck.id, 'graphic');
            };
        }else{
            sendChat('DLCC', 'Only the Marshal can recall cards.')
        };
        return args;
    },
    '!shuffle': function(msg, args){
        if (checkGM(msg)){
            var deck = getDeck('action_deck')
            recallCards(deck.get('_id'));
            shuffleDeck(deck.get('_id'));
            sendChat('Marshal', '/e shuffles like a boss.');
        }else{
            sendChat('DLCC', 'Only the Marshal can shuffle the cards.')
        };
        return args;
    },
    '!fate': function(msg, args){
        if (checkGM(msg)){
            var deck = getData('deck', '_name', 'fate_deck')
            if (!deck){
                sendChat('DLCC', 'No Fate deck found, you will need to create a deck called fate_deck for this feature to work.')
                return args;
            };
            recallCards(deck.id);
            shuffleDeck(deck.id);
            sendChat('Marshal', 'Dealing out the hands of Fate...');
            var hands = getAllData('hand')
            var players = getAllData('player')
            if (hands){
                if (players.length === hands.length){
                    for (i = 0; i < hands.length; i++){
                        var player = getData('player', '_id', hands[i].get('_parentid'))
                        if (player){
                            sendChat('DLCC', 'Dealing '+player.get('_displayname')+' 3 chips.')
                            var player_online = player.get('_online')
                            if (player_online) {
                                for (f = 0; f < 3; f++){
                                    var card = drawCard(deck.id)
                                    giveCardToPlayer(card, player.id);
                                };
                            };
                        }
                    };
                }else{
                    sendChat('DLCC', 'Some players have no hand data.  Make sure every player has been dealt at least one card to create a hand object for me to find.');
                };
            }else{
                sendChat('DLCC', 'No hand data found, if this is a new game deal each player a card from the Playing Cards deck then retry.')
            };
        }else{
            sendChat('DLCC', 'Only the Marshal can deal out fate!')
        };
        return args;
    },
    '!combat': function(msg, args){
        if (checkGM(msg)){
            combat = {
                last_card: undefined,
                users: {},
                aim_bonus: {},
                sleeve: {},
            };
            sendChat('Marshal', '/e : Combat Begins!')
            sendChat('Marshal', '!recall all !shuffle')
            sendChat('Marshal', '[Roll Quickness](!init new)')
        }else{
            sendChat('DLCC', 'Only the Marshal can start combat.')
        };
        return args;
    },
    '!round': function(msg, args){
        if (checkGM(msg)){
            sendChat('Marshal', '/e : Y\'all ready for another round?')
            sendChat('Marshal', '[Roll Quickness](!init new)')
        }else{
            sendChat('DLCC', 'Only the Marshal can advance rounds.')
        };
        return args;
    },
    '!endcombat': function(msg, args){
        combat = false
        sendChat('Marshal', 'The fightin\'s done... fer now.')
    },
    '!init': function(msg, args){
        var user = getPlayerData(msg)
        if( user.char ) {
            var qui_lvl = getAttribute(user.char.id, 'quilvl')
            log(qui_lvl)
            if( qui_lvl ) {
                var qui_dtype = getAttribute(user.char.id, 'quidtype')
                if( qui_dtype ) {
                    var roll = '@{'+msg.who+'|gmtoggle}&{template:simple}{{rollname='+msg.who+' joins the fight!}}{{dice=[['+qui_lvl+qui_dtype+'!!k1]]}}'
                    if (combat){
                        if (args[0] == 'new'){
                            combat.users[user.player.id] = user
                            combat.aim_bonus[user.player.id] = 0
                            combat.sleeve[user.player.id] = ''
                            args.shift()
                        }
                        sendChat(msg.who, roll, function(ops) {
                            var roll_result = ops[0].inlinerolls[0].results.total;
                            var cards = Math.min(1 + Math.ceil((roll_result - 4) / 5), 5)
                            var reply = '@{'+msg.who+'|gmtoggle}&{template:default}{{'+msg.who+' joins the fight!}}{{dice='+roll_result+'}}{{cards='+cards+'}}'
                            sendChat(msg.who, '/w '+state.dlcc.marshal_name+' '+reply);
                            var deck = getDeck('action_deck')
                            for (i = 0; i < cards; i++){
                                var card = drawCard(deck.id)
                                giveCardToPlayer(card, user.player.id);
                            };
                        });
                    };
                };
            };
        };
        return args;
    },
    '!next': function(msg, args){
        if (checkGM(msg)){
            if (combat){
                var hands = getAllData('hand')
                log(hands)
                var deck = getDeck('action_deck')
                for (c = 0; c < card_order.length; c++){
                    for (s = 0; s < suit_order.length; s++){
                        var target = card_order[c] + ' of ' + suit_order[s]
                        //log('Checking target: '+target)
                        for (h = 0; h < hands.length; h++){
                            var player = getPlayer(hands[h].get('_parentid'))
                            log(player)
                            if (player){
                                var player_name = player.get('_displayname')
                                if (player_name){
                                    var cards = hands[h].get('currentHand');
                                    if (cards !== ''){
                                        var target = card_order[c] + ' of ' + suit_order[s]
                                        if (card_order[c] === 'Joker'){
                                            target = suit_order[s]+' '+card_order[c]
                                        };
                                        var card_list = hands[h].get('currentHand').split(',');
                                        if (card_list) {
                                            for (v = 0; v < card_list.length; v++){
                                                var card = findObjs({
                                                    _type: 'card',
                                                    _deckid: deck.id,
                                                    _id: card_list[v]
                                                })[0];
                                                if (card && card.get('name') == target){
                                                    sendChat(player_name, '/w '+state.dlcc.marshal_name+' '+player_name+': '+target);
                                                    takeCardFromPlayer(player.id, {
                                                       cardid: card.id, 
                                                    });
                                                    playCardToTable(card.id,{
                                                        left:105,
                                                        top:140,
                                                        width:140,
                                                        height:210,
                                                    });
                                                    var target_player = combat.users[player.id].char.get('name').split(' ')[0]
                                                    log(msg.who.split()[0])
                                                    sendChat('Marshal', '/w '+target_player+' Yer up! Now whatcha gonna\' do?')
                                                    sendChat('Marshal', '/w '+target_player+' Shoot at it!   [Aim](!aim)[Shoot](!shoot)[Reload](!reload)')
                                                    sendChat('Marshal', '/w '+target_player+' Shout at it! [Overawe](!overawe)[Ridicule](!ridicule)[Persuade](!persuade)')
                                                    sendChat('Marshal', '/w '+target_player+' Hold up a sec... [Hold](!hold '+card.id+')');
                                                    return args;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        }else{
            sendChat('DLCC', 'Only the Marshal can start combat.')
        };
        return args;
    },
    '!aim': function(msg, args){
        if (combat.aim_bonus[msg.playerid] < 6){
            combat.aim_bonus[msg.playerid] += 2
            sendChat(msg.who, '/e takes a moment to aim. (+'+combat.aim_bonus[msg.playerid]+')')
        }else{
            sendChat(msg.who, '/e thinks it ain\'t gonna get better than this (+6)')
        };
        return args;
    },
    '!shoot': function(msg, args){
        sendChat(msg.who, '/e fires off a few rounds!')
        doDiceRoll(combat.users[msg.playerid], 'shootin', 'def', combat.aim_bonus[msg.playerid]);
        combat.aim_bonus[msg.playerid] = 0
        return args;
    },
    '!reload': function(msg, args){
        sendChat(msg.who, '/e ran outta bullets...')
        return args;
    },
    '!overawe': function(msg, args){
        sendChat(msg.who, '/e stares em\' down and tests their grit')
        doDiceRoll(combat.users[msg.playerid], 'overawe', 'mien');
        return args;
    },
    '!persuade': function(msg, args){
        sendChat(msg.who, '/e tries a touch of sweet talk')
        doDiceRoll(combat.users[msg.playerid], 'persuasion', 'mien');
        return args;
    },
    '!ridicule': function(msg, args){
        sendChat(msg.who, '/e Wow! You kiss yer momma with that mouth!')
        doDiceRoll(combat.users[msg.playerid], 'ridicule', 'mien');
        return args;
    }
};

on('ready', function(){
    // Chat commands:
    if (!('dlcc' in state)){
        state.dlcc = {}
        sendChat('DLCC', 'Thanks for using Deadlands Classic Combat!  Since you\'ve just installed it you\'ll need to set yourself as the Marshal.  Just type !setmarshal into the chat.  You can type !help at any time to get more info.')
    };
    log(state.dlcc)
    on('chat:message', function(msg){
        if (msg.type !== 'api') return;
        log(msg)
        var char = findObjs({_type:'character', name: msg.who})[0];
        if (char || checkGM(msg)){
            var list = msg.content.split(' ');
            while (list.length > 0){
                var opt = list.shift();
                //log(opt);
                if (commands[opt]) {
                    list = commands[opt](msg, list);
                };
            };
        }else{
            sendChat('DLCC', '/w '+msg.who.split(' ')[0]+' You are not speaking as a character, please select your character from the dropdown below the chat.')
        };
    });
    log('Deadlands Classic Combat v0.1 Loaded.')
});
