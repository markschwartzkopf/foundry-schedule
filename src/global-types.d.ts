export type errorData =
	| { [k: string]: number | string | boolean | errorData }
	| (number | string | boolean | errorData)[];
export type serverMessage = {
	keys?: string[];
	employees?: Employee[];
	positions?: string[];
	weeks?: Week[];
	defaultWeek?: DefaultWeek;
};
export type Employee = {
	name: string;
	positions: string[];
	conditions: Condition[];
};
export type Condition = {};
export type Week = [Day, Day, Day, Day, Day, Day, Day];
export type Day = {
	date: Date;
	shifts: Shift[];
}
export type Shift = {
	position: string;
	employee: string;
	start: Date;
	end: Date;
};
export type DefaultWeek = [DefaultDay, DefaultDay, DefaultDay, DefaultDay, DefaultDay, DefaultDay, DefaultDay];
export type DefaultDay = {
	shifts: Shift[];
}

/* 
needed files:
employees
default week
positions
weeks

*/
