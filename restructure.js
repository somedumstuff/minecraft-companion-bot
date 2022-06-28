const mineflayer = require('mineflayer')
const collectBlock = require('mineflayer-collectblock').plugin
const armor = require('mineflayer-armor-manager')
const pvp = require('mineflayer-pvp').plugin
const vec3 = require('vec3');
const fs = require('fs')
const { on } = require('events')
const { pathfinder, Movements, goals} = require('mineflayer-pathfinder');
const { argv } = require('process');
const brain = require('./scanner');
const { threadId } = require('worker_threads');
const { time, clear } = require('console');
const { EventEmitter } = require('stream');
const GoalFollow = goals.GoalFollow


EventEmitter.setMaxListeners(20)
//bot creation
const bot = mineflayer.createBot({
    host: '127.0.0.1',
    port: 58223,
    username: 'companion2'
})


//loading plugins
async function pluginsLoader() {
    bot.loadPlugin(pvp)
    bot.loadPlugin(armor)
    bot.loadPlugin(pathfinder)
    bot.loadPlugin(collectBlock)
    console.log('Loaded required plugins')
}
pluginsLoader()

//variables
let playerDetails = ''
let guardingPerimeter = ''  //a radius of 10 blocks around the home coordinates 
let homeCoordinates = ''    //write externally
let bedCoorddinates = ''    //write externally 
let workQueue = ['guard', 'farm', 'chopping', 'protecting']
let currentlyDoing = []


// bot.on('spawn', ()=>{
//     bot.addChatPattern('confirmation_home_coords', /(.+) yes make this a home/)
// })

//player greet on login component
async function greetOnLogin(){
    bot.on('playerJoined', (player) => {
        if (player.username !== bot.username) {
            playerDetails = bot.players[username]
            bot.chat(`Hello, ${player.username}! Welcome back.`)
            bot.lookAt(playerDetails.position.offset(0, 1.5, 0))
        }
    })
}

//keep looking at the player component
async function lookAtPlayer () {
    const isPlayer = (entity) => entity.type === 'player'
    const playerBro = bot.nearestEntity(isPlayer)
    if(!isPlayer) return
    const playerPos = playerBro.position.offset(0, playerBro.height, 0)
    bot.lookAt(playerPos)  
}

/*********************************basic functionalities*********************************/
/*setup home coordinates*/
//variables for sethome
//checks for existing coordinates
let awaitingForConfirmation = "no"
function setHomeCoords (username) {
    const playerInfo = bot.players[username] ? bot.players[username].entity : null
    const data = JSON.parse(fs.readFileSync("./data.json"))
    console.log(awaitingForConfirmation, Object.keys(data).length)
    if(Object.keys(data).length > 1 & awaitingForConfirmation == "no"){
        bot.chat("We have a home already. Do you want to make this location a new home?")
        awaitingForConfirmation = "yes"
        triggerTimeout()
    }
    else{
        bot.chat("Will store this coordinates as our home location.")
        let writeableCoords = parseInt(playerInfo.position.x)+ " " + parseInt(playerInfo.position.y) + " " + parseInt(playerInfo.position.z)
        let no = parseInt(Object.keys(data)) + 1
        data[no.toString()] = writeableCoords
        fs.writeFileSync('./data.json', JSON.stringify(data), null, 4)
        awaitingForConfirmation = "no"
    }
}

function triggerTimeout(){
    setTimeout(()=>{
        awaitingForConfirmation = "no"
        bot.chat("Type faster :)")
    }, 5000)
    
}

bot.on('chat', (username, message)=>{
    if(message == 'this is home'){
        setHomeCoords(username)
    }
})

bot.on('chat', (username, message)=>{
    if(message=="yes add this as another home"){
        if(awaitingForConfirmation == "yes"){
            console.log(awaitingForConfirmation)
            const data = JSON.parse(fs.readFileSync("./data.json"))
            const playerInfo = bot.players[username] ? bot.players[username].entity : null
            let writeableCoords = parseInt(playerInfo.position.x)+ " " + parseInt(playerInfo.position.y) + " " + parseInt(playerInfo.position.z)
            let no = parseInt(Object.keys(data)) + 1
            data[no.toString()] = writeableCoords
            fs.writeFileSync('./data.json', JSON.stringify(data), null, 4)
            awaitingForConfirmation = "no"
            bot.chat("Alright I will remember this location as another home.")
        }
    }
})


/*********************************coordinates*********************************/

// Used when only one set of homeCoordinates 
function getHomeCoords(){
    const data = JSON.parse(fs.readFileSync("./data.json"))
    const homeNo = "0"
    let homeCoordinates = data["1"].split(" ")
    return homeCoordinates
}

// when there are multiple coordinates present in data.json getOneOfHomeCoords is used
// argument of the home number is passed.
// TODO: make sure this is only used once. After the user sets a preffered location, direct to goHomeWPref
function getOneOfHomeCoords(homeNumber){
    const data = JSON.parse(fs.readFileSync("./data.json"))
    // add writing homePreference.
    let homeCoordinates = data[homeNumber].split(" ")
    console.log(homeCoordinates)
    return homeCoordinates
}  

// becomes the default goHome() after the preference is set. 
// preference is written in data.json
// TODO: make all these goHome() into one function.

//going home with preference
function goHomeWPref() {
    const data = JSON.parse(fs.readFileSync("./data.json"))
    let homePreference = data["pref"]
    currentlyDoing.push("going home")
    let hc = getOneOfHomeCoords(homePreference)
    setTimeout(()=>{
        console.log("Going home with preference.")
        bot.pathfinder.setGoal(new goals.GoalNear(hc[0], hc[1], hc[2]))
    }, 1000)
}

// check for homePref
function checkHomePref(){
    const data = JSON.parse(fs.readFileSync("./data.json"))
    if (!data["pref"]){
        return "none"
    }
    else {
        let homePreference = data["pref"]
        return homePreference
    }
}
/*********************************move to x components*********************************/
// goHome function is called when the player is asking the bot to go home.
// goHome function is also called when the bot has finished an activity.
function goHome() {
    const playerInfo = bot.players['iamnotadolphin'] ? bot.players['iamnotadolphin'].entity : null
    const data = JSON.parse(fs.readFileSync("./data.json"))
    console.log(awaitingForConfirmation, Object.keys(data).length)
    currentlyDoing.push("going home")
    // checks if there are two different campsites / home sites.
    if(Object.keys(data).length > 1 & awaitingForConfirmation == "no"){
        bot.chat("Which?")
        awaitingForConfirmation = "yes"
        triggerTimeout()
    }

    // only one set of homeCoordinates exist.
    // uses getHomeCoords()
    // goes home.
    else if(Object.keys(data).length == 1) {
        let hc = getHomeCoords()
        setTimeout(()=>{
            console.log(hc)
            console.log("hc called")
            bot.pathfinder.setGoal(new goals.GoalNear(hc[0], hc[1], hc[2]))
        }, 1000)
        if(bot.entity.position.distanceTo(vec3(homeCoordinates)) > 1) {
            currentlyDoing.pop()
        }
    }
}


bot.on("chat", (username, message)=>{
    if(message=="lets go home" || message.includes("go home")){
        goHome()
    }
})

bot.on("chat", (username, message)=>{
    if(message.includes("home number")){
        console.log("yo")
        let tokens = message.split(" ")
        console.log(tokens)
        let hc = getOneOfHomeCoords(tokens[2])
        setTimeout(()=>{
            console.log(hc)
            console.log("hc called")
            bot.pathfinder.setGoal(new goals.GoalNear(hc[0], hc[1], hc[2]))
        }, 1000)
    }
})

/*********************************guarding functionalities*********************************/
/*guard an area with coordinates*/
let guardPos = false
let guardingState = "notOnGuard"
let guardInterval
async function gaurdHome(){
    //check if home
    try{
        console.log("sword try block")
        const sword = bot.inventory.items().find(item => item.name.includes('sword'))
        if(sword) bot.equip(sword, 'hand')
        const shield = bot.inventory.items().find(item => item.name.includes('shield'))
        if(shield) bot.equip(shield, 'off-hand')
    } catch(err){
        console.log("no weapon found ig")
    }
    const homeCoordinates = getHomeCoords()
    console.log(bot.entity.position.distanceTo(vec3(homeCoordinates)))
    if(bot.entity.position.distanceTo(vec3(homeCoordinates)) > 2){
        console.log("far away")
        bot.pathfinder.setGoal(new goals.GoalNear(homeCoordinates[0], homeCoordinates[1], homeCoordinates[2]))
        try {
            await bot.pathfinder.goto(new goals.GoalNear(homeCoordinates[0], homeCoordinates[1], homeCoordinates[2]), 1)
        } catch(err){
            guardPos = true
            guardingState = "onGuard"
            guardTrigger(guardPos, guardingState)
        }
        //goHome()
        bot.chat("im home and on guard")
    }
    if(bot.entity.position.distanceTo(vec3(homeCoordinates)) <= 2){
        console.log("bot is nearby")
        try {
            await bot.pathfinder.goto(new goals.GoalNear(homeCoordinates[0], homeCoordinates[1], homeCoordinates[2]), 1)
        } catch(err){
            guardPos = true
            guardingState = "onGuard"
            guardTrigger(guardPos, guardingState)
        }
        bot.chat("on guard")
    }
}

function guardTrigger(guardPos, guardingState){
     if(guardPos && guardingState =="onGuard") {
        console.log("yo")
        const homeCoordinates = getHomeCoords()
        guardInterval = setInterval(() => {
            
            console.log("near home")
            //when the bot is around the perimeter of 7 blocks from the base
            const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 7 && e.mobType !== 'Armor Stand'
            entity = bot.nearestEntity(filter)        
            bot.pvp.attack(entity)
            if(entity == null){
                console.log("no enemies nearby")
                bot.pvp.stop()
                bot.pathfinder.setGoal(null)
                bot.pathfinder.setGoal(new goals.GoalNear(homeCoordinates[0], homeCoordinates[1], homeCoordinates[2])) 
                return
            }
            console.log(bot.entity.position.distanceTo(vec3(homeCoordinates)))
            if(bot.entity.position.distanceTo(vec3(homeCoordinates)) > 10){
                console.log("more than 10 blocks")
                if(!bot.pvp.target){
                    bot.pvp.stop()
                    bot.pathfinder.setGoal(null)
                    bot.pathfinder.setGoal(new goals.GoalNear(homeCoordinates[0], homeCoordinates[1], homeCoordinates[2]))
                }
            }
        }, 200)  
    }
}

bot.on('chat', (username, message)=>{
    if(message == "guard our home") {
        console.log("guard home called")
        gaurdHome()
    }
})

/* follow me component */ 
function followMe(){
    //get info of the player
    const playerInfo = bot.players['iamnotadolphin']
    if(!playerInfo) {
        bot.chat("Come Online")
        return
    }
    try{
        clearInterval(guardInterval)
    }catch(err){
        console.log(err)
    }
    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)
    const goal = new GoalFollow(playerInfo.entity, 3) //allows following an entity
    bot.pathfinder.setGoal(goal, true) //true allows you to constantly update the pos of the player. false only takes in the pos immediately after this function is called
}

bot.on('chat', (username, message)=>{
    if(message == "follow me"){
        followMe()
    }
})


/*********************************farming functionalities*********************************/
const harvestName = 'wheat'
const seedName = 'wheat_seed'
let harvest 
async function farmLoop() {
    console.log("called farmloop")
    harvest = readyCrop()
	if (harvest) {
		bot.lookAt(harvest.position);
        try {
			if (bot.entity.position.distanceTo(harvest.position) < 5) {
                bot.pathfinder.setGoal(new goals.GoalNear(harvest.position.x, harvest.position.y, harvest.position.z, 2), true)
                bot.setControlState('forward', false);
                await bot.dig(harvest)
			    if (!bot.heldItem || bot.heldItem.name != seedName){
                    const seed = bot.inventory.items().find(item => item.name.includes('seed'))
                    await bot.equip(seed, 'hand')
                }
				let dirt = bot.blockAt(harvest.position.offset(0, 0, 0));
				await bot.placeBlock(dirt, vec3(0, 1, 0));
			} else {
				bot.setControlState('forward', true);
			}
		} catch(err) {
	        console.log(err)
        }
    }
}

function readyCrop() {
	return bot.findBlock({
		matching: (blk)=>{
			return(blk.name == harvestName && blk.metadata == 7);
		}
	});
}

bot.on("chat", (username, message)=> {
    if(message == 'farming time'){
        bot.chat("im off to farm some food")
        let farmInterval = setInterval( ()=> {
            harvest = readyCrop()
            if(harvest){
                farmLoop()
            } 
            if(!harvest){
                bot.chat("i have harvested all of the wheat available. going back home.")
                let homePref = checkHomePref()
                if(homePref != "none"){
                    goHomeWPref()
                    clearInterval(farmInterval)
                }else{
                    goHome()
                }
            }
        }, 1000)
    }
})

/*********************************chopping functionalities*********************************/
//main chop wood body
async function chopWood(username, message){
    mcData = require('minecraft-data')(bot.version);
    const blocks = checkForWood()
    //console.log(blocks)
    if (blocks) {
        bot.lookAt(blocks.position);
    }
    try {
		if (bot.entity.position.distanceTo(blocks.position) < 4.0) {
            bot.lookAt(blocks.position);
            const axe = bot.inventory.items().find(item => item.name.includes('axe'))
            if(axe) bot.equip(axe, 'hand')
            bot.pathfinder.setGoal(new goals.GoalNear(blocks.position.x, blocks.position.y, blocks.position.z, 1), true)
            bot.setControlState('forward', false);
            await bot.dig(blocks)
		} 
        else {
			bot.setControlState('forward', true);
		}
	} catch(err) {
	    console.log(err)
    }
}

//scanner for wood
function checkForWood() {
	return bot.findBlock({
		matching: (blk)=>{
			return(blk.name == 'spruce_log');
		},
        count: 5
	});
}

//trigger for wood
bot.on("chat", (username, message) => {
    let timer = 0
    if(message == "wood" && timer <= 10){
        let interval = setInterval(()=>{
            chopWood()
            timer = timer + 1
            console.log(timer)
            if(timer>10){
                try{
                    bot.stopDigging()
                }catch(err){
                    bot.pathfinder.setGoal(null)
                    
                }
                clearInterval(interval)
                followMe()
            }
        }, 1000)  
    }
})

/*************************** sleeping functionality ********************************/
function sleep(){
    let bed = bot.findBlock({
        matching: blk=>bot.isABed(blk),
        maxDistance: 128
    });
    bedPosition = bed.position
    console.log(bedPosition)
    try {
        console.log(bot.time)
        if (bedPosition && bot.time.time >=13000) {  
            bot.pathfinder.setGoal(new goals.GoalNear(bedPosition.x, bedPosition.y, bedPosition.z, 1), true)
            bot.setControlState('forward', false)
            bed = bot.blockAt(bedPosition)
            console.log(bot.isSleeping)
            let interval = setInterval( () => {
                if(bedPosition.distanceTo(bot.entity.position) <=2 && bot.isSleeping!== true){
                    bot.sleep(bed)
                }else{
                    if(bot.time.time >= 6000){
                        clearInterval(interval)   
                    }
                    return
                }
            }, 1000)
    } else{
        console.log(`Can't find bed.`)
        bot.chat("I dont think its time yet.")
    }
    } catch(err) {
        console.log(err);
    }
}

bot.on("chat", (username, message)=> {
    if(message == 'go to sleep'){
        //find the bed
        sleep()
    }
})

/*************************** look for iron ********************************/
function checkForIron() {
	return bot.findBlock({
		matching: (blk)=>{
			return(blk.name == 'iron_ore');
		},
        maxDistance: 100
	});
}

bot.on('chat', (username, message) => {
    if(message == 'check for iron') {
        let blocks = checkForIron()
        bot.pathfinder.setGoal(new goals.GoalNear(blocks.position.x, blocks.position.y, blocks.position.z, 1), true)
    }
})

bot.on("chat", (username, message)=> {
    if(message == "yo"){
        const playerInfo = bot.players['iamnotadolphin'] ? bot.players[username].entity : null
        console.log(playerInfo.position)
        console.log(bot.entity.position.distanceTo(playerInfo.position))
    }
})


bot.on("chat", (username, message) => {
    if(message == "attack"){
        const playerInfo = bot.players['iamnotadolphin'] ? bot.players[username].entity : null
        const sword = bot.inventory.items().find(item => item.name.includes('sword'))
        if(sword) bot.equip(sword, 'hand')
        const shield = bot.inventory.items().find(item => item.name.includes('shield'))
        if(shield) bot.equip(sword, 'off-hand')
        bot.chat("Fine i will protect you")
        setInterval(() => {
        console.log("yep works")
        const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 && e.mobType !== 'Armor Stand' && e.mobType !== 'Slime'
        entity = bot.nearestEntity(filter)         
        bot.pvp.attack(entity)
        if(bot.entity.position.distanceTo(playerInfo.position) > 5){
            if(!bot.pvp.target){
                bot.pvp.stop()
                bot.pathfinder.setGoal(null)
                bot.pathfinder.setGoal(new goals.GoalNear(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z))
            }
        }
        }, 200)  
        
    }
    if (message == "enough"){
        bot.pvp.attack(null)
        setTimeout(()=>{
            followMe()
        })
    }
})

/*************************** goto ********************************/

function goto(position, proximity) {
    bot.pathfinder.setGoal(new goals.GoalNear(position.x, position.y, position.z, proximity), true);
}

bot.on('chat', (username, message)=>{
    if(message == "come to me"){
        const playerInfo = bot.players['iamnotadolphin'] ? bot.players[username].entity : null
        console.log("cometo called")
               
        // If Player doesn't exist, don't continue
        if (!playerInfo) return bot.chat("I don't see you !")
                  // Await pathfinder to complete the goal, then move to bot.chat and print "I've arrived !"
        var goingToPlayer = vec3(parseInt(playerInfo.position.x), parseInt(playerInfo.position.y), parseInt(playerInfo.position.z))
        goto(goingToPlayer, 1)
    }
})

bot.on('chat', (username, message)=> {
    let tokens = message.split(' ')
    if(tokens[0] == "goto") {
        var goingHere = vec3(parseInt(tokens[1]), parseInt(tokens[2]), parseInt(tokens[3]))
        goto(goingHere, 1);
    }
   
})

bot.on('chat', (username, message)=> {
    if(message == "stop following me") {
        bot.chat("I will stop following you now. Direct me to yor home.")
        bot.pathfinder.stop()
    }
   
})


/*********************************morning loop*********************************/
function wakeywakey(){
    bot.chat("wake up")
    if(bot.isSleeping){
        bot.wake()
        gaurdHome()
    }
    else{
        gaurdHome()
    }
}

bot.on('spawn', ()=>{
    looper()
})

function looper(){
    let thisInterval = setInterval(()=>{
        if(bot.time.time >= 6000 && bot.time.time <= 7200){
            console.log("farm time")
            farmLoop()
            clearInterval(thisInterval)
        }
    }, 20)
}

function morningLoop(){
     //morning
     if(bot.time.time >= 1000 && bot.time.time <= 1200){
         console.log("morning loop")
         gaurdHome()
         return
     }
     //noon
     if(bot.time.time >= 6000 && bot.time.time <= 7200){
         console.log("noon loop")
         bot.pvp.attack(null)
         bot.pathfinder.setGoal(null)
         farmLoop()
         return
     }
     //night
     if(bot.time.time >= 12000 && bot.time.tim < 23000 ){
         console.log("night loop")
         bot.pvp.attack(null)
         bot.pathfinder.setGoal(null)
         sleep()
         return
     }
}

bot.on('spawn', ()=>{
    let looperInterval = function checkTime(){

    }
})