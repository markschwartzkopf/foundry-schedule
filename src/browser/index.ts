import {
	Day,
	DefaultDay,
	DefaultWeek,
	Employee,
	Shift,
	Week,
	errorData,
	serverMessage,
} from '../global-types';

const dayOfWeekNames = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
];

const viewElements = {
	week: [
		document.getElementById('view-week-dec') as HTMLDivElement,
		document.getElementById('view-week') as HTMLDivElement,
		document.getElementById('view-week-inc') as HTMLDivElement,
	],
	defaultWeek: [document.getElementById('view-default-week') as HTMLDivElement],
	positions: [document.getElementById('view-positions') as HTMLDivElement],
};
viewElements.week[0].onclick = () => {
	console.log('dec');
};
viewElements.week[1].onclick = () => {
	if (view === 'week') return;
	newView('week');
	if (weekIndex < 0) weekIndex = weeks.length - 1;
	populateWeeks();
};
viewElements.week[2].onclick = () => {
	console.log('inc');
};
viewElements.defaultWeek[0].onclick = () => {
	if (view === 'defaultWeek') return;
	newView('defaultWeek');
	weekIndex = -1;
	populateWeeks();
};

const footerDiv = document.getElementById('footer') as HTMLDivElement;

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
type Selected =
	| { type: 'employee'; element: HTMLElement; employee: Employee }
	| {
			type: 'shift';
			element: HTMLElement;
			weekIndex: number;
			dayIndex: number;
			shiftIndex: number;
			shift: Shift;
	  };
let selected: Selected | null = null;
let weeksReceived = false;
let view: 'week' | 'defaultWeek' = 'week';

const server_address = location.origin.replace(/^http/, 'ws');

const ws = new WebSocket(server_address);
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
	console.log(`Connection to ${server_address} open`);
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
				if (!weeksReceived) {
					weeksReceived = true;
					weekIndex = weeks.length - 1;
				}
			}
			if (parsedData.defaultWeek) {
				defaultWeek = parsedData.defaultWeek;
			}
			if (parsedData.weeks || parsedData.defaultWeek) {
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
		employeeDiv.onclick = () => {
			if (employeeDiv.classList.contains('selected')) {
				unSelect();
			} else {
				select({
					type: 'employee',
					element: employeeDiv,
					employee: employee,
				});
			}
		};
		employeesDiv.appendChild(employeeDiv);
	});
	const unnassignedDiv = document.createElement('div');
	unnassignedDiv.className = 'employee-div';
	unnassignedDiv.innerHTML = 'Unassigned';
	unnassignedDiv.classList.add('unassigned');
	unnassignedDiv.onclick = () => {
		if (unnassignedDiv.classList.contains('selected')) {
			unSelect();
		} else {
			select({
				type: 'employee',
				element: unnassignedDiv,
				employee: { name: '', positions: [], conditions: [] },
			});
		}
	};
	employeesDiv.appendChild(unnassignedDiv);
	const addEmployeeDiv = document.createElement('div');
	addEmployeeDiv.className = 'employee-div';
	addEmployeeDiv.classList.add('add-employee');
	addEmployeeDiv.innerHTML = 'Add Employee';
	employeesDiv.appendChild(addEmployeeDiv);
}

function populateWeeks() {
	let lastRowShiftIndex = 0;
	//type assertions needed here because TypeScript struggles with tuples. At least ver 5.4.5 does. Possibly motivation to change weeks to arrays instead of tuples of size 7?
	const week = (
		weekIndex > -1 && weeks[weekIndex] ? weeks[weekIndex] : defaultWeek
	) as Week | DefaultWeek;
	const weekDiv = document.getElementById('week-div') as HTMLDivElement;
	weekDiv.innerHTML = '';
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
				weekDiv.style.gridTemplateRows =
					'auto '.repeat(lastRowShiftIndex + 1) + '1fr';
			}
			const shiftDiv = document.createElement('div');
			shiftDiv.className = 'shift';
			const shiftDescription = document.createElement('div');
			shiftDescription.className = 'shift-description';
			shiftDescription.innerHTML = `${shift.position}: ${getUTCTime(
				shift.start
			)} - ${getUTCTime(shift.end)}`;
			shiftDiv.appendChild(shiftDescription);
			const shiftEmployee = document.createElement('div');
			shiftEmployee.className = 'shift-employee';
			shiftEmployee.innerHTML = shift.employee ? shift.employee : '&nbsp;';
			shiftDiv.appendChild(shiftEmployee);
			shiftDiv.style.gridColumn = `${dayIndex + 1}`;
			shiftDiv.style.gridRow = `${2 + shiftIndex}`;
			shiftDiv.onclick = () => {
				if (shiftDiv.classList.contains('selected')) {
					unSelect();
				} else {
					select({
						type: 'shift',
						element: shiftDiv,
						weekIndex,
						dayIndex,
						shiftIndex,
						shift,
					});
				}
			};
			weekDiv.appendChild(shiftDiv);
		});
		const addShiftParent = document.createElement('div');
		weekDiv.appendChild(addShiftParent);
	});
}

function select(selectInfo: Selected) {
	if (selected) selected.element.classList.remove('selected');
	footerDiv.innerHTML = '';
	selected = selectInfo;
	selected.element.classList.add('selected');
	switch (selected.type) {
		case 'employee':
			{
				const statusSpan = document.createElement('span');
				statusSpan.className = 'status';
				statusSpan.innerHTML = `Selected Employee: ${selected.employee.name ? selected.employee.name : 'Unassigned'}`;
				footerDiv.appendChild(statusSpan);
			}
			break;
		case 'shift':
			{
				const statusSpan = document.createElement('span');
				statusSpan.className = 'status';
				statusSpan.innerHTML = `Selected Shift: ${
					dayOfWeekNames[selected.dayIndex]
				}, ${getUTCTime(selected.shift.start)} - ${getUTCTime(
					selected.shift.end
				)}, ${selected.shift.position}`;
				footerDiv.appendChild(statusSpan);
			}
			break;
	}
}

function newView(newView: typeof view) {
	viewElements[view].forEach((element) => {
		element.classList.remove('selected');
	});
	view = newView;
	viewElements[view].forEach((element) => {
		element.classList.add('selected');
	});
}

function unSelect() {
	footerDiv.innerHTML = '';
	if (!selected) return;
	selected.element.classList.remove('selected');
	selected = null;
}

function getUTCTime(date: Date) {
	return `${date.getUTCHours() % 12}:${date.getUTCMinutes()}${
		date.getUTCHours() > 12 ? 'pm' : 'am'
	}`;
}
