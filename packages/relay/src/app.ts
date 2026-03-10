import express from 'express'
import { createDb } from './db'
import { config } from './config'

// Scaffold routes (kept for backwards compatibility)
import appconfig from './routes/appconfig'
import scaffoldSignup from './routes/signup'
import scaffoldRequest from './routes/request'
import transition from './routes/transition'

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

// Scaffold routes
app.use('/', appconfig)
app.use('/', scaffoldSignup)
app.use('/', scaffoldRequest)
app.use('/', transition)

// Anonbook Karma Bridge routes
const db = createDb(config.dbPath)
app.use('/api', signupRouter(db))
app.use('/api', attestRouter(db))
app.use('/api', postRouter(db))
app.use('/api', feedRouter(db))

export default app
