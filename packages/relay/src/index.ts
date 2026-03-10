import app from './app'
import { config } from './config'

app.listen(config.port, () => {
    /* eslint-disable no-console */
    console.log(`Listening: http://127.0.0.1:${config.port}`)
    /* eslint-enable no-console */
})
