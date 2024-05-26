import { WebSocket, WebSocketServer } from 'ws';
//import { keyChange, getKeys } from './minify';
//import { KeysMsg, ServerMsg } from '../global-types';
import { blLog, errorData } from './logger';
import { getKeys, toBinary } from './binary-translate';

const WS_PORT = 9098;

const connections: WebSocket[] = [];

const wss = new WebSocketServer({ port: WS_PORT }, () => {
	console.log(`Websocket server started`);
});

const jsonTest = 'testString  ';

// to test: objects, empty objects, naked boolean/number/string?

wss.on('connection', (ws) => {
	/* const send = (msg: ServerMsg) => {
		ws.send(JSON.stringify(msg));
	}; */

	connections.push(ws);
	ws.on('error', console.error);

	ws.on('message', (data) => {
		const msg = data.toString();
		if (msg === 'getKeys') {
			ws.send(JSON.stringify(getKeys()));
		} else {
			try {
				const obj = JSON.parse(msg);
				if (typeof obj === 'object' && obj.error) {
					const err = obj.error as string;
					const data = obj.data as errorData | undefined;
					blLog.browserError(err, data);
				} else console.log('received: ' + data.toString());
			} catch (err) {
				console.log('received: ' + data.toString());
			}
		}
	});

	ws.send(JSON.stringify(jsonTest));
	const buf = toBinary(jsonTest);
	if (buf) ws.send(buf);

	//ws.send(JSON.stringify(getKeys()));

	/* const socketKeysub = (keyMsg: KeysMsg) => { //This is a constant so it can be unsubscribed
		ws.send(JSON.stringify(keyMsg));
	};
	keyChange.on('change', socketKeysub); */

	ws.on('close', () => {
		//keyChange.off('change', socketKeysub);
		const index = connections.indexOf(ws);
		if (index === -1) {
			blLog.error(`Closed WebSocket missing from WebSocket array`);
			return;
		}
		connections.splice(index, 1);
	});
});
