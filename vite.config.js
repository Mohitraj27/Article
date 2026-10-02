import { defineConfig } from 'vite'
import path from 'node:path'
import { generateUploads, projectRoot } from './scripts/uploads.js'

export default defineConfig({
	base: './',
	plugins: [{
		name: 'index-uploads',
		async buildStart() { await generateUploads() },
		configureServer(server) {
			const directory = path.join(projectRoot, 'public', 'uploads') + path.sep
			let timer
			let refreshing = Promise.resolve()
			const refresh = (event, file) => {
				if (!path.resolve(file).startsWith(directory)) return
				clearTimeout(timer)
				timer = setTimeout(() => {
					refreshing = refreshing.then(async () => {
						await generateUploads()
						server.ws.send({ type: 'full-reload' })
					}).catch(error => { server.config.logger.error(error.message) })
				}, 120)
			}
			server.watcher.add(directory)
			server.watcher.on('all', refresh)
			server.httpServer?.once('close', () => {
				clearTimeout(timer)
				server.watcher.off('all', refresh)
			})
		},
	}],
})