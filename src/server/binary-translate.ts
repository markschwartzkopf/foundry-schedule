import { blLog } from './logger';

type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONValue = string | number | boolean | JSONObject | JSONArray;

type BinaryType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const keys: string[] = [''];

export function getKeys(): string[] {
	return [...keys];
}

export function toBinary(
	data: JSONValue,
	parentArrayDataType?: BinaryType
): Buffer | null {
	let typeByte: BinaryType;
	switch (typeof data) {
		case 'boolean': {
			typeByte = 1;
			break;
		}
		case 'number': {
			if (Number.isInteger(data)) {
				typeByte = Math.abs(data) < 32766 ? 2 : 3;
			} else {
				typeByte = 4;
			}
			break;
		}
		case 'string': {
			typeByte = 5;
			break;
		}
		case 'object': {
			if (Array.isArray(data)) {
				typeByte = 6;
			} else typeByte = 7;
			break;
		}
		default: {
			blLog.error('Bad data type for binary conversion', { data: data });
			return null;
		}
	}
	if (parentArrayDataType && parentArrayDataType !== typeByte) {
		blLog.error('Data type does not match array data type', {
			arrayType: parentArrayDataType,
			dataType: typeByte,
			data: data,
		});
		return null;
	}
	//console.log(`Prepping: Type: ${typeByte}, Data: ${JSON.stringify(data)}`);
	let dataBuf: Buffer;
	switch (typeByte) {
		case 1: {
			dataBuf = Buffer.from([data ? 1 : 0]);
			break;
		}
		case 2: {
			dataBuf = Buffer.alloc(2);
			dataBuf.writeInt16BE(data as number);
			break;
		}
		case 3: {
			dataBuf = Buffer.alloc(4);
			dataBuf.writeInt32BE(data as number);
			break;
		}
		case 4: {
			dataBuf = Buffer.alloc(4);
			dataBuf.writeFloatBE(data as number);
			break;
		}
		case 5: {
			const stringBuf = Buffer.from(data as string);
			dataBuf = Buffer.concat([Buffer.alloc(2), stringBuf]);
			dataBuf.writeUInt16BE(stringBuf.length);
			break;
		}
		case 6: {
			const dataArray = data as JSONArray;
			const bufArray: Buffer[] = [];
			let arrayDataType: number;
			for (let i = 0; i < dataArray.length; i++) {
				const firstElement = i === 0;
				const lastElement = i === dataArray.length - 1;
				const buf = toBinary(
					dataArray[i],
					firstElement ? undefined : (arrayDataType! as BinaryType)
				);
				if (buf === null) {
					blLog.error('Bad data in array', { data: data });
					return null;
				}
				if (firstElement) arrayDataType = buf[0];
				bufArray.push(buf);
				bufArray.push(lastElement ? Buffer.from([1]) : Buffer.from([0])); //Tree traversal data suffix byte
			}
			if (dataArray.length === 0) {
				dataBuf = Buffer.from([8, 1]); //traverse back up tree back out of array
			} else dataBuf = Buffer.concat([...bufArray]);
			break;
		}
		case 7: {
			const dataObj = data as JSONObject;
			const entries = Object.entries(dataObj);
			const bufArray: Buffer[] = [];
			for (let i = 0; i < entries.length; i++) {
				const lastElement = i === entries.length - 1;
				const key = entries[i][0];
				const value = entries[i][1];
				let keyValue = keys.indexOf(key);
				if (keyValue === -1) {
					keyValue = keys.push(key) - 1;
				}
				const keyBuf = Buffer.alloc(2);
				keyBuf.writeUInt16BE(keyValue);
				bufArray.push(keyBuf);
				const valueBuf = toBinary(value);
				if (valueBuf === null) {
					blLog.error('Bad data in object', { data: data });
					return null;
				}
				bufArray.push(valueBuf);
				bufArray.push(lastElement ? Buffer.from([1]) : Buffer.from([0])); //Tree traversal data suffix byte
			}
			if (entries.length === 0) {
				dataBuf = Buffer.from([0, 0, 1]); //key value of 0, traverse back up tree back out of object
			} else {
				dataBuf = Buffer.concat(bufArray);
			}
		}
	}
	/* console.log(
		`Parent type: ${parentArrayDataType}, Type: ${typeByte}, Data: ${JSON.stringify(
			data
		)}`
	);
	console.log(
		parentArrayDataType
			? dataBuf
			: Buffer.concat([Buffer.from([typeByte]), dataBuf])
	); */
	return parentArrayDataType
		? dataBuf
		: Buffer.concat([Buffer.from([typeByte]), dataBuf]);
}
