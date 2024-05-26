import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { blLog, errorData } from './logger';
import { serverMessage } from '../global-types';
import { getDefaultWeek, getEmployees, getPositions, getWeeks } from './data';

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

		console.log('Starting ws server attached to http server');
		const wss = new WebSocket.Server({ server: httpServer });

		wss.on('connection', (ws) => {
			const msg: serverMessage = {
				employees: getEmployees(),
				positions: getPositions(),
				defaultWeek: getDefaultWeek(),
				weeks: getWeeks(),
			};
			ws.send(JSON.stringify(msg));

			console.log('WebSocket connection opened');

			connections.push(ws);
			ws.on('error', console.error);

			ws.on('message', (data) => {
				const msg = data.toString();
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
			});

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
