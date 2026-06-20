function parsePart(part, min, max) {
  if (part === '*') return new Set(range(min, max));
  const values = new Set();
  for (const segment of part.split(',')) {
    const [base, stepText] = segment.split('/');
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step <= 0) return null;
    const [startText, endText] = base.includes('-') ? base.split('-') : [base, base];
    const start = base === '*' ? min : Number(startText);
    const end = base === '*' ? max : Number(endText);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return null;
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

function range(min, max) {
  const values = [];
  for (let value = min; value <= max; value += 1) values.push(value);
  return values;
}

function parseSchedule(schedule) {
  const normalized = String(schedule || '').trim();
  if (!normalized || normalized === 'manual') return null;
  const aliases = {
    '@hourly': '0 * * * *',
    '@daily': '0 0 * * *',
    '@weekly': '0 0 * * 0',
  };
  const expression = aliases[normalized] || normalized;
  const parts = expression.split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const parsed = {
    minute: parsePart(minute, 0, 59),
    hour: parsePart(hour, 0, 23),
    dayOfMonth: parsePart(dayOfMonth, 1, 31),
    month: parsePart(month, 1, 12),
    dayOfWeek: parsePart(dayOfWeek, 0, 7),
  };
  if (Object.values(parsed).some((value) => value === null)) return null;
  return parsed;
}

function shouldRun(schedule, date) {
  const parsed = parseSchedule(schedule);
  if (!parsed) return false;
  const day = date.getDay();
  return (
    parsed.minute.has(date.getMinutes()) &&
    parsed.hour.has(date.getHours()) &&
    parsed.dayOfMonth.has(date.getDate()) &&
    parsed.month.has(date.getMonth() + 1) &&
    (parsed.dayOfWeek.has(day) || (day === 0 && parsed.dayOfWeek.has(7)))
  );
}

module.exports = { parseSchedule, shouldRun };
