export type errorData =
	| { [k: string]: number | string | boolean | errorData }
	| (number | string | boolean | errorData)[];
export type serverMessage = {
	keys?: string[];
	objects?: { [k: string]: ControlObjectData };
};
export type ControlObjectData = {
	animateable?: ObjectProps;
	unanimateable?: ObjectProps;
	constantProps?: ObjectProps;
};


export type ObjectProps = {
	hue?: number;
	saturation?: number;
	value?: number;
	name: string;
	dmxAddress?: number;
	dmxChannels?: number;
};

