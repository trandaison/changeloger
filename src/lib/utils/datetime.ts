export function format(date: string | Date) {
  const _date = new Date(date);
  const year = _date.getFullYear();
  const month = _date.getMonth() + 1;
  const day = _date.getDate();
  return `${year}-${month}-${day}`;
}
