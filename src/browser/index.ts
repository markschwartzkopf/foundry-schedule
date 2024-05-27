import {
	Day,
	DefaultDay,
	DefaultWeek,
	Employee,
	Week,
	errorData,
	serverMessage,
} from '../global-types';

let employees: Employee[] = [];
let weeks: Week[] = [];
let weekIndex = 0;
let defaultWeek: DefaultWeek = [
	{ shifts: [] },
	{ shifts: [] },
	{ shifts: [] },
	{ shifts: [] },
	{ shifts: [] },
	{ shifts: [] },
	{ shifts: [] },
];

const server_address = location.origin.replace(/^http/, 'ws');

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
			const parsedData = JSON.parse(msg.data, dateReviver) as serverMessage;
			if (parsedData.employees) {
				employees = parsedData.employees;
				populateEmployees();
			}
			if (parsedData.weeks) {
				weeks = parsedData.weeks;
				populateWeeks();
			}
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

function populateEmployees() {
	const employeesDiv = document.getElementById(
		'employees-div'
	) as HTMLDivElement;
	employees.forEach((employee) => {
		const employeeDiv = document.createElement('div');
		employeeDiv.className = 'employee-div';
		employeeDiv.innerHTML = employee.name;
		employeesDiv.appendChild(employeeDiv);
	});
	const unnassignedDiv = document.createElement('div');
	unnassignedDiv.className = 'employee-div';
	unnassignedDiv.innerHTML = 'Unassigned';
	unnassignedDiv.classList.add('unassigned');
	employeesDiv.appendChild(unnassignedDiv);
	const addEmployeeDiv = document.createElement('div');
	addEmployeeDiv.className = 'employee-div';
	addEmployeeDiv.classList.add('add-employee');
	addEmployeeDiv.innerHTML = 'Add Employee';
	employeesDiv.appendChild(addEmployeeDiv);
}

function populateWeeks() {
	let lastRowShiftIndex = 0;
	//type assertions needed here because TypeScript sucks at tuples at least ver 5.4.5 does
	const week = (
		weekIndex > -1 && weeks[weekIndex] ? weeks[weekIndex] : defaultWeek
	) as Week | DefaultWeek;
	console.log(week);
	const weekDiv = document.getElementById('week-div') as HTMLDivElement;
	weekDiv.innerHTML = '';
	const dayOfWeekNames = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
	];
	const firstDay =
		weeks[0] && weeks[0][0].date ? weeks[0][0].date.getUTCDay() : 0;
	week.forEach((day: Day | DefaultDay, dayIndex) => {
		const dayName = dayOfWeekNames[(firstDay + dayIndex) % 7];
		const dayDiv = document.createElement('div');
		dayDiv.className = 'day-of-week';
		const dayAsDay = day as Day;
		dayDiv.innerHTML = dayAsDay.date
			? `${dayName} ${dayAsDay.date.getUTCMonth()}/${dayAsDay.date.getUTCDate()}/${dayAsDay.date
					.getUTCFullYear()
					.toString()
					.substring(2)}`
			: dayName;
		dayDiv.style.gridColumn = `${dayIndex + 1}`;
		dayDiv.style.gridRow = `${1}`;
		weekDiv.appendChild(dayDiv);
		day.shifts.forEach((shift, shiftIndex) => {
			if (shiftIndex >= lastRowShiftIndex) {
				lastRowShiftIndex = shiftIndex + 1;
				console.log('lastRowShiftIndex', lastRowShiftIndex);
				weekDiv.style.gridTemplateRows =
					'auto '.repeat(lastRowShiftIndex + 1) + '1fr';
			}
			const shiftDiv = document.createElement('div');
			shiftDiv.className = 'shift';
			const shiftDescription = document.createElement('div');
			shiftDescription.className = 'shift-description';
			shiftDescription.innerHTML = `${shift.position}: ${
				shift.start.getUTCHours() % 12
			}:${shift.start.getUTCMinutes()}${
				shift.start.getUTCHours() > 12 ? 'pm' : 'am'
			} - ${shift.end.getUTCHours() % 12}:${shift.end.getUTCMinutes()}${
				shift.end.getUTCHours() > 12 ? 'pm' : 'am'
			}`;
			shiftDiv.appendChild(shiftDescription);
			const shiftEmployee = document.createElement('div');
			shiftEmployee.className = 'shift-employee';
			shiftEmployee.innerHTML = shift.employee ? shift.employee : '&nbsp;';
			shiftDiv.appendChild(shiftEmployee);
			shiftDiv.style.gridColumn = `${dayIndex + 1}`;
			shiftDiv.style.gridRow = `${2 + shiftIndex}`;
			weekDiv.appendChild(shiftDiv);
		});
		const addShiftParent = document.createElement('div');
		weekDiv.appendChild(addShiftParent);
	});
}
