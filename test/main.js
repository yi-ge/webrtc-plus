const fastify = require('fastify')()
const SocketIO = require('socket.io')

require('fs').copyFileSync('./dist/WebRTCPlus.js', './test/WebRTCPlus.js')

fastify.register(require('@fastify/cors'))
fastify.register(require('@fastify/static'), { root: __dirname })

const io = SocketIO(fastify.server, {
  cors: {
    origin: "*",
    allowedHeaders: ["Accept", "Authorization", "Cache-Control", "Content-Type", "DNT", "If-Modified-Since", "Keep-Alive", "Origin", "User-Agent", "X-Requested-With", "Token", "x-access-token"],
    credentials: true
  }
})

io.on('connection', (socket) => {
  console.log('Connected to client')
  socket.on('signal', data => {
    socket.broadcast.emit('signal', data)
  })
})

fastify.listen(10000)
