import { errorData } from '../global-types';

//const WS_PORT = 9098;
const server_address = location.origin.replace(/^http/, 'ws');
//new URL('ws://' + window.location.host).hostname + ':'// + WS_PORT;

const ws = new WebSocket(server_address);
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
	console.log(`Connection to ${server_address} open`);
	//getState();
};

ws.onerror = (err) => {
	blError('WebSocket error', { error: JSON.stringify(err) });
};

ws.onmessage = (msg) => {
	if (typeof msg.data === 'string') {
		try {
			const parsedData = JSON.parse(msg.data, dateReviver);
			console.log('Received JSON data:');
			console.log(parsedData);
			console.log(msg.data);
		} catch (error) {
			blError('Error parsing JSON data', { data: error });
		}
	} else {
		blError('Received non-string data', { data: msg.data });
	}
};

function blError(description: string, data?: errorData) {
	console.error(`Browser Lightboard Error: "${description}"`);
	if (data)
		console.error(`Browser Lightboard Error data: "${JSON.stringify(data)}"`);
	if (ws.OPEN) ws.send(JSON.stringify({ error: description, data: data }));
}

//helper function to convert JSON string dates to Date objects
function dateReviver(key: string, value: any) {
	const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
	if (typeof value === 'string' && dateFormat.test(value)) {
		return new Date(value);
	}
	return value;
}
