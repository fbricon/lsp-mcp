import { mkdir, rm, writeFile } from "node:fs/promises"
import path, { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { FileWatcher } from "./FileWatcher"
import { consoleLogger } from "./logger"
import { pathToFileUri } from "./lsp-methods"

describe("File Watcher tests", () => {
	let watcher: FileWatcher
	const onAdd = vi.fn<(_: string) => Promise<void>>()
	const onChange = vi.fn<(_: string) => Promise<void>>()
	const onRemove = vi.fn<(_: string) => Promise<void>>()
	const testDir = path.resolve("__test__")
	const target = join(testDir, "test.txt")
	const targetUri = pathToFileUri(target)
	beforeEach(async () => {
		try {
			await rm(testDir, { recursive: true })
		} catch (_: unknown) {
			// TODO: fix this
		}
		await mkdir(testDir, {})
		await new Promise(r => setTimeout(r, 300))
		watcher = new FileWatcher(
			[".txt"],
			testDir,
			consoleLogger,
			onChange,
			onRemove,
			onAdd,
		)
		await watcher.start()
	})
	afterEach(async () => {
		await watcher.dispose()
		await rm(testDir, { recursive: true })
		await new Promise(r => setTimeout(r, 300))
	})
	test("Add File", async () => {
		await writeFile(target, "test_Data")
		await expect.poll(() => onAdd).toHaveBeenCalledWith(targetUri)
	})
	test("Update File", async () => {
		await writeFile(target, "test_Data")
		await new Promise(r => setTimeout(r, 300))
		await writeFile(target, "new_Data")
		await expect.poll(() => onChange).toHaveBeenCalledWith(targetUri)
	})
	test("Remove File", async () => {
		await writeFile(target, "test_Data")
		await new Promise(r => setTimeout(r, 300))
		await rm(target)
		await expect.poll(() => onRemove).toHaveBeenCalledWith(targetUri)
	})
	test("Gitignore entries are ignored", async () => {
		// Create a .gitignore file that ignores .log files and node_modules directory
		const gitignorePath = join(testDir, ".gitignore")
		await writeFile(gitignorePath, "*.log\nnode_modules/\ntemp/\ntarget/")

		// Restart watcher to pick up the .gitignore file
		await watcher.dispose()
		await new Promise(r => setTimeout(r, 100))

		// Reset mock call counts
		onAdd.mockClear()
		onChange.mockClear()
		onRemove.mockClear()

		// Create directory structure before starting watcher to avoid directory creation events
		const ignoredLogFile = join(testDir, "debug.log")
		const nodeModulesDir = join(testDir, "node_modules")
		const targetClassesDir = join(testDir, "foo", "target", "classes")
		const tempDir = join(testDir, "temp")

		await mkdir(nodeModulesDir)
		await mkdir(targetClassesDir, { recursive: true })
		await mkdir(tempDir)

		// Create new watcher that should read the .gitignore
		watcher = new FileWatcher(
			[], // Include all files
			testDir,
			consoleLogger,
			onChange,
			onRemove,
			onAdd,
		)
		await watcher.start()
		await new Promise(r => setTimeout(r, 100))

		// Create files that should be ignored
		await writeFile(join(targetClassesDir, "test.class"), "should be ignored")
		await writeFile(ignoredLogFile, "log content")
		await writeFile(join(nodeModulesDir, "package.txt"), "should be ignored")
		await writeFile(join(tempDir, "temp.txt"), "should be ignored")

		// Create a file that should NOT be ignored
		const allowedFile = join(testDir, "allowed.txt")
		await writeFile(allowedFile, "should be watched")

		// Wait for file system events to be processed
		await new Promise(r => setTimeout(r, 500))

		// Verify that only the allowed file triggered events
		const allowedUri = pathToFileUri(allowedFile)
		expect(onAdd).toHaveBeenCalledWith(allowedUri)

		// The foo directory might also trigger an event, but that's okay since it's not ignored
		// What matters is that files in ignored directories (target/, node_modules/, temp/) don't trigger events
		const fooUri = pathToFileUri(join(testDir, "foo"))
		const allowedCalls = onAdd.mock.calls.filter(
			call => call[0] === allowedUri || call[0] === fooUri,
		)
		expect(allowedCalls.length).toBeGreaterThan(0) // At least the allowed file should be called

		// Verify ignored files did not trigger events
		const ignoredLogUri = pathToFileUri(ignoredLogFile)
		const nodeModulesFileUri = pathToFileUri(
			join(nodeModulesDir, "package.txt"),
		)
		const tempFileUri = pathToFileUri(join(tempDir, "temp.txt"))
		const targetClassesFileUri = pathToFileUri(
			join(targetClassesDir, "test.class"),
		)

		expect(onAdd).not.toHaveBeenCalledWith(ignoredLogUri)
		expect(onAdd).not.toHaveBeenCalledWith(nodeModulesFileUri)
		expect(onAdd).not.toHaveBeenCalledWith(tempFileUri)
		expect(onAdd).not.toHaveBeenCalledWith(targetClassesFileUri)
	})
})
