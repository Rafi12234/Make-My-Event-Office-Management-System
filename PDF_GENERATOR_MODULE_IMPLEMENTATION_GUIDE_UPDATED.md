# Make My Event Office Management System
# PDF Generator Module — Updated Professional Implementation Guide

**Document Type:** Engineering / Development Specification  
**Project:** Make My Event Office Management System  
**Module:** PDF Generator  
**Revision:** v2 — Updated after analysis of the real Palm View sample document  
**Target Stack:** Existing React + Node.js/Express + Prisma + MySQL/MariaDB website  
**Deployment:** Existing cPanel / Passenger + GitHub Actions/SFTP workflow  
**Primary Output:** Make My Event event proposal / decoration specification PDF  

---

# 1. Purpose

This document defines the exact recommended implementation of a new **PDF Generator module** inside the existing **Make My Event Office Management System**.

The module must be integrated as a real first-class website module, similar to the current `Accounts` module.

The PDF Generator is **not** intended to be a generic Microsoft Word-style editor.

Its primary job is to generate official Make My Event event/proposal documents in the same structure as the provided real example:

```text
Page 1
Make My Event Letter Pad
+ Date
+ Event Title
+ Item / Description / Quantity Table

Page 2+
Photo / Reference Section

Item Name - Description
[Reference Image]

Item Name - Description
[Reference Image]

...continue automatically across pages
```

The implementation must preserve the Make My Event branding and produce a predictable professional document without requiring the employee to manually design each PDF page.

---

# 2. Important Revision From the Previous Design

The previous implementation concept assumed:

```text
one image = one dedicated page
```

That assumption is **not correct for the actual required document format**.

The real Palm View example shows:

```text
Page 1:
Letter pad + date + Wedding Reception title + 4-column item table

Page 2:
Stage description + Stage photo
Photo booth description + Photo booth photo

Page 3:
Partition description + Partition photo
Entry Gate description + Entry Gate photo

Page 4:
Sofa description + Sofa photo
```

Therefore the updated rule is:

> **One selected image belongs to one event item/reference block, not necessarily one entire page.**

The PDF generator should automatically place as many complete reference blocks on a page as can fit cleanly.

If the next reference block does not have enough space:

```text
move the complete block to a new page
```

If a single image is too large for its available page area:

```text
resize it proportionally until it fits
```

The image must never be stretched or cropped by default.

---

# 3. Exact Output Model Based on the Real Sample

The module should generate two logical sections.

---

## 3.1 Section A — Main Summary Page

The first page contains:

```text
Existing Make My Event letter-pad background

Date: DD/MM/YY

Event Title
Example:
Wedding Reception

Summary Table:

+----+---------------+-------------------------------+------+
| Sl | Item          | Description                   | Qty  |
+----+---------------+-------------------------------+------+
| 1  | Stage         | As per picture...             | 1    |
| 2  | Photo booth   | As per picture...             | 1    |
| 3  | Entry Gate    | As per picture...             | 2    |
| 4  | Partition     | As per picture...             | 1    |
| 5  | Sofa          | As per picture                |2 set |
| 6  | Platform      | 20" X 12"                     | 1    |
| 7  | Sound System  | Premium Sound System          |1 pair|
| 8  | WelcomeBanner | As per choice                 | 2    |
+----+---------------+-------------------------------+------+
```

This is the primary official summary page.

---

## 3.2 Section B — Reference Image Pages

After the summary table, render reference items that have selected photos.

Example:

```text
Stage - As per picture, Backdrop White,
white artificial flower with Natural Leaves,
Chandeliers, stick light, props...

[STAGE IMAGE]


Photo booth - As per picture,
white artificial flower with Leaves & Props,
Backdrop Black with Grass Carpet

[PHOTO BOOTH IMAGE]
```

The layout must be **flow based**.

That means:

```text
Reference Block 1
Reference Block 2
Reference Block 3
...
```

are placed vertically until the page is full.

---

# 4. Source Document Findings That Must Drive the Implementation

The uploaded example contains:

```text
4 pages
1 main table
5 embedded reference photos
```

The first page is an event specification table.

The photo references are associated with:

```text
Stage
Photo booth
Partition
Entry Gate
Sofa
```

Other table rows such as:

```text
Platform
Sound System
Welcome Banner
```

do not require images in the sample.

This means the correct data model is:

```text
Document
    |
    +-- Event date
    +-- Event title
    |
    `-- Items[]
          |
          +-- Item name
          +-- Description
          +-- Quantity
          +-- Optional reference image
          `-- Optional caption override
```

This structured model is more suitable than a free-form block editor.

---

# 5. Recommended User Workflow

The employee should not manually create PDF pages.

The employee should enter structured event information.

Recommended process:

```text
1. Open PDF Generator
2. Enter Event Date
3. Enter Event Title
4. Add event items
5. Enter description and quantity for each item
6. Optionally attach a client-selected/reference photo to an item
7. Reorder items if needed
8. Preview PDF
9. Generate PDF
10. Download PDF
11. PDF remains available in History
```

Example UI data:

```text
Event Date
[ 04/08/2024 ]

Event Title
[ Wedding Reception ]


ITEM 1
Item:
[ Stage ]

Description:
[ As per picture, Backdrop White, white artificial flower... ]

Quantity:
[ 1 ]

Reference Photo:
[ Choose Image ]

[stage.jpg]


ITEM 2
Item:
[ Photo booth ]

Description:
[ As per picture, white artificial flower... ]

Quantity:
[ 1 ]

Reference Photo:
[ Choose Image ]

[photobooth.jpg]
```

---

# 6. Key Functional Requirements

The completed module must support:

- Employee-authenticated PDF generation.
- Existing Make My Event letter-pad template.
- Event date.
- Event title.
- Dynamic item rows.
- Automatic serial number.
- Item name.
- Description.
- Quantity.
- Optional photo per item.
- Item ordering.
- Dynamic table row height.
- Automatic text wrapping inside table cells.
- Automatic table overflow handling.
- Photo/reference pages.
- Automatic image scaling.
- Automatic image pagination.
- Multiple image blocks on one page when they fit.
- One image on a page when that is all that fits.
- Image aspect-ratio preservation.
- No image stretching.
- No default image cropping.
- Preview.
- Final PDF generation.
- Download.
- Document history.
- Employee ownership protection.
- Persistent production storage.

---

# 7. Recommended Module Architecture

```text
Existing Website
|
+-- Management
|
+-- Accounts
|
`-- PDF Generator
      |
      +-- New Document
      |
      +-- Document History
      |
      `-- Preview
```

Technical flow:

```text
React PDF Generator
        |
        | Employee enters event + items + images
        v
POST /api/pdf-generator/preview
or
POST /api/pdf-generator/documents
        |
        v
attachBearerToken
        |
        v
requireEmployee
        |
        v
PDF Generator backend module
        |
        +-- Template renderer
        +-- Table renderer
        +-- Text wrapping
        +-- Reference page renderer
        +-- Image fitter
        |
        v
pdf-lib
        |
        v
Final PDF
        |
        +-- Persistent file storage
        |
        `-- Prisma / MySQL metadata
```

---

# 8. Recommended Repository Structure

Add a new top-level module exactly like the architectural style of `Accounts`.

```text
Make-My-Event-Office-Management-System-main/
|
|-- Accounts/
|
|-- PDFGenerator/
|   |
|   |-- backend/
|   |   |
|   |   |-- config/
|   |   |   `-- pdfLayout.js
|   |   |
|   |   |-- controllers/
|   |   |   `-- pdfGeneratorController.js
|   |   |
|   |   |-- routes/
|   |   |   `-- pdfGenerator.js
|   |   |
|   |   |-- services/
|   |   |   |-- pdfGeneratorService.js
|   |   |   |-- firstPageRenderer.js
|   |   |   |-- tableRenderer.js
|   |   |   |-- referencePageRenderer.js
|   |   |   |-- imageRenderer.js
|   |   |   |-- textRenderer.js
|   |   |   `-- documentNumberService.js
|   |   |
|   |   |-- utils/
|   |   |   |-- uploadValidation.js
|   |   |   |-- filename.js
|   |   |   `-- validation.js
|   |   |
|   |   |-- templates/
|   |   |   `-- make-my-event-letter-pad.pdf
|   |   |
|   |   `-- storage/
|   |       `-- README.md
|   |
|   `-- frontend/
|       |
|       |-- components/
|       |   |-- PDFDocumentForm.jsx
|       |   |-- EventDetailsForm.jsx
|       |   |-- EventItemEditor.jsx
|       |   |-- EventItemList.jsx
|       |   |-- ReferenceImageUploader.jsx
|       |   |-- PDFPreviewPane.jsx
|       |   `-- PDFHistoryTable.jsx
|       |
|       |-- pages/
|       |   |-- PDFGeneratorPage.jsx
|       |   `-- PDFHistoryPage.jsx
|       |
|       |-- services/
|       |   `-- pdfGeneratorService.js
|       |
|       `-- utils/
|           `-- documentForm.js
|
|-- backend/
|
|-- frontend/
|
`-- .github/
```

Do not create another independent React/Vite application.

Do not create another independent Node server.

The existing frontend and backend remain the host applications.

---

# 9. PDF Template Strategy

## 9.1 Canonical template

Use the supplied Make My Event letter pad as a permanent PDF template:

```text
PDFGenerator/backend/templates/make-my-event-letter-pad.pdf
```

Convert the source letter-pad document to PDF once.

Do not perform DOC/RTF-to-PDF conversion during every generation request.

---

## 9.2 Template must remain immutable

Never write generated content back into:

```text
make-my-event-letter-pad.pdf
```

Correct:

```text
read template
copy template page
draw dynamic content
save output to another PDF
```

---

# 10. Important Page Background Rule

The real Palm View example uses the Make My Event letter pad on the **first/main page**.

The subsequent reference-image pages visually behave as normal white continuation pages.

Therefore the default implementation should be:

```javascript
export const PDF_PAGE_STYLE = {
  firstPage: "letterpad",
  referencePages: "plain",
};
```

This matches the provided real-world output.

However, to preserve flexibility, implement the renderer so reference pages could later be changed to:

```text
letterpad
```

without rewriting the entire generator.

Example configuration:

```javascript
referencePageBackground: "plain"
```

Possible future value:

```javascript
referencePageBackground: "letterpad"
```

For the required current output:

> **Use letter pad on the main summary page and plain continuation pages for photo references.**

---

# 11. PDF Page Size

Use US Letter:

```text
8.5 x 11 inches
612 x 792 PDF points
```

All pages must use the same dimensions.

---

# 12. Continuation Page Margins

The reference pages in the sample behave like a Word document with approximately 1-inch page margins.

Recommended:

```javascript
const REFERENCE_PAGE = {
  width: 612,
  height: 792,

  marginLeft: 72,
  marginRight: 72,
  marginTop: 60,
  marginBottom: 60,
};
```

Usable width:

```text
612 - 72 - 72 = 468 points
```

Equivalent to approximately:

```text
6.5 inches
```

This matches the general image width behavior in the provided source.

---

# 13. First Page Layout

The first page must contain:

```text
Letter pad
Date
Event title
Table
```

Approximate visual structure:

```text
+------------------------------------------------------+
|                                                      |
|               MAKE MY EVENT LETTER PAD               |
|                                                      |
| Address / Email / Phone                 Date: ______  |
|                                                      |
|     +------------------------------------------+     |
|     |           Wedding Reception              |     |
|     +----+----------+---------------------+----+     |
|     | Sl | Item     | Description         |Qty |     |
|     +----+----------+---------------------+----+     |
|     | 1  | Stage    | ...                 | 1  |     |
|     | 2  | ...      | ...                 | ...|     |
|     +----+----------+---------------------+----+     |
|                                                      |
|                                                      |
|                 Letter pad footer                    |
+------------------------------------------------------+
```

The table must be positioned inside the safe central area so it does not overlap the branding/footer.

---

# 14. First Page Dynamic Fields

Required:

```text
documentDate
eventTitle
items[]
```

Optional future fields:

```text
clientName
venue
eventTime
referenceNumber
preparedBy
```

Do not print optional future fields until requested.

---

# 15. Date Formatting

The sample uses:

```text
04/08/24
```

Default display format should therefore be:

```text
DD/MM/YY
```

Store database date as a proper date.

Example:

```text
database:
2024-08-04

PDF:
04/08/24
```

Do not store date only as a formatted string.

---

# 16. Event Title

Example:

```text
Wedding Reception
```

It appears as a merged table title row.

Implementation:

```text
Merged row across all table columns
Centered
Semibold/Bold
```

Do not treat the event title as a random paragraph.

---

# 17. Table Structure

The exact required columns are:

```text
Sl
Item
Description
Qty
```

Recommended column distribution within a 468-point table:

```text
Sl          36 pt
Item        78 pt
Description 316 pt
Qty         38 pt
```

Total:

```text
468 pt
```

These are starting values and should be visually calibrated.

Alternatively use percentages:

```text
Sl           8%
Item        17%
Description 67%
Qty          8%
```

---

# 18. Table Header Styling

Recommended:

```text
Border: black
Border width: 0.8 - 1.0 pt
Font: approved business font
Font size: 10 - 11 pt
Header: bold
Alignment: centered
Vertical alignment: middle
```

The sample centers all four header titles.

---

# 19. Table Row Rendering

Each row must be dynamic.

Example:

```text
1 | Stage | As per picture, Backdrop White... | 1
```

The row height must be calculated based on the tallest cell.

Do not use a fixed row height for all rows.

Pseudo algorithm:

```text
wrap Sl text
wrap Item text
wrap Description text
wrap Qty text

calculate required height for each cell

rowHeight =
  max(
    slHeight,
    itemHeight,
    descriptionHeight,
    qtyHeight
  )
  + verticalPadding
```

Then draw every cell using the same row height.

---

# 20. Table Cell Text Wrapping

`pdf-lib` does not provide a complete table engine.

Implement width-aware wrapping manually.

Pseudo:

```javascript
function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);

  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    const width =
      font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}
```

Also preserve explicit line breaks.

---

# 21. Table Alignment

Match the sample.

Recommended:

```text
Sl:
center horizontal
center vertical

Item:
center horizontal
center vertical

Description:
center horizontal
center vertical

Qty:
center horizontal
center vertical
```

If a business decision later requires left-aligned descriptions, keep alignment configurable.

---

# 22. Automatic Serial Numbers

Employee should not manually enter:

```text
1
2
3
4
```

Serial should be generated from item order.

```javascript
const serial = index + 1;
```

If items are reordered:

```text
serial numbers update automatically
```

---

# 23. Item Quantity

Quantity must support values such as:

```text
1
2
2 set
1 pair
10 pcs
```

Therefore do not store quantity only as an integer.

Use:

```text
VARCHAR/string
```

Example:

```javascript
quantity: "2 set"
```

This is important because the sample uses quantity/unit combinations.

---

# 24. Reference Photo Association

Every event item may contain:

```text
zero or one reference image in Version 1
```

Example:

```javascript
{
  itemName: "Stage",
  description: "As per picture...",
  quantity: "1",
  referenceImage: File
}
```

If no image is selected:

```text
the item still appears in the first-page table
```

but:

```text
no reference block is generated for that item
```

---

# 25. Reference Caption Rule

Default caption should automatically be:

```text
<Item Name>- <Description>
```

Example:

```text
Stage- As per picture, Backdrop White,
white artificial flower with Natural Leaves...
```

This exactly follows the sample concept.

---

## 25.1 Caption override

Allow optional:

```text
Custom Photo Caption
```

If empty:

```text
use Item + Description
```

If provided:

```text
use custom caption
```

Recommended UI:

```text
Photo Caption
[ Use item name + description automatically ]

[ ] Customize caption
```

---

# 26. Reference Caption Styling

The sample visually emphasizes the item name.

Recommended renderer:

```text
Item Name:
bold + italic

"- ":
regular

Description:
regular
```

Example:

```text
Stage- As per picture, Backdrop White...
```

Implementation can use:

```text
Helvetica-BoldOblique
Helvetica
```

or an approved embedded custom font.

---

# 27. Updated Image Rule

The correct requirement is:

> **Do not force one image onto every page.**

Instead:

```text
one image = one reference block
```

A page may contain:

```text
1 block
2 blocks
or potentially more
```

depending on actual available height.

---

# 28. Reference Block Structure

Every photo section block consists of:

```text
Caption
Vertical gap
Image
Vertical gap after block
```

Conceptually:

```text
+------------------------------------------+
| Stage - As per picture...                |
|                                          |
| +--------------------------------------+ |
| |                                      | |
| |              IMAGE                   | |
| |                                      | |
| +--------------------------------------+ |
|                                          |
+------------------------------------------+
```

---

# 29. Image Scaling Strategy

The source images may have different shapes.

Examples:

```text
landscape
portrait
square
wide panorama
```

The generator must preserve their original aspect ratio.

Never do:

```javascript
width = availableWidth;
height = availableHeight;
```

because that stretches the photo.

Use:

```javascript
const scale = Math.min(
  maxWidth / sourceWidth,
  maxHeight / sourceHeight,
);

const width = sourceWidth * scale;
const height = sourceHeight * scale;
```

---

# 30. Image Width Behavior

For reference pages, the preferred visual behavior should be:

```text
use most of the available page width
```

because the real sample uses large reference images.

Recommended maximum width:

```text
468 pt
```

which is the content width between 1-inch margins.

However:

```text
maximum height
```

depends on the remaining page space.

---

# 31. The Critical Pagination Algorithm

This is one of the most important implementation requirements.

For each reference block:

```text
1. Measure caption height
2. Calculate remaining vertical page space
3. Determine image dimensions at preferred width
4. Calculate complete block height
5. Check whether complete block fits
```

If yes:

```text
render block on current page
```

If no:

```text
start a new page
recalculate image fit
render complete block there
```

This prevents:

```text
caption at bottom of page
image on next page
```

The caption and its image should stay together whenever possible.

---

# 32. Fit Multiple Images Per Page When Possible

The sample requires this behavior.

Example:

```text
Page 2

Stage caption
[Stage image]

Photo booth caption
[Photo booth image]
```

Therefore the renderer must continue after each block instead of automatically creating a new page.

Pseudo:

```javascript
for (const item of itemsWithImages) {
  const block = measureReferenceBlock(item);

  if (!fitsInRemainingSpace(block)) {
    page = createReferencePage();
    y = top;
  }

  renderReferenceBlock(page, item, y);

  y -= block.height + blockSpacing;
}
```

---

# 33. When One Image Should Get an Entire Page

One photo may occupy most or all of a page when:

```text
the image is tall
```

or:

```text
remaining page space is too small
```

or:

```text
scaling the image into remaining space would make it unacceptably small
```

Recommended minimum quality rule:

If the image would need to be reduced below an agreed minimum visual height, move the complete block to a new page.

Example:

```javascript
const MIN_REFERENCE_IMAGE_HEIGHT = 150;
```

This should be visually calibrated.

---

# 34. Avoid Tiny Images Just to Fill Space

Wrong behavior:

```text
Page has only 100 pt left
-> shrink next photo to 70 pt height
-> place it there
```

Correct behavior:

```text
remaining space too small
-> create new page
-> render photo at useful size
```

Professional appearance is more important than minimizing page count.

---

# 35. Image Centering

Images should be horizontally centered.

```javascript
const x =
  marginLeft +
  (usableWidth - imageWidth) / 2;
```

Vertical position follows content flow.

Reference pages are not vertically centered because multiple items may share the same page.

---

# 36. Do Not Crop Images by Default

Use contain behavior.

Expected:

```text
full image visible
```

not:

```text
fill box by cropping edges
```

Client-selected reference photos must remain intact.

---

# 37. Image Formats

Support:

```text
JPG
JPEG
PNG
```

MIME:

```text
image/jpeg
image/png
```

Version 1 should not require:

```text
HEIC
TIFF
PSD
SVG
WEBP
```

unless business needs later demand them.

---

# 38. Recommended Image Limits

Initial server limits:

```text
Max image size:
10 MB

Max images/document:
30

Max items/document:
50
```

These may be adjusted after real use.

---

# 39. Frontend Design

Recommended main route:

```text
/pdf-generator
```

History:

```text
/pdf-generator/history
```

---

# 40. Main PDF Generator UI

Recommended layout:

```text
+------------------------------------------------------------------+
| PDF Generator                              [Document History]     |
+------------------------------------------------------------------+
| Event Information                                                |
|                                                                  |
| Event Date                 Event Title                            |
| [04/08/2024]               [Wedding Reception              ]      |
|                                                                  |
+------------------------------------------------------------------+
| Event Items                                                      |
|                                                                  |
| #1                                                               |
| Item        [ Stage                                       ]       |
| Qty         [ 1                                           ]       |
| Description [ As per picture, Backdrop White...           ]       |
| Image       [ Choose Image ] stage.jpg                            |
|                                                                  |
| [Move Up] [Move Down] [Delete]                                   |
|                                                                  |
| #2                                                               |
| Item        [ Photo booth                                  ]       |
| Qty         [ 1                                            ]      |
| Description [ As per picture...                           ]       |
| Image       [ Choose Image ] photobooth.jpg                      |
|                                                                  |
| [+ Add Item]                                                     |
+------------------------------------------------------------------+
| [Preview PDF]                       [Generate Final PDF]          |
+------------------------------------------------------------------+
```

---

# 41. Item Editor Requirements

Each item editor must provide:

```text
Item name
Description
Quantity
Optional image
Optional custom caption
Move Up
Move Down
Delete
```

---

# 42. Image Preview in Form

When an employee selects a photo:

```text
show thumbnail
show filename
show replace button
show remove button
```

Example:

```text
Reference Image

+------------------+
|                  |
|   image preview  |
|                  |
+------------------+

stage.jpg

[Replace]
[Remove]
```

---

# 43. Item Reordering

Because table order and photo-reference order must remain synchronized:

```text
one master item array
```

must drive both.

If the employee moves:

```text
Entry Gate
```

above:

```text
Photo booth
```

then:

```text
first-page table order changes
AND
reference-page order changes
```

automatically.

Do not maintain separate independent order arrays.

---

# 44. Frontend State Model

Recommended:

```javascript
const [documentForm, setDocumentForm] = useState({
  eventDate: "",
  eventTitle: "",
  items: [],
});
```

Item:

```javascript
{
  clientId: crypto.randomUUID(),

  itemName: "",
  description: "",
  quantity: "",

  referenceImage: null,

  customCaptionEnabled: false,
  customCaption: "",
}
```

---

# 45. Request Format

Use:

```text
multipart/form-data
```

because the request contains structured metadata plus images.

Recommended payload:

```text
document:
JSON string

image_<clientId>:
File
```

Example:

```javascript
const formData = new FormData();

formData.append(
  "document",
  JSON.stringify({
    eventDate,
    eventTitle,
    items: items.map((item, index) => ({
      clientId: item.clientId,
      sortOrder: index,
      itemName: item.itemName,
      description: item.description,
      quantity: item.quantity,
      customCaption: item.customCaptionEnabled
        ? item.customCaption
        : null,
      imageKey: item.referenceImage
        ? `image_${item.clientId}`
        : null,
    })),
  }),
);

for (const item of items) {
  if (item.referenceImage) {
    formData.append(
      `image_${item.clientId}`,
      item.referenceImage,
    );
  }
}
```

---

# 46. Frontend API Service

Create:

```text
PDFGenerator/frontend/services/pdfGeneratorService.js
```

Use the same existing frontend API convention.

Requests must include:

```javascript
credentials: "include"
```

because employee authentication uses the existing session cookie.

---

# 47. Preview API

Recommended:

```http
POST /api/pdf-generator/preview
Content-Type: multipart/form-data
```

The preview endpoint must:

- Validate form.
- Generate the actual PDF in memory.
- Not save permanent database data.
- Not save permanent generated file.
- Return PDF bytes.

Response:

```http
Content-Type: application/pdf
Content-Disposition: inline; filename="preview.pdf"
```

---

# 48. Preview Must Use Real Renderer

Do not create a separate HTML mock preview.

Correct:

```text
same renderer
    |
    +-- preview
    |
    `-- final generation
```

This ensures:

```text
what employee sees
=
what employee downloads
```

---

# 49. Final Generation API

Recommended:

```http
POST /api/pdf-generator/documents
```

The final endpoint:

```text
validate
generate PDF
create persistent file
create database record
create item rows
return metadata
```

---

# 50. Recommended API Routes

```text
POST   /api/pdf-generator/preview

POST   /api/pdf-generator/documents

GET    /api/pdf-generator/documents

GET    /api/pdf-generator/documents/:id

GET    /api/pdf-generator/documents/:id/download

PATCH  /api/pdf-generator/documents/:id/archive
```

Optional later:

```text
PUT /api/pdf-generator/documents/:id
POST /api/pdf-generator/documents/:id/regenerate
```

---

# 51. Backend Folder Responsibilities

## `pdfGeneratorController.js`

Responsible for:

```text
HTTP request
authentication context
request validation
multipart parsing result
calling service
database transaction coordination
HTTP response
```

Do not put detailed PDF drawing here.

---

## `pdfGeneratorService.js`

Responsible for:

```text
load template
create PDF document
call first page renderer
call table renderer
call reference renderer
return PDF bytes and page count
```

---

## `firstPageRenderer.js`

Responsible for:

```text
copy letter-pad template
draw date
draw title/table region
```

---

## `tableRenderer.js`

Responsible for:

```text
column geometry
cell wrapping
cell height
row height
borders
table pagination
```

---

## `referencePageRenderer.js`

Responsible for:

```text
plain continuation pages
caption layout
block measurement
block pagination
```

---

## `imageRenderer.js`

Responsible for:

```text
JPEG embedding
PNG embedding
aspect ratio
image dimension calculation
centering
```

---

## `textRenderer.js`

Responsible for:

```text
word wrapping
paragraph lines
font width calculation
caption segments
```

---

# 52. PDF Library

Use:

```bash
npm install pdf-lib
```

inside the existing backend package.

Do not create a second `package.json` for the module unless the project intentionally changes architecture later.

The deployed module can use dependencies from the existing Node application.

---

# 53. Why pdf-lib Is Correct

The output is:

```text
fixed PDF template
+
dynamic vector text
+
dynamic table
+
dynamic images
```

`pdf-lib` is well suited for this.

Avoid Puppeteer because:

- No HTML page rendering is necessary.
- Chromium is unnecessary.
- cPanel deployment becomes more difficult.
- The source design already exists as PDF.

---

# 54. First Page Rendering Algorithm

Pseudo:

```text
load template PDF

create output PDF

copy template page into output

draw document date

measure first-page table

draw merged event title row

draw column header row

for each item:
    wrap each cell
    calculate row height

    if row fits:
        draw row
    else:
        create table continuation page
        repeat headers
        continue rows
```

After all summary items:

```text
start photo/reference section
```

---

# 55. Handling Too Many Table Rows

The sample fits 8 rows on page 1.

The system must not assume every event has only 8 rows.

If the table exceeds the safe first-page space:

```text
Page 1:
Letter pad + first rows

Page 2:
Table continuation
```

Recommended continuation table page style:

```text
plain white
```

to remain consistent with the current sample's continuation-page behavior.

Repeat:

```text
Event title
table headers
```

on each table continuation page.

Then begin image pages after the table finishes.

---

# 56. Table Continuation Example

```text
Page 1
Letter Pad

Wedding Reception
Sl | Item | Description | Qty
1 ...
2 ...
...
8 ...


Page 2
Plain

Wedding Reception (continued)

Sl | Item | Description | Qty
9 ...
10 ...
11 ...
...


Page 3
Reference photos start
```

---

# 57. Photo Reference Pagination Algorithm

Pseudo:

```javascript
for (const item of itemsWithImages) {
  const caption = buildCaption(item);

  const captionHeight =
    measureCaption(caption);

  const naturalImageSize =
    getEmbeddedImageSize(item.image);

  const preferredImage =
    scaleToWidth(
      naturalImageSize,
      referenceContentWidth,
    );

  let blockHeight =
    captionHeight
    + captionGap
    + preferredImage.height
    + blockGap;

  if (blockHeight <= remainingHeight) {
    renderBlock();
    continue;
  }

  // Try on new page at preferred size
  createReferencePage();

  const maxImageHeight =
    usableHeight
    - captionHeight
    - captionGap
    - blockGap;

  const fittedImage =
    contain(
      naturalImageSize,
      referenceContentWidth,
      maxImageHeight,
    );

  renderBlockWith(fittedImage);
}
```

---

# 58. Measure Before Drawing

Never draw first and discover afterward that an image does not fit.

Every block must be measured first.

Renderer functions should support:

```text
measure
render
```

or return reusable layout data.

---

# 59. Image Contain Helper

Recommended:

```javascript
function containImage(
  sourceWidth,
  sourceHeight,
  maxWidth,
  maxHeight,
) {
  const scale = Math.min(
    maxWidth / sourceWidth,
    maxHeight / sourceHeight,
    1,
  );

  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}
```

Whether to allow upscaling depends on image quality.

Recommended:

```text
do not upscale low-resolution images beyond 100%
```

unless business wants full-width display regardless of source resolution.

---

# 60. Reference Page Creation

Plain page:

```javascript
const page = outputPdf.addPage([612, 792]);
```

If later business decides to use the letter pad on continuation pages:

```javascript
copy template page instead
```

Keep this behind a helper:

```javascript
createReferencePage()
```

so the page style can be changed in one place.

---

# 61. Font Strategy

The sample contains normal Latin/English content.

Version 1 can use:

```text
Helvetica
Helvetica-Bold
Helvetica-Oblique
Helvetica-BoldOblique
```

through `pdf-lib`.

If Bangla is later required:

```text
embed a licensed Unicode Bengali font
+
@pdf-lib/fontkit
```

Do not assume Helvetica can render Bengali correctly.

---

# 62. Database Design

The new sample makes an item-based data model more appropriate than a generic `blocks` table.

Use:

```text
pdf_documents
pdf_document_items
```

---

# 63. `pdf_documents` Table

Purpose:

```text
one generated/event proposal document
```

Recommended fields:

```text
id
document_no
event_date
event_title
created_by_id
status
generated_file_name
generated_file_path
page_count
template_version
generated_at
created_at
updated_at
```

---

# 64. `pdf_document_items` Table

Purpose:

```text
ordered item rows used in the summary table
and optional photo-reference section
```

Recommended fields:

```text
id
document_id
sort_order
item_name
description
quantity

reference_image_path
reference_image_original_name
reference_image_mime_type

custom_caption
created_at
updated_at
```

---

# 65. Database Relationship

```text
employees
    |
    | 1
    v
pdf_documents
    |
    | 1
    v
pdf_document_items
```

More explicitly:

```text
Employee 1 ---- many PdfDocument

PdfDocument 1 ---- many PdfDocumentItem
```

---

# 66. Recommended Prisma Models

Add to:

```text
backend/mme_node_express_backend/prisma/schema.prisma
```

Example:

```prisma
model Employee {
  // existing fields...

  pdfDocuments PdfDocument[]
}

model PdfDocument {
  id                BigInt            @id @default(autoincrement()) @db.UnsignedBigInt
  documentNo        String?           @unique @map("document_no") @db.VarChar(100)

  eventDate         DateTime          @map("event_date") @db.Date
  eventTitle        String            @map("event_title") @db.VarChar(255)

  createdById       BigInt            @map("created_by_id") @db.UnsignedBigInt

  status            PdfDocumentStatus @default(generated)

  generatedFileName String?           @map("generated_file_name") @db.VarChar(255)
  generatedFilePath String?           @map("generated_file_path") @db.VarChar(600)

  pageCount         Int?              @map("page_count")

  templateVersion   String            @default("palm-view-style-v1") @map("template_version") @db.VarChar(50)

  generatedAt       DateTime?         @map("generated_at") @db.DateTime(0)

  createdAt         DateTime          @default(now()) @map("created_at") @db.DateTime(0)
  updatedAt         DateTime          @updatedAt @map("updated_at") @db.DateTime(0)

  createdBy Employee          @relation(fields: [createdById], references: [id], onDelete: Restrict, onUpdate: NoAction)
  items     PdfDocumentItem[]

  @@index([createdById], map: "idx_pdf_documents_created_by")
  @@index([eventDate], map: "idx_pdf_documents_event_date")
  @@index([createdAt], map: "idx_pdf_documents_created_at")

  @@map("pdf_documents")
}

model PdfDocumentItem {
  id                         BigInt   @id @default(autoincrement()) @db.UnsignedBigInt

  documentId                 BigInt   @map("document_id") @db.UnsignedBigInt
  sortOrder                  Int      @map("sort_order")

  itemName                   String   @map("item_name") @db.VarChar(255)
  description                String   @db.Text
  quantity                   String   @db.VarChar(100)

  referenceImagePath         String?  @map("reference_image_path") @db.VarChar(600)
  referenceImageOriginalName String?  @map("reference_image_original_name") @db.VarChar(255)
  referenceImageMimeType     String?  @map("reference_image_mime_type") @db.VarChar(100)

  customCaption              String?  @map("custom_caption") @db.VarChar(1000)

  createdAt                  DateTime @default(now()) @map("created_at") @db.DateTime(0)
  updatedAt                  DateTime @updatedAt @map("updated_at") @db.DateTime(0)

  document PdfDocument @relation(fields: [documentId], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([documentId, sortOrder], map: "uq_pdf_document_item_order")
  @@index([documentId], map: "idx_pdf_document_items_document")

  @@map("pdf_document_items")
}

enum PdfDocumentStatus {
  draft
  generated
  archived

  @@map("pdf_document_status")
}
```

---

# 67. Why Quantity Must Be String

The real document contains:

```text
1
2
2 set
1 pair
```

Therefore:

```text
quantity Int
```

would be incorrect.

Use:

```text
String / VARCHAR
```

---

# 68. Document Number

Document number can still be generated internally:

```text
MME/2026/000028
```

However the provided sample does **not** show it visibly.

Therefore:

```text
store document number in database/history
```

but do not print it on the PDF unless Make My Event explicitly wants that later.

---

# 69. Authentication

Use existing employee authentication.

Mount:

```javascript
app.use(
  "/api/pdf-generator",
  attachBearerToken,
  requireEmployee,
  pdfGeneratorRoutes,
);
```

Employee identity:

```javascript
req.employee.id
```

Never trust:

```text
employeeId sent from frontend
```

---

# 70. Ownership Security

Every document query must include:

```text
document id
AND
current employee id
```

Example:

```javascript
const document = await prisma.pdfDocument.findFirst({
  where: {
    id: BigInt(req.params.id),
    createdById: BigInt(req.employee.id),
  },
});
```

If not found:

```http
404
```

Do not reveal another employee's document existence.

---

# 71. Multer Upload

The project already uses Multer.

Recommended:

```javascript
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 30,
  },

  fileFilter(req, file, cb) {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
    ]);

    if (!allowed.has(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, JPEG and PNG images are supported.",
        ),
      );
    }

    cb(null, true);
  },
});
```

---

# 72. Do Not Trust Filename Extension

Frontend:

```html
accept=".jpg,.jpeg,.png"
```

is useful UX but not sufficient security.

Backend must validate:

```text
MIME type
```

and preferably:

```text
file signature / magic bytes
```

before persistent saving.

---

# 73. Source Image Storage

If generated documents need future editing/regeneration:

```text
store source images persistently
```

Recommended:

```text
PDF_GENERATOR_STORAGE_DIR/
|
|-- generated/
|
`-- source-images/
    |
    `-- document-28/
        |-- item-1-uuid.jpg
        |-- item-2-uuid.jpg
        `-- item-5-uuid.jpg
```

If editing is not required, source images can be deleted after final PDF generation.

However, for a proper office-management history system, preserving the source references is recommended.

---

# 74. Generated PDF Storage

Recommended:

```text
PDF_GENERATOR_STORAGE_DIR/generated/
```

Example:

```text
MME-2026-000028.pdf
```

Do not store generated files inside:

```text
frontend/public
frontend/dist
```

---

# 75. Recommended Environment Variables

Add:

```env
PDF_GENERATOR_BACKEND_DIR=
PDF_GENERATOR_STORAGE_DIR=
PDF_GENERATOR_TEMPLATE_PATH=
```

Example production values:

```env
PDF_GENERATOR_BACKEND_DIR=/home/.../mme-office-app/pdf-generator-module
PDF_GENERATOR_STORAGE_DIR=/home/.../mme-office-data/pdf-generator
PDF_GENERATOR_TEMPLATE_PATH=/home/.../mme-office-app/pdf-generator-module/templates/make-my-event-letter-pad.pdf
```

Use actual cPanel paths.

---

# 76. Main Backend Server Integration

Edit:

```text
backend/mme_node_express_backend/src/server.js
```

Resolve the new top-level module in the same architectural style as Accounts.

Example:

```javascript
const pdfGeneratorBackendDirectory =
  process.env.PDF_GENERATOR_BACKEND_DIR
    ? path.resolve(
        process.env.PDF_GENERATOR_BACKEND_DIR,
      )
    : path.resolve(
        __dirname,
        "../../../PDFGenerator/backend",
      );

const {
  default: pdfGeneratorRoutes,
} = require(
  path.join(
    pdfGeneratorBackendDirectory,
    "routes/pdfGenerator.js",
  ),
);
```

Then:

```javascript
app.use(
  "/api/pdf-generator",
  attachBearerToken,
  requireEmployee,
  pdfGeneratorRoutes,
);
```

---

# 77. React Route Integration

Edit:

```text
frontend/make my event office management system/src/App.jsx
```

Add:

```javascript
import PDFGeneratorPage
  from "../../../PDFGenerator/frontend/pages/PDFGeneratorPage";

import PDFHistoryPage
  from "../../../PDFGenerator/frontend/pages/PDFHistoryPage";
```

Routes:

```jsx
<Route
  path="/pdf-generator"
  element={
    <RequirePasswordChange>
      <PDFGeneratorPage />
    </RequirePasswordChange>
  }
/>

<Route
  path="/pdf-generator/history"
  element={
    <RequirePasswordChange>
      <PDFHistoryPage />
    </RequirePasswordChange>
  }
/>
```

---

# 78. Employee Sidebar

Edit:

```text
EmployeeSidebar.jsx
```

Add:

```javascript
{
  to: "/pdf-generator",
  label: "PDF Generator",
  icon: FileText,
}
```

Final top-level employee modules:

```text
Management
Accounts
PDF Generator
```

---

# 79. Protected SPA Prefix

Add:

```text
/accounts
/pdf-generator
```

to the production protected-page list if they are missing.

Recommended:

```javascript
const PROTECTED_PAGE_PREFIXES = [
  "/management",
  "/calendar",
  "/accounts",
  "/pdf-generator",
];
```

API protection with `requireEmployee` remains mandatory regardless.

---

# 80. Document History

Route:

```text
/pdf-generator/history
```

Recommended columns:

```text
Document No
Event Date
Event Title
Item Count
Photo Count
Page Count
Generated At
Actions
```

Actions:

```text
Preview
Download
Archive
```

---

# 81. History Search

Recommended filters:

```text
Event title
Document number
Date range
Generated date
Status
```

Employee sees only their own documents.

---

# 82. Optional Admin View

Future route:

```text
/admin/pdf-generator
```

Admin can:

```text
view all PDFs
filter by employee
download
archive
see creator
see date
```

Protect with:

```text
requireAdmin
```

---

# 83. Preview Implementation

Preview must call the same backend renderer as final generation.

Flow:

```text
Form
 |
 v
FormData
 |
 v
POST /preview
 |
 v
real PDF bytes
 |
 v
Blob URL
 |
 v
iframe/object
```

Do not approximate the PDF using CSS.

---

# 84. Preview Frontend Example

```javascript
const response = await fetch(
  `${API_BASE_URL}/pdf-generator/preview`,
  {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/pdf",
    },
  },
);

if (!response.ok) {
  throw new Error("Unable to generate preview.");
}

const blob = await response.blob();
const url = URL.createObjectURL(blob);

setPreviewUrl(url);
```

Revoke old URL when replaced.

---

# 85. Final Generation Transaction

Recommended logical process:

```text
validate request
 |
create DB document row
 |
store source images
 |
create item rows
 |
generate PDF
 |
store PDF
 |
update document:
    file path
    page count
    generatedAt
    status=generated
 |
commit
```

If generation fails:

```text
rollback database transaction
remove temporary files
```

Use careful cleanup for any file created before the database operation finishes.

---

# 86. Deployment — Critical Requirement

The existing project deploys the top-level Accounts module separately.

The PDF Generator must be added to:

```text
.github/workflows/deploy.yml
```

Otherwise:

```text
works locally
fails in production
```

---

# 87. Deploy Validation

Add checks such as:

```bash
test -f "PDFGenerator/backend/routes/pdfGenerator.js"
test -f "PDFGenerator/backend/controllers/pdfGeneratorController.js"
test -f "PDFGenerator/backend/services/pdfGeneratorService.js"
test -f "PDFGenerator/backend/services/firstPageRenderer.js"
test -f "PDFGenerator/backend/services/tableRenderer.js"
test -f "PDFGenerator/backend/services/referencePageRenderer.js"
test -f "PDFGenerator/backend/config/pdfLayout.js"
test -f "PDFGenerator/backend/templates/make-my-event-letter-pad.pdf"
```

---

# 88. Production Module Upload

Recommended deployment folder:

```text
${APP_DIR}/pdf-generator-module
```

Upload:

```text
config/
controllers/
routes/
services/
utils/
templates/
```

Do **not** deploy runtime-generated files from the repository.

Persistent storage is separate.

---

# 89. New Dependency Deployment

After:

```bash
npm install pdf-lib
```

commit:

```text
package.json
package-lock.json
```

The cPanel Node environment must install the updated dependencies through its supported installation process.

Do not assume GitHub SFTP upload automatically installs Node packages.

---

# 90. Persistent Storage Must Survive Deployments

Never configure deployment to delete:

```text
PDF_GENERATOR_STORAGE_DIR
```

Generated PDFs are company records.

Application deployment and user-generated storage must remain separate.

---

# 91. Error Messages

Recommended clean errors:

Unsupported format:

```json
{
  "message": "Only JPG, JPEG and PNG reference images are supported."
}
```

Missing title:

```json
{
  "message": "Event title is required."
}
```

No items:

```json
{
  "message": "Add at least one event item."
}
```

Missing template:

```json
{
  "message": "PDF generation is temporarily unavailable."
}
```

Do not expose server file paths.

---

# 92. Validation Rules

Document:

```text
eventDate required
eventTitle required
at least 1 item
```

Each item:

```text
itemName required
description required
quantity required
```

Image:

```text
optional
JPG/JPEG/PNG
max configured size
```

Caption:

```text
optional
length limit
```

---

# 93. Recommended Character Limits

Example:

```text
Event title: 150
Item name: 100
Description: 2000
Quantity: 100
Custom caption: 1500
Items: 50
Images: 30
```

These are validation defaults and can be adjusted.

---

# 94. Visual Testing Requirements

The generated PDF must be inspected visually.

Required test documents:

```text
01_basic_8_items.pdf

02_long_descriptions.pdf

03_15_items_table_overflow.pdf

04_one_reference_image.pdf

05_two_landscape_images_same_page.pdf

06_portrait_then_landscape.pdf

07_many_reference_images.pdf

08_large_single_image.pdf

09_image_with_long_caption.pdf

10_no_images.pdf
```

---

# 95. Test: Sample Reconstruction

A mandatory acceptance test is to recreate the provided Palm View example structure:

```text
Event Date:
04/08/24

Event Title:
Wedding Reception

8 summary rows

Photos:
Stage
Photo booth
Partition
Entry Gate
Sofa
```

The output should follow approximately:

```text
Page 1:
Letter pad + table

Page 2:
Stage
Photo booth

Page 3:
Partition
Entry Gate

Page 4:
Sofa
```

Exact page allocation may vary slightly depending on the final approved font metrics and photo dimensions, but the layout behavior must match the same principle.

---

# 96. Important Output Rules

## Rule 1

First/main page:

```text
Make My Event letter pad
```

must be preserved.

## Rule 2

The first page contains:

```text
date
event title
item table
```

## Rule 3

Items without images:

```text
table only
```

## Rule 4

Items with images:

```text
table
+
reference block after table section
```

## Rule 5

Reference blocks follow item order.

## Rule 6

More than one reference block can share a page.

## Rule 7

Never split an image from its caption unless technically unavoidable.

## Rule 8

If a block cannot fit:

```text
move block to next page
```

## Rule 9

If one image is too large:

```text
resize proportionally
```

## Rule 10

Never stretch.

## Rule 11

Never crop by default.

## Rule 12

Continuation/reference pages are plain white by default because that matches the provided sample.

---

# 97. Changes Compared With the Earlier MD Guide

The updated specification intentionally changes the following earlier decisions:

### Previous

```text
Generic text/image block builder
```

### Updated

```text
Structured event proposal builder:
event + item table + optional image per item
```

---

### Previous

```text
One image always gets one dedicated page
```

### Updated

```text
One image belongs to one item/reference block.
Multiple blocks may share a page.
```

---

### Previous

```text
Every generated page uses the letter pad
```

### Updated

```text
First/main page uses letter pad.
Reference continuation pages are plain by default,
matching the actual sample.
```

---

### Previous

```text
pdf_document_blocks
```

### Updated

```text
pdf_document_items
```

because the source document is item-centric.

---

### Previous

```text
arbitrary body text
```

### Updated

```text
event title
dynamic item rows
descriptions
quantity
reference caption
reference image
```

This structure is easier for employees and generates a more consistent company document.

---

# 98. Recommended Implementation Phases

## Phase 1 — Module Integration

Implement:

```text
PDFGenerator/ folder
sidebar item
React routes
backend route loading
authenticated API mount
deployment workflow path
```

Success criteria:

```text
PDF Generator opens in local and production environment.
```

---

## Phase 2 — First Page Template

Implement:

```text
load letter-pad PDF
copy page
draw date
draw event title
```

Success:

```text
branding unchanged
```

---

## Phase 3 — Dynamic Table Engine

Implement:

```text
Sl
Item
Description
Qty

text wrapping
dynamic row height
table borders
table overflow
```

Success:

```text
sample table can be reproduced.
```

---

## Phase 4 — Reference Image Engine

Implement:

```text
item caption
image embedding
aspect ratio
page width fit
dynamic image height
```

Success:

```text
one image block renders correctly.
```

---

## Phase 5 — Flow Pagination

Implement:

```text
multiple blocks per page
measure-before-render
move block to next page
prevent tiny image shrinking
```

Success:

```text
Stage + Photo booth can share a page
when dimensions permit.
```

---

## Phase 6 — Frontend Form

Implement:

```text
event date
event title
item add/delete/reorder
description
quantity
image upload
thumbnail
caption override
```

---

## Phase 7 — Preview

Implement:

```text
multipart preview request
actual backend PDF
iframe preview
```

---

## Phase 8 — Persistence

Implement:

```text
Prisma models
migration
source image storage
generated PDF storage
history
download
```

---

## Phase 9 — Production Hardening

Implement:

```text
deploy.yml
cPanel environment variables
dependency installation
authorization tests
persistent storage verification
visual regression tests
```

---

# 99. Acceptance Criteria

## Module

- [ ] PDF Generator appears beside Accounts.
- [ ] Existing employee layout is reused.
- [ ] Existing authentication is reused.
- [ ] Unauthenticated API access is blocked.

## Event Information

- [ ] Employee can select date.
- [ ] Employee can enter event title.

## Items

- [ ] Add item.
- [ ] Delete item.
- [ ] Reorder item.
- [ ] Automatic serial number.
- [ ] Item name.
- [ ] Description.
- [ ] Quantity accepts units/text.

## Images

- [ ] Image is optional per item.
- [ ] JPG supported.
- [ ] JPEG supported.
- [ ] PNG supported.
- [ ] Image thumbnail shown in UI.
- [ ] Image can be removed/replaced.
- [ ] Aspect ratio maintained.
- [ ] No stretching.
- [ ] No default cropping.

## First Page

- [ ] Uses original Make My Event template.
- [ ] Date rendered in correct area.
- [ ] Event title rendered.
- [ ] Four-column table rendered.
- [ ] Table borders match professional format.
- [ ] Descriptions wrap.
- [ ] Row heights adapt.

## Reference Pages

- [ ] Only items with images appear.
- [ ] Caption is generated from item + description.
- [ ] Custom caption can override.
- [ ] Multiple image blocks can share page.
- [ ] Block moves to next page if necessary.
- [ ] Image resized if necessary.
- [ ] Reference pages use plain white style by default.

## Preview

- [ ] Uses real PDF renderer.
- [ ] Matches downloaded PDF.

## Database

- [ ] Document saved.
- [ ] Items saved.
- [ ] Image metadata saved.
- [ ] Correct employee ownership saved.

## Security

- [ ] Employee cannot download another employee's PDF.
- [ ] Upload type validated server-side.
- [ ] File names are generated safely.
- [ ] Template path cannot be supplied by client.

## Production

- [ ] PDFGenerator backend deployed.
- [ ] Template deployed.
- [ ] `pdf-lib` installed.
- [ ] Storage path persistent.
- [ ] Generated PDFs survive redeploy.
- [ ] Direct `/pdf-generator` refresh works.

---

# 100. Definition of Done

The feature is complete when an employee can reproduce the business workflow represented by the real sample:

```text
Open PDF Generator

Enter:
04/08/24

Enter:
Wedding Reception

Add:
Stage
Photo booth
Entry Gate
Partition
Sofa
Platform
Sound System
Welcome Banner

Enter:
descriptions
quantities

Upload photos for:
Stage
Photo booth
Partition
Entry Gate
Sofa

Preview

Generate
```

and receive a PDF that behaves like:

```text
PAGE 1
Make My Event official letter pad
Date
Wedding Reception
Sl / Item / Description / Qty table

PAGE 2+
Photo references
with item/description text
and large client-selected images

Multiple references on one page where they fit
One reference on a page where required
```

without any manual PDF page designing by the employee.

---

# 101. Final Engineering Decision

The correct implementation is:

> **A structured Event Proposal PDF Generator, not a generic document editor.**

The first page must be generated from:

```text
official letter-pad template
+
date
+
event title
+
dynamic event-item table
```

The following pages must be generated from:

```text
ordered event items that have selected images
```

Each reference block contains:

```text
item name
+
description/custom caption
+
one reference image
```

The rendering engine must:

```text
measure each block
fit multiple blocks when possible
start a new page when necessary
resize images proportionally
preserve image aspect ratio
avoid cropping
avoid stretching
```

This architecture most closely reproduces the provided real Make My Event document while remaining maintainable, secure, and compatible with the existing website architecture.

---

# 102. Final Architecture Diagram

```text
                  MAKE MY EVENT WEBSITE
                           |
        +------------------+------------------+
        |                  |                  |
   Management           Accounts        PDF Generator
                                              |
                         +--------------------+-------------------+
                         |                                        |
                   New Document                             History
                         |
                         v
                Event Details Form
                         |
                 +-------+-------+
                 |               |
              Date/Title      Item List
                                 |
                         +-------+--------+
                         |                |
                    Description       Quantity
                         |
                   Optional Image
                         |
                         v
                  multipart/form-data
                         |
                         v
             /api/pdf-generator/*
                         |
                 requireEmployee
                         |
                         v
             PDF Generator Backend
                         |
          +--------------+----------------+
          |              |                |
       First Page     Table Engine    Reference Engine
          |              |                |
          |              |          Caption + Image
          |              |                |
          +--------------+----------------+
                         |
                         v
                      pdf-lib
                         |
              +----------+----------+
              |                     |
          Letter Pad            Plain Pages
          Page 1              Reference Pages
              |                     |
              +----------+----------+
                         |
                         v
                    Final PDF
                         |
              +----------+----------+
              |                     |
           Prisma             Persistent Files
              |                     |
       pdf_documents         generated/*.pdf
       pdf_document_items    source-images/*
              |
              v
          PDF History
```

---

## Short Implementation Summary

Build the module so that:

1. **Page 1 is the official Make My Event letter pad.**
2. **Page 1 contains date, event title, and a dynamic Sl/Item/Description/Qty table.**
3. **Every item may optionally have one reference/client-selected photo.**
4. **Items with photos generate reference blocks after the table section.**
5. **The reference caption defaults to Item Name + Description.**
6. **Multiple image blocks may share one page when they fit.**
7. **If a block does not fit, move the entire block to a new page.**
8. **If an image is large, proportionally resize it to fit.**
9. **Never stretch or crop images by default.**
10. **Reference pages are plain white by default to match the provided example.**
11. **Preview and final generation use the same backend PDF renderer.**
12. **Generated PDFs and source images are stored outside the frontend build.**
13. **Document data is stored with Prisma/MySQL.**
14. **Employee identity comes only from the existing authenticated session.**
15. **Deployment is updated exactly as required for a top-level module like Accounts.**
