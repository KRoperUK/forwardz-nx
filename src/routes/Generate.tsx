import { Jimp } from 'jimp';
import { Text } from 'react-tela';
import { NACP } from '@tootallnate/nacp';
import { NcmStorageId } from '@nx.js/ncm';
import { installNsp } from '@nx.js/install-title';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { prodKeys } from '../prod-keys';
import type { Module } from '../hacbrewpack';
import type { AppInfo } from '../apps';
import { nextQueuedIndex, withBatchResult, type BatchContext } from '../batch';

type Status = 'generating' | 'installing' | 'error' | 'success';

export interface GenerateState extends AppInfo {
	romPath: string;
	profileSelector: boolean;
	install: boolean;
	/** Present when this item is one step of a batch run. */
	batch?: BatchContext;
}

export function Generate() {
	const navigate = useNavigate();
	const {
		id,
		icon,
		path,
		romPath,
		name,
		author,
		version,
		profileSelector,
		install,
		batch,
	}: GenerateState = useLocation().state;
	const [status, setStatus] = useState<Status>('generating');
	const [error, setError] = useState<string | null>(null);
	const [logs, setLogs] = useState('');

	useEffect(() => {
		async function g() {
			const start = Date.now();

			// Advance a batch run: record this item's outcome, then move to
			// the next queued item or land on the summary screen. One failed
			// item never aborts the remaining batch.
			const advanceBatch = (ok: boolean, message?: string) => {
				if (!batch) return;
				const updated = withBatchResult(batch.items, batch.index, ok, message);
				const next = nextQueuedIndex(updated, batch.index);
				if (next === -1) {
					navigate('/batch', { state: { items: updated, finished: true } });
					return;
				}
				const app = updated[next].app;
				navigate('/generate', {
					state: {
						id: app.forwarderId ?? '',
						icon: app.icon,
						path: app.path,
						romPath: '',
						name: app.name,
						author: app.author,
						version: app.version,
						profileSelector: false,
						install,
						batch: { items: updated, index: next },
					} satisfies GenerateState,
				});
			};

			const fail = (message: string) => {
				if (batch) {
					advanceBatch(false, message);
				} else {
					setStatus('error');
					setError(message);
				}
			};

			const ModuleFactory = await import('../hacbrewpack.js');
			const helloWasm = Switch.readFileSync('romfs:/hacbrewpack.wasm');
			const mainData = Switch.readFileSync('romfs:/template/exefs/main');
			const mainNpdmData = Switch.readFileSync(
				'romfs:/template/exefs/main.npdm',
			);
			if (!name) {
				fail('missing `name` field');
				return;
			}
			if (!author) {
				fail('missing `author` field');
				return;
			}
			if (!helloWasm) {
				fail('missing `hacbrewpack.wasm` file');
				return;
			}
			if (!prodKeys) {
				fail('missing `prod.keys` file');
				return;
			}
			if (!mainData) {
				fail('missing `main` file');
				return;
			}
			if (!mainNpdmData) {
				fail('missing `main.npdm` file');
				return;
			}

			const main = new Uint8Array(mainData);
			const mainNpdm = new Uint8Array(mainNpdmData);
			const keys = new Uint8Array(prodKeys);

			// Run the icon through Jimp to resize it and/or remove EXIF metadata
			let iconBuf = icon;
			if (iconBuf) {
				const logo = await Jimp.fromBuffer(iconBuf);
				logo.resize({ w: 256, h: 256 });

				// The icon size must be less than 0x20000 bytes otherwise
				// Atmosphère shows a "?" icon on the home screen, so we
				// generate the JPEG in a loop until we get a smaller icon.
				let quality = 100;
				while (true) {
					const encodedIcon = await logo.getBuffer('image/jpeg', { quality });
					iconBuf = encodedIcon;
					console.debug(
						`icon size: ${encodedIcon.byteLength} with JPEG quality ${quality}%`,
					);

					if (encodedIcon.byteLength < 0x20000) {
						// The generated icon is within the allowed size, so we're done.
						break;
					}

					// Icon is too large, so reduce the JPEG quality and try again.
					quality -= 2;
					if (quality <= 0) {
						console.debug('icon size is still too large - giving up...');
						break;
					}
					console.debug(
						`icon size is too large, reducing JPEG quality to ${quality}%`,
					);
				}
			}

			let Module: Module;
			await ModuleFactory.default({
				noInitialRun: true,
				wasmBinary: helloWasm,
				print(text) {
					console.debug(text);
					setLogs((logs) => `${logs + text}\n`);
				},
				printErr(text) {
					console.debug(text);
					setLogs((logs) => `${logs + text}\n`);
				},
				preRun(_Module) {
					Module = _Module;
					const { FS } = Module;

					FS.writeFile('/keys.dat', keys);

					FS.mkdir('/exefs');
					FS.writeFile('/exefs/main', main);
					FS.writeFile('/exefs/main.npdm', mainNpdm);

					const nacp = new NACP();
					nacp.id = id;
					nacp.title = name;
					nacp.author = author;
					nacp.version = version;

					nacp.startupUserAccount = profileSelector ? 1 : 0;

					FS.mkdir('/control');
					FS.writeFile('/control/control.nacp', new Uint8Array(nacp.buffer));

					if (iconBuf) {
						const image = new Uint8Array(iconBuf);
						FS.writeFile('/control/icon_AmericanEnglish.dat', image);
					}

					//FS.mkdir('/logo');
					//FS.writeFile('/logo/NintendoLogo.png', logo);
					//FS.writeFile('/logo/StartupMovie.gif', startupMovie);

					FS.mkdir('/romfs');
					let argv = path;
					if (romPath) {
						argv += ` "${romPath}"`;
					}
					FS.writeFile('/romfs/nextArgv', argv);
					FS.writeFile('/romfs/nextNroPath', path);
				},
				onRuntimeInitialized: () => {
					try {
						const exitCode = Module.callMain([
							'--nopatchnacplogo',
							'--titleid',
							id,
							'--nologo',
							'--plaintext',
						]);
						console.debug(`exit code: ${exitCode}`);

						if (exitCode === 0) {
							try {
								const nspName = Module.FS.readdir('/hacbrewpack_nsp').filter(
									(n) => n.endsWith('.nsp'),
								)[0];

								const data = Module.FS.readFile(`/hacbrewpack_nsp/${nspName}`);
								const duration = Date.now() - start;

								if (install) {
									// Install the generated NSP forwarder
									setStatus('installing');
									(async () => {
										for await (const event of installNsp(
											new Blob([data]),
											NcmStorageId.SdCard,
										)) {
											console.debug(event);
										}
									})()
										.then(() => {
											if (batch) {
												advanceBatch(true);
												return;
											}
											const query = new URLSearchParams({
												installed: '1',
												name,
												duration: String(duration),
											});
											navigate(`/success?${query}`);
										})
										.catch((err) => {
											fail(`Install failed: ${err}`);
										});
								} else {
									// Save the generated NSP forwarder to the SD card
									const fileName = `${name.replace(/[:/\\]/g, '-')} [${id}].nsp`;
									const outUrl = new URL(fileName, 'sdmc:/');
									Switch.writeFileSync(outUrl, data);

									if (batch) {
										advanceBatch(true);
										return;
									}
									const query = new URLSearchParams({
										name: fileName,
										duration: String(duration),
									});
									navigate(`/success?${query}`);
								}
							} catch (err) {
								fail(`Failed to locate NSP file: ${err}`);
								console.debug(`Failed to locate NSP file: ${err}`);
							}
						} else {
							fail(`exit code: ${exitCode}`);
						}
					} catch (err) {
						fail(`error: ${err}`);
						console.debug(err);
					}
				},
			});
		}
		setTimeout(g, 50);
	}, [
		navigate,
		icon,
		path,
		romPath,
		id,
		name,
		author,
		version,
		profileSelector,
		install,
		batch,
	]);

	return (
		<>
			<Text fill='white' fontSize={24}>
				{batch
					? `BATCH ${batch.index + 1} OF ${batch.items.length} — ${error || status}`
					: error || status}
			</Text>
			<Text fill='white' fontSize={24} y={32}>
				{name}
			</Text>
			{logs.split('\n').map((line, i) => (
				<Text key={line} fill='white' fontSize={24} y={64 + i * 30}>
					{line}
				</Text>
			))}
		</>
	);
}
