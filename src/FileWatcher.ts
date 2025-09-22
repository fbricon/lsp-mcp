import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type ParcelWatcher from "@parcel/watcher"
import watcher, { type Event } from "@parcel/watcher"
import type { Logger } from "vscode-jsonrpc"
import { pathToFileUri } from "./lsp-methods"

async function readGitIgnore(
	logger: Logger,
	workspaceRoot: string,
): Promise<string[]> {
	try {
		const contents = await readFile(join(workspaceRoot, ".gitignore"), "utf-8")
		return contents
			.split("\n")
			.filter(
				line =>
					line.trim() !== "" && !line.startsWith("#") && !line.startsWith("!"), // Negated patterns don't work.
			)
			.flatMap(pattern => {
				// Remove leading slash if present
				if (pattern.startsWith("/")) {
					pattern = pattern.slice(1)
				}

				// Convert gitignore patterns to glob patterns for @parcel/watcher
				if (pattern.endsWith("/")) {
					// Directory pattern: "target/" -> ["target/**", "**/target/**"]
					// This matches both root-level and nested directories
					const dirName = pattern.slice(0, -1) // Remove trailing slash
					return [`${dirName}/**`, `**/${dirName}/**`]
				} else if (pattern.includes("*")) {
					// Already a glob pattern, keep as is
					return pattern
				} else {
					// File or directory name: "META-INF" -> "META-INF" and "**/META-INF/**"
					return [pattern, `**/${pattern}/**`]
				}
			}) // Flatten the array since some patterns return arrays
	} catch (e: unknown) {
		if (e instanceof Error) {
			logger.error(e.stack || e.toString?.())
		}
		return []
	}
}
export class FileWatcher {
	private watcher: ParcelWatcher.AsyncSubscription | undefined
	private events: Event[]
	private resolveNext: (() => void) | undefined = undefined
	private cancelled: boolean = false
	private poll: Promise<void> | undefined = undefined
	constructor(
		private readonly extensions: string[],
		private readonly root: string,
		private readonly logger: Logger,
		private readonly onFileChanged: (uri: string) => Promise<void>,
		private readonly onFileRemoved: (uri: string) => Promise<void>,
		private readonly onFileCreated: (uri: string) => Promise<void>,
	) {
		this.events = []
	}
	queueEvents(events: Event[]) {
		for (const fs_event of events) {
			// If no extensions are provided, we want to queue all events, else we only queue events for the given extensions
			if (
				this.extensions.length > 0 &&
				!this.extensions.some(ext => fs_event.path.endsWith(ext))
			) {
				continue
			}
			this.logger.info(`Event: ${fs_event.type} ${fs_event.path}`)
			this.events.push(fs_event)
		}
		if (this.resolveNext !== undefined) {
			this.resolveNext()
			this.resolveNext = undefined
		}
	}
	async pollEvents() {
		while (this.cancelled === false) {
			if (this.events.length > 0) {
				const events = this.events
				this.events = []
				await Promise.all(
					events.map(async ({ type, path }) => {
						const uri = pathToFileUri(path)
						switch (type) {
							case "update":
								this.logger.info(
									`FileWatcher: Received update event for ${path}`,
								)
								if (!events.some(e => e.type === "create" && e.path === path)) {
									await this.onFileChanged(uri)
								}
								break
							case "create":
								this.logger.info(
									`FileWatcher: Received create event for ${path}`,
								)
								await this.onFileCreated(uri)
								break
							case "delete":
								this.logger.info(
									`FileWatcher: Received delete event for ${path}`,
								)
								await this.onFileRemoved(uri)
								break
						}
					}),
				)
			}
			const { promise, resolve, reject: _ } = Promise.withResolvers<void>()
			this.resolveNext = resolve
			await promise
			// In CI, the watcher may register a create as a create and change. This gives us a little bit of room to catch these cases.
			await new Promise(resolve => setTimeout(resolve, 100))
		}
	}
	async start() {
		this.logger.info(`Reading gitignore from ${this.root}`)
		const gitignore = await readGitIgnore(this.logger, this.root)
		const ignored = ["**/.git/**", ...gitignore]
		this.logger.info(
			`Starting file watcher for ${JSON.stringify(this.root)} with extensions ${JSON.stringify(this.extensions)}`,
		)
		this.logger.info(`gitignore: ${JSON.stringify(gitignore, null, 2)}`)
		this.watcher = await watcher.subscribe(
			this.root,
			(err, events: Event[]) => {
				if (err !== null) {
					this.logger.error(`Watcher error: ${err}`)
				}
				this.logger.info(
					`FileWatcher: Received events: ${JSON.stringify(events, null, 2)}`,
				)
				this.queueEvents(events)
			},
			{
				ignore: ignored,
			},
		)
		this.logger.info("Started file watcher")
		this.poll = this.pollEvents()
	}
	async dispose() {
		this.cancelled = true
		if (this.resolveNext !== undefined) {
			this.resolveNext()
		}
		if (this.poll !== undefined) {
			await this.poll
		}
		await this.watcher?.unsubscribe()
	}
}
