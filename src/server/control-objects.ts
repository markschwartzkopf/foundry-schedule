import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import { blLog } from './logger';

interface ObjectEvents {
	change: () => void;
}

interface ControlObjectEmitter {
	on<U extends keyof ObjectEvents>(event: U, listener: ObjectEvents[U]): this;
	once<U extends keyof ObjectEvents>(event: U, listener: ObjectEvents[U]): this;
	off<U extends keyof ObjectEvents>(event: U, listener: ObjectEvents[U]): this;
	emit<U extends keyof ObjectEvents>(
		event: U,
		...args: Parameters<ObjectEvents[U]>
	): boolean;
}

class ControlObject extends EventEmitter implements ControlObjectEmitter {
	label = '';
	readonly id: string;

	constructor(id?: string) {
		super();
		if (id) {
			this.id = id;
		} else this.id = uuidv4();
	}
}

export class Fixture extends ControlObject {
	address: number = 0;
	channels: number = 1;

	constructor(address?: number, channels?: number, id?: string) {
		super(id);		
		if (!Number.isInteger(address) || !Number.isInteger(channels)) {
			blLog.error('Non integer address or channel count for Fixure', {
				constructorArguments: [...arguments],
			});
		} else if (address! < 1 || address! + (channels! - 1) > 512) { //I guess Typescript doesn't know that if address and channel are integers, they must be defined
			blLog.error('Address(s) out of range for Fixure', {
				constructorArguments: [...arguments],
			});
		} else {
			this.address = address!;
			this.channels = channels!;
		}

	}
}

export class Group extends ControlObject {
	members: ControlObject[];

	constructor(members: ControlObject[], id?: string) {
		super(id);
		this.members = members;
	}
}