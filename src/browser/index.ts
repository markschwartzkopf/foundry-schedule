import {
	Condition,
	Day,
	DefaultDay,
	DefaultWeek,
	Employee,
	Shift,
	TimeOff,
	Week,
	clientMessage,
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
		document.getElementById('primary') as HTMLDivElement,
	],
	defaultWeek: [
		document.getElementById('view-default-week') as HTMLDivElement,
		document.getElementById('primary') as HTMLDivElement,
	],
	positions: [document.getElementById('view-positions') as HTMLDivElement],
	editEmployee: [document.getElementById('employee-edit') as HTMLDivElement],
	editShift: [document.getElementById('shift-edit') as HTMLDivElement],
};
viewElements.week[0].onclick = () => {
	if (weekIndex > 0) {
		weekIndex--;
		populateWeeks();
		populateEmployees();
	}
};
viewElements.week[1].onclick = () => {
	if (view === 'week') return;
	if (weekIndex < 0) weekIndex = weeks.length - 1;
	newView('week');
};
viewElements.week[2].onclick = () => {
	if (weekIndex < weeks.length - 1) {
		weekIndex++;
		populateWeeks();
		populateEmployees();
	} else {
		if (confirm('Create new week?')) {
			const msg: clientMessage = { type: 'newWeek' };
			sendMsg(msg);
			weekIndex++;
		}
	}
};
viewElements.defaultWeek[0].onclick = () => {
	if (view === 'defaultWeek') return;
	weekIndex = -1;
	newView('defaultWeek');
};
let view: keyof typeof viewElements = 'week';

const footerDiv = document.getElementById('footer') as HTMLDivElement;
const downloadBackup = document.getElementById(
	'download-backup'
) as HTMLDivElement;
downloadBackup.onclick = () => {
	const data = JSON.stringify({ employees, weeks, defaultWeek, positions });
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'schedule-backup.json';
	a.click();
	URL.revokeObjectURL(url);
};
const uploadBackup = document.getElementById('upload-backup') as HTMLDivElement;
uploadBackup.onclick = () => {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.onchange = () => {
		if (input.files && input.files[0]) {
			const reader = new FileReader();
			reader.onload = () => {
				const data = reader.result as string;
				try {
					const parsedData: {
						employees: Employee[];
						weeks: Week[];
						defaultWeek: DefaultWeek;
						positions: string[];
					} = JSON.parse(data, dateReviver);
					const msg: clientMessage = {
						type: 'uploadBackup',
						...parsedData,
					};
					sendMsg(msg);
				} catch (error) {
					blError('Error parsing JSON data', { data: error });
					return;
				}
			};
			reader.readAsText(input.files[0]);
		}
	};
	input.click();
};

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
let positions: string[] = [];
let selectedShift: {
	weekIndex: number;
	dayIndex: number;
	shiftIndex: number;
	shift: Shift;
} | null = null;

(document.getElementById('save-shift') as HTMLDivElement).onclick = () => {
	if (!selectedShift) return;
	const position = (
		document.getElementById('shift-position') as HTMLInputElement
	).value;
	const start = new Date(
		`1970-01-01T${
			(document.getElementById('shift-start') as HTMLInputElement).value
		}:00.000Z`
	);
	const end = new Date(
		`1970-01-01T${
			(document.getElementById('shift-end') as HTMLInputElement).value
		}:00.000Z`
	);
	const employee = (
		document.getElementById('shift-employee') as HTMLInputElement
	).value;
	const msg: clientMessage = {
		type: 'changeShift',
		...selectedShift,
		shift: { position, start, end, employee },
	};
	sendMsg(msg);
	newView(selectedShift.weekIndex >= 0 ? 'week' : 'defaultWeek');
};

(document.getElementById('save-employee') as HTMLDivElement).onclick = () => {
	if (!selected || selected.type !== 'employee') return;
	const name = (document.getElementById('employee-name') as HTMLInputElement)
		.value;
	selected.employee.name = name;
	const msg: clientMessage = {
		type: 'changeEmployee',
		employeeIndex: selected.employeeIndex,
		employee: selected.employee,
	};
	sendMsg(msg);
	newView(weekIndex >= 0 ? 'week' : 'defaultWeek');
};

type Selected =
	| {
			type: 'employee';
			element: HTMLElement | null;
			employee: Employee;
			employeeIndex: number;
	  }
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
				const employeeList = document.getElementById(
					'employee-list'
				) as HTMLDataListElement;
				employeeList.innerHTML = '';
				employees.forEach((employee) => {
					const option = document.createElement('option');
					option.value = employee.name;
					employeeList.appendChild(option);
				});
				populateEmployees();
				populateWeeks();
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
				populateEmployees();
				populateWeeks();
			}
			if (parsedData.positions) {
				positions = parsedData.positions;
				const positionsList = document.getElementById(
					'positions-list'
				) as HTMLDataListElement;
				positionsList.innerHTML = '';
				positions.forEach((position) => {
					const option = document.createElement('option');
					option.value = position;
					positionsList.appendChild(option);
				});
			}
		} catch (error) {
			blError('Error parsing JSON data', { data: error });
		}
	} else {
		blError('Received non-string data', { data: msg.data });
	}
};

function sendMsg(msg: clientMessage) {
	ws.send(JSON.stringify(msg));
}

function blError(description: string, data?: errorData) {
	console.error(`Foundry-Schedule Error: "${description}"`);
	if (data)
		console.error(`Foundry-Schedule Error data: "${JSON.stringify(data)}"`);
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
	employeesDiv.innerHTML = '';
	employees.forEach((employee, employeeIndex) => {
		const employeeEl = document.createElement('details');
		employeeEl.className = 'employee-div';
		employeeEl.style.backgroundColor = employeeColor(employeeIndex);
		if (
			selected &&
			selected.type === 'shift' &&
			!isRecommended(
				employee,
				selected.shift,
				selected.shiftIndex,
				selected.dayIndex,
				selected.weekIndex
			)
		) {
			employeeEl.classList.add('unrecommended');
		}
		employeeEl.onclick = () => {
			if (employeeEl.classList.contains('selected')) {
				unSelect();
			} else {
				if (selected && selected.type === 'shift' && selectedShift) {
					const msg: clientMessage = {
						type: 'changeShift',
						...selectedShift,
						shift: {
							...selectedShift.shift,
							employee: employee.name,
						},
					};
					sendMsg(msg);
				} else
					select({
						type: 'employee',
						element: employeeEl,
						employee: deepCopy(employee),
						employeeIndex,
					});
			}
		};
		employeeEl.ondblclick = () => {
			select({
				type: 'employee',
				element: employeeEl,
				employee: deepCopy(employee),
				employeeIndex,
			});
			newView('editEmployee');
		};
		const employeeName = document.createElement('summary');
		employeeName.onclick = (e) => {
			e.stopPropagation();
		};
		const employeeNameSpan = document.createElement('span');
		employeeNameSpan.innerHTML = employee.name;
		employeeNameSpan.onclick = (e) => {
			e.stopPropagation();
			e.preventDefault();
			employeeEl.click();
		};
		employeeName.appendChild(employeeNameSpan);
		employeeEl.appendChild(employeeName);
		if (weekIndex >= 0 && weeks[weekIndex]) {
			const week = weeks[weekIndex];
			const shifts = week.flatMap((day, dayIndex) =>
				day.shifts.map((shift, shiftIndex) => ({
					...shift,
					shiftIndex,
					dayIndex,
				}))
			);
			const employeeShifts = shifts.filter(
				(shift) => shift.employee === employee.name
			);
			const totalsObj: { [position: string]: number } = { '': 0 };
			let hasConsecutiveShifts = false;
			employeeShifts.forEach((shift) => {
				if (
					hasNeighboringShift(
						employee.name,
						shift,
						shift.shiftIndex,
						shift.dayIndex,
						weekIndex
					)
				)
					hasConsecutiveShifts = true;
				totalsObj['']++;
				const incType = (shiftType) => {
					if (shiftType in totalsObj) totalsObj[shiftType]++;
					else totalsObj[shiftType] = 1;
				};
				incType(shift.position);
				if (isAm(shift)) incType('am');
				if (isPm(shift)) incType('pm');
			});
			const totalsArr = Object.entries(totalsObj);
			totalsArr.sort((a, b) => {
				let rtn = 0;
				if (a[0] === 'am') rtn = 1;
				if (b[0] === 'am') rtn = -1;
				if (b[0] === 'pm') rtn = -1;
				if (a[0] === 'pm') rtn = 1;
				if (a[0] === '') rtn = -1;
				if (b[0] === '') rtn = 1;
				if (rtn) return rtn;
				return a[0].localeCompare(b[0]);
			});
			totalsArr.forEach(([position, total]) => {
				const positionDiv = document.createElement('div');
				positionDiv.innerHTML = `${
					position === '' ? 'Total' : position
				}: ${total}`;
				employee.conditions.forEach((condition) => {
					if (condition.position === position) {
						const relationals = {
							'>': (a, b) => a > b,
							'<': (a, b) => a < b,
							'=': (a, b) => a === b,
						};
						const totalShifts = totalsObj[''];
						const percentage = totalShifts ? (100 * total) / totalShifts : 0;
						if (
							!relationals[condition.relational](
								condition.type === 'number' ? total : percentage,
								condition.value
							)
						) {
							positionDiv.style.color = '#f00';
							employeeName.style.color = '#f00';
						}
					}
				});
				employeeEl.appendChild(positionDiv);
			});
			if (hasConsecutiveShifts) {
				const consecutiveDiv = document.createElement('div');
				consecutiveDiv.innerHTML = 'Consecutive Shifts';
				consecutiveDiv.style.color = '#f00';
				employeeName.style.color = '#f00';
				employeeEl.appendChild(consecutiveDiv);
			}
		}
		employeesDiv.appendChild(employeeEl);
	});
	const unnassignedDiv = document.createElement('div');
	unnassignedDiv.className = 'employee-div';
	unnassignedDiv.innerHTML = 'Unassigned';
	unnassignedDiv.classList.add('unassigned');
	unnassignedDiv.onclick = () => {
		if (unnassignedDiv.classList.contains('selected')) {
			unSelect();
		} else {
			if (selected && selected.type === 'shift' && selectedShift) {
				const msg: clientMessage = {
					type: 'changeShift',
					...selectedShift,
					shift: {
						...selectedShift.shift,
						employee: '',
					},
				};
				sendMsg(msg);
			} else
				select({
					type: 'employee',
					element: unnassignedDiv,
					employee: {
						name: '',
						positions: [],
						conditions: [],
						timeOff: [],
						unavailable: [],
					},
					employeeIndex: -1,
				});
		}
	};
	employeesDiv.appendChild(unnassignedDiv);
	const addEmployeeDiv = document.createElement('div');
	addEmployeeDiv.className = 'employee-div';
	addEmployeeDiv.classList.add('add-employee');
	addEmployeeDiv.innerHTML = 'Add Employee';
	addEmployeeDiv.onclick = () => {
		const newEmployee: Employee = {
			name: '',
			positions: [],
			conditions: [],
			timeOff: [],
			unavailable: [],
		};
		selected = {
			type: 'employee',
			element: null,
			employee: newEmployee,
			employeeIndex: employees.length,
		};
		populateEmployeePage();
		newView('editEmployee');
	};
	employeesDiv.appendChild(addEmployeeDiv);
}

function populateEmployeePage() {
	if (!selected || selected.type !== 'employee') {
		blError('No employee selected');
		return;
	}
	const employee = selected.employee;
	(document.getElementById('employee-name') as HTMLInputElement).value =
		employee.name;
	const populateList = (
		list: 'positions' | 'conditions' | 'unavailable' | 'timeOff'
	) => {
		const listDiv = document.getElementById(
			`employee-${list === 'timeOff' ? 'time-off' : list}-list`
		) as HTMLDivElement;
		listDiv.innerHTML = '';
		if (employee[list].length === 0) {
			listDiv.style.display = 'none';
		} else listDiv.style.display = '';

		employee[list].forEach((item, index) => {
			const itemDiv = document.createElement('div');
			itemDiv.className = 'employee-list-item';
			const stringDiv = document.createElement('div');
			switch (list) {
				case 'positions':
					{
						stringDiv.innerHTML = item;
					}
					break;
				case 'conditions':
					{
						const condition = item as Condition;
						const relational =
							condition.relational === '<'
								? 'Less than'
								: condition.relational === '='
								? 'Exactly'
								: 'More than';
						stringDiv.innerHTML = `${relational} ${condition.value}${
							condition.type === 'percent' ? '%' : ''
						} ${condition.position} shifts`;
					}
					break;
				case 'unavailable':
					{
						stringDiv.innerHTML = `${dayOfWeekNames[item.day]}: ${
							getUTCTime(item.start) === '12:00am' &&
							getUTCTime(item.end) === '11:59pm'
								? 'All Day'
								: `${getUTCTime(item.start)} - ${getUTCTime(item.end)}`
						}: ${item.reason}`;
					}
					break;
				case 'timeOff':
					{
						const timeOff = item as TimeOff;
						stringDiv.innerHTML = `${
							getUTCTime(timeOff.start) === '12:00am'
								? timeOff.start.toLocaleDateString('en-US', { timeZone: 'UTC' })
								: timeOff.start
										.toLocaleString('en-US', {
											timeZone: 'UTC',
										})
										.toLowerCase()
						} - ${
							getUTCTime(timeOff.end) === '11:59pm'
								? timeOff.end.toLocaleDateString('en-US', { timeZone: 'UTC' })
								: timeOff.end
										.toLocaleString('en-US', {
											timeZone: 'UTC',
										})
										.toLowerCase()
						}: ${item.reason}`;
					}
					break;
				default:
					console.log('default');
					break;
			}
			itemDiv.appendChild(stringDiv);
			const trashcan = trashcanSvg();
			trashcan.style.stroke = 'white';
			trashcan.style.height = '1.5em';
			trashcan.classList.add('svg-button');
			trashcan.onclick = () => {
				employee[list].splice(index, 1);
				populateList(list);
			};
			itemDiv.appendChild(trashcan);
			listDiv.appendChild(itemDiv);
		});
		switch (list) {
			case 'positions':
				{
					const input = document.getElementById(
						'new-employee-position'
					) as HTMLInputElement;
					const add = document.getElementById(
						'add-employee-position'
					) as HTMLDivElement;
					const processInput = () => {
						if (input.value && !employee.positions.includes(input.value)) {
							add.style.display = '';
						} else add.style.display = 'none';
					};
					input.onchange = processInput;
					input.onkeyup = processInput;
					add.onclick = () => {
						if (input.value && !employee.positions.includes(input.value)) {
							employee.positions.push(input.value);
							populateList('positions');
						}
					};
				}
				break;
			case 'conditions':
				{
					const relationalSelect = document.getElementById(
						'employee-condition-relational'
					) as HTMLSelectElement;
					const valueInput = document.getElementById(
						'employee-condition-value'
					) as HTMLInputElement;
					const typeSelect = document.getElementById(
						'employee-condition-value-type'
					) as HTMLSelectElement;
					const positionInput = document.getElementById(
						'employee-condition-position'
					) as HTMLSelectElement;
					const add = document.getElementById(
						'add-employee-condition'
					) as HTMLDivElement;
					positionInput.innerHTML = '';
					const positionOptions = ['Any', 'am', 'pm', ...positions];
					positionOptions.forEach((position) => {
						const option = document.createElement('option');
						option.innerHTML = position;
						option.value = position === 'Any' ? '' : position;
						positionInput.appendChild(option);
					});
					const processInput = () => {
						if (valueInput.value || +valueInput === 0) {
							add.style.display = '';
						} else add.style.display = 'none';
					};
					relationalSelect.onchange = processInput;
					valueInput.onchange = processInput;
					typeSelect.onchange = processInput;
					positionInput.onchange = processInput;
					add.onclick = () => {
						const relational = relationalSelect.value as '>' | '<' | '=';
						const value = +valueInput.value;
						const type = typeSelect.value as 'number' | 'percent';
						const position = positionInput.value;
						employee.conditions.push({ relational, value, type, position });
						populateList('conditions');
					};
				}
				break;
			case 'unavailable':
				{
					const daySelect = document.getElementById(
						'unavailable-day'
					) as HTMLSelectElement;
					const allDay = document.getElementById('all-day') as HTMLInputElement;
					const startEnd = document.getElementById(
						'unavailable-start-end'
					) as HTMLDivElement;
					const startInput = document.getElementById(
						'unavailable-start'
					) as HTMLInputElement;
					const endInput = document.getElementById(
						'unavailable-end'
					) as HTMLInputElement;
					const reasonInput = document.getElementById(
						'unavailable-reason'
					) as HTMLInputElement;
					const add = document.getElementById(
						'add-unavailable'
					) as HTMLDivElement;
					const processInput = () => {
						if (allDay.checked) {
							startEnd.style.display = 'none';
							add.style.display = '';
						} else {
							startEnd.style.display = '';
							if (startInput.value && endInput.value) {
								add.style.display = '';
							} else add.style.display = 'none';
						}
					};
					allDay.onchange = processInput;
					daySelect.onchange = processInput;
					startInput.onchange = processInput;
					endInput.onchange = processInput;
					reasonInput.onchange = processInput;
					add.onclick = () => {
						const day = parseInt(daySelect.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
						const start = allDay.checked
							? new Date(`1970-01-01T00:00:00.000Z`)
							: new Date(`1970-01-01T${startInput.value}:00.000Z`);
						const end = allDay.checked
							? new Date(`1970-01-01T23:59:59.999Z`)
							: new Date(`1970-01-01T${endInput.value}:00.000Z`);
						const reason = reasonInput.value;
						employee.unavailable.push({ day, start, end, reason });
						populateList('unavailable');
					};
				}
				break;
			case 'timeOff':
				{
					const startDateInput = document.getElementById(
						'time-off-start'
					) as HTMLInputElement;
					const endDateInput = document.getElementById(
						'time-off-end'
					) as HTMLInputElement;
					const startTimeInput = document.getElementById(
						'time-off-start-time'
					) as HTMLInputElement;
					const endTimeInput = document.getElementById(
						'time-off-end-time'
					) as HTMLInputElement;
					const reasonInput = document.getElementById(
						'time-off-reason'
					) as HTMLInputElement;
					const add = document.getElementById('add-time-off') as HTMLDivElement;
					const processInput = () => {
						const startDate = new Date(startDateInput.value);
						const endDate = new Date(endDateInput.value);
						if (
							startDateInput.value &&
							endDateInput.value &&
							startDate <= endDate
						) {
							add.style.display = '';
						} else add.style.display = 'none';
					};
					startDateInput.onchange = processInput;
					endDateInput.onchange = processInput;
					startTimeInput.onchange = processInput;
					endTimeInput.onchange = processInput;
					reasonInput.onchange = processInput;
					reasonInput.onkeyup = processInput;
					add.onclick = () => {
						const start = new Date(
							`${startDateInput.value}T${startTimeInput.value}:00.000Z`
						);
						const end = new Date(
							`${endDateInput.value}T${endTimeInput.value}:00.000Z`
						);
						const reason = reasonInput.value;
						employee.timeOff.push({ start, end, reason });
						populateList('timeOff');
					};
				}
				break;
		}
	};
	populateList('positions');
	populateList('conditions');
	populateList('unavailable');
	populateList('timeOff');
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
		if (dayAsDay.date) {
			dayAsDay.date.setUTCHours(0, 0, 0, 0);
		}
		dayDiv.innerHTML = dayAsDay.date
			? `${dayName} ${
					dayAsDay.date.getUTCMonth() + 1
			  }/${dayAsDay.date.getUTCDate()}/${dayAsDay.date
					.getUTCFullYear()
					.toString()
					.substring(2)}`
			: dayName;
		dayDiv.style.gridColumn = `${dayIndex + 1}`;
		dayDiv.style.gridRow = `${1}`;
		weekDiv.appendChild(dayDiv);
		const notesDiv = document.createElement('div');
		notesDiv.className = 'day-notes';
		employees.forEach((employee) => {
			employee.unavailable.forEach((unavailable) => {
				if ((firstDay + dayIndex) % 7 === unavailable.day) {
					const noteDiv = document.createElement('div');
					noteDiv.innerHTML = `${employee.name} unavailable ${
						getUTCTime(unavailable.start) === '12:00am' &&
						getUTCTime(unavailable.end) === '11:59pm'
							? 'all day'
							: `${getUTCTime(unavailable.start)} - ${getUTCTime(
									unavailable.end
							  )}`
					}`;
					noteDiv.title = unavailable.reason;
					notesDiv.appendChild(noteDiv);
				}
			});
			if (weekIndex >= 0)
				employee.timeOff.forEach((timeOff) => {
					const startDate = new Date(
						new Date(timeOff.start.getTime()).setUTCHours(0, 0, 0, 0)
					);
					const endDate = new Date(
						new Date(timeOff.end.getTime()).setUTCHours(0, 0, 0, 0)
					);

					if (startDate <= dayAsDay.date && endDate >= dayAsDay.date) {
						const noteDiv = document.createElement('div');
						noteDiv.innerHTML = `${employee.name} timeoff`;
						let allDay = true;
						if (
							startDate.getTime() === dayAsDay.date.getTime() &&
							getUTCTime(timeOff.start) !== '12:00am'
						) {
							noteDiv.innerHTML += ` starting ${getUTCTime(timeOff.start)}`;
							allDay = false;
						}
						if (
							endDate.getTime() === dayAsDay.date.getTime() &&
							getUTCTime(timeOff.end) !== '11:59pm'
						) {
							noteDiv.innerHTML += ` ending ${getUTCTime(timeOff.end)}`;
							allDay = false;
						}
						if (allDay) noteDiv.innerHTML += ': all day';
						noteDiv.title = timeOff.reason;
						notesDiv.appendChild(noteDiv);
					}
				});
		});
		notesDiv.style.gridColumn = `${dayIndex + 1}`;
		notesDiv.style.gridRow = `${2}`;
		weekDiv.appendChild(notesDiv);
		day.shifts.forEach((shift, shiftIndex) => {
			if (shiftIndex >= lastRowShiftIndex) {
				lastRowShiftIndex = shiftIndex + 1;
				weekDiv.style.gridTemplateRows =
					'auto '.repeat(lastRowShiftIndex + 2) + '1fr';
			}
			const shiftDiv = document.createElement('div');
			shiftDiv.className = 'shift';
			const employeeIndex = employees.findIndex(
				(employee) => employee.name === shift.employee
			);
			if (employeeIndex > -1)
				shiftDiv.style.backgroundColor = employeeColor(
					employees.findIndex((employee) => employee.name === shift.employee)
				);
			if (selected && selected.type === 'shift') {
				if (
					selected.weekIndex === weekIndex &&
					selected.dayIndex === dayIndex &&
					selected.shiftIndex === shiftIndex
				) {
					shiftDiv.classList.add('selected');
					selected.element = shiftDiv;
					selectedShift = { weekIndex, dayIndex, shiftIndex, shift };
				}
			}
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
			shiftDiv.style.gridRow = `${3 + shiftIndex}`;
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
			shiftDiv.ondblclick = () => {
				select({
					type: 'shift',
					element: shiftDiv,
					weekIndex,
					dayIndex,
					shiftIndex,
					shift,
				});
				newView('editShift');
			};
			weekDiv.appendChild(shiftDiv);
		});
		const addShiftParent = document.createElement('div');
		addShiftParent.className = 'add-shift-parent';
		addShiftParent.style.gridColumn = `${dayIndex + 1}`;
		addShiftParent.style.gridRow = `${3 + day.shifts.length}`;
		const addShift = document.createElement('div');
		addShift.classList.add('button', 'add-shift');
		addShift.innerHTML = '+';
		addShift.onclick = () => {
			selectedShift = {
				weekIndex,
				dayIndex,
				shiftIndex: day.shifts.length,
				shift: {
					position: 'Espresso',
					employee: '',
					start: new Date(0),
					end: new Date(0),
				},
			};
			(document.getElementById('shift-position') as HTMLInputElement).value =
				'';
			(document.getElementById('shift-start') as HTMLInputElement).value =
				getUTCTime(new Date(0), true);
			(document.getElementById('shift-end') as HTMLInputElement).value =
				getUTCTime(new Date(0), true);
			(document.getElementById('shift-employee') as HTMLInputElement).value =
				'';
			newView('editShift');
		};
		addShiftParent.appendChild(addShift);
		weekDiv.appendChild(addShiftParent);
	});
}

function select(selectInfo: Selected) {
	if (selected && selected.element)
		selected.element.classList.remove('selected');
	footerDiv.innerHTML = '';
	selected = deepCopy(selectInfo);
	if (selected.element) selected.element.classList.add('selected');
	switch (selected.type) {
		case 'employee':
			{
				if (selected.employeeIndex < 0) {
					footerDiv.innerHTML = '';
					return;
				}
				populateEmployeePage();
				const statusSpan = document.createElement('span');
				statusSpan.className = 'status';
				statusSpan.innerHTML = `Selected Employee: ${
					selected.employee.name ? selected.employee.name : 'Unassigned'
				}`;
				footerDiv.appendChild(statusSpan);
				const editEmployee = document.createElement('span');
				editEmployee.className = 'button';
				editEmployee.innerHTML = 'Edit';
				editEmployee.onclick = () => {
					newView('editEmployee');
				};
				footerDiv.appendChild(editEmployee);
				const deleteEmployee = document.createElement('span');
				deleteEmployee.className = 'button';
				deleteEmployee.innerHTML = 'Delete';
				deleteEmployee.onclick = () => {
					if (
						selected &&
						selected.type === 'employee' &&
						selected.employeeIndex >= 0
					)
						if (confirm('Really delete this employee?')) {
							const msg: clientMessage = {
								type: 'deleteEmployee',
								employeeIndex: selected.employeeIndex,
							};
							sendMsg(msg);
						}
				};
				footerDiv.appendChild(deleteEmployee);
			}
			break;
		case 'shift':
			{
				selectedShift = {
					weekIndex: selected.weekIndex,
					dayIndex: selected.dayIndex,
					shiftIndex: selected.shiftIndex,
					shift: deepCopy(selected.shift),
				};
				(document.getElementById('shift-position') as HTMLInputElement).value =
					selected.shift.position;
				(document.getElementById('shift-start') as HTMLInputElement).value =
					getUTCTime(selected.shift.start, true);
				(document.getElementById('shift-end') as HTMLInputElement).value =
					getUTCTime(selected.shift.end, true);
				(document.getElementById('shift-employee') as HTMLInputElement).value =
					selected.shift.employee;
				const statusSpan = document.createElement('span');
				statusSpan.innerHTML = `Selected Shift: ${
					dayOfWeekNames[selected.dayIndex]
				}, ${getUTCTime(selected.shift.start)} - ${getUTCTime(
					selected.shift.end
				)}, ${selected.shift.position}`;
				footerDiv.appendChild(statusSpan);
				const editShift = document.createElement('span');
				editShift.className = 'button';
				editShift.innerHTML = 'Edit';
				editShift.onclick = () => {
					newView('editShift');
				};
				footerDiv.appendChild(editShift);
				const deleteShift = document.createElement('span');
				deleteShift.className = 'button';
				deleteShift.innerHTML = 'Delete';
				deleteShift.onclick = () => {
					if (!selectedShift) return;
					if (confirm('Really delete this shift?')) {
						const msg: clientMessage = {
							type: 'deleteShift',
							...selectedShift,
						};
						sendMsg(msg);
					}
				};
				footerDiv.appendChild(deleteShift);
				populateEmployees();
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
	if (view === 'week' || view === 'defaultWeek') {
		populateWeeks();
	}
}

function unSelect() {
	footerDiv.innerHTML = '';
	if (!selected) return;
	if (selected.element) selected.element.classList.remove('selected');
	selected = null;
	populateEmployees();
}

//helper functions:
function getUTCTime(date: Date, twentyfourHour?: true) {
	const amPm: 'am' | 'pm' = date.getUTCHours() > 11 ? 'pm' : 'am';
	const hours = twentyfourHour
		? date.getUTCHours().toString().padStart(2, '0')
		: (date.getUTCHours() % 12 || 12).toString();
	const minutes = date.getUTCMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}${twentyfourHour ? '' : amPm}`;
}

function employeeColor(employeeIndex: number) {
	if (employees.length === 0) return 'black';
	if (employeeIndex >= employees.length) return 'black';
	const nonLinearity = 1.5; //0 is linear, higher is more extreme
	const avoidRedEnd = 0.85; //0 to 1. How far along the hue progression to stop. 1 gets you all the way back to red for employeeIndex === employees.length
	const constToAimCenter = 2.5; //number that shifts where the nonlinearity is centered. 1 is centered at 1, 2 is centered at 1/2, 2.5 is centered at 1/3
	const converter = (x: number) => {
		return (
			(Math.atan(constToAimCenter * nonLinearity * x - nonLinearity) -
				Math.atan(-nonLinearity)) /
			(Math.atan(constToAimCenter * nonLinearity - nonLinearity) -
				Math.atan(-nonLinearity))
		);
	};
	const hue = converter((employeeIndex / employees.length) * avoidRedEnd) * 360;
	return `hsl(${hue}, 100%, 30%)`;
}

function hasNeighboringShift(
	employee: string,
	shift: Shift,
	shiftIndex: number,
	dayIndex: number,
	weekIndex: number
): boolean {
	const neighborShifts: Shift[] = [];
	if (weekIndex >= 0) {
		const day = weeks[weekIndex][dayIndex];
		day.shifts.forEach((shift, index) => {
			if (shiftIndex !== index) neighborShifts.push(shift);
		});
		if (isAm(shift)) {
			let previousDay: Day | null = null;
			if (dayIndex > 0) {
				previousDay = weeks[weekIndex][dayIndex - 1];
			} else {
				if (weekIndex > 0) {
					previousDay = weeks[weekIndex - 1][6];
				}
			}
			if (previousDay) {
				previousDay.shifts.forEach((shift) => {
					if (isPm(shift)) neighborShifts.push(shift);
				});
			}
		}
		if (isPm(shift)) {
			let nextDay: Day | null = null;
			if (dayIndex < 6) {
				nextDay = weeks[weekIndex][dayIndex + 1];
			} else {
				if (weekIndex < weeks.length - 1) {
					nextDay = weeks[weekIndex + 1][0];
				}
			}
			if (nextDay) {
				nextDay.shifts.forEach((shift) => {
					if (isAm(shift)) neighborShifts.push(shift);
				});
			}
		}
	}
	let rtn = false;
	neighborShifts.forEach((neighborShift) => {
		if (neighborShift.employee === employee) {
			rtn = true;
		}
	});
	return rtn;
}

function isRecommended(
	employee: Employee,
	shift: Shift,
	shiftIndex: number,
	dayIndex: number,
	weekIndex: number
): boolean {
	if (
		hasNeighboringShift(employee.name, shift, shiftIndex, dayIndex, weekIndex)
	)
		return false;
	if (weeks.length === 0) return true;
	let rtn = true;
	const shiftDay = weeks[0][dayIndex].date.getUTCDay();
	employee.unavailable.forEach((unavailable) => {
		if (
			unavailable.day === shiftDay &&
			((shift.start >= unavailable.start && shift.start <= unavailable.end) ||
				(shift.end >= unavailable.start && shift.end <= unavailable.end))
		) {
			rtn = false;
			return false;
		}
	});
	if (!rtn) return false;
	if (weekIndex >= 0) {
		const shiftDate = new Date(weeks[weekIndex][dayIndex].date.getTime());
		shiftDate.setUTCHours(0, 0, 0, 0);
		const shiftStart = new Date(shift.start.getTime());
		const shiftEnd = new Date(shift.end.getTime());
		shiftStart.setUTCFullYear(weeks[weekIndex][dayIndex].date.getUTCFullYear());
		shiftStart.setUTCMonth(weeks[weekIndex][dayIndex].date.getUTCMonth());
		shiftStart.setUTCDate(weeks[weekIndex][dayIndex].date.getUTCDate());
		shiftEnd.setUTCFullYear(weeks[weekIndex][dayIndex].date.getUTCFullYear());
		shiftEnd.setUTCMonth(weeks[weekIndex][dayIndex].date.getUTCMonth());
		shiftEnd.setUTCDate(weeks[weekIndex][dayIndex].date.getUTCDate());
		employee.timeOff.forEach((timeOff) => {
			if (
				(shiftStart >= timeOff.start && shiftStart <= timeOff.end) ||
				(shiftEnd >= timeOff.start && shiftEnd <= timeOff.end)
			) {
				rtn = false;
				return false;
			}
		});
	}
	return rtn;
}

function isAm(shift: Shift) {
	const startTime =
		shift.start.getUTCHours() * 60 + shift.start.getUTCMinutes();
	return startTime <= 510;
}

function isPm(shift: Shift) {
	const endTime = shift.end.getUTCHours() * 60 + shift.end.getUTCMinutes();
	return endTime >= 1140;
}

function deepCopy<T>(obj: T): T {
	if (obj instanceof Date) {
		return new Date(obj.getTime()) as T;
	}
	if (obj instanceof HTMLElement) {
		return obj;
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

function trashcanSvg() {
	const svgElement = document.createElementNS(
		'http://www.w3.org/2000/svg',
		'svg'
	);
	svgElement.setAttribute('viewBox', '0 0 80 100');
	const pathElement = document.createElementNS(
		'http://www.w3.org/2000/svg',
		'path'
	);
	pathElement.setAttribute(
		'd',
		'M5 25 h 70 M25 25 v -13.5 a 6.5 6.5 0 0 1 6.5 -6.5 h 17 a 6.5 6.5 0 0 1 6.5 6.5 v13.5 M12 45 l4 44 a6.5 6.5 0 0 0 6.5 6 h35 a6.5 6.5 0 0 0 6.5 -6 l4 -44'
	);
	pathElement.style.strokeWidth = '10';
	pathElement.style.strokeLinecap = 'round';
	pathElement.style.fill = 'none';
	//pathElement.style.stroke = color;
	svgElement.appendChild(pathElement);
	return svgElement;
}
