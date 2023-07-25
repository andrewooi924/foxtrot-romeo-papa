import "./style.css";
import { interval, fromEvent, merge } from "rxjs";
import { map, filter, scan} from "rxjs/operators";

/**
 * The main function which contains all the code to run the game.
 */
function main() {

  /** The section below contains all the classes that will be used for the game*/

  /**
   * The Vector class which is used to position objects and give movement capabilities to the objects in the game.
   * 
   * References:
   * [1]: Stuff, T. C. (2022, September 2). FRP Asteroids. Tim’s Code Stuff. Retrieved September 6, 2022, from https://tgdwyer.github.io/asteroids/
   */
  class Vector{

    /**
     * Constructor for the Vector class
     * @param x x-coordinate of the object
     * @param y y-coordinate of the object
     */
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}

    /**
     * Function that adds a given vector with another vector
     * @param b The given vector
     * @returns The sum of the given vector with the other vector
     */
    readonly add = (b:Vector) => new Vector(this.x + b.x, this.y + b.y)

    /**
     * Function that subtracts a vector from a given vector
     * @param b The given vector
     * @returns The result of subtracting the given vector with another vector
     */
    readonly subtract = (b:Vector) => this.add(b.scale(-1))

    /**
     * Function that calculates the length of a given vector
     * @returns The length of the given vector
     */
    readonly length = ()=> Math.sqrt(this.x*this.x + this.y*this.y)

    /**
     * Function that scales a vector with a given number
     * @param s The given number for scaling
     * @returns The result of scaling a vector with the given number
     */
    readonly scale = (s:number) => new Vector(this.x*s,this.y*s)

    /**
     * Function that wraps an object that is not the frog(Player) around the canvas if it exceeds the boundaries/limits of the canvas
     * @param param0 The current vector(position) of the object
     * @returns The new vector(position) of the object after wrapping around the canvas
     */
    static readonly objectTorusWrap = ({ x, y }: Vector) => {
      return new Vector(x < 0 ? x + 600: x > 600 ? x - 600 : x, y < 40 ? y + 80: y > 560 ? y - 80 : y);
    }

    /**
     * Function that wraps the frog(Player) around the canvas if it exceeds the boundaries/limits of the canvas
     * @param param0 The current vector(position) of the frog(Player)
     * @returns The new vector(position) of the frog(Player) after wrapping around the canvas
     */
    static readonly frogTorusWrap = ({ x, y }: Vector) => {
      return new Vector(x < 30 ? x + 585: x > 570 ? x - 585 : x, 
                        y < 80 ? y + 80 : y <= 80 ? ((x >= 100 && x <= 135) || (x >= 285 && x <= 320) || (x >= 460 && x <= 495) ? y : y + 60) 
                        : y > 570 ? y - 60 : y)
    }

    /**
     * Function that wraps the frog(Player) with the double jump ability around the canvas if it exceeds the boundaries/limits of the canvas
     * @param param0 The current vector(position) of the frog(Player)
     * @returns The new vector(position) of the frog(Player) after wrapping around the canvas
     */
    static readonly doubleJumpTorusWrap = ({ x, y }: Vector) => {
      return new Vector(x < 30 ? x + 585: x > 570 ? x - 585 : x,
                        y <= 80 ? ((x >= 100 && x <= 135) || (x >= 280 && x <= 315) || (x >= 460 && x <= 495) ? (y == 80 ? y : y + 60) : y + 120) 
                        : y > 570 ? y - 120 : y)
    }

    /**
     * Zero Vector
     */
    static Zero = new Vector();
  }

  /**
   * The Tick class which tracks the amount of time passed in the game. One tick is 10 milliseconds
   */
  class Tick { 

    /**
     * Constructor for the Tick class
     * @param elapsed The amount of time passed in the game
     */
    constructor(public readonly elapsed: number) {} 
  };

  /**
   * The Move class which tracks the movement of the frog(Player) in the game
   */
  class Move { 

    /**
     * Constructor for the Move class
     * @param direction The direction in which the frog(Player) is moving
     * @param steps The number of steps the frog(Player) should take when moving in the given direction
     */
    constructor(public readonly direction: string, public readonly steps: number) {} 
  };

  /**
   * The Restart class which tracks when the user wants to restart the game
   */
  class Restart { constructor() {} };

  /**
   * The RNG class which creates a randomly generated number.
   * 
   * References:
   * [1]: undefined [Tim Dwyer]. (2021, August 26). PiApproximationsFRPSolution [Video]. YouTube. Retrieved September 6, 2022, from https://www.youtube.com/watch?v=RD9v9XHA4x4
   */
  class RNG {

    readonly m = 0x80000000
    readonly a = 1103515245
    readonly c = 12345

    /**
     * Constructor for the RNG class
     * @param state The current state of the game
     */
    constructor(readonly state: number) {}

    /**
     * Function that returns a randomly generated integer
     * @returns A randomly generated integer
     */
    int() {
      return (this.a * this.state + this.c) % this.m;
    }

    /**
     * Function that returns a randomly generated float
     * @returns A randomly generated float
     */
    float() {
      return this.int() / (this.m - 1);
    }

    /**
     * Function that returns a new instance of the RNG class
     * @returns A new instance of the RNG class
     */
    next() {
      return new RNG(this.int())
    }
  }

  /** The section above contains all the classes that will be used for the game*/

  /** The section below contains all the types that will be used in the game */

  /**
   * The Key type which represents all the keys that are used in the game, either for movement or restarting the game
   */
  type Key = "w" | "a" | "s" | "d" | "r";

  /**
   * The HTMLElementAttributes type which represents the attributes of the HTMLElement type using key value pairs
   */
  type HTMLElementAttributes = { [key: string]: string};

  /**
   * The Body type which represents the attributes of an object in the game
   */
  type Body = Readonly<{
    id: string,
    position: Vector,
    length: number,
    velocity: Vector,
    inRiver?: boolean,
    onLog?: boolean,
    onCroc?: boolean,
    onTurtle?: boolean,
    filled?: boolean,
    timeOnCroc?: number
  }>

  /**
   * The State type which represents the current state of the game
   */
  type State = Readonly<{
    frog: Body,
    frogCount: number,
    cars: ReadonlyArray<Body>,
    buses: ReadonlyArray<Body>,
    planks: ReadonlyArray<Body>,
    crocs: ReadonlyArray<Body>,
    snakes: ReadonlyArray<Body>,
    turtles: ReadonlyArray<Body>,
    targetOne: Body,
    targetTwo: Body,
    targetThree: Body,
    jumpPower: Body,
    doubleJump: boolean,
    snakeBite: boolean,
    removables: ReadonlyArray<string>,
    time: number,
    reached: boolean,
    levelBeaten: boolean,
    gameOver: boolean,
    restart: boolean,
    level: number,
    score: number,
    highScore: number,
    rng: RNG
  }>

  /** The section above contains all the types that will be used in the game */
  
  /**
   * The initial state of the game
   */
  const INITIALSTATE: State = {
    frog: {
      id: "frog",
      position: new Vector(300, 560),
      length: 55,
      velocity: Vector.Zero,
      inRiver: false,
      onLog: false,
      onCroc: false,
      onTurtle: false,
      timeOnCroc: 0
    },
    frogCount: 0,
    cars: Array(4).fill(0).map((_, index) => (<Body>{
      id: `car${index}`,
      position: new Vector(index * 300, 480),
      length: 25,
      velocity: new Vector(3, 0)
    })),
    buses: Array(4).fill(0).map((_, index) => (<Body>{
      id: `bus${index}`,
      position: new Vector(index * 300, 425),
      length: 40,
      velocity: new Vector(-2, 0)
    })),
    planks: Array(4).fill(0).map((_, index) => (<Body>{
      id: `plank${index}`,
      position: new Vector(index * 300, 240),
      length: 60,
      velocity: new Vector(2, 0)
    })),
    crocs: Array(4).fill(0).map((_, index) => (<Body>{
      id: `croc${index}`,
      position: new Vector(index * 200, 185),
      length: 50,
      velocity: new Vector(-1, 0)
    })),
    snakes: Array(4).fill(0).map((_, index) => (<Body>{
      id: `snake${index}`,
      position: new Vector(index * 300, 380),
      length: 40,
      velocity: new Vector(1, 0)
    })),
    turtles: Array(4).fill(0).map((_, index) => (<Body>{
      id: `turtle${index}`,
      position: new Vector(index * 200, 130),
      length: 60,
      velocity: new Vector(-2, 0),
    })),
    targetOne: {
      id: "targetone",
      position: new Vector(80, 35),
      length: -20,
      velocity: Vector.Zero
    },
    targetTwo: {
      id: "targetwo",
      position: new Vector(260, 35),
      length: -20,
      velocity: Vector.Zero
    },
    targetThree: {
      id: "targetthree",
      position: new Vector(440, 35),
      length: -20,
      velocity: Vector.Zero
    },
    jumpPower: {
      id: "jumpPower",
      position: new Vector(Math.round(new RNG(1).float() * 600), Math.round(new RNG(1).next().float() * 300 + 200)),
      length: 2,
      velocity: Vector.Zero
    },
    snakeBite: false,
    doubleJump: false,
    removables: [],
    time: 0,
    reached: false,
    levelBeaten: false,
    gameOver: false,
    restart: false,
    level: 1,
    score: 0,
    highScore: 0,
    rng: new RNG(1)
  };

  /**
   * Function that represents the game clock, it generates a constant stream of numbers which are used to create new instances of the Tick class to create the game clock.
   */
  const gameClock = interval(10).pipe(map(elapsed => new Tick(elapsed)));

  /**
   * Function that observes the key pressed by the user and checks if it matches the given key of type Key
   * @param k The given key
   * @param result Function that returns an instance of a class if keypress matches given key
   * @returns An instance of a class based on the keypress if it matches the given key
   */
  const keyObserve = <T>(k: Key, result:() => T) => 
    fromEvent<KeyboardEvent>(document, "keydown")
      .pipe(
        map(({key}) => key),
        filter(key => key === k),
        map(result)
      )

  const moveLeft = keyObserve("a", () => new Move("a", -45));
  const moveRight = keyObserve("d", () => new Move("d", 45));
  const moveUp = keyObserve("w", () => new Move("w", -60));
  const moveDown = keyObserve("s", () => new Move("s", 60));
  const restart = keyObserve("r", () => new Restart());

  /**
   * Function that gives continuous movement to the given object
   * @param b The given object
   * @returns The given object but with continuous movement
   */
  const moveObject = (b: Body) => <Body>{
    ...b,
    position: Vector.objectTorusWrap(b.position.add(b.velocity))
  }

  /**
   * Function that gives continuous movement to the frog(Player) matching the velocity of the object it is standing on
   * This only occurs if the frog is standing on an object in the River section
   * @param b The frog(Player)
   * @returns The frog(Player) but with continuous movement matching the velocity of the object it is standing on
   */
  const moveFrog = (b: Body) => <Body>{
    ...b,
    position: Vector.frogTorusWrap((b.position).add(b.velocity))
  }

  /** The section below contains all the functions used to create views of all the objects in the game */

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the frog(Player) 
   * @param b The frog(Player)
   * @returns An object containing the attributes of the view of the frog(Player)
   */
  const createFrog = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    r: "25",
    style: "fill:chartreuse"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of a static frog.
   * The static frog replaces the player's frog when a target is filled
   * @param s The current state of the game
   * @returns An object containing the attributes of the view of the frog(Player)
   */
  const createStaticFrog = (s: State): HTMLElementAttributes => ({
    id: `frog${s.frogCount}`,
    r: "25",
    style: "fill:chartreuse"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the car
   * @param b The car
   * @returns An object containing the attributes of the view of the car
   */
  const createCar = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "60",
    height: "30",
    style: "fill:red"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the bus
   * @param b The bus
   * @returns An object containing the attributes of the view of the bus
   */
  const createBus = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "80",
    height: "30",
    style: "fill:yellow"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the plank
   * @param b The plank
   * @returns An object containing the attributes of the view of the plank
   */
  const createPlank = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "120",
    height: "30",
    style: "fill:brown"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the crocodile
   * @param b The crocodile
   * @returns An object containing the attributes of the view of the crocodile
   */
  const createCroc = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "100",
    height: "30",
    style: "fill:darkgreen"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the snake
   * @param b The snake
   * @returns An object containing the attributes of the view of the snake
   */
  const createSnake = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "80",
    height: "5",
    style: "fill:forestgreen"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the turtle
   * @param b The turtle
   * @returns An object containing the attributes of the view of the turtle
   */
  const createTurtle = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "120",
    height: "30",
    style: "fill:green"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the target
   * @param b The target
   * @returns An object containing the attributes of the view of the target
   */
  const createTarget = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "80",
    height: "70",
    style: "fill:purple"
  })

  /**
   * Function that creates a HTMLElementAttributes type object containing the attributes to create the view of the jump powerup
   * @param b The jump powerup
   * @returns An object containing the attributes of the view of the jump powerup
   */
  const createJump = (b: Body): HTMLElementAttributes => ({
    id: b.id,
    width: "20",
    height: "20",
    style: "fill:black"
  })

  /** The section above contains all the functions used to create views of all the objects in the game */

  /**
   * Function that contains all the necessary code for creating collisions in the game
   * @param s The current state of the game
   * @returns The state of the game after handling all possible collisions
   */
  const collisionHandler = (s: State) => {

    /**
     * Function that checks if collision occurs between two objects
     * @param param0 Array containing the two objects
     * @returns True if a collision occurs, false otherwise
     */
    const bodiesCollided = ([a,b]:[Body,Body]) => a.position.x > b.position.x && (a.position.y - b.position.y <= 20 && a.position.y - b.position.y >= -20) 
                                                ? a.position.subtract(b.position).length() <  a.length + b.length
                                                  : b.position.subtract(a.position).length() < a.length - b.length;

    /**
     * Checks if the frog(Player) collides with any objects in the game
     * The frog dies when colliding with a car or a bus
     * The frog is able to stand on a plank, crocodile or turtle while in the River section
     */
    const frogCollided = s.cars.filter(c => bodiesCollided([s.frog, c])).length > 0 
                          || s.buses.filter(b => bodiesCollided([s.frog, b])).length > 0
                          ||(
                            !(s.planks.filter(p => bodiesCollided([s.frog, p])).length > 0 
                              || s.crocs.filter(c => bodiesCollided([s.frog, c])).length > 0
                              || s.turtles.filter(t => bodiesCollided([s.frog, t])).length > 0) && s.frog.inRiver
                            ) 

    /**
     * Checks if the frog(Player) has filled a target (collided with the target)
     */
    const frogReached = bodiesCollided([s.frog, s.targetOne]) || bodiesCollided([s.frog, s.targetTwo]) || bodiesCollided([s.frog, s.targetThree])

    /**
     * Checks if the frog(Player) has picked up a powerup (collided with the powerup)
     */
    const powerUp = bodiesCollided([s.frog, s.jumpPower])

    return <State>{
      ...s,
      frog: moveFrog({
        ...s.frog,
        onLog: (s.planks.filter(p => bodiesCollided([s.frog, p])).length > 0) && s.frog.inRiver,
        onCroc: (s.crocs.filter(c => bodiesCollided([s.frog, c])).length > 0) && s.frog.inRiver,
        onTurtle: (s.turtles.filter(t => bodiesCollided([s.frog, t])).length > 0) && s.frog.inRiver,
        velocity: s.frog.onLog ? s.planks[0].velocity : s.frog.onCroc ? s.crocs[0].velocity : s.frog.onTurtle ? s.turtles[0].velocity : s.snakeBite ? s.snakes[0].velocity : Vector.Zero, 
      }),
      doubleJump: s.doubleJump ? s.doubleJump : powerUp,
      snakeBite: s.snakeBite ? s.snakeBite : s.snakes.filter(sn => bodiesCollided([s.frog, sn])).length > 0,
      targetOne: {...s.targetOne, filled: s.targetOne.filled ? s.targetOne.filled : bodiesCollided([s.frog, s.targetOne])},
      targetTwo: {...s.targetTwo, filled: s.targetTwo.filled ? s.targetTwo.filled : bodiesCollided([s.frog, s.targetTwo])},
      targetThree: {...s.targetThree, filled: s.targetThree.filled ? s.targetThree.filled : bodiesCollided([s.frog, s.targetThree])},
      score: s.score + (!s.targetOne.filled && bodiesCollided([s.frog, s.targetOne]) ? 300 : 0) 
                     + (!s.targetTwo.filled && bodiesCollided([s.frog, s.targetTwo]) ? 300 : 0) 
                     + (!s.targetThree.filled && bodiesCollided([s.frog, s.targetThree]) ? 300 : 0),
      highScore: s.score + (!s.targetOne.filled && bodiesCollided([s.frog, s.targetOne]) ? 300 : 0) 
                      + (!s.targetTwo.filled && bodiesCollided([s.frog, s.targetTwo]) ? 300 : 0) 
                      + (!s.targetThree.filled && bodiesCollided([s.frog, s.targetThree]) ? 300 : 0) > s.highScore 
                      ? s.score + (!s.targetOne.filled && bodiesCollided([s.frog, s.targetOne]) ? 300 : 0) 
                            + (!s.targetTwo.filled && bodiesCollided([s.frog, s.targetTwo]) ? 300 : 0) 
                            + (!s.targetThree.filled && bodiesCollided([s.frog, s.targetThree]) ? 300 : 0)
                      : s.highScore,
      reached: frogReached,
      gameOver: frogCollided
    }
  }

  /**
   * The most important function in the game, it checks every tick for changes to the state of the game
   * @param s The current state of the game
   * @param elapsed The time elapsed in the game
   * @returns New state of the game
   */
  const tick = (s: State, elapsed: number): State => {

    /**
     * Check if all three distinct targets have been filled
     * If so, reset the game to initial state while keeping the current score and increase difficulty
     */
    if(s.targetOne.filled && s.targetTwo.filled && s.targetThree.filled) {
      return {...INITIALSTATE, 
        cars: Array(4).fill(0).map((_, index) => (<Body>{
          id: `car${index}`,
          position: new Vector(index * 300, 480),
          length: 25,
          velocity: s.cars[0].velocity.add(new Vector(0.2, 0))
        })),
        buses: Array(4).fill(0).map((_, index) => (<Body>{
          id: `bus${index}`,
          position: new Vector(index * 300, 425),
          length: 40,
          velocity: s.buses[0].velocity.subtract(new Vector(0.2, 0))
        })),
        planks: Array(4).fill(0).map((_, index) => (<Body>{
          id: `plank${index}`,
          position: new Vector(index * 300, 240),
          length: 60,
          velocity: s.planks[0].velocity.add(new Vector(0.2, 0))
        })),
        crocs: Array(4).fill(0).map((_, index) => (<Body>{
          id: `croc${index}`,
          position: new Vector(index * 200, 185),
          length: 50,
          velocity: s.crocs[0].velocity.subtract(new Vector(0.2, 0))
        })),
        snakes: Array(4).fill(0).map((_, index) => (<Body>{
          id: `snake${index}`,
          position: new Vector(index * 300, 370),
          length: 40,
          velocity: s.snakes[0].velocity.add(new Vector(0.2, 0))
        })),
        turtles: Array(4).fill(0).map((_, index) => (<Body>{
          id: `turtle${index}`,
          position: new Vector(index * 200, 130),
          length: 60,
          velocity: s.turtles[0].velocity.subtract(new Vector(0.2, 0)),
        })),
        removables: s.removables.concat(`frog${s.frogCount}`),
        levelBeaten: true,
        level: s.level + 1,
        score: s.score + 500,
        highScore: s.score + 500 >= s.highScore ? s.score + 500 : s.highScore,
        rng: s.rng.next(),
        jumpPower: {
          ...s.jumpPower,
          position: new Vector(Math.round(s.rng.float() * 600), Math.round(s.rng.next().float() * 300 + 200))
        }
      }
    }

    /**
     * Check if game over or whether the frog(Player) has been on any crocodile for more than 2.5 seconds
     */
    if((s.frog.timeOnCroc as number) > 250 || s.gameOver) {
      return {...s,
        gameOver: true
      }
    }

    /**
     * Check if the frog(Player) has filled a target
     * If so, reset the game to initial state while keeping the score and the view of the filled target
     */
    if(s.reached) {
      return { ...INITIALSTATE,
        frogCount: s.frogCount + 1,
        cars: s.cars,
        buses: s.buses,
        planks: s.planks,
        crocs: s.crocs,
        snakes: s.snakes,
        turtles: s.turtles,
        targetOne: s.targetOne,
        targetTwo: s.targetTwo,
        targetThree: s.targetThree,
        level: s.level,
        time: s.time,
        doubleJump: s.doubleJump,
        removables: s.removables.concat(`frog${s.frogCount}`),
        reached: false,
        score: s.score, 
        highScore: s.highScore,
        rng: s.rng.next(),
        jumpPower: {
          ...s.jumpPower,
          position: new Vector(Math.round(s.rng.float() * 600), Math.round(s.rng.next().float() * 300 + 200))
        }
      }
    }
    return collisionHandler({...s,
    frog: {...s.frog, 
    inRiver: s.frog.position.y <= 260 && s.frog.position.y > 80,
    timeOnCroc: s.frog.onCroc ? (s.frog.timeOnCroc as number) + 1 : 0
    },
    time: elapsed,
    cars: s.cars.map(moveObject),
    buses: s.buses.map(moveObject),
    planks: s.planks.map(moveObject),
    crocs: s.crocs.map(moveObject),
    snakes: s.snakes.map(moveObject),
    turtles: s.turtles.map(moveObject),
    })
  }

  /**
   * Function that returns a new state of the game based on the user input or tick
   * @param s The current state of the game
   * @param e The event that has occured based on the user input or tick
   * @returns A new state of the game based on the user input or tick
   */
  const reduceState = (s: State, e:Move | Tick | Restart) =>
    {
      return e instanceof Move ? s.gameOver ? s 
      : {...s, 
        frog: {
          ...s.frog,
          //Check if the frog(Player) has been bitten by a snake and if the frog(Player) has the double jump power up
          position: s.snakeBite ? s.frog.position : s.doubleJump ? Vector.doubleJumpTorusWrap(new Vector(
            e.direction === "a" || e.direction === "d" ? s.frog.position.x + e.steps: s.frog.position.x,
              e.direction === "w" || e.direction === "s" ? s.frog.position.y + e.steps * 2 : s.frog.position.y
              )) : Vector.frogTorusWrap(new Vector(
            e.direction === "a" || e.direction === "d" ? s.frog.position.x + e.steps : s.frog.position.x,
              e.direction === "w" || e.direction === "s" ? s.frog.position.y + e.steps : s.frog.position.y
              )),
          velocity: Vector.Zero
        }
      } : e instanceof Restart ? {...INITIALSTATE,frogCount: s.frogCount, removables: s.removables, restart: true, highScore: s.highScore}
      : tick(s, e.elapsed);
    }
  
  /**
   * Function that updates the view of the game
   * @param s The current state of the game
   */
  const updateView = (s: State): void => {

    /**
     * The all important canvas
     */
    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

    /**
     * Helper function that bulk sets properties on a given element based on a given object containing key value pairs of the attributes of the element
     * @param e The given element
     * @returns A function that takes an input of an object containing key value pairs and bulk sets the properties of the given element
     */
    const attr = (e: Element) => (k: {[key: string]: string}) => {
      Object.keys(k).forEach(key => e.setAttribute(key, k[key]));
    }

    /**
     * Helper function that creates an element based on the given element type and given element attributes
     * @param elementType The given element type
     * @param obj The given element attributes
     * @returns The created element
     */
    const createElementById = (elementType: string, obj: HTMLElementAttributes): Element => {
      const v = document.createElementNS(svg.namespaceURI, elementType);
      attr(v)(obj);
      svg.appendChild(v);
      return v;
    }

    /**
     * Helper function that removes an element from the canvas based on the given id
     * @param id The given id of the element
     */
    const removeElementById = (id: string) => {
      const v = document.getElementById(id);
      if (v) svg.removeChild(v);
    }

    /**
     * Check if the frog(Player) has the double jump ability
     * If so, remove the power up from view
     */
    if(s.doubleJump) {
      removeElementById(s.jumpPower.id)
    }

    /**
     * Check if the user has beaten the level or prompted to restart the game
     * If so, remove all filled targets on the screen and the game over text
     */
    if(s.restart || s.levelBeaten) {
      removeElementById("gameOver")
      s.removables.forEach(r => removeElementById(r)) 
    }

    /**
     * Check if it is game over
     * If so, display game over text
     */
    if(s.gameOver) {
      const v = document.createElementNS(svg.namespaceURI, "text");
      attr(v)({x:"150", y:"300", class:"gameover", style:"fill:red", id:"gameOver"});
      v.textContent = "Game Over";
      svg.appendChild(v);
    }

    /**
     * Check if the frog(Player) has filled a target
     * If so, create a static frog to replace the player's frog
     */
    if(s.reached) {
      attr(createElementById("circle", createStaticFrog(s)))({transform: `translate(${s.frog.position.x}, ${s.frog.position.y})`})
    }
    /**
     * Updates the view of all objects in the game if the frog(Player) is not filling a target
     */
    else {
      s.cars.forEach(car => attr(document.getElementById(car.id) ? document.getElementById(car.id) as HTMLElement : createElementById("rect", createCar(car)))({
        transform: `translate(${car.position.x}, ${car.position.y})`
      }))
      s.buses.forEach(bus => attr(document.getElementById(bus.id) ? document.getElementById(bus.id) as HTMLElement : createElementById("rect", createBus(bus)))({
        transform: `translate(${bus.position.x}, ${bus.position.y})`
      }))
      s.planks.forEach(plank => attr(document.getElementById(plank.id) ? document.getElementById(plank.id) as HTMLElement : createElementById("rect", createPlank(plank)))({
        transform: `translate(${plank.position.x}, ${plank.position.y})`
      }))
      s.crocs.forEach(croc => attr(document.getElementById(croc.id) ? document.getElementById(croc.id) as HTMLElement : createElementById("rect", createCroc(croc)))({
        transform: `translate(${croc.position.x}, ${croc.position.y})`
      }))
      s.snakes.forEach(snake => attr(document.getElementById(snake.id) ? document.getElementById(snake.id) as HTMLElement : createElementById("rect", createSnake(snake)))({
        transform: `translate(${snake.position.x}, ${snake.position.y})`
      }))
      s.turtles.forEach(turtle => attr(document.getElementById(turtle.id) ? document.getElementById(turtle.id) as HTMLElement : createElementById("rect", createTurtle(turtle)))({
        transform: `translate(${turtle.position.x}, ${turtle.position.y})`
      }))
      attr(document.getElementById(s.targetOne.id) ? document.getElementById(s.targetOne.id) as HTMLElement: createElementById("rect", createTarget(s.targetOne)))
      ({transform: `translate(${s.targetOne.position.x}, ${s.targetOne.position.y})`})
      attr(document.getElementById(s.targetTwo.id) ? document.getElementById(s.targetTwo.id) as HTMLElement: createElementById("rect", createTarget(s.targetTwo)))
      ({transform: `translate(${s.targetTwo.position.x}, ${s.targetTwo.position.y})`})
      attr(document.getElementById(s.targetThree.id) ? document.getElementById(s.targetThree.id) as HTMLElement: createElementById("rect", createTarget(s.targetThree)))
      ({transform: `translate(${s.targetThree.position.x}, ${s.targetThree.position.y})`})
    }

    /**
     * If the frog(Player) has been bitten by a snake (collided with the snake), transform the frog(Player) into a snake
     * This is done by removing the frog from the screen and creating the snake under the frog's id
     */
     if(s.snakeBite){
      removeElementById(s.frog.id)
      attr(document.getElementById(s.frog.id) ? document.getElementById(s.frog.id) as HTMLElement : createElementById("rect", createSnake(s.frog)))
      ({transform: `translate(${s.frog.position.x}, ${s.frog.position.y})`})
    }
    /**
     * Update the view of the frog(Player)
     */
    else{
      removeElementById(s.frog.id)
      attr(document.getElementById(s.frog.id) ? document.getElementById(s.frog.id) as HTMLElement : createElementById("circle", createFrog(s.frog)))
      ({transform: `translate(${s.frog.position.x}, ${s.frog.position.y})`})
    }
    
    /**
     * If the frog(Player) does not have the double jump powerup (which means that there should be a double jump powerup on the canvas).
     * create the view of the double jump powerup
     */
    if(!s.doubleJump){
    attr(document.getElementById(s.jumpPower.id) ? document.getElementById(s.jumpPower.id) as HTMLElement: createElementById("rect", createJump(s.jumpPower)))
    ({transform: `translate(${s.jumpPower.position.x}, ${s.jumpPower.position.y})`})
    }
    
    /**
     * Update the current level, score and highscore
     */
    removeElementById("score");
    const v = document.createElementNS(svg.namespaceURI, "text");
    attr(v)({x:"30", y:"330", class:"score", style:"fill:black", id:"score"});
    v.textContent = `Level: ${s.level} | Score: ${s.score} | Highscore: ${s.highScore}`;
    svg.appendChild(v);
  }

  /**
   * Function that updates the state of the game and the view of the game 
   */
    const subscription = merge(moveLeft, moveRight, moveUp, moveDown, gameClock, restart)
    .pipe(
      scan(reduceState, INITIALSTATE)
    )
    .subscribe(updateView);
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
