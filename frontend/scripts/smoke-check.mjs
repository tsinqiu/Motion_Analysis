import { request } from 'node:http'

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const paths = [
  '/',
  '/login',
  '/register',
  '/today',
  '/activities',
  '/activities/189',
  '/calendar',
  '/trends',
  '/training-load',
  '/statistics',
  '/records',
  '/sync',
  '/community',
  '/explore',
  '/settings',
  '/start',
  '/schema',
]

function checkPath(path) {
  const url = new URL(path, baseUrl)

  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', timeout: 8000 }, (res) => {
      res.resume()
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`${path} ${res.statusCode}`)
          return
        }

        reject(new Error(`${path} returned ${res.statusCode}`))
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error(`${path} timed out`))
    })

    req.on('error', reject)
    req.end()
  })
}

const results = await Promise.all(paths.map(checkPath))
for (const result of results) {
  console.log(result)
}
