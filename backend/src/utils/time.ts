const BEIJING_TIMEZONE = 'Asia/Shanghai';

export function toMysqlDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  const date = parseUtcDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function toBeijingDate(value: string | Date) {
  const date = parseUtcDateTime(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function toBeijingTimeText(value: string | Date) {
  const date = parseUtcDateTime(value);
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: BEIJING_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function toBeijingDateTimeText(value: string | Date) {
  const date = parseUtcDateTime(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

export function todayInBeijing() {
  return toBeijingDate(new Date());
}

export function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return toBeijingDate(date);
}

export function parseUtcDateTime(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  const text = String(value).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    return new Date(text);
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    return new Date(text);
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
}
