import * as FileSystem
  from "expo-file-system/legacy";

import * as Sharing
  from "expo-sharing";

function bytesToBase64(
  arrayBuffer,
) {
  const bytes =
    new Uint8Array(
      arrayBuffer,
    );

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  let result = "";

  for (
    let i = 0;
    i < bytes.length;
    i += 3
  ) {
    const a = bytes[i];

    const b =
      i + 1 < bytes.length
        ? bytes[i + 1]
        : 0;

    const c =
      i + 2 < bytes.length
        ? bytes[i + 2]
        : 0;

    const triple =
      (a << 16) |
      (b << 8) |
      c;

    result +=
      chars[
        (triple >> 18) &
          63
      ];

    result +=
      chars[
        (triple >> 12) &
          63
      ];

    result +=
      i + 1 < bytes.length
        ? chars[
            (triple >> 6) &
              63
          ]
        : "=";

    result +=
      i + 2 < bytes.length
        ? chars[
            triple & 63
          ]
        : "=";
  }

  return result;
}

export async function saveAndSharePdfResponse(
  response,
  filename = "document.pdf",
) {
  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(() => ({}));

    throw new Error(
      payload.message ||
        `PDF request failed (${response.status}).`,
    );
  }

  const buffer =
    await response.arrayBuffer();

  const safeName =
    String(
      filename ||
        "document.pdf",
    ).replace(
      /[^a-zA-Z0-9._-]+/g,
      "-",
    );

  const uri =
    `${FileSystem.cacheDirectory}${
      safeName.endsWith(
        ".pdf",
      )
        ? safeName
        : `${safeName}.pdf`
    }`;

  await FileSystem.writeAsStringAsync(
    uri,
    bytesToBase64(buffer),
    {
      encoding:
        FileSystem.EncodingType
          .Base64,
    },
  );

  if (
    await Sharing.isAvailableAsync()
  ) {
    await Sharing.shareAsync(
      uri,
      {
        mimeType:
          "application/pdf",

        dialogTitle:
          "Open / share PDF",
      },
    );
  }

  return uri;
}

export async function shareCsv(
  filename,
  columns,
  rows,
) {
  const escape = (value) => {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    return /[",\n]/.test(
      text,
    )
      ? `"${text.replace(
          /"/g,
          '""',
        )}"`
      : text;
  };

  const csv = [
    columns
      .map((column) =>
        escape(
          column.label,
        ),
      )
      .join(","),

    ...rows.map(
      (row) =>
        columns
          .map((column) =>
            escape(
              column.value(
                row,
              ),
            ),
          )
          .join(","),
    ),
  ].join("\n");

  const safe =
    String(
      filename ||
        "export.csv",
    ).replace(
      /[^a-zA-Z0-9._-]+/g,
      "-",
    );

  const uri =
    `${FileSystem.cacheDirectory}${
      safe.endsWith(".csv")
        ? safe
        : `${safe}.csv`
    }`;

  await FileSystem.writeAsStringAsync(
    uri,
    `\uFEFF${csv}`,
    {
      encoding:
        FileSystem.EncodingType
          .UTF8,
    },
  );

  if (
    await Sharing.isAvailableAsync()
  ) {
    await Sharing.shareAsync(
      uri,
      {
        mimeType:
          "text/csv",

        dialogTitle:
          "Export CSV",
      },
    );
  }

  return uri;
}