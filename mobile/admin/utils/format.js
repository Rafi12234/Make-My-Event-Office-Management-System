export function formatDate(
  value,
) {
  if (!value) {
    return "—";
  }

  const text =
    String(value);

  const datePart =
    text.includes(" ")
      ? text.split(" ")[0]
      : text.slice(0, 10);

  const [
    y,
    m,
    d,
  ] = datePart.split("-");

  if (
    !y ||
    !m ||
    !d
  ) {
    return text;
  }

  return `${d}/${m}/${y}`;
}

export function formatDateTime(
  value,
) {
  if (!value) {
    return "—";
  }

  const text =
    String(value).replace(
      "T",
      " ",
    );

  const [
    datePart,
    timePart = "",
  ] = text.split(" ");

  const date =
    formatDate(datePart);

  return timePart
    ? `${date} ${timePart.slice(
        0,
        5,
      )}`
    : date;
}

export function formatTaka(
  value,
) {
  const amount =
    Number(value) || 0;

  const abs =
    Math.abs(
      amount,
    ).toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    );

  return `${
    amount < 0 ? "-" : ""
  }৳${abs}`;
}

export function formatDuration(
  minutes,
) {
  if (
    minutes === null ||
    minutes === undefined
  ) {
    return "—";
  }

  const total =
    Math.max(
      0,
      Number(minutes) || 0,
    );

  const hours =
    Math.floor(total / 60);

  const mins =
    total % 60;

  if (!hours) {
    return `${mins}m`;
  }

  return `${hours}h ${mins}m`;
}

export function normalizeDateTimeLocal(
  value,
) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(" ", "T")
    .slice(0, 16);
}

export function truthyLabel(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Unknown";
  }

  return value
    ? "Yes"
    : "No";
}