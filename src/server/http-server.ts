import http from 'http';
import fs from 'fs/promises';
import path from 'path';

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

const STATIC_PATH=path.join(__dirname, '../../dist/browser/')
const PORT=process.env.PORT || 9099

http
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
				console.log(`Missing file requested at ${localPath}`)
				res.writeHead(404, { 'Content-Type': 'text/html' });
				res.end('File not found', 'utf-8');
			} else {
				res.writeHead(500, { 'Content-Type': 'text/html' });
				res.end('Unknown error: ' + JSON.stringify(err), 'utf-8');
			}
		});
})
.listen(PORT, () => {
	console.log('Http server started');
});