import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { join } from 'path'

const PORT = Number(process.env.PORT ?? 4000)

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400)
    res.end('Bad request')
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (req.url === '/data') {
    try {
      const csv = await readFile(join(process.cwd(), 'db.csv'), 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' })
      res.end(csv)
    } catch (error) {
      res.writeHead(500)
      res.end('Unable to read db.csv')
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}`)
})
