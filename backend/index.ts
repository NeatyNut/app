import { createServer, type IncomingMessage } from 'http'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildRecommendations } from './recommendationEngine'

const PORT = Number(process.env.PORT ?? 4000)

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

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

  if (req.url === '/recommendations' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const payload = JSON.parse(body || '{}') as { grade_average?: unknown }
      const gradeAverage = Number(payload.grade_average)

      if (!Number.isFinite(gradeAverage) || gradeAverage < 1 || gradeAverage > 9) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'grade_average must be a number between 1 and 9' }))
        return
      }

      const csv = await readFile(join(process.cwd(), 'db.csv'), 'utf8')
      const recommendations = buildRecommendations(csv, gradeAverage)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(recommendations))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'Unable to build recommendations' }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend running: http://localhost:${PORT}`)
})

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    req.on('error', reject)
  })
}
