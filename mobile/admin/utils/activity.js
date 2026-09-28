function asTime(value) {
  if (!value) {
    return null;
  }

  const time =
    new Date(
      String(value).replace(
        " ",
        "T",
      ),
    ).getTime();

  return Number.isNaN(time)
    ? null
    : time;
}

export function buildEmployeeActivity(
  employees = [],
  meetings = [],
  calls = [],
) {
  const now =
    Date.now();

  return employees.map(
    (employee) => {
      const name =
        employee.fullName;

      const previous = [];
      const upcoming = [];

      for (
        const meeting
        of meetings
      ) {
        if (
          meeting.createdByName ===
          name
        ) {
          previous.push({
            type: "meeting",

            ...meeting,

            datetime:
              meeting.meetingDatetime,
          });
        }

        if (
          meeting.nextMeeting
            ?.assignedEmployeeName ===
            name &&
          meeting.nextMeeting
            ?.nextMeetingDatetime
        ) {
          const item = {
            type: "meeting",

            id:
              `next-meeting-${meeting.id}`,

            rowKey:
              meeting.rowKey,

            clientName:
              meeting.clientName,

            datetime:
              meeting.nextMeeting
                .nextMeetingDatetime,

            isFollowUp: true,

            parentId:
              meeting.id,
          };

          const time =
            asTime(
              item.datetime,
            );

          (
            time !== null &&
            time >= now
              ? upcoming
              : previous
          ).push(item);
        }
      }

      for (
        const call
        of calls
      ) {
        if (
          call.createdByName ===
          name
        ) {
          previous.push({
            type: "call",

            ...call,

            datetime:
              call.callDatetime,
          });
        }

        if (
          call.nextCall
            ?.assignedEmployeeName ===
            name &&
          call.nextCall
            ?.nextCallDatetime
        ) {
          const item = {
            type: "call",

            id:
              `next-call-${call.id}`,

            rowKey:
              call.rowKey,

            clientName:
              call.clientName,

            datetime:
              call.nextCall
                .nextCallDatetime,

            isFollowUp: true,

            parentId:
              call.id,
          };

          const time =
            asTime(
              item.datetime,
            );

          (
            time !== null &&
            time >= now
              ? upcoming
              : previous
          ).push(item);
        }
      }

      previous.sort(
        (a, b) =>
          (asTime(
            b.datetime,
          ) || 0) -
          (asTime(
            a.datetime,
          ) || 0),
      );

      upcoming.sort(
        (a, b) =>
          (asTime(
            a.datetime,
          ) ||
            Infinity) -
          (asTime(
            b.datetime,
          ) ||
            Infinity),
      );

      return {
        employee,
        previous,
        upcoming,
      };
    },
  );
}

export function missedItems(
  bucket,
) {
  const now =
    Date.now();

  return bucket.previous.filter(
    (item) =>
      item.isFollowUp &&
      (asTime(
        item.datetime,
      ) || 0) < now,
  );
}