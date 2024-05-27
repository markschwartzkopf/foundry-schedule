import fs from 'fs';
import { DefaultWeek, Employee, Week } from '../global-types';
import { blLog } from './logger';

//starter data that will be overwritten from stored data if it exists
let employees: Employee[] = [
	{ name: 'Employee 1', positions: ['Register'], conditions: [] },
	{ name: 'Employee 2', positions: ['Register'], conditions: [] },
];
let defaultWeek: DefaultWeek = [
	newDefaultDay(),
	newDefaultDay(),
	newDefaultDay(),
	newDefaultDay(),
	newDefaultDay(),
	newDefaultDay(),
	newDefaultDay(),
];
let positions: string[] = ['Register', 'Espresso'];
let weeks: Week[];
{
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const day = today.getDay();
	//change day to a Monday; if today is Sunday, subtract 6 days, otherwise add 1 day
	const diff = today.getDate() - day + (day == 0 ? -6 : 1) + 7;
	const firstDayOfNextWeek = new Date(today.setDate(diff));
	weeks = [newWeek(firstDayOfNextWeek)];
}

function newDefaultDay() {
	return { shifts: [newShift('Register'), newShift('Espresso')] };
}

function newShift(position?: string) {
	if (!position) position = 'Espresso';
	const start = new Date(0);
	const end = new Date(0);
	start.setUTCHours(6, 30, 0, 0);
	end.setUTCHours(13, 30, 0, 0);
	return { position: position, employee: '', start: start, end: end };
}

function newWeek(firstDay: Date) {
	const startOfDay = new Date(firstDay);
	startOfDay.setHours(0, 0, 0, 0);
	return deepCopy(defaultWeek).map((day, index) => {
		const date = new Date(startOfDay);
		date.setDate(date.getDate() + index);
		return { date, shifts: day.shifts };
	}) as Week;
}

export function initializeData() {
	//data directory
	const dataDir = './data';
	// Check if directory exists, and create it if it doesn't
	return fs.promises
		.access(dataDir)
		.catch(() => {
			return fs.promises.mkdir(dataDir, { recursive: true }).catch((err) => {
				blLog.error('Error creating data directory', err);
			});
		})
		.then(() => {
			//employees
			return fs.promises
				.readFile('./data/employees.json')
				.then((data) => {
					console.log('reading employees file');
					employees = JSON.parse(data.toString());
				})
				.catch(async () => {
					console.error('creating employees file');
					fs.promises.writeFile(
						dataDir + '/employees.json',
						JSON.stringify(employees)
					);
				});
		})
		.then(() => {
			//default week
			return fs.promises
				.readFile('./data/default-week.json')
				.then((data) => {
					console.log('reading default week file');
					defaultWeek = JSON.parse(data.toString(), dateReviver);
				})
				.catch(async () => {
					console.error('creating default week file');
					fs.promises.writeFile(
						dataDir + '/default-week.json',
						JSON.stringify(defaultWeek)
					);
				});
		})
		.then(() => {
			//positions
			return fs.promises
				.readFile('./data/positions.json')
				.then((data) => {
					console.log('reading positions file');
					positions = JSON.parse(data.toString());
				})
				.catch(async () => {
					console.error('creating positions file');
					fs.promises.writeFile(
						dataDir + '/positions.json',
						JSON.stringify(positions)
					);
				});
		})
		.then(() => {
			//weeks
			return fs.promises
				.readFile('./data/weeks.json')
				.then((data) => {
					console.log('reading weeks file');
					weeks = JSON.parse(data.toString(), dateReviver);
				})
				.catch(async () => {
					console.error('creating weeks file');
					fs.promises.writeFile(dataDir + '/weeks.json', JSON.stringify(weeks));
				});
		})
		.catch((err) => {
			blLog.error('Error initializing data:', err);
		});
}

export function getEmployees() {
	return employees;
}

export function getDefaultWeek() {
	return defaultWeek;
}

export function getPositions() {
	return positions;
}

export function getWeeks() {
	return weeks;
}

export function setEmployees(newEmployees: Employee[]) {
	employees = newEmployees;
	fs.promises.writeFile('./data/employees.json', JSON.stringify(employees));
}

export function setDefaultWeek(newDefaultWeek: DefaultWeek) {
	defaultWeek = newDefaultWeek;
	fs.promises.writeFile(
		'./data/default-week.json',
		JSON.stringify(defaultWeek)
	);
}

export function setPositions(newPositions: string[]) {
	positions = newPositions;
	fs.promises.writeFile('./data/positions.json', JSON.stringify(positions));
}

export function setWeeks(newWeeks: Week[]) {
	weeks = newWeeks;
	fs.promises.writeFile('./data/weeks.json', JSON.stringify(weeks));
}


//helper functions
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
