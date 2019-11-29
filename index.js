class Utils {
  static setDynamicInterval(fn, intervalFn, exitFn) {
    setTimeout(() => {
      if(exitFn()) {
        return
      }
      fn()
      this.setDynamicInterval(fn, intervalFn, exitFn)
    }, intervalFn())
  }

  static loop(v, step, min, max) {
    v += step % (max - min + 1)

    if(v < min) {
      return max - (min - v - 1)
    } else if(v > max) {
      return min + (max - v + 1)
    }

    return v
  }

  static pixel(r, g, b, a = 1) {
    let canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    let ctx = canvas.getContext('2d')
    ctx.fillStyle = `rgba(${[r, g, b, a].join(',')})`
    ctx.fillRect(0, 0, 1, 1)

    return canvas
  }

  static keyboard(value) {
    let key = {}
    key.value = value
    key.isDown = false
    key.isUp = true
    key.press = undefined
    key.release = undefined
    //The `downHandler`
    key.downHandler = event => {
      if (event.key === key.value) {
        if (key.isUp && key.press) key.press()
        key.isDown = true
        key.isUp = false
        event.preventDefault()
      }
    }

    //The `upHandler`
    key.upHandler = event => {
      if (event.key === key.value) {
        if (key.isDown && key.release) key.release()
        key.isDown = false
        key.isUp = true
        event.preventDefault()
      }
    }

    //Attach event listeners
    const downListener = key.downHandler.bind(key)
    const upListener = key.upHandler.bind(key)

    window.addEventListener(
      "keydown", downListener, false
    )
    window.addEventListener(
      "keyup", upListener, false
    )

    // Detach event listeners
    key.unsubscribe = () => {
      window.removeEventListener("keydown", downListener)
      window.removeEventListener("keyup", upListener)
    }

    return key
  }
}

const DIRECTIONS = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3
}

const ROLES = {
  FIELD: 0,
  SNAKE: 1,
  APPLE: 2,
  HEAD: 3
}

const ROLE_TEXTURES = {
  [ROLES.SNAKE]: PIXI.Texture.from(Utils.pixel(255, 255, 0)),
  [ROLES.FIELD]: PIXI.Texture.from(Utils.pixel(0, 0, 0)),
  [ROLES.APPLE]: PIXI.Texture.from(Utils.pixel(255, 0, 0)),
  [ROLES.HEAD]:  PIXI.Texture.from(Utils.pixel(200, 200, 0))
}

class App {
  static create(options) {
    return new App(options)
  }

  constructor(options) {
    this.options = options

    this.app = null
    this.board = null
    this.controls = null
    this.started = false
    this.metrics = null

    this.initApp()
    this.initBoard()
    this.initControls()
    this.initMetrics()
    this.initUI()

    this.start()
  }

  initApp() {
    this.app = new PIXI.Application({
      width: 800,
      height: 600,
      backgroundColor: 0x10ffbb,
      resolution: window.devicePixelRatio || 1,
    })
    document.body.appendChild(this.app.view)
  }

  initBoard() {
    const {rows, cols} = this.options.board.size
    this.board = new Board(this, rows, cols)
  }

  initControls() {
    this.controls = new Controls(this)
  }

  initUI() {
    this.ui = new UI(this)
    this.gameover = new GameOver(this)
  }

  initMetrics() {
    this.metrics = new Metrics(this)
  }

  start() {
    this.gameover.hide()
    this.controls.reset()
    this.started = true
    this.board.reset()
    Utils.setDynamicInterval(() => {
      this.board.find(SnakeHead).move(this.controls.dir)
      this.controls.lastMove = this.controls.dir
      this.ui.update()
    }, () => this.metrics.speed(), () => !this.started)
  }

  gameOver() {
    this.gameover.show()
    this.started = false
    const key = Utils.keyboard(" ")
    key.press = () => {
      console.log(1)
      this.start()
      key.unsubscribe()
    }
  }
}

class Metrics {
  constructor(app) {
    this.app = app

    this.score = 0
    this.ate = 0
    this.cost = 1
  }

  eat() {
    this.ate++
    this.cost = ~~(this.ate / this.app.options.timer.every) + 1
    this.score += this.cost
  }

  speed() {
    const options = this.app.options.timer

    return options.start - options.step * ~~(this.ate / options.every)
  }
}

class Board extends PIXI.Container {
  constructor(app, rows, cols) {
    super()

    this.app = app
    this.rows = rows
    this.cols = cols

    this.app.app.stage.addChild(this)
  }

  reset() {
    this.tiles = null

    this.initTiles()
    this.initSnake()
    this.initApples()
  }

  initTiles() {
    this.tiles = Array(this.rows).fill().map((v, y) => Array(this.cols).fill().map((v, x) => new Tile(this, x, y, ROLES.FIELD)))
  }

  initSnake() {
    const x = ~~(this.cols / 2)
    let y = ~~(this.rows / 2)

    this.tiles[y][x].makeIt(SnakeHead)

    for (++y; y < ~~(this.rows / 2) + this.app.options.snake.length; y++) {
      this.tiles[y][x].makeIt(Snake)
      this.tiles[y - 1][x].next = this.tiles[y][x]
    }
  }

  initApples() {
    let remain = this.app.options.apples.count

    while(remain) {
      const x = ~~(Math.random() * this.cols)
      const y = ~~(Math.random() * this.rows)

      if(this.tiles[y][x].role !== ROLES.FIELD) {
        continue
      }

      this.tiles[y][x].makeIt(Apple)
      remain--
    }
  }

  dropApple() {
    while(1) {
      const x = ~~(Math.random() * this.cols)
      const y = ~~(Math.random() * this.rows)

      if(this.tiles[y][x].role !== ROLES.FIELD) {
        continue
      }

      this.tiles[y][x].makeIt(Apple)
      return
    }
  }

  find(ofRole) {
    for(let row of this.tiles) {
      for(let tile of row) {
        if(tile.constructor === ofRole) {
          return tile
        }
      }
    }
  }
}

class GameOver extends PIXI.Text {
  constructor(app) {
    super()

    this.app = app

    this.x = this.app.app.screen.width / 2
    this.y = this.app.app.screen.height / 2
    this.anchor.set(0.5)
    
    this.style.fontFamily = 'Arial'
    this.style.fontSize = 48
    this.style.fill = 0xff1010
    this.style.align = 'center'

    this.visible = false
    
    this.app.app.stage.addChild(this)
  }
  
  show() {
    this.visible = true
    this.text = `Game over!\nYour score is: ${this.app.metrics.score}\nPress Space to restart`
  }

  hide() {
    this.visible = false
  }
}

class UI extends PIXI.Text {
  constructor(app) {
    super()

    this.app = app

    this.update()

    this.x = this.app.app.screen.width - 100
    this.y = 0
    this.style.fontFamily = 'Arial'
    this.style.fontSize = 24
    this.style.fill = 0xff1010
    this.style.align = 'center'

    this.app.app.stage.addChild(this)
  }

  update() {
    this.text = `Score: ${this.app.metrics.score}\nAte: ${this.app.metrics.ate}`
  }
}

class Controls {
  constructor(app) {
    this.app = app

    this.reset()

    Utils.keyboard("ArrowLeft").press = () => this.look(DIRECTIONS.LEFT)
    Utils.keyboard("ArrowUp").press = () => this.look(DIRECTIONS.UP)
    Utils.keyboard("ArrowRight").press = () => this.look(DIRECTIONS.RIGHT)
    Utils.keyboard("ArrowDown").press = () => this.look(DIRECTIONS.DOWN)
  }

  reset() {
    this.dir = DIRECTIONS.UP
    this.lastMove = DIRECTIONS.UP
  }

  look(dir) {
    this.dir = this.lastMove

    if(this.dir === DIRECTIONS.UP && dir !== DIRECTIONS.DOWN) { 
      this.dir = dir
    } else if (this.dir === DIRECTIONS.LEFT && dir !== DIRECTIONS.RIGHT) {
      this.dir = dir
    } else if (this.dir === DIRECTIONS.DOWN && dir !== DIRECTIONS.UP) {
      this.dir = dir
    } else if (this.dir === DIRECTIONS.RIGHT && dir !== DIRECTIONS.LEFT) {
      this.dir = dir
    }
  }
}

class Tile extends PIXI.Sprite {
  constructor(board, x, y, role = ROLES.FIELD) {
    super()

    this.board = board
    this.xPos = x
    this.yPos = y
    this.role = role
    this.update()
    
    this.x = this.xPos * (this.board.app.options.tile.size.width + this.board.app.options.board.margin.x)
    this.y = this.yPos * (this.board.app.options.tile.size.height + this.board.app.options.board.margin.y)
    
    this.scale.x = this.board.app.options.tile.size.width
    this.scale.y = this.board.app.options.tile.size.height

    this.board.addChild(this)
  }

  makeIt(role) {
    this.board.removeChild(this)
    this.board.tiles[this.yPos][this.xPos] = new role(this.board, this.xPos, this.yPos)
  }

  update() {
      this.texture = ROLE_TEXTURES[this.role]
  }
}

class Snake extends Tile {
  constructor(board, x, y, role = ROLES.SNAKE) {
    super(board, x, y, role)

    this.next = null
  }

  get tail() {
    let pointer = this

    while(pointer.next) {
      pointer = pointer.next
    }

    return pointer
  }
}

class SnakeHead extends Snake {
  constructor(board, x, y, role = ROLES.HEAD) {
    super(board, x, y, role)
  }

  move(dir) {
    const {dx, dy} = {
      [DIRECTIONS.UP]: {dx: 0, dy: -1},
      [DIRECTIONS.RIGHT]: {dx: 1, dy: 0},
      [DIRECTIONS.DOWN]: {dx: 0, dy: 1},
      [DIRECTIONS.LEFT]: {dx: -1, dy: 0}
    }[dir]
    
    const y = Utils.loop(this.yPos, dy, 0, this.board.app.options.board.size.rows - 1)
    const x = Utils.loop(this.xPos, dx, 0, this.board.app.options.board.size.cols - 1)

    if(this.board.tiles[y][x].role === ROLES.SNAKE) {
      this.board.app.gameOver()
      return
    } else if(this.board.tiles[y][x].role === ROLES.APPLE) {
      this.board.dropApple()
      this.board.app.metrics.eat()

      this.board.tiles[y][x].makeIt(SnakeHead)
      const newHead = this.board.tiles[y][x]
      
      const xPos = this.xPos
      const yPos = this.yPos
      const body = this.next
      
      this.makeIt(Snake)
      const oldHead = this.board.tiles[yPos][xPos]
      
      newHead.next = oldHead
      oldHead.next = body
    } else {
      this.board.tiles[y][x].makeIt(SnakeHead)
      const newHead = this.board.tiles[y][x]
      
      const xPos = this.xPos
      const yPos = this.yPos
      const body = this.next
      
      this.makeIt(Snake)
      const oldHead = this.board.tiles[yPos][xPos]
      
      newHead.next = oldHead
      oldHead.next = body
      let p = body
      while(p.next.next) {
        p = p.next
      }
      oldHead.tail.makeIt(Tile)
      p.next = null
    }
  }
}

class Apple extends Tile {
  constructor(board, x, y, role = ROLES.APPLE) {
    super(board, x, y, role)
  }
}
