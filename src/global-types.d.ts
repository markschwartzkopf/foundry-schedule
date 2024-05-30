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
export type clientMessage =
	| {
			type: 'changeShift';
			weekIndex: number;
			dayIndex: number;
			shiftIndex: number;
			shift: Shift;
	  }
	| {
			type: 'deleteShift';
			weekIndex: number;
			dayIndex: number;
			shiftIndex: number;
	  }
	| { type: 'newWeek' }
	| { type: 'changeEmployee'; employeeIndex: number; employee: Employee }
	| { type: 'deleteEmployee'; employeeIndex: number }
	| {
			type: 'uploadBackup';
			employees: Employee[];
			defaultWeek: DefaultWeek;
			positions: string[];
			weeks: Week[];
	  };
export type Employee = {
	name: string;
	positions: string[];
	conditions: Condition[];
	timeOff: TimeOff[];
	unavailable: Unavailable[];
};
export type Condition = {
	relational: '>' | '<' | '=';
	value: number;
	type: 'number' | 'percent';
	position: string; //position name or empty for general shifts
};
export type TimeOff = {
	start: Date;
	end: Date;
	reason: string;
};
export type Unavailable = {
	day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	start: Date;
	end: Date;
	reason: string;
};
export type Week = [Day, Day, Day, Day, Day, Day, Day];
export type Day = {
	date: Date;
	shifts: Shift[];
};
export type Shift = {
	position: string;
	employee: string;
	start: Date;
	end: Date;
};
export type DefaultWeek = [
	DefaultDay,
	DefaultDay,
	DefaultDay,
	DefaultDay,
	DefaultDay,
	DefaultDay,
	DefaultDay
];
export type DefaultDay = {
	shifts: Shift[];
};

/* 
needed files:
employees
default week
positions
weeks

*/
