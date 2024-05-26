import { errorData } from '../global-types';
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONValue = string | number | boolean | JSONObject | JSONArray;

type BinaryProtocolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

let keys: string[] = [];

const WS_PORT = 9098;
const server_address =
	new URL('http://' + window.location.host).hostname + ':' + WS_PORT;

const textDecoder = new TextDecoder();
const ws = new WebSocket('ws://' + server_address);
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
	console.log(`Connection to ${server_address} open`);
	//getState();
};

ws.onerror = (err) => {
	blError('WebSocket error', { error: JSON.stringify(err) });
};

ws.onmessage = (msg) => {
	if (typeof msg.data !== 'string') {
		decodeBinary({ data: msg.data })
			.then((data) => {
				console.log('Decoded data:');
				console.log(JSON.stringify(data));
			})
			.catch((err) => {
				blError('Error decoding binary data', { error: JSON.stringify(err) });
			});
	}
};

function decodeBinary(
	m: { data: ArrayBuffer },
	type?: BinaryProtocolType
): Promise<JSONValue> {
	//data ArrayBuffer is not passed directly, so that data can be mutated within the m object
	return new Promise((res, rej) => {
		if (!type) {
			const uint8Array = new Uint8Array(m.data);
			type = uint8Array[0] as BinaryProtocolType;
			m.data = m.data.slice(1);
		}
		switch (type) {
			case 1: {
				const dataView = new DataView(m.data);
				const bool = dataView.getUint8(0) === 1;
				m.data = m.data.slice(1);
				res(bool);
				break;
			}
			case 2: {
				const dataView = new DataView(m.data);
				const int = dataView.getInt16(0);
				m.data = m.data.slice(2);
				res(int);
				break;
			}
			case 3: {
				const dataView = new DataView(m.data);
				const longInt = dataView.getInt32(0);
				m.data = m.data.slice(4);
				res(longInt);
				break;
			}
			case 4: {
				const dataView = new DataView(m.data);
				const float = dataView.getFloat32(0);
				m.data = m.data.slice(4);
				res(float);
				break;
			}
			case 5: {
				const dataView = new DataView(m.data);
				const length = dataView.getUint16(0);
				m.data = m.data.slice(2);
				const text = textDecoder.decode(m.data.slice(0, length));
				m.data = m.data.slice(length);
				res(text);
				break;
			}
			case 6: {
				const arr: JSONValue[] = [];
				const uint8Array = new Uint8Array(m.data);
				const type = uint8Array[0] as BinaryProtocolType | 8;
				m.data = m.data.slice(1);
				let traverse = 0;
				if (type === 8) {
					m.data = m.data.slice(1); //remove traversal byte
					return arr;
				}
				(async () => {
					while (!traverse) {
						try {
							arr.push(await decodeBinary(m, type));
							const uint8Array = new Uint8Array(m.data);
							traverse = uint8Array[0];
							m.data = m.data.slice(1);
						} catch (err) {
							rej(err);
							return;
						}
					}
					res(arr);
				})();
				break;
			}
			case 7: {
				const obj: JSONObject = {};
				let travserse = 0;
				(async () => {
					while (!travserse) {
						const dataView = new DataView(m.data);
						const keyNumber = dataView.getUint16(0);
						m.data = m.data.slice(2);
						if (keyNumber === 0) {
							m.data = m.data.slice(1);
							res(obj);
							return;
						}
						let key = 'ERROR';
						if (keys[keyNumber]) {
							key = keys[keyNumber];
						} else {
							try {
								await getKeys();
							} catch (err) {
								rej(err);
								return;
							}
						}
						if (keys[keyNumber]) {
							key = keys[keyNumber];
						} else {
							rej('Key not found');
							return;
						}
						try {
							const value = await decodeBinary(m);
							obj[key] = value;
							const uint8Array = new Uint8Array(m.data);
							travserse = uint8Array[0];
							m.data = m.data.slice(1);
						} catch (err) {
							rej(err);
							return;
						}
					}
					res(obj);
				})();
				break;
			}
			default: {
				rej(`Bad binary type: ${type}`);
			}
		}
	});
}

function getKeys(): Promise<void> {
	return new Promise((res, rej) => {
		let fullfilled = false;
		const keyListener = (msg: MessageEvent) => {
			if (typeof msg.data !== 'string') return;
			try {
				const data = JSON.parse(msg.data);
				if (Array.isArray(data)) {
					ws.removeEventListener('message', keyListener);
					fullfilled = true;
					keys = data;
					res();
				}
			} catch {
				//do nothing
			}
		};
		setTimeout(() => {
			if (!fullfilled) {
				ws.removeEventListener('message', keyListener);
				rej('Server did not respond with keys');
			}
		}, 2000);
		ws.addEventListener('message', keyListener);
		ws.send('getKeys');
	});
}

function blError(description: string, data?: errorData) {
	console.error(`Browser Lightboard Error: "${description}"`);
	if (data)
		console.error(`Browser Lightboard Error data: "${JSON.stringify(data)}"`);
	if (ws.OPEN) ws.send(JSON.stringify({ error: description, data: data }));
}

const dmxModal = document.getElementById('dmx-modal') as HTMLDivElement;
const dmxGrid = document.getElementById('dmx-grid') as HTMLDivElement;

const resizeObserver = new ResizeObserver((entries) => {
	for (const entry of entries) {
		if (entry.target === dmxGrid)
			if (!dmxModal.classList.contains('hidden')) getDmxUnitLength();
	}
});

resizeObserver.observe(dmxGrid);

function getDmxUnitLength() {
	const marginConst = 0.9;
	const width = dmxGrid.offsetWidth * marginConst;
	const height = dmxGrid.offsetHeight * marginConst;
	const utopianUnitLength = Math.sqrt((width * height) / 512);
	const actualUnitLength =
		width / (Math.ceil(width / utopianUnitLength) + 1) - 1;
	document.documentElement.style.setProperty(
		'--dmx-unit-length',
		`${actualUnitLength}px`
	);
}

(document.getElementById('dmx-fixtures-button') as HTMLDivElement).onclick =
	() => {
		dmxModal.classList.remove('hidden');
		getDmxUnitLength();
		const dmxFlex = document.getElementById('dmx-flex') as HTMLDivElement;
		for (let i = 1; i <= 512; i++) {
			const dmxAddress = document.createElement('div');
			dmxAddress.classList.add('dmx-address');
			dmxAddress.innerText = i.toString();
			dmxAddress.style.width = `var(--dmx-unit-length)`;
			dmxAddress.style.height = `var(--dmx-unit-length)`;
			dmxFlex.appendChild(dmxAddress);
		}
	};
