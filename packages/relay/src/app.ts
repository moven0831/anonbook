import express from 'express'
import { createDb } from './db'
import { config } from './config'

// Anonbook routes
import { signupRouter } from './routes/anonbook-signup'
import { attestRouter } from './routes/anonbook-attest'
import { postRouter } from './routes/anonbook-post'
import { feedRouter } from './routes/anonbook-feed'
require('dotenv').config()

const app = express()

app.use(express.json())

app.get<{}, any>('/', (req, res) => {
    res.json({
        message: 'Welcome to Anonbook API!',
    })
})
app.use('*', (req, res, next) => {
    res.set('access-control-allow-origin', '*')
    res.set('access-control-allow-headers', '*')
    next()
})

// Anonbook Karma Bridge routes
const db = createDb(config.dbPath)
app.use('/api', signupRouter(db))
app.use('/api', attestRouter(db))
app.use('/api', postRouter(db))
app.use('/api', feedRouter(db))

// Dev-only routes (epoch advancement for testing)
if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { devRouter } = require('./routes/dev')
    app.use('/api', devRouter())
}

export default app
