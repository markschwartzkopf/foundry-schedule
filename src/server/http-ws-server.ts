import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';
import { blLog, errorData } from './logger';
import { Week, clientMessage, serverMessage } from '../global-types';
import {
	getDefaultWeek,
	getEmployees,
	getPositions,
	getWeeks,
	setDefaultWeek,
	setEmployees,
	setPositions,
	setWeeks,
} from './data';

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
	'.zip': 'application/zip',
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

			connections.push(ws);
			console.log(
				`WebSocket connection opened. Total connections: ${connections.length}`
			);

			ws.on('error', console.error);

			ws.on('message', (data) => {
				try {
					const obj = JSON.parse(data.toString(), dateReviver);
					if (typeof obj === 'object' && obj.error) {
						const err = obj.error as string;
						const data = obj.data as errorData | undefined;
						blLog.browserError(err, data);
					} else {
						const msg = obj as clientMessage;
						switch (msg.type) {
							case 'changeShift':
								{
									const week =
										msg.weekIndex >= 0
											? getWeeks()[msg.weekIndex]
											: getDefaultWeek();
									if (!week) {
										blLog.error('Shift adjustment failed: week not found');
										return;
									}
									week[msg.dayIndex].shifts[msg.shiftIndex] = msg.shift;
									setWeeks();
									setDefaultWeek();
									const sMsg: serverMessage =
										msg.weekIndex >= 0
											? { weeks: getWeeks() }
											: { defaultWeek: getDefaultWeek() };
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							case 'deleteShift':
								{
									const week =
										msg.weekIndex >= 0
											? getWeeks()[msg.weekIndex]
											: getDefaultWeek();
									if (!week) {
										blLog.error('Shift deletion failed: week not found');
										return;
									}
									week[msg.dayIndex].shifts.splice(msg.shiftIndex, 1);
									setWeeks();
									setDefaultWeek();
									const sMsg: serverMessage =
										msg.weekIndex >= 0
											? { weeks: getWeeks() }
											: { defaultWeek: getDefaultWeek() };
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							case 'newWeek':
								{
									const weeks = getWeeks();
									const firstDay = weeks[weeks.length - 1][6].date;
									const newWeek = getDefaultWeek().map((day, index) => {
										const date = new Date(firstDay);
										date.setUTCDate(date.getDate() + index + 1);
										return { date, shifts: deepCopy(day.shifts) };
									}) as Week;
									weeks.push(newWeek);
									setWeeks();
									const sMsg: serverMessage = { weeks };
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							case 'changeEmployee':
								{
									const employees = getEmployees();
									employees[msg.employeeIndex] = msg.employee;
									setEmployees();
									const sMsg: serverMessage = { employees };
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							case 'deleteEmployee':
								{
									const employees = getEmployees();
									employees.splice(msg.employeeIndex, 1);
									setEmployees();
									const sMsg: serverMessage = { employees };
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							case 'uploadBackup':
								{
									setEmployees(msg.employees);
									setDefaultWeek(msg.defaultWeek);
									setWeeks(msg.weeks);
									setPositions(msg.positions);
									const sMsg: serverMessage = {
										employees: getEmployees(),
										positions: getPositions(),
										defaultWeek: getDefaultWeek(),
										weeks: getWeeks(),
									};
									connections.forEach((conn) => {
										conn.send(JSON.stringify(sMsg));
									});
								}
								break;
							default:
								// @ts-ignore
								console.log('Unknown message type: ' + msg.type);
								console.log('received: ' + data.toString());
								break;
						}
					}
				} catch (err) {
					console.log('received: ' + data.toString());
				}
			});

			ws.on('close', () => {
				//keyChange.off('change', socketKeysub);
				console.log('WebSocket connection closed');
				const index = connections.indexOf(ws);
				if (index === -1) {
					blLog.error(`Closed WebSocket missing from WebSocket array`);
					return;
				}
				connections.splice(index, 1);
			});
		});
	});

function dateReviver(key: string, value: any) {
	const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
	if (typeof value === 'string' && dateFormat.test(value)) {
		return new Date(value);
	}
	return value;
}

function deepCopy<T>(obj: T): T {
	if (obj instanceof Date) {
		return new Date(obj.getTime()) as T;
	}
	if (typeof obj === 'object' && obj !== null) {
		const copy: any = Array.isArray(obj) ? [] : {};
		Object.entries(obj).forEach(([key, value]) => {
			copy[key] = deepCopy(value);
		});
		return copy as T;
	}
	return obj;
}
