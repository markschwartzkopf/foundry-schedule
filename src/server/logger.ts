export type errorData = { [k: string]: number | string | boolean | errorData } | (number | string | boolean | errorData)[];
let errorNumber = 0;
function blError(description: string, data?: errorData) {
	errorNumber++;
	console.error(`Browser Lightboard Error #${errorNumber}: "${description}"`);
	if (data)
		console.error(
			`BL Error #${errorNumber} data: "${JSON.stringify(data)}"`
		);
}
function blBrowserError(description: string, data?: errorData) {
	errorNumber++;
	console.error(`Browser Lightboard Browser Error #${errorNumber}: "${description}"`);
	if (data)
		console.error(
			`BL Error #${errorNumber} data: "${JSON.stringify(data)}"`
		);
}

export const blLog = {error: blError, browserError: blBrowserError};