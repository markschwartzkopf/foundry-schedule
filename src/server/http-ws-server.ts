import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { getKeys, toBinary } from './binary-translate';
import { blLog, errorData } from './logger';

const mimeTypes = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.wav': 'audio/wav',
	'.mp4': 'video/mp4',
	'.woff': 'application/font-woff',
	'.ttf': 'application/font-ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.otf': 'application/font-otf',
	'.wasm': 'application/wasm',
};

const STATIC_PATH = path.join(__dirname, '../../dist/browser/');
const PORT = process.env.PORT || 9099;

const httpServer = http
	.createServer((req, res) => {
		let filePath = '.' + req.url;
		/* istanbul ignore next */
		if (filePath == './') {
			filePath = './index.html';
		}
		const fileExtention = String(path.extname(filePath)).toLowerCase();
		let contentType = 'text/html';
		if (fileExtention in mimeTypes)
			contentType = mimeTypes[fileExtention as keyof typeof mimeTypes];
		const localPath = path.join(STATIC_PATH, filePath);
		fs.readFile(localPath)
			.then((buf) => {
				res.writeHead(200, { 'Content-Type': contentType });
				res.end(buf, 'utf-8');
			})
			.catch((err) => {
				if (err.code && err.code === 'ENOENT') {
					console.log(`Missing file requested at ${localPath}`);
					res.writeHead(404, { 'Content-Type': 'text/html' });
					res.end('File not found', 'utf-8');
				} else {
					res.writeHead(500, { 'Content-Type': 'text/html' });
					res.end('Unknown error: ' + JSON.stringify(err), 'utf-8');
				}
			});
	})
	.listen(PORT, () => {
		console.log(`Http server started on port ${PORT}`);

		const connections: WebSocket[] = [];
		
		console.log('starting ws server');
		const wss = new WebSocket.Server({ server: httpServer }, () => {
			console.log(`WebSocket server started on port ${PORT}`);
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
	});
