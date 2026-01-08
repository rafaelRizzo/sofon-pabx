import { build } from './app'

async function start() {
    const fastify = await build()

    try {
        await fastify.listen({ port: 3333, host: '0.0.0.0' })
        console.log(`Server listening on http://0.0.0.0:3333`)
        console.log(`Logs production can be found at /logs/app.log and /logs/error.log`)
        console.log(`Logs in dev can be found in your console.`)
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()